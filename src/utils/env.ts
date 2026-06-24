export interface OptionalIntegrations {
  tavilyConfigured: boolean;
  serperConfigured: boolean;
  openAiWebSearchEnabled: boolean;
  maxSearchCalls: number;
}

export function readEnv(name: string): string | undefined {
  const value = process.env[name];
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > 0 ? trimmed : undefined;
}

export function readBooleanEnv(name: string, defaultValue = false): boolean {
  const value = readEnv(name);
  if (!value) return defaultValue;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export function readOptionalIntegrations(): OptionalIntegrations {
  const maxSearchCalls = Number.parseInt(readEnv("MAX_SEARCH_CALLS") || "0", 10);
  return {
    tavilyConfigured: Boolean(readEnv("TAVILY_API_KEY")),
    serperConfigured: Boolean(readEnv("SERPER_API_KEY")),
    openAiWebSearchEnabled: readBooleanEnv("OPENAI_WEB_SEARCH_ENABLED", false),
    maxSearchCalls: Number.isFinite(maxSearchCalls) && maxSearchCalls > 0 ? maxSearchCalls : 0,
  };
}
