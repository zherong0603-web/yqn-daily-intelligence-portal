import {
  DingtalkBrief,
  categoryLabels,
  productName,
  productSubtitle,
} from "./schema.js";

export interface DingtalkMarkdownOptions {
  publicBaseUrl?: string;
  archiveUrl?: string;
  archiveAvailable?: boolean;
  testLabel?: boolean;
}

export function getArchiveUrl(brief: Pick<DingtalkBrief, "date">, publicBaseUrl?: string): string {
  if (!publicBaseUrl) return "";
  return `${publicBaseUrl.replace(/\/$/, "")}/dingtalk/${brief.date}.html`;
}

export function briefHasTestData(brief: DingtalkBrief): boolean {
  return brief.mode === "demo" || brief.signals.some((signal) => signal.is_test_data);
}

export function buildMessageTitle(brief: DingtalkBrief, testLabel = true): string {
  const prefix = testLabel ? "【测试版】" : "";
  return `${prefix}${productName}｜${brief.date}`;
}

function shortSourceDate(value: string): string {
  if (!value) return "来源未注明日期";
  return value === "来源未注明日期" ? "未注明日期" : value;
}

export function renderDingtalkMarkdown(brief: DingtalkBrief, options: DingtalkMarkdownOptions = {}): string {
  const archiveUrl = options.archiveUrl ?? getArchiveUrl(brief, options.publicBaseUrl);
  const archiveAvailable = options.archiveAvailable ?? Boolean(archiveUrl);
  const testLabel = options.testLabel ?? briefHasTestData(brief);
  const lines: string[] = [];

  lines.push(`# ${buildMessageTitle(brief, testLabel)}`);
  lines.push(productSubtitle);
  lines.push("");
  lines.push(archiveAvailable && archiveUrl ? `完整归档：[打开网页看完整版](${archiveUrl})` : "完整归档：归档暂未启用");
  lines.push("");
  lines.push(`**今日判断：** ${brief.one_liner}`);
  if (briefHasTestData(brief)) {
    lines.push("> demo 样例，非实时新闻。");
  }
  lines.push("");

  brief.signals.slice(0, 3).forEach((signal, index) => {
    lines.push(`## ${index + 1}. ${categoryLabels[signal.category]}｜${signal.title}`);
    lines.push(`- 发生：${signal.what_happened}`);
    lines.push(`- 影响：${signal.why_it_matters}`);
    lines.push(`- YQN 看法：${signal.yqn_use}`);
    lines.push(`- 来源：[${signal.source_name}｜${shortSourceDate(signal.source_published_at)}](${signal.source_url})`);
    lines.push("");
  });

  return lines.join("\n");
}

export function countMessageCharacters(markdown: string): number {
  return Array.from(markdown.replace(/\s+/g, "")).length;
}

export function renderMarkdownHtml(markdown: string): string {
  const escaped = markdown
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const renderInline = (input: string) => input
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  const rendered = escaped.split("\n").map((line) => {
    if (!line.trim()) return '<div class="spacer"></div>';
    if (line.startsWith("# ")) return `<h1>${renderInline(line.slice(2))}</h1>`;
    if (line.startsWith("## ")) return `<h2>${renderInline(line.slice(3))}</h2>`;
    if (line.startsWith("> ")) return `<p class="note">${renderInline(line.slice(2))}</p>`;
    const numbered = line.match(/^(\d+)\.\s+(.+)$/);
    if (numbered) return `<p class="numbered"><span>${numbered[1]}.</span>${renderInline(numbered[2] || "")}</p>`;
    if (line.startsWith("- ")) {
      const content = line.slice(2);
      const [label, ...rest] = content.split("：");
      if (rest.length) return `<p class="bullet"><span>•</span><strong>${label}：</strong>${renderInline(rest.join("："))}</p>`;
      return `<p class="bullet"><span>•</span>${renderInline(content)}</p>`;
    }
    if (/^(完整归档)：/.test(line)) {
      const [label, ...rest] = line.split("：");
      return `<p><strong>${label}：</strong>${renderInline(rest.join("："))}</p>`;
    }
    return `<p>${renderInline(line)}</p>`;
  }).join("\n");
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>钉钉 Markdown 预览</title>
  <style>
    :root { color-scheme: light; --line:#d9e2ef; --text:#172033; --muted:#66758c; --blue:#126bff; --paper:#fff; }
    * { box-sizing:border-box; }
    body { margin:0; background:#eef3f8; color:var(--text); font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    .phone, .desktop { background:var(--paper); border:1px solid var(--line); border-radius:8px; box-shadow:0 14px 32px rgba(30,60,100,.12); }
    .wrap { max-width:980px; margin:0 auto; padding:28px; }
    .desktop { padding:22px 26px; }
    .phone { width:min(390px, 100%); margin-top:22px; padding:18px; }
    .label { font-size:13px; color:var(--muted); margin:0 0 10px; font-weight:700; }
    h1 { margin:0 0 12px; font-size:22px; line-height:1.25; }
    h2 { margin:16px 0 8px; padding-top:10px; border-top:1px solid var(--line); font-size:17px; line-height:1.35; }
    p { margin:6px 0; line-height:1.5; font-size:15px; }
    strong { font-weight:800; }
    a { color:#0867d9; overflow-wrap:anywhere; }
    .note { color:#5b6472; background:#f5f8fc; border-left:3px solid #9db7da; padding:8px 10px; }
    .bullet { display:flex; gap:8px; align-items:flex-start; }
    .bullet span { flex:0 0 auto; color:var(--blue); font-weight:800; }
    .bullet strong { white-space:nowrap; }
    .numbered { display:flex; gap:8px; }
    .numbered span { flex:0 0 auto; color:var(--blue); font-weight:800; }
    .spacer { height:6px; }
    .phone h1 { font-size:19px; }
    .phone h2 { font-size:16px; }
    .phone p { font-size:14px; line-height:1.5; }
  </style>
</head>
<body>
  <main class="wrap">
    <section class="desktop" data-shot="desktop-message">
      <p class="label">桌面钉钉消息预览</p>
      ${rendered}
    </section>
    <section class="phone" data-shot="mobile-message">
      <p class="label">手机钉钉消息预览</p>
      ${rendered}
    </section>
  </main>
</body>
</html>`;
}
