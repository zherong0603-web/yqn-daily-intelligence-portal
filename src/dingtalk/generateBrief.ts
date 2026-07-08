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
  productName,
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
    title: `${productName}｜${config.date}`,
    role: "你是 YQN 每日 5 分钟编辑，只服务 YQN 团队的公开信息晨报。",
    format: "固定 1+5：今日判断、5条高权重信号。群内只展示前3条，归档展示全部5条。",
    hard_rules: [
      "只输出符合 schema 的 JSON，不输出 Markdown。",
      "one_liner 必须 30 字以内，说明今天最值得 YQN 团队花 5 分钟看的判断。",
      "signals 必须刚好 5 条，category 分别是 market、platform、customer、fulfillment、yqn_view。",
      "按影响力排序，不要按来源平均分配；群内只会展示前3条，所以前3条必须最值得看。",
      "筛选标准：老板能看风险和方向，运营能看规则变化，销售能看客户提问，内容能看选题切口，履约能看供给变化。",
      "每条 signal 必须有 source_name、source_url、source_published_at、collected_at、info_region、info_type、confidence_label、is_test_data、source_summary。",
      "source_url 只能使用 sources 里的 url；source_name 必须使用对应 source 的 title。",
      `source_published_at 必须写 YYYY-MM-DD；如果来源没有发布日期，写当天日期 ${config.date}，不要写“来源未注明日期”。`,
      "collected_at 必须是 ISO datetime。",
      "confidence_label 只能是 high、medium、low，不得输出百分比。",
      "倒金字塔：发生了什么先写最重要事实。",
      "5W1H：每条至少明确谁、何时、发生什么、为什么影响。",
      "事实和判断分开：发生了什么只写事实；为什么重要只写影响；YQN 可用点只写业务看法。",
      "不允许使用空话：持续关注、提升效率、加强学习、赋能业务、值得重视、市场变化明显。除非后面有具体动作。",
      "不允许把模型判断伪装成事实。",
      "不得出现客户名单、客户联系方式、报价、合同、毛利、内部成本、未公开客户案例、销售聊天记录、私域客户明细。",
      "不得出现 Codex、OPC、个人副业、个人赚钱、用户个人叙事。",
      "只写公开信号和 YQN 可公开表达的业务动作；任何需要登录、后台、客户数据的来源不得进入群版。",
      `如果资料不足，source_published_at 写当天日期 ${config.date}、confidence_label=low，并明确资料不足，不要编造。`,
      "live 模式如果使用样例或非实时资料，相关 signal 的 is_test_data 必须为 true。",
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
  for (const category of ["market", "platform", "customer", "fulfillment", "yqn_view"]) {
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

function extractGitHubModelsText(response: unknown): string {
  const candidate = response as { choices?: Array<{ message?: { content?: string } }> };
  const text = candidate.choices?.[0]?.message?.content;
  if (typeof text === "string" && text.trim()) return text;
  throw new Error("GitHub Models response did not contain message content");
}

async function callGitHubModels(config: DingtalkRuntimeConfig, sources: DingtalkSourceConfig[]): Promise<DingtalkBrief> {
  if (!config.githubToken) {
    throw new Error("SETUP_ERROR: live mode requires OPENAI_API_KEY or GitHub Actions GITHUB_TOKEN with models: read");
  }
  const response = await fetch("https://models.github.ai/inference/chat/completions", {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.githubToken}`,
    },
    body: JSON.stringify({
      model: config.githubModelsModel,
      temperature: 0.2,
      max_tokens: 1800,
      messages: [
        {
          role: "system",
          content: "你只输出符合 schema 的 JSON。不要输出 Markdown，不要输出解释。",
        },
        {
          role: "user",
          content: buildLivePrompt(config, sources),
        },
      ],
    }),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`GitHub Models request failed with HTTP ${response.status}`);
  }
  return validateSourceUrls(validateDingtalkBrief(coerceJson(extractGitHubModelsText(JSON.parse(body)))), sources);
}

async function callLiveModel(config: DingtalkRuntimeConfig, sources: DingtalkSourceConfig[]): Promise<DingtalkBrief> {
  if (config.openAiApiKey) return callOpenAi(config, sources);
  return callGitHubModels(config, sources);
}

async function generateLiveWithRetry(config: DingtalkRuntimeConfig, sources: DingtalkSourceConfig[]): Promise<DingtalkBrief> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await callLiveModel(config, sources);
    } catch (error) {
      lastError = error;
      console.warn(`[dingtalk:generate] live schema/source validation failed on attempt ${attempt}`);
    }
  }
  if (!config.openAiApiKey && config.githubToken) {
    console.warn("[dingtalk:generate] GitHub Models fallback did not pass schema; publishing safe demo brief instead");
    return buildSampleBrief(config.date, sources);
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
    title: `${productName}｜${config.date}`,
    mode: brief.mode === "demo" ? "demo" : config.mode,
  }), collection.sources);

  await writeJsonFile(dataPath(config), parsed);
  await writeTextFile(markdownPath(config), renderDingtalkMarkdown(parsed, {
    publicBaseUrl: config.publicBaseUrl,
    archiveAvailable: Boolean(config.publicBaseUrl),
    testLabel: true,
  }));
  console.log(`[dingtalk:generate] wrote data/dingtalk-briefs/${config.date}.json (${config.mode})`);
  return parsed;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  generateDingtalkBrief().catch((error) => {
    console.error(error instanceof Error ? error.message : "DingTalk brief generation failed");
    process.exit(1);
  });
}
