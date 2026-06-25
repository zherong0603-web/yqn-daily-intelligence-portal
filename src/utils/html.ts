import type { PublicSetupStatus } from "../config.js";
import { Brief, BriefItem, topicLabels, Topic } from "../schema.js";
import { isoWeek, monthParts } from "./date.js";

export interface PageOptions {
  title: string;
  body: string;
  basePath?: string;
  script?: string;
}

const repoUrl = "https://github.com/zherong0603-web/yqn-daily-intelligence-portal";
const pagesUrl = "https://zherong0603-web.github.io/yqn-daily-intelligence-portal/";
const actionsUrl = `${repoUrl}/actions/workflows/daily-briefing.yml`;
const secretsUrl = `${repoUrl}/settings/secrets/actions`;
const variablesUrl = `${repoUrl}/settings/variables/actions`;
const openAiKeyUrl = "https://platform.openai.com/api-keys";
const openAiModelsUrl = "https://platform.openai.com/docs/models";

const defaultSetupStatus: PublicSetupStatus = {
  openAiApiKeyConfigured: false,
  openAiModelConfigured: false,
  feishuWebhookConfigured: false,
  pageAccessPassphraseConfigured: false,
  encryptionEnabled: false,
  openAiWebSearchEnabled: false,
  maxSearchCalls: 0,
};

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
    const pathname = new URL(siteUrl).pathname.replace(/\/$/, "");
    return pathname || "/";
  } catch {
    return "/";
  }
}

const css = `
:root {
  color-scheme: light;
  --bg: #f4f7fb;
  --paper: #ffffff;
  --panel: #ffffff;
  --panel-soft: #f7faff;
  --line: #dce6f3;
  --line-strong: #b9cae3;
  --text: #142033;
  --soft: #33445c;
  --muted: #718198;
  --blue: #126bff;
  --blue-dark: #0754d8;
  --cyan: #00a7c8;
  --gold: #f59e0b;
  --green: #0f9f6e;
  --orange: #f97316;
  --red: #dc2626;
  --radius: 8px;
  --shadow: 0 18px 45px rgba(32, 73, 128, 0.12);
  --shadow-soft: 0 8px 22px rgba(32, 73, 128, 0.08);
}
* { box-sizing: border-box; }
html { min-height: 100%; background: var(--bg); scroll-behavior: smooth; }
body {
  margin: 0;
  min-height: 100%;
  color: var(--text);
  background:
    linear-gradient(135deg, rgba(18, 107, 255, 0.08) 0 18%, transparent 18% 100%),
    linear-gradient(180deg, #f7fbff 0%, #eef4fb 42%, #f7f9fc 100%);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 15px;
  line-height: 1.6;
}
a { color: inherit; text-decoration: none; }
button, input, select { font: inherit; }
a:focus-visible, button:focus-visible, input:focus-visible, select:focus-visible, summary:focus-visible {
  outline: 2px solid var(--blue);
  outline-offset: 3px;
}
.topbar {
  position: sticky;
  top: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px clamp(18px, 4vw, 56px);
  border-bottom: 1px solid rgba(220, 230, 243, 0.92);
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(18px);
  box-shadow: 0 8px 24px rgba(32, 73, 128, 0.07);
}
.brand { display: flex; align-items: center; gap: 10px; font-weight: 860; }
.brand-mark {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(18, 107, 255, 0.2);
  border-radius: 8px;
  color: #ffffff;
  background: linear-gradient(135deg, #126bff, #00a7c8);
  font-size: 12px;
  box-shadow: 0 10px 20px rgba(18, 107, 255, 0.2);
}
.brand-sub { display: block; color: var(--muted); font-size: 11px; line-height: 1.1; font-weight: 560; }
.nav { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
.button, button, .nav a {
  min-height: 40px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #ffffff;
  color: var(--text);
  padding: 9px 14px;
  cursor: pointer;
  font-weight: 720;
  transition: border-color 140ms ease, background 140ms ease, color 140ms ease, transform 140ms ease, box-shadow 140ms ease;
}
.button:hover, button:hover, .nav a:hover { border-color: rgba(18, 107, 255, 0.48); background: #f2f7ff; color: var(--blue-dark); box-shadow: var(--shadow-soft); }
.button:active, button:active { transform: translateY(1px); }
.primary { border-color: var(--blue); background: linear-gradient(135deg, #126bff, #0754d8); color: #ffffff; box-shadow: 0 12px 25px rgba(18, 107, 255, 0.2); }
.primary:hover { color: #ffffff; background: linear-gradient(135deg, #0d5de8, #0649bd); }
.gold { border-color: rgba(245, 158, 11, 0.5); background: #fff8eb; color: #9a5a00; }
.shell { width: min(1180px, calc(100% - 36px)); margin: 0 auto; padding: 34px 0 62px; }
.hero, .panel, .brief-card, .setup-step, .archive-row, .result-row {
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--panel);
  box-shadow: var(--shadow);
}
.hero {
  position: relative;
  overflow: hidden;
  padding: clamp(26px, 5vw, 56px);
  background:
    linear-gradient(135deg, rgba(18, 107, 255, 0.12), transparent 44%),
    linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
}
.hero::before {
  content: "";
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, rgba(18, 107, 255, 0.07) 1px, transparent 1px),
    linear-gradient(180deg, rgba(18, 107, 255, 0.05) 1px, transparent 1px);
  background-size: 38px 38px;
  mask-image: linear-gradient(90deg, transparent, #000 36%, #000 100%);
  pointer-events: none;
}
.hero > * { position: relative; }
.panel, .brief-card, .setup-step, .archive-row, .result-row { padding: 18px; }
.kicker { margin: 0 0 10px; color: var(--blue); font-size: 12px; font-weight: 900; text-transform: uppercase; }
h1 { margin: 0; font-size: clamp(38px, 6vw, 66px); line-height: 1.02; letter-spacing: 0; }
h2 { margin: 0; font-size: 24px; line-height: 1.25; }
h3 { margin: 0; font-size: 17px; line-height: 1.34; }
p { margin: 0; }
.lead { margin-top: 16px; color: var(--soft); font-size: 21px; line-height: 1.42; max-width: 860px; }
.section { margin-top: 18px; }
.section-large { margin-top: 30px; }
.section-header { display: flex; align-items: end; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.section-header p { color: var(--muted); }
.meta-row, .actions, .archive-tools, .nav-links { display: flex; flex-wrap: wrap; gap: 9px; align-items: center; }
.meta-row { margin-top: 16px; }
.actions { margin-top: 18px; }
.badge, .chip {
  display: inline-flex;
  min-height: 28px;
  align-items: center;
  border: 1px solid #d6e3f5;
  border-radius: 999px;
  padding: 5px 10px;
  background: #f6f9fe;
  color: var(--soft);
  font-size: 12px;
  font-weight: 760;
}
.ok { color: #05724f; border-color: rgba(15, 159, 110, 0.28); background: #ecfdf6; }
.warn { color: #9a5a00; border-color: rgba(245, 158, 11, 0.32); background: #fff8eb; }
.risk { color: #a6121f; border-color: rgba(220, 38, 38, 0.3); background: #fff1f2; }
.demo-warning {
  margin-top: 18px;
  border: 1px solid rgba(249, 115, 22, 0.32);
  border-left: 4px solid var(--orange);
  border-radius: 8px;
  padding: 14px 16px;
  background: #fff7ed;
  color: #9a3412;
  font-weight: 760;
}
.daily-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; }
.brief-card { display: grid; gap: 12px; border-top: 3px solid var(--blue); }
.brief-card:nth-child(2) { border-top-color: var(--cyan); }
.brief-card:nth-child(3) { border-top-color: var(--gold); }
.brief-card:hover, .archive-row:hover, .result-row:hover { border-color: rgba(18, 107, 255, 0.42); background: #fbfdff; box-shadow: 0 16px 34px rgba(32, 73, 128, 0.13); transform: translateY(-1px); }
.field { border-left: 3px solid rgba(18, 107, 255, 0.22); padding-left: 10px; }
.field-label { margin-bottom: 3px; color: var(--blue-dark); font-size: 12px; font-weight: 900; }
.field-body { color: var(--soft); overflow-wrap: anywhere; }
.muted { color: var(--muted); }
.source-link { color: #047857; overflow-wrap: anywhere; text-decoration: underline; text-decoration-color: rgba(4, 120, 87, 0.28); text-underline-offset: 3px; }
.list { margin: 0; padding-left: 20px; color: var(--soft); }
.list li { margin: 7px 0; }
.two-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.status-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 10px; }
.status-card {
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 14px;
  background: #f9fbff;
  overflow-wrap: anywhere;
  word-break: break-word;
}
.status-card strong { display: block; margin-top: 6px; font-size: 18px; }
.setup-step { display: grid; gap: 12px; }
code { border: 1px solid #cfe1fb; border-radius: 6px; padding: 2px 6px; background: #eef6ff; color: #0b4fb3; }
.search-controls { display: grid; grid-template-columns: minmax(0, 1fr) 220px auto; gap: 10px; align-items: center; }
input, select {
  width: 100%;
  min-height: 42px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #ffffff;
  color: var(--text);
  padding: 8px 11px;
}
input:focus, select:focus { border-color: var(--blue); box-shadow: 0 0 0 3px rgba(18, 107, 255, 0.1); outline: 0; }
.search-results { display: grid; gap: 10px; margin-top: 14px; }
.archive-row, .result-row { display: grid; gap: 6px; }
.archive-date { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.calendar { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; }
.calendar a { border: 1px solid var(--line); border-radius: 8px; padding: 10px; color: var(--soft); background: #fbfdff; }
.calendar a:hover { border-color: rgba(18, 107, 255, 0.42); color: var(--blue-dark); }
.empty { color: var(--muted); padding: 15px; border: 1px dashed var(--line-strong); border-radius: 8px; background: #f8fbff; }
.legacy-note { border: 1px solid rgba(245, 158, 11, 0.32); border-left: 4px solid var(--gold); background: #fff8eb; border-radius: 8px; padding: 14px 16px; color: #8a4b00; }
.toast {
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 80;
  border: 1px solid rgba(15, 159, 110, 0.3);
  border-radius: 8px;
  background: #ffffff;
  color: #05724f;
  padding: 11px 13px;
  box-shadow: var(--shadow);
  font-weight: 780;
}
.site-footer { width: min(1180px, calc(100% - 36px)); margin: 0 auto; padding: 24px 0 36px; color: var(--muted); font-size: 13px; border-top: 1px solid var(--line); }
@media (max-width: 820px) {
  .topbar { align-items: flex-start; flex-direction: column; }
  .nav { width: 100%; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .nav a { text-align: center; }
  .daily-grid, .two-grid, .status-grid, .search-controls { grid-template-columns: 1fr; }
}
@media (max-width: 560px) {
  body { font-size: 14px; }
  .shell { width: min(100% - 22px, 1080px); padding-top: 18px; }
  h1 { font-size: 34px; }
  h2 { font-size: 19px; }
  .lead { font-size: 18px; }
  .section-header { flex-direction: column; align-items: flex-start; }
  .actions { display: grid; grid-template-columns: 1fr; }
  .actions .button, .actions button { width: 100%; text-align: center; white-space: normal; overflow-wrap: anywhere; }
  p, code, strong, .button, button, .status-card { overflow-wrap: anywhere; word-break: break-word; }
}
@media print {
  body { background: #fff; color: #000; }
  .topbar, .actions, .search-controls, .search-results, .site-footer, .nav { display: none !important; }
  .shell { width: 100%; padding: 0; }
  .hero, .panel, .brief-card, .archive-row { border-color: #999; background: #fff; color: #000; box-shadow: none; break-inside: avoid; }
  .field-body, .muted, .list { color: #000; }
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
  ${TopNav()}
  ${body}
  ${Footer()}
  <script>${utilityScript()}${script}</script>
</body>
</html>`.replace(/[ \t]+$/gm, "");
}

function TopNav(): string {
  return `<header class="topbar">
    <a class="brand" href="./" aria-label="返回今日简报"><span class="brand-mark">YQ</span><span>YQN 每日重点简报<span class="brand-sub">3 分钟读完的业务重点</span></span></a>
    <nav class="nav" aria-label="主导航">
      <a href="./">今日简报</a>
      <a href="archive/">历史简报</a>
      <a href="setup/">自动化配置</a>
      <a href="about/">系统说明</a>
    </nav>
  </header>`;
}

function Footer(): string {
  return `<footer class="site-footer">
    <p>安全提醒：GitHub Pages 是公开网页；noindex 和 robots.txt 不是访问控制。不要放客户名单、报价、合同、内部成本、密钥或私密线索。</p>
  </footer>`;
}

function utilityScript(): string {
  return `
function portalToast(message) {
  const old = document.querySelector('.toast');
  if (old) old.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2200);
}
async function portalCopy(value, label) {
  const text = String(value || '').replace('__URL__', location.href);
  try {
    await navigator.clipboard.writeText(text);
    portalToast(label || '已复制');
  } catch {
    portalToast('复制失败，请手动选中文字复制');
  }
}
document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-copy-value]');
  if (!target) return;
  event.preventDefault();
  portalCopy(target.getAttribute('data-copy-value') || '', target.getAttribute('data-copy-label') || '已复制');
});
`;
}

function statusOrDefault(status?: PublicSetupStatus): PublicSetupStatus {
  return status || defaultSetupStatus;
}

function isDemoBrief(brief?: Brief): boolean {
  if (!brief) return true;
  return brief.model === "sample" || brief.model === "sample-backfill" || brief.run_id.toLowerCase().includes("sample") || brief.one_liner.includes("样例") || brief.executive_summary.includes("样例");
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

function visibleTopicEntries(): Array<[Topic, string]> {
  return (Object.entries(topicLabels) as Array<[Topic, string]>).filter(([topic]) => topic !== "personal_business");
}

function briefSummary(brief: Brief): string {
  const items = brief.items.slice(0, 3).map((item, index) => `${index + 1}. ${item.title}｜建议动作：${item.today_action}`).join("\n");
  return [`YQN 每日重点简报 · ${brief.date}`, `一句话：${brief.one_liner}`, items, "链接："].filter(Boolean).join("\n");
}

function actionSummary(brief: Brief): string {
  return `YQN 今日行动要点 · ${brief.date}\n${brief.action_checklist.slice(0, 5).map((item, index) => `${index + 1}. ${item}`).join("\n")}`;
}

function shareText(): string {
  return `这是 YQN 每日重点简报：每天自动生成 3 分钟业务重点，支持网页归档、搜索、飞书入口通知和安全配置。${pagesUrl}`;
}

function CopyButton(label: string, copiedLabel: string, payload: string, extraClass = ""): string {
  return `<button type="button" class="${escapeHtml(extraClass)}" data-copy-value="${escapeHtml(payload)}" data-copy-label="${escapeHtml(copiedLabel)}">${escapeHtml(label)}</button>`;
}

function PrintButton(extraClass = ""): string {
  return `<button type="button" class="${escapeHtml(extraClass)}" onclick="window.print()">打印 / 保存 PDF</button>`;
}

function DemoWarning(brief?: Brief): string {
  return isDemoBrief(brief) ? `<div class="demo-warning" data-section="demo-warning">当前为 Demo 样例数据，不代表真实每日情报，不建议作为正式简报转发。</div>` : "";
}

function StatusChips(brief: Brief | undefined, encrypted: boolean, status?: PublicSetupStatus): string {
  const setup = statusOrDefault(status);
  const mode = !brief ? "待生成" : isDemoBrief(brief) ? "Demo 样例" : "真实简报";
  return `<div class="meta-row" data-section="mode-status-banner">
    <span class="chip ${isDemoBrief(brief) ? "warn" : "ok"}">当前模式：${escapeHtml(mode)}</span>
    <span class="chip ${setup.openAiApiKeyConfigured ? "ok" : "warn"}">OpenAI：${setup.openAiApiKeyConfigured ? "已配置" : "未配置"}</span>
    <span class="chip ${setup.feishuWebhookConfigured ? "ok" : "warn"}">飞书：${setup.feishuWebhookConfigured ? "已接通" : "未配置"}</span>
    <span class="chip ${encrypted ? "ok" : "warn"}">加密：${encrypted ? "已开启" : "未开启"}</span>
  </div>`;
}

function BriefItemCard(item: BriefItem, index: number): string {
  return `<article class="brief-card">
    <div class="archive-date"><h3>${index + 1}. ${escapeHtml(item.title)}</h3><span class="badge ${item.signal_strength === "strong" ? "ok" : item.signal_strength === "medium" ? "warn" : ""}">信号 ${escapeHtml(strengthLabel(item.signal_strength))}</span></div>
    <div class="field"><p class="field-label">发生了什么</p><p class="field-body">${escapeHtml(item.what_happened)}</p></div>
    <div class="field"><p class="field-label">为什么重要</p><p class="field-body">${escapeHtml(item.why_it_matters)}</p></div>
    <div class="field"><p class="field-label">对 YQN 的启发</p><p class="field-body">${escapeHtml(item.yqn_insight)}</p></div>
    <div class="field"><p class="field-label">建议动作</p><p class="field-body">${escapeHtml(item.today_action)}</p></div>
    <p class="muted">可信度 ${escapeHtml(confidenceLabel(item.confidence))} · <a class="source-link" href="${escapeHtml(item.source_url)}" rel="noreferrer">${escapeHtml(item.source_title)} · ${escapeHtml(item.source_domain)}</a></p>
  </article>`;
}

function DailyBriefSection(brief?: Brief): string {
  if (!brief) {
    return `<section class="section panel" data-section="daily-empty">
      <h2>今日无简报</h2>
      <p class="field-body">还没有生成日报。先完成自动化配置，或在 Actions 里手动生成一次。</p>
      <div class="actions"><a class="button primary" href="setup/">完成自动化配置</a></div>
    </section>`;
  }
  if (brief.encryption_enabled && !brief.items.length) {
    return `<section class="section panel" data-section="daily-encrypted-preview">
      <h2>今日简报已加密</h2>
      <p class="field-body">${escapeHtml(brief.executive_summary)}</p>
      <div class="actions"><a class="button primary" href="reports/${escapeHtml(brief.date)}/">打开加密简报</a><a class="button" href="setup/">查看加密配置</a></div>
    </section>`;
  }
  if (!brief.items.length) {
    return `<section class="section panel" data-section="daily-low-signal">
      <h2>今日无强信号</h2>
      <p class="field-body">${escapeHtml(brief.executive_summary)}</p>
      <h3 class="section">今日建议动作</h3>
      <ol class="list">${brief.action_checklist.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>
    </section>`;
  }
  return `<section class="section-large" data-section="daily-top-three">
    <div class="section-header"><div><p class="kicker">3-Minute Brief</p><h2>今日 3 个重点</h2></div><span class="badge">最多 3 条</span></div>
    <div class="daily-grid">${brief.items.slice(0, 3).map(BriefItemCard).join("")}</div>
  </section>`;
}

function ActionPanel(brief?: Brief): string {
  const actions = brief?.action_checklist.slice(0, 5) || ["完成 OpenAI API 配置", "手动生成一次简报", "确认飞书是否需要接入"];
  return `<section class="section panel" id="actions" data-section="action-points">
    <div class="section-header"><div><p class="kicker">Action Points</p><h2>今日建议动作</h2></div>${brief ? CopyButton("复制行动要点", "已复制行动要点", actionSummary(brief), "gold") : ""}</div>
    <ol class="list">${actions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>
  </section>`;
}

function SearchPanel(encrypted: boolean): string {
  return `<section class="section panel" id="search" data-section="search-module">
    <div class="section-header"><div><p class="kicker">Search</p><h2>搜索历史简报</h2></div></div>
    <p class="muted">输入“美国仓”“小红书”“AI”等关键词，或按主题筛选。</p>
    <div class="search-controls section">
      <input id="searchInput" type="search" placeholder="搜索：美国仓 / 小红书 / AI / 来源域名">
      <select id="topicFilter">
        <option value="">全部主题</option>
        ${visibleTopicEntries().map(([key, label]) => `<option value="${escapeHtml(key)}">${escapeHtml(label)}</option>`).join("")}
      </select>
      ${encrypted ? `<button id="unlockSearch" type="button">解锁搜索</button>` : `<button id="runSearch" type="button" class="primary">搜索</button>`}
    </div>
    ${encrypted ? `<div class="search-controls section"><input id="searchPassphrase" type="password" placeholder="输入页面访问密码，本地解密搜索索引"><button id="unlockSearch2" type="button" class="primary">解密</button></div>` : ""}
    <div id="searchStatus" class="muted section"></div>
    <div id="searchResults" class="search-results"></div>
  </section>`;
}

function RecentArchivePanel(briefs: Brief[]): string {
  const rows = briefs.slice(0, 6).map((brief) => `<a class="archive-row" href="reports/${brief.date}/">
    <div class="archive-date"><strong>${escapeHtml(brief.date)}</strong><span class="badge ${brief.is_low_signal_day ? "" : isDemoBrief(brief) ? "warn" : "ok"}">${brief.is_low_signal_day ? "低信号" : isDemoBrief(brief) ? "Demo" : "真实"}</span></div>
    <span class="field-body">${escapeHtml(brief.one_liner)}</span>
    <span class="muted">${escapeHtml(topicsForBrief(brief))}</span>
  </a>`).join("") || `<div class="empty">暂无历史简报。下一步：完成配置并生成一次。</div>`;
  return `<section class="section panel" data-section="history-module">
    <div class="section-header"><div><p class="kicker">History</p><h2>最近历史简报</h2></div><a class="button primary" href="archive/">查看全部历史</a></div>
    <div class="two-grid">${rows}</div>
  </section>`;
}

export function renderHome(latest: Brief | undefined, briefs: Brief[], encrypted: boolean, status?: PublicSetupStatus): string {
  return `<main class="shell">
    <section class="hero" data-section="daily-brief-hero">
      <p class="kicker">YQN Daily Brief</p>
      <h1>YQN 每日重点简报</h1>
      <p class="lead">${escapeHtml(latest?.one_liner || "每天自动生成 3 分钟业务重点：先看判断，再看 3 个重点，最后看建议动作。")}</p>
      ${StatusChips(latest, encrypted, status)}
      ${DemoWarning(latest)}
      <div class="actions" data-section="copy-actions">
        ${latest ? CopyButton("复制简报摘要", "已复制简报摘要", `${briefSummary(latest)}__URL__`, "primary") : ""}
        <a class="button gold" href="#actions">查看今日建议动作</a>
        <a class="button" href="archive/">查看历史简报</a>
        <a class="button" href="setup/">完成自动化配置</a>
      </div>
    </section>
    ${DailyBriefSection(latest)}
    ${ActionPanel(latest)}
    ${RecentArchivePanel(briefs)}
    ${SearchPanel(encrypted)}
  </main>`;
}

function LegacyNotice(): string {
  return `<div class="legacy-note">
    此页是旧版本兼容入口，默认阅读入口已回到“YQN 每日重点简报”。<a class="source-link" href="./">返回今日简报</a>
  </div>`;
}

export function renderBossPage(latest: Brief | undefined, encrypted: boolean): string {
  return `<main class="shell">
    ${LegacyNotice()}
    <section class="section hero" data-section="legacy-summary">
      <p class="kicker">30-Second Summary</p>
      <h1>30 秒重点摘要</h1>
      <p class="lead">${escapeHtml(latest?.one_liner || "暂无简报，先完成自动化配置。")}</p>
      ${DemoWarning(latest)}
      <div class="actions">
        ${latest ? CopyButton("复制简报摘要", "已复制简报摘要", `${briefSummary(latest)}__URL__`, "primary") : ""}
        ${PrintButton("gold")}
      </div>
    </section>
    ${DailyBriefSection(latest)}
    ${ActionPanel(latest)}
  </main>`;
}

export function renderExecutivePage(latest: Brief | undefined, encrypted: boolean, status?: PublicSetupStatus): string {
  return `<main class="shell">
    ${LegacyNotice()}
    <section class="section hero" data-section="legacy-summary">
      <p class="kicker">Key Summary</p>
      <h1>重点摘要</h1>
      <p class="lead">${escapeHtml(latest?.one_liner || "暂无简报，先完成自动化配置。")}</p>
      ${StatusChips(latest, encrypted, status)}
      ${DemoWarning(latest)}
      <div class="actions">
        ${latest ? CopyButton("复制简报摘要", "已复制简报摘要", `${briefSummary(latest)}__URL__`, "primary") : ""}
        ${latest ? CopyButton("复制行动要点", "已复制行动要点", actionSummary(latest), "gold") : ""}
        ${PrintButton()}
      </div>
    </section>
    ${DailyBriefSection(latest)}
    ${ActionPanel(latest)}
  </main>`;
}

function StatusCard(name: string, value: string, ok: boolean): string {
  return `<div class="status-card ${ok ? "ok" : "warn"}"><span class="muted">${escapeHtml(name)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function SetupButton(href: string, label: string, kind = ""): string {
  return `<a class="button ${escapeHtml(kind)}" href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`;
}

export function renderSetupPage(status?: PublicSetupStatus): string {
  const setup = statusOrDefault(status);
  const testSteps = ["打开 Actions → Daily Briefing Portal", "点击 Run workflow", "真实简报不要勾选 sample_backfill", "等 5-10 分钟", "成功后打开首页查看今日简报"].join("\n");
  return `<main class="shell">
    <section class="hero" data-section="setup-hero">
      <p class="kicker">Automation Setup</p>
      <h1>自动化配置</h1>
      <p class="lead">配置一次后，系统每天 09:37 Asia/Taipei 自动生成重点简报。密钥只填到 GitHub Secrets，不要发到聊天里。</p>
      <div class="actions">
        ${SetupButton(secretsUrl, "打开 GitHub Secrets", "primary")}
        ${SetupButton(variablesUrl, "打开 GitHub Variables", "gold")}
        ${SetupButton(actionsUrl, "立即生成一次")}
      </div>
    </section>
    <section class="section panel" data-section="setup-status">
      <div class="section-header"><div><p class="kicker">Safe Status</p><h2>配置状态</h2><p>这里只显示“已配置 / 缺失”，不会显示 secret 内容。</p></div></div>
      <div class="status-grid">
        ${StatusCard("OPENAI_API_KEY", setup.openAiApiKeyConfigured ? "已配置" : "缺失", setup.openAiApiKeyConfigured)}
        ${StatusCard("OPENAI_MODEL", setup.openAiModelConfigured ? "已配置" : "缺失", setup.openAiModelConfigured)}
        ${StatusCard("FEISHU_WEBHOOK_URL", setup.feishuWebhookConfigured ? "已配置" : "缺失", setup.feishuWebhookConfigured)}
        ${StatusCard("PAGE_ACCESS_PASSPHRASE", setup.encryptionEnabled ? (setup.pageAccessPassphraseConfigured ? "已配置" : "缺失") : "未开启加密无需配置", !setup.encryptionEnabled || setup.pageAccessPassphraseConfigured)}
        ${StatusCard("BRIEF_ENCRYPTION_ENABLED", setup.encryptionEnabled ? "true" : "false", setup.encryptionEnabled)}
      </div>
    </section>
    ${SetupStep("OPENAI_API_KEY", "让系统每天调用 OpenAI API 生成真实简报。", "GitHub 仓库 → Settings → Secrets and variables → Actions → Secrets", "New repository secret", "你的 OpenAI API Key", "日报生成失败，页面仍显示 Demo 或配置待完成。", `${SetupButton(secretsUrl, "打开 GitHub Secrets", "gold")}${SetupButton(openAiKeyUrl, "获取 OpenAI API Key")}`, "setup-openai-key")}
    ${SetupStep("OPENAI_MODEL", "告诉系统用哪个 OpenAI API 模型生成简报。", "GitHub 仓库 → Settings → Secrets and variables → Actions → Variables", "New repository variable", "建议先填 gpt-4o-mini；它比 gpt-4.1-mini 更省钱。若账号不可用，再按 OpenAI 模型文档换成账号可用模型。", "Actions 提示模型不可用。", `${SetupButton(variablesUrl, "打开 GitHub Variables", "gold")}${SetupButton(openAiModelsUrl, "查看 OpenAI 模型文档")}`, "setup-openai-model")}
    ${SetupStep("FEISHU_WEBHOOK_URL", "网页生成后，飞书群收到入口卡片。", "飞书群 → 群设置 → 机器人 → 添加自定义机器人；GitHub 里填 Secrets。", "New repository secret", "飞书自定义机器人 webhook 地址。", "网页能更新，但飞书收不到通知。", SetupButton(secretsUrl, "打开 GitHub Secrets", "gold"), "setup-feishu")}
    ${SetupStep("PAGE_ACCESS_PASSPHRASE", "开启加密后，用这个密码解锁简报正文。", "GitHub Secrets；同时把 BRIEF_ENCRYPTION_ENABLED 变量设为 true。", "New repository secret", "你自己设置的强密码，不要发到聊天里。", "加密模式下无法解锁正文。", SetupButton(secretsUrl, "打开 GitHub Secrets", "gold"), "setup-encryption")}
    <section class="section setup-step" data-section="setup-run-workflow">
      <div class="section-header"><div><p class="kicker">Manual Test</p><h2>立即生成一次</h2></div></div>
      <p class="field-body">打开 Actions → Daily Briefing Portal → Run workflow。真实简报不要勾选 sample_backfill，通常等待 5-10 分钟。</p>
      <div class="actions">${SetupButton(actionsUrl, "打开 Actions 测试", "primary")}${CopyButton("复制测试步骤", "已复制测试步骤", testSteps, "gold")}${CopyButton("复制分享文案", "已复制分享文案", shareText())}</div>
    </section>
  </main>`;
}

function SetupStep(name: string, purpose: string, where: string, click: string, value: string, failure: string, actions: string, section: string): string {
  return `<section class="section setup-step" data-section="${escapeHtml(section)}">
    <div class="section-header"><div><p class="kicker">Setup</p><h2>配置 ${escapeHtml(name)}</h2></div></div>
    <p><strong>这是干什么的：</strong>${escapeHtml(purpose)}</p>
    <p><strong>打开哪里：</strong>${escapeHtml(where)}</p>
    <p><strong>点哪里：</strong>${escapeHtml(click)}</p>
    <p><strong>Name：</strong><code>${escapeHtml(name)}</code></p>
    <p><strong>Value：</strong>${escapeHtml(value)}</p>
    <p><strong>配错表现：</strong>${escapeHtml(failure)}</p>
    <div class="actions">${CopyButton(`复制 ${name}`, "已复制 Name", name, "primary")}${actions}</div>
  </section>`;
}

export function renderAboutPage(): string {
  return `<main class="shell">
    <section class="hero" data-section="system-overview">
      <p class="kicker">System Overview</p>
      <h1>系统说明</h1>
      <p class="lead">这是一个自动生成每日重点简报的轻量情报门户：每天从公开来源提取 YQN 相关信号，生成网页简报，并保留历史归档、搜索、飞书入口通知和安全配置。</p>
      <div class="actions">${CopyButton("复制分享文案", "已复制分享文案", shareText(), "primary")}<a class="button" href="./">返回今日简报</a></div>
    </section>
    <section class="section panel" data-section="showcase-scope">
      <h2>适合展示什么</h2>
      <ol class="list">
        <li>每日一句话判断和 3 个重点。</li>
        <li>每个重点的来源、影响、YQN 启发和建议动作。</li>
        <li>历史简报、搜索、飞书入口和自动化配置。</li>
      </ol>
    </section>
    <section class="section panel" data-section="safety-cost-boundary">
      <h2>安全与成本边界</h2>
      <ol class="list">
        <li>GitHub Pages 是公开网页，noindex 和 robots.txt 不是访问控制。</li>
        <li>不要放客户名单、报价、合同、内部成本、密钥或私密线索。</li>
        <li>ChatGPT Pro 不等于 OpenAI API 免费额度，OpenAI API 单独按量计费。</li>
        <li>加密模式是客户端加密，不是企业级登录系统。</li>
      </ol>
    </section>
  </main>`;
}

export function renderBriefStatic(brief: Brief, previousDate?: string, nextDate?: string): string {
  return `<main class="shell">
    <section class="hero" data-section="report-hero">
      <p class="kicker">Daily Brief · ${escapeHtml(brief.date)}</p>
      <h1>每日重点简报</h1>
      <p class="lead">${escapeHtml(brief.one_liner)}</p>
      <div class="meta-row"><span class="chip ${isDemoBrief(brief) ? "warn" : "ok"}">${isDemoBrief(brief) ? "Demo 样例" : "真实简报"}</span><span class="chip">日期 ${escapeHtml(brief.date)}</span><span class="chip">${brief.is_low_signal_day ? "低信号日" : "有重点"}</span></div>
      ${DemoWarning(brief)}
      <div class="actions" data-section="copy-actions">
        ${CopyButton("复制分享链接", "已复制链接", "__URL__", "primary")}
        ${CopyButton("复制简报摘要", "已复制简报摘要", `${briefSummary(brief)}__URL__`, "gold")}
        ${CopyButton("复制行动要点", "已复制行动要点", actionSummary(brief))}
        ${PrintButton()}
      </div>
    </section>
    ${DailyBriefSection(brief)}
    ${ActionPanel(brief)}
    <section class="section panel" data-section="date-navigation">
      <div class="section-header"><div><p class="kicker">Navigation</p><h2>前后日期</h2></div></div>
      <div class="nav-links">
        ${previousDate ? `<a class="button" href="reports/${previousDate}/">上一天 ${escapeHtml(previousDate)}</a>` : `<span class="chip">没有上一天</span>`}
        ${nextDate ? `<a class="button" href="reports/${nextDate}/">下一天 ${escapeHtml(nextDate)}</a>` : `<span class="chip">没有下一天</span>`}
      </div>
    </section>
  </main>`;
}

export function renderLockedReport(brief: Brief, previousDate?: string, nextDate?: string): string {
  return `<main class="shell">
    <section class="hero">
      <p class="kicker">Encrypted Brief · ${escapeHtml(brief.date)}</p>
      <h1>加密简报</h1>
      <p class="lead">${escapeHtml(brief.one_liner)}</p>
      <div class="actions">${CopyButton("复制分享链接", "已复制链接", "__URL__", "primary")}${PrintButton()}</div>
    </section>
    <section class="section panel" id="lockedPanel" data-section="encryption-unlock">
      <h2>输入访问密码</h2>
      <p class="muted">完整简报、来源和搜索索引已加密发布。密码只在浏览器本地用于解锁；这不是企业级登录系统。</p>
      <div class="search-controls section"><input id="passphrase" type="password" placeholder="输入页面访问密码"><button id="unlockBrief" type="button" class="primary">解锁简报</button></div>
      <p id="unlockStatus" class="muted section">等待输入密码。</p>
    </section>
    <div id="briefRoot"></div>
  </main>`;
}

export function renderArchivePage(title: string, briefs: Brief[]): string {
  const rows = briefs.map((brief) => `<a class="archive-row" href="reports/${brief.date}/">
    <div class="archive-date"><strong>${escapeHtml(brief.date)}</strong><span class="badge ${brief.is_low_signal_day ? "" : isDemoBrief(brief) ? "warn" : "ok"}">${brief.is_low_signal_day ? "低信号" : isDemoBrief(brief) ? "Demo" : "真实"}</span></div>
    <span class="field-body">${escapeHtml(brief.one_liner)}</span>
    <span class="muted">${escapeHtml(topicsForBrief(brief))}</span>
  </a>`).join("") || `<div class="empty">暂无历史简报。</div>`;
  return `<main class="shell">
    <section class="hero" data-section="archive-hero">
      <p class="kicker">Archive</p>
      <h1>${escapeHtml(title.replace("归档", "简报归档"))}</h1>
      <p class="lead">按日期查看历史简报，也可以用搜索快速找到过往重点。</p>
      <div class="archive-tools"><a class="button primary" href="archive/">全部历史</a>${monthArchiveLinks(briefs)}${weekArchiveLinks(briefs)}</div>
    </section>
    <section class="section panel" data-section="archive-list"><div class="section-header"><div><p class="kicker">History</p><h2>历史简报</h2></div></div><div class="two-grid">${rows}</div></section>
    <section class="section panel" data-section="calendar"><h2>日历视图</h2><div class="calendar">${CalendarArchive(briefs)}</div></section>
  </main>`;
}

function monthArchiveLinks(briefs: Brief[]): string {
  const months = [...new Set(briefs.map((brief) => {
    const { year, month } = monthParts(brief.date);
    return `${year}/${month}`;
  }))].sort().reverse();
  return months.map((month) => `<a class="button" href="archive/${escapeHtml(month)}/">${escapeHtml(month)}</a>`).join("");
}

function weekArchiveLinks(briefs: Brief[]): string {
  const weeks = [...new Set(briefs.map((brief) => {
    const week = isoWeek(brief.date);
    return `${week.year}/week-${String(week.week).padStart(2, "0")}`;
  }))].sort().reverse();
  return weeks.map((week) => `<a class="button" href="archive/${escapeHtml(week)}/">${escapeHtml(week)}</a>`).join("");
}

function CalendarArchive(briefs: Brief[]): string {
  return briefs.map((brief) => `<a href="reports/${brief.date}/"><strong>${escapeHtml(brief.date)}</strong><br><span class="muted">${brief.items.length} 条 · ${brief.is_low_signal_day ? "低信号" : "有重点"}</span></a>`).join("") || `<div class="empty">暂无日期。</div>`;
}

export function browserDecryptAndSearchScript(): string {
  return `
const topicLabels = ${jsonForScript(topicLabels)};
function htmlEscape(value) {
  return String(value || '').replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function b64ToBytes(value) { return Uint8Array.from(atob(value), (char) => char.charCodeAt(0)); }
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
  if (!status) return;
  try {
    const data = await fetch('search-index.json', { cache: 'no-store' }).then((response) => response.json());
    if (data.encrypted) {
      searchLocked = true;
      if (!passphrase) { status.textContent = '搜索索引已加密。输入页面访问密码后，浏览器会在本地解密。'; return; }
      searchEntries = await decryptPayload(data.payload, passphrase);
      status.textContent = '搜索索引已解锁。';
    } else {
      searchEntries = data;
      status.textContent = searchEntries.length ? '搜索索引已加载。' : '暂无可搜索历史。';
    }
    runSearch();
  } catch {
    status.textContent = searchLocked ? '密码错误或搜索索引无法解密。' : '搜索索引加载失败。';
  }
}
function renderResults(results) {
  const root = document.getElementById('searchResults');
  if (!root) return;
  root.innerHTML = results.length ? results.map((entry) => '<a class="result-row" href="' + htmlEscape(entry.url || ('reports/' + entry.date + '/')) + '"><strong>' + htmlEscape(entry.title || entry.one_liner) + '</strong><span class="muted">' + htmlEscape(entry.date) + ' · ' + htmlEscape(topicLabels[entry.topic] || entry.topic || '简报') + ' · ' + htmlEscape(entry.source_domain || '') + '</span></a>').join('') : '<div class="empty">没有匹配结果。换一个关键词，或切回“全部主题”。</div>';
}
function runSearch() {
  const q = document.getElementById('searchInput')?.value.trim().toLowerCase() || '';
  const topic = document.getElementById('topicFilter')?.value || '';
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
function b64ToBytes(value) { return Uint8Array.from(atob(value), (char) => char.charCodeAt(0)); }
async function decryptPayload(payload, passphrase) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: b64ToBytes(payload.salt), iterations: payload.iterations }, material, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBytes(payload.iv) }, key, b64ToBytes(payload.ciphertext));
  return JSON.parse(new TextDecoder().decode(plaintext));
}
function renderBrief(brief) {
  const root = document.getElementById('briefRoot');
  const cards = brief.items.length ? brief.items.slice(0, 3).map((item, index) => '<article class="brief-card"><h3>' + (index + 1) + '. ' + htmlEscape(item.title) + '</h3><div class="field"><p class="field-label">发生了什么</p><p class="field-body">' + htmlEscape(item.what_happened) + '</p></div><div class="field"><p class="field-label">为什么重要</p><p class="field-body">' + htmlEscape(item.why_it_matters) + '</p></div><div class="field"><p class="field-label">对 YQN 的启发</p><p class="field-body">' + htmlEscape(item.yqn_insight) + '</p></div><div class="field"><p class="field-label">建议动作</p><p class="field-body">' + htmlEscape(item.today_action) + '</p></div></article>').join('') : '<section class="panel"><h2>今日无强信号</h2><p class="field-body">' + htmlEscape(brief.executive_summary) + '</p></section>';
  root.innerHTML = '<section class="section-large"><div class="daily-grid">' + cards + '</div></section><section class="section panel"><h2>今日建议动作</h2><ol class="list">' + brief.action_checklist.map((item) => '<li>' + htmlEscape(item) + '</li>').join('') + '</ol></section>';
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
    portalToast('简报已解锁');
  } catch {
    status.textContent = '密码错误或简报无法解密。正文仍未显示。';
  }
}
document.getElementById('unlockBrief')?.addEventListener('click', unlockBrief);
document.getElementById('passphrase')?.addEventListener('keydown', (event) => { if (event.key === 'Enter') unlockBrief(); });
`;
}

export function topicFromEntry(item?: { topic?: Topic }): Topic | "" {
  return item?.topic || "";
}
