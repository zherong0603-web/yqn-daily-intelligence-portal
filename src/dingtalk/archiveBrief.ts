import path from "node:path";
import { pathToFileURL } from "node:url";
import { readdir } from "node:fs/promises";
import { readJsonFile, writeJsonFile, writeTextFile, ensureDir } from "../utils/fs.js";
import { dataPath, distDingtalkDir, readDingtalkRuntimeConfig } from "./config.js";
import { renderDingtalkMarkdown } from "./renderMarkdown.js";
import { DingtalkBrief, validateDingtalkBrief } from "./schema.js";

function escapeHtml(input: unknown): string {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderArchivePage(brief: DingtalkBrief, markdown: string): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>${escapeHtml(brief.title)}</title>
  <style>
    :root { --bg:#f4f7fb; --paper:#fff; --line:#d8e2ef; --text:#172033; --muted:#65758b; --blue:#126bff; --green:#0f8f67; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--text); font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; line-height:1.62; }
    main { max-width:980px; margin:0 auto; padding:28px 18px 60px; }
    header, section { background:var(--paper); border:1px solid var(--line); border-radius:8px; box-shadow:0 12px 28px rgba(28,63,101,.1); }
    header { padding:24px; margin-bottom:16px; border-top:4px solid var(--blue); }
    section { padding:22px; margin-top:14px; }
    h1 { margin:0; font-size:30px; line-height:1.18; }
    h2 { margin:0 0 10px; font-size:20px; }
    p { margin:0; }
    .one { margin-top:12px; font-size:20px; color:#0b4fb3; font-weight:800; }
    .meta { margin-top:12px; color:var(--muted); font-size:13px; }
    .signal { border-left:4px solid var(--green); }
    dl { display:grid; gap:9px; margin:0; }
    dt { font-weight:800; color:#0b4fb3; }
    dd { margin:0 0 4px; color:#2d3b4f; }
    a { color:#0566d6; overflow-wrap:anywhere; }
    ol { margin:0; padding-left:22px; }
    li { margin:8px 0; }
    pre { white-space:pre-wrap; word-break:break-word; margin:0; font-family:inherit; }
    @media (max-width: 640px) { h1 { font-size:24px; } .one { font-size:18px; } }
  </style>
</head>
<body>
  <main data-shot="archive-page">
    <header>
      <h1>🚢 ${escapeHtml(brief.title)}</h1>
      <p class="one">${escapeHtml(brief.one_liner)}</p>
      <p class="meta">模式：${escapeHtml(brief.mode)}｜生成时间：${escapeHtml(brief.generated_at)}</p>
    </header>
    ${brief.signals.map((signal) => `<section class="signal">
      <h2>${escapeHtml(signal.title)}</h2>
      <dl>
        <dt>发生了什么</dt><dd>${escapeHtml(signal.what_happened)}</dd>
        <dt>为什么重要</dt><dd>${escapeHtml(signal.why_it_matters)}</dd>
        <dt>YQN 可用点</dt><dd>${escapeHtml(signal.yqn_use)}</dd>
        <dt>今天动作</dt><dd>${escapeHtml(signal.today_action)}</dd>
        <dt>来源链接</dt><dd><a href="${escapeHtml(signal.source_url)}">${escapeHtml(signal.source_url)}</a></dd>
        <dt>置信度 / 是否敏感</dt><dd>${Math.round(signal.confidence * 100)}% / ${signal.is_sensitive ? "是" : "否"}</dd>
      </dl>
    </section>`).join("\n")}
    <section>
      <h2>今日 3 个动作</h2>
      <ol>${brief.action_list.map((action) => `<li>${escapeHtml(action)}</li>`).join("")}</ol>
    </section>
    <section>
      <h2>钉钉 Markdown 原文</h2>
      <pre>${escapeHtml(markdown)}</pre>
    </section>
  </main>
</body>
</html>`;
}

async function loadAllBriefs(repoRoot: string): Promise<DingtalkBrief[]> {
  const dir = path.join(repoRoot, "data", "dingtalk-briefs");
  let files: string[] = [];
  try {
    files = (await readdir(dir)).filter((file) => /^\d{4}-\d{2}-\d{2}\.json$/.test(file)).sort().reverse();
  } catch {
    return [];
  }
  return Promise.all(files.map(async (file) => validateDingtalkBrief(await readJsonFile(path.join(dir, file)))));
}

export async function archiveDingtalkBrief(): Promise<void> {
  const config = readDingtalkRuntimeConfig();
  const brief = validateDingtalkBrief(await readJsonFile(dataPath(config)));
  const markdown = renderDingtalkMarkdown(brief, config.siteUrl);
  const distDir = distDingtalkDir(config);
  await ensureDir(distDir);
  await writeJsonFile(path.join(distDir, `${brief.date}.json`), brief);
  await writeTextFile(path.join(distDir, `${brief.date}.md`), markdown);
  await writeTextFile(path.join(distDir, `${brief.date}.html`), renderArchivePage(brief, markdown));

  const briefs = await loadAllBriefs(config.repoRoot);
  await writeTextFile(path.join(distDir, "index.html"), `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>YQN 钉钉晨报归档</title>
<style>body{margin:0;background:#f4f7fb;color:#172033;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{max-width:920px;margin:0 auto;padding:32px 18px}.card{display:block;margin:12px 0;padding:18px;border:1px solid #d8e2ef;border-radius:8px;background:#fff;color:inherit;text-decoration:none;box-shadow:0 10px 24px rgba(28,63,101,.08)}h1{margin:0 0 18px}.muted{color:#65758b}</style></head>
<body><main><h1>🚢 YQN 北美履约增长晨报归档</h1>${briefs.map((item) => `<a class="card" href="./${item.date}.html"><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.one_liner)}</p><p class="muted">${escapeHtml(item.mode)}｜${escapeHtml(item.generated_at)}</p></a>`).join("")}</main></body></html>`);
  console.log(`[dingtalk:archive] wrote dist/dingtalk/${brief.date}.html`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  archiveDingtalkBrief().catch((error) => {
    console.error(error instanceof Error ? error.message : "DingTalk archive failed");
    process.exit(1);
  });
}
