import { Brief, BriefItem, topicLabels, Topic } from "../schema.js";

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
  --bg: #0a0d12;
  --panel: #111722;
  --panel-2: #151d2a;
  --line: #243044;
  --muted: #8ea0b8;
  --text: #edf3ff;
  --soft: #c8d4e8;
  --accent: #27e0a3;
  --accent-2: #5bbcff;
  --warn: #f6c96b;
  --danger: #ff6b7a;
  --radius: 8px;
}
* { box-sizing: border-box; }
html { min-height: 100%; background: var(--bg); }
body {
  margin: 0;
  min-height: 100%;
  background:
    linear-gradient(180deg, rgba(39, 224, 163, 0.08), transparent 320px),
    repeating-linear-gradient(90deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 84px),
    var(--bg);
  color: var(--text);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  line-height: 1.55;
}
a { color: inherit; text-decoration: none; }
.topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px clamp(16px, 4vw, 44px);
  border-bottom: 1px solid rgba(255,255,255,0.08);
  background: rgba(10, 13, 18, 0.86);
  backdrop-filter: blur(16px);
}
.brand { display: flex; align-items: center; gap: 10px; font-weight: 700; letter-spacing: 0; }
.brand-mark {
  width: 24px;
  height: 24px;
  border: 1px solid rgba(39, 224, 163, 0.8);
  border-radius: 6px;
  display: grid;
  place-items: center;
  color: var(--accent);
  font-size: 12px;
}
.nav { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
.nav a, .button, button {
  border: 1px solid var(--line);
  border-radius: 7px;
  background: rgba(17, 23, 34, 0.9);
  color: var(--text);
  min-height: 38px;
  padding: 8px 12px;
  font: inherit;
  cursor: pointer;
}
.button.primary, button.primary { border-color: rgba(39,224,163,0.65); background: rgba(39,224,163,0.12); }
.button:hover, button:hover, .nav a:hover { border-color: var(--accent-2); }
.dashboard-shell { width: min(1180px, calc(100% - 32px)); margin: 0 auto; padding: 28px 0 56px; }
.hero {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(280px, 0.6fr);
  gap: 20px;
  align-items: stretch;
  padding: 24px 0 12px;
}
.hero h1, h1 { margin: 0; font-size: clamp(28px, 4vw, 52px); line-height: 1.05; letter-spacing: 0; }
.eyebrow { color: var(--accent); font-size: 13px; text-transform: uppercase; letter-spacing: 0; margin: 0 0 10px; }
.one-liner { font-size: clamp(18px, 2vw, 24px); color: var(--soft); margin: 16px 0 0; max-width: 860px; }
.terminal-panel, .section {
  border: 1px solid var(--line);
  background: linear-gradient(180deg, rgba(21,29,42,0.92), rgba(12,17,25,0.94));
  border-radius: var(--radius);
  padding: 18px;
}
.terminal-panel { min-height: 100%; }
.metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 16px 0 0; }
.metric {
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 7px;
  padding: 12px;
  background: rgba(255,255,255,0.035);
}
.metric-label { color: var(--muted); font-size: 12px; }
.metric-value { display: block; margin-top: 4px; font-size: 22px; font-weight: 700; }
.actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; }
.grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(300px, 0.42fr); gap: 18px; align-items: start; }
.section { margin-top: 18px; }
.section h2 { margin: 0 0 12px; font-size: 20px; }
.section h3 { margin: 0 0 8px; font-size: 16px; }
.item-list { display: grid; gap: 14px; }
.intel-item {
  border-left: 3px solid var(--accent-2);
  padding: 14px 14px 14px 16px;
  background: rgba(255,255,255,0.035);
  border-radius: 0 7px 7px 0;
}
.item-head { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 8px; }
.badge {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 3px 8px;
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 999px;
  color: var(--soft);
  font-size: 12px;
}
.badge.strong { color: var(--accent); border-color: rgba(39,224,163,0.55); }
.badge.medium { color: var(--warn); border-color: rgba(246,201,107,0.5); }
.badge.weak { color: var(--muted); }
.intel-item h3 { margin: 0 0 10px; font-size: 18px; }
.intel-fields { display: grid; gap: 10px; }
.field-label { color: var(--accent-2); font-size: 12px; margin: 0 0 2px; }
.field-body { margin: 0; color: var(--soft); }
.source-link { color: var(--accent); overflow-wrap: anywhere; }
.checklist, .archive-list, .source-list { margin: 0; padding-left: 20px; color: var(--soft); }
.checklist li, .archive-list li, .source-list li { margin: 6px 0; }
.search-controls { display: grid; grid-template-columns: minmax(0, 1fr) 220px auto; gap: 10px; }
input, select {
  width: 100%;
  min-height: 40px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: rgba(6, 9, 14, 0.8);
  color: var(--text);
  padding: 8px 10px;
  font: inherit;
}
.search-results { display: grid; gap: 10px; margin-top: 14px; }
.result-row, .archive-row {
  display: grid;
  gap: 4px;
  padding: 12px;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 7px;
  background: rgba(255,255,255,0.03);
}
.calendar {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
  gap: 8px;
}
.calendar a { border: 1px solid var(--line); border-radius: 7px; padding: 9px; color: var(--soft); background: rgba(255,255,255,0.03); }
.calendar a:hover { border-color: var(--accent); color: var(--text); }
.muted { color: var(--muted); }
.empty { color: var(--muted); padding: 14px; border: 1px dashed var(--line); border-radius: 7px; }
.locked { border-color: rgba(246,201,107,0.55); }
.site-footer { width: min(1180px, calc(100% - 32px)); margin: 0 auto; padding: 24px 0 36px; color: var(--muted); font-size: 13px; border-top: 1px solid rgba(255,255,255,0.08); }
@media (max-width: 820px) {
  .topbar { align-items: flex-start; flex-direction: column; }
  .hero, .grid { grid-template-columns: 1fr; }
  .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .search-controls { grid-template-columns: 1fr; }
}
@media print {
  body { background: #fff; color: #000; }
  .topbar, .actions, .search-controls, .search-results, .site-footer, .unlock-panel, .nav { display: none !important; }
  .dashboard-shell { width: 100%; padding: 0; }
  .section, .terminal-panel, .metric, .intel-item { border-color: #999; background: #fff; color: #000; break-inside: avoid; }
  .field-body, .one-liner, .muted, .checklist, .source-list { color: #000; }
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
    <a class="brand" href="./"><span class="brand-mark">YQ</span><span>YQN Daily Intelligence Portal</span></a>
    <nav class="nav">
      <a href="./">首页</a>
      <a href="archive/">归档</a>
      <a href="./#search">搜索</a>
      <a href="./#calendar">日历</a>
    </nav>
  </header>
  ${body}
  <footer class="site-footer">Public GitHub Pages surface. Do not publish customer lists, quotes, contracts, internal cost, secrets, or private data.</footer>
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

export function metricGrid(brief: Brief): string {
  const signals = countBySignal(brief);
  const topics = new Set(brief.items.map((item) => item.topic)).size;
  return `<div class="metric-grid">
    <div class="metric"><span class="metric-label">核心动态</span><span class="metric-value">${brief.items.length}</span></div>
    <div class="metric"><span class="metric-label">强 / 中 / 弱</span><span class="metric-value">${signals.strong}/${signals.medium}/${signals.weak}</span></div>
    <div class="metric"><span class="metric-label">主题覆盖</span><span class="metric-value">${topics}</span></div>
    <div class="metric"><span class="metric-label">来源窗口</span><span class="metric-value">${brief.source_window_hours}h</span></div>
  </div>`;
}

export function renderItem(item: BriefItem): string {
  return `<article class="intel-item">
    <div class="item-head">
      <span class="badge">${escapeHtml(topicLabels[item.topic])}</span>
      <span class="badge ${escapeHtml(item.signal_strength)}">signal: ${escapeHtml(item.signal_strength)}</span>
      <span class="badge">confidence: ${escapeHtml(item.confidence)}</span>
    </div>
    <h3>${escapeHtml(item.title)}</h3>
    <div class="intel-fields">
      <div><p class="field-label">发生了什么</p><p class="field-body">${escapeHtml(item.what_happened)}</p></div>
      <div><p class="field-label">为什么重要</p><p class="field-body">${escapeHtml(item.why_it_matters)}</p></div>
      <div><p class="field-label">YQN 启发</p><p class="field-body">${escapeHtml(item.yqn_insight)}</p></div>
      <div><p class="field-label">今天动作</p><p class="field-body">${escapeHtml(item.today_action)}</p></div>
      <div><p class="field-label">来源</p><p class="field-body"><a class="source-link" href="${escapeHtml(item.source_url)}" rel="noreferrer">${escapeHtml(item.source_title)} · ${escapeHtml(item.source_domain)}</a></p></div>
    </div>
  </article>`;
}

export function renderBriefStatic(brief: Brief, previousDate?: string, nextDate?: string): string {
  const nav = `<div class="actions">
    ${previousDate ? `<a class="button" href="reports/${previousDate}/">上一天</a>` : ""}
    ${nextDate ? `<a class="button" href="reports/${nextDate}/">下一天</a>` : ""}
    <button type="button" onclick="navigator.clipboard?.writeText(location.href); this.textContent='已复制链接';">复制分享链接</button>
    <button type="button" onclick="window.print()">打印 / 保存 PDF</button>
  </div>`;
  const items = brief.items.length
    ? brief.items.map(renderItem).join("")
    : `<div class="empty">今天没有足够强信号，未生成核心动态条目。</div>`;
  return `<main class="dashboard-shell">
    <section class="hero">
      <div>
        <p class="eyebrow">Daily Brief · ${escapeHtml(brief.date)}</p>
        <h1>YQN Daily Intelligence Portal</h1>
        <p class="one-liner">${escapeHtml(brief.one_liner)}</p>
        ${nav}
      </div>
      <aside class="terminal-panel">
        <h2>今日信号强度概览</h2>
        ${metricGrid(brief)}
        <p class="muted">生成时间：${escapeHtml(brief.generated_at)}</p>
      </aside>
    </section>
    <section class="section">
      <h2>执行摘要</h2>
      <p class="field-body">${escapeHtml(brief.executive_summary)}</p>
    </section>
    <section class="grid">
      <div class="section">
        <h2>核心动态</h2>
        <div class="item-list">${items}</div>
      </div>
      <aside class="section">
        <h2>今日行动清单</h2>
        <ol class="checklist">${brief.action_checklist.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>
        <h2 style="margin-top:18px;">来源</h2>
        <ul class="source-list">${brief.sources.map((source) => `<li><a class="source-link" href="${escapeHtml(source.url)}" rel="noreferrer">${escapeHtml(source.title)} · ${escapeHtml(source.domain)}</a></li>`).join("")}</ul>
      </aside>
    </section>
  </main>`;
}

export function renderHome(latest: Brief | undefined, briefs: Brief[], encrypted: boolean): string {
  const latestBlock = latest
    ? `<section class="hero">
        <div>
          <p class="eyebrow">Latest · ${escapeHtml(latest.date)}</p>
          <h1>YQN Daily Intelligence Portal</h1>
          <p class="one-liner">${escapeHtml(latest.one_liner)}</p>
          <div class="actions">
            <a class="button primary" href="reports/${latest.date}/">阅读今日简报</a>
            <a class="button" href="archive/">查看历史归档</a>
          </div>
        </div>
        <aside class="terminal-panel ${encrypted ? "locked" : ""}">
          <h2>今日信号强度概览</h2>
          ${metricGrid(latest)}
          <p class="muted">${encrypted ? "加密模式开启：完整日报、历史正文和搜索索引需要浏览器本地解密。" : "公开模式：完整日报内容会发布到 GitHub Pages。"}</p>
        </aside>
      </section>`
    : `<section class="hero"><div><p class="eyebrow">No Brief Yet</p><h1>YQN Daily Intelligence Portal</h1><p class="one-liner">还没有日报数据。配置 GitHub Secrets 后，可手动触发 Daily Briefing Portal 生成第一篇。</p></div></section>`;

  const recent = briefs.slice(0, 12).map((brief) => `<a class="archive-row" href="reports/${brief.date}/">
      <strong>${escapeHtml(brief.date)}</strong>
      <span class="muted">${escapeHtml(brief.one_liner)}</span>
    </a>`).join("") || `<div class="empty">暂无历史数据。</div>`;

  const calendar = briefs.map((brief) => `<a href="reports/${brief.date}/"><strong>${escapeHtml(brief.date)}</strong><br><span class="muted">${brief.items.length} items</span></a>`).join("") || `<div class="empty">暂无可点击日期。</div>`;

  return `<main class="dashboard-shell">
    ${latestBlock}
    <section class="grid">
      <div class="section" id="search">
        <h2>关键词搜索</h2>
        <div class="search-controls">
          <input id="searchInput" type="search" placeholder="搜索 title / one_liner / why_it_matters / yqn_insight / source_domain">
          <select id="topicFilter">
            <option value="">全部主题</option>
            ${Object.entries(topicLabels).map(([key, label]) => `<option value="${escapeHtml(key)}">${escapeHtml(label)}</option>`).join("")}
          </select>
          ${encrypted ? `<button id="unlockSearch" type="button">解锁搜索</button>` : `<button id="runSearch" type="button">搜索</button>`}
        </div>
        ${encrypted ? `<div class="search-controls" style="margin-top:10px;"><input id="searchPassphrase" type="password" placeholder="输入访问密码，本地解密 search-index"><button id="unlockSearch2" type="button">解密</button></div>` : ""}
        <div id="searchStatus" class="muted" style="margin-top:10px;"></div>
        <div id="searchResults" class="search-results"></div>
      </div>
      <aside class="section">
        <h2>最近历史</h2>
        <div class="item-list">${recent}</div>
      </aside>
    </section>
    <section class="section" id="calendar">
      <h2>日历视图</h2>
      <div class="calendar">${calendar}</div>
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
        status.textContent = '搜索索引已加密，请输入密码后本地解密。';
        return;
      }
      searchEntries = await decryptPayload(data.payload, passphrase);
      status.textContent = '搜索索引已解锁。';
    } else {
      searchEntries = data;
      status.textContent = searchEntries.length ? '搜索索引已加载。' : '暂无可搜索历史。';
    }
  } catch (error) {
    status.textContent = searchLocked ? '密码错误或搜索索引无法解密。' : '搜索索引加载失败。';
  }
}
function runSearch() {
  const q = document.getElementById('searchInput')?.value.trim().toLowerCase() || '';
  const topic = document.getElementById('topicFilter')?.value || '';
  const root = document.getElementById('searchResults');
  if (!root) return;
  if (!searchEntries.length) {
    root.innerHTML = '<div class="empty">暂无搜索数据。</div>';
    return;
  }
  const results = searchEntries.filter((entry) => {
    const matchTopic = !topic || entry.topic === topic;
    const haystack = entry.search_text || '';
    return matchTopic && (!q || haystack.toLowerCase().includes(q));
  }).slice(0, 30);
  root.innerHTML = results.length ? results.map((entry) => '<a class="result-row" href="reports/' + htmlEscape(entry.date) + '/"><strong>' + htmlEscape(entry.title || entry.one_liner) + '</strong><span class="muted">' + htmlEscape(entry.date) + ' · ' + htmlEscape(topicLabels[entry.topic] || entry.topic || '日报') + ' · ' + htmlEscape(entry.source_domain || '') + '</span></a>').join('') : '<div class="empty">没有匹配结果。</div>';
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
  return '<article class="intel-item"><div class="item-head"><span class="badge">' + htmlEscape(topicLabels[item.topic]) + '</span><span class="badge ' + htmlEscape(item.signal_strength) + '">signal: ' + htmlEscape(item.signal_strength) + '</span><span class="badge">confidence: ' + htmlEscape(item.confidence) + '</span></div><h3>' + htmlEscape(item.title) + '</h3><div class="intel-fields"><div><p class="field-label">发生了什么</p><p class="field-body">' + htmlEscape(item.what_happened) + '</p></div><div><p class="field-label">为什么重要</p><p class="field-body">' + htmlEscape(item.why_it_matters) + '</p></div><div><p class="field-label">YQN 启发</p><p class="field-body">' + htmlEscape(item.yqn_insight) + '</p></div><div><p class="field-label">今天动作</p><p class="field-body">' + htmlEscape(item.today_action) + '</p></div><div><p class="field-label">来源</p><p class="field-body"><a class="source-link" href="' + htmlEscape(item.source_url) + '" rel="noreferrer">' + htmlEscape(item.source_title) + ' · ' + htmlEscape(item.source_domain) + '</a></p></div></div></article>';
}
function renderBrief(brief) {
  const root = document.getElementById('briefRoot');
  const items = brief.items.length ? brief.items.map(renderItem).join('') : '<div class="empty">今天没有足够强信号，未生成核心动态条目。</div>';
  root.innerHTML = '<section class="section"><h2>执行摘要</h2><p class="field-body">' + htmlEscape(brief.executive_summary) + '</p></section><section class="grid"><div class="section"><h2>核心动态</h2><div class="item-list">' + items + '</div></div><aside class="section"><h2>今日行动清单</h2><ol class="checklist">' + brief.action_checklist.map((item) => '<li>' + htmlEscape(item) + '</li>').join('') + '</ol><h2 style="margin-top:18px;">来源</h2><ul class="source-list">' + brief.sources.map((source) => '<li><a class="source-link" href="' + htmlEscape(source.url) + '" rel="noreferrer">' + htmlEscape(source.title) + ' · ' + htmlEscape(source.domain) + '</a></li>').join('') + '</ul></aside></section>';
}
async function unlockBrief() {
  const status = document.getElementById('unlockStatus');
  try {
    const passphrase = document.getElementById('passphrase').value || '';
    const data = await fetch('brief.json', { cache: 'no-store' }).then((response) => response.json());
    const brief = await decryptPayload(data.payload, passphrase);
    renderBrief(brief);
    document.getElementById('lockedPanel').style.display = 'none';
    status.textContent = '已解锁。';
  } catch (error) {
    status.textContent = '密码错误或日报无法解密。';
  }
}
document.getElementById('unlockBrief')?.addEventListener('click', unlockBrief);
document.getElementById('passphrase')?.addEventListener('keydown', (event) => { if (event.key === 'Enter') unlockBrief(); });
`;
}

export function renderLockedReport(brief: Brief, previousDate?: string, nextDate?: string): string {
  const nav = `<div class="actions">
    ${previousDate ? `<a class="button" href="reports/${previousDate}/">上一天</a>` : ""}
    ${nextDate ? `<a class="button" href="reports/${nextDate}/">下一天</a>` : ""}
    <button type="button" onclick="navigator.clipboard?.writeText(location.href); this.textContent='已复制链接';">复制分享链接</button>
    <button type="button" onclick="window.print()">打印 / 保存 PDF</button>
  </div>`;
  return `<main class="dashboard-shell">
    <section class="hero">
      <div>
        <p class="eyebrow">Encrypted Daily Brief · ${escapeHtml(brief.date)}</p>
        <h1>YQN Daily Intelligence Portal</h1>
        <p class="one-liner">${escapeHtml(brief.one_liner)}</p>
        ${nav}
      </div>
      <aside class="terminal-panel locked">
        <h2>加密内容</h2>
        <p class="muted">完整日报、来源和历史正文已加密发布。密码只在浏览器本地用于 WebCrypto 解密，不会发送到服务器。</p>
      </aside>
    </section>
    <section class="section unlock-panel locked" id="lockedPanel">
      <h2>输入访问密码</h2>
      <div class="search-controls">
        <input id="passphrase" type="password" placeholder="PAGE_ACCESS_PASSPHRASE">
        <button id="unlockBrief" type="button" class="primary">解锁日报</button>
      </div>
      <p id="unlockStatus" class="muted">公开页只显示站点名称、日期和有限预览。</p>
    </section>
    <div id="briefRoot"></div>
  </main>`;
}

export function renderArchivePage(title: string, briefs: Brief[]): string {
  const rows = briefs.map((brief) => `<a class="archive-row" href="reports/${brief.date}/">
    <strong>${escapeHtml(brief.date)}</strong>
    <span class="muted">${escapeHtml(brief.one_liner)}</span>
  </a>`).join("") || `<div class="empty">暂无历史数据。</div>`;
  return `<main class="dashboard-shell">
    <section class="hero"><div><p class="eyebrow">Archive</p><h1>${escapeHtml(title)}</h1><p class="one-liner">按日期倒序查看所有永久日报链接。</p></div></section>
    <section class="section"><div class="item-list">${rows}</div></section>
  </main>`;
}

export function topicFromEntry(item?: { topic?: Topic }): Topic | "" {
  return item?.topic || "";
}
