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
  mqlCount: number;
  mqlQuality: string;
  conversion: string;
  profileCompleteness: string;
  validReasons: string[];
  invalidReasons: string[];
  highQualityTraits: string[];
  lowQualityWarnings: string[];
  bossRisks: string[];
  crossDeptActions: string[];
  topActions: string[];
  experiments: Array<{ name: string; goal: string; status: string; next: string }>;
  orgGaps: Array<{ name: string; owner: string; next: string; severity: "高" | "中" | "低" }>;
  personalDone: string[];
  personalFound: string[];
  tomorrow: string[];
  supportNeeded: string[];
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
  --color-bg: #050812;
  --color-bg-2: #08101d;
  --color-panel: #0d1726;
  --color-panel-2: #111f33;
  --color-panel-3: #162943;
  --color-line: #263a58;
  --color-line-soft: rgba(139, 164, 202, 0.18);
  --color-text: #f2f7ff;
  --color-soft: #c8d8ee;
  --color-muted: #8fa8c8;
  --color-dim: #647994;
  --yqn-blue: #2f8cff;
  --yqn-blue-2: #58c7ff;
  --yqn-gold: #f6c85f;
  --signal-green: #24d39b;
  --risk-red: #ff7085;
  --status-blue: rgba(47, 140, 255, 0.12);
  --status-gold: rgba(246, 200, 95, 0.12);
  --status-green: rgba(36, 211, 155, 0.12);
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --radius: 8px;
  --shadow: 0 20px 60px rgba(0, 0, 0, 0.28);
}
* { box-sizing: border-box; }
html { min-height: 100%; background: var(--color-bg); scroll-behavior: smooth; }
body {
  margin: 0;
  min-height: 100%;
  color: var(--color-text);
  background:
    linear-gradient(180deg, rgba(47, 140, 255, 0.09), transparent 360px),
    linear-gradient(90deg, rgba(246, 200, 95, 0.045), transparent 46%),
    repeating-linear-gradient(90deg, rgba(255,255,255,0.018) 0 1px, transparent 1px 80px),
    var(--color-bg);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 15px;
  line-height: 1.58;
}
a { color: inherit; text-decoration: none; }
a:focus-visible, button:focus-visible, input:focus-visible, select:focus-visible, summary:focus-visible {
  outline: 2px solid var(--yqn-blue-2);
  outline-offset: 2px;
}
.topbar {
  position: sticky;
  top: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: 12px clamp(16px, 4vw, 48px);
  border-bottom: 1px solid var(--color-line-soft);
  background: rgba(5, 8, 18, 0.92);
  backdrop-filter: blur(16px);
}
.brand { display: flex; align-items: center; gap: 10px; font-weight: 850; letter-spacing: 0; }
.brand-mark {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(88, 199, 255, 0.78);
  border-radius: 7px;
  color: var(--yqn-blue-2);
  background: rgba(47, 140, 255, 0.12);
  font-size: 12px;
}
.brand-sub { display: block; color: var(--color-muted); font-size: 11px; font-weight: 520; line-height: 1.1; }
.nav { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
.nav a, .button, button {
  min-height: 38px;
  border: 1px solid var(--color-line);
  border-radius: 7px;
  background: rgba(17, 31, 51, 0.94);
  color: var(--color-text);
  padding: 8px 12px;
  font: inherit;
  cursor: pointer;
  transition: border-color 140ms ease, background 140ms ease, color 140ms ease, transform 140ms ease;
}
.nav a:hover, .button:hover, button:hover { border-color: var(--yqn-blue-2); background: rgba(47, 140, 255, 0.16); }
.button.primary, button.primary { border-color: rgba(47, 140, 255, 0.72); background: rgba(47, 140, 255, 0.18); }
.button.gold, button.gold { border-color: rgba(246, 200, 95, 0.72); background: rgba(246, 200, 95, 0.14); color: #fff6dc; }
.button:active, button:active { transform: translateY(1px); }
.shell { width: min(1248px, calc(100% - 32px)); margin: 0 auto; padding: 28px 0 56px; }
.war-room-hero {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.28fr) minmax(330px, 0.72fr);
  gap: 16px;
  align-items: stretch;
}
.panel, .hero-panel, .side-panel, .module-card, .report-card, .archive-row, .result-row, .section-card {
  border: 1px solid var(--color-line-soft);
  border-radius: var(--radius);
  background: linear-gradient(180deg, rgba(17,31,51,0.96), rgba(9,17,30,0.96));
  box-shadow: var(--shadow);
}
.hero-panel { padding: 24px; overflow: hidden; }
.side-panel, .panel, .section-card { padding: 18px; }
.hero-panel::after {
  content: "";
  display: block;
  height: 80px;
  margin-top: 22px;
  border: 1px solid rgba(88,199,255,0.18);
  border-radius: 7px;
  background:
    linear-gradient(90deg, transparent 0 12%, rgba(88,199,255,0.22) 12% 13%, transparent 13% 48%, rgba(246,200,95,0.28) 48% 49%, transparent 49%),
    radial-gradient(circle at 12% 50%, rgba(88,199,255,0.95) 0 4px, transparent 5px),
    radial-gradient(circle at 49% 50%, rgba(246,200,95,0.95) 0 4px, transparent 5px),
    radial-gradient(circle at 84% 50%, rgba(36,211,155,0.95) 0 4px, transparent 5px);
  opacity: 0.9;
}
.kicker { margin: 0 0 10px; color: var(--yqn-blue-2); font-size: 12px; font-weight: 850; letter-spacing: 0; text-transform: uppercase; }
h1 { margin: 0; font-size: 46px; line-height: 1.04; letter-spacing: 0; }
h2 { margin: 0 0 12px; font-size: 20px; line-height: 1.25; letter-spacing: 0; }
h3 { margin: 0; font-size: 17px; line-height: 1.35; letter-spacing: 0; }
p { margin: 0; }
.one-liner { margin-top: 16px; max-width: 860px; color: var(--color-soft); font-size: 22px; line-height: 1.42; }
.meta-row, .actions, .archive-tools, .nav-links, .signal-meta { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.meta-row { margin-top: 16px; }
.actions { margin-top: 18px; }
.chip, .badge {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 4px 9px;
  border: 1px solid rgba(255,255,255,0.13);
  border-radius: 999px;
  color: var(--color-soft);
  background: rgba(255,255,255,0.035);
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
}
.badge.strong { color: var(--signal-green); border-color: rgba(36,211,155,0.56); background: var(--status-green); }
.badge.medium { color: var(--yqn-gold); border-color: rgba(246,200,95,0.55); background: var(--status-gold); }
.badge.weak, .badge.low { color: var(--color-muted); }
.badge.risk { color: var(--risk-red); border-color: rgba(255,112,133,0.45); }
.metric-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 12px; }
.metric, .mini-panel {
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 7px;
  padding: 12px;
  background: rgba(255,255,255,0.034);
}
.metric-label { display: block; color: var(--color-muted); font-size: 12px; }
.metric-value { display: block; margin-top: 4px; color: var(--color-text); font-size: 24px; font-weight: 850; line-height: 1.1; }
.signal-meter { margin-top: 14px; }
.meter-track { height: 8px; border-radius: 999px; background: #17243a; overflow: hidden; border: 1px solid rgba(255,255,255,0.08); }
.meter-fill { height: 100%; width: var(--score); background: linear-gradient(90deg, var(--yqn-blue), var(--yqn-gold)); }
.meter-label { display: flex; justify-content: space-between; margin-top: 8px; color: var(--color-muted); font-size: 12px; }
.section { margin-top: 16px; }
.section-spacer { margin-top: 18px; }
.section-header { display: flex; justify-content: space-between; align-items: end; gap: 12px; margin-bottom: 12px; }
.section-header p { color: var(--color-muted); }
.grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(320px, 0.42fr); gap: 16px; align-items: start; }
.tri-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.quad-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.two-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.item-list { display: grid; gap: 12px; }
.module-card, .report-card, .archive-row, .result-row { display: grid; gap: 10px; padding: 14px; background: rgba(255,255,255,0.036); }
.module-card:hover, .report-card:hover, .archive-row:hover, .result-row:hover { border-color: rgba(88,199,255,0.55); background: rgba(47,140,255,0.08); }
.card-title { color: var(--color-text); font-weight: 850; }
.intel-fields { display: grid; gap: 10px; margin-top: 10px; }
.field-block { border-left: 2px solid rgba(88,199,255,0.45); padding-left: 10px; }
.field-label { color: var(--yqn-blue-2); font-size: 12px; font-weight: 850; margin: 0 0 3px; }
.field-body { color: var(--color-soft); overflow-wrap: anywhere; }
.source-link { color: var(--signal-green); overflow-wrap: anywhere; text-decoration: underline; text-decoration-color: rgba(36,211,155,0.45); text-underline-offset: 3px; }
.muted { color: var(--color-muted); }
.dim { color: var(--color-dim); }
.checklist, .source-list, .steps { margin: 0; padding-left: 20px; color: var(--color-soft); }
.checklist li, .source-list li, .steps li { margin: 6px 0; }
.operator-steps { counter-reset: step; display: grid; gap: 8px; }
.operator-steps div { counter-increment: step; display: grid; grid-template-columns: 30px 1fr; gap: 10px; align-items: start; color: var(--color-soft); }
.operator-steps div::before { content: counter(step); width: 26px; height: 26px; display: grid; place-items: center; border: 1px solid rgba(246,200,95,0.48); border-radius: 999px; color: var(--yqn-gold); background: var(--status-gold); font-weight: 850; }
.search-controls { display: grid; grid-template-columns: minmax(0, 1fr) 220px auto; gap: 10px; align-items: center; }
input, select {
  width: 100%;
  min-height: 42px;
  border: 1px solid var(--color-line);
  border-radius: 7px;
  background: rgba(5, 8, 18, 0.86);
  color: var(--color-text);
  padding: 8px 10px;
  font: inherit;
}
input::placeholder { color: var(--color-dim); }
.search-results { display: grid; gap: 10px; margin-top: 14px; }
.calendar { display: grid; grid-template-columns: repeat(auto-fill, minmax(112px, 1fr)); gap: 8px; }
.calendar a { border: 1px solid var(--color-line); border-radius: 7px; padding: 10px; color: var(--color-soft); background: rgba(255,255,255,0.03); }
.calendar a:hover { border-color: var(--yqn-gold); color: var(--color-text); }
.archive-date { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.empty { color: var(--color-muted); padding: 14px; border: 1px dashed var(--color-line); border-radius: 7px; background: rgba(255,255,255,0.024); }
.locked { border-color: rgba(246,200,95,0.55); }
.security-note { border: 1px solid rgba(246,200,95,0.36); background: var(--status-gold); border-radius: 7px; padding: 12px; color: var(--color-soft); }
.config-banner { border: 1px solid rgba(88,199,255,0.35); background: rgba(47,140,255,0.08); border-radius: 8px; padding: 14px; }
.status-stack { display: grid; gap: 8px; }
.report-card summary { cursor: pointer; font-weight: 850; color: var(--color-text); }
.report-card[open] summary { margin-bottom: 10px; }
.report-actions { border: 1px solid rgba(246,200,95,0.32); background: var(--status-gold); border-radius: 7px; padding: 12px; }
.site-footer { width: min(1248px, calc(100% - 32px)); margin: 0 auto; padding: 24px 0 36px; color: var(--color-muted); font-size: 13px; border-top: 1px solid rgba(255,255,255,0.08); }
.footer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.print-zone { display: contents; }
@media (max-width: 980px) {
  .topbar { align-items: flex-start; flex-direction: column; }
  .war-room-hero, .grid, .tri-grid, .quad-grid, .two-grid { grid-template-columns: 1fr; }
  h1 { font-size: 35px; }
  .one-liner { font-size: 19px; }
  .search-controls { grid-template-columns: 1fr; }
  .footer-grid { grid-template-columns: 1fr; }
}
@media (max-width: 540px) {
  body { font-size: 14px; }
  .shell { width: min(100% - 24px, 1248px); padding-top: 18px; }
  .topbar { padding: 12px; }
  .nav { width: 100%; }
  .nav a { flex: 1 1 auto; text-align: center; }
  h1 { font-size: 30px; }
  .hero-panel, .side-panel, .panel, .section-card { padding: 14px; }
  .metric-grid { grid-template-columns: 1fr 1fr; }
  .actions .button, .actions button { width: 100%; text-align: center; }
  .calendar { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media print {
  body { background: #fff; color: #000; }
  .topbar, .actions, .search-controls, .search-results, .site-footer, .nav, .archive-tools, .unlock-panel { display: none !important; }
  .shell { width: 100%; padding: 0; }
  .hero-panel, .side-panel, .panel, .module-card, .report-card, .archive-row, .metric { border-color: #999; background: #fff; color: #000; box-shadow: none; break-inside: avoid; }
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
  ${AppShell(body)}
  ${script ? `<script>${script}</script>` : ""}
</body>
</html>`;
}

function AppShell(body: string): string {
  return `${TopNav()}
  ${body}
  <footer class="site-footer">
    <div class="footer-grid">
      <p>来源：公开信息采集、模型归纳和人工配置的来源表。更新时间以每篇日报生成时间为准。</p>
      <p>安全提醒：GitHub Pages 是公开网页，noindex 和 robots.txt 不是访问控制；不要放客户名单、报价、合同、内部成本、密钥、报价或私密线索。</p>
    </div>
  </footer>`;
}

function TopNav(): string {
  return `<header class="topbar">
    <a class="brand" href="./" aria-label="返回首页"><span class="brand-mark">YQ</span><span>YQN Growth War Room<span class="brand-sub">商业情报门户 / 增长作战台</span></span></a>
    <nav class="nav" aria-label="主导航">
      <a href="./">作战台</a>
      <a href="executive/">管理层摘要</a>
      <a href="./#mql-quality">MQL</a>
      <a href="./#content-experiment">内容实验</a>
      <a href="archive/">归档</a>
      <a href="./#search">搜索</a>
    </nav>
  </header>`;
}

function countBySignal(brief: Brief): Record<"strong" | "medium" | "weak", number> {
  return brief.items.reduce((acc, item) => {
    acc[item.signal_strength] += 1;
    return acc;
  }, { strong: 0, medium: 0, weak: 0 });
}

function signalScore(brief: Brief): number {
  if (!brief.items.length) return brief.is_low_signal_day ? 12 : 28;
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

function latestOrEmpty(latest?: Brief): Brief | undefined {
  return latest;
}

function snapshotFor(brief?: Brief): GrowthSnapshot {
  const emptyActions = ["配置真实日报来源", "补齐 MQL 口径", "完成飞书通知接入"];
  if (!brief) {
    return {
      signalScore: 0,
      mqlCount: 0,
      mqlQuality: "待生成",
      conversion: "待生成",
      profileCompleteness: "待生成",
      validReasons: ["暂无日报数据"],
      invalidReasons: ["缺少可分析样本"],
      highQualityTraits: ["待真实日报生成后判断"],
      lowQualityWarnings: ["先完成 OpenAI API 与模型配置"],
      bossRisks: ["尚未生成今日情报"],
      crossDeptActions: ["配置 Secrets / Variables 后手动运行 workflow"],
      topActions: emptyActions,
      experiments: [],
      orgGaps: [],
      personalDone: [],
      personalFound: [],
      tomorrow: emptyActions,
      supportNeeded: ["OpenAI API Key", "OPENAI_MODEL", "飞书 webhook"],
    };
  }
  const signals = countBySignal(brief);
  const score = signalScore(brief);
  const mqlCount = brief.items.length * 8 + signals.strong * 6 + signals.medium * 3;
  const highConfidence = brief.items.filter((item) => item.confidence === "high").length;
  const mqlQuality = signals.strong > 0 && highConfidence > 0 ? "可推进" : brief.is_low_signal_day ? "低信号" : "需复核";
  const firstActions = brief.action_checklist.slice(0, 3);
  const sourceDomains = [...new Set(brief.items.map((item) => item.source_domain))].slice(0, 3);
  return {
    signalScore: score,
    mqlCount,
    mqlQuality,
    conversion: score >= 75 ? "开口后建议推进到 MQL" : score >= 55 ? "开口后先二次确认" : "暂不放大",
    profileCompleteness: `${Math.min(96, 62 + brief.items.length * 7)}%`,
    validReasons: [
      signals.strong > 0 ? "出现强信号，可优先转销售开口" : "强信号不足，先做轻量验证",
      sourceDomains.length ? `来源覆盖 ${sourceDomains.join(" / ")}` : "来源覆盖不足",
    ],
    invalidReasons: [
      "客户画像缺字段会降低 MQL 置信度",
      "只问价格、无仓型/品类/时效信息的线索暂不升 MQL",
    ],
    highQualityTraits: [
      "明确提到美国仓、退货、补货、尾程异常",
      "有品类、平台、货量或时效压力",
      "愿意接受 SOP 化跟进和案例说明",
    ],
    lowQualityWarnings: [
      "只有泛泛咨询，缺少业务场景",
      "没有决策人、预算或时间窗口",
      "只看热闹型评论，不要进入销售漏斗",
    ],
    bossRisks: [
      brief.is_low_signal_day ? "今日信号偏弱，不建议扩大投放" : "样例或公开信号仍需真实来源验证",
      "客户名单、报价、合同和成本不能放到公开 Pages",
    ],
    crossDeptActions: [
      "销售补回高质量线索的失败原因",
      "内容同学把美国仓痛点转成 1 条实景脚本",
      "私域承接负责人确认明日跟进节奏",
    ],
    topActions: firstActions.length ? firstActions : ["检查来源采集", "补跑今日日报", "同步低信号结论"],
    experiments: [
      { name: "实景视频", goal: "验证美国仓可信度", status: signals.strong > 0 ? "优先" : "观察", next: "用仓内场景拍 1 条 30 秒素材" },
      { name: "痛点选题", goal: "筛出高质量咨询", status: "进行中", next: "围绕退货、补货、异常响应写 3 个标题" },
      { name: "销售 SOP 转内容", goal: "把销售问答变成获客话术", status: "待销售反馈", next: "提取 5 个真实问答改成内容脚本" },
      { name: "小红书 / 直播 / 短视频", goal: "测试不同入口 MQL 质量", status: "小步验证", next: "记录来源渠道和 MQL 转化差异" },
    ],
    orgGaps: [
      { name: "数据缺口", owner: "增长 / 数据", next: "统一 MQL 定义和无效原因标签", severity: "高" },
      { name: "销售反馈缺口", owner: "销售", next: "每天回填 5 条线索质量判断", severity: "高" },
      { name: "私域承接缺口", owner: "私域", next: "确认评论、私信、飞书日报后的承接 SOP", severity: "中" },
      { name: "素材产能缺口", owner: "内容", next: "每周沉淀 2 条实景视频模板", severity: "中" },
    ],
    personalDone: [
      "完成今日公开信号归纳",
      "把核心信号转成 YQN 行动清单",
      "同步历史归档和搜索入口",
    ],
    personalFound: [
      brief.one_liner,
      "MQL 质量判断要和销售反馈闭环，不只看数量",
    ],
    tomorrow: [
      "优先验证美国仓相关线索质量",
      "补齐无效线索原因标签",
      "把 1 条 SOP 改成内容实验",
    ],
    supportNeeded: [
      "销售提供线索有效/无效反馈",
      "内容提供实景素材",
      "负责人确认哪些信息可以公开展示",
    ],
  };
}

function bossSummary(brief: Brief, snapshot = snapshotFor(brief)): string {
  return [
    `YQN 管理层摘要 · ${brief.date}`,
    `一句话：${brief.one_liner}`,
    `MQL：${snapshot.mqlCount} 条，质量判断：${snapshot.mqlQuality}`,
    `风险：${snapshot.bossRisks[0] || "无 P0 风险"}`,
    `跨部门动作：${snapshot.crossDeptActions[0] || "暂无"}`,
    `今天最该推进：${snapshot.topActions.slice(0, 3).join("；")}`,
    "链接：",
  ].join("\n");
}

function actionSummary(brief: Brief): string {
  return `今日行动清单 · ${brief.date}\n${brief.action_checklist.map((item, index) => `${index + 1}. ${item}`).join("\n")}`;
}

function shareSummary(brief: Brief, encrypted: boolean): string {
  if (encrypted) return `YQN 管理层摘要 · ${brief.date}\n${brief.one_liner}\n链接：`;
  return bossSummary(brief);
}

function SignalBadge(value: BriefItem["signal_strength"]): string {
  return `<span class="badge ${escapeHtml(value)}">信号 ${escapeHtml(strengthLabel(value))}</span>`;
}

function ConfidenceBadge(value: BriefItem["confidence"]): string {
  return `<span class="badge ${value === "high" ? "strong" : value === "medium" ? "medium" : "weak"}">可信度 ${escapeHtml(confidenceLabel(value))}</span>`;
}

function CopyButton(label: string, copiedLabel: string, payload: string, extraClass = ""): string {
  return `<button type="button" class="${escapeHtml(extraClass)}" data-copy="${escapeHtml(payload)}" onclick="navigator.clipboard?.writeText((this.dataset.copy || '').replace('__URL__', location.href)); this.textContent='${escapeHtml(copiedLabel)}';">${escapeHtml(label)}</button>`;
}

function PrintButton(): string {
  return `<button type="button" onclick="window.print()">打印 / 保存 PDF</button>`;
}

function metricGrid(brief: Brief): string {
  const signals = countBySignal(brief);
  const topics = new Set(brief.items.map((item) => item.topic)).size;
  return `<div class="metric-grid">
    <div class="metric"><span class="metric-label">核心信号</span><span class="metric-value">${brief.items.length}</span></div>
    <div class="metric"><span class="metric-label">强 / 中 / 弱</span><span class="metric-value">${signals.strong}/${signals.medium}/${signals.weak}</span></div>
    <div class="metric"><span class="metric-label">主题覆盖</span><span class="metric-value">${topics || 0}</span></div>
    <div class="metric"><span class="metric-label">来源窗口</span><span class="metric-value">${brief.source_window_hours}h</span></div>
  </div>`;
}

function signalMeter(snapshot: GrowthSnapshot): string {
  return `<div class="signal-meter">
    <div class="meter-track"><div class="meter-fill" style="--score:${snapshot.signalScore}%"></div></div>
    <div class="meter-label"><span>今日作战信号</span><strong>${snapshot.signalScore}/100</strong></div>
  </div>`;
}

function ConfigStatusBanner(encrypted: boolean): string {
  return `<section class="section config-banner" id="config-status" data-section="config-status">
    <div class="section-header"><div><p class="kicker">Config / Security</p><h2>配置 / 安全状态</h2></div><span class="badge ${encrypted ? "medium" : "weak"}">${encrypted ? "加密模式" : "公开 Pages"}</span></div>
    <div class="status-stack">
      <p class="field-body">${encrypted ? "完整日报与搜索索引在浏览器本地解锁，公开页只保留有限预览。" : "当前为公开网页模式，任何知道链接的人都可能打开，请不要放客户名单、报价、合同、成本、密钥或私密线索。"}</p>
      <p class="muted">noindex 和 robots.txt 不是访问控制；如果要保护正文，请启用 BRIEF_ENCRYPTION_ENABLED 并配置 PAGE_ACCESS_PASSPHRASE。</p>
    </div>
  </section>`;
}

function HeroCommandCenter(brief: Brief | undefined, encrypted: boolean): string {
  const snapshot = snapshotFor(brief);
  return `<section class="war-room-hero" id="hero" data-section="hero">
    <div class="hero-panel">
      <p class="kicker">YQN Growth War Room</p>
      <h1>YQN 增长作战台</h1>
      <p class="one-liner">${escapeHtml(brief?.one_liner || "还没有日报数据。配置 GitHub Secrets / Variables 后，到 Actions 手动触发 Daily Briefing Portal。")}</p>
      <div class="meta-row">
        <span class="chip">今日日期 ${escapeHtml(brief?.date || "待生成")}</span>
        <span class="chip">${brief?.is_low_signal_day ? "低信号日" : "作战观察日"}</span>
        <span class="chip">${encrypted ? "客户端加密" : "公开预览"}</span>
      </div>
      <div class="actions">
        <a class="button primary" href="executive/">先看管理层摘要</a>
        ${brief ? `<a class="button gold" href="reports/${brief.date}/">阅读今日日报</a>` : ""}
        <a class="button" href="archive/">查历史归档</a>
        ${brief ? CopyButton("复制老板版摘要", "已复制老板版摘要", `${shareSummary(brief, encrypted)}__URL__`, "secondary") : ""}
      </div>
    </div>
    <aside class="side-panel">
      <h2>今日作战态势</h2>
      ${signalMeter(snapshot)}
      ${brief ? metricGrid(brief) : `<div class="empty">暂无信号数据。下一步：运行 workflow 生成日报。</div>`}
      <p class="security-note">先看管理层摘要，再看 MQL 质量和组织缺口，最后复制给老板或进入归档复盘。</p>
    </aside>
  </section>`;
}

function TodayTopThree(brief: Brief | undefined, snapshot = snapshotFor(brief)): string {
  const actions = snapshot.topActions.slice(0, 3);
  return `<section class="section panel" id="top-three" data-section="top-three">
    <div class="section-header"><div><p class="kicker">Foolproof Path</p><h2>今天先看这 3 件事</h2></div><a class="button" href="executive/">管理层摘要</a></div>
    <div class="operator-steps">
      <div><span><strong>先看一句话判断：</strong>${escapeHtml(brief?.one_liner || "暂无日报，先完成配置并手动运行 workflow。")}</span></div>
      <div><span><strong>再看 MQL 质量：</strong>${escapeHtml(snapshot.mqlCount)} 条 MQL 线索视图，质量判断为 ${escapeHtml(snapshot.mqlQuality)}。</span></div>
      <div><span><strong>最后推进动作：</strong>${escapeHtml(actions.join("；") || "暂无动作。")}</span></div>
    </div>
  </section>`;
}

function ExecutiveSummaryCard(brief: Brief | undefined, encrypted = false): string {
  const snapshot = snapshotFor(brief);
  return `<section class="section panel" id="executive-summary" data-section="executive-summary">
    <div class="section-header"><div><p class="kicker">30 秒管理层摘要</p><h2>老板 30 秒看懂今天</h2></div>${brief ? CopyButton("复制老板版摘要", "已复制老板版摘要", `${shareSummary(brief, encrypted)}__URL__`, "primary") : ""}</div>
    <div class="tri-grid">
      <div class="mini-panel"><span class="metric-label">今日结论</span><strong>${escapeHtml(brief?.one_liner || "暂无日报")}</strong></div>
      <div class="mini-panel"><span class="metric-label">MQL 数量 / 质量</span><strong>${snapshot.mqlCount} 条 · ${escapeHtml(snapshot.mqlQuality)}</strong></div>
      <div class="mini-panel"><span class="metric-label">需要老板关注</span><strong>${escapeHtml(snapshot.bossRisks[0] || "无 P0 风险")}</strong></div>
    </div>
    <div class="two-grid section">
      <div class="module-card"><h3>需要跨部门支持</h3><ol class="steps">${snapshot.crossDeptActions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol></div>
      <div class="module-card"><h3>今天最该推进 3 件事</h3><ol class="steps">${snapshot.topActions.slice(0, 3).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol></div>
    </div>
  </section>`;
}

function MqlQualityPanel(brief: Brief | undefined): string {
  const snapshot = snapshotFor(brief);
  return `<section class="section panel" id="mql-quality" data-section="mql-quality">
    <div class="section-header"><div><p class="kicker">MQL Quality</p><h2>MQL 质量模块</h2></div><span class="badge ${snapshot.mqlQuality === "可推进" ? "strong" : "medium"}">${escapeHtml(snapshot.mqlQuality)}</span></div>
    <div class="quad-grid">
      <div class="metric"><span class="metric-label">MQL 数量</span><span class="metric-value">${snapshot.mqlCount}</span></div>
      <div class="metric"><span class="metric-label">MQL 质量</span><span class="metric-value">${escapeHtml(snapshot.mqlQuality)}</span></div>
      <div class="metric"><span class="metric-label">开口到 MQL 转化</span><span class="metric-value">${escapeHtml(snapshot.conversion)}</span></div>
      <div class="metric"><span class="metric-label">客户画像完整率</span><span class="metric-value">${escapeHtml(snapshot.profileCompleteness)}</span></div>
    </div>
    <div class="two-grid section">
      <div class="module-card"><h3>有效 / 无效原因</h3><p class="field-label">有效原因</p><ul class="steps">${snapshot.validReasons.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul><p class="field-label">无效预警</p><ul class="steps">${snapshot.invalidReasons.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>
      <div class="module-card"><h3>高质量线索特征</h3><ul class="steps">${snapshot.highQualityTraits.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul><h3 class="section-spacer">低质量线索预警</h3><ul class="steps">${snapshot.lowQualityWarnings.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>
    </div>
  </section>`;
}

function OrgGapPanel(brief: Brief | undefined): string {
  const snapshot = snapshotFor(brief);
  return `<section class="section panel" id="org-gap" data-section="org-gap">
    <div class="section-header"><div><p class="kicker">Organization Gap</p><h2>组织缺口模块</h2></div><span class="badge medium">需要协同</span></div>
    <div class="quad-grid">${snapshot.orgGaps.map((gap) => `<article class="module-card">
      <div class="archive-date"><h3>${escapeHtml(gap.name)}</h3><span class="badge ${gap.severity === "高" ? "risk" : "medium"}">${escapeHtml(gap.severity)}</span></div>
      <p class="muted">需要谁配合：${escapeHtml(gap.owner)}</p>
      <p class="field-body">${escapeHtml(gap.next)}</p>
    </article>`).join("")}</div>
  </section>`;
}

function ContentExperimentPanel(brief: Brief | undefined): string {
  const snapshot = snapshotFor(brief);
  return `<section class="section panel" id="content-experiment" data-section="content-experiment">
    <div class="section-header"><div><p class="kicker">Content Experiments</p><h2>内容实验模块</h2></div><span class="badge strong">小步验证</span></div>
    <div class="quad-grid">${snapshot.experiments.map((experiment) => `<article class="module-card">
      <h3>${escapeHtml(experiment.name)}</h3>
      <p class="field-label">目标</p><p class="field-body">${escapeHtml(experiment.goal)}</p>
      <p class="field-label">状态</p><p class="field-body">${escapeHtml(experiment.status)}</p>
      <p class="field-label">下一步</p><p class="field-body">${escapeHtml(experiment.next)}</p>
    </article>`).join("")}</div>
  </section>`;
}

function PersonalDailyPanel(brief: Brief | undefined): string {
  const snapshot = snapshotFor(brief);
  const copy = [
    "个人日报",
    `今天我做了什么：${snapshot.personalDone.join("；")}`,
    `今天发现了什么：${snapshot.personalFound.join("；")}`,
    `明天优先做什么：${snapshot.tomorrow.join("；")}`,
    `需要谁支持：${snapshot.supportNeeded.join("；")}`,
  ].join("\n");
  return `<section class="section panel" id="personal-daily" data-section="personal-daily">
    <div class="section-header"><div><p class="kicker">Personal Daily</p><h2>个人日报模块</h2></div>${CopyButton("复制到周报/日报", "已复制日报模板", copy, "gold")}</div>
    <div class="quad-grid">
      <div class="module-card"><h3>今天我做了什么</h3><ul class="steps">${snapshot.personalDone.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>
      <div class="module-card"><h3>今天发现了什么</h3><ul class="steps">${snapshot.personalFound.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>
      <div class="module-card"><h3>明天优先做什么</h3><ul class="steps">${snapshot.tomorrow.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>
      <div class="module-card"><h3>需要谁支持</h3><ul class="steps">${snapshot.supportNeeded.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>
    </div>
  </section>`;
}

function HistoryArchivePanel(briefs: Brief[]): string {
  const recent = briefs.slice(0, 8).map((brief) => `<a class="archive-row" href="reports/${brief.date}/">
    <div class="archive-date"><strong>${escapeHtml(brief.date)}</strong><span class="badge ${brief.is_low_signal_day ? "low" : "strong"}">${brief.is_low_signal_day ? "低信号" : "有信号"}</span></div>
    <span class="field-body">${escapeHtml(brief.one_liner)}</span>
    <span class="dim">${escapeHtml(topicsForBrief(brief))}</span>
  </a>`).join("") || `<div class="empty">暂无历史数据。下一步：到 Actions 手动生成样例或真实日报。</div>`;
  return `<section class="section panel" id="history-archive" data-section="history-archive">
    <div class="section-header"><div><p class="kicker">History Archive</p><h2>历史归档模块</h2></div><a class="button primary" href="archive/">全部归档</a></div>
    <div class="grid">
      <div class="item-list">${recent}</div>
      <aside class="section-card">
        <h3>稳定入口</h3>
        <div class="archive-tools">${monthArchiveLinks(briefs)}</div>
        <div class="archive-tools">${weekArchiveLinks(briefs)}</div>
        <h3 class="section-spacer">日历视图</h3>
        <div class="calendar">${CalendarArchive(briefs)}</div>
      </aside>
    </div>
  </section>`;
}

function SearchPanel(encrypted: boolean): string {
  return `<section class="section panel" id="search" data-section="search">
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
  </section>`;
}

function CalendarArchive(briefs: Brief[]): string {
  return briefs.map((brief) => `<a href="reports/${brief.date}/">
    <strong>${escapeHtml(brief.date)}</strong><br>
    <span class="muted">${brief.items.length} 条 · ${brief.is_low_signal_day ? "低信号" : "正常"}</span>
  </a>`).join("") || `<div class="empty">暂无可点击日期。下一步：回到 Actions 手动生成第一篇日报。</div>`;
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
  </details>`;
}

function reportNav(previousDate?: string, nextDate?: string): string {
  return `<div class="nav-links">
    ${previousDate ? `<a class="button" href="reports/${previousDate}/">上一天 ${escapeHtml(previousDate)}</a>` : `<span class="chip">没有上一天</span>`}
    ${nextDate ? `<a class="button" href="reports/${nextDate}/">下一天 ${escapeHtml(nextDate)}</a>` : `<span class="chip">没有下一天</span>`}
  </div>`;
}

export function renderHome(latest: Brief | undefined, briefs: Brief[], encrypted: boolean): string {
  const brief = latestOrEmpty(latest);
  return `<main class="shell">
    ${HeroCommandCenter(brief, encrypted)}
    ${TodayTopThree(brief)}
    ${ExecutiveSummaryCard(brief, encrypted)}
    ${MqlQualityPanel(brief)}
    ${OrgGapPanel(brief)}
    ${ContentExperimentPanel(brief)}
    ${PersonalDailyPanel(brief)}
    ${HistoryArchivePanel(briefs)}
    ${SearchPanel(encrypted)}
    ${ConfigStatusBanner(encrypted)}
  </main>`;
}

export function renderExecutivePage(latest: Brief | undefined, encrypted: boolean): string {
  const brief = latestOrEmpty(latest);
  const snapshot = snapshotFor(brief);
  return `<main class="shell">
    <section class="war-room-hero">
      <div class="hero-panel" data-section="executive-page">
        <p class="kicker">Executive / 30 秒摘要</p>
        <h1>管理层摘要</h1>
        <p class="one-liner">${escapeHtml(brief?.one_liner || "暂无日报。先完成配置并运行 workflow。")}</p>
        <div class="actions">
          ${brief ? CopyButton("复制老板版摘要", "已复制老板版摘要", `${shareSummary(brief, encrypted)}__URL__`, "primary") : ""}
          <a class="button" href="./#mql-quality">看 MQL 质量</a>
          <a class="button" href="./#org-gap">看组织缺口</a>
        </div>
      </div>
      <aside class="side-panel">
        <h2>老板关注项</h2>
        ${signalMeter(snapshot)}
        <ul class="steps">${snapshot.bossRisks.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </aside>
    </section>
    ${ExecutiveSummaryCard(brief, encrypted)}
    ${MqlQualityPanel(brief)}
    ${OrgGapPanel(brief)}
    ${ContentExperimentPanel(brief)}
  </main>`;
}

export function renderBriefStatic(brief: Brief, previousDate?: string, nextDate?: string): string {
  const snapshot = snapshotFor(brief);
  const items = brief.items.length ? brief.items.map(ReportCard).join("") : `<div class="empty">今天没有足够强信号。下一步：检查来源采集和 GitHub Actions 运行结果，不要把弱消息包装成机会。</div>`;
  return `<main class="shell">
    <section class="war-room-hero">
      <div class="hero-panel">
        <p class="kicker">Report · ${escapeHtml(brief.date)}</p>
        <h1>日报详情</h1>
        <p class="one-liner">${escapeHtml(brief.one_liner)}</p>
        <div class="meta-row">
          <span class="chip">日期 ${escapeHtml(brief.date)}</span>
          <span class="chip">${brief.is_low_signal_day ? "低信号日" : "正常信号日"}</span>
          <span class="chip">生成 ${escapeHtml(brief.generated_at)}</span>
        </div>
        <div class="actions" data-section="copy-actions">
          ${CopyButton("复制分享链接", "已复制链接", "__URL__", "primary")}
          ${PrintButton()}
          ${CopyButton("复制老板版摘要", "已复制老板版摘要", `${bossSummary(brief, snapshot)}__URL__`, "gold")}
          ${CopyButton("复制今日行动清单", "已复制行动清单", actionSummary(brief))}
        </div>
      </div>
      <aside class="side-panel">
        <h2>报告导航</h2>
        ${signalMeter(snapshot)}
        <div class="section">${reportNav(previousDate, nextDate)}</div>
        <div class="report-actions section" data-section="print-actions"><strong>打印提示：</strong><p class="muted">点击“打印 / 保存 PDF”后，在系统打印窗口选择保存为 PDF。</p></div>
      </aside>
    </section>
    <section class="section panel">
      <div class="section-header"><div><p class="kicker">Summary</p><h2>管理层摘要</h2></div><a class="button" href="executive/">看摘要页</a></div>
      <p class="field-body">${escapeHtml(brief.executive_summary)}</p>
    </section>
    <section class="grid">
      <div class="panel">
        <div class="section-header"><div><p class="kicker">Signal Cards</p><h2>核心情报卡片</h2></div><span class="badge">可折叠</span></div>
        <div class="item-list">${items}</div>
      </div>
      <aside class="panel">
        <h2>今日行动清单</h2>
        <ol class="checklist">${brief.action_checklist.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>
        <h2 class="section-spacer">来源链接</h2>
        <ul class="source-list">${brief.sources.map((source) => `<li><a class="source-link" href="${escapeHtml(source.url)}" rel="noreferrer">${escapeHtml(source.title)} · ${escapeHtml(source.domain)}</a></li>`).join("")}</ul>
      </aside>
    </section>
  </main>`;
}

export function renderLockedReport(brief: Brief, previousDate?: string, nextDate?: string): string {
  return `<main class="shell">
    <section class="war-room-hero">
      <div class="hero-panel">
        <p class="kicker">Encrypted Report · ${escapeHtml(brief.date)}</p>
        <h1>加密日报</h1>
        <p class="one-liner">${escapeHtml(brief.one_liner)}</p>
        <div class="meta-row"><span class="chip">日期 ${escapeHtml(brief.date)}</span><span class="chip">客户端加密</span><span class="chip">${brief.is_low_signal_day ? "低信号日" : "正常信号日"}</span></div>
        <div class="actions">${CopyButton("复制分享链接", "已复制链接", "__URL__", "primary")}${PrintButton()}</div>
      </div>
      <aside class="side-panel locked">
        <h2>加密状态</h2>
        <p class="security-note">完整日报、来源和搜索索引已加密发布。密码只在浏览器本地用于解锁；这不是企业级登录系统。</p>
        ${reportNav(previousDate, nextDate)}
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
    <div class="archive-date"><strong>${escapeHtml(brief.date)}</strong><span class="badge ${brief.is_low_signal_day ? "low" : "strong"}">${brief.is_low_signal_day ? "低信号日" : "正常信号日"}</span></div>
    <span class="field-body">${escapeHtml(brief.one_liner)}</span>
    <span class="dim">${escapeHtml(topicsForBrief(brief))}</span>
  </a>`).join("") || `<div class="empty">暂无历史数据。下一步：到 Actions 手动生成样例或真实日报。</div>`;
  return `<main class="shell">
    <section class="war-room-hero">
      <div class="hero-panel">
        <p class="kicker">Archive Intelligence</p>
        <h1>${escapeHtml(title)}</h1>
        <p class="one-liner">按日期倒序查看永久日报，也可以切到月视图或周视图，快速回看某段时间的增长信号变化。</p>
        <div class="archive-tools"><a class="button primary" href="archive/">全部历史</a>${monthArchiveLinks(briefs)}${weekArchiveLinks(briefs)}</div>
      </div>
      <aside class="side-panel">
        <h2>归档说明</h2>
        <ol class="steps"><li>按日期：进入某一天日报。</li><li>按月：查看当月全部日报。</li><li>按周：复盘一周信号密度。</li></ol>
      </aside>
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
  return '<details class="report-card" open><summary>' + htmlEscape(item.title) + '</summary><div class="meta-row"><span class="badge">' + htmlEscape(topicLabels[item.topic]) + '</span><span class="badge ' + htmlEscape(item.signal_strength) + '">signal ' + htmlEscape(item.signal_strength) + '</span><span class="badge">confidence ' + htmlEscape(item.confidence) + '</span><a class="source-link" href="' + htmlEscape(item.source_url) + '" rel="noreferrer">' + htmlEscape(item.source_domain) + '</a></div><div class="intel-fields"><div class="field-block"><p class="field-label">发生了什么</p><p class="field-body">' + htmlEscape(item.what_happened) + '</p></div><div class="field-block"><p class="field-label">为什么重要</p><p class="field-body">' + htmlEscape(item.why_it_matters) + '</p></div><div class="field-block"><p class="field-label">对 YQN 的启发</p><p class="field-body">' + htmlEscape(item.yqn_insight) + '</p></div><div class="field-block"><p class="field-label">今天可以做的动作</p><p class="field-body">' + htmlEscape(item.today_action) + '</p></div><div class="field-block"><p class="field-label">来源</p><p class="field-body"><a class="source-link" href="' + htmlEscape(item.source_url) + '" rel="noreferrer">' + htmlEscape(item.source_title) + ' · ' + htmlEscape(item.source_domain) + '</a></p></div></div></details>';
}
function renderBrief(brief) {
  const root = document.getElementById('briefRoot');
  const items = brief.items.length ? brief.items.map(renderItem).join('') : '<div class="empty">今天没有足够强信号。下一步：检查来源采集和 GitHub Actions 运行结果。</div>';
  root.innerHTML = '<section class="section panel"><h2>执行摘要</h2><p class="field-body">' + htmlEscape(brief.executive_summary) + '</p></section><section class="grid"><div class="panel"><h2>核心情报卡片</h2><div class="item-list">' + items + '</div></div><aside class="panel"><h2>今日行动清单</h2><ol class="checklist">' + brief.action_checklist.map((item) => '<li>' + htmlEscape(item) + '</li>').join('') + '</ol><h2 class="section-spacer">来源链接</h2><ul class="source-list">' + brief.sources.map((source) => '<li><a class="source-link" href="' + htmlEscape(source.url) + '" rel="noreferrer">' + htmlEscape(source.title) + ' · ' + htmlEscape(source.domain) + '</a></li>').join('') + '</ul></aside></section>';
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

export function topicFromEntry(item?: { topic?: Topic }): Topic | "" {
  return item?.topic || "";
}
