import Parser from "rss-parser";
import { pathToFileURL } from "node:url";
import { dateInTimeZone, hoursAgo, parseDateMaybe } from "../utils/date.js";
import { normalizeUrl, sourceDomain } from "../utils/domain.js";
import { collectDingtalkSources } from "./collectSources.js";
import {
  DingtalkSourceConfig,
  MarketFocus,
  SourceCategory,
  SourceType,
} from "./schema.js";

const parser = new Parser({
  timeout: 15_000,
  headers: {
    "User-Agent": "YQN-Daily-5-Minutes/1.3 (+https://github.com/zherong0603-web/yqn-daily-intelligence-portal)",
  },
});

export interface DingtalkNewsCandidate {
  title: string;
  url: string;
  domain: string;
  summary: string;
  source_name: string;
  source_home_url: string;
  source_category: SourceCategory;
  source_type: SourceType;
  source_published_at: string;
  published_at_iso: string;
  collected_at: string;
  market_focus: MarketFocus;
  score: number;
  account_opening_score: number;
  score_reasons: string[];
  business_value_reasons: string[];
}

export interface DingtalkRealSignalCollection {
  candidates: DingtalkNewsCandidate[];
  source_count_before_window: number;
  source_window_hours: 72 | 168;
  collected_at: string;
  source_errors: Array<{ source_name: string; reason: string }>;
}

async function fetchText(url: string, timeoutMs = 15_000): Promise<string> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "YQN-Daily-5-Minutes/1.3",
          Accept: "text/html,application/rss+xml,application/atom+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 600));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("fetch failed");
}

function stripHtml(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 700);
}

function htmlEntityDecode(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function firstMatch(html: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const matched = html.match(pattern)?.[1];
    if (matched) return htmlEntityDecode(matched.trim());
  }
  return "";
}

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
}

function keywordHits(text: string, keywords: string[]): number {
  return keywords.reduce((count, keyword) => count + (text.includes(keyword.toLowerCase()) ? 1 : 0), 0);
}

const usWarehouseKeywords = [
  "warehouse",
  "fulfillment",
  "3pl",
  "distribution",
  "inventory",
  "returns",
  "last mile",
  "delivery",
  "carrier",
  "ltl",
  "usps",
  "ups",
  "fedex",
  "supply chain",
  "transpacific",
  "ocean rates",
  "port",
  "customs",
  "tariff",
  "de minimis",
  "section 321",
];

const mexicoKeywords = [
  "mexico",
  "mexican",
  "cross-border",
  "borderlands",
  "laredo",
  "monterrey",
  "nearshoring",
  "usmca",
  "customs brokerage",
];

const sellerDemandKeywords = [
  "seller",
  "merchant",
  "marketplace",
  "ecommerce",
  "e-commerce",
  "amazon",
  "walmart",
  "ebay",
  "tiktok shop",
  "shopify",
  "fee",
  "rates",
  "noncompliance",
  "shipping",
  "returns",
];

const accountOpeningKeywords = [
  "seller",
  "merchant",
  "shipping",
  "returns",
  "rates",
  "fee",
  "fulfillment",
  "warehouse",
  "inventory",
  "delivery",
  "customs",
  "compliance",
];

const salesQuestionKeywords = [
  "fee",
  "rates",
  "surcharge",
  "noncompliance",
  "customs",
  "tariff",
  "compliance",
  "delay",
  "delivery",
  "returns",
  "inventory",
  "warehouse",
];

const contentTopicKeywords = [
  "seller",
  "marketplace",
  "amazon",
  "walmart",
  "tiktok shop",
  "shopify",
  "usps",
  "fedex",
  "ups",
  "returns",
  "shipping",
];

const fulfillmentExplainKeywords = [
  "fulfillment",
  "warehouse",
  "3pl",
  "carrier",
  "last mile",
  "ltl",
  "distribution",
  "inventory",
  "delivery",
  "returns",
  "supply chain",
];

const weakKeywords = [
  "ai visibility",
  "headline",
  "summer sale",
  "stock",
  "earnings",
  "automotive",
  "electric vehicle",
];

function scoreCandidate(input: {
  title: string;
  summary: string;
  publishedAt: Date;
  source: DingtalkSourceConfig;
  now: Date;
}): { score: number; accountOpeningScore: number; reasons: string[]; businessValueReasons: string[] } {
  const text = `${input.title} ${input.summary}`.toLowerCase();
  const reasons: string[] = [];
  const businessValueReasons: string[] = [];
  let score = input.source.weight ?? 5;
  let accountOpeningScore = 0;

  const age = hoursAgo(input.publishedAt, input.now);
  if (age <= 36) {
    score += 8;
    reasons.push("36小时内");
  } else if (age <= 72) {
    score += 5;
    reasons.push("72小时内");
  } else if (age <= 168) {
    score += 2;
    reasons.push("7天内");
  } else {
    score -= 10;
  }

  const usHits = keywordHits(text, usWarehouseKeywords);
  if (usHits > 0) {
    score += Math.min(18, usHits * 4);
    accountOpeningScore += Math.min(28, usHits * 5);
    reasons.push("美仓/北美履约");
    businessValueReasons.push("可解释美仓和北美履约需求");
  }

  const mxHits = keywordHits(text, mexicoKeywords);
  if (mxHits > 0) {
    score += Math.min(10, mxHits * 3);
    accountOpeningScore += Math.min(10, mxHits * 2);
    reasons.push("墨仓/美墨链路");
  }

  const sellerHits = keywordHits(text, sellerDemandKeywords);
  if (sellerHits > 0) {
    score += Math.min(14, sellerHits * 3);
    accountOpeningScore += Math.min(22, sellerHits * 4);
    reasons.push("卖家需求");
    businessValueReasons.push("可转成销售开口问题");
  }

  const openingHits = keywordHits(text, accountOpeningKeywords);
  if (openingHits >= 2) {
    score += 8;
    accountOpeningScore += Math.min(18, openingHits * 3);
    reasons.push("开户转化相关");
  }

  const salesHits = keywordHits(text, salesQuestionKeywords);
  if (salesHits >= 2) {
    score += 6;
    accountOpeningScore += Math.min(18, salesHits * 3);
    businessValueReasons.push("销售可用于判断客户痛点");
  }

  const topicHits = keywordHits(text, contentTopicKeywords);
  if (topicHits >= 2) {
    score += 4;
    accountOpeningScore += Math.min(14, topicHits * 2);
    businessValueReasons.push("内容可转成选题切口");
  }

  const fulfillmentHits = keywordHits(text, fulfillmentExplainKeywords);
  if (fulfillmentHits >= 2) {
    score += 5;
    accountOpeningScore += Math.min(16, fulfillmentHits * 3);
    businessValueReasons.push("履约可用于解释服务价值");
  }

  if (input.source.market_focus === "us_warehouse") {
    score += 7;
    accountOpeningScore += 10;
  }
  if (input.source.market_focus === "mexico_warehouse") {
    score += 4;
    accountOpeningScore += 4;
  }
  if (input.source.market_focus === "domestic_seller") {
    score += 5;
    accountOpeningScore += 8;
  }

  if (includesAny(text, weakKeywords) && usHits + mxHits + sellerHits < 2) {
    score -= 8;
    accountOpeningScore -= 8;
    reasons.push("泛资讯降权");
  }

  return {
    score,
    accountOpeningScore: Math.max(0, Math.min(100, accountOpeningScore)),
    reasons,
    businessValueReasons,
  };
}

function sourceFocus(source: DingtalkSourceConfig): MarketFocus {
  return source.market_focus || "global";
}

function inferMarketFocus(source: DingtalkSourceConfig, title: string, summary: string): MarketFocus {
  const text = `${title} ${summary}`.toLowerCase();
  if (keywordHits(text, mexicoKeywords) > 0) return "mexico_warehouse";
  return sourceFocus(source);
}

async function collectFeed(source: DingtalkSourceConfig, now: Date): Promise<DingtalkNewsCandidate[]> {
  const feedUrl = source.fetch_url || source.url;
  const raw = await fetchText(feedUrl);
  const feed = await parser.parseString(raw);
  const collectedAt = new Date().toISOString();
  return feed.items
    .map((item) => {
      const url = normalizeUrl(item.link || item.guid || source.url);
      const publishedAt = parseDateMaybe(item.isoDate || item.pubDate, now);
      const title = htmlEntityDecode(item.title || feed.title || source.title).replace(/\s+/g, " ").trim().slice(0, 180);
      const summary = stripHtml(item.contentSnippet || item.content || item.summary || item.title || "");
      const scored = scoreCandidate({ title, summary, publishedAt, source, now });
      const marketFocus = inferMarketFocus(source, title, summary);
      return {
        title,
        url,
        domain: sourceDomain(url),
        summary,
        source_name: source.title,
        source_home_url: source.url,
        source_category: source.category,
        source_type: source.source_type,
        source_published_at: dateInTimeZone("Asia/Shanghai", publishedAt),
        published_at_iso: publishedAt.toISOString(),
        collected_at: collectedAt,
        market_focus: marketFocus,
        score: scored.score,
        account_opening_score: scored.accountOpeningScore,
        score_reasons: scored.reasons,
        business_value_reasons: scored.businessValueReasons,
      };
    })
    .filter((candidate) => candidate.title.length > 2 && candidate.url.startsWith("http"));
}

async function collectWebpage(source: DingtalkSourceConfig, now: Date): Promise<DingtalkNewsCandidate[]> {
  const html = await fetchText(source.fetch_url || source.url);
  const title = firstMatch(html, [
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<title[^>]*>([\s\S]*?)<\/title>/i,
  ]) || source.title;
  const summary = firstMatch(html, [
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["'][^>]*>/i,
  ]) || title;
  const publishedAt = now;
  const scored = scoreCandidate({ title, summary, publishedAt, source, now });
  const marketFocus = inferMarketFocus(source, title, summary);
  return [{
    title: title.slice(0, 180),
    url: normalizeUrl(source.url),
    domain: sourceDomain(source.url),
    summary: stripHtml(summary),
    source_name: source.title,
    source_home_url: source.url,
    source_category: source.category,
    source_type: source.source_type,
    source_published_at: dateInTimeZone("Asia/Shanghai", publishedAt),
    published_at_iso: publishedAt.toISOString(),
    collected_at: new Date().toISOString(),
    market_focus: marketFocus,
    score: scored.score,
    account_opening_score: scored.accountOpeningScore,
    score_reasons: scored.reasons,
    business_value_reasons: scored.businessValueReasons,
  }];
}

async function collectOne(source: DingtalkSourceConfig, now: Date): Promise<DingtalkNewsCandidate[]> {
  if ((source.fetch_type || "rss") === "webpage") return collectWebpage(source, now);
  return collectFeed(source, now);
}

function dedupe(candidates: DingtalkNewsCandidate[]): DingtalkNewsCandidate[] {
  const seen = new Set<string>();
  const output: DingtalkNewsCandidate[] = [];
  for (const candidate of candidates) {
    const key = `${candidate.url.replace(/\/$/, "")}|${candidate.title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(candidate);
  }
  return output;
}

function sortCandidates(candidates: DingtalkNewsCandidate[]): DingtalkNewsCandidate[] {
  return candidates.sort((a, b) => {
    const openingDiff = b.account_opening_score - a.account_opening_score;
    if (openingDiff !== 0) return openingDiff;
    const scoreDiff = b.score - a.score;
    if (scoreDiff !== 0) return scoreDiff;
    return b.published_at_iso.localeCompare(a.published_at_iso);
  });
}

function capMexicoShare(candidates: DingtalkNewsCandidate[]): DingtalkNewsCandidate[] {
  const mexico = candidates.filter((candidate) => candidate.market_focus === "mexico_warehouse");
  const nonMexico = candidates.filter((candidate) => candidate.market_focus !== "mexico_warehouse");
  if (!mexico.length) return nonMexico;
  const topMexico = mexico[0] as DingtalkNewsCandidate;
  return [...nonMexico.slice(0, 24), topMexico].sort((a, b) => b.score - a.score);
}

export async function collectDingtalkRealSignals(
  repoRoot = process.cwd(),
  now = new Date(),
): Promise<DingtalkRealSignalCollection> {
  const collection = await collectDingtalkSources(repoRoot);
  const sources = collection.sources.filter((source) => source.enabled && source.auto_fetch && source.fetch_url);
  const settled = await Promise.allSettled(sources.map((source) => collectOne(source, now)));
  const sourceErrors: Array<{ source_name: string; reason: string }> = [];
  const all: DingtalkNewsCandidate[] = [];

  settled.forEach((result, index) => {
    const source = sources[index];
    if (result.status === "fulfilled") {
      all.push(...result.value);
      return;
    }
    sourceErrors.push({
      source_name: source?.title || "unknown",
      reason: result.reason instanceof Error ? result.reason.message : "fetch failed",
    });
  });

  const unique = sortCandidates(dedupe(all));
  const in72 = unique.filter((candidate) => hoursAgo(new Date(candidate.published_at_iso), now) <= 72);
  const windowed = in72.length >= 8
    ? { candidates: in72, source_window_hours: 72 as const }
    : {
        candidates: unique.filter((candidate) => hoursAgo(new Date(candidate.published_at_iso), now) <= 168),
        source_window_hours: 168 as const,
      };

  return {
    candidates: capMexicoShare(windowed.candidates).slice(0, 35),
    source_count_before_window: unique.length,
    source_window_hours: windowed.source_window_hours,
    collected_at: new Date().toISOString(),
    source_errors: sourceErrors,
  };
}

export async function collectDingtalkRealSignalsCli(): Promise<void> {
  const result = await collectDingtalkRealSignals();
  console.log(JSON.stringify({
    candidates: result.candidates.length,
    source_window_hours: result.source_window_hours,
    source_count_before_window: result.source_count_before_window,
    source_errors: result.source_errors,
    top: result.candidates.slice(0, 8).map((candidate) => ({
      score: candidate.score,
      title: candidate.title,
      source_name: candidate.source_name,
      market_focus: candidate.market_focus,
      reasons: candidate.score_reasons,
      url: candidate.url,
    })),
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectDingtalkRealSignalsCli().catch((error) => {
    console.error(error instanceof Error ? error.message : "DingTalk real signal collection failed");
    process.exit(1);
  });
}
