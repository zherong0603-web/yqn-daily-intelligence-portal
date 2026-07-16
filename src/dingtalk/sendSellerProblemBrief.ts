import { mkdir, readFile, writeFile } from "node:fs/promises";
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

interface SendState {
  sent_dates: Record<string, { sent_at: string; target: string }>;
}

const workflowFile = "dingtalk-seller-problem-send.yml";
const targetLabel = "yqn-livestream-group";

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
  });
  if (!response.ok) throw new Error(`GitHub duplicate log check failed with HTTP ${response.status}`);
  return await response.text();
}

function successMarker(date: string): string {
  return `[seller-brief:send] date=${date} ${targetLabel} markdown message sent`;
}

async function alreadySentInGithub(date: string): Promise<boolean> {
  const token = readEnv("GITHUB_TOKEN");
  const repository = readEnv("GITHUB_REPOSITORY");
  const currentRunId = Number(readEnv("GITHUB_RUN_ID") || "0");
  if (!token || !repository || !currentRunId) return false;
  const runs = await githubJson<{ workflow_runs?: WorkflowRun[] }>(
    `/repos/${repository}/actions/workflows/${workflowFile}/runs?per_page=20`,
    token,
  );
  for (const run of runs.workflow_runs || []) {
    if (run.id === currentRunId || run.status !== "completed" || run.conclusion !== "success") continue;
    const jobs = await githubJson<{ jobs?: WorkflowJob[] }>(`/repos/${repository}/actions/runs/${run.id}/jobs?per_page=20`, token);
    for (const job of jobs.jobs || []) {
      const logs = await githubText(`/repos/${repository}/actions/jobs/${job.id}/logs`, token);
      if (logs.includes(successMarker(date))) return true;
    }
  }
  return false;
}

function localStatePath(): string {
  return path.resolve("data", "codex-shadow", ".seller-send-state.json");
}

async function readLocalState(): Promise<SendState> {
  try {
    return JSON.parse(await readFile(localStatePath(), "utf8")) as SendState;
  } catch {
    return { sent_dates: {} };
  }
}

async function alreadySentLocally(date: string): Promise<boolean> {
  if (readEnv("GITHUB_RUN_ID")) return false;
  return Boolean((await readLocalState()).sent_dates[date]);
}

async function recordLocalSend(date: string): Promise<void> {
  if (readEnv("GITHUB_RUN_ID")) return;
  const state = await readLocalState();
  state.sent_dates[date] = { sent_at: new Date().toISOString(), target: targetLabel };
  await mkdir(path.dirname(localStatePath()), { recursive: true });
  await writeFile(localStatePath(), `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
}

async function postMarkdown(webhookUrl: string, secret: string | undefined, title: string, markdown: string): Promise<void> {
  const response = await fetch(signDingTalkUrl(webhookUrl, secret), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ msgtype: "markdown", markdown: { title, text: markdown } }),
  });
  const text = await response.text();
  let body: DingTalkResponse = {};
  try {
    body = text ? JSON.parse(text) as DingTalkResponse : {};
  } catch {
    body = { errmsg: text.slice(0, 120) };
  }
  if (!response.ok) throw new Error(`DingTalk webhook failed with HTTP ${response.status}`);
  if (typeof body.errcode === "number" && body.errcode !== 0) {
    throw new Error(`DingTalk webhook rejected message: errcode ${body.errcode}`);
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
  if (parseBoolean(readEnv("DINGTALK_YQN_LIVE_GROUP_ENABLED")) !== true) {
    throw new Error("SETUP_ERROR: DINGTALK_YQN_LIVE_GROUP_ENABLED must be true");
  }
  if (await alreadySentInGithub(brief.date) || await alreadySentLocally(brief.date)) {
    console.log(`[seller-brief:send] date=${brief.date} ${targetLabel} duplicate send skipped`);
    return;
  }
  const webhookUrl = readEnv("DINGTALK_YQN_LIVE_GROUP_WEBHOOK_URL");
  if (!webhookUrl) throw new Error("SETUP_ERROR: livestream group webhook is missing");
  const markdown = renderSellerProblemMarkdown(brief, { publication: "production" });
  await postMarkdown(webhookUrl, readEnv("DINGTALK_YQN_LIVE_GROUP_SECRET"), brief.title, markdown);
  await recordLocalSend(brief.date);
  console.log(successMarker(brief.date));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  sendSellerProblemBrief().catch((error) => {
    console.error(error instanceof Error ? error.message : "Seller brief send failed");
    process.exit(1);
  });
}
