import { describe, expect, it } from "vitest";
import { RuntimeConfig } from "./config.js";
import { buildBriefFromCandidates } from "./generateBrief.js";
import { CollectedSource } from "./schema.js";

function configWithoutOpenAi(): RuntimeConfig {
  return {
    repoRoot: process.cwd(),
    date: "2026-06-24",
    timeZone: "Asia/Taipei",
    openAiModel: "model-from-variable",
    encryptionEnabled: false,
    siteUrl: "https://example.com",
    runId: "test-run",
    optionalIntegrations: {
      tavilyConfigured: false,
      serperConfigured: false,
      openAiWebSearchEnabled: false,
      maxSearchCalls: 0,
    },
  };
}

function candidate(index: number): CollectedSource {
  return {
    topic: index % 2 === 0 ? "ai" : "ecommerce_us_warehouse",
    source_name: `Source ${index}`,
    source_type: "rss",
    source_weight: 8,
    title: `Public source title ${index}`,
    url: `https://example.com/source-${index}`,
    domain: "example.com",
    published_at: "2026-06-24T00:00:00.000Z",
    summary: `Public source summary ${index}`,
  };
}

describe("brief generation fallback", () => {
  it("publishes an honest low-signal configuration brief when OPENAI_API_KEY is absent", async () => {
    const brief = await buildBriefFromCandidates(
      configWithoutOpenAi(),
      [candidate(1), candidate(2), candidate(3)],
      72,
    );

    expect(brief.is_low_signal_day).toBe(true);
    expect(brief.model).toBe("model-from-variable-api-key-missing");
    expect(brief.items).toHaveLength(0);
    expect(brief.sources).toHaveLength(3);
    expect(brief.one_liner).toContain("OpenAI API");
    expect(brief.action_checklist.join("\n")).toContain("OPENAI_API_KEY");
  });

  it("fails normal generation with a clear setup error when OPENAI_MODEL is absent", async () => {
    const config = { ...configWithoutOpenAi(), openAiModel: undefined };
    await expect(buildBriefFromCandidates(
      config,
      [candidate(1), candidate(2), candidate(3)],
      72,
    )).rejects.toThrow("SETUP_ERROR: OPENAI_MODEL");
  });
});
