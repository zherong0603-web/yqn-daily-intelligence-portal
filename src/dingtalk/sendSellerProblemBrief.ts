import { appendFile, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { readEnv } from "../utils/env.js";
import {
  CrossborderV2Brief,
  renderCrossborderV2Markdown,
  renderSellerProblemMarkdown,
  validateCrossborderV2Brief,
  validateSellerProblemBrief,
  verifyCrossborderV2Sources,
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
  status?: string;
  conclusion?: string | null;
}

interface DingTalkAccessTokenResponse {
  accessToken?: string;
  errorCode?: string;
  errorMessage?: string;
}

interface DingTalkBatchSendResponse {
  processQueryKey?: string;
  invalidStaffIdList?: string[];
  flowControlledStaffIdList?: string[];
  code?: string;
  message?: string;
}

interface DingTalkReadStatusResponse {
  sendStatus?: string;
  messageReadInfoList?: Array<{
    name?: string;
    userId?: string;
    readStatus?: string;
    readTimestamp?: number;
  }>;
  code?: string;
  message?: string;
}

const workflowFile = "dingtalk-seller-problem-send.yml";
const defaultTargetLabel = "yqn-livestream-group";
const targetLabelPattern = /^[a-z0-9][a-z0-9-]{0,62}$/;
const maxMarkdownBytes = 18_000;
const maxPersonalMarkdownChars = 5_000;
const networkTimeoutMs = 20_000;
const crossborderV2WorkflowFile = "dingtalk-crossborder-v2-send.yml";
const crossborderV2TargetLabel = "dingtalk-private";

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

export function crossborderV2SuccessMarker(date: string, sendStatus: string, readStatus: string, targetLabel = crossborderV2TargetLabel): string {
  return `${crossborderV2SuccessPrefix(date, targetLabel)} sendStatus=${sendStatus} readStatus=${readStatus}`;
}

export function crossborderV2SuccessPrefix(date: string, targetLabel = crossborderV2TargetLabel): string {
  return `[crossborder-v2:send] date=${date} ${targetLabel} personal delivery confirmed`;
}

export function crossborderV2AttemptMarker(date: string, targetLabel = crossborderV2TargetLabel): string {
  return `[crossborder-v2:attempt] date=${date} ${targetLabel} DingTalk personal-chat send authorized`;
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
  workflowFileForCheck = workflowFile,
  successMarkerForCheck = successMarker,
  attemptMarkerForCheck = formalAttemptMarker,
): Promise<PriorSendState> {
  assertGithubFormalContext();
  const token = readEnv("GITHUB_TOKEN")!;
  const repository = readEnv("GITHUB_REPOSITORY")!;
  const currentRunId = Number(readEnv("GITHUB_RUN_ID"));
  const runs = await githubJson<{ workflow_runs?: WorkflowRun[] }>(
    `/repos/${repository}/actions/workflows/${workflowFileForCheck}/runs?per_page=100`,
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
      if (job.status && job.status !== "completed") continue;
      if (job.conclusion === "skipped") continue;
      let logs: string;
      try {
        logs = await githubText(`/repos/${repository}/actions/jobs/${job.id}/logs`, token);
      } catch (error) {
        if (error instanceof Error && error.message.includes("HTTP 404")) continue;
        throw error;
      }
      if (logs.includes(successMarkerForCheck(date, targetLabel))) return "sent";
      if (logs.includes(attemptMarkerForCheck(date, targetLabel))) ambiguous = true;
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

async function readJson<T>(response: Response, label: string): Promise<T> {
  const text = await response.text();
  if (!response.ok) throw new Error(`${label} failed with HTTP ${response.status}`);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${label} returned invalid JSON`);
  }
}

export async function getDingTalkAccessToken(appKey: string, appSecret: string): Promise<string> {
  if (!appKey || !appSecret) throw new Error("SETUP_ERROR: DingTalk appKey/appSecret are required");
  const body = await readJson<DingTalkAccessTokenResponse>(await fetch(
    "https://api.dingtalk.com/v1.0/oauth2/accessToken",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appKey, appSecret }),
      signal: AbortSignal.timeout(networkTimeoutMs),
    },
  ), "DingTalk access token request");
  if (!body.accessToken) {
    throw new Error(`DingTalk access token rejected: ${body.errorCode || body.errorMessage || "missing token"}`);
  }
  return body.accessToken;
}

export async function sendDingTalkPersonalMarkdown(options: {
  accessToken: string;
  robotCode: string;
  userId: string;
  title: string;
  markdown: string;
}): Promise<string> {
  if (!options.robotCode || !options.userId) throw new Error("SETUP_ERROR: DingTalk robotCode/userId are required");
  if (options.markdown.length > maxPersonalMarkdownChars) {
    throw new Error(`Crossborder V2 blocked: private markdown is ${options.markdown.length} chars (limit ${maxPersonalMarkdownChars})`);
  }
  const body = await readJson<DingTalkBatchSendResponse>(await fetch(
    "https://api.dingtalk.com/v1.0/robot/oToMessages/batchSend",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-acs-dingtalk-access-token": options.accessToken,
      },
      body: JSON.stringify({
        robotCode: options.robotCode,
        userIds: [options.userId],
        msgKey: "sampleMarkdown",
        msgParam: JSON.stringify({ title: options.title, text: options.markdown }),
      }),
      signal: AbortSignal.timeout(networkTimeoutMs),
    },
  ), "DingTalk private message send");
  if (!body.processQueryKey) {
    throw new Error(`DingTalk private message rejected: ${body.code || body.message || "missing processQueryKey"}`);
  }
  if (body.invalidStaffIdList?.includes(options.userId) || body.flowControlledStaffIdList?.includes(options.userId)) {
    throw new Error("DingTalk private message rejected or throttled for the configured user");
  }
  return body.processQueryKey;
}

export async function queryDingTalkPersonalDelivery(options: {
  accessToken: string;
  robotCode: string;
  processQueryKey: string;
  userId: string;
}): Promise<{ sendStatus: string; readStatus: string; recipientConfirmed: boolean }> {
  const query = new URLSearchParams({
    robotCode: options.robotCode,
    processQueryKey: options.processQueryKey,
  });
  const body = await readJson<DingTalkReadStatusResponse>(await fetch(
    `https://api.dingtalk.com/v1.0/robot/oToMessages/readStatus?${query.toString()}`,
    {
      method: "GET",
      headers: { "x-acs-dingtalk-access-token": options.accessToken },
      signal: AbortSignal.timeout(networkTimeoutMs),
    },
  ), "DingTalk private delivery status query");
  if (body.code && String(body.code).trim() !== "0") {
    throw new Error(`DingTalk delivery status rejected: ${body.code}${body.message ? ` ${body.message}` : ""}`);
  }
  const recipient = body.messageReadInfoList?.find((item) => item.userId === options.userId);
  return {
    sendStatus: String(body.sendStatus || "UNKNOWN").toUpperCase(),
    readStatus: String(recipient?.readStatus || "UNKNOWN").toUpperCase(),
    recipientConfirmed: Boolean(recipient?.userId === options.userId),
  };
}

export async function verifyDingTalkPersonalDelivery(options: {
  accessToken: string;
  robotCode: string;
  processQueryKey: string;
  userId: string;
  attempts?: number;
  delayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}): Promise<{ sendStatus: string; readStatus: string }> {
  const attempts = options.attempts ?? 12;
  const delayMs = options.delayMs ?? 5_000;
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  let last = { sendStatus: "UNKNOWN", readStatus: "UNKNOWN", recipientConfirmed: false };
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    last = await queryDingTalkPersonalDelivery(options);
    const sendFailed = ["FAILED", "FAIL", "REJECTED", "INVALID", "BLOCKED"].includes(last.sendStatus);
    if (sendFailed) {
      throw new Error(`Crossborder V2 delivery failed (sendStatus=${last.sendStatus}, readStatus=${last.readStatus})`);
    }
    const recipientDelivered = last.recipientConfirmed
      && ["READ", "UNREAD", "SUCCESS", "DELIVERED"].includes(last.readStatus);
    if (recipientDelivered) {
      return { sendStatus: last.sendStatus, readStatus: last.readStatus };
    }
    if (attempt < attempts - 1) await sleep(delayMs);
  }
  throw new Error(`Crossborder V2 delivery unconfirmed after ${attempts} status checks (sendStatus=${last.sendStatus}, readStatus=${last.readStatus})`);
}

async function sendCrossborderV2Brief(input: unknown): Promise<void> {
  const { brief, report } = validateCrossborderV2Brief(input);
  if (!brief || !report.content_valid) throw new Error(`Crossborder V2 blocked: ${report.automated_blockers.join(", ")}`);
  const expectedDate = readEnv("BRIEF_DATE") || brief.date;
  if (brief.date !== expectedDate) throw new Error(`Crossborder V2 date mismatch: expected ${expectedDate}, got ${brief.date}`);
  const approved = parseBoolean(readEnv("CROSSBORDER_V2_SEND_APPROVED"));
  if (!approved) {
    console.log(`[crossborder-v2:send] date=${brief.date} dry run validated; personal message not sent`);
    return;
  }
  assertFormalSendDate(expectedDate);
  assertGithubFormalContext();

  const targetEnabled = readEnv("CROSSBORDER_V2_TARGET_ENABLED");
  if (!parseBoolean(targetEnabled)) throw new Error("SETUP_ERROR: CROSSBORDER_V2_TARGET_ENABLED must be true");
  const phase = readEnv("CROSSBORDER_V2_SEND_PHASE") || "send";
  if (phase !== "preflight" && phase !== "send") throw new Error(`SETUP_ERROR: unsupported send phase ${phase}`);
  const appKey = readEnv("DINGTALK_APP_KEY");
  const appSecret = readEnv("DINGTALK_APP_SECRET");
  const robotCode = readEnv("DINGTALK_ROBOT_CODE");
  const userId = readEnv("DINGTALK_USER_ID");
  if (!appKey || !appSecret || !robotCode || !userId) {
    throw new Error("SETUP_ERROR: DINGTALK_APP_KEY, DINGTALK_APP_SECRET, DINGTALK_ROBOT_CODE and DINGTALK_USER_ID are required for private chat");
  }
  const markdown = renderCrossborderV2Markdown(brief);
  const title = `跨境早知道 V2｜${brief.date}`;
  const sourceChecks = await verifyCrossborderV2Sources(brief);
  const failedSourceChecks = sourceChecks.filter((check) => !check.ok);
  if (failedSourceChecks.length > 0) {
    if (readEnv("CROSSBORDER_V2_SOURCE_CHECK_STRICT") === "true") {
      throw new Error(`Crossborder V2 blocked: ${failedSourceChecks.length} source checks failed`);
    }
    console.warn(`[crossborder-v2:source-check] auto-verified=${sourceChecks.length - failedSourceChecks.length}/${sourceChecks.length}; manual verification remains required for ${failedSourceChecks.map((check) => check.url).join(", ")}`);
  } else {
    console.log(`[crossborder-v2:source-check] auto-verified=${sourceChecks.length}/${sourceChecks.length}`);
  }

  if (phase === "preflight") {
    const priorState = await priorSendStateInGithub(
      brief.date,
      crossborderV2TargetLabel,
      crossborderV2WorkflowFile,
      crossborderV2SuccessPrefix,
      crossborderV2AttemptMarker,
    );
    if (priorState === "sent") {
      await setGithubOutput("send_required", "false");
      console.log(`[crossborder-v2:preflight] date=${brief.date} duplicate delivery skipped`);
      return;
    }
    if (priorState === "ambiguous") {
      throw new Error("Crossborder V2 blocked: a prior private-chat attempt has no confirmed delivery; verify DingTalk before retrying");
    }
    await setGithubOutput("send_required", "true");
    console.log(`[crossborder-v2:preflight] date=${brief.date} private-chat preflight passed; chars=${markdown.length}`);
    return;
  }

  if (!parseBoolean(readEnv("CROSSBORDER_V2_ATTEMPT_MARKED"))) {
    throw new Error("SETUP_ERROR: durable private-chat attempt marker is missing");
  }
  const accessToken = await getDingTalkAccessToken(appKey, appSecret);
  const processQueryKey = await sendDingTalkPersonalMarkdown({ accessToken, robotCode, userId, title, markdown });
  const delivery = await verifyDingTalkPersonalDelivery({ accessToken, robotCode, userId, processQueryKey });
  console.log(crossborderV2SuccessMarker(brief.date, delivery.sendStatus, delivery.readStatus));
}

export async function sendSellerProblemBrief(): Promise<void> {
  const input = await readInput();
  if (typeof input === "object" && input !== null && (input as { format_version?: unknown }).format_version === "v2") {
    await sendCrossborderV2Brief(input);
    return;
  }
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
