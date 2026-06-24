import path from "node:path";
import { Brief } from "./schema.js";
import { encryptJson } from "./encryptContent.js";
import { writeJsonFile } from "./utils/fs.js";

export interface SearchEntry {
  date: string;
  topic: string;
  title: string;
  one_liner: string;
  source_title: string;
  source_domain: string;
  url: string;
  search_text: string;
}

export function createSearchIndex(briefs: Brief[]): SearchEntry[] {
  return briefs.flatMap((brief) => {
    if (brief.items.length === 0) {
      return [{
        date: brief.date,
        topic: "",
        title: brief.one_liner,
        one_liner: brief.one_liner,
        source_title: "",
        source_domain: "",
        url: `reports/${brief.date}/`,
        search_text: [
          brief.one_liner,
          brief.executive_summary,
          ...brief.action_checklist,
        ].join(" "),
      }];
    }
    return brief.items.map((item) => ({
      date: brief.date,
      topic: item.topic,
      title: item.title,
      one_liner: brief.one_liner,
      source_title: item.source_title,
      source_domain: item.source_domain,
      url: `reports/${brief.date}/`,
      search_text: [
        item.title,
        brief.one_liner,
        item.what_happened,
        item.why_it_matters,
        item.yqn_insight,
        item.today_action,
        item.source_title,
        item.source_domain,
      ].join(" "),
    }));
  });
}

export async function writeSearchIndex(options: {
  briefs: Brief[];
  distDir: string;
  encrypted: boolean;
  passphrase?: string;
}): Promise<void> {
  const index = createSearchIndex(options.briefs);
  const payload = options.encrypted
    ? { encrypted: true, payload: await encryptJson(index, options.passphrase || "") }
    : index;
  await writeJsonFile(path.join(options.distDir, "search-index.json"), payload);
}
