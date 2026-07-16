import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";

const focusSchema = z.enum(["us_warehouse", "mexico_warehouse", "us_mexico_bridge"]);
const evidenceRoleSchema = z.enum(["seller_signal", "fact_basis"]);

const evidenceSchema = z.object({
  title: z.string().min(2).max(140),
  url: z.string().url(),
  source_type: z.enum(["official", "platform_announcement", "seller_forum", "media", "internal_approved"]),
  published_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  effective_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  checked_at: z.string().datetime({ offset: true }),
  roles: z.array(evidenceRoleSchema).min(1).max(2),
  supports: z.string().min(8).max(240),
});

const problemSignalSchema = z.object({
  market_focus: focusSchema,
  title: z.string().min(4).max(90),
  seller_problem: z.string().min(20).max(360),
  affected_sellers: z.string().min(8).max(180),
  why_now: z.string().min(12).max(260),
  business_impact: z.string().min(12).max(220),
  market_angle: z.string().min(8).max(160),
  sales_question: z.string().min(8).max(160),
  yqn_entry: z.string().min(12).max(260),
  evidence: z.array(evidenceSchema).min(1).max(4),
  value_score: z.number().int().min(0).max(100),
  confidence_label: z.enum(["high", "medium", "low"]),
});

const publicationSchema = z.object({
  target: z.literal("yqn_livestream_group"),
  status: z.literal("ready_for_review"),
  send_allowed: z.literal(false),
  approval_required: z.literal(true),
  proposed_send_at: z.string().datetime({ offset: true }),
});

export const sellerProblemBriefSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().min(8).max(100),
  market_stage: z.string().min(20).max(360),
  signals: z.array(problemSignalSchema).length(5),
  watchlist: z.array(z.object({
    title: z.string().min(4).max(100),
    reason: z.string().min(8).max(220),
    url: z.string().url(),
  })).max(5),
  generated_at: z.string().datetime(),
  publication: publicationSchema,
});

export type SellerProblemBrief = z.infer<typeof sellerProblemBriefSchema>;

export interface SellerProblemValidationReport {
  date: string;
  content_valid: boolean;
  send_allowed: false;
  target: "yqn_livestream_group";
  counts: Record<z.infer<typeof focusSchema>, number>;
  automated_blockers: string[];
  manual_checks: Array<{
    id: string;
    status: "pending";
    question: string;
    pass_condition: string;
  }>;
  checked_at: string;
}

export interface SellerProblemRenderOptions {
  publication?: "review" | "production";
}

const focusLabels: Record<z.infer<typeof focusSchema>, string> = {
  us_warehouse: "🇺🇸 美国",
  mexico_warehouse: "🇲🇽 墨西哥",
  us_mexico_bridge: "🌎 美墨联动",
};

function manualChecks(): SellerProblemValidationReport["manual_checks"] {
  return [
    {
      id: "fact_readthrough",
      status: "pending",
      question: "5 组证据是否真正支持文中结论，而不只是标题相似？",
      pass_condition: "逐条打开链接，核对日期、数字、适用卖家和生效条件。",
    },
    {
      id: "business_value",
      status: "pending",
      question: "市场或销售同事看完后，能否马上想到客户、选题或追问？",
      pass_condition: "至少 4 条能直接转成销售问题或内容选题。",
    },
    {
      id: "yqn_boundary",
      status: "pending",
      question: "YQN 的可承接内容是否真实，是否出现了认证、税务、平台索赔等越界承诺？",
      pass_condition: "只表达头程、仓储、配送、资料衔接和方案建议。",
    },
    {
      id: "group_readability",
      status: "pending",
      question: "消息在直播天团群里是否能在 5 分钟内读完，是否过长或像培训课件？",
      pass_condition: "首屏看到市场判断，每条都能快速看到卖家问题和团队用法。",
    },
    {
      id: "schedule_and_target",
      status: "pending",
      question: "发布时间、目标群、机器人名称和失败处理是否已确认？",
      pass_condition: "目标为 YQN 直播天团，机器人为 YQN 信息小助手，08:45 为主发送，未审批或验证失败时停止发送。",
    },
  ];
}

function countFocus(brief: SellerProblemBrief, focus: z.infer<typeof focusSchema>): number {
  return brief.signals.filter((signal) => signal.market_focus === focus).length;
}

export function validateSellerProblemBrief(input: unknown, checkedAt = new Date().toISOString()): {
  brief?: SellerProblemBrief;
  report: SellerProblemValidationReport;
} {
  const parsed = sellerProblemBriefSchema.safeParse(input);
  if (!parsed.success) {
    return {
      report: {
        date: z.object({ date: z.string() }).safeParse(input).data?.date || "unknown",
        content_valid: false,
        send_allowed: false,
        target: "yqn_livestream_group",
        counts: { us_warehouse: 0, mexico_warehouse: 0, us_mexico_bridge: 0 },
        automated_blockers: parsed.error.issues.map((issue) => `schema:${issue.path.join(".")}:${issue.message}`),
        manual_checks: manualChecks(),
        checked_at: checkedAt,
      },
    };
  }

  const brief = parsed.data;
  const counts = {
    us_warehouse: countFocus(brief, "us_warehouse"),
    mexico_warehouse: countFocus(brief, "mexico_warehouse"),
    us_mexico_bridge: countFocus(brief, "us_mexico_bridge"),
  };
  const blockers: string[] = [];
  if (counts.us_warehouse !== 2) blockers.push(`ratio:us_warehouse:${counts.us_warehouse}`);
  if (counts.mexico_warehouse !== 2) blockers.push(`ratio:mexico_warehouse:${counts.mexico_warehouse}`);
  if (counts.us_mexico_bridge !== 1) blockers.push(`ratio:us_mexico_bridge:${counts.us_mexico_bridge}`);

  brief.signals.forEach((signal, index) => {
    if (signal.value_score < 70) blockers.push(`signal:${index}:value_score_below_70`);
    if (signal.confidence_label !== "high") blockers.push(`signal:${index}:confidence_not_high`);
    const roles = new Set(signal.evidence.flatMap((evidence) => evidence.roles));
    if (!roles.has("seller_signal")) blockers.push(`signal:${index}:missing_seller_signal`);
    if (!roles.has("fact_basis")) blockers.push(`signal:${index}:missing_fact_basis`);
  });

  return {
    brief,
    report: {
      date: brief.date,
      content_valid: blockers.length === 0,
      send_allowed: false,
      target: "yqn_livestream_group",
      counts,
      automated_blockers: blockers,
      manual_checks: manualChecks(),
      checked_at: checkedAt,
    },
  };
}

function evidenceLine(brief: SellerProblemBrief, signal: SellerProblemBrief["signals"][number]): string {
  return signal.evidence.map((evidence) => `[${evidence.title}](${evidence.url})`).join("、");
}

export function renderSellerProblemMarkdown(
  brief: SellerProblemBrief,
  options: SellerProblemRenderOptions = {},
): string {
  const publication = options.publication || "review";
  const displayTitle = publication === "production"
    ? brief.title.replace(/^【待验收】\s*/, "")
    : brief.title;
  const lines = [
    `# 📡 ${displayTitle}`,
    "🇺🇸 美国｜🇲🇽 墨西哥｜卖家问题｜物流机会",
    "",
    `## 🔎 今日市场判断｜${brief.market_stage}`,
    "",
  ];

  brief.signals.forEach((signal, index) => {
    lines.push(`## ${index + 1}. ${focusLabels[signal.market_focus]}｜${signal.title}`);
    lines.push(`- 😣 **卖家正在遇到：**${signal.seller_problem}`);
    lines.push(`- 👥 **哪类卖家：**${signal.affected_sellers}`);
    lines.push(`- ⏰ **为什么现在看：**${signal.why_now}`);
    lines.push(`- 💸 **业务影响：**${signal.business_impact}`);
    lines.push(`- 📣 **市场可用：**${signal.market_angle}`);
    lines.push(`- 💬 **销售一问：**${signal.sales_question}`);
    lines.push(`- 🚚 **YQN 切入：**${signal.yqn_entry}`);
    lines.push(`- 🔗 **事实依据：**${evidenceLine(brief, signal)}`);
    lines.push("");
  });

  if (brief.watchlist.length) {
    lines.push("## 👀 观察项｜暂不占据核心位置");
    brief.watchlist.forEach((item) => lines.push(`- [${item.title}](${item.url})：${item.reason}`));
    lines.push("");
  }
  lines.push(publication === "production"
    ? "—— 🤖 来自 YQN 信息小助手｜工作日 08:45 更新"
    : "—— 🤖 来自 YQN 信息小助手｜当前为待验收稿，未发送");
  return lines.join("\n");
}

function readArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const file = readArg("--file");
  if (!file) throw new Error("Usage: npm run codex:seller-brief:build -- --file <brief.json>");
  const absoluteFile = path.resolve(file);
  const input = JSON.parse(await readFile(absoluteFile, "utf8")) as unknown;
  const { brief, report } = validateSellerProblemBrief(input);
  const stem = absoluteFile.replace(/\.json$/i, "");
  await mkdir(path.dirname(absoluteFile), { recursive: true });
  await writeFile(`${stem}.review.json`, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  if (!brief || !report.content_valid) {
    throw new Error(`Seller-problem brief validation failed: ${report.automated_blockers.join(", ")}`);
  }
  await writeFile(`${stem}.livestream-ready.md`, `${renderSellerProblemMarkdown(brief)}\n`, "utf8");
  console.log(`[codex:seller-brief] content_valid=true; send_allowed=false; date=${brief.date}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Seller-problem brief build failed");
    process.exit(1);
  });
}
