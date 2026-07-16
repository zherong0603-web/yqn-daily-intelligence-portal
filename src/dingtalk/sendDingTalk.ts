import { pathToFileURL } from "node:url";
import { readDingtalkRuntimeConfig, DingtalkRuntimeConfig } from "./config.js";
import { DingtalkBrief, productName, robotDisplayName } from "./schema.js";
import { signDingTalkUrl } from "./utils/signDingTalk.js";
import { runPreSendValidation } from "./validateBeforeSend.js";

interface DingTalkResponse {
  errcode?: number;
  errmsg?: string;
}

interface WorkflowRun {
  id: number;
  status: string;
  conclusion: string | null;
  created_at: string;
  html_url: string;
}

interface WorkflowRunsResponse {
  workflow_runs?: WorkflowRun[];
}

interface WorkflowJob {
  id: number;
}

interface WorkflowJobsResponse {
  jobs?: WorkflowJob[];
}

export interface DingTalkDeliveryTarget {
  webhookUrl?: string;
  secret?: string;
  label: "formal-group" | "yqn-livestream-group" | "test-group";
}

function markdownPayload(title: string, text: string) {
  return {
    msgtype: "markdown",
    markdown: { title, text },
  };
}

function expectedMorningSendStartUtc(date: string): Date {
  return new Date(`${date}T00:45:00.000Z`);
}

export function priorSuccessfulRunCandidates(runs: WorkflowRun[], date: string, currentRunId: string): WorkflowRun[] {
  const expectedStart = expectedMorningSendStartUtc(date).getTime();
  const current = Number(currentRunId);
  return runs
    .filter((run) => Number.isFinite(current) ? run.id !== current : String(run.id) !== currentRunId)
    .filter((run) => new Date(run.created_at).getTime() >= expectedStart)
    .filter((run) => run.status === "completed" && run.conclusion === "success")
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function priorCompletedRunCandidates(runs: WorkflowRun[], date: string, currentRunId: string): WorkflowRun[] {
  const expectedStart = expectedMorningSendStartUtc(date).getTime();
  const current = Number(currentRunId);
  return runs
    .filter((run) => Number.isFinite(current) ? run.id !== current : String(run.id) !== currentRunId)
    .filter((run) => new Date(run.created_at).getTime() >= expectedStart)
    .filter((run) => run.status === "completed")
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

async function githubJson<T>(config: DingtalkRuntimeConfig, path: string): Promise<T> {
  if (!config.githubToken) throw new Error("GITHUB_TOKEN is required");
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      Authorization: `Bearer ${config.githubToken}`,
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`GitHub API request failed with HTTP ${response.status}`);
  return (text ? JSON.parse(text) : {}) as T;
}

async function githubText(config: DingtalkRuntimeConfig, path: string): Promise<string> {
  if (!config.githubToken) throw new Error("GITHUB_TOKEN is required");
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      Authorization: `Bearer ${config.githubToken}`,
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`GitHub API request failed with HTTP ${response.status}`);
  return text;
}

async function runHasSendMarker(config: DingtalkRuntimeConfig, repository: string, runId: number, marker: string): Promise<boolean> {
  const jobs = await githubJson<WorkflowJobsResponse>(config, `/repos/${repository}/actions/runs/${runId}/jobs?per_page=50`);
  for (const job of jobs.jobs || []) {
    const logText = await githubText(config, `/repos/${repository}/actions/jobs/${job.id}/logs`);
    if (logText.includes(marker)) return true;
  }
  return false;
}

async function priorTargetSend(config: DingtalkRuntimeConfig, target: DingTalkDeliveryTarget): Promise<WorkflowRun | undefined> {
  if (!config.githubToken || !process.env.GITHUB_REPOSITORY) return undefined;
  if (!/^\d+$/.test(config.runId)) return undefined;
  const repository = process.env.GITHUB_REPOSITORY;
  const params = new URLSearchParams({
    per_page: "20",
    created: `>=${expectedMorningSendStartUtc(config.date).toISOString()}`,
  });
  const runs = await githubJson<WorkflowRunsResponse>(
    config,
    `/repos/${repository}/actions/workflows/dingtalk-morning-brief.yml/runs?${params.toString()}`,
  );
  const marker = `[dingtalk:send] ${target.label} markdown message sent`;
  for (const run of priorCompletedRunCandidates(runs.workflow_runs || [], config.date, config.runId)) {
    if (await runHasSendMarker(config, repository, run.id, marker)) return run;
  }
  return undefined;
}

async function postMarkdown(webhookUrl: string, secret: string | undefined, title: string, markdown: string): Promise<DingTalkResponse> {
  const response = await fetch(signDingTalkUrl(webhookUrl, secret), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(markdownPayload(title, markdown)),
  });
  const text = await response.text();
  let body: DingTalkResponse = {};
  try {
    body = text ? JSON.parse(text) as DingTalkResponse : {};
  } catch {
    body = { errmsg: text.slice(0, 120) };
  }
  if (!response.ok) {
    throw new Error(`DingTalk webhook failed with HTTP ${response.status}`);
  }
  if (typeof body.errcode === "number" && body.errcode !== 0) {
    throw new Error(`DingTalk webhook rejected message: errcode ${body.errcode}`);
  }
  return body;
}

async function notifyOwner(config: DingtalkRuntimeConfig, brief: DingtalkBrief, riskTypes: string[]): Promise<void> {
  const target = notificationTarget(config);
  if (!target.webhookUrl) return;
  const markdown = [
    `# ${productName}发送已阻断｜${brief.date}`,
    "",
    `**风险类型：** ${riskTypes.join(", ") || "unknown"}`,
    "",
    "系统已生成 risk_report.json。日志和提醒不包含原文敏感内容。",
  ].join("\n");
  try {
    await postMarkdown(target.webhookUrl, target.secret, "YQN 钉钉晨报发送已阻断", markdown);
    console.warn(`[dingtalk:send] risk warning sent to ${target.label}`);
  } catch {
    console.warn("[dingtalk:send] owner risk warning failed");
  }
}

export function deliveryTargets(config: DingtalkRuntimeConfig): DingTalkDeliveryTarget[] {
  const targets: DingTalkDeliveryTarget[] = [];
  if (config.formalGroupEnabled) {
    if (!config.formalWebhookUrl) {
      throw new Error("SETUP_ERROR: DINGTALK_FORMAL_WEBHOOK_URL is required when DINGTALK_FORMAL_GROUP_ENABLED=true");
    }
    targets.push({ webhookUrl: config.formalWebhookUrl, secret: config.formalSecret, label: "formal-group" });
  }
  if (config.livestreamGroupEnabled) {
    if (!config.livestreamWebhookUrl) {
      throw new Error("SETUP_ERROR: DINGTALK_YQN_LIVE_GROUP_WEBHOOK_URL is required when DINGTALK_YQN_LIVE_GROUP_ENABLED=true");
    }
    targets.push({ webhookUrl: config.livestreamWebhookUrl, secret: config.livestreamSecret, label: "yqn-livestream-group" });
  }
  if (!targets.length) targets.push({ webhookUrl: config.webhookUrl, secret: config.secret, label: "test-group" });
  return targets;
}

function notificationTarget(config: DingtalkRuntimeConfig): { webhookUrl?: string; secret?: string; label: string } {
  if (config.ownerWebhookUrl) return { webhookUrl: config.ownerWebhookUrl, label: "owner" };
  return { webhookUrl: config.webhookUrl, secret: config.secret, label: "test-group" };
}

export async function sendOwnerFailure(config = readDingtalkRuntimeConfig()): Promise<void> {
  const target = notificationTarget(config);
  if (!target.webhookUrl) {
    console.warn("[dingtalk:failure] no owner/test webhook configured; failure notification skipped");
    return;
  }
  const stage = process.env.FAILURE_STAGE || "unknown stage";
  const markdown = [
    `# ${productName} workflow 失败｜${config.date}`,
    "",
    `**失败阶段：** ${stage}`,
    "",
    "请打开 GitHub Actions 查看失败步骤。此提醒不包含 webhook、secret、API key 或原文敏感内容。",
  ].join("\n");
  await postMarkdown(target.webhookUrl, target.secret, "YQN 钉钉晨报 workflow 失败", markdown);
  console.warn(`[dingtalk:failure] failure warning sent to ${target.label}`);
}

export async function sendDingtalkBrief(config = readDingtalkRuntimeConfig()): Promise<void> {
  let validation;
  try {
    validation = await runPreSendValidation(config);
  } catch (error) {
    try {
      const fallback = await runPreSendValidation({ ...config, dryRun: true });
      await notifyOwner(config, fallback.brief, fallback.report.blockers);
    } catch {
      // Validation reports already avoid raw sensitive content.
    }
    throw error;
  }
  if (config.dryRun) {
    console.log("[dingtalk:send] dry_run=true; DingTalk message was not sent");
    return;
  }
  const targets = deliveryTargets(config);
  let sent = 0;
  for (const target of targets) {
    const alreadySent = await priorTargetSend(config, target);
    if (alreadySent) {
      console.log(`[dingtalk:send] ${target.label} send already confirmed in run ${alreadySent.id}; duplicate send skipped`);
      continue;
    }
    if (!target.webhookUrl) {
      console.warn(`[dingtalk:send] ${target.label} webhook is not configured; send skipped`);
      continue;
    }
    await postMarkdown(target.webhookUrl, target.secret, validation.brief.title, validation.markdown);
    console.log(`[dingtalk:send] ${target.label} markdown message sent`);
    sent += 1;
  }
  if (!sent) console.log("[dingtalk:send] no unsent delivery targets remained");
}

export async function sendDingtalkIntro(config = readDingtalkRuntimeConfig()): Promise<void> {
  if (config.dryRun) {
    console.log("[dingtalk:intro] dry_run=true; DingTalk intro was not sent");
    return;
  }
  const markdown = [
    `# ${robotDisplayName}已接入`,
    "",
    `大家好，我是 ${robotDisplayName}。每个工作日 8:45 提供 2 条美国、2 条墨西哥和 1 条美墨联动的跨境电商物流晨报。`,
  ].join("\n");
  for (const target of deliveryTargets(config)) {
    if (!target.webhookUrl) {
      console.warn(`[dingtalk:intro] ${target.label} webhook is not configured; intro skipped`);
      continue;
    }
    await postMarkdown(target.webhookUrl, target.secret, `${robotDisplayName}已接入`, markdown);
    console.log(`[dingtalk:intro] ${target.label} intro message sent`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const task = process.argv[2] === "failure"
    ? sendOwnerFailure()
    : process.argv[2] === "intro"
      ? sendDingtalkIntro()
      : sendDingtalkBrief();
  task.catch((error) => {
    console.error(error instanceof Error ? error.message : "DingTalk send failed");
    process.exit(1);
  });
}
