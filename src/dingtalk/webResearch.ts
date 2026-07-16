import { readFile } from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import YAML from "yaml";
import { z } from "zod";
import { dateInTimeZone, hoursAgo } from "../utils/date.js";
import { normalizeUrl, sourceDomain } from "../utils/domain.js";
import { DingtalkRuntimeConfig } from "./config.js";
import { DingtalkNewsCandidate } from "./collectRealSignals.js";
import { ImpactStage, MarketFocus, SourceCategory } from "./schema.js";

const regionSchema = z.object({
  label: z.string().min(2),
  allowed_domains: z.array(z.string().min(3)).min(1),
  queries: z.array(z.string().min(8)).min(1),
});

const intelligenceConfigSchema = z.object({
  search_windows_hours: z.object({ primary: z.number().int().positive(), fallback: z.number().int().positive() }),
  minimum_core_value_score: z.number().int().min(0).max(100),
  required_mix: z.object({
    us_warehouse: z.number().int().min(1),
    mexico_warehouse: z.number().int().min(1),
    us_mexico_bridge: z.number().int().min(1),
  }),
  regions: z.object({
    us_warehouse: regionSchema,
    mexico_warehouse: regionSchema,
    us_mexico_bridge: regionSchema,
  }),
});

const researchItemSchema = z.object({
  title: z.string().min(4).max(180),
  source_name: z.string().min(2).max(120),
  source_url: z.string().url(),
  published_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  effective_at: z.string().min(4).max(40),
  summary: z.string().min(12).max(700),
  affected_sellers: z.string().min(4).max(120),
  impact_stages: z.array(z.enum(["first_mile", "warehousing", "last_mile"])).min(1).max(3),
  seller_check: z.string().min(8).max(160),
});

const researchResultSchema = z.object({
  items: z.array(researchItemSchema).max(6),
});

const researchJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "title",
          "source_name",
          "source_url",
          "published_at",
          "effective_at",
          "summary",
          "affected_sellers",
          "impact_stages",
          "seller_check",
        ],
        properties: {
          title: { type: "string", minLength: 4, maxLength: 180 },
          source_name: { type: "string", minLength: 2, maxLength: 120 },
          source_url: { type: "string", format: "uri" },
          published_at: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
          effective_at: { type: "string", minLength: 4, maxLength: 40 },
          summary: { type: "string", minLength: 12, maxLength: 700 },
          affected_sellers: { type: "string", minLength: 4, maxLength: 120 },
          impact_stages: {
            type: "array",
            minItems: 1,
            maxItems: 3,
            items: { type: "string", enum: ["first_mile", "warehousing", "last_mile"] },
          },
          seller_check: { type: "string", minLength: 8, maxLength: 160 },
        },
      },
    },
  },
} as const;

export interface WebSearchAudit {
  market_focus: Extract<MarketFocus, "us_warehouse" | "mexico_warehouse" | "us_mexico_bridge">;
  completed: boolean;
  searched_at: string;
  query_count: number;
  source_urls: string[];
  accepted_candidates: number;
  rejected_unverified_urls: string[];
}

export interface WebResearchCollection {
  candidates: DingtalkNewsCandidate[];
  audits: WebSearchAudit[];
  minimumCoreValueScore: number;
  requiredMix: { us_warehouse: number; mexico_warehouse: number; us_mexico_bridge: number };
}

type ResearchFocus = WebSearchAudit["market_focus"];

function extractOutputText(response: unknown): string {
  const candidate = response as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
  if (typeof candidate.output_text === "string" && candidate.output_text.trim()) return candidate.output_text;
  const text = candidate.output?.flatMap((item) => item.content || []).map((content) => content.text).filter(Boolean).join("\n");
  if (text) return text;
  throw new Error("web research response did not contain text output");
}

function collectVerifiedUrls(response: unknown): { urls: string[]; completed: boolean } {
  const output = (response as { output?: unknown[] }).output || [];
  const urls = new Set<string>();
  let completed = false;
  for (const rawItem of output) {
    const item = rawItem as {
      type?: string;
      status?: string;
      action?: { type?: string; sources?: Array<{ url?: string }> };
      content?: Array<{ annotations?: Array<{ type?: string; url?: string }> }>;
    };
    if (item.type === "web_search_call" && item.status === "completed") completed = true;
    for (const source of item.action?.sources || []) {
      if (source.url) urls.add(normalizeUrl(source.url));
    }
    for (const content of item.content || []) {
      for (const annotation of content.annotations || []) {
        if (annotation.url) urls.add(normalizeUrl(annotation.url));
      }
    }
  }
  return { urls: [...urls], completed };
}

function comparableUrl(value: string): string {
  const url = new URL(value);
  return `${url.hostname.replace(/^www\./, "")}${url.pathname.replace(/\/$/, "")}`.toLowerCase();
}

function verifiedSource(url: string, verifiedUrls: string[], allowedDomains: string[]): boolean {
  const domain = sourceDomain(url).replace(/^www\./, "");
  const allowed = allowedDomains.some((item) => domain === item || domain.endsWith(`.${item}`));
  if (!allowed) return false;
  const target = comparableUrl(url);
  return verifiedUrls.some((item) => {
    try {
      return comparableUrl(item) === target;
    } catch {
      return false;
    }
  });
}

function categoryForUrl(url: string): SourceCategory {
  const domain = sourceDomain(url);
  if (/amazon|walmart|tiktok|mercadolibre/.test(domain)) return "platform_seller";
  if (/ups|fedex|usps|portoflosangeles|polb/.test(domain)) return "competitor_fulfillment";
  return "overseas_policy";
}

function directImpactScore(text: string): number {
  const groups = [
    /cost|fee|rate|surcharge|tariff|duty|price|费用|费率|附加费|关税|成本/i,
    /delay|time|effective|deadline|congestion|时效|延误|生效|截止|拥堵/i,
    /compliance|customs|filing|certificate|regulation|aduana|合规|海关|申报|认证|规则/i,
    /inventory|warehouse|fulfillment|storage|return|库存|仓储|履约|退货|库容/i,
  ];
  const hits = groups.filter((pattern) => pattern.test(text)).length;
  return hits >= 3 ? 30 : hits === 2 ? 22 : hits === 1 ? 15 : 0;
}

function urgencyScore(publishedAt: Date, effectiveAt: string, now: Date): number {
  const age = hoursAgo(publishedAt, now);
  const parsedEffective = /^\d{4}-\d{2}-\d{2}$/.test(effectiveAt) ? new Date(`${effectiveAt}T00:00:00Z`) : undefined;
  const daysToEffective = parsedEffective ? Math.abs(parsedEffective.getTime() - now.getTime()) / 86_400_000 : Number.POSITIVE_INFINITY;
  if (age <= 24 || daysToEffective <= 14) return 20;
  if (age <= 168 || daysToEffective <= 30) return 14;
  return 5;
}

export function calculateValueScore(input: {
  title: string;
  summary: string;
  affectedSellers: string;
  impactStages: ImpactStage[];
  publishedAt: Date;
  effectiveAt: string;
  official: boolean;
  now: Date;
}): number {
  const text = `${input.title} ${input.summary}`;
  const merchantImpact = directImpactScore(text);
  const urgency = urgencyScore(input.publishedAt, input.effectiveAt, input.now);
  const serviceRelevance = input.impactStages.length >= 3 ? 20 : input.impactStages.length === 2 ? 17 : 12;
  const coverageHits = [/seller|merchant|importer|卖家|商家|进口商/i, /large|medium|small|大件|中件|小件|all categories|全品类/i]
    .filter((pattern) => pattern.test(input.affectedSellers)).length;
  const merchantCoverage = coverageHits >= 2 ? 15 : coverageHits === 1 ? 12 : 10;
  const credibility = input.official ? 10 : 4;
  const age = hoursAgo(input.publishedAt, input.now);
  const novelty = age <= 24 ? 5 : age <= 168 ? 3 : 0;
  return Math.min(100, merchantImpact + urgency + serviceRelevance + merchantCoverage + credibility + novelty);
}

function scoreReasons(score: number, stages: ImpactStage[]): string[] {
  return [`卖家损益评分 ${score}`, `影响环节 ${stages.join("/")}`, "官方来源联网核验"];
}

async function runRegionResearch(
  client: OpenAI,
  config: DingtalkRuntimeConfig,
  focus: ResearchFocus,
  region: z.infer<typeof regionSchema>,
  now: Date,
): Promise<{ candidates: DingtalkNewsCandidate[]; audit: WebSearchAudit }> {
  const prompt = JSON.stringify({
    today: config.date,
    region: region.label,
    queries: region.queries,
    task: "搜索最近24小时的官方变化；不足时扩展到最近7天。只保留会影响跨境电商卖家头程、仓储或配送成本、时效、合规、库存的信息。",
    rules: [
      "必须实际调用 web_search，并只使用允许域名中的官方页面。",
      "政策和费率必须给出具体生效日；确实未公布时 effective_at 写 未公布。",
      "source_url 必须是具体信息页面，不要写搜索结果页或网站首页。",
      "不要使用俄罗斯、欧洲、英国、东南亚、中东或泛AI新闻填充。",
      "没有足够强信号时返回更少 items，不得编造。",
      "只输出 JSON。",
    ],
  });
  const response = await client.responses.create({
    model: config.openAiModel as string,
    tools: [{
      type: "web_search",
      filters: { allowed_domains: region.allowed_domains },
      search_context_size: "high",
      user_location: {
        type: "approximate",
        country: focus === "mexico_warehouse" ? "MX" : "US",
        timezone: focus === "mexico_warehouse" ? "America/Mexico_City" : "America/Chicago",
      },
    }],
    tool_choice: "required",
    include: ["web_search_call.action.sources"],
    input: [
      { role: "system", content: "你是北美跨境电商物流研究员，只输出有官方证据的结构化结果。" },
      { role: "user", content: prompt },
    ],
    text: {
      format: {
        type: "json_schema",
        name: `yqn_${focus}_web_research`,
        strict: true,
        schema: researchJsonSchema,
      },
    },
  });

  const verification = collectVerifiedUrls(response);
  if (!verification.completed) throw new Error(`required web_search did not complete for ${focus}`);
  const parsed = researchResultSchema.parse(JSON.parse(extractOutputText(response)));
  const rejected: string[] = [];
  const candidates = parsed.items.flatMap((item) => {
    if (!verifiedSource(item.source_url, verification.urls, region.allowed_domains)) {
      rejected.push(item.source_url);
      return [];
    }
    const publishedAt = new Date(`${item.published_at}T12:00:00Z`);
    if (hoursAgo(publishedAt, now) > 168) return [];
    const valueScore = calculateValueScore({
      title: item.title,
      summary: item.summary,
      affectedSellers: item.affected_sellers,
      impactStages: item.impact_stages,
      publishedAt,
      effectiveAt: item.effective_at,
      official: true,
      now,
    });
    return [{
      title: item.title,
      url: normalizeUrl(item.source_url),
      domain: sourceDomain(item.source_url),
      summary: item.summary,
      source_name: item.source_name,
      source_home_url: new URL(item.source_url).origin,
      source_category: categoryForUrl(item.source_url),
      source_type: "official" as const,
      source_published_at: item.published_at,
      published_at_iso: publishedAt.toISOString(),
      effective_at: item.effective_at,
      affected_sellers: item.affected_sellers,
      impact_stages: item.impact_stages,
      seller_check: item.seller_check,
      collected_at: new Date().toISOString(),
      market_focus: focus,
      score: valueScore,
      value_score: valueScore,
      account_opening_score: valueScore,
      score_reasons: scoreReasons(valueScore, item.impact_stages),
      business_value_reasons: ["影响卖家成本、时效、合规或库存", "可映射到 YQN 头程、仓储或配送能力"],
    } satisfies DingtalkNewsCandidate];
  });

  return {
    candidates,
    audit: {
      market_focus: focus,
      completed: true,
      searched_at: new Date().toISOString(),
      query_count: region.queries.length,
      source_urls: verification.urls,
      accepted_candidates: candidates.length,
      rejected_unverified_urls: rejected,
    },
  };
}

export async function collectMandatoryWebResearch(
  config: DingtalkRuntimeConfig,
  now = new Date(),
): Promise<WebResearchCollection> {
  if (!config.webSearchEnabled) throw new Error("SETUP_ERROR: OPENAI_WEB_SEARCH_ENABLED must be true in live mode");
  if (!config.openAiApiKey) throw new Error("SETUP_ERROR: OPENAI_API_KEY is required for mandatory web search");
  if (!config.openAiModel) throw new Error("SETUP_ERROR: OPENAI_MODEL is required for mandatory web search");
  if (config.maxSearchCalls < 3) throw new Error("SETUP_ERROR: MAX_SEARCH_CALLS must be at least 3 for US, Mexico and bridge research");

  const configPath = path.join(config.repoRoot, "config", "north-america-intelligence.yaml");
  const researchConfig = intelligenceConfigSchema.parse(YAML.parse(await readFile(configPath, "utf8")));
  const client = new OpenAI({ apiKey: config.openAiApiKey });
  const focuses: ResearchFocus[] = ["us_warehouse", "mexico_warehouse", "us_mexico_bridge"];
  const results = [];
  for (const focus of focuses.slice(0, config.maxSearchCalls)) {
    results.push(await runRegionResearch(client, config, focus, researchConfig.regions[focus], now));
  }

  const audits = results.map((item) => item.audit);
  const completed = new Set(audits.filter((item) => item.completed).map((item) => item.market_focus));
  if (!completed.has("us_warehouse") || !completed.has("mexico_warehouse")) {
    throw new Error("mandatory US and Mexico web searches were not both completed");
  }
  if (!completed.has("us_mexico_bridge")) throw new Error("mandatory US-Mexico bridge web search was not completed");

  return {
    candidates: results.flatMap((item) => item.candidates),
    audits,
    minimumCoreValueScore: researchConfig.minimum_core_value_score,
    requiredMix: researchConfig.required_mix,
  };
}

export function webResearchDate(config: DingtalkRuntimeConfig): string {
  return dateInTimeZone(config.timeZone);
}
