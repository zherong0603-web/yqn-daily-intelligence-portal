import { describe, expect, it, vi } from "vitest";
import { readRuntimeConfig } from "./config.js";

describe("runtime config", () => {
  it("reads secrets from environment without requiring chat-provided values", () => {
    vi.stubEnv("OPENAI_API_KEY", "  value-a  ");
    vi.stubEnv("PAGE_ACCESS_PASSPHRASE", "  value-b  ");
    vi.stubEnv("BRIEF_ENCRYPTION_ENABLED", "true");
    vi.stubEnv("TAVILY_API_KEY", "");
    vi.stubEnv("SERPER_API_KEY", "");
    vi.stubEnv("OPENAI_WEB_SEARCH_ENABLED", "false");
    vi.stubEnv("MAX_SEARCH_CALLS", "5");

    const config = readRuntimeConfig();

    expect(config.openAiApiKey).toBe("value-a");
    expect(config.pageAccessPassphrase).toBe("value-b");
    expect(config.encryptionEnabled).toBe(true);
    expect(config.optionalIntegrations).toEqual({
      tavilyConfigured: false,
      serperConfigured: false,
      openAiWebSearchEnabled: false,
      maxSearchCalls: 5,
    });

    vi.unstubAllEnvs();
  });
});
