import { appendFile, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { readEnv } from "../utils/env.js";
import {
  renderSellerProblemMarkdown,
  validateSellerProblemBrief,
} from "./buildSellerProblemBrief.js";
import { signDingTalkUrl } from "./utils/signDingTalk.js";

interface DingTalkResponse {
  errcode?: number;
  errmsg?: string;
}

interface WorkflowRun {
  id: number;
  status: string;
  conclusion: string | null;
  created_at: string;
}

interface WorkflowJob {
  id: number;
}

const workflowFile = "dingtalk-seller-problem-send.yml";
const defaultTargetLabel = "yqn-livestream-group";
const targetLabelPattern = /^[a-z0-9][a-z0-9-]{0,62}$/;
const maxMarkdownBytes = 18_000;
const networkTimeoutMs = 20_000;

function readArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function parseBoolean(value: string | undefined): boolean {
  return ["1", "true", "yes", "y"].includes((value || "").trim().toLowerCase());
}

async function readInput(): Promise<unknown> {
  const encoded = readEnv("SELLER_BRIEF_JSON_B64");
  if (encoded) return JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) as unknown;
  const file = readArg("--file");
  if (!file) throw new Error("SETUP_ERROR: provide SELLER_BRIEF_JSON_B64 or --file <brief.json>");
  return JSON.parse(await readFile(path.resolve(file), "utf8")) as unknown;
}

async function githubJson<T>(apiPath: string, token: string): Promise<T> {
  const response = await fetch(`https://api.github.com${apiPath}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      Authorization: `Bearer ${token}`,
    },
    signal: AbortSignal.timeout(networkTimeoutMs),
  });
  if (!response.ok) throw new Error(`GitHub duplicate check failed with HTTP ${response.status}`);
  return await response.json() as T;
}

async function githubText(apiPath: string, token: string): Promise<string> {
  const response = await fetch(`https://api.github.com${apiPath}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      Authorization: `Bearer ${token}`,
    },
    signal: AbortSignal.timeout(networkTimeoutMs),
  });
  if (!response.ok) throw new Error(`GitHub duplicate log check failed with HTTP ${response.status}`);
  return await response.text();
}

export function resolveTargetLabel(): string {
  const label = readEnv("SELLER_BRIEF_TARGET_LABEL") || defaultTargetLabel;
  if (!targetLabelPattern.test(label)) {
    throw new Error("SETUP_ERROR: seller brief target label must use lowercase letters, digits, and hyphens");
  }
  return label;
}

export function successMarker(date: string, targetLabel = defaultTargetLabel): string {
  return `[seller-brief:send] date=${date} ${targetLabel} markdown message sent`;
}

export function formalAttemptMarker(date: string, targetLabel = defaultTargetLabel): string {
  return `[seller-brief:attempt] date=${date} ${targetLabel} formal webhook attempt authorized`;
}

export type PriorSendState = "none" | "sent" | "ambiguous";

export function assertGithubFormalContext(): void {
  const token = readEnv("GITHUB_TOKEN");
  const repository = readEnv("GITHUB_REPOSITORY");
  const currentRunId = Number(readEnv("GITHUB_RUN_ID") || "0");
  if (!token || !repository || !currentRunId) {
    throw new Error("SETUP_ERROR: formal seller brief sends must run in GitHub Actions");
  }
}

export async function priorSendStateInGithub(
  date: string,
  targetLabel = resolveTargetLabel(),
): Promise<PriorSendState> {
  assertGithubFormalContext();
  const token = readEnv("GITHUB_TOKEN")!;
  const repository = readEnv("GITHUB_REPOSITORY")!;
  const currentRunId = Number(readEnv("GITHUB_RUN_ID"));
  const runs = await githubJson<{ workflow_runs?: WorkflowRun[] }>(
    `/repos/${repository}/actions/workflows/${workflowFile}/runs?per_page=100`,
    token,
  );
  let ambiguous = false;
  for (const run of runs.workflow_runs || []) {
    if (
      run.id === currentRunId
      || run.status !== "completed"
      || dateInShanghai(new Date(run.created_at)) !== date
    ) continue;
    const jobs = await githubJson<{ jobs?: WorkflowJob[] }>(`/repos/${repository}/actions/runs/${run.id}/jobs?per_page=20`, token);
    for (const job of jobs.jobs || []) {
      const logs = await githubText(`/repos/${repository}/actions/jobs/${job.id}/logs`, token);
      if (logs.includes(successMarker(date, targetLabel))) return "sent";
      if (logs.includes(formalAttemptMarker(date, targetLabel))) ambiguous = true;
    }
  }
  return ambiguous ? "ambiguous" : "none";
}

async function setGithubOutput(name: string, value: string): Promise<void> {
  const outputFile = readEnv("GITHUB_OUTPUT");
  if (!outputFile) throw new Error("SETUP_ERROR: GITHUB_OUTPUT is required for seller brief preflight");
  await appendFile(outputFile, `${name}=${value}\n`, "utf8");
}

export function dateInShanghai(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const valueOf = (type: Intl.DateTimeFormatPartTypes): string => parts.find((part) => part.type === type)?.value || "";
  return `${valueOf("year")}-${valueOf("month")}-${valueOf("day")}`;
}

export function assertFormalSendDate(date: string, now = new Date()): void {
  const today = dateInShanghai(now);
  if (date !== today) throw new Error(`Seller brief blocked: formal send date must be today (${today}), got ${date}`);
}

export async function postMarkdown(
  webhookUrl: string,
  secret: string | undefined,
  title: string,
  markdown: string,
): Promise<void> {
  const markdownBytes = Buffer.byteLength(markdown, "utf8");
  if (markdownBytes > maxMarkdownBytes) {
    throw new Error(`Seller brief blocked: markdown payload is ${markdownBytes} bytes (limit ${maxMarkdownBytes})`);
  }
  const response = await fetch(signDingTalkUrl(webhookUrl, secret), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ msgtype: "markdown", markdown: { title, text: markdown } }),
    signal: AbortSignal.timeout(networkTimeoutMs),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`DingTalk webhook failed with HTTP ${response.status}`);
  let body: DingTalkResponse;
  try {
    body = JSON.parse(text) as DingTalkResponse;
  } catch {
    throw new Error("DingTalk webhook returned an invalid acknowledgement");
  }
  if (body.errcode !== 0) {
    const code = typeof body.errcode === "number" ? body.errcode : "missing";
    throw new Error(`DingTalk webhook rejected message: errcode ${code}`);
  }
}

export async function sendSellerProblemBrief(): Promise<void> {
  const input = await readInput();
  const { brief, report } = validateSellerProblemBrief(input);
  if (!brief || !report.content_valid) {
    throw new Error(`Seller brief blocked: ${report.automated_blockers.join(", ")}`);
  }
  const expectedDate = readEnv("BRIEF_DATE") || brief.date;
  if (brief.date !== expectedDate) throw new Error(`Seller brief date mismatch: expected ${expectedDate}, got ${brief.date}`);
  const approved = parseBoolean(readEnv("SELLER_BRIEF_SEND_APPROVED"));
  if (!approved) {
    console.log(`[seller-brief:send] date=${brief.date} dry run validated; message not sent`);
    return;
  }
  assertFormalSendDate(expectedDate);
  const targetLabel = resolveTargetLabel();
  const targetEnabled = readEnv("SELLER_BRIEF_TARGET_ENABLED")
    ?? readEnv("DINGTALK_YQN_LIVE_GROUP_ENABLED");
  if (parseBoolean(targetEnabled) !== true) {
    throw new Error(`SETUP_ERROR: seller brief target ${targetLabel} must be enabled`);
  }
  assertGithubFormalContext();
  const phase = readEnv("SELLER_BRIEF_SEND_PHASE") || "send";
  if (phase !== "preflight" && phase !== "send") throw new Error(`SETUP_ERROR: unsupported send phase ${phase}`);
  const webhookUrl = readEnv("SELLER_BRIEF_TARGET_WEBHOOK_URL")
    ?? readEnv("DINGTALK_YQN_LIVE_GROUP_WEBHOOK_URL");
  const webhookSecret = readEnv("SELLER_BRIEF_TARGET_SECRET")
    ?? readEnv("DINGTALK_YQN_LIVE_GROUP_SECRET");
  if (!webhookUrl) throw new Error(`SETUP_ERROR: seller brief target ${targetLabel} webhook is missing`);
  const markdown = renderSellerProblemMarkdown(brief, { publication: "production" });
  const productionTitle = brief.title.replace(/^【待验收】\s*/, "");

  if (phase === "preflight") {
    const priorState = await priorSendStateInGithub(brief.date, targetLabel);
    if (priorState === "sent") {
      await setGithubOutput("send_required", "false");
      console.log(`[seller-brief:send] date=${brief.date} ${targetLabel} duplicate send skipped`);
      return;
    }
    if (priorState === "ambiguous") {
      throw new Error("Seller brief blocked: a prior formal webhook attempt has no confirmed result; verify DingTalk before retrying");
    }
    if (Buffer.byteLength(markdown, "utf8") > maxMarkdownBytes) {
      throw new Error(`Seller brief blocked: markdown payload exceeds ${maxMarkdownBytes} bytes`);
    }
    await setGithubOutput("send_required", "true");
    console.log(`[seller-brief:preflight] date=${brief.date} ${targetLabel} formal send preflight passed`);
    return;
  }

  if (!parseBoolean(readEnv("SELLER_BRIEF_ATTEMPT_MARKED"))) {
    throw new Error("SETUP_ERROR: durable formal-send attempt marker is missing");
  }
  await postMarkdown(webhookUrl, webhookSecret, productionTitle, markdown);
  console.log(successMarker(brief.date, targetLabel));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  sendSellerProblemBrief().catch((error) => {
    console.error(error instanceof Error ? error.message : "Seller brief send failed");
    process.exit(1);
  });
}
