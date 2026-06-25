import path from "node:path";
import os from "node:os";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { buildSite } from "../src/buildSite.js";
import { desktop, launchBrowser, mobile, repoRoot, screenshotFullPage, serve, tablet } from "./visualCommon.js";

const auditDir = path.join(repoRoot, "docs", "visual-audit", "full-page");
const passphrase = "local-visual-audit-passphrase";

async function main(): Promise<void> {
  await rm(auditDir, { recursive: true, force: true });
  await mkdir(auditDir, { recursive: true });

  await buildSite({
    repoRoot,
    dataDir: "data/briefs",
    distDir: "dist",
    encryptionEnabled: false,
    siteUrl: "http://127.0.0.1",
  });

  const publicServer = await serve(path.join(repoRoot, "dist"));
  const browser = await launchBrowser();
  try {
    await screenshotFullPage(browser, publicServer.baseUrl, "/", path.join(auditDir, "desktop-home.png"), desktop);
    await screenshotFullPage(browser, publicServer.baseUrl, "/executive/", path.join(auditDir, "desktop-executive.png"), desktop);
    await screenshotFullPage(browser, publicServer.baseUrl, "/#mql-quality", path.join(auditDir, "desktop-mql-quality.png"), desktop);
    await screenshotFullPage(browser, publicServer.baseUrl, "/#org-gap", path.join(auditDir, "desktop-org-gap.png"), desktop);
    await screenshotFullPage(browser, publicServer.baseUrl, "/#content-experiment", path.join(auditDir, "desktop-content-experiment.png"), desktop);
    await screenshotFullPage(browser, publicServer.baseUrl, "/#personal-daily", path.join(auditDir, "desktop-personal-daily.png"), desktop);
    await screenshotFullPage(browser, publicServer.baseUrl, "/reports/2026-07-01/", path.join(auditDir, "desktop-report-2026-07-01.png"), desktop);
    await screenshotFullPage(browser, publicServer.baseUrl, "/archive/", path.join(auditDir, "desktop-archive.png"), desktop);
    await screenshotFullPage(browser, publicServer.baseUrl, "/archive/2026/07/", path.join(auditDir, "desktop-month-2026-07.png"), desktop);
    await screenshotFullPage(browser, publicServer.baseUrl, "/archive/2026/week-27/", path.join(auditDir, "desktop-week-2026-W27.png"), desktop);
    await screenshotFullPage(browser, publicServer.baseUrl, "/", path.join(auditDir, "desktop-search-results.png"), desktop, async (page) => {
      await page.fill("#searchInput", "美国仓");
      await page.waitForSelector(".result-row");
    });
    await screenshotFullPage(browser, publicServer.baseUrl, "/", path.join(auditDir, "desktop-search-empty.png"), desktop, async (page) => {
      await page.fill("#searchInput", "不存在的验收关键词999");
      await page.waitForSelector(".empty");
    });
    await screenshotFullPage(browser, publicServer.baseUrl, "/", path.join(auditDir, "desktop-topic-filter.png"), desktop, async (page) => {
      await page.selectOption("#topicFilter", "ecommerce_us_warehouse");
      await page.waitForSelector(".result-row");
    });
    await screenshotFullPage(browser, publicServer.baseUrl, "/", path.join(auditDir, "tablet-home.png"), tablet);
    await screenshotFullPage(browser, publicServer.baseUrl, "/executive/", path.join(auditDir, "tablet-executive.png"), tablet);
    await screenshotFullPage(browser, publicServer.baseUrl, "/", path.join(auditDir, "mobile-home.png"), mobile);
    await screenshotFullPage(browser, publicServer.baseUrl, "/reports/2026-07-01/", path.join(auditDir, "mobile-report-2026-07-01.png"), mobile);
  } finally {
    await publicServer.close();
  }

  const encryptedDist = await mkdtemp(path.join(os.tmpdir(), "yqn-portal-encrypted-"));
  await buildSite({
    repoRoot,
    dataDir: "data/briefs",
    distDir: encryptedDist,
    encryptionEnabled: true,
    passphrase,
    siteUrl: "http://127.0.0.1",
  });
  const encryptedServer = await serve(encryptedDist);
  try {
    await screenshotFullPage(browser, encryptedServer.baseUrl, "/reports/2026-07-01/", path.join(auditDir, "desktop-encrypted-locked.png"), desktop);
    await screenshotFullPage(browser, encryptedServer.baseUrl, "/reports/2026-07-01/", path.join(auditDir, "desktop-encrypted-unlocked.png"), desktop, async (page) => {
      await page.fill("#passphrase", passphrase);
      await page.click("#unlockBrief");
      await page.waitForSelector("#briefRoot .report-card");
    });
  } finally {
    await encryptedServer.close();
    await browser.close();
    await rm(encryptedDist, { recursive: true, force: true });
  }

  await writeFile(path.join(auditDir, "manifest.json"), JSON.stringify({
    generated_at: new Date().toISOString(),
    mode: "local-build",
    viewport: { desktop, tablet, mobile },
    files: [
      "desktop-home.png",
      "desktop-executive.png",
      "desktop-mql-quality.png",
      "desktop-org-gap.png",
      "desktop-content-experiment.png",
      "desktop-personal-daily.png",
      "desktop-report-2026-07-01.png",
      "desktop-archive.png",
      "desktop-month-2026-07.png",
      "desktop-week-2026-W27.png",
      "desktop-search-results.png",
      "desktop-search-empty.png",
      "desktop-topic-filter.png",
      "desktop-encrypted-locked.png",
      "desktop-encrypted-unlocked.png",
      "tablet-home.png",
      "tablet-executive.png",
      "mobile-home.png",
      "mobile-report-2026-07-01.png"
    ],
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "visual audit failed");
  process.exit(1);
});
