import OpenAI from "openai";
import { pathToFileURL } from "node:url";
import { writeTextFile, writeJsonFile } from "../utils/fs.js";
import { collectDingtalkSources } from "./collectSources.js";
import {
  dataPath,
  markdownPath,
  readDingtalkRuntimeConfig,
  DingtalkRuntimeConfig,
} from "./config.js";
import { renderDingtalkMarkdown } from "./renderMarkdown.js";
import { buildSampleBrief } from "./sampleBrief.js";
import {
  DingtalkBrief,
  DingtalkSourceConfig,
  dingtalkBriefJsonSchema,
  validateDingtalkBrief,
} from "./schema.js";

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
    if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
    throw new Error("model output was not parseable JSON");
  }
}

function buildLivePrompt(config: DingtalkRuntimeConfig, sources: DingtalkSourceConfig[]): string {
  return JSON.stringify({
    date: config.date,
    title: `YQN 北美履约增长晨报｜${config.date}`,
    role: "你是 YQN 北美履约增长晨报编辑，只服务 YQN 团队的公开信息晨报。",
    format: "固定 1+4+3：一句话判断、4条核心信号、3个今日动作。",
    hard_rules: [
      "只输出符合 schema 的 JSON，不输出 Markdown。",
      "one_liner 必须 30 字以内，并和美国仓、北美履约、平台规则、线索质量或增长动作有关。",
      "signals 必须刚好 4 条，category 分别是 policy、platform、fulfillment、growth。",
      "每条 signal 必须有 source_url，且只能使用 sources 里的 url。",
      "action_list 必须刚好 3 条，分别面向销售、内容、履约或数据。",
      "不得出现客户名单、客户联系方式、报价、合同、毛利、内部成本、未公开客户案例、销售聊天记录、私域客户明细。",
      "不得出现 Codex、OPC、个人副业、个人赚钱、用户个人叙事。",
      "只写公开信号和 YQN 可公开表达的业务动作。",
      "如果资料不足，降低 confidence，不要编造。",
    ],
    sources: sources.map((source) => ({
      title: source.title,
      url: source.url,
      category: source.category,
      source_type: source.source_type,
      auto_fetch: source.auto_fetch,
      sample_summary: source.sample_summary || "",
    })),
  });
}

function ensureCategoryCoverage(brief: DingtalkBrief): void {
  const categories = new Set(brief.signals.map((signal) => signal.category));
  for (const category of ["policy", "platform", "fulfillment", "growth"]) {
    if (!categories.has(category as DingtalkBrief["signals"][number]["category"])) {
      throw new Error(`schema validation failed: missing ${category} signal`);
    }
  }
}

function validateSourceUrls(brief: DingtalkBrief, sources: DingtalkSourceConfig[]): DingtalkBrief {
  const urls = new Set(sources.map((source) => source.url.replace(/\/$/, "")));
  for (const signal of brief.signals) {
    if (!urls.has(signal.source_url.replace(/\/$/, ""))) {
      throw new Error("model selected source_url outside configured source list");
    }
  }
  ensureCategoryCoverage(brief);
  return brief;
}

async function callOpenAi(config: DingtalkRuntimeConfig, sources: DingtalkSourceConfig[]): Promise<DingtalkBrief> {
  if (!config.openAiApiKey) throw new Error("SETUP_ERROR: OPENAI_API_KEY is required in live mode");
  if (!config.openAiModel) throw new Error("SETUP_ERROR: OPENAI_MODEL is required in live mode");

  const client = new OpenAI({ apiKey: config.openAiApiKey });
  const response = await client.responses.create({
    model: config.openAiModel,
    input: [
      {
        role: "system",
        content: "你只输出符合 schema 的 JSON。不要输出解释，不要输出 Markdown。",
      },
      {
        role: "user",
        content: buildLivePrompt(config, sources),
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "yqn_dingtalk_morning_brief",
        strict: true,
        schema: dingtalkBriefJsonSchema,
      },
    },
  });

  return validateSourceUrls(validateDingtalkBrief(coerceJson(extractOutputText(response))), sources);
}

async function generateLiveWithRetry(config: DingtalkRuntimeConfig, sources: DingtalkSourceConfig[]): Promise<DingtalkBrief> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await callOpenAi(config, sources);
    } catch (error) {
      lastError = error;
      console.warn(`[dingtalk:generate] live schema/source validation failed on attempt ${attempt}`);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("live brief generation failed");
}

export async function generateDingtalkBrief(config = readDingtalkRuntimeConfig()): Promise<DingtalkBrief> {
  const collection = await collectDingtalkSources(config.repoRoot);
  const brief = config.mode === "demo"
    ? buildSampleBrief(config.date, collection.sources)
    : await generateLiveWithRetry(config, collection.sources);

  const parsed = validateSourceUrls(validateDingtalkBrief({
    ...brief,
    date: config.date,
    title: `YQN 北美履约增长晨报｜${config.date}`,
    mode: config.mode,
  }), collection.sources);

  await writeJsonFile(dataPath(config), parsed);
  await writeTextFile(markdownPath(config), renderDingtalkMarkdown(parsed, config.siteUrl));
  console.log(`[dingtalk:generate] wrote data/dingtalk-briefs/${config.date}.json (${config.mode})`);
  return parsed;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  generateDingtalkBrief().catch((error) => {
    console.error(error instanceof Error ? error.message : "DingTalk brief generation failed");
    process.exit(1);
  });
}
