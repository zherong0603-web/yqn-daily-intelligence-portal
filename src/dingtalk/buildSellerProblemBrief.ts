import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";

const focusSchema = z.enum(["us_warehouse", "mexico_warehouse", "us_mexico_bridge"]);
const evidenceRoleSchema = z.enum(["seller_signal", "fact_basis"]);

const calendarDateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "Invalid calendar date");

const webUrlSchema = z.string().url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "https:" || protocol === "http:";
}, "Only HTTP(S) source URLs are allowed");

function singleLine(min: number, max: number): z.ZodString {
  return z.string().min(min).max(max).refine((value) => !/[\r\n]/.test(value), "Must be a single line");
}

const evidenceSchema = z.object({
  title: singleLine(2, 140),
  url: webUrlSchema,
  source_type: z.enum(["official", "platform_announcement", "seller_forum", "media", "internal_approved"]),
  published_at: calendarDateSchema.nullable(),
  effective_at: calendarDateSchema.nullable(),
  checked_at: z.string().datetime({ offset: true }),
  roles: z.array(evidenceRoleSchema).min(1).max(2),
  supports: singleLine(8, 240),
});

const problemSignalSchema = z.object({
  market_focus: focusSchema,
  title: singleLine(4, 90),
  seller_problem: singleLine(20, 360),
  affected_sellers: singleLine(8, 180),
  why_now: singleLine(12, 260),
  business_impact: singleLine(12, 220),
  market_angle: singleLine(8, 160),
  sales_question: singleLine(8, 160),
  yqn_entry: singleLine(12, 260),
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
  date: calendarDateSchema,
  title: singleLine(8, 100),
  market_stage: singleLine(20, 360),
  signals: z.array(problemSignalSchema).length(5),
  watchlist: z.array(z.object({
    title: singleLine(4, 100),
    reason: singleLine(8, 220),
    url: webUrlSchema,
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

function dateInShanghai(value: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const valueOf = (type: Intl.DateTimeFormatPartTypes): string => parts.find((part) => part.type === type)?.value || "";
  return `${valueOf("year")}-${valueOf("month")}-${valueOf("day")}`;
}

function daysBefore(referenceDate: string, candidateDate: string): number {
  return Math.round((Date.parse(`${referenceDate}T00:00:00Z`) - Date.parse(`${candidateDate}T00:00:00Z`)) / 86_400_000);
}

function normalizeEvidenceUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_|ref$|source$)/i.test(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  url.pathname = url.pathname.replace(/\/$/, "") || "/";
  return url.toString();
}

function expectedTitleDate(date: string): string {
  const [, month, day] = date.split("-").map(Number);
  return `${month}月${day}日`;
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

  if (!brief.title.includes(expectedTitleDate(brief.date))) blockers.push("brief:title_date_mismatch");
  if (dateInShanghai(brief.generated_at) !== brief.date) blockers.push("brief:generated_at_date_mismatch");
  const expectedSendAt = new Date(`${brief.date}T08:45:00+08:00`).getTime();
  if (new Date(brief.publication.proposed_send_at).getTime() !== expectedSendAt) {
    blockers.push("brief:proposed_send_at_mismatch");
  }

  const seenUrls = new Map<string, number>();
  const seenTitles = new Set<string>();

  brief.signals.forEach((signal, index) => {
    const normalizedTitle = signal.title.trim().toLowerCase();
    if (seenTitles.has(normalizedTitle)) blockers.push(`signal:${index}:duplicate_title`);
    seenTitles.add(normalizedTitle);
    if (signal.value_score < 70) blockers.push(`signal:${index}:value_score_below_70`);
    if (signal.confidence_label !== "high") blockers.push(`signal:${index}:confidence_not_high`);
    const roles = new Set(signal.evidence.flatMap((evidence) => evidence.roles));
    if (!roles.has("seller_signal")) blockers.push(`signal:${index}:missing_seller_signal`);
    if (!roles.has("fact_basis")) blockers.push(`signal:${index}:missing_fact_basis`);

    signal.evidence.forEach((evidence, evidenceIndex) => {
      if (dateInShanghai(evidence.checked_at) !== brief.date) {
        blockers.push(`signal:${index}:evidence:${evidenceIndex}:checked_at_date_mismatch`);
      }
      if (evidence.roles.length !== 1) {
        blockers.push(`signal:${index}:evidence:${evidenceIndex}:roles_must_be_separate`);
      }
      const role = evidence.roles[0];
      if (role === "seller_signal") {
        if (!evidence.published_at) {
          blockers.push(`signal:${index}:evidence:${evidenceIndex}:seller_signal_missing_date`);
        } else {
          const age = daysBefore(brief.date, evidence.published_at);
          if (age < 0) blockers.push(`signal:${index}:evidence:${evidenceIndex}:seller_signal_from_future`);
          if (age > 7) blockers.push(`signal:${index}:evidence:${evidenceIndex}:seller_signal_older_than_7_days`);
        }
        if (!(["seller_forum", "media"] as const).includes(evidence.source_type as "seller_forum" | "media")) {
          blockers.push(`signal:${index}:evidence:${evidenceIndex}:seller_signal_source_type_invalid`);
        }
      }
      if (role === "fact_basis" && !(["official", "platform_announcement", "internal_approved"] as const)
        .includes(evidence.source_type as "official" | "platform_announcement" | "internal_approved")) {
        blockers.push(`signal:${index}:evidence:${evidenceIndex}:fact_basis_source_type_invalid`);
      }

      const normalizedUrl = normalizeEvidenceUrl(evidence.url);
      const previousSignal = seenUrls.get(normalizedUrl);
      if (previousSignal !== undefined) blockers.push(`signal:${index}:evidence:${evidenceIndex}:duplicate_source_url`);
      else seenUrls.set(normalizedUrl, index);
    });

    if (signal.market_focus === "us_mexico_bridge") {
      const namesBothMarkets = (evidence: SellerProblemBrief["signals"][number]["evidence"][number]): boolean => {
        const text = `${evidence.title} ${evidence.supports}`;
        const namesMexico = /(墨西哥|m[eé]xico|mexican|\bmx\b)/i.test(text);
        const namesUnitedStates = /(美国|united states|u\.s\.|\busa\b|\bus\b)/i.test(text);
        return namesMexico && namesUnitedStates;
      };
      const sellerSignalHasBridge = signal.evidence.some((evidence) => evidence.roles.includes("seller_signal") && namesBothMarkets(evidence));
      const factBasisHasBridge = signal.evidence.some((evidence) => evidence.roles.includes("fact_basis") && namesBothMarkets(evidence));
      if (!sellerSignalHasBridge) blockers.push(`signal:${index}:bridge_seller_signal_missing_us_mexico_link`);
      if (!factBasisHasBridge) blockers.push(`signal:${index}:bridge_fact_basis_missing_us_mexico_link`);
    }
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
