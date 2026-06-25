import path from "node:path";
import { existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import yauzl from "yauzl";
import { repoRoot } from "./visualCommon.js";

const zipPath = path.join(repoRoot, "delivery", "YQN_Daily_Intelligence_Portal_V3_Delivery.zip");
const packageRoot = path.join(repoRoot, "delivery", "YQN_Daily_Intelligence_Portal_V3_Delivery");

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
    /^visual-audit\/full-page\/desktop-home\.png$/,
    /^visual-audit\/full-page\/desktop-executive\.png$/,
    /^visual-audit\/full-page\/mobile-home\.png$/,
    /^visual-audit\/sections\/hero-command-center\.png$/,
    /^visual-audit\/sections\/mql-quality-card\.png$/,
    /^recordings\/desktop-30s-operator-flow\.(mp4|webm)$/,
    "docs/UI说明文档.md",
    "docs/视觉验收包.md",
    "docs/代码验收包.md",
    "docs/交付说明.md",
    "docs/甲方3分钟使用说明.md",
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
