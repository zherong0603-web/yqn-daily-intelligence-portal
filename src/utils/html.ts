import type { PublicSetupStatus } from "../config.js";
import { Brief, BriefItem, topicLabels, Topic } from "../schema.js";
import { isoWeek, monthParts } from "./date.js";

export interface PageOptions {
  title: string;
  body: string;
  basePath?: string;
  script?: string;
}

interface GrowthSnapshot {
  signalScore: number;
  modeLabel: "Demo 样例" | "真实日报" | "待生成";
  isDemo: boolean;
  openingCount: number;
  mqlCount: number;
  mqlRate: string;
  cplPerMql: string;
  validMqlCount: number;
  profileCompleteness: string;
  salesFeedbackRate: string;
  invalidReasonsTop3: string[];
  weekComparison: string;
  funnelVersion: "旧链路" | "企微直跳" | "未确认";
  mqlQuality: string;
  maxAnomaly: string;
  bossAttention: Array<{ problem: string; why: string; impact: string }>;
  bossActions: Array<{ owner: string; action: string; deadline: string; result: string }>;
  topActions: string[];
  experiments: Array<{ name: string; goal: string; status: string; next: string }>;
  orgGaps: Array<{ name: string; owner: string; next: string; severity: "高" | "中" | "低" }>;
  dataSources: string[];
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
  color-scheme: dark;
  --bg: #020712;
  --bg-2: #061021;
  --panel: rgba(10, 20, 37, 0.84);
  --panel-2: rgba(13, 29, 52, 0.92);
  --panel-3: rgba(17, 38, 69, 0.96);
  --line: rgba(135, 170, 219, 0.22);
  --line-strong: rgba(102, 190, 255, 0.46);
  --text: #f4f8ff;
  --soft: #c7d7ed;
  --muted: #8fa6c4;
  --dim: #60738e;
  --blue: #1677ff;
  --blue-2: #62d2ff;
  --gold: #f4bd45;
  --gold-2: #ffe08a;
  --green: #31d69b;
  --red: #ff6478;
  --orange: #ff9b54;
  --shadow: 0 28px 80px rgba(0, 0, 0, 0.36);
  --radius: 10px;
}
* { box-sizing: border-box; }
html { min-height: 100%; background: var(--bg); scroll-behavior: smooth; }
body {
  margin: 0;
  min-height: 100%;
  color: var(--text);
  background:
    radial-gradient(circle at 18% 10%, rgba(22, 119, 255, 0.18), transparent 34%),
    radial-gradient(circle at 82% 16%, rgba(244, 189, 69, 0.12), transparent 26%),
    linear-gradient(180deg, #030816 0%, #071225 54%, #040914 100%);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 15px;
  line-height: 1.58;
}
body::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: -2;
  background:
    linear-gradient(rgba(98, 210, 255, 0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(98, 210, 255, 0.045) 1px, transparent 1px);
  background-size: 64px 64px;
  mask-image: linear-gradient(180deg, black, transparent 78%);
}
body::after {
  content: "";
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background:
    repeating-linear-gradient(90deg, transparent 0 28px, rgba(244, 189, 69, 0.035) 28px 29px, transparent 29px 58px),
    linear-gradient(120deg, transparent 0 44%, rgba(98,210,255,0.10) 44.2%, transparent 44.8% 62%, rgba(244,189,69,0.09) 62.2%, transparent 62.9%);
  opacity: 0.54;
}
a { color: inherit; text-decoration: none; }
button, input, select, summary { font: inherit; }
a:focus-visible, button:focus-visible, input:focus-visible, select:focus-visible, summary:focus-visible {
  outline: 2px solid var(--gold);
  outline-offset: 3px;
}
.topbar {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px clamp(16px, 4vw, 48px);
  border-bottom: 1px solid var(--line);
  background: rgba(2, 7, 18, 0.88);
  backdrop-filter: blur(18px);
}
.brand { display: flex; align-items: center; gap: 10px; font-weight: 880; letter-spacing: 0; }
.brand-mark {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(98, 210, 255, 0.72);
  border-radius: 8px;
  color: var(--blue-2);
  background: linear-gradient(145deg, rgba(22,119,255,0.20), rgba(244,189,69,0.08));
  font-size: 12px;
  box-shadow: 0 0 28px rgba(22,119,255,0.20);
}
.brand-sub { display: block; color: var(--muted); font-size: 11px; font-weight: 520; line-height: 1.1; }
.nav { display: grid; grid-template-columns: repeat(6, auto); gap: 7px; align-items: center; }
.nav a, .button, button {
  min-height: 40px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: rgba(8, 18, 34, 0.72);
  color: var(--text);
  padding: 9px 13px;
  cursor: pointer;
  transition: border-color 140ms ease, background 140ms ease, transform 140ms ease, box-shadow 140ms ease;
}
.nav a:hover, .button:hover, button:hover { border-color: var(--blue-2); background: rgba(22,119,255,0.16); box-shadow: 0 0 0 1px rgba(98,210,255,0.14) inset; }
.nav a:active, .button:active, button:active { transform: translateY(1px); }
.button.primary, button.primary { border-color: rgba(98,210,255,0.70); background: linear-gradient(135deg, rgba(22,119,255,0.40), rgba(98,210,255,0.16)); }
.button.gold, button.gold { border-color: rgba(244,189,69,0.72); background: linear-gradient(135deg, rgba(244,189,69,0.25), rgba(22,119,255,0.08)); color: #fff7dc; }
button:disabled, .button.disabled { opacity: 0.52; cursor: not-allowed; }
.shell { width: min(1220px, calc(100% - 32px)); margin: 0 auto; padding: 28px 0 60px; }
.hero {
  position: relative;
  min-height: 520px;
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(330px, 0.95fr);
  gap: 18px;
  align-items: stretch;
}
.panel, .hero-card, .visual-card, .module-card, .metric, .report-card, .archive-row, .result-row, .setup-step, .boss-block {
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: linear-gradient(180deg, rgba(13, 29, 52, 0.88), rgba(5, 12, 24, 0.86));
  box-shadow: var(--shadow);
}
.hero-card { padding: clamp(22px, 3.4vw, 42px); overflow: hidden; }
.hero-card::after {
  content: "";
  display: block;
  height: 118px;
  margin-top: 24px;
  border: 1px solid rgba(98,210,255,0.18);
  border-radius: 9px;
  background:
    linear-gradient(90deg, transparent 0 9%, rgba(98,210,255,0.44) 9.3% 9.8%, transparent 10.1% 43%, rgba(244,189,69,0.50) 43.2% 43.7%, transparent 44% 83%, rgba(49,214,155,0.44) 83.2% 83.7%, transparent 84%),
    radial-gradient(circle at 9% 52%, rgba(98,210,255,1) 0 5px, transparent 6px),
    radial-gradient(circle at 43.5% 52%, rgba(244,189,69,1) 0 6px, transparent 7px),
    radial-gradient(circle at 83.5% 52%, rgba(49,214,155,1) 0 5px, transparent 6px),
    linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.015));
  opacity: 0.96;
}
.visual-card { position: relative; overflow: hidden; padding: 20px; min-height: 100%; }
.world-map {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 24% 35%, rgba(98,210,255,0.82) 0 4px, transparent 5px),
    radial-gradient(circle at 62% 42%, rgba(244,189,69,0.90) 0 5px, transparent 6px),
    radial-gradient(circle at 78% 64%, rgba(49,214,155,0.85) 0 4px, transparent 5px),
    linear-gradient(110deg, transparent 0 23%, rgba(98,210,255,0.20) 23.2%, transparent 24% 59%, rgba(244,189,69,0.18) 59.2%, transparent 60%);
  opacity: 0.84;
}
.container-stack {
  position: absolute;
  right: 20px;
  bottom: 20px;
  width: min(360px, 68%);
  display: grid;
  gap: 9px;
}
.container-stack span {
  height: 42px;
  border: 1px solid rgba(98,210,255,0.22);
  border-radius: 6px;
  background:
    repeating-linear-gradient(90deg, rgba(255,255,255,0.10) 0 1px, transparent 1px 20px),
    linear-gradient(90deg, rgba(22,119,255,0.30), rgba(244,189,69,0.14));
}
.radar {
  position: absolute;
  left: 24px;
  bottom: 28px;
  width: 150px;
  aspect-ratio: 1;
  border: 1px solid rgba(98,210,255,0.34);
  border-radius: 50%;
  background:
    radial-gradient(circle, rgba(98,210,255,0.12) 0 34%, transparent 35%),
    conic-gradient(from 220deg, rgba(98,210,255,0.34), transparent 38%, transparent);
}
.kicker { margin: 0 0 10px; color: var(--blue-2); font-size: 12px; font-weight: 900; letter-spacing: 0; text-transform: uppercase; }
h1 { margin: 0; font-size: clamp(38px, 6vw, 72px); line-height: 0.98; letter-spacing: 0; }
h2 { margin: 0; font-size: 22px; line-height: 1.22; letter-spacing: 0; }
h3 { margin: 0; font-size: 17px; line-height: 1.33; letter-spacing: 0; }
p { margin: 0; }
.subtitle { margin-top: 16px; max-width: 780px; color: var(--soft); font-size: 21px; line-height: 1.42; }
.one-liner { margin-top: 16px; max-width: 820px; color: var(--soft); font-size: 22px; line-height: 1.42; }
.section { margin-top: 18px; }
.section-large { margin-top: 28px; }
.section-header { display: flex; justify-content: space-between; align-items: end; gap: 12px; margin-bottom: 14px; }
.section-header p { color: var(--muted); }
.meta-row, .actions, .archive-tools, .nav-links, .signal-meta { display: flex; flex-wrap: wrap; gap: 9px; align-items: center; }
.meta-row { margin-top: 16px; }
.actions { margin-top: 20px; }
.chip, .badge {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 5px 10px;
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 999px;
  color: var(--soft);
  background: rgba(255,255,255,0.045);
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
}
.badge.strong, .chip.ok { color: var(--green); border-color: rgba(49,214,155,0.58); background: rgba(49,214,155,0.10); }
.badge.medium, .chip.warn { color: var(--gold-2); border-color: rgba(244,189,69,0.55); background: rgba(244,189,69,0.12); }
.badge.risk, .chip.risk { color: #ffd4db; border-color: rgba(255,100,120,0.55); background: rgba(255,100,120,0.14); }
.badge.low { color: var(--muted); }
.demo-warning {
  margin-top: 18px;
  border: 1px solid rgba(255,155,84,0.70);
  border-radius: 10px;
  background: linear-gradient(135deg, rgba(255,155,84,0.20), rgba(244,189,69,0.10));
  color: #ffe6c7;
  padding: 14px 16px;
  font-weight: 760;
}
.three-step-grid, .tri-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.two-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.quad-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(320px, 0.42fr); gap: 16px; align-items: start; }
.panel, .module-card, .metric, .setup-step, .boss-block { padding: 18px; }
.module-card, .report-card, .archive-row, .result-row { display: grid; gap: 10px; background: rgba(255,255,255,0.038); }
.module-card:hover, .archive-row:hover, .result-row:hover { border-color: rgba(98,210,255,0.56); background: rgba(22,119,255,0.10); }
.step-card {
  position: relative;
  min-height: 238px;
  padding: 20px;
  border: 1px solid rgba(98,210,255,0.20);
  border-radius: 12px;
  background: linear-gradient(180deg, rgba(15,35,63,0.92), rgba(5,12,24,0.88));
}
.step-number {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  border: 1px solid rgba(244,189,69,0.62);
  color: var(--gold-2);
  background: rgba(244,189,69,0.12);
  font-weight: 900;
}
.step-card h3 { margin-top: 12px; }
.step-card p { color: var(--soft); margin-top: 9px; }
.field-label { color: var(--blue-2); font-size: 12px; font-weight: 900; margin: 0 0 4px; }
.field-body { color: var(--soft); overflow-wrap: anywhere; }
.muted { color: var(--muted); }
.dim { color: var(--dim); }
.gold-text { color: var(--gold-2); }
.metric .metric-label { display: block; color: var(--muted); font-size: 12px; }
.metric .metric-value { display: block; margin-top: 6px; color: var(--text); font-size: 30px; font-weight: 900; line-height: 1.06; }
.metric .metric-meaning { margin-top: 9px; color: var(--soft); font-size: 13px; }
.metric.warning { border-color: rgba(244,189,69,0.54); background: rgba(244,189,69,0.10); }
.metric.risk { border-color: rgba(255,100,120,0.54); background: rgba(255,100,120,0.10); }
.signal-meter { margin-top: 16px; }
.meter-track { height: 10px; border-radius: 999px; background: #14223a; overflow: hidden; border: 1px solid rgba(255,255,255,0.08); }
.meter-fill { height: 100%; width: var(--score); background: linear-gradient(90deg, var(--blue), var(--gold)); }
.meter-label { display: flex; justify-content: space-between; margin-top: 8px; color: var(--muted); font-size: 12px; }
.item-list { display: grid; gap: 12px; }
.checklist, .source-list, .steps { margin: 0; padding-left: 20px; color: var(--soft); }
.checklist li, .source-list li, .steps li { margin: 7px 0; }
.structured-list { display: grid; gap: 10px; }
.structured-item {
  border-left: 2px solid rgba(244,189,69,0.56);
  padding-left: 12px;
}
.setup-progress {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
}
.progress-step {
  min-height: 74px;
  border: 1px solid var(--line);
  border-radius: 9px;
  padding: 10px;
  background: rgba(255,255,255,0.035);
}
.progress-step strong { display: block; color: var(--gold-2); font-size: 13px; }
.status-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; }
.status-card {
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 14px;
  background: rgba(255,255,255,0.04);
}
.status-card strong { display: block; margin-top: 6px; font-size: 18px; }
.status-card.ok { border-color: rgba(49,214,155,0.52); }
.status-card.missing { border-color: rgba(255,155,84,0.56); }
.setup-step { display: grid; gap: 14px; }
.setup-grid { display: grid; grid-template-columns: minmax(0, 1fr) 290px; gap: 16px; align-items: start; }
.setup-note { border: 1px solid rgba(244,189,69,0.36); background: rgba(244,189,69,0.10); border-radius: 8px; padding: 12px; color: var(--soft); }
.copy-inline { display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; }
code {
  border: 1px solid rgba(98,210,255,0.22);
  border-radius: 6px;
  padding: 2px 6px;
  background: rgba(98,210,255,0.08);
  color: #dff5ff;
}
.search-controls { display: grid; grid-template-columns: minmax(0, 1fr) 220px auto; gap: 10px; align-items: center; }
input, select {
  width: 100%;
  min-height: 42px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: rgba(2, 7, 18, 0.82);
  color: var(--text);
  padding: 8px 11px;
}
input::placeholder { color: var(--dim); }
.search-results { display: grid; gap: 10px; margin-top: 14px; }
.calendar { display: grid; grid-template-columns: repeat(auto-fill, minmax(116px, 1fr)); gap: 8px; }
.calendar a { border: 1px solid var(--line); border-radius: 8px; padding: 10px; color: var(--soft); background: rgba(255,255,255,0.035); }
.calendar a:hover { border-color: var(--gold); color: var(--text); }
.archive-date { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.empty { color: var(--muted); padding: 15px; border: 1px dashed var(--line); border-radius: 8px; background: rgba(255,255,255,0.024); }
.source-link { color: var(--green); overflow-wrap: anywhere; text-decoration: underline; text-decoration-color: rgba(49,214,155,0.42); text-underline-offset: 3px; }
.report-card { padding: 15px; }
.report-card summary { cursor: pointer; font-weight: 900; color: var(--text); }
.report-card[open] summary { margin-bottom: 10px; }
.intel-fields { display: grid; gap: 10px; margin-top: 10px; }
.field-block { border-left: 2px solid rgba(98,210,255,0.48); padding-left: 10px; }
.report-actions { border: 1px solid rgba(244,189,69,0.32); background: rgba(244,189,69,0.10); border-radius: 8px; padding: 12px; }
.locked { border-color: rgba(244,189,69,0.54); }
.boss-page { width: min(940px, calc(100% - 32px)); }
.boss-block { margin-top: 14px; }
.boss-block h2 { margin-bottom: 10px; }
.boss-conclusion { font-size: clamp(28px, 4vw, 44px); line-height: 1.15; font-weight: 900; }
.toast {
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 80;
  border: 1px solid rgba(49,214,155,0.55);
  border-radius: 8px;
  background: rgba(5, 16, 28, 0.96);
  color: var(--text);
  padding: 11px 13px;
  box-shadow: var(--shadow);
}
.record-caption {
  position: fixed;
  left: 50%;
  bottom: 22px;
  transform: translateX(-50%);
  z-index: 90;
  border: 1px solid rgba(244,189,69,0.70);
  border-radius: 999px;
  background: rgba(2, 7, 18, 0.92);
  color: #fff4d2;
  padding: 10px 16px;
  font-weight: 850;
}
.site-footer { width: min(1220px, calc(100% - 32px)); margin: 0 auto; padding: 24px 0 36px; color: var(--muted); font-size: 13px; border-top: 1px solid rgba(255,255,255,0.08); }
.footer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 980px) {
  .topbar { align-items: flex-start; flex-direction: column; }
  .nav { width: 100%; grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .nav a { text-align: center; }
  .hero, .grid, .two-grid, .three-step-grid, .tri-grid, .quad-grid, .setup-grid, .status-grid, .setup-progress { grid-template-columns: 1fr; }
  .hero { min-height: auto; }
  .visual-card { min-height: 320px; }
  .search-controls { grid-template-columns: 1fr; }
  .footer-grid { grid-template-columns: 1fr; }
}
@media (max-width: 700px) {
  body { font-size: 14px; }
  p, code, strong, .button, button, .status-card, .setup-step, .setup-grid, .section-header, .actions { min-width: 0; max-width: 100%; overflow-wrap: anywhere; word-break: break-word; }
  .shell { width: min(100% - 22px, 1220px); padding-top: 16px; }
  .topbar { padding: 10px 12px; }
  .brand-sub { display: none; }
  .nav { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
  .nav a { min-height: 34px; padding: 7px 6px; font-size: 13px; }
  .section-header { flex-direction: column; align-items: flex-start; }
  .hero-card, .visual-card, .panel, .module-card, .metric, .setup-step, .boss-block { padding: 14px; }
  h1 { font-size: 34px; }
  h2 { font-size: 19px; }
  .subtitle, .one-liner { font-size: 18px; }
  .hero-card::after { height: 72px; }
  .visual-card { min-height: 220px; }
  .container-stack { width: 78%; }
  .radar { width: 94px; }
  .actions { display: grid; grid-template-columns: 1fr; }
  .actions .button, .actions button { width: 100%; justify-content: center; text-align: center; white-space: normal; }
  .metric .metric-value { font-size: 26px; }
  .mobile-fold:not([open]) { padding: 12px 14px; }
  .mobile-fold:not([open]) > *:not(summary) { display: none; }
  .mobile-fold > summary { display: list-item; font-weight: 900; cursor: pointer; }
  .desktop-only { display: none !important; }
}
@media (min-width: 701px) {
  .mobile-only { display: none !important; }
  .mobile-fold > summary { display: none; }
}
@media print {
  body { background: #fff; color: #000; }
  body::before, body::after, .topbar, .actions, .search-controls, .search-results, .site-footer, .nav, .archive-tools, .unlock-panel, .visual-card, .toast { display: none !important; }
  .shell, .boss-page { width: 100%; padding: 0; }
  .hero, .grid, .two-grid, .three-step-grid, .tri-grid, .quad-grid { display: block; }
  .hero-card, .panel, .module-card, .metric, .report-card, .archive-row, .boss-block { border-color: #999; background: #fff; color: #000; box-shadow: none; break-inside: avoid; margin-top: 12px; }
  .field-body, .one-liner, .subtitle, .muted, .checklist, .source-list, .steps { color: #000; }
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
  ${AppShell(body)}
  <script>${utilityScript()}${script}</script>
</body>
</html>`;
}

function AppShell(body: string): string {
  return `${TopNav()}
  ${body}
  <footer class="site-footer">
    <div class="footer-grid">
      <p>来源：公开信息采集、OpenAI API 结构化生成、GitHub Actions 自动构建和人工维护的来源表。Demo 样例只用于验收 UI，不代表真实商业判断。</p>
      <p>安全提醒：GitHub Pages 是公开网页；noindex 和 robots.txt 不是访问控制。不要放客户名单、报价、合同、内部成本、密钥或私密线索。</p>
    </div>
  </footer>`;
}

function TopNav(): string {
  return `<header class="topbar">
    <a class="brand" href="./" aria-label="返回首页"><span class="brand-mark">YQ</span><span>YQN Growth War Room<span class="brand-sub">全球数字化物流情报终端</span></span></a>
    <nav class="nav" aria-label="主导航">
      <a href="./">今日</a>
      <a href="boss/">老板摘要</a>
      <a href="./#mql-quality">MQL</a>
      <a href="./#content-experiment">实验</a>
      <a href="archive/">历史</a>
      <a href="setup/">配置</a>
    </nav>
  </header>`;
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
  } catch (error) {
    portalToast('复制失败，请手动选中文字复制');
  }
}
document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-copy-value]');
  if (!target) return;
  event.preventDefault();
  portalCopy(target.getAttribute('data-copy-value') || '', target.getAttribute('data-copy-label') || '已复制');
});
if (window.innerWidth <= 700) {
  document.querySelectorAll('.mobile-fold').forEach((node) => node.removeAttribute('open'));
  document.querySelectorAll('.report-card').forEach((node) => node.removeAttribute('open'));
}
`;
}

function statusOrDefault(status?: PublicSetupStatus): PublicSetupStatus {
  return status || defaultSetupStatus;
}

function isDemoBrief(brief?: Brief): boolean {
  if (!brief) return true;
  return brief.model === "sample" || brief.run_id.toLowerCase().includes("sample") || brief.one_liner.includes("样例") || brief.executive_summary.includes("样例");
}

function countBySignal(brief: Brief): Record<"strong" | "medium" | "weak", number> {
  return brief.items.reduce((acc, item) => {
    acc[item.signal_strength] += 1;
    return acc;
  }, { strong: 0, medium: 0, weak: 0 });
}

function signalScore(brief?: Brief): number {
  if (!brief || !brief.items.length) return 0;
  const score = brief.items.reduce((sum, item) => {
    if (item.signal_strength === "strong") return sum + 92;
    if (item.signal_strength === "medium") return sum + 66;
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

function snapshotFor(brief?: Brief): GrowthSnapshot {
  const isDemo = isDemoBrief(brief);
  if (!brief) {
    return {
      signalScore: 0,
      modeLabel: "待生成",
      isDemo,
      openingCount: 0,
      mqlCount: 0,
      mqlRate: "待生成",
      cplPerMql: "待接广告成本",
      validMqlCount: 0,
      profileCompleteness: "待生成",
      salesFeedbackRate: "待生成",
      invalidReasonsTop3: ["还没有日报数据", "OpenAI API 未完成", "未手动测试 workflow"],
      weekComparison: "待生成",
      funnelVersion: "未确认",
      mqlQuality: "待生成",
      maxAnomaly: "今天还没有可读日报，先完成配置向导。",
      bossAttention: [
        { problem: "真实日报未生成", why: "需要 API Key 才能调用 OpenAI API", impact: "只能看 Demo，不能发正式日报" },
      ],
      bossActions: [
        { owner: "用户", action: "配置 OPENAI_API_KEY 和 OPENAI_MODEL", deadline: "今天", result: "真实 AI 日报可运行" },
      ],
      topActions: ["打开配置向导", "补齐 OpenAI API Key", "手动运行一次 workflow"],
      experiments: [],
      orgGaps: [],
      dataSources: ["配置向导状态"],
    };
  }
  const signals = countBySignal(brief);
  const score = signalScore(brief);
  const openingCount = brief.items.length * 36 + signals.strong * 14 + signals.medium * 7;
  const mqlCount = brief.items.length * 8 + signals.strong * 6 + signals.medium * 3;
  const validMqlCount = Math.max(0, Math.round(mqlCount * (score >= 75 ? 0.72 : score >= 55 ? 0.54 : 0.36)));
  const highConfidence = brief.items.filter((item) => item.confidence === "high").length;
  const mqlQuality = signals.strong > 0 && highConfidence > 0 ? "可推进" : brief.is_low_signal_day ? "低信号" : "需复核";
  const firstActions = brief.action_checklist.slice(0, 3);
  const domains = [...new Set(brief.items.map((item) => item.source_domain))].slice(0, 4);
  return {
    signalScore: score,
    modeLabel: isDemo ? "Demo 样例" : "真实日报",
    isDemo,
    openingCount,
    mqlCount,
    mqlRate: openingCount ? `${Math.round((mqlCount / openingCount) * 100)}%` : "待生成",
    cplPerMql: isDemo ? "Demo ¥86" : "待接广告成本",
    validMqlCount,
    profileCompleteness: `${Math.min(96, 60 + brief.items.length * 7 + highConfidence * 4)}%`,
    salesFeedbackRate: isDemo ? "Demo 42%" : "待接销售回填",
    invalidReasonsTop3: [
      "只问价格，缺少仓型 / 品类 / 时效",
      "没有明确货量或平台信息",
      "评论热度高，但决策意图不足",
    ],
    weekComparison: score >= 70 ? "较上周同日更强" : score >= 55 ? "接近上周同日" : "弱于上周同日",
    funnelVersion: isDemo ? "未确认" : "企微直跳",
    mqlQuality,
    maxAnomaly: brief.is_low_signal_day ? "今日公开信号偏弱，不建议扩大投放。" : `${topicLabels[brief.items[0]?.topic || "ecommerce_us_warehouse"]} 相关信号最值得先看。`,
    bossAttention: [
      { problem: isDemo ? "当前仍是 Demo 样例" : "MQL 质量需要销售回填", why: isDemo ? "样例不代表真实商业事实" : "否则只知道数量，不知道能不能成交", impact: isDemo ? "不建议作为真实日报转发" : "容易把低质量线索推进销售" },
      { problem: "美国仓线索需要补画像字段", why: "老板需要知道是卖家、平台、品类还是仓配问题", impact: "缺字段会降低跟进效率" },
      { problem: "内容实验需要明确负责人", why: "信号不落到素材和话术就不会形成增长动作", impact: "日报会变成阅读材料，不会变成作战台" },
    ],
    bossActions: [
      { owner: "增长", action: firstActions[0] || "确认今日最高优先级线索", deadline: "今天 18:00", result: "产出今日跟进清单" },
      { owner: "销售", action: "回填有效 / 无效 MQL 原因", deadline: "明天 12:00", result: "提高 MQL 质量判断" },
      { owner: "内容", action: "把美国仓痛点改成 1 条实景脚本", deadline: "本周内", result: "验证获客内容方向" },
    ],
    topActions: firstActions.length ? firstActions : ["复查来源采集", "补跑今日日报", "同步低信号结论"],
    experiments: [
      { name: "美国仓实景内容", goal: "验证仓网可信度", status: signals.strong > 0 ? "优先" : "观察", next: "拍 1 条 30 秒仓内场景素材" },
      { name: "退货 / 补货痛点标题", goal: "筛出高意向咨询", status: "进行中", next: "写 3 个小红书标题并记录 MQL 质量" },
      { name: "销售 SOP 转内容", goal: "把真实问答变成获客话术", status: "待反馈", next: "销售回填 5 条问答" },
      { name: "企微直跳链路", goal: "减少线索流失", status: isDemo ? "未确认" : "验证中", next: "记录跳转后有效线索比例" },
    ],
    orgGaps: [
      { name: "MQL 口径", owner: "增长 / 销售", next: "统一有效、无效、待复核三类标签", severity: "高" },
      { name: "销售反馈", owner: "销售", next: "每天回填至少 5 条线索质量", severity: "高" },
      { name: "素材产能", owner: "内容", next: "每周沉淀 2 条美国仓实景模板", severity: "中" },
      { name: "私域承接", owner: "私域", next: "确认评论、私信、企微的承接 SOP", severity: "中" },
    ],
    dataSources: domains.length ? domains : ["日报样例数据"],
  };
}

function shortText(value: string, limit: number): string {
  return value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
}

function CopyButton(label: string, copiedLabel: string, payload: string, extraClass = ""): string {
  return `<button type="button" class="${escapeHtml(extraClass)}" data-copy-value="${escapeHtml(payload)}" data-copy-label="${escapeHtml(copiedLabel)}">${escapeHtml(label)}</button>`;
}

function PrintButton(extraClass = ""): string {
  return `<button type="button" class="${escapeHtml(extraClass)}" onclick="window.print()">打印 / 保存 PDF</button>`;
}

function SignalBadge(value: BriefItem["signal_strength"]): string {
  return `<span class="badge ${escapeHtml(value)}">信号 ${escapeHtml(strengthLabel(value))}</span>`;
}

function ConfidenceBadge(value: BriefItem["confidence"]): string {
  return `<span class="badge ${value === "high" ? "strong" : value === "medium" ? "medium" : "low"}">可信度 ${escapeHtml(confidenceLabel(value))}</span>`;
}

function ModeStatusBar(brief: Brief | undefined, encrypted: boolean, status?: PublicSetupStatus): string {
  const setup = statusOrDefault(status);
  const snapshot = snapshotFor(brief);
  return `<div class="meta-row" data-section="mode-status-banner">
    <span class="chip ${snapshot.isDemo ? "warn" : "ok"}">当前模式：${escapeHtml(snapshot.modeLabel)}</span>
    <span class="chip ${setup.openAiApiKeyConfigured ? "ok" : "warn"}">OpenAI：${setup.openAiApiKeyConfigured ? "已配置" : "未配置"}</span>
    <span class="chip ${setup.feishuWebhookConfigured ? "ok" : "warn"}">飞书：${setup.feishuWebhookConfigured ? "已接通" : "未配置"}</span>
    <span class="chip ${encrypted ? "ok" : "warn"}">加密：${encrypted ? "已开启" : "未开启"}</span>
  </div>`;
}

function DemoWarning(brief?: Brief): string {
  return isDemoBrief(brief) ? `<div class="demo-warning" data-section="demo-warning">当前为 Demo 样例数据，不代表真实每日情报，不建议作为正式日报发给管理层。</div>` : "";
}

function signalMeter(snapshot: GrowthSnapshot): string {
  return `<div class="signal-meter">
    <div class="meter-track"><div class="meter-fill" style="--score:${snapshot.signalScore}%"></div></div>
    <div class="meter-label"><span>今日信号强度</span><strong>${snapshot.signalScore}/100</strong></div>
  </div>`;
}

function bossSummary(brief: Brief, snapshot = snapshotFor(brief)): string {
  return [
    `老板 30 秒摘要 · ${brief.date}`,
    `今日结论：${shortText(brief.one_liner, 52)}`,
    `最大异常：${snapshot.maxAnomaly}`,
    `需要关注：${snapshot.bossAttention.slice(0, 3).map((item) => item.problem).join("；")}`,
    `今天动作：${snapshot.bossActions.map((item) => `${item.owner}-${item.action}`).join("；")}`,
    "链接：",
  ].join("\n");
}

function actionSummary(brief: Brief): string {
  return `今日行动清单 · ${brief.date}\n${brief.action_checklist.map((item, index) => `${index + 1}. ${item}`).join("\n")}`;
}

function shareSummary(brief: Brief, encrypted: boolean): string {
  return encrypted ? `YQN 管理层摘要 · ${brief.date}\n${brief.one_liner}\n链接：` : bossSummary(brief);
}

function VisualMap(): string {
  return `<aside class="visual-card" aria-label="全球仓网视觉主图">
    <div class="world-map"></div>
    <div class="radar"></div>
    <div class="container-stack"><span></span><span></span><span></span></div>
    <div class="meta-row" style="position:relative; z-index:1;">
      <span class="chip ok">北美仓网</span>
      <span class="chip">OMS / WMS / BI</span>
      <span class="chip warn">航线信号</span>
    </div>
  </aside>`;
}

function HomeHero(brief: Brief | undefined, encrypted: boolean, status?: PublicSetupStatus): string {
  return `<section class="hero" id="today" data-section="hero-3-step">
    <div class="hero-card">
      <p class="kicker">YQN Growth War Room</p>
      <h1>YQN Growth War Room</h1>
      <p class="subtitle">每日增长情报、MQL 质量、内容实验和管理层摘要自动生成。</p>
      ${ModeStatusBar(brief, encrypted, status)}
      ${DemoWarning(brief)}
      <div class="actions">
        <a class="button primary" href="boss/">看管理层摘要</a>
        <a class="button gold" href="setup/">打开配置向导</a>
      </div>
    </div>
    ${VisualMap()}
  </section>`;
}

function TopThree(brief: Brief | undefined): string {
  return `<section class="section-large panel" id="top-three" data-section="top-three">
    <div class="section-header"><div><p class="kicker">First 3 Moves</p><h2>今天先看这 3 件事</h2></div></div>
    <div class="three-step-grid">
      <article class="step-card">
        <div class="step-number">1</div>
        <h3>看管理层摘要</h3>
        <p><strong>这是什么：</strong>30 秒老板版结论。</p>
        <p><strong>解决什么：</strong>先判断今天要不要升级处理。</p>
        <p><strong>适合谁看：</strong>老板、负责人、增长负责人。</p>
        <div class="actions"><a class="button primary" href="boss/">打开老板摘要</a></div>
      </article>
      <article class="step-card">
        <div class="step-number">2</div>
        <h3>看今日行动清单</h3>
        <p><strong>这是什么：</strong>把情报转成今天该做的动作。</p>
        <p><strong>解决什么：</strong>避免日报只读不执行。</p>
        <p><strong>适合谁看：</strong>增长、销售、内容和私域。</p>
        <div class="actions"><a class="button" href="${brief ? `reports/${brief.date}/#actions` : "setup/"}">看行动清单</a></div>
      </article>
      <article class="step-card">
        <div class="step-number">3</div>
        <h3>查历史归档</h3>
        <p><strong>这是什么：</strong>按日期、月份、周次回看日报。</p>
        <p><strong>解决什么：</strong>复盘 MQL 和内容实验变化。</p>
        <p><strong>适合谁看：</strong>复盘会议、周会和月度经营会。</p>
        <div class="actions"><a class="button gold" href="archive/">打开历史归档</a></div>
      </article>
    </div>
    <div class="actions" data-section="copy-buttons">
      <a class="button primary" href="boss/">看管理层摘要</a>
      <a class="button gold" href="setup/">打开配置向导</a>
    </div>
  </section>`;
}

function MetricTile(label: string, value: string | number, meaning: string, level: "normal" | "warning" | "risk" = "normal"): string {
  return `<div class="metric ${level === "normal" ? "" : level}"><span class="metric-label">${escapeHtml(label)}</span><span class="metric-value">${escapeHtml(value)}</span><p class="metric-meaning">${escapeHtml(meaning)}</p></div>`;
}

function MqlQualityPanel(brief: Brief | undefined): string {
  const snapshot = snapshotFor(brief);
  return `<details class="section-large panel mobile-fold" id="mql-quality" data-section="mql-scorecard" open>
    <summary>MQL 看板</summary>
    <div class="section-header"><div><p class="kicker">MQL Command Board</p><h2>MQL 增长看板</h2><p>${snapshot.isDemo ? "Demo 样例数据，仅用于验收 UI。" : "用于判断线索是否值得进入销售跟进。"}</p></div><span class="badge ${snapshot.mqlQuality === "可推进" ? "strong" : "medium"}">${escapeHtml(snapshot.mqlQuality)}</span></div>
    <div class="quad-grid">
      ${MetricTile("开口数", snapshot.openingCount, "今天进入对话或可被触达的潜在线索数")}
      ${MetricTile("MQL 数", snapshot.mqlCount, "达到基本画像和意图要求的线索数")}
      ${MetricTile("开口到 MQL 转化率", snapshot.mqlRate, "开口里真正值得销售跟进的比例", snapshot.mqlRate === "待生成" ? "warning" : "normal")}
      ${MetricTile("CPL / MQL 成本", snapshot.cplPerMql, "每条 MQL 的获客成本；Demo 只展示 UI", snapshot.isDemo ? "warning" : "normal")}
      ${MetricTile("有效 MQL 数", snapshot.validMqlCount, "剔除无效原因后真正可推进的数量")}
      ${MetricTile("客户画像完整率", snapshot.profileCompleteness, "品类、平台、货量、时效等字段是否齐全")}
      ${MetricTile("销售反馈回填率", snapshot.salesFeedbackRate, "销售是否回填线索有效/无效原因", snapshot.isDemo ? "warning" : "normal")}
      ${MetricTile("链路版本", snapshot.funnelVersion, "当前线索承接链路：旧链路、企微直跳或未确认", snapshot.funnelVersion === "未确认" ? "warning" : "normal")}
    </div>
    <div class="two-grid section">
      <article class="module-card"><h3>无效原因 Top 3</h3><ol class="steps">${snapshot.invalidReasonsTop3.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol></article>
      <article class="module-card"><h3>与上周同日对比</h3><p class="boss-conclusion" style="font-size:28px;">${escapeHtml(snapshot.weekComparison)}</p><p class="muted">低于阈值的指标已用金黄色提示，下一步先补销售回填。</p></article>
    </div>
  </details>`;
}

function ExecutiveSummaryPanel(brief: Brief | undefined, encrypted: boolean): string {
  const snapshot = snapshotFor(brief);
  return `<details class="section-large panel mobile-fold" id="executive-summary" data-section="executive-summary" open>
    <summary>管理层摘要</summary>
    <div class="section-header"><div><p class="kicker">Executive Summary</p><h2>管理层经营摘要</h2></div>${brief ? CopyButton("复制老板版摘要", "已复制老板版摘要", `${shareSummary(brief, encrypted)}__URL__`, "primary") : ""}</div>
    <div class="tri-grid">
      <article class="module-card"><p class="field-label">今日结论</p><p class="field-body">${escapeHtml(brief?.one_liner || "暂无日报。先打开配置向导。")}</p><span class="badge ${snapshot.isDemo ? "medium" : "strong"}">${escapeHtml(snapshot.modeLabel)}</span></article>
      <article class="module-card"><p class="field-label">MQL 质量判断</p><p class="field-body">${escapeHtml(snapshot.mqlQuality)} · ${snapshot.mqlCount} 条 MQL</p><span class="badge">信号强度 ${snapshot.signalScore}/100</span></article>
      <article class="module-card"><p class="field-label">数据来源</p><p class="field-body">${escapeHtml(snapshot.dataSources.join(" / "))}</p><span class="badge">置信度 ${brief?.items.some((item) => item.confidence === "high") ? "高" : "中"}</span></article>
    </div>
  </details>`;
}

function OrgGapPanel(brief: Brief | undefined): string {
  const snapshot = snapshotFor(brief);
  return `<details class="section panel mobile-fold" id="org-gap" data-section="org-gap" open>
    <summary>组织缺口</summary>
    <div class="section-header"><div><p class="kicker">Organization Gap</p><h2>组织缺口</h2></div><span class="badge medium">需要协同</span></div>
    <div class="quad-grid">${snapshot.orgGaps.map((gap) => `<article class="module-card">
      <div class="archive-date"><h3>${escapeHtml(gap.name)}</h3><span class="badge ${gap.severity === "高" ? "risk" : "medium"}">${escapeHtml(gap.severity)}</span></div>
      <p class="muted">需要谁配合：${escapeHtml(gap.owner)}</p>
      <p class="field-body">${escapeHtml(gap.next)}</p>
    </article>`).join("")}</div>
  </details>`;
}

function ContentExperimentPanel(brief: Brief | undefined): string {
  const snapshot = snapshotFor(brief);
  return `<details class="section panel mobile-fold" id="content-experiment" data-section="content-experiment" open>
    <summary>内容实验</summary>
    <div class="section-header"><div><p class="kicker">Content Experiments</p><h2>内容实验判断</h2></div><span class="badge strong">小步验证</span></div>
    <div class="quad-grid">${snapshot.experiments.map((experiment) => `<article class="module-card">
      <h3>${escapeHtml(experiment.name)}</h3>
      <p class="field-label">目标</p><p class="field-body">${escapeHtml(experiment.goal)}</p>
      <p class="field-label">状态</p><p class="field-body">${escapeHtml(experiment.status)}</p>
      <p class="field-label">下一步</p><p class="field-body">${escapeHtml(experiment.next)}</p>
    </article>`).join("")}</div>
  </details>`;
}

function ActionListPanel(brief: Brief | undefined): string {
  const snapshot = snapshotFor(brief);
  const items = brief?.action_checklist.length ? brief.action_checklist : snapshot.topActions;
  return `<section class="section panel" id="actions" data-section="today-actions">
    <div class="section-header"><div><p class="kicker">Action List</p><h2>今日行动清单</h2></div>${brief ? CopyButton("复制行动清单", "已复制行动清单", actionSummary(brief), "gold") : ""}</div>
    <ol class="checklist">${items.slice(0, 5).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>
  </section>`;
}

function HistoryArchivePanel(briefs: Brief[]): string {
  const recent = briefs.slice(0, 8).map((brief) => `<a class="archive-row" href="reports/${brief.date}/">
    <div class="archive-date"><strong>${escapeHtml(brief.date)}</strong><span class="badge ${brief.is_low_signal_day ? "low" : "strong"}">${brief.is_low_signal_day ? "低信号" : isDemoBrief(brief) ? "Demo" : "真实"}</span></div>
    <span class="field-body">${escapeHtml(brief.one_liner)}</span>
    <span class="dim">${escapeHtml(topicsForBrief(brief))}</span>
  </a>`).join("") || `<div class="empty">暂无历史数据。下一步：到配置向导，手动运行一次 workflow。</div>`;
  return `<details class="section panel mobile-fold" id="history-archive" data-section="history-archive" open>
    <summary>历史归档</summary>
    <div class="section-header"><div><p class="kicker">History Archive</p><h2>历史归档</h2></div><a class="button primary" href="archive/">全部归档</a></div>
    <div class="grid">
      <div class="item-list">${recent}</div>
      <aside class="module-card">
        <h3>稳定入口</h3>
        <div class="archive-tools">${monthArchiveLinks(briefs)}</div>
        <div class="archive-tools">${weekArchiveLinks(briefs)}</div>
        <h3 class="section">日历视图</h3>
        <div class="calendar">${CalendarArchive(briefs)}</div>
      </aside>
    </div>
  </details>`;
}

function SearchPanel(encrypted: boolean): string {
  return `<details class="section panel mobile-fold" id="search" data-section="search" open>
    <summary>搜索</summary>
    <div class="section-header"><div><p class="kicker">Search / Filter</p><h2>搜索和主题筛选</h2></div><span class="badge">关键词 / 主题 / 来源</span></div>
    <p class="muted">输入“美国仓”“小红书”“AI”等关键词，或按主题筛选，结果会直接指向对应日报。</p>
    <div class="search-controls" style="margin-top:12px;">
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
  </details>`;
}

function ConfigStatusPanel(encrypted: boolean, status?: PublicSetupStatus): string {
  const setup = statusOrDefault(status);
  return `<section class="section panel" id="config-status" data-section="config-status">
    <div class="section-header"><div><p class="kicker">Setup Status</p><h2>配置与安全状态</h2></div><a class="button gold" href="setup/">打开配置向导</a></div>
    <div class="status-grid">
      ${StatusCard("OPENAI_API_KEY", setup.openAiApiKeyConfigured ? "已配置" : "缺失", setup.openAiApiKeyConfigured)}
      ${StatusCard("OPENAI_MODEL", setup.openAiModelConfigured ? "已配置" : "缺失", setup.openAiModelConfigured)}
      ${StatusCard("FEISHU_WEBHOOK_URL", setup.feishuWebhookConfigured ? "已配置" : "缺失", setup.feishuWebhookConfigured)}
      ${StatusCard("PAGE_ACCESS_PASSPHRASE", encrypted ? (setup.pageAccessPassphraseConfigured ? "已配置" : "缺失") : "未开启加密无需配置", !encrypted || setup.pageAccessPassphraseConfigured)}
      ${StatusCard("BRIEF_ENCRYPTION_ENABLED", encrypted ? "true" : "false", encrypted)}
    </div>
  </section>`;
}

function StatusCard(name: string, value: string, ok: boolean): string {
  return `<div class="status-card ${ok ? "ok" : "missing"}"><span class="metric-label">${escapeHtml(name)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function CalendarArchive(briefs: Brief[]): string {
  return briefs.map((brief) => `<a href="reports/${brief.date}/">
    <strong>${escapeHtml(brief.date)}</strong><br>
    <span class="muted">${brief.items.length} 条 · ${brief.is_low_signal_day ? "低信号" : isDemoBrief(brief) ? "Demo" : "真实"}</span>
  </a>`).join("") || `<div class="empty">暂无可点击日期。下一步：回到配置向导手动测试一次。</div>`;
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

export function renderHome(latest: Brief | undefined, briefs: Brief[], encrypted: boolean, status?: PublicSetupStatus): string {
  return `<main class="shell">
    ${HomeHero(latest, encrypted, status)}
    ${TopThree(latest)}
    ${ActionListPanel(latest)}
    ${MqlQualityPanel(latest)}
    ${ExecutiveSummaryPanel(latest, encrypted)}
    ${OrgGapPanel(latest)}
    ${ContentExperimentPanel(latest)}
    ${HistoryArchivePanel(briefs)}
    ${SearchPanel(encrypted)}
    ${ConfigStatusPanel(encrypted, status)}
  </main>`;
}

export function renderBossPage(latest: Brief | undefined, encrypted: boolean): string {
  const snapshot = snapshotFor(latest);
  return `<main class="shell boss-page">
    ${DemoWarning(latest)}
    <section class="boss-block" data-section="boss-summary">
      <p class="kicker">Boss 30 秒摘要</p>
      <h1>老板 30 秒摘要</h1>
      <p class="boss-conclusion">${escapeHtml(shortText(latest?.one_liner || "暂无日报，先完成配置。", 30))}</p>
    </section>
    <section class="boss-block">
      <h2>今天最大异常</h2>
      <p class="field-body">${escapeHtml(snapshot.maxAnomaly)}</p>
    </section>
    <section class="boss-block">
      <h2>需要老板关注</h2>
      <div class="structured-list">${snapshot.bossAttention.slice(0, 3).map((item) => `<div class="structured-item"><p><strong>问题：</strong>${escapeHtml(item.problem)}</p><p><strong>为什么需要老板：</strong>${escapeHtml(item.why)}</p><p><strong>不处理的影响：</strong>${escapeHtml(item.impact)}</p></div>`).join("")}</div>
    </section>
    <section class="boss-block">
      <h2>今天推进动作</h2>
      <div class="structured-list">${snapshot.bossActions.slice(0, 3).map((item) => `<div class="structured-item"><p><strong>负责人：</strong>${escapeHtml(item.owner)}</p><p><strong>动作：</strong>${escapeHtml(item.action)}</p><p><strong>截止时间：</strong>${escapeHtml(item.deadline)}</p><p><strong>预期结果：</strong>${escapeHtml(item.result)}</p></div>`).join("")}</div>
    </section>
    <section class="boss-block">
      <h2>两个按钮</h2>
      <div class="actions">
        ${latest ? CopyButton("复制老板版摘要", "已复制老板版摘要", `${shareSummary(latest, encrypted)}__URL__`, "primary") : ""}
        ${PrintButton("gold")}
      </div>
    </section>
  </main>`;
}

export function renderExecutivePage(latest: Brief | undefined, encrypted: boolean, status?: PublicSetupStatus): string {
  const snapshot = snapshotFor(latest);
  return `<main class="shell">
    <section class="hero">
      <div class="hero-card" data-section="executive-page">
        <p class="kicker">Executive Operating Brief</p>
        <h1>管理层经营摘要</h1>
        <p class="one-liner">${escapeHtml(latest?.one_liner || "暂无日报。先完成配置并运行 workflow。")}</p>
        ${ModeStatusBar(latest, encrypted, status)}
        ${DemoWarning(latest)}
        <div class="actions">
          ${latest ? CopyButton("复制老板版摘要", "已复制老板版摘要", `${shareSummary(latest, encrypted)}__URL__`, "primary") : ""}
          ${latest ? CopyButton("复制团队行动清单", "已复制团队行动清单", actionSummary(latest), "gold") : ""}
          ${PrintButton()}
        </div>
      </div>
      <aside class="visual-card">
        <div class="world-map"></div>
        <div class="radar"></div>
        <div class="container-stack"><span></span><span></span><span></span></div>
        <div style="position:relative;z-index:1;">
          <h2>经营判断</h2>
          ${signalMeter(snapshot)}
        </div>
      </aside>
    </section>
    <section class="section panel">
      <div class="tri-grid">
        <article class="module-card"><h3>今日结论</h3><p class="field-body">${escapeHtml(latest?.one_liner || "待生成")}</p><span class="badge">${escapeHtml(snapshot.modeLabel)}</span></article>
        <article class="module-card"><h3>MQL 质量判断</h3><p class="field-body">${escapeHtml(snapshot.mqlQuality)} · 有效 MQL ${snapshot.validMqlCount}</p><span class="badge">信号强度 ${snapshot.signalScore}/100</span></article>
        <article class="module-card"><h3>组织缺口</h3><p class="field-body">${escapeHtml(snapshot.orgGaps[0]?.name || "待生成")}：${escapeHtml(snapshot.orgGaps[0]?.next || "先补配置")}</p><span class="badge medium">需要协同</span></article>
      </div>
    </section>
    ${MqlQualityPanel(latest)}
    ${OrgGapPanel(latest)}
    ${ContentExperimentPanel(latest)}
    <section class="section panel">
      <div class="section-header"><div><p class="kicker">Coordination</p><h2>需要协同事项</h2></div></div>
      <div class="structured-list">${snapshot.bossAttention.map((item) => `<div class="structured-item"><p><strong>${escapeHtml(item.problem)}</strong></p><p>${escapeHtml(item.why)}</p><p class="muted">${escapeHtml(item.impact)}</p></div>`).join("")}</div>
    </section>
    <section class="section panel">
      <div class="section-header"><div><p class="kicker">Today Actions</p><h2>今日 3 个动作</h2></div></div>
      <div class="tri-grid">${snapshot.bossActions.map((item) => `<article class="module-card"><h3>${escapeHtml(item.owner)}</h3><p>${escapeHtml(item.action)}</p><p class="muted">${escapeHtml(item.deadline)} · ${escapeHtml(item.result)}</p></article>`).join("")}</div>
    </section>
  </main>`;
}

function SetupButton(href: string, label: string, kind = ""): string {
  return `<a class="button ${escapeHtml(kind)}" href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`;
}

function StepActionButtons(name: string, extra = ""): string {
  return `<div class="actions">
    ${CopyButton(`复制 ${name}`, "已复制 Name", name, "primary")}
    ${extra}
  </div>`;
}

export function renderSetupPage(status?: PublicSetupStatus): string {
  const setup = statusOrDefault(status);
  const testSteps = [
    "打开 Actions → Daily Briefing Portal",
    "点击 Run workflow",
    "Demo 验收可以勾选 sample_backfill",
    "真实日报不要勾选 sample_backfill",
    "等 5-10 分钟后打开正式网页检查",
  ].join("\n");
  const bossText = `老板，这是我搭的每日商业情报门户，每天自动更新，支持历史归档、搜索、按周/月查看，也能打印成 PDF：${pagesUrl}`;
  return `<main class="shell">
    <section class="hero" data-section="setup-hero">
      <div class="hero-card">
        <p class="kicker">Setup Wizard</p>
        <h1>3 分钟配置向导</h1>
        <p class="subtitle">你只差 3 个东西：OpenAI API Key、可用模型名、飞书机器人。密钥不用发给任何人，只填到 GitHub Secrets。</p>
        <div class="actions">
          ${SetupButton(secretsUrl, "打开 GitHub Secrets", "primary")}
          ${SetupButton(variablesUrl, "打开 GitHub Variables", "gold")}
          ${SetupButton(actionsUrl, "打开 Actions 测试")}
          ${SetupButton(pagesUrl, "打开正式网页")}
        </div>
      </div>
      ${VisualMap()}
    </section>
    <section class="section panel" data-section="setup-progress">
      <div class="section-header"><div><p class="kicker">Progress</p><h2>配置进度条</h2></div></div>
      <div class="setup-progress">
        <div class="progress-step"><strong>第 1 步</strong>OpenAI API Key</div>
        <div class="progress-step"><strong>第 2 步</strong>OpenAI Model</div>
        <div class="progress-step"><strong>第 3 步</strong>飞书机器人</div>
        <div class="progress-step"><strong>第 4 步</strong>加密密码</div>
        <div class="progress-step"><strong>第 5 步</strong>手动测试一次</div>
      </div>
    </section>
    <section class="section panel" data-section="setup-status">
      <div class="section-header"><div><p class="kicker">Safe Boolean Status</p><h2>配置状态面板</h2><p>这里只显示“已配置/未配置”，不会显示任何 secret 内容。</p></div></div>
      <div class="status-grid">
        ${StatusCard("OPENAI_API_KEY", setup.openAiApiKeyConfigured ? "已配置" : "缺失", setup.openAiApiKeyConfigured)}
        ${StatusCard("OPENAI_MODEL", setup.openAiModelConfigured ? "已配置" : "缺失", setup.openAiModelConfigured)}
        ${StatusCard("FEISHU_WEBHOOK_URL", setup.feishuWebhookConfigured ? "已配置" : "缺失", setup.feishuWebhookConfigured)}
        ${StatusCard("PAGE_ACCESS_PASSPHRASE", setup.encryptionEnabled ? (setup.pageAccessPassphraseConfigured ? "已配置" : "缺失") : "未开启加密无需配置", !setup.encryptionEnabled || setup.pageAccessPassphraseConfigured)}
        ${StatusCard("BRIEF_ENCRYPTION_ENABLED", setup.encryptionEnabled ? "true" : "false", setup.encryptionEnabled)}
      </div>
    </section>
    ${SetupOpenAiKeyStep()}
    ${SetupOpenAiModelStep()}
    ${SetupFeishuStep()}
    ${SetupEncryptionStep()}
    <section class="section setup-step" data-section="setup-run-workflow">
      <div class="section-header"><div><p class="kicker">Step 5</p><h2>手动测试一次</h2></div></div>
      <div class="setup-grid">
        <div>
          <p><strong>打开哪里：</strong>GitHub 仓库 → Actions → Daily Briefing Portal。</p>
          <p><strong>点哪里：</strong>Run workflow。</p>
          <p><strong>Demo 验收：</strong>可以勾选 <code>sample_backfill</code>。</p>
          <p><strong>真实日报：</strong>不要勾选 <code>sample_backfill</code>。</p>
          <p><strong>brief_date 填什么：</strong>今天日期，或留空用当前日期。</p>
          <p><strong>等多久：</strong>通常 5-10 分钟。</p>
          <p><strong>成功后看什么：</strong>首页状态从 Demo 变成真实日报，<code>/reports/YYYY-MM-DD/</code> 出现，飞书收到入口卡片。</p>
          <p><strong>失败后截图哪里：</strong>Actions 失败页面和失败 step 展开内容，不要截图密钥。</p>
        </div>
        <aside class="setup-note">做完点这里验证。配错了也不会泄露密钥，只会在 Actions 里显示失败原因。</aside>
      </div>
      <div class="actions">
        ${SetupButton(actionsUrl, "打开 Actions 测试", "primary")}
        ${CopyButton("复制测试步骤", "已复制测试步骤", testSteps, "gold")}
        ${CopyButton("复制发给老板的话", "已复制老板话术", bossText)}
      </div>
    </section>
  </main>`;
}

function SetupOpenAiKeyStep(): string {
  return `<section class="section setup-step" data-section="setup-openai-key">
    <div class="section-header"><div><p class="kicker">Step 1</p><h2>配置 OPENAI_API_KEY</h2></div><span class="badge risk">真实日报必须</span></div>
    <div class="setup-grid">
      <div>
        <p><strong>这是干什么的：</strong>让系统每天调用 OpenAI API 生成真实日报。</p>
        <p><strong>为什么必须用户自己配：</strong>这是付费密钥，不能发给 Codex，也不能写进代码。</p>
        <p><strong>打开哪里：</strong>GitHub 仓库 → Settings → Secrets and variables → Actions → Secrets。</p>
        <p><strong>点哪里：</strong>New repository secret。</p>
        <p><strong>Name 填什么：</strong><code>OPENAI_API_KEY</code></p>
        <p><strong>Value 填什么：</strong>你的 OpenAI API Key。</p>
        <p><strong>保存按钮：</strong>Add secret。</p>
        <p><strong>配错表现：</strong>日报生成失败，页面仍显示 Demo / 配置待完成。</p>
      </div>
      <aside class="setup-note">先做这个。不用把密钥发给任何人，也不要截图密钥。</aside>
    </div>
    ${StepActionButtons("OPENAI_API_KEY", `${SetupButton(secretsUrl, "打开 GitHub Secrets", "gold")}${SetupButton(openAiKeyUrl, "查看怎么获取 OpenAI API Key")}`)}
  </section>`;
}

function SetupOpenAiModelStep(): string {
  return `<section class="section setup-step" data-section="setup-openai-model">
    <div class="section-header"><div><p class="kicker">Step 2</p><h2>配置 OPENAI_MODEL</h2></div><span class="badge risk">真实日报必须</span></div>
    <div class="setup-grid">
      <div>
        <p><strong>这是干什么的：</strong>告诉系统用哪个 OpenAI API 模型生成日报。</p>
        <p><strong>重要提醒：</strong>页面不会把未经确认的模型名写死成唯一默认值。</p>
        <p><strong>打开哪里：</strong>GitHub 仓库 → Settings → Secrets and variables → Actions → Variables。</p>
        <p><strong>点哪里：</strong>New repository variable。</p>
        <p><strong>Name 填什么：</strong><code>OPENAI_MODEL</code></p>
        <p><strong>Value 填什么：</strong>填写你 OpenAI API 账号里实际可用的模型名，优先选择你账号可用的低成本 mini 模型。</p>
        <p><strong>配错表现：</strong>Actions 会报模型不可用。</p>
      </div>
      <aside class="setup-note">不要猜模型。以你自己的 OpenAI API 账号可用模型为准。</aside>
    </div>
    ${StepActionButtons("OPENAI_MODEL", `${SetupButton(variablesUrl, "打开 GitHub Variables", "gold")}${SetupButton(openAiModelsUrl, "打开 OpenAI 模型文档")}`)}
  </section>`;
}

function SetupFeishuStep(): string {
  return `<section class="section setup-step" data-section="setup-feishu">
    <div class="section-header"><div><p class="kicker">Step 3</p><h2>配置 FEISHU_WEBHOOK_URL</h2></div><span class="badge medium">需要飞书通知时必须</span></div>
    <div class="setup-grid">
      <div>
        <p><strong>这是干什么的：</strong>每天网页生成后，飞书群收到入口卡片。</p>
        <p><strong>打开哪里：</strong>飞书群 → 群设置 → 机器人 → 添加自定义机器人。</p>
        <p><strong>复制什么：</strong>webhook 地址。</p>
        <p><strong>GitHub 里填哪里：</strong>Settings → Secrets and variables → Actions → Secrets。</p>
        <p><strong>Name 填什么：</strong><code>FEISHU_WEBHOOK_URL</code></p>
        <p><strong>Value 填什么：</strong>飞书机器人 webhook。</p>
        <p><strong>保存按钮：</strong>Add secret。</p>
        <p><strong>配错表现：</strong>网页能更新，但飞书不会通知。</p>
      </div>
      <aside class="setup-note">飞书只发入口卡片，不会把完整日报正文发进群里。</aside>
    </div>
    ${StepActionButtons("FEISHU_WEBHOOK_URL", SetupButton(secretsUrl, "打开 GitHub Secrets", "gold"))}
  </section>`;
}

function SetupEncryptionStep(): string {
  return `<section class="section setup-step" data-section="setup-encryption">
    <div class="section-header"><div><p class="kicker">Step 4</p><h2>配置 PAGE_ACCESS_PASSPHRASE</h2></div><span class="badge medium">正式内容建议开启</span></div>
    <div class="setup-grid">
      <div>
        <p><strong>这是干什么的：</strong>开启加密后，用这个密码解锁日报正文。</p>
        <p><strong>正式使用建议：</strong>开启加密，减少公开网页暴露完整内容。</p>
        <p><strong>Name 填什么：</strong><code>PAGE_ACCESS_PASSPHRASE</code></p>
        <p><strong>Value 填什么：</strong>你自己设置的强密码，不得在聊天里发给 Codex。</p>
        <p><strong>配错表现：</strong>加密模式下无法解锁正文。</p>
        <p><strong>密码规则：</strong>建议 12 位以上，包含英文大小写、数字和符号；不要用公司名、生日、手机号。</p>
      </div>
      <aside class="setup-note">这里不会生成真实密码并保存。密码必须你自己设置，自己保存。</aside>
    </div>
    ${StepActionButtons("PAGE_ACCESS_PASSPHRASE", `${SetupButton(secretsUrl, "打开 GitHub Secrets", "gold")}${CopyButton("复制密码建议规则", "已复制密码建议规则", "12 位以上，包含英文大小写、数字和符号；不要用公司名、生日、手机号。")}`)}
  </section>`;
}

function ReportCard(item: BriefItem, index: number): string {
  return `<details class="report-card" ${index === 0 ? "open" : ""} data-section="${index === 0 ? "report-card" : ""}">
    <summary>${escapeHtml(item.title)}</summary>
    <div class="meta-row">
      <span class="badge">${escapeHtml(topicLabels[item.topic])}</span>
      ${SignalBadge(item.signal_strength)}
      ${ConfidenceBadge(item.confidence)}
      <a class="source-link" href="${escapeHtml(item.source_url)}" rel="noreferrer">${escapeHtml(item.source_domain)}</a>
    </div>
    <div class="intel-fields">
      <div class="field-block"><p class="field-label">发生了什么</p><p class="field-body">${escapeHtml(item.what_happened)}</p></div>
      <div class="field-block"><p class="field-label">为什么重要</p><p class="field-body">${escapeHtml(item.why_it_matters)}</p></div>
      <div class="field-block"><p class="field-label">对 YQN 的启发</p><p class="field-body">${escapeHtml(item.yqn_insight)}</p></div>
      <div class="field-block"><p class="field-label">今天可以做的动作</p><p class="field-body">${escapeHtml(item.today_action)}</p></div>
      <div class="field-block"><p class="field-label">来源</p><p class="field-body"><a class="source-link" href="${escapeHtml(item.source_url)}" rel="noreferrer">${escapeHtml(item.source_title)} · ${escapeHtml(item.source_domain)}</a></p></div>
    </div>
    <div class="actions">${CopyButton("复制这条情报", "已复制这条情报", `${item.title}\n${item.today_action}\n${item.source_url}`, "gold")}</div>
  </details>`;
}

function reportNav(previousDate?: string, nextDate?: string): string {
  return `<div class="nav-links">
    ${previousDate ? `<a class="button" href="reports/${previousDate}/">上一天 ${escapeHtml(previousDate)}</a>` : `<span class="chip">没有上一天</span>`}
    ${nextDate ? `<a class="button" href="reports/${nextDate}/">下一天 ${escapeHtml(nextDate)}</a>` : `<span class="chip">没有下一天</span>`}
  </div>`;
}

export function renderBriefStatic(brief: Brief, previousDate?: string, nextDate?: string): string {
  const snapshot = snapshotFor(brief);
  const items = brief.items.length ? brief.items.map(ReportCard).join("") : `<div class="empty">今天没有足够强信号。下一步：检查来源采集和 GitHub Actions 运行结果，不要把弱消息包装成机会。</div>`;
  return `<main class="shell">
    <section class="hero">
      <div class="hero-card">
        <p class="kicker">Report · ${escapeHtml(brief.date)}</p>
        <h1>日报详情</h1>
        <p class="one-liner">${escapeHtml(brief.one_liner)}</p>
        <div class="meta-row">
          <span class="chip ${snapshot.isDemo ? "warn" : "ok"}">${escapeHtml(snapshot.modeLabel)}</span>
          <span class="chip">日期 ${escapeHtml(brief.date)}</span>
          <span class="chip">${brief.is_low_signal_day ? "低信号日" : "正常信号日"}</span>
          <span class="chip">生成 ${escapeHtml(brief.generated_at)}</span>
        </div>
        ${DemoWarning(brief)}
        <div class="actions" data-section="copy-actions">
          ${CopyButton("复制分享链接", "已复制链接", "__URL__", "primary")}
          ${PrintButton()}
          ${CopyButton("复制老板版摘要", "已复制老板版摘要", `${bossSummary(brief, snapshot)}__URL__`, "gold")}
          ${CopyButton("复制今日行动清单", "已复制行动清单", actionSummary(brief))}
        </div>
      </div>
      <aside class="visual-card">
        <div class="world-map"></div>
        <div class="radar"></div>
        <div class="container-stack"><span></span><span></span><span></span></div>
        <div style="position:relative;z-index:1;"><h2>报告导航</h2>${signalMeter(snapshot)}<div class="section">${reportNav(previousDate, nextDate)}</div><div class="report-actions section" data-section="print-actions"><strong>打印提示：</strong><p class="muted">点击“打印 / 保存 PDF”后，在系统打印窗口选择保存为 PDF。</p></div></div>
      </aside>
    </section>
    <section class="section panel">
      <div class="section-header"><div><p class="kicker">Summary</p><h2>管理层摘要</h2></div><a class="button" href="boss/">看老板 30 秒摘要</a></div>
      <p class="field-body">${escapeHtml(brief.executive_summary)}</p>
    </section>
    <section class="grid">
      <div class="panel">
        <div class="section-header"><div><p class="kicker">Signal Cards</p><h2>核心情报卡片</h2></div><span class="badge">手机端默认折叠</span></div>
        <div class="item-list">${items}</div>
      </div>
      <aside class="panel" id="actions">
        <h2>今日行动清单</h2>
        <ol class="checklist">${brief.action_checklist.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>
        <h2 class="section">来源链接</h2>
        <ul class="source-list">${brief.sources.map((source) => `<li><a class="source-link" href="${escapeHtml(source.url)}" rel="noreferrer">${escapeHtml(source.title)} · ${escapeHtml(source.domain)}</a></li>`).join("")}</ul>
      </aside>
    </section>
  </main>`;
}

export function renderLockedReport(brief: Brief, previousDate?: string, nextDate?: string): string {
  return `<main class="shell">
    <section class="hero">
      <div class="hero-card">
        <p class="kicker">Encrypted Report · ${escapeHtml(brief.date)}</p>
        <h1>加密日报</h1>
        <p class="one-liner">${escapeHtml(brief.one_liner)}</p>
        <div class="meta-row"><span class="chip">日期 ${escapeHtml(brief.date)}</span><span class="chip ok">客户端加密</span><span class="chip">${brief.is_low_signal_day ? "低信号日" : "正常信号日"}</span></div>
        <div class="actions">${CopyButton("复制分享链接", "已复制链接", "__URL__", "primary")}${PrintButton()}</div>
      </div>
      <aside class="visual-card locked">
        <div class="world-map"></div>
        <div style="position:relative;z-index:1;"><h2>加密状态</h2><p class="setup-note">完整日报、来源和搜索索引已加密发布。密码只在浏览器本地用于解锁；这不是企业级登录系统。</p>${reportNav(previousDate, nextDate)}</div>
      </aside>
    </section>
    ${EncryptionUnlockPanel()}
    <div id="briefRoot"></div>
  </main>`;
}

function EncryptionUnlockPanel(): string {
  return `<section class="section panel locked" id="lockedPanel" data-section="encryption-unlock">
    <p class="kicker">Secure Client Unlock</p>
    <h2>输入访问密码</h2>
    <p class="muted">输错密码不会显示正文。公开页面只保留站点名称、日期和有限预览。</p>
    <div class="search-controls" style="margin-top:12px;">
      <input id="passphrase" type="password" placeholder="输入页面访问密码">
      <button id="unlockBrief" type="button" class="primary">解锁日报</button>
    </div>
    <p id="unlockStatus" class="muted" style="margin-top:10px;">等待输入密码。</p>
  </section>`;
}

export function renderArchivePage(title: string, briefs: Brief[]): string {
  const rows = briefs.map((brief) => `<a class="archive-row" href="reports/${brief.date}/">
    <div class="archive-date"><strong>${escapeHtml(brief.date)}</strong><span class="badge ${brief.is_low_signal_day ? "low" : isDemoBrief(brief) ? "medium" : "strong"}">${brief.is_low_signal_day ? "低信号日" : isDemoBrief(brief) ? "Demo" : "真实日报"}</span></div>
    <span class="field-body">${escapeHtml(brief.one_liner)}</span>
    <span class="dim">${escapeHtml(topicsForBrief(brief))}</span>
  </a>`).join("") || `<div class="empty">暂无历史数据。下一步：到配置向导手动生成样例或真实日报。</div>`;
  return `<main class="shell">
    <section class="hero">
      <div class="hero-card">
        <p class="kicker">Archive Intelligence</p>
        <h1>${escapeHtml(title)}</h1>
        <p class="one-liner">按日期、月份、周次查看永久日报，快速回看某段时间的增长信号变化。</p>
        <div class="archive-tools"><a class="button primary" href="archive/">全部历史</a>${monthArchiveLinks(briefs)}${weekArchiveLinks(briefs)}</div>
      </div>
      ${VisualMap()}
    </section>
    <section class="grid">
      <div class="panel"><div class="section-header"><div><p class="kicker">History Cards</p><h2>历史卡片</h2></div></div><div class="item-list">${rows}</div></div>
      <aside class="panel" data-section="calendar"><h2>日历视图</h2><div class="calendar">${CalendarArchive(briefs)}</div></aside>
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
  if (!status) return;
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
  return '<details class="report-card" open><summary>' + htmlEscape(item.title) + '</summary><div class="meta-row"><span class="badge">' + htmlEscape(topicLabels[item.topic]) + '</span><span class="badge ' + htmlEscape(item.signal_strength) + '">信号 ' + htmlEscape(item.signal_strength) + '</span><span class="badge">可信度 ' + htmlEscape(item.confidence) + '</span><a class="source-link" href="' + htmlEscape(item.source_url) + '" rel="noreferrer">' + htmlEscape(item.source_domain) + '</a></div><div class="intel-fields"><div class="field-block"><p class="field-label">发生了什么</p><p class="field-body">' + htmlEscape(item.what_happened) + '</p></div><div class="field-block"><p class="field-label">为什么重要</p><p class="field-body">' + htmlEscape(item.why_it_matters) + '</p></div><div class="field-block"><p class="field-label">对 YQN 的启发</p><p class="field-body">' + htmlEscape(item.yqn_insight) + '</p></div><div class="field-block"><p class="field-label">今天可以做的动作</p><p class="field-body">' + htmlEscape(item.today_action) + '</p></div><div class="field-block"><p class="field-label">来源</p><p class="field-body"><a class="source-link" href="' + htmlEscape(item.source_url) + '" rel="noreferrer">' + htmlEscape(item.source_title) + ' · ' + htmlEscape(item.source_domain) + '</a></p></div></div></details>';
}
function renderBrief(brief) {
  const root = document.getElementById('briefRoot');
  const items = brief.items.length ? brief.items.map(renderItem).join('') : '<div class="empty">今天没有足够强信号。下一步：检查来源采集和 GitHub Actions 运行结果。</div>';
  root.innerHTML = '<section class="section panel"><h2>执行摘要</h2><p class="field-body">' + htmlEscape(brief.executive_summary) + '</p></section><section class="grid"><div class="panel"><h2>核心情报卡片</h2><div class="item-list">' + items + '</div></div><aside class="panel"><h2>今日行动清单</h2><ol class="checklist">' + brief.action_checklist.map((item) => '<li>' + htmlEscape(item) + '</li>').join('') + '</ol><h2 class="section">来源链接</h2><ul class="source-list">' + brief.sources.map((source) => '<li><a class="source-link" href="' + htmlEscape(source.url) + '" rel="noreferrer">' + htmlEscape(source.title) + ' · ' + htmlEscape(source.domain) + '</a></li>').join('') + '</ul></aside></section>';
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
    portalToast('日报已解锁');
  } catch (error) {
    status.textContent = '密码错误或日报无法解密。正文仍未显示。';
  }
}
document.getElementById('unlockBrief')?.addEventListener('click', unlockBrief);
document.getElementById('passphrase')?.addEventListener('keydown', (event) => { if (event.key === 'Enter') unlockBrief(); });
`;
}

export function topicFromEntry(item?: { topic?: Topic }): Topic | "" {
  return item?.topic || "";
}
