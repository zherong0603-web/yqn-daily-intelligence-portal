import { afterEach, describe, expect, it, vi } from "vitest";
import { sendFeishu, signedFields } from "./sendFeishu.js";

describe("Feishu notification", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("skips notification without webhook instead of failing deployment", async () => {
    vi.stubEnv("FEISHU_WEBHOOK_URL", "");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetchMock = vi.fn();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as typeof fetch;

    await sendFeishu("success");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("[feishu] FEISHU_WEBHOOK_URL is not configured; notification skipped");
    globalThis.fetch = originalFetch;
  });

  it("creates Feishu signing fields only when a sign secret exists", () => {
    expect(signedFields()).toEqual({});
    const signed = signedFields("value-c");
    expect(signed.timestamp).toMatch(/^\d+$/);
    expect(signed.sign).toBeTruthy();
    expect(signed.sign).not.toContain("value-c");
  });
});
