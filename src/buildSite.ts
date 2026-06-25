import path from "node:path";
import { pathToFileURL } from "node:url";
import { readRuntimeConfig } from "./config.js";
import { Brief, briefSchema } from "./schema.js";
import { writeArchivePages, archiveMetadata } from "./buildArchives.js";
import { writeSearchIndex } from "./buildSearchIndex.js";
import { encryptJson, publicPreview } from "./encryptContent.js";
import { compareDateAsc, compareDateDesc } from "./utils/date.js";
import { ensureDir, listJsonFiles, readJsonFile, resetDir, writeJsonFile, writeTextFile } from "./utils/fs.js";
import {
  basePathFromSiteUrl,
  browserDecryptAndSearchScript,
  lockedReportScript,
  renderBriefStatic,
  renderExecutivePage,
  renderHome,
  renderLockedReport,
  renderPage,
} from "./utils/html.js";

export interface BuildSiteOptions {
  repoRoot?: string;
  dataDir?: string;
  distDir?: string;
  encryptionEnabled?: boolean;
  passphrase?: string;
  siteUrl?: string;
}

function parseArgs(argv: string[]): Pick<BuildSiteOptions, "dataDir" | "distDir"> {
  const output: Pick<BuildSiteOptions, "dataDir" | "distDir"> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--data-dir" && argv[index + 1]) output.dataDir = argv[index + 1];
    if (arg === "--dist-dir" && argv[index + 1]) output.distDir = argv[index + 1];
  }
  return output;
}

export async function loadBriefs(dataDir: string): Promise<Brief[]> {
  const files = await listJsonFiles(dataDir);
  const briefs = await Promise.all(files.map(async (file) => briefSchema.parse(await readJsonFile(path.join(dataDir, file)))));
  return briefs.sort(compareDateDesc);
}

function manifestFor(briefs: Brief[]) {
  return briefs.map((brief) => ({
    date: brief.date,
    one_liner: brief.one_liner,
    item_count: brief.items.length,
    topics: [...new Set(brief.items.map((item) => item.topic))],
    is_low_signal_day: brief.is_low_signal_day,
    source_window_hours: brief.source_window_hours,
    url: `reports/${brief.date}/`,
  }));
}

function calendarFor(briefs: Brief[]) {
  return briefs.map((brief) => ({
    date: brief.date,
    item_count: brief.items.length,
    is_low_signal_day: brief.is_low_signal_day,
    url: `reports/${brief.date}/`,
  }));
}

async function writeReport(options: {
  brief: Brief;
  distDir: string;
  encrypted: boolean;
  passphrase?: string;
  basePath: string;
  previousDate?: string;
  nextDate?: string;
}): Promise<void> {
  const reportDir = path.join(options.distDir, "reports", options.brief.date);
  await ensureDir(reportDir);
  const publicBrief = { ...options.brief, encryption_enabled: options.encrypted };
  if (options.encrypted) {
    await writeJsonFile(path.join(reportDir, "brief.json"), {
      encrypted: true,
      preview: publicPreview(publicBrief),
      payload: await encryptJson(publicBrief, options.passphrase || ""),
    });
    await writeTextFile(
      path.join(reportDir, "index.html"),
      renderPage({
        title: `${options.brief.date} · YQN Daily Intelligence Portal`,
        basePath: options.basePath,
        body: renderLockedReport(publicBrief, options.previousDate, options.nextDate),
        script: lockedReportScript(),
      }),
    );
    return;
  }

  await writeJsonFile(path.join(reportDir, "brief.json"), publicBrief);
  await writeTextFile(
    path.join(reportDir, "index.html"),
    renderPage({
      title: `${options.brief.date} · YQN Daily Intelligence Portal`,
      basePath: options.basePath,
      body: renderBriefStatic(publicBrief, options.previousDate, options.nextDate),
    }),
  );
}

export async function buildSite(options: BuildSiteOptions = {}): Promise<void> {
  const repoRoot = options.repoRoot || process.cwd();
  const config = readRuntimeConfig(repoRoot);
  const dataDir = path.resolve(repoRoot, options.dataDir || "data/briefs");
  const distDir = path.resolve(repoRoot, options.distDir || "dist");
  const encrypted = options.encryptionEnabled ?? config.encryptionEnabled;
  const passphrase = options.passphrase ?? config.pageAccessPassphrase;
  const siteUrl = options.siteUrl ?? config.siteUrl;
  if (encrypted && !passphrase) {
    throw new Error("PAGE_ACCESS_PASSPHRASE is required when BRIEF_ENCRYPTION_ENABLED=true");
  }

  const basePath = basePathFromSiteUrl(siteUrl);
  const briefs = await loadBriefs(dataDir);
  const desc = briefs.sort(compareDateDesc);
  const asc = [...desc].sort(compareDateAsc);
  const latest = desc[0];

  await resetDir(distDir);
  await writeTextFile(path.join(distDir, "robots.txt"), "User-agent: *\nDisallow: /\n");
  await writeJsonFile(path.join(distDir, "manifest.json"), {
    generated_at: new Date().toISOString(),
    latest_date: latest?.date || null,
    reports: manifestFor(desc),
    archives: archiveMetadata(desc),
    encryption_enabled: encrypted,
  });
  await writeJsonFile(path.join(distDir, "calendar.json"), calendarFor(desc));

  if (latest) {
    const latestPayload = encrypted
      ? { encrypted: true, preview: publicPreview({ ...latest, encryption_enabled: true }), payload: await encryptJson({ ...latest, encryption_enabled: true }, passphrase || "") }
      : { ...latest, encryption_enabled: false };
    await writeJsonFile(path.join(distDir, "latest.json"), latestPayload);
  } else {
    await writeJsonFile(path.join(distDir, "latest.json"), { latest_date: null, encryption_enabled: encrypted });
  }

  await writeTextFile(
    path.join(distDir, "index.html"),
    renderPage({
      title: "YQN Growth War Room",
      basePath,
      body: renderHome(latest ? { ...latest, encryption_enabled: encrypted } : undefined, desc.map((brief) => ({ ...brief, encryption_enabled: encrypted })), encrypted),
      script: browserDecryptAndSearchScript(),
    }),
  );

  await writeTextFile(
    path.join(distDir, "executive", "index.html"),
    renderPage({
      title: "管理层摘要 · YQN Growth War Room",
      basePath,
      body: renderExecutivePage(latest ? { ...latest, encryption_enabled: encrypted } : undefined, encrypted),
    }),
  );

  for (const [index, brief] of asc.entries()) {
    await writeReport({
      brief,
      distDir,
      encrypted,
      passphrase,
      basePath,
      previousDate: asc[index - 1]?.date,
      nextDate: asc[index + 1]?.date,
    });
  }

  await writeSearchIndex({ briefs: desc.map((brief) => ({ ...brief, encryption_enabled: encrypted })), distDir, encrypted, passphrase });
  await writeArchivePages({ briefs: desc.map((brief) => ({ ...brief, encryption_enabled: encrypted })), distDir, siteUrl });
  console.log(`[build] wrote ${desc.length} report(s) to ${path.relative(repoRoot, distDir) || distDir}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const cliOptions = parseArgs(process.argv.slice(2));
  buildSite(cliOptions).catch((error) => {
    console.error(error instanceof Error ? error.message : "site build failed");
    process.exit(1);
  });
}
