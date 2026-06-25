import { Brief, BriefItem, topicLabels, Topic } from "../schema.js";
import { isoWeek, monthParts } from "./date.js";

export interface PageOptions {
  title: string;
  body: string;
  basePath?: string;
  script?: string;
}

export function escapeHtml(input: unknown): string {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function jsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function basePathFromSiteUrl(siteUrl: string): string {
  if (!siteUrl) return "/";
  try {
    const path = new URL(siteUrl).pathname.replace(/\/$/, "");
    return path || "/";
  } catch {
    return "/";
  }
}

const css = `
:root {
  color-scheme: dark;
  --bg: #070a0f;
  --surface: #0d121a;
  --surface-2: #121925;
  --surface-3: #172131;
  --line: #253247;
  --line-strong: #35465e;
  --text: #eef4ff;
  --soft: #c6d3e5;
  --muted: #8fa1b9;
  --dim: #64748b;
  --accent: #27d7a1;
  --accent-2: #57b8ff;
  --warn: #f2c66d;
  --danger: #ff6f86;
  --ok-bg: rgba(39, 215, 161, 0.1);
  --blue-bg: rgba(87, 184, 255, 0.1);
  --amber-bg: rgba(242, 198, 109, 0.11);
  --radius: 8px;
}
* { box-sizing: border-box; }
html { min-height: 100%; background: var(--bg); }
body {
  margin: 0;
  min-height: 100%;
  background:
    linear-gradient(180deg, rgba(39, 215, 161, 0.08) 0, rgba(7, 10, 15, 0) 312px),
    linear-gradient(90deg, rgba(87, 184, 255, 0.05) 0, rgba(7, 10, 15, 0) 52%),
    var(--bg);
  color: var(--text);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 15px;
  line-height: 1.58;
}
a { color: inherit; text-decoration: none; }
a:focus-visible, button:focus-visible, input:focus-visible, select:focus-visible {
  outline: 2px solid var(--accent-2);
  outline-offset: 2px;
}
.topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px clamp(16px, 4vw, 48px);
  border-bottom: 1px solid rgba(255,255,255,0.08);
  background: rgba(7, 10, 15, 0.9);
  backdrop-filter: blur(16px);
}
.brand { display: flex; align-items: center; gap: 10px; font-weight: 800; letter-spacing: 0; }
.brand-mark {
  width: 28px;
  height: 28px;
  border: 1px solid rgba(39, 215, 161, 0.72);
  border-radius: 7px;
  display: grid;
  place-items: center;
  color: var(--accent);
  background: rgba(39, 215, 161, 0.08);
  font-size: 12px;
}
.brand-sub { display: block; color: var(--muted); font-size: 11px; font-weight: 500; line-height: 1.1; }
.nav { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
.nav a, .button, button {
  border: 1px solid var(--line);
  border-radius: 7px;
  background: rgba(18, 25, 37, 0.94);
  color: var(--text);
  min-height: 38px;
  padding: 8px 12px;
  font: inherit;
  cursor: pointer;
  transition: border-color 120ms ease, background 120ms ease, color 120ms ease;
}
.button.primary, button.primary { border-color: rgba(39,215,161,0.72); background: var(--ok-bg); color: #f5fffb; }
.button.secondary, button.secondary { border-color: rgba(87,184,255,0.62); background: var(--blue-bg); }
.button:hover, button:hover, .nav a:hover { border-color: var(--accent-2); background: rgba(87, 184, 255, 0.12); }
.button:active, button:active { transform: translateY(1px); }
.dashboard-shell { width: min(1240px, calc(100% - 32px)); margin: 0 auto; padding: 28px 0 56px; }
.hero {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.65fr);
  gap: 16px;
  align-items: stretch;
}
.hero-main, .hero-side, .section, .tool-panel {
  border: 1px solid var(--line);
  background: linear-gradient(180deg, rgba(18,25,37,0.96), rgba(10,15,23,0.96));
  border-radius: var(--radius);
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.24);
}
.hero-main { padding: 24px; display: flex; flex-direction: column; justify-content: flex-start; }
.hero-main > div + div { margin-top: 18px; }
.hero-side, .section, .tool-panel { padding: 18px; }
.kicker {
  margin: 0 0 10px;
  color: var(--accent);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: uppercase;
}
h1 { margin: 0; font-size: 44px; line-height: 1.08; letter-spacing: 0; }
h2 { margin: 0 0 12px; font-size: 20px; line-height: 1.25; letter-spacing: 0; }
h3 { margin: 0; font-size: 17px; line-height: 1.35; letter-spacing: 0; }
p { margin: 0; }
.one-liner { margin-top: 16px; color: var(--soft); font-size: 22px; line-height: 1.42; max-width: 860px; }
.date-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 18px;
  color: var(--muted);
}
.chip, .badge {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 4px 9px;
  border: 1px solid rgba(255,255,255,0.13);
  border-radius: 999px;
  color: var(--soft);
  background: rgba(255,255,255,0.035);
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
}
.badge.strong { color: var(--accent); border-color: rgba(39,215,161,0.58); background: var(--ok-bg); }
.badge.medium { color: var(--warn); border-color: rgba(242,198,109,0.52); background: var(--amber-bg); }
.badge.weak { color: var(--muted); }
.badge.low { color: var(--warn); border-color: rgba(242,198,109,0.52); }
.actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; }
.metric-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 14px; }
.metric {
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 7px;
  padding: 12px;
  background: rgba(255,255,255,0.035);
}
.metric-label { color: var(--muted); font-size: 12px; }
.metric-value { display: block; margin-top: 4px; font-size: 24px; font-weight: 800; line-height: 1.15; }
.signal-meter { margin-top: 14px; }
.meter-track { height: 8px; border-radius: 999px; background: #1a2433; overflow: hidden; border: 1px solid rgba(255,255,255,0.08); }
.meter-fill { height: 100%; width: var(--score); background: linear-gradient(90deg, var(--accent), var(--accent-2)); }
.meter-label { display: flex; justify-content: space-between; margin-top: 8px; color: var(--muted); font-size: 12px; }
.section { margin-top: 16px; }
.section-spacer { margin-top: 18px; }
.grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(312px, 0.42fr); gap: 16px; align-items: start; }
.split { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.mini-panel {
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 7px;
  padding: 14px;
  background: rgba(255,255,255,0.032);
}
.mini-panel strong { display: block; margin-bottom: 4px; }
.muted { color: var(--muted); }
.dim { color: var(--dim); }
.item-list { display: grid; gap: 12px; }
.signal-card, .archive-row, .result-row {
  display: grid;
  gap: 10px;
  border: 1px solid rgba(255,255,255,0.09);
  border-radius: 8px;
  padding: 14px;
  background: rgba(255,255,255,0.036);
}
.signal-card:hover, .archive-row:hover, .result-row:hover { border-color: rgba(87,184,255,0.58); background: rgba(87,184,255,0.065); }
.item-head { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.card-title { color: var(--text); font-weight: 800; }
.signal-meta { display: flex; flex-wrap: wrap; gap: 8px; color: var(--muted); font-size: 12px; }
.intel-fields { display: grid; gap: 10px; }
.field-block {
  border-left: 2px solid rgba(87,184,255,0.45);
  padding-left: 10px;
}
.field-label { color: var(--accent-2); font-size: 12px; font-weight: 800; margin: 0 0 3px; }
.field-body { color: var(--soft); overflow-wrap: anywhere; }
.source-link { color: var(--accent); overflow-wrap: anywhere; text-decoration: underline; text-decoration-color: rgba(39,215,161,0.45); text-underline-offset: 3px; }
.checklist, .archive-list, .source-list, .steps { margin: 0; padding-left: 20px; color: var(--soft); }
.checklist li, .archive-list li, .source-list li, .steps li { margin: 6px 0; }
.search-controls { display: grid; grid-template-columns: minmax(0, 1fr) 220px auto; gap: 10px; align-items: center; }
input, select {
  width: 100%;
  min-height: 42px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: rgba(6, 9, 14, 0.86);
  color: var(--text);
  padding: 8px 10px;
  font: inherit;
}
input::placeholder { color: var(--dim); }
select { appearance: none; }
.search-results { display: grid; gap: 10px; margin-top: 14px; }
.archive-tools { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.calendar {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
  gap: 8px;
}
.calendar a {
  border: 1px solid var(--line);
  border-radius: 7px;
  padding: 10px;
  color: var(--soft);
  background: rgba(255,255,255,0.03);
}
.calendar a:hover { border-color: var(--accent); color: var(--text); }
.archive-date { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.empty {
  color: var(--muted);
  padding: 14px;
  border: 1px dashed var(--line-strong);
  border-radius: 7px;
  background: rgba(255,255,255,0.024);
}
.locked { border-color: rgba(242,198,109,0.55); }
.unlock-panel {
  max-width: 720px;
  margin: 16px auto 0;
  border-color: rgba(242,198,109,0.58);
}
.security-note {
  border: 1px solid rgba(242,198,109,0.36);
  background: var(--amber-bg);
  border-radius: 7px;
  padding: 12px;
  color: var(--soft);
}
.site-footer {
  width: min(1240px, calc(100% - 32px));
  margin: 0 auto;
  padding: 24px 0 36px;
  color: var(--muted);
  font-size: 13px;
  border-top: 1px solid rgba(255,255,255,0.08);
}
.footer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.nav-links { display: flex; flex-wrap: wrap; gap: 8px; }
.nav-card { border: 1px solid var(--line); border-radius: 7px; padding: 10px 12px; color: var(--soft); background: rgba(255,255,255,0.03); }
.nav-card:hover { border-color: var(--accent-2); color: var(--text); }
@media (max-width: 920px) {
  .topbar { align-items: flex-start; flex-direction: column; }
  .hero, .grid, .split { grid-template-columns: 1fr; }
  .hero-main { min-height: auto; }
  h1 { font-size: 34px; }
  .one-liner { font-size: 19px; }
  .search-controls { grid-template-columns: 1fr; }
  .footer-grid { grid-template-columns: 1fr; }
}
@media (max-width: 520px) {
  body { font-size: 14px; }
  .dashboard-shell { width: min(100% - 24px, 1240px); padding-top: 18px; }
  .topbar { padding: 12px; }
  .nav { width: 100%; }
  .nav a { flex: 1 1 auto; text-align: center; }
  h1 { font-size: 30px; }
  .hero-main, .hero-side, .section, .tool-panel { padding: 14px; }
  .metric-grid { grid-template-columns: 1fr 1fr; }
  .actions .button, .actions button { width: 100%; text-align: center; justify-content: center; }
  .calendar { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media print {
  body { background: #fff; color: #000; }
  .topbar, .actions, .search-controls, .search-results, .site-footer, .unlock-panel, .nav, .archive-tools { display: none !important; }
  .dashboard-shell { width: 100%; padding: 0; }
  .hero-main, .hero-side, .section, .tool-panel, .metric, .signal-card, .archive-row { border-color: #999; background: #fff; color: #000; box-shadow: none; break-inside: avoid; }
  .field-body, .one-liner, .muted, .checklist, .source-list, .steps { color: #000; }
  a { color: #000; text-decoration: underline; }
}
`;

export function renderPage({ title, body, basePath = "/", script = "" }: PageOptions): string {
  const normalizedBase = basePath.endsWith("/") ? basePath : `${basePath}/`;
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <base href="${escapeHtml(normalizedBase)}">
  <title>${escapeHtml(title)}</title>
  <style>${css}</style>
</head>
<body>
  <header class="topbar">
    <a class="brand" href="./" aria-label="返回首页"><span class="brand-mark">YQ</span><span>YQN Daily Intelligence Portal<span class="brand-sub">Executive intelligence terminal</span></span></a>
    <nav class="nav" aria-label="主导航">
      <a href="./">首页</a>
      <a href="archive/">归档</a>
      <a href="./#search">搜索</a>
      <a href="./#calendar">日历</a>
    </nav>
  </header>
  ${body}
  <footer class="site-footer">
    <div class="footer-grid">
      <p>来源：公开信息采集、模型归纳和人工配置的来源表。更新时间以每篇日报生成时间为准。</p>
      <p>安全提醒：GitHub Pages 是公开网页，noindex 和 robots.txt 不是访问控制；不要放客户名单、报价、合同、内部成本、密钥或私密线索。</p>
    </div>
  </footer>
  ${script ? `<script>${script}</script>` : ""}
</body>
</html>`;
}

function countBySignal(brief: Brief): Record<"strong" | "medium" | "weak", number> {
  return brief.items.reduce((acc, item) => {
    acc[item.signal_strength] += 1;
    return acc;
  }, { strong: 0, medium: 0, weak: 0 });
}

function signalScore(brief: Brief): number {
  if (!brief.items.length) return brief.is_low_signal_day ? 12 : 30;
  const score = brief.items.reduce((sum, item) => {
    if (item.signal_strength === "strong") return sum + 92;
    if (item.signal_strength === "medium") return sum + 64;
    return sum + 34;
  }, 0) / brief.items.length;
  return Math.round(score);
}

function strengthLabel(value: BriefItem["signal_strength"]): string {
  return value === "strong" ? "强" : value === "medium" ? "中" : "弱";
}

function confidenceLabel(value: BriefItem["confidence"]): string {
  return value === "high" ? "高" : value === "medium" ? "中" : "低";
}

function topicsForBrief(brief: Brief): string {
  const topics = [...new Set(brief.items.map((item) => topicLabels[item.topic]))];
  return topics.length ? topics.join(" / ") : "低信号日";
}

function bossSummary(brief: Brief): string {
  const firstItems = brief.items.slice(0, 3).map((item, index) => `${index + 1}. ${item.title}`).join("\n");
  return `每日重点简报 · ${brief.date}\n${brief.one_liner}${firstItems ? `\n${firstItems}` : ""}\n链接：`;
}

function actionSummary(brief: Brief): string {
  return `今日行动清单 · ${brief.date}\n${brief.action_checklist.map((item, index) => `${index + 1}. ${item}`).join("\n")}`;
}

function shareSummary(brief: Brief, encrypted: boolean): string {
  if (encrypted) return `每日重点简报 · ${brief.date}\n${brief.one_liner}\n链接：`;
  return bossSummary(brief);
}

export function metricGrid(brief: Brief): string {
  const signals = countBySignal(brief);
  const topics = new Set(brief.items.map((item) => item.topic)).size;
  return `<div class="metric-grid">
    <div class="metric"><span class="metric-label">核心信号</span><span class="metric-value">${brief.items.length}</span></div>
    <div class="metric"><span class="metric-label">强 / 中 / 弱</span><span class="metric-value">${signals.strong}/${signals.medium}/${signals.weak}</span></div>
    <div class="metric"><span class="metric-label">主题覆盖</span><span class="metric-value">${topics || 0}</span></div>
    <div class="metric"><span class="metric-label">来源窗口</span><span class="metric-value">${brief.source_window_hours}h</span></div>
  </div>`;
}

function signalMeter(brief: Brief): string {
  const score = signalScore(brief);
  return `<div class="signal-meter">
    <div class="meter-track"><div class="meter-fill" style="--score:${score}%"></div></div>
    <div class="meter-label"><span>今日信号强度</span><strong>${score}/100</strong></div>
  </div>`;
}

function renderCompactSignal(item: BriefItem, reportDate: string): string {
  return `<article class="signal-card">
    <div class="item-head">
      <span class="badge">${escapeHtml(topicLabels[item.topic])}</span>
      <span class="badge ${escapeHtml(item.signal_strength)}">信号 ${escapeHtml(strengthLabel(item.signal_strength))}</span>
      <span class="badge">可信度 ${escapeHtml(confidenceLabel(item.confidence))}</span>
    </div>
    <a class="card-title" href="reports/${escapeHtml(reportDate)}/">${escapeHtml(item.title)}</a>
    <p class="field-body">${escapeHtml(item.today_action)}</p>
    <div class="signal-meta"><span>${escapeHtml(item.source_domain)}</span><span>${escapeHtml(item.source_published_at.slice(0, 10))}</span></div>
  </article>`;
}

export function renderItem(item: BriefItem): string {
  return `<article class="signal-card">
    <div class="item-head">
      <span class="badge">${escapeHtml(topicLabels[item.topic])}</span>
      <span class="badge ${escapeHtml(item.signal_strength)}">signal ${escapeHtml(strengthLabel(item.signal_strength))}</span>
      <span class="badge">confidence ${escapeHtml(confidenceLabel(item.confidence))}</span>
      <a class="source-link" href="${escapeHtml(item.source_url)}" rel="noreferrer">${escapeHtml(item.source_domain)}</a>
    </div>
    <h3>${escapeHtml(item.title)}</h3>
    <div class="intel-fields">
      <div class="field-block"><p class="field-label">发生了什么</p><p class="field-body">${escapeHtml(item.what_happened)}</p></div>
      <div class="field-block"><p class="field-label">为什么重要</p><p class="field-body">${escapeHtml(item.why_it_matters)}</p></div>
      <div class="field-block"><p class="field-label">对 YQN 的启发</p><p class="field-body">${escapeHtml(item.yqn_insight)}</p></div>
      <div class="field-block"><p class="field-label">今天可以做的动作</p><p class="field-body">${escapeHtml(item.today_action)}</p></div>
      <div class="field-block"><p class="field-label">来源</p><p class="field-body"><a class="source-link" href="${escapeHtml(item.source_url)}" rel="noreferrer">${escapeHtml(item.source_title)} · ${escapeHtml(item.source_domain)}</a></p></div>
    </div>
  </article>`;
}

function reportNav(previousDate?: string, nextDate?: string): string {
  return `<div class="nav-links">
    ${previousDate ? `<a class="nav-card" href="reports/${previousDate}/">← 上一天 ${escapeHtml(previousDate)}</a>` : `<span class="nav-card muted">没有上一天</span>`}
    ${nextDate ? `<a class="nav-card" href="reports/${nextDate}/">下一天 ${escapeHtml(nextDate)} →</a>` : `<span class="nav-card muted">没有下一天</span>`}
  </div>`;
}

export function renderBriefStatic(brief: Brief, previousDate?: string, nextDate?: string): string {
  const items = brief.items.length
    ? brief.items.map(renderItem).join("")
    : `<div class="empty">今天没有足够强信号。下一步：检查来源采集和 GitHub Actions 运行结果，不要把弱消息包装成机会。</div>`;
  return `<main class="dashboard-shell">
    <section class="hero">
      <div class="hero-main">
        <div>
          <p class="kicker">Daily Brief · ${escapeHtml(brief.date)}</p>
          <h1>每日重点简报</h1>
          <p class="one-liner">${escapeHtml(brief.one_liner)}</p>
          <div class="date-strip">
            <span class="chip">日期 ${escapeHtml(brief.date)}</span>
            <span class="chip">${brief.is_low_signal_day ? "低信号日" : "正常信号日"}</span>
            <span class="chip">生成 ${escapeHtml(brief.generated_at)}</span>
          </div>
        </div>
        <div class="actions">
          <button type="button" class="primary" onclick="navigator.clipboard?.writeText(location.href); this.textContent='已复制链接';">复制分享链接</button>
          <button type="button" onclick="window.print()">打印 / 保存 PDF</button>
          <button type="button" class="secondary" data-copy="${escapeHtml(bossSummary(brief))}" onclick="navigator.clipboard?.writeText((this.dataset.copy || '') + location.href); this.textContent='已复制老板版摘要';">复制老板版摘要</button>
          <button type="button" data-copy="${escapeHtml(actionSummary(brief))}" onclick="navigator.clipboard?.writeText(this.dataset.copy || ''); this.textContent='已复制行动清单';">复制今日行动清单</button>
        </div>
      </div>
      <aside class="hero-side">
        <h2>今日信号强度</h2>
        ${signalMeter(brief)}
        ${metricGrid(brief)}
        <div class="section">
          <h2>日期导航</h2>
          ${reportNav(previousDate, nextDate)}
        </div>
      </aside>
    </section>
    <section class="section">
      <h2>执行摘要</h2>
      <p class="field-body">${escapeHtml(brief.executive_summary)}</p>
    </section>
    <section class="grid">
      <div class="section">
        <h2>核心情报卡片</h2>
        <div class="item-list">${items}</div>
      </div>
      <aside class="section">
        <h2>今日行动清单</h2>
        <ol class="checklist">${brief.action_checklist.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>
        <h2 class="section-spacer">来源链接</h2>
        <ul class="source-list">${brief.sources.map((source) => `<li><a class="source-link" href="${escapeHtml(source.url)}" rel="noreferrer">${escapeHtml(source.title)} · ${escapeHtml(source.domain)}</a></li>`).join("")}</ul>
      </aside>
    </section>
  </main>`;
}

function monthArchiveLinks(briefs: Brief[]): string {
  const months = [...new Set(briefs.map((brief) => {
    const { year, month } = monthParts(brief.date);
    return `${year}/${month}`;
  }))].sort().reverse();
  return months.map((month) => `<a class="button" href="archive/${escapeHtml(month)}/">${escapeHtml(month)} 月</a>`).join("") || `<span class="muted">暂无月归档</span>`;
}

function weekArchiveLinks(briefs: Brief[]): string {
  const weeks = [...new Set(briefs.map((brief) => {
    const week = isoWeek(brief.date);
    return `${week.year}/week-${String(week.week).padStart(2, "0")}`;
  }))].sort().reverse();
  return weeks.map((week) => `<a class="button" href="archive/${escapeHtml(week)}/">${escapeHtml(week)}</a>`).join("") || `<span class="muted">暂无周归档</span>`;
}

function calendarGrid(briefs: Brief[]): string {
  return briefs.map((brief) => `<a href="reports/${brief.date}/">
    <strong>${escapeHtml(brief.date)}</strong><br>
    <span class="muted">${brief.items.length} 条 · ${brief.is_low_signal_day ? "低信号" : "正常"}</span>
  </a>`).join("") || `<div class="empty">暂无可点击日期。下一步：回到 Actions 手动生成第一篇日报。</div>`;
}

export function renderHome(latest: Brief | undefined, briefs: Brief[], encrypted: boolean): string {
  const latestSignals = encrypted
    ? `<div class="empty">加密模式已开启。核心信号标题、正文、行动建议和搜索索引需要输入访问密码后本地解锁。</div>`
    : latest?.items.slice(0, 5).map((item) => renderCompactSignal(item, latest.date)).join("") || `<div class="empty">暂无今日信号。下一步：配置 OpenAI API Key 和 OPENAI_MODEL 后，在 Actions 手动运行一次。</div>`;
  const recent = briefs.slice(0, 8).map((brief) => `<a class="archive-row" href="reports/${brief.date}/">
      <div class="archive-date"><strong>${escapeHtml(brief.date)}</strong><span class="badge ${brief.is_low_signal_day ? "low" : "strong"}">${brief.is_low_signal_day ? "低信号" : "有信号"}</span></div>
      <span class="muted">${escapeHtml(brief.one_liner)}</span>
      <span class="dim">${escapeHtml(topicsForBrief(brief))}</span>
    </a>`).join("") || `<div class="empty">暂无历史数据。下一步：到 Actions 手动生成样例或真实日报。</div>`;

  const latestBlock = latest
    ? `<section class="hero">
        <div class="hero-main">
          <div>
            <p class="kicker">YQN Intelligence Terminal</p>
            <h1>YQN Daily Intelligence Portal</h1>
            <p class="one-liner">${escapeHtml(latest.one_liner)}</p>
            <div class="date-strip">
              <span class="chip">今日日期 ${escapeHtml(latest.date)}</span>
              <span class="chip">${latest.is_low_signal_day ? "低信号日" : "正常信号日"}</span>
              <span class="chip">${encrypted ? "加密模式" : "公开模式"}</span>
            </div>
          </div>
          <div>
            <div class="split">
              <div class="mini-panel"><strong>今天怎么读</strong><ol class="steps"><li>先看一句话判断</li><li>再看核心信号</li><li>最后执行行动清单</li></ol></div>
              <div class="mini-panel"><strong>历史怎么查</strong><p class="muted">按日期、按月、按周、关键词和主题筛选回看。</p></div>
              <div class="mini-panel"><strong>给老板看</strong><p class="muted">复制今日链接，或进入日报页复制老板版摘要。</p></div>
            </div>
            <div class="actions">
              <a class="button primary" href="reports/${latest.date}/">阅读今日简报</a>
              <a class="button" href="archive/">历史归档</a>
              <button type="button" class="secondary" data-copy="${escapeHtml(shareSummary(latest, encrypted))}" onclick="navigator.clipboard?.writeText((this.dataset.copy || '') + location.href + 'reports/${latest.date}/'); this.textContent='已复制老板版入口';">复制给老板</button>
            </div>
          </div>
        </div>
        <aside class="hero-side ${encrypted ? "locked" : ""}">
          <h2>今日信号强度</h2>
          ${signalMeter(latest)}
          ${metricGrid(latest)}
          <p class="security-note">${encrypted ? "加密模式开启：完整日报和搜索索引需要浏览器本地解锁。" : "公开模式：页面可被任何知道链接的人打开，请不要发布敏感业务信息。"}</p>
        </aside>
      </section>`
    : `<section class="hero"><div class="hero-main"><p class="kicker">No Brief Yet</p><h1>YQN Daily Intelligence Portal</h1><p class="one-liner">还没有日报数据。下一步：配置 GitHub Secrets / Variables 后，到 Actions 手动触发 Daily Briefing Portal。</p></div></section>`;

  return `<main class="dashboard-shell">
    ${latestBlock}
    <section class="grid">
      <div class="section">
        <h2>今日核心信号</h2>
        <div class="item-list">${latestSignals}</div>
      </div>
      <aside class="section">
        <h2>历史入口</h2>
        <div class="item-list">${recent}</div>
        <div class="archive-tools">${monthArchiveLinks(briefs)}</div>
        <div class="archive-tools">${weekArchiveLinks(briefs)}</div>
      </aside>
    </section>
    <section class="section" id="search">
      <h2>搜索与主题筛选</h2>
      <p class="muted">输入关键词或选择主题，结果会直接指向对应日报。</p>
      <div class="search-controls">
        <input id="searchInput" type="search" placeholder="搜索：美国仓 / 小红书 / AI / 来源域名">
        <select id="topicFilter">
          <option value="">全部主题</option>
          ${Object.entries(topicLabels).map(([key, label]) => `<option value="${escapeHtml(key)}">${escapeHtml(label)}</option>`).join("")}
        </select>
        ${encrypted ? `<button id="unlockSearch" type="button">解锁搜索</button>` : `<button id="runSearch" type="button" class="primary">搜索</button>`}
      </div>
      ${encrypted ? `<div class="search-controls" style="margin-top:10px;"><input id="searchPassphrase" type="password" placeholder="输入页面访问密码，本地解密搜索索引"><button id="unlockSearch2" type="button" class="primary">解密</button></div>` : ""}
      <div id="searchStatus" class="muted" style="margin-top:10px;"></div>
      <div id="searchResults" class="search-results"></div>
    </section>
    <section class="section" id="calendar">
      <h2>日历视图</h2>
      <div class="calendar">${calendarGrid(briefs)}</div>
    </section>
  </main>`;
}

export function browserDecryptAndSearchScript(): string {
  return `
const topicLabels = ${jsonForScript(topicLabels)};
function htmlEscape(value) {
  return String(value || '').replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function b64ToBytes(value) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}
async function decryptPayload(payload, passphrase) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: b64ToBytes(payload.salt), iterations: payload.iterations }, material, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBytes(payload.iv) }, key, b64ToBytes(payload.ciphertext));
  return JSON.parse(new TextDecoder().decode(plaintext));
}
let searchEntries = [];
let searchLocked = false;
async function loadSearchIndex(passphrase) {
  const status = document.getElementById('searchStatus');
  try {
    const data = await fetch('search-index.json', { cache: 'no-store' }).then((response) => response.json());
    if (data.encrypted) {
      searchLocked = true;
      if (!passphrase) {
        status.textContent = '搜索索引已加密。输入页面访问密码后，浏览器会在本地解密。';
        return;
      }
      searchEntries = await decryptPayload(data.payload, passphrase);
      status.textContent = '搜索索引已解锁。';
    } else {
      searchEntries = data;
      status.textContent = searchEntries.length ? '搜索索引已加载。' : '暂无可搜索历史。';
    }
    runSearch();
  } catch (error) {
    status.textContent = searchLocked ? '密码错误或搜索索引无法解密。' : '搜索索引加载失败。';
  }
}
function renderResults(results) {
  const root = document.getElementById('searchResults');
  if (!root) return;
  root.innerHTML = results.length ? results.map((entry) => '<a class="result-row" href="' + htmlEscape(entry.url || ('reports/' + entry.date + '/')) + '"><strong>' + htmlEscape(entry.title || entry.one_liner) + '</strong><span class="muted">' + htmlEscape(entry.date) + ' · ' + htmlEscape(topicLabels[entry.topic] || entry.topic || '日报') + ' · ' + htmlEscape(entry.source_domain || '') + '</span></a>').join('') : '<div class="empty">没有匹配结果。下一步：换一个关键词，或切回“全部主题”。</div>';
}
function runSearch() {
  const q = document.getElementById('searchInput')?.value.trim().toLowerCase() || '';
  const topic = document.getElementById('topicFilter')?.value || '';
  if (!searchEntries.length) {
    renderResults([]);
    return;
  }
  const results = searchEntries.filter((entry) => {
    const matchTopic = !topic || entry.topic === topic;
    const haystack = entry.search_text || '';
    return matchTopic && (!q || haystack.toLowerCase().includes(q));
  }).slice(0, 30);
  renderResults(results);
}
document.getElementById('runSearch')?.addEventListener('click', runSearch);
document.getElementById('searchInput')?.addEventListener('input', runSearch);
document.getElementById('topicFilter')?.addEventListener('change', runSearch);
async function unlockSearch() {
  const passphrase = document.getElementById('searchPassphrase')?.value || '';
  await loadSearchIndex(passphrase);
  runSearch();
}
document.getElementById('unlockSearch')?.addEventListener('click', unlockSearch);
document.getElementById('unlockSearch2')?.addEventListener('click', unlockSearch);
loadSearchIndex();
`;
}

export function lockedReportScript(): string {
  return `
function htmlEscape(value) {
  return String(value || '').replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function b64ToBytes(value) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}
async function decryptPayload(payload, passphrase) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: b64ToBytes(payload.salt), iterations: payload.iterations }, material, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBytes(payload.iv) }, key, b64ToBytes(payload.ciphertext));
  return JSON.parse(new TextDecoder().decode(plaintext));
}
const topicLabels = ${jsonForScript(topicLabels)};
function renderItem(item) {
  return '<article class="signal-card"><div class="item-head"><span class="badge">' + htmlEscape(topicLabels[item.topic]) + '</span><span class="badge ' + htmlEscape(item.signal_strength) + '">signal ' + htmlEscape(item.signal_strength) + '</span><span class="badge">confidence ' + htmlEscape(item.confidence) + '</span><a class="source-link" href="' + htmlEscape(item.source_url) + '" rel="noreferrer">' + htmlEscape(item.source_domain) + '</a></div><h3>' + htmlEscape(item.title) + '</h3><div class="intel-fields"><div class="field-block"><p class="field-label">发生了什么</p><p class="field-body">' + htmlEscape(item.what_happened) + '</p></div><div class="field-block"><p class="field-label">为什么重要</p><p class="field-body">' + htmlEscape(item.why_it_matters) + '</p></div><div class="field-block"><p class="field-label">对 YQN 的启发</p><p class="field-body">' + htmlEscape(item.yqn_insight) + '</p></div><div class="field-block"><p class="field-label">今天可以做的动作</p><p class="field-body">' + htmlEscape(item.today_action) + '</p></div><div class="field-block"><p class="field-label">来源</p><p class="field-body"><a class="source-link" href="' + htmlEscape(item.source_url) + '" rel="noreferrer">' + htmlEscape(item.source_title) + ' · ' + htmlEscape(item.source_domain) + '</a></p></div></div></article>';
}
function renderBrief(brief) {
  const root = document.getElementById('briefRoot');
  const items = brief.items.length ? brief.items.map(renderItem).join('') : '<div class="empty">今天没有足够强信号。下一步：检查来源采集和 GitHub Actions 运行结果。</div>';
  root.innerHTML = '<section class="section"><h2>执行摘要</h2><p class="field-body">' + htmlEscape(brief.executive_summary) + '</p></section><section class="grid"><div class="section"><h2>核心情报卡片</h2><div class="item-list">' + items + '</div></div><aside class="section"><h2>今日行动清单</h2><ol class="checklist">' + brief.action_checklist.map((item) => '<li>' + htmlEscape(item) + '</li>').join('') + '</ol><h2 class="section-spacer">来源链接</h2><ul class="source-list">' + brief.sources.map((source) => '<li><a class="source-link" href="' + htmlEscape(source.url) + '" rel="noreferrer">' + htmlEscape(source.title) + ' · ' + htmlEscape(source.domain) + '</a></li>').join('') + '</ul></aside></section>';
}
async function unlockBrief() {
  const status = document.getElementById('unlockStatus');
  try {
    const passphrase = document.getElementById('passphrase').value || '';
    const data = await fetch(new URL('brief.json', location.href), { cache: 'no-store' }).then((response) => response.json());
    const brief = await decryptPayload(data.payload, passphrase);
    renderBrief(brief);
    document.getElementById('lockedPanel').style.display = 'none';
    status.textContent = '已解锁，正文只在当前浏览器本地显示。';
  } catch (error) {
    status.textContent = '密码错误或日报无法解密。正文仍未显示。';
  }
}
document.getElementById('unlockBrief')?.addEventListener('click', unlockBrief);
document.getElementById('passphrase')?.addEventListener('keydown', (event) => { if (event.key === 'Enter') unlockBrief(); });
`;
}

export function renderLockedReport(brief: Brief, previousDate?: string, nextDate?: string): string {
  return `<main class="dashboard-shell">
    <section class="hero">
      <div class="hero-main">
        <div>
          <p class="kicker">Encrypted Daily Brief · ${escapeHtml(brief.date)}</p>
          <h1>每日重点简报</h1>
          <p class="one-liner">${escapeHtml(brief.one_liner)}</p>
          <div class="date-strip">
            <span class="chip">日期 ${escapeHtml(brief.date)}</span>
            <span class="chip">客户端加密</span>
            <span class="chip">${brief.is_low_signal_day ? "低信号日" : "正常信号日"}</span>
          </div>
        </div>
        <div class="actions">
          <button type="button" class="primary" onclick="navigator.clipboard?.writeText(location.href); this.textContent='已复制链接';">复制分享链接</button>
          <button type="button" onclick="window.print()">打印 / 保存 PDF</button>
        </div>
      </div>
      <aside class="hero-side locked">
        <h2>加密状态</h2>
        <p class="security-note">完整日报、来源和搜索索引已加密发布。密码只在浏览器本地用于解锁；这不是企业级登录系统。</p>
        ${reportNav(previousDate, nextDate)}
      </aside>
    </section>
    <section class="section unlock-panel locked" id="lockedPanel">
      <p class="kicker">Secure Client Unlock</p>
      <h2>输入访问密码</h2>
      <p class="muted">输错密码不会显示正文。公开页面只保留站点名称、日期和有限预览。</p>
      <div class="search-controls" style="margin-top:12px;">
        <input id="passphrase" type="password" placeholder="输入页面访问密码">
        <button id="unlockBrief" type="button" class="primary">解锁日报</button>
      </div>
      <p id="unlockStatus" class="muted" style="margin-top:10px;">等待输入密码。</p>
    </section>
    <div id="briefRoot"></div>
  </main>`;
}

export function renderArchivePage(title: string, briefs: Brief[]): string {
  const rows = briefs.map((brief) => `<a class="archive-row" href="reports/${brief.date}/">
    <div class="archive-date"><strong>${escapeHtml(brief.date)}</strong><span class="badge ${brief.is_low_signal_day ? "low" : "strong"}">${brief.is_low_signal_day ? "低信号日" : "正常信号日"}</span></div>
    <span class="field-body">${escapeHtml(brief.one_liner)}</span>
    <span class="dim">${escapeHtml(topicsForBrief(brief))}</span>
  </a>`).join("") || `<div class="empty">暂无历史数据。下一步：到 Actions 手动生成样例或真实日报。</div>`;
  return `<main class="dashboard-shell">
    <section class="hero">
      <div class="hero-main">
        <p class="kicker">Archive Intelligence</p>
        <h1>${escapeHtml(title)}</h1>
        <p class="one-liner">按日期倒序查看永久日报；也可以切到月视图或周视图，快速回看某段时间的判断变化。</p>
        <div class="archive-tools">
          <a class="button primary" href="archive/">全部历史</a>
          ${monthArchiveLinks(briefs)}
          ${weekArchiveLinks(briefs)}
        </div>
      </div>
      <aside class="hero-side">
        <h2>归档说明</h2>
        <ol class="steps">
          <li>按日期：直接进入某一天日报。</li>
          <li>按月：查看当月所有日报。</li>
          <li>按周：复盘一周内信号密度。</li>
        </ol>
      </aside>
    </section>
    <section class="grid">
      <div class="section">
        <h2>历史卡片</h2>
        <div class="item-list">${rows}</div>
      </div>
      <aside class="section">
        <h2>日历视图</h2>
        <div class="calendar">${calendarGrid(briefs)}</div>
      </aside>
    </section>
  </main>`;
}

export function topicFromEntry(item?: { topic?: Topic }): Topic | "" {
  return item?.topic || "";
}
