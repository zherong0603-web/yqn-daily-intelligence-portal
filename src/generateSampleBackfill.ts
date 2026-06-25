import path from "node:path";
import { pathToFileURL } from "node:url";
import { readRuntimeConfig } from "./config.js";
import { Brief, BriefItem, BriefSource, Topic, briefSchema } from "./schema.js";
import { writeJsonFile } from "./utils/fs.js";
import { readEnv } from "./utils/env.js";

const defaultDates = ["2026-07-01", "2026-07-02", "2026-08-01"];

const topicCycle: Topic[] = [
  "ai",
  "ecommerce_us_warehouse",
  "xiaohongshu_b2b",
];

function datesFromEnv(): string[] {
  const raw = readEnv("SAMPLE_BRIEF_DATES") || readEnv("BRIEF_DATE") || defaultDates.join(",");
  const dates = raw.split(",").map((date) => date.trim()).filter(Boolean);
  return dates.length > 0 ? dates : defaultDates;
}

function sourceFor(date: string, index: number, topic: Topic): BriefSource {
  const domains: Partial<Record<Topic, string>> = {
    ai: "venturebeat.com",
    ecommerce_us_warehouse: "supplychaindive.com",
    xiaohongshu_b2b: "ad.xiaohongshu.com",
  };
  const domain = domains[topic] || "example.com";
  return {
    topic,
    name: `验收公开来源 ${index}`,
    title: `验收公开来源 ${index} · ${date}`,
    url: `https://${domain}/yqn-acceptance-${date}-${index}`,
    domain,
    published_at: `${date}T00:00:00.000Z`,
  };
}

function itemFor(date: string, index: number, source: BriefSource): BriefItem {
  const titleMap: Partial<Record<Topic, string>> = {
    ai: "AI 自动化信号：把重复线索分拣固化为每日动作",
    ecommerce_us_warehouse: "美国仓信号：客户更关心退货、补货和异常响应",
    xiaohongshu_b2b: "小红书 B2B 信号：公开投放资料适合转成获客话术",
  };
  return {
    id: `sample_${date}_${index}`,
    topic: source.topic,
    title: `${titleMap[source.topic] || "YQN 业务信号：公开来源可转成今日动作"} · ${date}`,
    what_happened: "这是线上验收用样例数据，用于验证日报页面、归档、搜索、主题筛选、上一天下一天和分享打印功能。",
    why_it_matters: "样例补跑不依赖密钥，可以先证明门户站的长期结构和历史能力可用，真实内容仍必须通过 OpenAI API 和公开来源生成。",
    yqn_insight: "YQN 可以先验收门户的查看、分享、归档和安全边界，再配置密钥进入真实每日运行。",
    today_action: "今天打开这条日报，测试搜索关键词、主题筛选、复制分享链接和打印保存 PDF。",
    signal_strength: index === 1 ? "strong" : "medium",
    confidence: index === 1 ? "high" : "medium",
    source_title: source.title,
    source_url: source.url,
    source_published_at: source.published_at,
    source_domain: source.domain,
  };
}

function sampleBrief(date: string, runId: string, encryptionEnabled: boolean): Brief {
  const sources = topicCycle.map((topic, index) => sourceFor(date, index + 1, topic));
  const items = sources.map((source, index) => itemFor(date, index + 1, source)).slice(0, 3);
  return briefSchema.parse({
    date,
    generated_at: new Date().toISOString(),
    one_liner: `YQN 每日重点简报样例已生成：${date} 可用于检查历史归档、搜索、主题筛选和分享打印。`,
    executive_summary: "这是一篇明确标记为 Demo 样例的日报，用来验证 YQN 每日重点简报的上线可用性。它不是商业事实简报，不替代真实每日情报；真实运行必须配置 OpenAI API Key 和 OPENAI_MODEL。",
    items,
    action_checklist: [
      "打开今日简报永久链接，确认网页可访问。",
      "搜索“美国仓”并使用主题筛选检查结果。",
      "点击复制简报摘要，再测试打印或保存 PDF。",
    ],
    sources,
    model: "sample-backfill",
    run_id: runId,
    source_window_hours: 72,
    is_low_signal_day: false,
    encryption_enabled: encryptionEnabled,
  });
}

export async function generateSampleBackfill(repoRoot = process.cwd()): Promise<Brief[]> {
  const config = readRuntimeConfig(repoRoot);
  const dates = datesFromEnv();
  const briefs = await Promise.all(dates.map(async (date) => {
    const brief = sampleBrief(date, config.runId, config.encryptionEnabled);
    await writeJsonFile(path.join(repoRoot, "data", "briefs", `${date}.json`), brief);
    return brief;
  }));
  console.log(`[sample-backfill] wrote ${briefs.length} sample brief(s): ${dates.join(", ")}`);
  return briefs;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  generateSampleBackfill().catch((error) => {
    console.error(error instanceof Error ? error.message : "sample backfill failed");
    process.exit(1);
  });
}
