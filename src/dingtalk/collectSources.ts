import { pathToFileURL } from "node:url";
import { loadDingtalkSources } from "./config.js";
import { DingtalkSourceConfig } from "./schema.js";

export interface DingtalkSourceCollection {
  sources: DingtalkSourceConfig[];
  collected_at: string;
  mode_note: string;
}

export async function collectDingtalkSources(repoRoot = process.cwd()): Promise<DingtalkSourceCollection> {
  const sources = await loadDingtalkSources(repoRoot);
  return {
    sources,
    collected_at: new Date().toISOString(),
    mode_note: "V1.1 使用公开来源白名单和人工审核公开资料；不抓取后台、内部 MQL 表或客户数据。",
  };
}

export async function collectSourcesCli(): Promise<void> {
  const collection = await collectDingtalkSources();
  console.log(JSON.stringify({
    source_count: collection.sources.length,
    collected_at: collection.collected_at,
    categories: [...new Set(collection.sources.map((source) => source.category))],
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectSourcesCli().catch((error) => {
    console.error(error instanceof Error ? error.message : "DingTalk source collection failed");
    process.exit(1);
  });
}
