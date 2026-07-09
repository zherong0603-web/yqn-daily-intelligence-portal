import { pathToFileURL } from "node:url";
import { dateInTimeZone } from "../utils/date.js";
import { readEnv } from "../utils/env.js";
import { signDingTalkUrl } from "./utils/signDingTalk.js";

type RunStatus = "completed" | "queued" | "in_progress" | "requested" | "waiting" | string;

interface WorkflowRun {
  id: number;
  event: string;
  status: RunStatus;
  conclusion: string | null;
  created_at: string;
  html_url: string;
}

interface RunsResponse {
  workflow_runs?: WorkflowRun[];
}

interface WatchdogConfig {
  repository: string;
  token: string;
  workflowFile: string;
  ref: string;
  date: string;
  dispatchIfMissing: boolean;
  ownerWebhookUrl?: string;
  testWebhookUrl?: string;
  testWebhookSecret?: string;
}

interface WatchdogDecision {
  shouldDispatch: boolean;
  reason: string;
  matchingRun?: WorkflowRun;
}

function requiredEnv(name: string): string {
  const value = readEnv(name);
  if (!value) throw new Error(`SETUP_ERROR: ${name} is required for DingTalk watchdog`);
  return value;
}

function readConfig(): WatchdogConfig {
  return {
    repository: requiredEnv("GITHUB_REPOSITORY"),
    token: requiredEnv("GITHUB_TOKEN"),
    workflowFile: readEnv("WATCHDOG_TARGET_WORKFLOW") || "dingtalk-morning-brief.yml",
    ref: readEnv("WATCHDOG_REF") || readEnv("GITHUB_REF_NAME") || "main",
    date: readEnv("WATCHDOG_BRIEF_DATE") || dateInTimeZone("Asia/Shanghai"),
    dispatchIfMissing: (readEnv("WATCHDOG_DISPATCH_IF_MISSING") || "true").toLowerCase() !== "false",
    ownerWebhookUrl: readEnv("DINGTALK_OWNER_WEBHOOK_URL"),
    testWebhookUrl: readEnv("DINGTALK_WEBHOOK_URL"),
    testWebhookSecret: readEnv("DINGTALK_SECRET"),
  };
}

function expectedScheduleStartUtc(date: string): Date {
  return new Date(`${date}T00:45:00.000Z`);
}

function isActive(status: RunStatus): boolean {
  return ["queued", "in_progress", "requested", "waiting"].includes(status);
}

export function decideWatchdog(runs: WorkflowRun[], date: string, now = new Date()): WatchdogDecision {
  const expectedStart = expectedScheduleStartUtc(date);
  const relevant = runs
    .filter((run) => new Date(run.created_at).getTime() >= expectedStart.getTime())
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const active = relevant.find((run) => isActive(run.status));
  if (active) {
    return {
      shouldDispatch: false,
      reason: `08:45 后已有运行中的任务：${active.status}`,
      matchingRun: active,
    };
  }

  const successful = relevant.find((run) => run.status === "completed" && run.conclusion === "success");
  if (successful) {
    return {
      shouldDispatch: false,
      reason: "08:45 后已有成功完成的主任务",
      matchingRun: successful,
    };
  }

  if (now.getTime() < expectedStart.getTime()) {
    return {
      shouldDispatch: false,
      reason: "当前还没到 08:45 主发送窗口",
    };
  }

  const failed = relevant.find((run) => run.status === "completed" && run.conclusion !== "success");
  if (failed) {
    return {
      shouldDispatch: true,
      reason: `08:45 后的主任务未成功：${failed.conclusion || "unknown"}`,
      matchingRun: failed,
    };
  }

  return {
    shouldDispatch: true,
    reason: "未发现 08:45 后的主发送任务",
  };
}

async function githubJson<T>(config: WatchdogConfig, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      Authorization: `Bearer ${config.token}`,
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`GitHub API request failed with HTTP ${response.status}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

async function listWorkflowRuns(config: WatchdogConfig): Promise<WorkflowRun[]> {
  const since = expectedScheduleStartUtc(config.date).toISOString();
  const params = new URLSearchParams({
    per_page: "30",
    created: `>=${since}`,
  });
  const response = await githubJson<RunsResponse>(
    config,
    `/repos/${config.repository}/actions/workflows/${config.workflowFile}/runs?${params.toString()}`,
  );
  return response.workflow_runs || [];
}

async function dispatchMainWorkflow(config: WatchdogConfig): Promise<void> {
  await githubJson<Record<string, never>>(config, `/repos/${config.repository}/actions/workflows/${config.workflowFile}/dispatches`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ref: config.ref,
      inputs: {
        mode: "live",
        brief_date: config.date,
        dry_run: "false",
      },
    }),
  });
}

function notificationTarget(config: WatchdogConfig): { url?: string; secret?: string; label: string } {
  if (config.ownerWebhookUrl) return { url: config.ownerWebhookUrl, label: "owner" };
  return { url: config.testWebhookUrl, secret: config.testWebhookSecret, label: "test-group" };
}

async function postMarkdown(url: string, secret: string | undefined, title: string, markdown: string): Promise<void> {
  const response = await fetch(signDingTalkUrl(url, secret), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      msgtype: "markdown",
      markdown: { title, text: markdown },
    }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`DingTalk watchdog notification failed with HTTP ${response.status}`);
  try {
    const body = JSON.parse(text || "{}") as { errcode?: number };
    if (typeof body.errcode === "number" && body.errcode !== 0) {
      throw new Error(`DingTalk watchdog notification rejected with errcode ${body.errcode}`);
    }
  } catch (error) {
    if (error instanceof SyntaxError) return;
    throw error;
  }
}

async function notify(config: WatchdogConfig, markdown: string): Promise<void> {
  const target = notificationTarget(config);
  if (!target.url) {
    console.warn("[dingtalk:watchdog] no owner/test DingTalk webhook configured; notification skipped");
    return;
  }
  try {
    await postMarkdown(target.url, target.secret, "YQN 每日 5 分钟兜底提醒", markdown);
    console.warn(`[dingtalk:watchdog] notification sent to ${target.label}`);
  } catch {
    console.warn("[dingtalk:watchdog] notification failed");
  }
}

export async function runWatchdog(config = readConfig()): Promise<WatchdogDecision> {
  const runs = await listWorkflowRuns(config);
  const decision = decideWatchdog(runs, config.date);
  console.log(`[dingtalk:watchdog] ${decision.reason}`);

  if (!decision.shouldDispatch) return decision;
  if (!config.dispatchIfMissing) {
    console.log("[dingtalk:watchdog] dispatch disabled; check only");
    return decision;
  }

  await notify(config, [
    `# YQN 每日 5 分钟 09:05 兜底触发｜${config.date}`,
    "",
    `**原因：** ${decision.reason}`,
    "",
    "系统将自动补发一次 live 版到钉钉测试群。此提醒不包含 webhook、secret 或 API key。",
  ].join("\n"));
  await dispatchMainWorkflow(config);
  console.log("[dingtalk:watchdog] workflow_dispatch triggered for live dry_run=false");
  return decision;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runWatchdog().catch((error) => {
    console.error(error instanceof Error ? error.message : "DingTalk watchdog failed");
    process.exit(1);
  });
}
