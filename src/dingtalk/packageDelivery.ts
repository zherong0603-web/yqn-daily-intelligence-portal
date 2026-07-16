import path from "node:path";
import { createWriteStream } from "node:fs";
import { cp, mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import yazl from "yazl";
import {
  archiveLinkCheckPath,
  dataPath,
  markdownPath,
  readDingtalkRuntimeConfig,
  riskReportPath,
  sourceReportPath,
  validationReportPath,
} from "./config.js";
import { productName } from "./schema.js";

const packageRootName = "YQN_Daily_5_Minutes_V1_4_Delivery";
const zipName = "YQN_Daily_5_Minutes_V1_4_Delivery.zip";

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else files.push(full);
  }
  return files;
}

async function addDirectoryToZip(zip: yazl.ZipFile, dir: string): Promise<void> {
  const files = await walk(dir);
  for (const file of files) {
    zip.addFile(file, path.relative(dir, file).replace(/\\/g, "/"));
  }
}

async function copyIfExists(from: string, to: string): Promise<void> {
  try {
    await cp(from, to, { recursive: true });
  } catch {
    // The manifest records missing optional visual files.
  }
}

async function buildManifest(
  root: string,
  date: string,
  formalGroupEnabled: boolean,
  livestreamGroupEnabled: boolean,
): Promise<Record<string, unknown>> {
  const files = await walk(root);
  const fileEntries = await Promise.all(files.map(async (file) => ({
    path: path.relative(root, file).replace(/\\/g, "/"),
    size: (await stat(file)).size,
  })));
  return {
    generated_at: new Date().toISOString(),
    product: productName,
    version: "V1.4",
    date,
    files: fileEntries,
    contains_markdown_preview: fileEntries.some((entry) => entry.path === "preview/dingtalk-markdown-preview.md"),
    contains_desktop_screenshot: fileEntries.some((entry) => entry.path === "preview/dingtalk-message-desktop.png"),
    contains_mobile_screenshot: fileEntries.some((entry) => entry.path === "preview/dingtalk-message-mobile.png"),
    contains_archive_screenshot: fileEntries.some((entry) => entry.path === "preview/dingtalk-archive-page.png"),
    contains_recording: fileEntries.some((entry) => entry.path === "preview/dingtalk-operation-recording.webm"),
    contains_preflight_research_pack: fileEntries.some((entry) => entry.path === "checks/mini_research_pack.json"),
    dry_run_default: true,
    sends_to_test_group_only: !formalGroupEnabled && !livestreamGroupEnabled,
    forbidden_content_guard_enabled: true,
  };
}

export async function packageDingtalkDelivery(): Promise<string> {
  const config = readDingtalkRuntimeConfig();
  const deliveryDir = path.join(config.repoRoot, "delivery");
  const root = path.join(deliveryDir, packageRootName);
  const zipPath = path.join(deliveryDir, zipName);
  await mkdir(root, { recursive: true });
  await rm(path.join(root, "data"), { recursive: true, force: true });
  await rm(path.join(root, "checks"), { recursive: true, force: true });
  await rm(path.join(root, "docs", "dingtalk"), { recursive: true, force: true });
  await rm(path.join(root, "dist", "dingtalk"), { recursive: true, force: true });
  await rm(path.join(root, "archive_link_check.json"), { force: true });
  await rm(path.join(root, "risk_report.json"), { force: true });
  await rm(path.join(root, "validation_report.json"), { force: true });
  await rm(path.join(root, "MANIFEST.json"), { force: true });
  await mkdir(path.join(root, "data"), { recursive: true });
  await mkdir(path.join(root, "checks"), { recursive: true });
  await mkdir(path.join(root, "docs", "dingtalk"), { recursive: true });

  await cp(dataPath(config), path.join(root, "data", "brief.json"));
  await cp(markdownPath(config), path.join(root, "data", "brief.md"));
  await copyIfExists(archiveLinkCheckPath(config), path.join(root, "checks", "archive_link_check.json"));
  await copyIfExists(riskReportPath(config), path.join(root, "checks", "risk_report.json"));
  await copyIfExists(validationReportPath(config), path.join(root, "checks", "validation_report.json"));
  await copyIfExists(sourceReportPath(config), path.join(root, "checks", "source_report.json"));
  await copyIfExists(path.join(config.repoRoot, "data", "dingtalk-briefs", `${config.date}.mini_research_pack.json`), path.join(root, "checks", "mini_research_pack.json"));
  await copyIfExists(path.join(config.repoRoot, "data", "dingtalk-briefs", `${config.date}.mini_research_pack.md`), path.join(root, "checks", "mini_research_pack.md"));
  await copyIfExists(archiveLinkCheckPath(config), path.join(root, "archive_link_check.json"));
  await copyIfExists(riskReportPath(config), path.join(root, "risk_report.json"));
  await copyIfExists(validationReportPath(config), path.join(root, "validation_report.json"));
  await copyIfExists(sourceReportPath(config), path.join(root, "source_report.json"));
  await rm(path.join(root, "docs", "dingtalk"), { recursive: true, force: true });
  await copyIfExists(path.join(config.repoRoot, "docs", "dingtalk"), path.join(root, "docs", "dingtalk"));
  await copyIfExists(path.join(config.repoRoot, "dist", "dingtalk"), path.join(root, "dist", "dingtalk"));

  let manifest = await buildManifest(root, config.date, config.formalGroupEnabled, config.livestreamGroupEnabled);
  await writeFile(path.join(root, "MANIFEST.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  manifest = await buildManifest(root, config.date, config.formalGroupEnabled, config.livestreamGroupEnabled);
  await writeFile(path.join(root, "MANIFEST.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  await rm(zipPath, { force: true });
  const zip = new yazl.ZipFile();
  await addDirectoryToZip(zip, root);
  await new Promise<void>((resolve, reject) => {
    zip.outputStream.pipe(createWriteStream(zipPath)).on("close", resolve).on("error", reject);
    zip.end();
  });
  console.log(`[dingtalk:package] wrote ${zipPath}`);
  return zipPath;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  packageDingtalkDelivery().catch((error) => {
    console.error(error instanceof Error ? error.message : "DingTalk delivery package failed");
    process.exit(1);
  });
}
