import path from "node:path";
import { cp, mkdir, rename, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { readJsonFile, writeTextFile } from "../utils/fs.js";
import { dataPath, distDingtalkDir, readDingtalkRuntimeConfig } from "./config.js";
import { renderDingtalkMarkdown, renderMarkdownHtml } from "./renderMarkdown.js";
import { validateDingtalkBrief } from "./schema.js";

const packageRootName = "YQN_DingTalk_Morning_Brief_V1_Delivery";
const systemChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

function packageRoot(repoRoot: string): string {
  return path.join(repoRoot, "delivery", packageRootName);
}

async function screenshotPreviews(repoRoot: string, date: string, previewHtmlPath: string): Promise<void> {
  const previewDir = path.join(packageRoot(repoRoot), "preview");
  let browser;
  try {
    browser = await chromium.launch(existsSync(systemChrome) ? { executablePath: systemChrome } : {});
    const desktop = await browser.newPage({ viewport: { width: 1200, height: 1100 } });
    await desktop.goto(pathToFileURL(previewHtmlPath).href, { waitUntil: "load" });
    await desktop.locator('[data-shot="desktop-message"]').screenshot({
      path: path.join(previewDir, "dingtalk-message-desktop.png"),
    });
    await desktop.close();

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await mobile.goto(pathToFileURL(previewHtmlPath).href, { waitUntil: "load" });
    await mobile.locator('[data-shot="mobile-message"]').screenshot({
      path: path.join(previewDir, "dingtalk-message-mobile.png"),
    });
    await mobile.close();

    const archivePath = path.join(repoRoot, "dist", "dingtalk", `${date}.html`);
    const archive = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
    await archive.goto(pathToFileURL(archivePath).href, { waitUntil: "load" });
    await archive.locator('[data-shot="archive-page"]').screenshot({
      path: path.join(previewDir, "dingtalk-archive-page.png"),
    });
    await archive.close();
  } catch (error) {
    await writeTextFile(
      path.join(previewDir, "screenshot-failure.md"),
      `# 截图生成失败\n\n原因：${error instanceof Error ? error.message : "未知错误"}\n`,
    );
  } finally {
    if (browser) await browser.close();
  }
}

async function recordPreview(repoRoot: string, previewHtmlPath: string): Promise<void> {
  const previewDir = path.join(packageRoot(repoRoot), "preview");
  let browser;
  try {
    const videoDir = path.join(previewDir, "_video-temp");
    await rm(videoDir, { recursive: true, force: true });
    await mkdir(videoDir, { recursive: true });
    browser = await chromium.launch(existsSync(systemChrome) ? { executablePath: systemChrome } : {});
    const context = await browser.newContext({
      viewport: { width: 1200, height: 900 },
      recordVideo: { dir: videoDir, size: { width: 1200, height: 900 } },
    });
    const page = await context.newPage();
    await page.goto(pathToFileURL(previewHtmlPath).href, { waitUntil: "load" });
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(800);
    await page.mouse.wheel(0, -450);
    await page.waitForTimeout(800);
    const video = page.video();
    await context.close();
    if (!video) throw new Error("Playwright did not return a video handle");
    await rename(await video.path(), path.join(previewDir, "dingtalk-operation-recording.webm"));
    await rm(videoDir, { recursive: true, force: true });
  } catch (error) {
    await writeTextFile(
      path.join(previewDir, "recording-failure.md"),
      `# 录屏生成失败\n\n原因：${error instanceof Error ? error.message : "当前环境不支持 Playwright 录屏"}\n`,
    );
  } finally {
    if (browser) await browser.close();
  }
}

export async function buildDingtalkPreview(): Promise<void> {
  const config = readDingtalkRuntimeConfig();
  const brief = validateDingtalkBrief(await readJsonFile(dataPath(config)));
  const root = packageRoot(config.repoRoot);
  const previewDir = path.join(root, "preview");
  await rm(previewDir, { recursive: true, force: true });
  await mkdir(previewDir, { recursive: true });
  const markdown = renderDingtalkMarkdown(brief, config.siteUrl);
  const previewMd = path.join(previewDir, "dingtalk-markdown-preview.md");
  const previewHtml = path.join(previewDir, "dingtalk-markdown-preview.html");
  await writeTextFile(previewMd, markdown);
  await writeTextFile(previewHtml, renderMarkdownHtml(markdown));

  const distSource = distDingtalkDir(config);
  const distTarget = path.join(root, "dist", "dingtalk");
  if (existsSync(distSource)) {
    await rm(distTarget, { recursive: true, force: true });
    await cp(distSource, distTarget, { recursive: true });
  }

  await screenshotPreviews(config.repoRoot, config.date, previewHtml);
  await recordPreview(config.repoRoot, previewHtml);
  await writeFile(path.join(previewDir, "README.md"), "打开 dingtalk-markdown-preview.html 可查看钉钉消息预览。\n", "utf8");
  console.log("[dingtalk:preview] wrote preview screenshots and HTML");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  buildDingtalkPreview().catch((error) => {
    console.error(error instanceof Error ? error.message : "DingTalk preview build failed");
    process.exit(1);
  });
}
