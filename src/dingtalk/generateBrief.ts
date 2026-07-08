import OpenAI from "openai";
import { pathToFileURL } from "node:url";
import { writeTextFile, writeJsonFile } from "../utils/fs.js";
import { collectDingtalkSources } from "./collectSources.js";
import {
  dataPath,
  markdownPath,
  readDingtalkRuntimeConfig,
  DingtalkRuntimeConfig,
  sourceReportPath,
} from "./config.js";
import {
  collectDingtalkRealSignals,
  DingtalkNewsCandidate,
  DingtalkRealSignalCollection,
} from "./collectRealSignals.js";
import { renderDingtalkMarkdown } from "./renderMarkdown.js";
import { buildSampleBrief } from "./sampleBrief.js";
import {
  DingtalkBrief,
  DingtalkSourceConfig,
  SignalCategory,
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

function buildLivePrompt(
  config: DingtalkRuntimeConfig,
  sources: DingtalkSourceConfig[],
  candidates: DingtalkNewsCandidate[],
): string {
  return JSON.stringify({
    date: config.date,
    title: `${productName}｜${config.date}`,
    role: "你是 YQN 每日 5 分钟编辑，只服务 YQN 团队的公开信息晨报，目标是帮助客户开户数增长。",
    format: "固定 1+5：今日判断、5条高权重真实公开信号。群内只展示前3条，归档展示全部5条。",
    hard_rules: [
      "只输出符合 schema 的 JSON，不输出 Markdown。",
      "one_liner 必须 30 字以内，说明今天最值得 YQN 团队花 5 分钟看的判断。",
      "signals 必须刚好 5 条，category 分别是 market、platform、customer、fulfillment、yqn_view。",
      "按影响力排序，不要按来源平均分配；群内只会展示前3条，所以前3条必须最值得看。",
      "筛选标准：直接服务客户开户数；老板能看风险和方向，运营能看规则变化，销售能看客户提问，内容能看选题切口，履约能看供给变化。",
      "内容比例：约90%聚焦美仓、美国尾程、北美履约、美国平台卖家；约10%保留墨仓/美墨链路，只有强信号才写。",
      "每条 signal 必须有 source_name、source_url、source_published_at、collected_at、info_region、info_type、confidence_label、is_test_data、source_summary。",
      "source_url 只能使用 candidates 里的 url；source_name 必须使用对应 candidate 的 source_name。",
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
      "live 模式必须基于 candidates 的真实公开条目；is_test_data 必须为 false。",
    ],
    business_context: [
      "YQN 当前核心任务是客户开户数增长。",
      "晨报要帮助销售找到更好的开户切入点，帮助内容找到选题，帮助履约理解卖家为什么会问美仓、退货、尾程、备货、墨仓。",
      "不要为了发而发。当天弱信号也要说清弱在哪里，不包装成重大机会。",
    ],
    sources: sources.map((source) => ({
      title: source.title,
      url: source.url,
      category: source.category,
      source_type: source.source_type,
      auto_fetch: source.auto_fetch,
      sample_summary: source.sample_summary || "",
    })),
    candidates: candidates.slice(0, 25).map((candidate, index) => ({
      id: index + 1,
      title: candidate.title,
      url: candidate.url,
      source_name: candidate.source_name,
      source_published_at: candidate.source_published_at,
      published_at_iso: candidate.published_at_iso,
      category_hint: candidate.source_category,
      market_focus: candidate.market_focus,
      score: candidate.score,
      score_reasons: candidate.score_reasons,
      summary: candidate.summary,
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

function clipText(value: string, max: number): string {
  const text = value.replace(/\s+/g, " ").trim();
  if (Array.from(text).length <= max) return text;
  return `${Array.from(text).slice(0, Math.max(0, max - 1)).join("")}…`;
}

function textOf(candidate: DingtalkNewsCandidate): string {
  return `${candidate.title} ${candidate.summary}`.toLowerCase();
}

function pickCandidate(
  candidates: DingtalkNewsCandidate[],
  usedUrls: Set<string>,
  predicate: (candidate: DingtalkNewsCandidate) => boolean,
): DingtalkNewsCandidate {
  const matched = candidates.find((candidate) => !usedUrls.has(candidate.url) && predicate(candidate));
  const fallback = candidates.find((candidate) => !usedUrls.has(candidate.url)) || candidates[0];
  if (!fallback) throw new Error("No real news candidates available");
  const selected = matched || fallback;
  usedUrls.add(selected.url);
  return selected;
}

function candidateCategory(category: SignalCategory, candidate: DingtalkNewsCandidate) {
  const title = localizedTitle(category, candidate);
  const what = `公开来源发布「${clipText(candidate.title, 72)}」。`;
  const summary = clipText(candidate.summary || candidate.title, 70);
  const sourceSummary = clipText(summary || `${candidate.source_name} 公开条目，按真实来源采集。`, 160);

  const categoryCopy: Record<SignalCategory, { title: string; why: string; yqn: string; infoType: DingtalkBrief["signals"][number]["info_type"] }> = {
    market: {
      title,
      why: "运价、清关和库存变化会影响卖家是否从直邮转向本土仓。",
      yqn: "开户沟通先问平台、货型、日单量、清关和备货节奏。",
      infoType: "market",
    },
    platform: {
      title,
      why: "平台费用、时效和合规变化会直接影响卖家履约成本。",
      yqn: "把平台规则翻译成入库、出库、尾程、退货和异常处理能力。",
      infoType: "platform",
    },
    customer: {
      title,
      why: "卖家会把配送稳定、费用变化和售后体验放进服务商筛选。",
      yqn: "内容和销售切口从低价改为确定性、风险兜底和可追踪。",
      infoType: "customer",
    },
    fulfillment: {
      title,
      why: "承运商、仓网和尾程波动会改变客户对海外仓的紧迫感。",
      yqn: "优先解释美国仓备货、退货、尾程和异常处理的组合价值。",
      infoType: "fulfillment",
    },
    yqn_view: {
      title,
      why: candidate.market_focus === "mexico_warehouse"
        ? "墨仓只占少量内容，但美墨链路变化会影响部分卖家的北美布局。"
        : "多条信号都指向一个方向：客户更关心交付确定性而非单点价格。",
      yqn: "晨报只保留能转成开户问题、选题或履约解释的信号。",
      infoType: candidate.market_focus === "mexico_warehouse" ? "fulfillment" : "yqn_view",
    },
  };
  const copy = categoryCopy[category];
  return {
    category,
    title: clipText(copy.title, 80),
    what_happened: clipText(what, 170),
    why_it_matters: clipText(copy.why, 130),
    yqn_use: clipText(copy.yqn, 130),
    source_name: candidate.source_name,
    source_url: candidate.url,
    source_published_at: candidate.source_published_at,
    collected_at: candidate.collected_at,
    info_region: candidate.market_focus === "domestic_seller" ? "domestic" as const : candidate.market_focus === "global" ? "global" as const : "overseas" as const,
    info_type: copy.infoType,
    confidence_label: candidate.score >= 38 ? "high" as const : candidate.score >= 25 ? "medium" as const : "low" as const,
    is_test_data: false,
    source_summary: sourceSummary,
    is_sensitive: false,
  };
}

function localizedTitle(category: SignalCategory, candidate: DingtalkNewsCandidate): string {
  const text = textOf(candidate);
  if (text.includes("usps") && text.includes("noncompliance")) return "USPS 合规费用提醒卖家重算尾程成本";
  if (text.includes("usps") && (text.includes("rate") || text.includes("rates"))) return "USPS 费率变化影响平台卖家履约成本";
  if (text.includes("transpacific") || (text.includes("ocean") && text.includes("rate"))) return "跨太平洋运价上行，备货窗口变紧";
  if (text.includes("usmca")) return "USMCA 仍是北美供应链稳定性的关键变量";
  if (text.includes("mexico") && text.includes("customs")) return "墨西哥海关规则变化考验美墨链路数据";
  if (text.includes("ltl") && (text.includes("shut") || text.includes("shutdown"))) return "LTL 承运商波动提醒客户重视尾程兜底";
  if (text.includes("warehouse") && (text.includes("close") || text.includes("closing"))) return "美国仓网调整会影响卖家备货判断";
  if (text.includes("walmart") && text.includes("delivery")) return "平台配送用工变化会传导到履约稳定性";
  if (text.includes("returns")) return "退货体验继续影响卖家选择海外仓";
  const prefix: Record<SignalCategory, string> = {
    market: "市场信号",
    platform: "平台信号",
    customer: "客户信号",
    fulfillment: "履约信号",
    yqn_view: candidate.market_focus === "mexico_warehouse" ? "墨仓信号" : "YQN 观察",
  };
  return `${prefix[category]}：${clipText(candidate.title, 34)}`;
}

function buildFallbackRealBrief(
  config: DingtalkRuntimeConfig,
  realSignals: DingtalkRealSignalCollection,
): DingtalkBrief {
  const candidates = realSignals.candidates;
  if (candidates.length < 5) {
    throw new Error("Not enough real public candidates to build a fallback brief");
  }
  const usedUrls = new Set<string>();
  const market = pickCandidate(candidates, usedUrls, (candidate) => /ocean|rate|tariff|customs|usmca|transpacific|import|section 321|de minimis/i.test(textOf(candidate)));
  const platform = pickCandidate(candidates, usedUrls, (candidate) => /seller|marketplace|amazon|walmart|ebay|tiktok|shopify|usps|fee|noncompliance|rate/i.test(textOf(candidate)));
  const customer = pickCandidate(candidates, usedUrls, (candidate) => candidate.market_focus === "domestic_seller" || /ecommerce|merchant|seller|returns|shipping/i.test(textOf(candidate)));
  const fulfillment = pickCandidate(candidates, usedUrls, (candidate) => /warehouse|fulfillment|3pl|ltl|carrier|logistics|delivery|supply chain|returns/i.test(textOf(candidate)));
  const view = pickCandidate(candidates, usedUrls, (candidate) => candidate.market_focus === "mexico_warehouse");

  const selected = [
    candidateCategory("market", market),
    candidateCategory("platform", platform),
    candidateCategory("customer", customer),
    candidateCategory("fulfillment", fulfillment),
    candidateCategory("yqn_view", view),
  ];
  return validateDingtalkBrief({
    date: config.date,
    title: `${productName}｜${config.date}`,
    one_liner: "开户更吃交付确定性",
    signals: selected,
    sources: selected.map((signal) => {
      const candidate = candidates.find((item) => item.url === signal.source_url);
      return {
        title: signal.source_name,
        url: signal.source_url,
        category: candidate?.source_category || "competitor_fulfillment",
        source_type: candidate?.source_type || "media",
        auto_fetch: true,
      };
    }),
    mode: "live",
    generated_at: new Date().toISOString(),
    risk_flags: [],
  });
}

function validateSourceUrls(brief: DingtalkBrief, allowedUrls: string[]): DingtalkBrief {
  const urls = new Set(allowedUrls.map((url) => url.replace(/\/$/, "")));
  for (const signal of brief.signals) {
    if (!urls.has(signal.source_url.replace(/\/$/, ""))) {
      throw new Error("model selected source_url outside configured source list");
    }
  }
  ensureCategoryCoverage(brief);
  return brief;
}

async function callOpenAi(
  config: DingtalkRuntimeConfig,
  sources: DingtalkSourceConfig[],
  candidates: DingtalkNewsCandidate[],
): Promise<DingtalkBrief> {
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
        content: buildLivePrompt(config, sources, candidates),
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

  return validateSourceUrls(validateDingtalkBrief(coerceJson(extractOutputText(response))), candidates.map((candidate) => candidate.url));
}

function extractGitHubModelsText(response: unknown): string {
  const candidate = response as { choices?: Array<{ message?: { content?: string } }> };
  const text = candidate.choices?.[0]?.message?.content;
  if (typeof text === "string" && text.trim()) return text;
  throw new Error("GitHub Models response did not contain message content");
}

async function callGitHubModels(
  config: DingtalkRuntimeConfig,
  sources: DingtalkSourceConfig[],
  candidates: DingtalkNewsCandidate[],
): Promise<DingtalkBrief> {
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
      max_tokens: 2600,
      messages: [
        {
          role: "system",
          content: "你只输出符合 schema 的 JSON。不要输出 Markdown，不要输出解释。",
        },
        {
          role: "user",
          content: buildLivePrompt(config, sources, candidates),
        },
      ],
    }),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`GitHub Models request failed with HTTP ${response.status}`);
  }
  return validateSourceUrls(validateDingtalkBrief(coerceJson(extractGitHubModelsText(JSON.parse(body)))), candidates.map((candidate) => candidate.url));
}

async function callLiveModel(
  config: DingtalkRuntimeConfig,
  sources: DingtalkSourceConfig[],
  candidates: DingtalkNewsCandidate[],
): Promise<DingtalkBrief> {
  if (config.openAiApiKey) return callOpenAi(config, sources, candidates);
  return callGitHubModels(config, sources, candidates);
}

async function generateLiveWithRetry(
  config: DingtalkRuntimeConfig,
  sources: DingtalkSourceConfig[],
  realSignals: DingtalkRealSignalCollection,
): Promise<DingtalkBrief> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await callLiveModel(config, sources, realSignals.candidates);
    } catch (error) {
      lastError = error;
      console.warn(`[dingtalk:generate] live schema/source validation failed on attempt ${attempt}`);
    }
  }
  console.warn(`[dingtalk:generate] live model failed; publishing deterministic real-source brief: ${lastError instanceof Error ? lastError.message : "unknown error"}`);
  return buildFallbackRealBrief(config, realSignals);
}

export async function generateDingtalkBrief(config = readDingtalkRuntimeConfig()): Promise<DingtalkBrief> {
  const collection = await collectDingtalkSources(config.repoRoot);
  const realSignals = config.mode === "live" ? await collectDingtalkRealSignals(config.repoRoot) : undefined;
  if (realSignals) {
    await writeJsonFile(sourceReportPath(config), {
      date: config.date,
      generated_at: new Date().toISOString(),
      source_window_hours: realSignals.source_window_hours,
      source_count_before_window: realSignals.source_count_before_window,
      source_errors: realSignals.source_errors,
      candidates: realSignals.candidates.map((candidate) => ({
        title: candidate.title,
        url: candidate.url,
        source_name: candidate.source_name,
        source_published_at: candidate.source_published_at,
        market_focus: candidate.market_focus,
        score: candidate.score,
        score_reasons: candidate.score_reasons,
      })),
    });
  }
  const brief = config.mode === "demo"
    ? buildSampleBrief(config.date, collection.sources)
    : await generateLiveWithRetry(config, collection.sources, realSignals as DingtalkRealSignalCollection);
  const allowedUrls = config.mode === "demo"
    ? collection.sources.map((source) => source.url)
    : (realSignals as DingtalkRealSignalCollection).candidates.map((candidate) => candidate.url);

  const parsed = validateSourceUrls(validateDingtalkBrief({
    ...brief,
    date: config.date,
    title: `${productName}｜${config.date}`,
    mode: brief.mode === "demo" ? "demo" : config.mode,
  }), allowedUrls);

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
