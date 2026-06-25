import path from "node:path";
import os from "node:os";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { buildSite } from "../src/buildSite.js";
import { applyPublicRepoVariablesForLocalBuild, desktop, launchBrowser, mobile, repoRoot, screenshotLocator, serve } from "./visualCommon.js";

const sectionDir = path.join(repoRoot, "docs", "visual-audit", "sections");
const passphrase = "local-section-audit-passphrase";

async function main(): Promise<void> {
  applyPublicRepoVariablesForLocalBuild();
  await rm(sectionDir, { recursive: true, force: true });
  await mkdir(sectionDir, { recursive: true });

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
    const sections: Array<[string, string, string]> = [
      ["/", "hero-3-step.png", '[data-section="hero-3-step"]'],
      ["/setup/", "setup-progress.png", '[data-section="setup-progress"]'],
      ["/setup/", "setup-openai-key.png", '[data-section="setup-openai-key"]'],
      ["/setup/", "setup-openai-model.png", '[data-section="setup-openai-model"]'],
      ["/setup/", "setup-feishu.png", '[data-section="setup-feishu"]'],
      ["/setup/", "setup-encryption.png", '[data-section="setup-encryption"]'],
      ["/setup/", "setup-run-workflow.png", '[data-section="setup-run-workflow"]'],
      ["/boss/", "boss-summary.png", '[data-section="boss-summary"]'],
      ["/", "mql-scorecard.png", '[data-section="mql-scorecard"]'],
      ["/", "mode-status-banner.png", '[data-section="mode-status-banner"]'],
      ["/", "demo-warning.png", '[data-section="demo-warning"]'],
      ["/", "copy-buttons.png", '[data-section="copy-buttons"]'],
    ];
    for (const [route, file, selector] of sections) {
      await screenshotLocator(browser, publicServer.baseUrl, route, selector, path.join(sectionDir, file), desktop);
    }
    await screenshotLocator(browser, publicServer.baseUrl, "/", '[data-section="hero-3-step"]', path.join(sectionDir, "mobile-first-screen.png"), mobile);
    await screenshotLocator(browser, publicServer.baseUrl, "/setup/", '[data-section="setup-status"]', path.join(sectionDir, "setup-status.png"), desktop);
    await screenshotLocator(browser, publicServer.baseUrl, "/archive/", '[data-section="calendar"]', path.join(sectionDir, "calendar-module.png"), desktop);
    await screenshotLocator(browser, publicServer.baseUrl, "/reports/2026-07-01/", '[data-section="report-card"]', path.join(sectionDir, "report-card.png"), desktop);
    await screenshotLocator(browser, publicServer.baseUrl, "/reports/2026-07-01/", '[data-section="copy-actions"]', path.join(sectionDir, "report-copy-buttons.png"), desktop);
    await screenshotLocator(browser, publicServer.baseUrl, "/reports/2026-07-01/", '[data-section="print-actions"]', path.join(sectionDir, "print-pdf-area.png"), desktop);
    await screenshotLocator(browser, publicServer.baseUrl, "/reports/2026-07-01/", '[data-section="report-card"]', path.join(sectionDir, "mobile-report-card.png"), mobile);
  } finally {
    await publicServer.close();
  }

  const encryptedDist = await mkdtemp(path.join(os.tmpdir(), "yqn-portal-encrypted-sections-"));
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
    await screenshotLocator(browser, encryptedServer.baseUrl, "/reports/2026-07-01/", '[data-section="encryption-unlock"]', path.join(sectionDir, "encryption-unlock-area.png"), desktop);
  } finally {
    await encryptedServer.close();
    await browser.close();
    await rm(encryptedDist, { recursive: true, force: true });
  }

  await writeFile(path.join(sectionDir, "manifest.json"), JSON.stringify({
    generated_at: new Date().toISOString(),
    files: [
      "hero-3-step.png",
      "setup-progress.png",
      "setup-openai-key.png",
      "setup-openai-model.png",
      "setup-feishu.png",
      "setup-encryption.png",
      "setup-run-workflow.png",
      "boss-summary.png",
      "mql-scorecard.png",
      "mode-status-banner.png",
      "demo-warning.png",
      "copy-buttons.png",
      "mobile-first-screen.png",
      "setup-status.png",
      "calendar-module.png",
      "report-card.png",
      "report-copy-buttons.png",
      "print-pdf-area.png",
      "encryption-unlock-area.png",
      "mobile-report-card.png"
    ],
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "visual sections failed");
  process.exit(1);
});
