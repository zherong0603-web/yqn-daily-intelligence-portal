import { readFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { dateInTimeZone } from "../utils/date.js";
import { readEnv } from "../utils/env.js";
import {
  BriefMode,
  briefModeSchema,
  DingtalkSourceConfig,
  dingtalkSourcesFileSchema,
} from "./schema.js";

export interface DingtalkRuntimeConfig {
  repoRoot: string;
  date: string;
  mode: BriefMode;
  dryRun: boolean;
  formalGroupEnabled: boolean;
  livestreamGroupEnabled: boolean;
  webSearchEnabled: boolean;
  maxSearchCalls: number;
  timeZone: "Asia/Shanghai";
  openAiApiKey?: string;
  openAiModel?: string;
  githubToken?: string;
  githubModelsModel: string;
  webhookUrl?: string;
  secret?: string;
  formalWebhookUrl?: string;
  formalSecret?: string;
  livestreamWebhookUrl?: string;
  livestreamSecret?: string;
  ownerWebhookUrl?: string;
  publicBaseUrl: string;
  runId: string;
}

export function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "y"].includes(value.trim().toLowerCase());
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function parseCliArgs(argv = process.argv.slice(2)): Record<string, string> {
  const output: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg?.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      output[key] = next;
      index += 1;
    } else {
      output[key] = "true";
    }
  }
  return output;
}

function defaultPublicBaseUrl(): string {
  const explicit = readEnv("PUBLIC_BASE_URL") || readEnv("PAGES_BASE_URL") || readEnv("SITE_URL");
  if (explicit) return explicit.replace(/\/$/, "");
  const repository = readEnv("GITHUB_REPOSITORY");
  if (!repository) return "";
  const [owner, repo] = repository.split("/");
  if (!owner || !repo) return "";
  return `https://${owner}.github.io/${repo}`;
}

export function readDingtalkRuntimeConfig(
  repoRoot = process.cwd(),
  cliArgs: Record<string, string> = parseCliArgs(),
): DingtalkRuntimeConfig {
  const mode = briefModeSchema.parse(cliArgs.mode || readEnv("BRIEF_MODE") || "demo");
  const date = cliArgs.date || cliArgs.brief_date || readEnv("BRIEF_DATE") || dateInTimeZone("Asia/Shanghai");
  const dryRun = parseBoolean(cliArgs.dry_run || readEnv("DRY_RUN"), true);
  return {
    repoRoot,
    date,
    mode,
    dryRun,
    formalGroupEnabled: parseBoolean(readEnv("DINGTALK_FORMAL_GROUP_ENABLED"), false),
    livestreamGroupEnabled: parseBoolean(readEnv("DINGTALK_YQN_LIVE_GROUP_ENABLED"), false),
    webSearchEnabled: parseBoolean(readEnv("OPENAI_WEB_SEARCH_ENABLED"), mode === "live"),
    maxSearchCalls: parsePositiveInteger(readEnv("MAX_SEARCH_CALLS"), 3),
    timeZone: "Asia/Shanghai",
    openAiApiKey: readEnv("OPENAI_API_KEY"),
    openAiModel: readEnv("OPENAI_MODEL"),
    githubToken: readEnv("GITHUB_TOKEN"),
    githubModelsModel: readEnv("GH_MODELS_MODEL") || readEnv("GITHUB_MODELS_MODEL") || "openai/gpt-4o",
    webhookUrl: readEnv("DINGTALK_WEBHOOK_URL"),
    secret: readEnv("DINGTALK_SECRET"),
    formalWebhookUrl: readEnv("DINGTALK_FORMAL_WEBHOOK_URL"),
    formalSecret: readEnv("DINGTALK_FORMAL_SECRET"),
    livestreamWebhookUrl: readEnv("DINGTALK_YQN_LIVE_GROUP_WEBHOOK_URL"),
    livestreamSecret: readEnv("DINGTALK_YQN_LIVE_GROUP_SECRET"),
    ownerWebhookUrl: readEnv("DINGTALK_OWNER_WEBHOOK_URL"),
    publicBaseUrl: defaultPublicBaseUrl(),
    runId: readEnv("GITHUB_RUN_ID") || `local-${Date.now()}`,
  };
}

export async function loadDingtalkSources(repoRoot = process.cwd()): Promise<DingtalkSourceConfig[]> {
  const configPath = path.join(repoRoot, "config", "sources.yaml");
  const raw = await readFile(configPath, "utf8");
  const parsed = dingtalkSourcesFileSchema.parse(YAML.parse(raw));
  return parsed.dingtalk_sources.filter((source) => source.enabled);
}

export function dataPath(config: DingtalkRuntimeConfig): string {
  return path.join(config.repoRoot, "data", "dingtalk-briefs", `${config.date}.json`);
}

export function markdownPath(config: DingtalkRuntimeConfig): string {
  return path.join(config.repoRoot, "data", "dingtalk-briefs", `${config.date}.md`);
}

export function riskReportPath(config: DingtalkRuntimeConfig): string {
  return path.join(config.repoRoot, "data", "dingtalk-briefs", `${config.date}.risk_report.json`);
}

export function validationReportPath(config: DingtalkRuntimeConfig): string {
  return path.join(config.repoRoot, "data", "dingtalk-briefs", `${config.date}.validation_report.json`);
}

export function archiveLinkCheckPath(config: DingtalkRuntimeConfig): string {
  return path.join(config.repoRoot, "data", "dingtalk-briefs", `${config.date}.archive_link_check.json`);
}

export function sourceReportPath(config: DingtalkRuntimeConfig): string {
  return path.join(config.repoRoot, "data", "dingtalk-briefs", `${config.date}.source_report.json`);
}

export function distDingtalkDir(config: DingtalkRuntimeConfig): string {
  return path.join(config.repoRoot, "dist", "dingtalk");
}
