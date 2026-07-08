import { pathToFileURL } from "node:url";
import { readJsonFile } from "../utils/fs.js";
import { dataPath, readDingtalkRuntimeConfig, DingtalkRuntimeConfig } from "./config.js";
import { renderDingtalkMarkdown } from "./renderMarkdown.js";
import { checkDingtalkBriefRisk, writeRiskReport } from "./riskCheck.js";
import { DingtalkBrief, validateDingtalkBrief } from "./schema.js";
import { signDingTalkUrl } from "./utils/signDingTalk.js";

interface DingTalkResponse {
  errcode?: number;
  errmsg?: string;
}

function markdownPayload(title: string, text: string) {
  return {
    msgtype: "markdown",
    markdown: { title, text },
  };
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
  if (!config.ownerWebhookUrl) return;
  const markdown = [
    `# YQN 钉钉晨报发送已阻断｜${brief.date}`,
    "",
    `**风险类型：** ${riskTypes.join(", ") || "unknown"}`,
    "",
    "系统已生成 risk_report.json。日志和提醒不包含原文敏感内容。",
  ].join("\n");
  try {
    await postMarkdown(config.ownerWebhookUrl, undefined, "YQN 钉钉晨报发送已阻断", markdown);
    console.warn("[dingtalk:send] owner risk warning sent");
  } catch {
    console.warn("[dingtalk:send] owner risk warning failed");
  }
}

export async function sendOwnerFailure(config = readDingtalkRuntimeConfig()): Promise<void> {
  if (!config.ownerWebhookUrl) {
    console.warn("[dingtalk:failure] DINGTALK_OWNER_WEBHOOK_URL is not configured; owner notification skipped");
    return;
  }
  const stage = process.env.FAILURE_STAGE || "unknown stage";
  const markdown = [
    `# YQN 钉钉晨报 workflow 失败｜${config.date}`,
    "",
    `**失败阶段：** ${stage}`,
    "",
    "请打开 GitHub Actions 查看失败步骤。此提醒不包含 webhook、secret、API key 或原文敏感内容。",
  ].join("\n");
  await postMarkdown(config.ownerWebhookUrl, undefined, "YQN 钉钉晨报 workflow 失败", markdown);
  console.warn("[dingtalk:failure] owner failure warning sent");
}

export async function sendDingtalkBrief(config = readDingtalkRuntimeConfig()): Promise<void> {
  const brief = validateDingtalkBrief(await readJsonFile(dataPath(config)));
  const risk = checkDingtalkBriefRisk(brief);
  await writeRiskReport(config, brief, risk);
  if (!risk.ok) {
    await notifyOwner(config, brief, risk.riskTypes);
    throw new Error(`DingTalk send blocked by risk check: ${risk.riskTypes.join(",") || "unknown risk"}`);
  }

  const markdown = renderDingtalkMarkdown(brief, config.siteUrl);
  if (config.dryRun) {
    console.log("[dingtalk:send] dry_run=true; DingTalk message was not sent");
    return;
  }
  if (!config.webhookUrl) {
    console.warn("[dingtalk:send] DINGTALK_WEBHOOK_URL is not configured; send skipped");
    return;
  }

  await postMarkdown(config.webhookUrl, config.secret, brief.title, markdown);
  console.log("[dingtalk:send] test-group markdown message sent");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const task = process.argv[2] === "failure" ? sendOwnerFailure() : sendDingtalkBrief();
  task.catch((error) => {
    console.error(error instanceof Error ? error.message : "DingTalk send failed");
    process.exit(1);
  });
}
