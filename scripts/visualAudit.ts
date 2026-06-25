import path from "node:path";
import os from "node:os";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { buildSite } from "../src/buildSite.js";
import { applyPublicRepoVariablesForLocalBuild, desktop, launchBrowser, mobile, repoRoot, screenshotFullPage, serve, visualAuditRoot } from "./visualCommon.js";

const auditDir = path.join(visualAuditRoot, "full-page");
const passphrase = "local-visual-audit-passphrase";

async function main(): Promise<void> {
  applyPublicRepoVariablesForLocalBuild();
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
    await screenshotFullPage(browser, publicServer.baseUrl, "/setup/", path.join(auditDir, "desktop-setup.png"), desktop);
    await screenshotFullPage(browser, publicServer.baseUrl, "/about/", path.join(auditDir, "desktop-about.png"), desktop);
    await screenshotFullPage(browser, publicServer.baseUrl, "/reports/2026-07-01/", path.join(auditDir, "desktop-report.png"), desktop);
    await screenshotFullPage(browser, publicServer.baseUrl, "/archive/", path.join(auditDir, "desktop-archive.png"), desktop);
    await screenshotFullPage(browser, publicServer.baseUrl, "/archive/2026/07/", path.join(auditDir, "desktop-month.png"), desktop);
    await screenshotFullPage(browser, publicServer.baseUrl, "/archive/2026/week-27/", path.join(auditDir, "desktop-week.png"), desktop);
    await screenshotFullPage(browser, publicServer.baseUrl, "/boss/", path.join(auditDir, "desktop-legacy-boss.png"), desktop);
    await screenshotFullPage(browser, publicServer.baseUrl, "/executive/", path.join(auditDir, "desktop-legacy-executive.png"), desktop);
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
    await screenshotFullPage(browser, publicServer.baseUrl, "/", path.join(auditDir, "mobile-home.png"), mobile);
    await screenshotFullPage(browser, publicServer.baseUrl, "/setup/", path.join(auditDir, "mobile-setup.png"), mobile);
    await screenshotFullPage(browser, publicServer.baseUrl, "/about/", path.join(auditDir, "mobile-about.png"), mobile);
    await screenshotFullPage(browser, publicServer.baseUrl, "/reports/2026-07-01/", path.join(auditDir, "mobile-report.png"), mobile);
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
      await page.waitForSelector("#briefRoot .brief-card");
    });
  } finally {
    await encryptedServer.close();
    await browser.close();
    await rm(encryptedDist, { recursive: true, force: true });
  }

  await writeFile(path.join(auditDir, "manifest.json"), JSON.stringify({
    generated_at: new Date().toISOString(),
    mode: "daily-brief-local-build",
    viewport: { desktop, mobile },
    files: [
      "desktop-home.png",
      "desktop-setup.png",
      "desktop-about.png",
      "desktop-report.png",
      "desktop-archive.png",
      "desktop-month.png",
      "desktop-week.png",
      "desktop-legacy-boss.png",
      "desktop-legacy-executive.png",
      "desktop-search-results.png",
      "desktop-search-empty.png",
      "desktop-topic-filter.png",
      "desktop-encrypted-locked.png",
      "desktop-encrypted-unlocked.png",
      "mobile-home.png",
      "mobile-setup.png",
      "mobile-about.png",
      "mobile-report.png"
    ],
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "visual audit failed");
  process.exit(1);
});
