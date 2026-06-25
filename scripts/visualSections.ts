import path from "node:path";
import os from "node:os";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { buildSite } from "../src/buildSite.js";
import { desktop, launchBrowser, mobile, repoRoot, screenshotLocator, serve } from "./visualCommon.js";

const sectionDir = path.join(repoRoot, "docs", "visual-audit", "sections");
const passphrase = "local-section-audit-passphrase";

async function main(): Promise<void> {
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
    const homeSections: Array<[string, string]> = [
      ["hero-command-center.png", '[data-section="hero"]'],
      ["today-top-three.png", '[data-section="top-three"]'],
      ["executive-summary-card.png", '[data-section="executive-summary"]'],
      ["mql-quality-card.png", '[data-section="mql-quality"]'],
      ["org-gap-card.png", '[data-section="org-gap"]'],
      ["content-experiment-card.png", '[data-section="content-experiment"]'],
      ["personal-daily-card.png", '[data-section="personal-daily"]'],
      ["history-archive-module.png", '[data-section="history-archive"]'],
      ["search-module.png", '[data-section="search"]'],
      ["config-status-module.png", '[data-section="config-status"]'],
    ];
    for (const [file, selector] of homeSections) {
      await screenshotLocator(browser, publicServer.baseUrl, "/", selector, path.join(sectionDir, file), desktop);
    }
    await screenshotLocator(browser, publicServer.baseUrl, "/archive/", '[data-section="calendar"]', path.join(sectionDir, "calendar-module.png"), desktop);
    await screenshotLocator(browser, publicServer.baseUrl, "/reports/2026-07-01/", '[data-section="report-card"]', path.join(sectionDir, "report-card.png"), desktop);
    await screenshotLocator(browser, publicServer.baseUrl, "/reports/2026-07-01/", '[data-section="copy-actions"]', path.join(sectionDir, "copy-buttons.png"), desktop);
    await screenshotLocator(browser, publicServer.baseUrl, "/reports/2026-07-01/", '[data-section="print-actions"]', path.join(sectionDir, "print-pdf-area.png"), desktop);
    await screenshotLocator(browser, publicServer.baseUrl, "/", ".topbar", path.join(sectionDir, "mobile-top.png"), mobile);
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
      "hero-command-center.png",
      "today-top-three.png",
      "executive-summary-card.png",
      "mql-quality-card.png",
      "org-gap-card.png",
      "content-experiment-card.png",
      "personal-daily-card.png",
      "history-archive-module.png",
      "search-module.png",
      "calendar-module.png",
      "report-card.png",
      "copy-buttons.png",
      "print-pdf-area.png",
      "encryption-unlock-area.png",
      "config-status-module.png",
      "mobile-top.png",
      "mobile-report-card.png"
    ],
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "visual sections failed");
  process.exit(1);
});
