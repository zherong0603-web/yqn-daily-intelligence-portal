import { afterEach, describe, expect, it, vi } from "vitest";
import { feishuCard, sendFeishu, signedFields } from "./sendFeishu.js";

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

  it("sends only entry buttons on a successful daily brief card", () => {
    vi.stubEnv("BRIEF_DATE", "2026-07-01");
    vi.stubEnv("BRIEF_ONE_LINER", "今日一句话判断");
    vi.stubEnv("BRIEF_PREVIEW", "重点一\n重点二\n重点三\n重点四");

    const card = feishuCard("success") as {
      card: { header: { title: { content: string } }; elements: Array<{ actions?: Array<{ text: { content: string } }> }> };
    };
    const actionTexts = card.card.elements.flatMap((element) => element.actions || []).map((action) => action.text.content);

    expect(card.card.header.title.content).toBe("YQN 每日重点简报 · 2026-07-01");
    expect(actionTexts).toEqual(["查看今日简报", "查看历史简报"]);
    expect(JSON.stringify(card)).not.toContain("重点四");
  });
});
