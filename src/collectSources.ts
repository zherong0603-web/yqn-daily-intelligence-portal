import Parser from "rss-parser";
import { pathToFileURL } from "node:url";
import { collectedSourceSchema, CollectedSource, SourceConfig } from "./schema.js";
import { loadSources } from "./config.js";
import { hoursAgo, parseDateMaybe } from "./utils/date.js";
import { normalizeUrl, sourceDomain } from "./utils/domain.js";

const parser = new Parser({
  timeout: 15_000,
  headers: {
    "User-Agent": "YQN-Daily-Intelligence-Portal/1.0 (+https://github.com/zherong0603-web/yqn-daily-intelligence-portal)",
  },
});

export interface CollectionResult {
  candidates: CollectedSource[];
  source_window_hours: 72 | 168;
  source_count_before_window: number;
}

async function fetchText(url: string, timeoutMs = 15_000): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "YQN-Daily-Intelligence-Portal/1.0",
        Accept: "text/html,application/rss+xml,application/atom+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function stripHtml(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1000);
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

async function collectFeedSource(source: SourceConfig): Promise<CollectedSource[]> {
  const raw = await fetchText(source.url);
  const feed = await parser.parseString(raw);
  return feed.items
    .map((item) => {
      const url = normalizeUrl(item.link || item.guid || source.url);
      const publishedAt = parseDateMaybe(item.isoDate || item.pubDate, new Date()).toISOString();
      return collectedSourceSchema.parse({
        topic: source.topic,
        source_name: source.name,
        source_type: source.type,
        source_weight: source.weight,
        title: htmlEntityDecode(item.title || feed.title || source.name).slice(0, 220),
        url,
        domain: sourceDomain(url),
        published_at: publishedAt,
        summary: stripHtml(item.contentSnippet || item.content || item.summary || item.title || ""),
      });
    })
    .filter((candidate) => candidate.title.length > 1 && candidate.url.startsWith("http"));
}

async function collectWebpageSource(source: SourceConfig): Promise<CollectedSource[]> {
  const html = await fetchText(source.url);
  const title = firstMatch(html, [
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<title[^>]*>([\s\S]*?)<\/title>/i,
  ]) || source.name;
  const description = firstMatch(html, [
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["'][^>]*>/i,
  ]);
  return [
    collectedSourceSchema.parse({
      topic: source.topic,
      source_name: source.name,
      source_type: source.type,
      source_weight: source.weight,
      title: title.slice(0, 220),
      url: normalizeUrl(source.url),
      domain: sourceDomain(source.url),
      published_at: new Date().toISOString(),
      summary: stripHtml(description || title),
    }),
  ];
}

async function collectOneSource(source: SourceConfig): Promise<CollectedSource[]> {
  if (source.type === "webpage") return collectWebpageSource(source);
  return collectFeedSource(source);
}

function dedupe(candidates: CollectedSource[]): CollectedSource[] {
  const seen = new Set<string>();
  const output: CollectedSource[] = [];
  for (const candidate of candidates) {
    const key = `${normalizeUrl(candidate.url)}|${candidate.title.toLowerCase().trim()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(candidate);
  }
  return output;
}

function sortCandidates(candidates: CollectedSource[]): CollectedSource[] {
  return candidates.sort((a, b) => {
    const weightDiff = b.source_weight - a.source_weight;
    if (weightDiff !== 0) return weightDiff;
    return b.published_at.localeCompare(a.published_at);
  });
}

export async function collectSourcesForBrief(
  sources: SourceConfig[],
  now = new Date(),
): Promise<CollectionResult> {
  const batches = await Promise.allSettled(sources.map((source) => collectOneSource(source)));
  const all: CollectedSource[] = [];
  batches.forEach((result, index) => {
    if (result.status === "fulfilled") {
      all.push(...result.value);
      return;
    }
    const sourceName = sources[index]?.name || "unknown source";
    console.warn(`[sources] skipped ${sourceName}: ${result.reason instanceof Error ? result.reason.message : "fetch failed"}`);
  });

  const unique = sortCandidates(dedupe(all));
  const in72 = unique.filter((candidate) => hoursAgo(new Date(candidate.published_at), now) <= 72);
  if (in72.length >= 8) {
    return {
      candidates: in72.slice(0, 40),
      source_window_hours: 72,
      source_count_before_window: unique.length,
    };
  }

  const in168 = unique.filter((candidate) => hoursAgo(new Date(candidate.published_at), now) <= 168);
  return {
    candidates: in168.slice(0, 40),
    source_window_hours: 168,
    source_count_before_window: unique.length,
  };
}

export async function collectSourcesCli(): Promise<void> {
  const sources = await loadSources();
  const result = await collectSourcesForBrief(sources);
  console.log(JSON.stringify({
    candidates: result.candidates.length,
    source_window_hours: result.source_window_hours,
    source_count_before_window: result.source_count_before_window,
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectSourcesCli().catch((error) => {
    console.error(error instanceof Error ? error.message : "source collection failed");
    process.exit(1);
  });
}
