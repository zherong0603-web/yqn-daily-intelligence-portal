import { DingtalkBrief, categoryLabels } from "./schema.js";

function archiveUrl(brief: DingtalkBrief, siteUrl?: string): string {
  if (!siteUrl) return "";
  return `${siteUrl.replace(/\/$/, "")}/dingtalk/${brief.date}.html`;
}

export function renderDingtalkMarkdown(brief: DingtalkBrief, siteUrl?: string): string {
  const lines: string[] = [];
  lines.push(`# 🚢 ${brief.title}`);
  lines.push("");
  lines.push(`**今日一句话判断：** ${brief.one_liner}`);
  lines.push("");

  for (const signal of brief.signals) {
    lines.push(`## ${categoryLabels[signal.category]}｜${signal.title}`);
    lines.push(`- **发生了什么：** ${signal.what_happened}`);
    lines.push(`- **为什么重要：** ${signal.why_it_matters}`);
    lines.push(`- **YQN 可用点：** ${signal.yqn_use}`);
    lines.push(`- **今天动作：** ${signal.today_action}`);
    lines.push(`- **来源链接：** [查看来源](${signal.source_url})`);
    lines.push(`- **置信度：** ${Math.round(signal.confidence * 100)}%`);
    lines.push(`- **是否敏感：** ${signal.is_sensitive ? "是" : "否"}`);
    lines.push("");
  }

  lines.push("## 今日 3 个动作");
  brief.action_list.forEach((action, index) => {
    lines.push(`${index + 1}. ${action}`);
  });

  const url = archiveUrl(brief, siteUrl);
  if (url) {
    lines.push("");
    lines.push(`[查看网页归档](${url})`);
  }

  return lines.join("\n");
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
    if (line.startsWith("- ")) return `<p class="bullet">${renderInline(line.slice(2))}</p>`;
    const numbered = line.match(/^(\d+)\.\s+(.+)$/);
    if (numbered) return `<p class="numbered"><span>${numbered[1]}.</span>${renderInline(numbered[2] || "")}</p>`;
    return `<p>${renderInline(line)}</p>`;
  }).join("\n");
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>钉钉 Markdown 预览</title>
  <style>
    :root { color-scheme: light; --line:#d9e2ef; --text:#172033; --muted:#66758c; --blue:#126bff; }
    body { margin:0; background:#eef3f8; color:var(--text); font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    .phone, .desktop { background:#fff; border:1px solid var(--line); border-radius:8px; box-shadow:0 14px 32px rgba(30,60,100,.12); }
    .wrap { max-width:980px; margin:0 auto; padding:28px; }
    .desktop { padding:22px 26px; }
    .phone { width:min(390px, 100%); margin-top:22px; padding:18px; }
    .label { font-size:13px; color:var(--muted); margin:0 0 10px; font-weight:700; }
    h1 { margin:0 0 16px; font-size:22px; line-height:1.25; }
    h2 { margin:22px 0 8px; padding-top:12px; border-top:1px solid var(--line); font-size:17px; line-height:1.35; }
    p { margin:7px 0; line-height:1.58; font-size:15px; }
    strong { font-weight:800; }
    a { color:#0867d9; overflow-wrap:anywhere; }
    .bullet { padding-left:12px; border-left:3px solid #dbe8f8; }
    .numbered { display:flex; gap:8px; }
    .numbered span { flex:0 0 auto; color:var(--blue); font-weight:800; }
    .spacer { height:7px; }
    .phone h1 { font-size:19px; }
    .phone h2 { font-size:16px; }
    .phone p { font-size:14px; line-height:1.55; }
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
