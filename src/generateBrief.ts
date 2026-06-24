import OpenAI from "openai";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  briefDraftJsonSchema,
  briefDraftSchema,
  Brief,
  BriefDraft,
  BriefItem,
  briefSchema,
  CollectedSource,
  topicLabels,
} from "./schema.js";
import { collectSourcesForBrief } from "./collectSources.js";
import { loadSources, readRuntimeConfig, RuntimeConfig } from "./config.js";
import { sourceDomain, stableId } from "./utils/domain.js";
import { writeJsonFile } from "./utils/fs.js";

const MIN_SOURCES_FOR_MODEL = 3;
type LowSignalReason = "insufficient_sources" | "missing_openai_key";

function briefSourcesFromCandidates(candidates: CollectedSource[]) {
  return candidates.slice(0, 20).map((candidate) => ({
    topic: candidate.topic,
    name: candidate.source_name,
    title: candidate.title,
    url: candidate.url,
    domain: candidate.domain,
    published_at: candidate.published_at,
  }));
}

function lowSignalBrief(
  config: RuntimeConfig,
  candidates: CollectedSource[],
  sourceWindowHours: 72 | 168,
  reason: LowSignalReason,
): Brief {
  const missingKey = reason === "missing_openai_key";
  return briefSchema.parse({
    date: config.date,
    generated_at: new Date().toISOString(),
    one_liner: missingKey
      ? "OpenAI API 尚未配置，今天只发布系统自检型低信号日报。"
      : "今天没有足够强信号，先不把弱消息包装成机会。",
    executive_summary: missingKey
      ? "系统已完成公开来源采集，但未检测到 OPENAI_API_KEY，无法进行模型归纳。为避免编造情报，今天只发布配置待完成的低信号日报；配置 GitHub Secret 后可手动补跑当天。"
      : "公开来源在当前时间窗口内没有形成足够明确的业务信号。今天适合做轻量巡检和资料补齐，不适合基于噪声调整获客、美国仓或投放策略。",
    items: [],
    action_checklist: missingKey
      ? [
          "在 GitHub Actions Secrets 配置 OPENAI_API_KEY。",
          "回到 Actions 手动补跑 Daily Briefing Portal，brief_date 填当天日期。",
          "不要把 API key、webhook 或访问密码发到聊天、README、日志或页面源码里。",
        ]
      : [
          "检查昨天新增线索里是否出现美国仓、退货、补货、尾程异常关键词。",
          "补看一个公开行业来源，确认是否有跨境物流或广告投放规则变化。",
          "把今天的低信号结论同步给内部，不强行制造选题。",
        ],
    sources: briefSourcesFromCandidates(candidates),
    model: missingKey ? `${config.openAiModel}-api-key-missing` : config.openAiModel || "not-required-low-signal",
    run_id: config.runId,
    source_window_hours: sourceWindowHours,
    is_low_signal_day: true,
    encryption_enabled: config.encryptionEnabled,
  });
}

function buildPrompt(date: string, candidates: CollectedSource[]): string {
  const sourcePayload = candidates.map((candidate, index) => ({
    source_id: index + 1,
    topic: candidate.topic,
    topic_label: topicLabels[candidate.topic],
    title: candidate.title,
    url: candidate.url,
    domain: candidate.domain,
    published_at: candidate.published_at,
    summary: candidate.summary,
  }));

  return JSON.stringify({
    date,
    role: "你是服务 YQN / 运去哪的中文商业情报分析员。",
    output_style: [
      "短、硬、可执行。",
      "最多 5 条核心动态。",
      "不要写持续关注、加强学习、提升效率这类空话。",
      "事实判断保守，机会判断必须体现在 confidence。",
      "today_action 必须是今天能做的一件具体事。",
    ],
    topics: topicLabels,
    source_rules: [
      "只能使用下面 sources 里的公开 source_url。",
      "没有 source_url 的 item 不允许输出。",
      "不要编造来源，不要把模型判断当事实来源。",
      "跨境默认聚焦美国仓和北美美国跨境电商；不要主动把墨西哥仓作为重点，除非来源里确有重大信息。",
      "小红书相关只能基于公开营销行业资讯、广告平台公开资料、公开案例或公开报告。",
    ],
    yqn_angle: [
      "业务决策",
      "B2B 获客",
      "自动化",
      "跨境美国仓",
      "个人赚钱或副业机会",
    ],
    sources: sourcePayload,
  });
}

function extractOutputText(response: unknown): string {
  const candidate = response as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
  if (typeof candidate.output_text === "string" && candidate.output_text.trim()) return candidate.output_text;
  const text = candidate.output?.flatMap((item) => item.content || []).map((content) => content.text).filter(Boolean).join("\n");
  if (text) return text;
  throw new Error("OpenAI response did not contain text output");
}

function coerceJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }
    throw new Error("model output was not parseable JSON");
  }
}

async function callOpenAi(config: RuntimeConfig, candidates: CollectedSource[]): Promise<BriefDraft> {
  if (!config.openAiModel) {
    throw new Error("SETUP_ERROR: OPENAI_MODEL GitHub Variable is required for normal daily generation");
  }
  if (!config.openAiApiKey) {
    throw new Error("OPENAI_API_KEY is required when enough sources exist to generate a daily brief");
  }
  const client = new OpenAI({ apiKey: config.openAiApiKey });
  const response = await client.responses.create({
    model: config.openAiModel,
    input: [
      {
        role: "system",
        content: "你只输出符合 schema 的 JSON。不要输出 Markdown，不要输出解释。",
      },
      {
        role: "user",
        content: buildPrompt(config.date, candidates),
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "yqn_daily_brief",
        strict: true,
        schema: briefDraftJsonSchema,
      },
    },
  });

  return briefDraftSchema.parse(coerceJson(extractOutputText(response)));
}

function validateSourceUse(draft: BriefDraft, candidates: CollectedSource[]): BriefDraft {
  const byUrl = new Map(candidates.map((candidate) => [candidate.url, candidate]));
  const normalized = new Map(candidates.map((candidate) => [candidate.url.replace(/\/$/, ""), candidate]));
  const items = draft.items.map((item, index) => {
    const candidate = byUrl.get(item.source_url) || normalized.get(item.source_url.replace(/\/$/, ""));
    if (!candidate) {
      throw new Error(`model selected source_url outside collected source set at item ${index + 1}`);
    }
    return {
      ...item,
      id: item.id || stableId(`${item.source_url}:${item.title}`),
      source_title: candidate.title,
      source_url: candidate.url,
      source_published_at: candidate.published_at,
      source_domain: sourceDomain(candidate.url),
    };
  });
  return briefDraftSchema.parse({ ...draft, items });
}

function assembleBrief(
  config: RuntimeConfig,
  draft: BriefDraft,
  candidates: CollectedSource[],
  sourceWindowHours: 72 | 168,
): Brief {
  const items = draft.items.slice(0, 5).map((item): BriefItem => ({
    id: item.id || stableId(`${item.source_url}:${item.title}`),
    topic: item.topic,
    title: item.title,
    what_happened: item.what_happened,
    why_it_matters: item.why_it_matters,
    yqn_insight: item.yqn_insight,
    today_action: item.today_action,
    signal_strength: item.signal_strength,
    confidence: item.confidence,
    source_title: item.source_title,
    source_url: item.source_url,
    source_published_at: item.source_published_at,
    source_domain: item.source_domain,
  }));
  const usedUrls = new Set(items.map((item) => item.source_url));
  const usedSources = candidates.filter((candidate) => usedUrls.has(candidate.url));
  return briefSchema.parse({
    date: config.date,
    generated_at: new Date().toISOString(),
    one_liner: draft.one_liner,
    executive_summary: draft.executive_summary,
    items,
    action_checklist: draft.action_checklist,
    sources: briefSourcesFromCandidates(usedSources.length > 0 ? usedSources : candidates),
    model: config.openAiModel || "unknown",
    run_id: config.runId,
    source_window_hours: sourceWindowHours,
    is_low_signal_day: candidates.length < 8 || items.every((item) => item.signal_strength === "weak"),
    encryption_enabled: config.encryptionEnabled,
  });
}

async function generateWithRetry(config: RuntimeConfig, candidates: CollectedSource[], sourceWindowHours: 72 | 168): Promise<Brief> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const draft = await callOpenAi(config, candidates);
      const validated = validateSourceUse(draft, candidates);
      return assembleBrief(config, validated, candidates, sourceWindowHours);
    } catch (error) {
      lastError = error;
      console.warn(`[generate] schema/source validation failed on attempt ${attempt}`);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("brief generation failed");
}

export async function buildBriefFromCandidates(
  config: RuntimeConfig,
  candidates: CollectedSource[],
  sourceWindowHours: 72 | 168,
): Promise<Brief> {
  if (candidates.length < MIN_SOURCES_FOR_MODEL) {
    return lowSignalBrief(config, candidates, sourceWindowHours, "insufficient_sources");
  }
  if (!config.openAiModel) {
    throw new Error("SETUP_ERROR: OPENAI_MODEL GitHub Variable is required. Configure it in Settings > Secrets and variables > Actions > Variables.");
  }
  if (!config.openAiApiKey) {
    console.warn("[generate] OPENAI_API_KEY is not configured; publishing an honest low-signal configuration brief");
    return lowSignalBrief(config, candidates, sourceWindowHours, "missing_openai_key");
  }
  return generateWithRetry(config, candidates, sourceWindowHours);
}

export async function generateDailyBrief(repoRoot = process.cwd()): Promise<Brief> {
  const config = readRuntimeConfig(repoRoot);
  const sourceConfigs = await loadSources(repoRoot);
  const collection = await collectSourcesForBrief(sourceConfigs);
  const brief = await buildBriefFromCandidates(config, collection.candidates, collection.source_window_hours);

  const outputPath = path.join(repoRoot, "data", "briefs", `${config.date}.json`);
  await writeJsonFile(outputPath, brief);
  console.log(`[generate] wrote data/briefs/${config.date}.json with ${brief.items.length} item(s)`);
  return brief;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  generateDailyBrief().catch((error) => {
    console.error(error instanceof Error ? error.message : "daily brief generation failed");
    process.exit(1);
  });
}
