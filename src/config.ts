import { readFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { dateInTimeZone } from "./utils/date.js";
import { SourceConfig, sourcesFileSchema } from "./schema.js";

export interface RuntimeConfig {
  repoRoot: string;
  date: string;
  timeZone: string;
  openAiApiKey?: string;
  openAiModel: string;
  encryptionEnabled: boolean;
  pageAccessPassphrase?: string;
  siteUrl: string;
  runId: string;
}

function envFlag(name: string, defaultValue = false): boolean {
  const value = process.env[name];
  if (value == null || value === "") return defaultValue;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function defaultSiteUrl(): string {
  const explicit = process.env.SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const repository = process.env.GITHUB_REPOSITORY;
  if (!repository) return "";
  const owner = repository.split("/")[0];
  const repo = repository.split("/")[1];
  return `https://${owner}.github.io/${repo}`;
}

export function readRuntimeConfig(repoRoot = process.cwd()): RuntimeConfig {
  const timeZone = "Asia/Taipei";
  const date = process.env.BRIEF_DATE || dateInTimeZone(timeZone);
  const runId = process.env.GITHUB_RUN_ID || `local-${Date.now()}`;
  return {
    repoRoot,
    date,
    timeZone,
    openAiApiKey: process.env.OPENAI_API_KEY,
    openAiModel: process.env.OPENAI_MODEL || "gpt-5.4-mini",
    encryptionEnabled: envFlag("BRIEF_ENCRYPTION_ENABLED", false),
    pageAccessPassphrase: process.env.PAGE_ACCESS_PASSPHRASE,
    siteUrl: defaultSiteUrl(),
    runId,
  };
}

export async function loadSources(repoRoot = process.cwd()): Promise<SourceConfig[]> {
  const configPath = path.join(repoRoot, "config", "sources.yaml");
  const raw = await readFile(configPath, "utf8");
  const parsed = sourcesFileSchema.parse(YAML.parse(raw));
  return parsed.sources.filter((source) => source.enabled);
}
