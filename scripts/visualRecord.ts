import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, rm, rename } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { type BrowserContext, type Page } from "playwright";
import { buildSite } from "../src/buildSite.js";
import { applyPublicRepoVariablesForLocalBuild, desktop, launchBrowser, repoRoot, serve, visualAuditRoot } from "./visualCommon.js";

const recordingsDir = path.join(visualAuditRoot, "recordings");

async function pause(ms = 1600): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function convertToMp4(input: string, output: string): boolean {
  const ffmpeg = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" });
  if (ffmpeg.status !== 0) return false;
  const result = spawnSync("ffmpeg", ["-y", "-i", input, "-c:v", "libx264", "-pix_fmt", "yuv420p", output], { stdio: "ignore" });
  return result.status === 0 && existsSync(output);
}

async function caption(page: Page, text: string, ms = 2400): Promise<void> {
  await page.evaluate((message) => {
    let node = document.querySelector(".record-caption") as HTMLElement | null;
    if (!node) {
      node = document.createElement("div");
      node.className = "record-caption";
      document.body.appendChild(node);
    }
    node.textContent = message;
  }, text);
  await pause(ms);
}

async function click(page: Page, selector: string, text: string): Promise<void> {
  await page.locator(selector).first().scrollIntoViewIfNeeded();
  await caption(page, text, 1100);
  await page.locator(selector).first().click();
  await pause(1850);
}

async function safeGoto(page: Page, url: string): Promise<void> {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 7000 });
  } catch {
    // External GitHub pages may be slow in local visual recording. The click itself remains visible.
  }
}

async function createRecordedPage(browserContext: BrowserContext): Promise<Page> {
  const page = await browserContext.newPage();
  await page.addInitScript(() => {
    window.print = () => {
      const event = new CustomEvent("portal-print-preview");
      window.dispatchEvent(event);
    };
  });
  return page;
}

async function recordOperatorFlow(browserContext: BrowserContext, baseUrl: string): Promise<void> {
  const webmPath = path.join(recordingsDir, "desktop-30s-operator-flow.webm");
  const mp4Path = path.join(recordingsDir, "desktop-30s-operator-flow.mp4");
  const page = await createRecordedPage(browserContext);
  try {
    await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
    await caption(page, "打开首页：YQN 每日重点简报");
    await page.locator('[data-section="daily-top-three"]').scrollIntoViewIfNeeded();
    await caption(page, "先看今日 3 个重点");
    await click(page, 'button:has-text("复制简报摘要")', "复制简报摘要");
    await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
    await caption(page, "回到首页搜索历史信号");
    await page.fill("#searchInput", "美国仓");
    await page.waitForSelector(".result-row");
    await caption(page, "搜索“美国仓”出现结果");
    await click(page, 'a[href="archive/"]', "打开历史归档");
    await page.waitForLoadState("networkidle");
    await click(page, 'a[href="reports/2026-08-01/"]', "打开一篇日报");
    await page.waitForLoadState("networkidle");
    await click(page, 'button:has-text("打印 / 保存 PDF")', "点击打印 / 保存 PDF");
    await caption(page, "操作流完成：可看、可搜、可归档、可打印", 3000);
  } finally {
    const video = page.video();
    await page.close();
    if (!video) throw new Error("Playwright did not create the operator video");
    await rename(await video.path(), webmPath);
    if (!convertToMp4(webmPath, mp4Path)) console.warn("[record] operator mp4 conversion skipped");
  }
}

async function recordSetupFlow(browserContext: BrowserContext, baseUrl: string): Promise<void> {
  const webmPath = path.join(recordingsDir, "desktop-30s-setup-flow.webm");
  const mp4Path = path.join(recordingsDir, "desktop-30s-setup-flow.mp4");
  const page = await createRecordedPage(browserContext);
  try {
    await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
    await caption(page, "首页：点击自动化配置");
    await click(page, 'a[href="setup/"]', "打开自动化配置");
    await page.waitForLoadState("networkidle");
    await caption(page, "查看配置状态：只显示已配置/缺失");
    await click(page, '[data-section="setup-openai-key"] button[data-copy-value="OPENAI_API_KEY"]', "复制 OPENAI_API_KEY 的 Name");
    await page.evaluate(() => document.querySelectorAll('a[href*="settings/secrets"]').forEach((node) => node.removeAttribute("target")));
    await click(page, '[data-section="setup-openai-key"] a[href*="settings/secrets"]', "点击 GitHub Secrets 入口");
    await safeGoto(page, `${baseUrl}/setup/`);
    await page.waitForLoadState("networkidle");
    await page.locator('[data-section="setup-openai-model"]').scrollIntoViewIfNeeded();
    await caption(page, "第二步：OPENAI_MODEL 必须按账号可用模型填写");
    await page.evaluate(() => document.querySelectorAll('a[href*="actions/workflows"]').forEach((node) => node.removeAttribute("target")));
    await click(page, '[data-section="setup-run-workflow"] a[href*="actions/workflows"]', "点击 Run workflow 测试入口");
    await caption(page, "不展示任何真实密钥，只演示入口和复制按钮", 4400);
  } finally {
    const video = page.video();
    await page.close();
    if (!video) throw new Error("Playwright did not create the setup video");
    await rename(await video.path(), webmPath);
    if (!convertToMp4(webmPath, mp4Path)) console.warn("[record] setup mp4 conversion skipped");
  }
}

async function main(): Promise<void> {
  applyPublicRepoVariablesForLocalBuild();
  await rm(recordingsDir, { recursive: true, force: true });
  await mkdir(recordingsDir, { recursive: true });
  await buildSite({
    repoRoot,
    dataDir: "data/briefs",
    distDir: "dist",
    encryptionEnabled: false,
    siteUrl: "http://127.0.0.1",
  });

  const server = await serve(path.join(repoRoot, "dist"));
  const browser = await launchBrowser();
  const context = await browser.newContext({
    viewport: desktop,
    permissions: ["clipboard-read", "clipboard-write"],
    recordVideo: { dir: recordingsDir, size: desktop },
  });

  try {
    await recordOperatorFlow(context, server.baseUrl);
    await recordSetupFlow(context, server.baseUrl);
  } finally {
    await context.close();
    await browser.close();
    await server.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "visual record failed");
  process.exit(1);
});
