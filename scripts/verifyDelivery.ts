import path from "node:path";
import { existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import yauzl from "yauzl";
import { repoRoot } from "./visualCommon.js";

const zipPath = path.join(repoRoot, "delivery", "YQN_Daily_Intelligence_Portal_V4_1_Delivery.zip");
const packageRoot = path.join(repoRoot, "delivery", "YQN_Daily_Intelligence_Portal_V4_1_Delivery");

async function zipEntries(): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const entries: string[] = [];
    yauzl.open(zipPath, { lazyEntries: true, decodeStrings: true }, (openError, zipfile) => {
      if (openError || !zipfile) {
        reject(openError || new Error("unable to open zip"));
        return;
      }
      zipfile.readEntry();
      zipfile.on("entry", (entry) => {
        entries.push(entry.fileName);
        zipfile.readEntry();
      });
      zipfile.on("end", () => resolve(entries));
      zipfile.on("error", reject);
    });
  });
}

function has(entries: string[], pattern: string | RegExp): boolean {
  if (typeof pattern === "string") return entries.includes(pattern);
  return entries.some((entry) => pattern.test(entry));
}

async function main(): Promise<void> {
  if (!existsSync(zipPath)) throw new Error("delivery zip is missing");
  const size = (await stat(zipPath)).size;
  if (size > 50 * 1024 * 1024) throw new Error(`delivery zip is larger than 50MB: ${size}`);

  const entries = await zipEntries();
  if (!entries.length) throw new Error("unable to inspect delivery zip entries");
  const required: Array<string | RegExp> = [
    "README_OPEN_FIRST.md",
    "MANIFEST.json",
    "offline-preview/open-here.html",
    /^dist\/index\.html$/,
    /^dist\/setup\/index\.html$/,
    /^dist\/boss\/index\.html$/,
    /^visual-audit\/full-page\/desktop-home\.png$/,
    /^visual-audit\/full-page\/desktop-setup\.png$/,
    /^visual-audit\/full-page\/desktop-boss\.png$/,
    /^visual-audit\/full-page\/desktop-executive\.png$/,
    /^visual-audit\/full-page\/desktop-mql\.png$/,
    /^visual-audit\/full-page\/desktop-report\.png$/,
    /^visual-audit\/full-page\/desktop-archive\.png$/,
    /^visual-audit\/full-page\/desktop-month\.png$/,
    /^visual-audit\/full-page\/desktop-week\.png$/,
    /^visual-audit\/full-page\/desktop-search-results\.png$/,
    /^visual-audit\/full-page\/desktop-search-empty\.png$/,
    /^visual-audit\/full-page\/desktop-encrypted-locked\.png$/,
    /^visual-audit\/full-page\/mobile-home\.png$/,
    /^visual-audit\/full-page\/mobile-setup\.png$/,
    /^visual-audit\/full-page\/mobile-boss\.png$/,
    /^visual-audit\/full-page\/mobile-report\.png$/,
    /^visual-audit\/sections\/hero-3-step\.png$/,
    /^visual-audit\/sections\/setup-progress\.png$/,
    /^visual-audit\/sections\/setup-openai-key\.png$/,
    /^visual-audit\/sections\/setup-openai-model\.png$/,
    /^visual-audit\/sections\/setup-feishu\.png$/,
    /^visual-audit\/sections\/setup-encryption\.png$/,
    /^visual-audit\/sections\/setup-run-workflow\.png$/,
    /^visual-audit\/sections\/boss-summary\.png$/,
    /^visual-audit\/sections\/mql-scorecard\.png$/,
    /^visual-audit\/sections\/mode-status-banner\.png$/,
    /^visual-audit\/sections\/demo-warning\.png$/,
    /^visual-audit\/sections\/copy-buttons\.png$/,
    /^visual-audit\/sections\/mobile-first-screen\.png$/,
    /^recordings\/desktop-30s-operator-flow\.mp4$/,
    /^recordings\/desktop-30s-setup-flow\.mp4$/,
    "docs/交付说明.md",
    "docs/甲方3分钟使用说明.md",
    "docs/配置向导说明.md",
    "docs/视觉验收包.md",
    "docs/代码验收包.md",
    "docs/UI说明文档.md",
    "docs/老板演示话术.md",
    "docs/下一轮优化建议.md",
  ];
  const missing = required.filter((pattern) => !has(entries, pattern));
  if (missing.length) throw new Error(`delivery zip missing required entries: ${missing.map(String).join(", ")}`);
  if (!existsSync(packageRoot)) throw new Error("delivery staging folder is missing");
  console.log(`[delivery] verified zip entries=${entries.length} size=${size}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "verify delivery failed");
  process.exit(1);
});
