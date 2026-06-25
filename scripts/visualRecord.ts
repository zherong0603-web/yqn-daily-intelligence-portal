import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, rm, rename } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { buildSite } from "../src/buildSite.js";
import { desktop, launchBrowser, repoRoot, serve } from "./visualCommon.js";

const recordingsDir = path.join(repoRoot, "docs", "visual-audit", "recordings");
const webmPath = path.join(recordingsDir, "desktop-30s-operator-flow.webm");
const mp4Path = path.join(recordingsDir, "desktop-30s-operator-flow.mp4");

async function pause(ms = 2600): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function convertToMp4(input: string, output: string): boolean {
  const ffmpeg = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" });
  if (ffmpeg.status !== 0) return false;
  const result = spawnSync("ffmpeg", ["-y", "-i", input, "-c:v", "libx264", "-pix_fmt", "yuv420p", output], { stdio: "ignore" });
  return result.status === 0 && existsSync(output);
}

async function main(): Promise<void> {
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
  const page = await context.newPage();

  try {
    await page.goto(`${server.baseUrl}/`, { waitUntil: "networkidle" });
    await pause();
    await page.locator('[data-section="top-three"]').scrollIntoViewIfNeeded();
    await pause();
    await page.click('a[href="executive/"]');
    await page.waitForLoadState("networkidle");
    await pause();
    await page.getByRole("button", { name: "复制老板版摘要" }).first().click();
    await pause();
    await page.goto(`${server.baseUrl}/`, { waitUntil: "networkidle" });
    await pause();
    await page.fill("#searchInput", "美国仓");
    await page.waitForSelector(".result-row");
    await pause();
    await page.click('a[href="archive/"]');
    await page.waitForLoadState("networkidle");
    await pause();
    await page.click('a[href="archive/2026/07/"]');
    await page.waitForLoadState("networkidle");
    await pause();
    await page.click('a[href="reports/2026-07-01/"]');
    await page.waitForLoadState("networkidle");
    await pause();
    await page.getByRole("button", { name: "打印 / 保存 PDF" }).click();
    await pause(1800);
  } finally {
    const video = page.video();
    await context.close();
    await browser.close();
    await server.close();
    if (!video) throw new Error("Playwright did not create a video");
    const rawVideoPath = await video.path();
    await rename(rawVideoPath, webmPath);
  }

  if (!convertToMp4(webmPath, mp4Path)) {
    console.warn("[record] mp4 conversion skipped; webm recording is available");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "visual record failed");
  process.exit(1);
});
