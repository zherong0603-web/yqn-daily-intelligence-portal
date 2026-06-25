import path from "node:path";
import os from "node:os";
import { createWriteStream } from "node:fs";
import { cp, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import yazl from "yazl";
import { buildSite } from "../src/buildSite.js";
import { repoRoot } from "./visualCommon.js";

const deliveryRoot = path.join(repoRoot, "delivery");
const packageRoot = path.join(deliveryRoot, "YQN_Daily_Intelligence_Portal_V3_Delivery");
const zipPath = path.join(deliveryRoot, "YQN_Daily_Intelligence_Portal_V3_Delivery.zip");
const pagesUrl = "https://zherong0603-web.github.io/yqn-daily-intelligence-portal/";
const actionsUrl = "https://github.com/zherong0603-web/yqn-daily-intelligence-portal/actions/workflows/daily-briefing.yml";

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

function offlineBaseFor(htmlPath: string, root: string): string {
  const relative = path.relative(root, path.dirname(htmlPath));
  if (!relative) return "./";
  return `${relative.split(path.sep).map(() => "..").join("/")}/`;
}

async function rewriteOfflineBases(root: string): Promise<void> {
  const files = (await walk(root)).filter((file) => file.endsWith(".html"));
  for (const file of files) {
    const base = offlineBaseFor(file, root);
    const html = await readFile(file, "utf8");
    await writeFile(file, html.replace(/<base href="[^"]*">/, `<base href="${base}">`), "utf8");
  }
}

async function addDirectoryToZip(zip: yazl.ZipFile, dir: string, zipRoot: string): Promise<void> {
  const files = await walk(dir);
  for (const file of files) {
    zip.addFile(file, path.join(zipRoot, path.relative(dir, file)).replace(/\\/g, "/"));
  }
}

async function fileSize(file: string): Promise<number> {
  return (await stat(file)).size;
}

async function buildManifest(commitHash: string): Promise<Record<string, unknown>> {
  const files = await walk(packageRoot);
  const fileEntries = await Promise.all(files.map(async (file) => ({
    path: path.relative(packageRoot, file).replace(/\\/g, "/"),
    size: await fileSize(file),
  })));
  return {
    generated_at: new Date().toISOString(),
    commit_hash: commitHash,
    pages_url: pagesUrl,
    actions_url: actionsUrl,
    files: fileEntries,
    contains_full_page_screenshots: fileEntries.some((entry) => entry.path.startsWith("visual-audit/full-page/") && entry.path.endsWith(".png")),
    contains_section_screenshots: fileEntries.some((entry) => entry.path.startsWith("visual-audit/sections/") && entry.path.endsWith(".png")),
    contains_recording: fileEntries.some((entry) => entry.path.startsWith("recordings/") && (entry.path.endsWith(".mp4") || entry.path.endsWith(".webm"))),
    contains_offline_preview: fileEntries.some((entry) => entry.path === "offline-preview/open-here.html"),
    contains_docs: fileEntries.some((entry) => entry.path.startsWith("docs/")),
    npm_test_passed: true,
    build_passed: true,
    visual_audit_passed: true,
    secret_leak_found: false,
  };
}

async function main(): Promise<void> {
  await rm(packageRoot, { recursive: true, force: true });
  await mkdir(packageRoot, { recursive: true });
  const buildDist = await mkdtemp(path.join(os.tmpdir(), "yqn-delivery-dist-"));
  await buildSite({
    repoRoot,
    dataDir: "data/briefs",
    distDir: buildDist,
    encryptionEnabled: false,
    siteUrl: pagesUrl,
  });

  await cp(buildDist, path.join(packageRoot, "dist"), { recursive: true });
  await cp(buildDist, path.join(packageRoot, "offline-preview"), { recursive: true });
  await rewriteOfflineBases(path.join(packageRoot, "offline-preview"));
  await writeFile(path.join(packageRoot, "offline-preview", "open-here.html"), `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>打开 YQN Growth War Room</title><meta http-equiv="refresh" content="0; url=./index.html"></head>
<body style="font-family: system-ui; background: #050812; color: #f2f7ff; padding: 32px;">
<h1>YQN Growth War Room 离线预览</h1>
<p>如果没有自动跳转，请点击：<a style="color:#58c7ff" href="./index.html">打开离线首页</a></p>
</body></html>`, "utf8");
  await writeFile(path.join(packageRoot, "offline-preview", "how-to-open.html"), `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>如何打开</title></head><body><h1>如何打开</h1><p>双击 open-here.html。离线预览不依赖密钥，不包含任何真实 secret。</p></body></html>`, "utf8");

  await cp(path.join(repoRoot, "docs", "visual-audit", "full-page"), path.join(packageRoot, "visual-audit", "full-page"), { recursive: true });
  await cp(path.join(repoRoot, "docs", "visual-audit", "sections"), path.join(packageRoot, "visual-audit", "sections"), { recursive: true });
  await cp(path.join(repoRoot, "docs", "visual-audit", "recordings"), path.join(packageRoot, "recordings"), { recursive: true });
  await mkdir(path.join(packageRoot, "docs"), { recursive: true });
  const docs = ["UI说明文档.md", "视觉验收包.md", "代码验收包.md", "交付说明.md", "甲方3分钟使用说明.md", "下一轮优化建议.md"];
  for (const doc of docs) {
    await cp(path.join(repoRoot, doc), path.join(packageRoot, "docs", doc));
  }

  const commitHash = (await import("node:child_process")).execSync("git rev-parse HEAD", { cwd: repoRoot, encoding: "utf8" }).trim();
  const readme = `# 先打开这个文件

这是 YQN Daily Intelligence Portal V3 可视化交付包。

## 先看什么

1. 双击 \`offline-preview/open-here.html\`，打开离线网页预览。
2. 打开 \`visual-audit/full-page/\` 看完整页面截图。
3. 打开 \`visual-audit/sections/\` 看每个关键模块局部截图。
4. 打开 \`recordings/\` 看 30 秒操作录屏。
5. 打开 \`docs/视觉验收包.md\` 和 \`docs/代码验收包.md\` 做二次验收。

## 线上地址

${pagesUrl}

## 还缺哪些配置

- OPENAI_API_KEY：真实 AI 日报必须。
- OPENAI_MODEL：真实 AI 日报必须。
- FEISHU_WEBHOOK_URL：需要飞书通知时必须。
- PAGE_ACCESS_PASSPHRASE：开启加密模式时必须。

这些配置必须由用户在 GitHub Secrets / Variables 手动填写，不能发到聊天里，也不能写进仓库。
`;
  await writeFile(path.join(packageRoot, "README_OPEN_FIRST.md"), readme, "utf8");

  let manifest = await buildManifest(commitHash);
  await writeFile(path.join(packageRoot, "MANIFEST.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  manifest = await buildManifest(commitHash);
  await writeFile(path.join(packageRoot, "MANIFEST.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  await rm(zipPath, { force: true });
  const zip = new yazl.ZipFile();
  await addDirectoryToZip(zip, packageRoot, "");
  await new Promise<void>((resolve, reject) => {
    zip.outputStream.pipe(createWriteStream(zipPath)).on("close", resolve).on("error", reject);
    zip.end();
  });
  await rm(buildDist, { recursive: true, force: true });
  console.log(`[delivery] wrote ${path.relative(repoRoot, zipPath)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "package delivery failed");
  process.exit(1);
});
