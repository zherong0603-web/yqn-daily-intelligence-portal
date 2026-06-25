import { createHmac } from "node:crypto";
import { pathToFileURL } from "node:url";
import { readRuntimeConfig } from "./config.js";
import { readEnv } from "./utils/env.js";

type NotifyMode = "success" | "failure";

export function signedFields(secret?: string): { timestamp?: string; sign?: string } {
  if (!secret) return {};
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const stringToSign = `${timestamp}\n${secret}`;
  const sign = createHmac("sha256", stringToSign).update("").digest("base64");
  return { timestamp, sign };
}

function runUrl(): string {
  const server = readEnv("GITHUB_SERVER_URL") || "https://github.com";
  const repo = readEnv("GITHUB_REPOSITORY") || "zherong0603-web/yqn-daily-intelligence-portal";
  const runId = readEnv("GITHUB_RUN_ID") || "";
  return runId ? `${server}/${repo}/actions/runs/${runId}` : `${server}/${repo}/actions`;
}

export function feishuCard(mode: NotifyMode) {
  const config = readRuntimeConfig();
  const site = config.siteUrl || "GitHub Pages";
  const title = mode === "success" ? `YQN 每日重点简报 · ${config.date}` : `每日简报生成失败 · ${config.date}`;
  const headerColor = mode === "success" ? "green" : "red";
  const failureStage = readEnv("FAILURE_STAGE") || "测试、生成、构建或部署阶段";
  const previews = (readEnv("BRIEF_PREVIEW") || "网页已更新，可从入口查看。").split("\n").slice(0, 3);

  const elements = mode === "success"
    ? [
        { tag: "div", text: { tag: "lark_md", content: `**今日一句话判断**\n${readEnv("BRIEF_ONE_LINER") || "请打开网页查看今日判断。"}` } },
        { tag: "hr" },
        { tag: "div", text: { tag: "lark_md", content: previews.map((item, index) => `${index + 1}. ${item}`).join("\n") } },
        {
          tag: "action",
          actions: [
            { tag: "button", text: { tag: "plain_text", content: "查看今日简报" }, type: "primary", url: `${site}/reports/${config.date}/` },
            { tag: "button", text: { tag: "plain_text", content: "查看历史简报" }, url: `${site}/archive/` },
          ],
        },
      ]
    : [
        { tag: "div", text: { tag: "lark_md", content: `**失败阶段**\n${failureStage}` } },
        { tag: "div", text: { tag: "lark_md", content: "**下一步建议**\n打开 GitHub Actions run，先看失败步骤，再检查 OPENAI_API_KEY、来源连通性、schema 校验或 Pages 部署权限。" } },
        {
          tag: "action",
          actions: [
            { tag: "button", text: { tag: "plain_text", content: "查看 Actions Run" }, type: "danger", url: runUrl() },
          ],
        },
      ];

  return {
    msg_type: "interactive",
    card: {
      config: { wide_screen_mode: true },
      header: {
        template: headerColor,
        title: { tag: "plain_text", content: title },
      },
      elements,
    },
  };
}

export async function sendFeishu(mode: NotifyMode): Promise<void> {
  const webhook = readEnv("FEISHU_WEBHOOK_URL");
  if (!webhook) {
    console.warn("[feishu] FEISHU_WEBHOOK_URL is not configured; notification skipped");
    return;
  }

  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...signedFields(readEnv("FEISHU_SIGN_SECRET")), ...feishuCard(mode) }),
    });
    if (!response.ok) {
      console.warn(`[feishu] notification failed with HTTP ${response.status}`);
      return;
    }
    console.log(`[feishu] ${mode} notification sent`);
  } catch (error) {
    console.warn(`[feishu] notification warning: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mode = process.argv[2] === "failure" ? "failure" : "success";
  sendFeishu(mode).catch((error) => {
    console.warn(`[feishu] notification warning: ${error instanceof Error ? error.message : "unknown error"}`);
  });
}
