import path from "node:path";
import { Brief } from "./schema.js";
import { isoWeek, monthParts } from "./utils/date.js";
import { writeTextFile } from "./utils/fs.js";
import { basePathFromSiteUrl, renderArchivePage, renderPage } from "./utils/html.js";

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    groups.set(key, [...(groups.get(key) || []), item]);
  }
  return groups;
}

export function archiveMetadata(briefs: Brief[]) {
  const months = [...groupBy(briefs, (brief) => {
    const { year, month } = monthParts(brief.date);
    return `${year}/${month}`;
  }).keys()].sort().reverse();
  const weeks = [...groupBy(briefs, (brief) => {
    const week = isoWeek(brief.date);
    return `${week.year}/week-${String(week.week).padStart(2, "0")}`;
  }).keys()].sort().reverse();
  return { months, weeks };
}

export async function writeArchivePages(options: {
  briefs: Brief[];
  distDir: string;
  siteUrl: string;
}): Promise<void> {
  const basePath = basePathFromSiteUrl(options.siteUrl);
  const briefs = options.briefs;
  await writeTextFile(
    path.join(options.distDir, "archive", "index.html"),
    renderPage({
      title: "全部归档 · YQN 每日重点简报",
      basePath,
      body: renderArchivePage("全部归档", briefs),
    }),
  );

  const byYear = groupBy(briefs, (brief) => brief.date.slice(0, 4));
  for (const [year, yearBriefs] of byYear) {
    await writeTextFile(
      path.join(options.distDir, "archive", year, "index.html"),
      renderPage({
        title: `${year} 归档 · YQN 每日重点简报`,
        basePath,
        body: renderArchivePage(`${year} 归档`, yearBriefs),
      }),
    );
  }

  const byMonth = groupBy(briefs, (brief) => {
    const { year, month } = monthParts(brief.date);
    return `${year}/${month}`;
  });
  for (const [monthKey, monthBriefs] of byMonth) {
    const [year, month] = monthKey.split("/");
    await writeTextFile(
      path.join(options.distDir, "archive", year || "unknown", month || "unknown", "index.html"),
      renderPage({
        title: `${monthKey} 月归档 · YQN 每日重点简报`,
        basePath,
        body: renderArchivePage(`${monthKey} 月归档`, monthBriefs),
      }),
    );
  }

  const byWeek = groupBy(briefs, (brief) => {
    const week = isoWeek(brief.date);
    return `${week.year}/week-${String(week.week).padStart(2, "0")}`;
  });
  for (const [weekKey, weekBriefs] of byWeek) {
    const [year, week] = weekKey.split("/");
    await writeTextFile(
      path.join(options.distDir, "archive", year || "unknown", week || "unknown", "index.html"),
      renderPage({
        title: `${weekKey} 周归档 · YQN 每日重点简报`,
        basePath,
        body: renderArchivePage(`${weekKey} 周归档`, weekBriefs),
      }),
    );
  }
}
