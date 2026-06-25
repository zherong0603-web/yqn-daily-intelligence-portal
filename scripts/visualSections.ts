import path from "node:path";
import os from "node:os";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { buildSite } from "../src/buildSite.js";
import { applyPublicRepoVariablesForLocalBuild, desktop, launchBrowser, mobile, repoRoot, screenshotLocator, serve, visualAuditRoot } from "./visualCommon.js";

const sectionDir = path.join(visualAuditRoot, "sections");
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
      ["/", "daily-brief-hero.png", '[data-section="daily-brief-hero"]'],
      ["/", "daily-top-three.png", '[data-section="daily-top-three"]'],
      ["/", "action-points.png", '[data-section="action-points"]'],
      ["/", "history-module.png", '[data-section="history-module"]'],
      ["/", "search-module.png", '[data-section="search-module"]'],
      ["/setup/", "setup-status.png", '[data-section="setup-status"]'],
      ["/setup/", "setup-openai-key.png", '[data-section="setup-openai-key"]'],
      ["/setup/", "setup-openai-model.png", '[data-section="setup-openai-model"]'],
      ["/setup/", "setup-feishu.png", '[data-section="setup-feishu"]'],
      ["/setup/", "setup-encryption.png", '[data-section="setup-encryption"]'],
      ["/setup/", "setup-run-workflow.png", '[data-section="setup-run-workflow"]'],
      ["/", "mode-status-banner.png", '[data-section="mode-status-banner"]'],
      ["/", "demo-warning.png", '[data-section="demo-warning"]'],
      ["/", "copy-buttons.png", '[data-section="copy-actions"]'],
      ["/about/", "system-overview.png", '[data-section="system-overview"]'],
      ["/about/", "safety-cost-boundary.png", '[data-section="safety-cost-boundary"]'],
      ["/boss/", "legacy-summary.png", '[data-section="legacy-summary"]'],
    ];
    for (const [route, file, selector] of sections) {
      await screenshotLocator(browser, publicServer.baseUrl, route, selector, path.join(sectionDir, file), desktop);
    }
    await screenshotLocator(browser, publicServer.baseUrl, "/", '[data-section="daily-brief-hero"]', path.join(sectionDir, "mobile-first-screen.png"), mobile);
    await screenshotLocator(browser, publicServer.baseUrl, "/archive/", '[data-section="calendar"]', path.join(sectionDir, "calendar-module.png"), desktop);
    await screenshotLocator(browser, publicServer.baseUrl, "/reports/2026-07-01/", '[data-section="daily-top-three"]', path.join(sectionDir, "report-card.png"), desktop);
    await screenshotLocator(browser, publicServer.baseUrl, "/reports/2026-07-01/", '[data-section="copy-actions"]', path.join(sectionDir, "report-copy-buttons.png"), desktop);
    await screenshotLocator(browser, publicServer.baseUrl, "/reports/2026-07-01/", '[data-section="copy-actions"]', path.join(sectionDir, "print-pdf-area.png"), desktop);
    await screenshotLocator(browser, publicServer.baseUrl, "/reports/2026-07-01/", '[data-section="daily-top-three"]', path.join(sectionDir, "mobile-report-card.png"), mobile);
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
      "daily-brief-hero.png",
      "daily-top-three.png",
      "action-points.png",
      "history-module.png",
      "search-module.png",
      "setup-status.png",
      "setup-openai-key.png",
      "setup-openai-model.png",
      "setup-feishu.png",
      "setup-encryption.png",
      "setup-run-workflow.png",
      "mode-status-banner.png",
      "demo-warning.png",
      "copy-buttons.png",
      "system-overview.png",
      "safety-cost-boundary.png",
      "legacy-summary.png",
      "mobile-first-screen.png",
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
