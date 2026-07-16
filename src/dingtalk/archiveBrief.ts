import path from "node:path";
import { pathToFileURL } from "node:url";
import { readdir } from "node:fs/promises";
import { readJsonFile, writeJsonFile, writeTextFile, ensureDir } from "../utils/fs.js";
import { dataPath, distDingtalkDir, readDingtalkRuntimeConfig } from "./config.js";
import { briefHasTestData, renderDingtalkMarkdown } from "./renderMarkdown.js";
import {
  DingtalkBrief,
  categoryLabels,
  confidenceLabels,
  productName,
  productSubtitle,
  validateDingtalkBrief,
} from "./schema.js";

function escapeHtml(input: unknown): string {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderSourceLink(url: string, label: string): string {
  return `<a href="${escapeHtml(url)}" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
}

function renderArchivePage(
  brief: DingtalkBrief,
  markdown: string,
  nav: { previous?: DingtalkBrief; next?: DingtalkBrief },
): string {
  const status = briefHasTestData(brief) ? "测试版" : "正式版";
  const risks = brief.risk_flags.length ? brief.risk_flags.join("、") : "未发现 P0 风险";
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>${escapeHtml(productName)}｜${escapeHtml(brief.date)}</title>
  <style>
    :root { --bg:#f4f7fb; --paper:#fff; --line:#d8e2ef; --text:#172033; --muted:#65758b; --blue:#126bff; --green:#0f8f67; --warn:#9a5b00; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--text); font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; line-height:1.62; }
    main { max-width:1040px; margin:0 auto; padding:28px 18px 60px; }
    header, section, nav { background:var(--paper); border:1px solid var(--line); border-radius:8px; box-shadow:0 12px 28px rgba(28,63,101,.09); }
    header { padding:24px; margin-bottom:16px; border-top:4px solid var(--blue); }
    section, nav { padding:22px; margin-top:14px; }
    h1 { margin:0; font-size:30px; line-height:1.18; }
    h2 { margin:0 0 12px; font-size:21px; }
    h3 { margin:0 0 8px; font-size:18px; }
    p { margin:0; }
    a { color:#0566d6; overflow-wrap:anywhere; }
    .subtitle { margin-top:8px; color:var(--muted); font-weight:700; }
    .one { margin:14px 0 0; font-size:21px; color:#0b4fb3; font-weight:800; }
    .meta { margin-top:12px; color:var(--muted); font-size:13px; }
    .status { display:inline-block; margin-top:14px; padding:4px 10px; border:1px solid #bcd2ef; border-radius:999px; color:#0b4fb3; background:#f4f8ff; font-weight:800; font-size:13px; }
    .signal { border-left:4px solid var(--green); }
    .risk { border-left:4px solid var(--warn); }
    dl { display:grid; gap:9px; margin:0; }
    dt { font-weight:800; color:#0b4fb3; }
    dd { margin:0 0 4px; color:#2d3b4f; }
    ol { margin:0; padding-left:22px; }
    li { margin:8px 0; }
    pre { white-space:pre-wrap; word-break:break-word; margin:0; font-family:inherit; font-size:14px; background:#f7f9fc; padding:14px; border-radius:8px; border:1px solid var(--line); }
    .nav-row { display:flex; flex-wrap:wrap; gap:10px; }
    .nav-row a { display:inline-flex; padding:8px 12px; border:1px solid var(--line); border-radius:6px; text-decoration:none; background:#f8fbff; font-weight:700; }
    @media (max-width: 640px) {
      main { padding:18px 12px 46px; }
      header, section, nav { padding:18px; }
      h1 { font-size:24px; }
      .one { font-size:20px; }
      pre { font-size:13px; }
    }
  </style>
</head>
<body>
  <main data-shot="archive-page">
    <header>
      <h1>${escapeHtml(productName)}｜${escapeHtml(brief.date)}</h1>
      <p class="subtitle">${escapeHtml(productSubtitle)}</p>
      <h2 class="one">今日判断｜${escapeHtml(brief.one_liner)}</h2>
      <p class="meta">生成时间：${escapeHtml(brief.generated_at)}｜模式：${escapeHtml(brief.mode)}</p>
      <span class="status">${escapeHtml(status)}</span>
    </header>
    ${brief.signals.map((signal, index) => `<section class="signal">
      <h2>${index + 1}. ${escapeHtml(categoryLabels[signal.category])}｜${escapeHtml(signal.title)}</h2>
      <dl>
        <dt>发生</dt><dd>${escapeHtml(signal.what_happened)}</dd>
        <dt>生效时间</dt><dd>${escapeHtml(signal.effective_at)}</dd>
        <dt>影响卖家</dt><dd>${escapeHtml(signal.affected_sellers)}</dd>
        <dt>影响链路</dt><dd>${escapeHtml(signal.impact_stages.join(" / "))}</dd>
        <dt>影响</dt><dd>${escapeHtml(signal.why_it_matters)}</dd>
        <dt>卖家检查</dt><dd>${escapeHtml(signal.seller_check)}</dd>
        <dt>YQN 可承接</dt><dd>${escapeHtml(signal.yqn_use)}</dd>
        <dt>来源</dt><dd>${renderSourceLink(signal.source_url, `${signal.source_name}｜${signal.source_published_at}`)}</dd>
        <dt>采集时间</dt><dd>${escapeHtml(signal.collected_at)}</dd>
        <dt>区域 / 类型 / 可信度 / 价值分</dt><dd>${escapeHtml(signal.market_focus)} / ${escapeHtml(signal.info_type)} / ${escapeHtml(confidenceLabels[signal.confidence_label])} / ${escapeHtml(signal.value_score)}</dd>
        <dt>来源摘要</dt><dd>${escapeHtml(signal.source_summary)}</dd>
      </dl>
    </section>`).join("\n")}
    <section class="risk">
      <h2>风险提示</h2>
      <p>${escapeHtml(risks)}</p>
      <p class="meta">群版只使用公开信息和可公开表达动作；不含客户名单、报价、合同、毛利、内部成本或未公开客户案例。</p>
    </section>
    <nav aria-label="归档导航">
      <h2>归档导航</h2>
      <div class="nav-row">
        ${nav.previous ? `<a href="./${escapeHtml(nav.previous.date)}.html">上一篇：${escapeHtml(nav.previous.date)}</a>` : ""}
        ${nav.next ? `<a href="./${escapeHtml(nav.next.date)}.html">下一篇：${escapeHtml(nav.next.date)}</a>` : ""}
        <a href="./index.html">返回全部归档</a>
      </div>
    </nav>
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
    files = (await readdir(dir)).filter((file) => /^\d{4}-\d{2}-\d{2}\.json$/.test(file)).sort();
  } catch {
    return [];
  }
  const briefs: DingtalkBrief[] = [];
  for (const file of files) {
    try {
      briefs.push(validateDingtalkBrief(await readJsonFile(path.join(dir, file))));
    } catch {
      // Older archives are skipped because the current schema is stricter.
    }
  }
  return briefs;
}

function navFor(briefs: DingtalkBrief[], current: DingtalkBrief) {
  const index = briefs.findIndex((brief) => brief.date === current.date);
  return {
    previous: index > 0 ? briefs[index - 1] : undefined,
    next: index >= 0 && index < briefs.length - 1 ? briefs[index + 1] : undefined,
  };
}

function renderIndexPage(briefs: DingtalkBrief[]): string {
  const cards = briefs.slice().reverse().map((item) => `<a class="card" href="./${escapeHtml(item.date)}.html">
    <strong>${escapeHtml(item.title)}</strong>
    <p>${escapeHtml(item.one_liner)}</p>
    <p class="muted">${briefHasTestData(item) ? "测试版" : "正式版"}｜${escapeHtml(item.generated_at)}</p>
  </a>`).join("");
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>YQN 跨境增长情报归档</title>
<style>body{margin:0;background:#f4f7fb;color:#172033;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{max-width:920px;margin:0 auto;padding:32px 18px}.card{display:block;margin:12px 0;padding:18px;border:1px solid #d8e2ef;border-radius:8px;background:#fff;color:inherit;text-decoration:none;box-shadow:0 10px 24px rgba(28,63,101,.08)}h1{margin:0 0 8px}.muted{color:#65758b}.subtitle{color:#65758b;margin:0 0 18px}</style></head>
<body><main><h1>${escapeHtml(productName)}归档</h1><p class="subtitle">${escapeHtml(productSubtitle)}</p>${cards}</main></body></html>`;
}

export async function archiveDingtalkBrief(): Promise<void> {
  const config = readDingtalkRuntimeConfig();
  const brief = validateDingtalkBrief(await readJsonFile(dataPath(config)));
  const markdown = renderDingtalkMarkdown(brief, {
    publicBaseUrl: config.publicBaseUrl,
    archiveAvailable: Boolean(config.publicBaseUrl),
    testLabel: !(brief.mode === "live" && config.formalGroupEnabled && !briefHasTestData(brief)),
  });
  const distDir = distDingtalkDir(config);
  await ensureDir(distDir);
  await writeJsonFile(path.join(distDir, `${brief.date}.json`), brief);
  await writeTextFile(path.join(distDir, `${brief.date}.md`), markdown);

  const briefs = await loadAllBriefs(config.repoRoot);
  const allBriefs = briefs.some((item) => item.date === brief.date) ? briefs : [...briefs, brief].sort((a, b) => a.date.localeCompare(b.date));
  await writeTextFile(path.join(distDir, `${brief.date}.html`), renderArchivePage(brief, markdown, navFor(allBriefs, brief)));
  await writeTextFile(path.join(distDir, "index.html"), renderIndexPage(allBriefs));
  console.log(`[dingtalk:archive] wrote dist/dingtalk/${brief.date}.html`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  archiveDingtalkBrief().catch((error) => {
    console.error(error instanceof Error ? error.message : "DingTalk archive failed");
    process.exit(1);
  });
}
