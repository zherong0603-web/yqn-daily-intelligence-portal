import { readFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { dateInTimeZone } from "./utils/date.js";
import { SourceConfig, sourcesFileSchema } from "./schema.js";
import { OptionalIntegrations, readBooleanEnv, readEnv, readOptionalIntegrations } from "./utils/env.js";

export interface RuntimeConfig {
  repoRoot: string;
  date: string;
  timeZone: string;
  openAiApiKey?: string;
  openAiModel?: string;
  encryptionEnabled: boolean;
  pageAccessPassphrase?: string;
  siteUrl: string;
  runId: string;
  optionalIntegrations: OptionalIntegrations;
  publicSetupStatus: PublicSetupStatus;
}

export interface PublicSetupStatus {
  openAiApiKeyConfigured: boolean;
  openAiModelConfigured: boolean;
  feishuWebhookConfigured: boolean;
  pageAccessPassphraseConfigured: boolean;
  encryptionEnabled: boolean;
  openAiWebSearchEnabled: boolean;
  maxSearchCalls: number;
}

function defaultSiteUrl(): string {
  const explicit = readEnv("SITE_URL");
  if (explicit) return explicit.replace(/\/$/, "");
  const repository = readEnv("GITHUB_REPOSITORY");
  if (!repository) return "";
  const owner = repository.split("/")[0];
  const repo = repository.split("/")[1];
  return `https://${owner}.github.io/${repo}`;
}

export function readRuntimeConfig(repoRoot = process.cwd()): RuntimeConfig {
  const timeZone = "Asia/Taipei";
  const date = readEnv("BRIEF_DATE") || dateInTimeZone(timeZone);
  const runId = readEnv("GITHUB_RUN_ID") || `local-${Date.now()}`;
  const openAiApiKey = readEnv("OPENAI_API_KEY");
  const openAiModel = readEnv("OPENAI_MODEL");
  const pageAccessPassphrase = readEnv("PAGE_ACCESS_PASSPHRASE");
  const encryptionEnabled = readBooleanEnv("BRIEF_ENCRYPTION_ENABLED", false);
  const optionalIntegrations = readOptionalIntegrations();
  return {
    repoRoot,
    date,
    timeZone,
    openAiApiKey,
    openAiModel,
    encryptionEnabled,
    pageAccessPassphrase,
    siteUrl: defaultSiteUrl(),
    runId,
    optionalIntegrations,
    publicSetupStatus: {
      openAiApiKeyConfigured: Boolean(openAiApiKey),
      openAiModelConfigured: Boolean(openAiModel),
      feishuWebhookConfigured: Boolean(readEnv("FEISHU_WEBHOOK_URL")),
      pageAccessPassphraseConfigured: Boolean(pageAccessPassphrase),
      encryptionEnabled,
      openAiWebSearchEnabled: optionalIntegrations.openAiWebSearchEnabled,
      maxSearchCalls: optionalIntegrations.maxSearchCalls,
    },
  };
}

export async function loadSources(repoRoot = process.cwd()): Promise<SourceConfig[]> {
  const configPath = path.join(repoRoot, "config", "sources.yaml");
  const raw = await readFile(configPath, "utf8");
  const parsed = sourcesFileSchema.parse(YAML.parse(raw));
  return parsed.sources.filter((source) => source.enabled);
}
