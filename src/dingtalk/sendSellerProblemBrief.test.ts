import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertFormalSendDate,
  dateInShanghai,
  postMarkdown,
} from "./sendSellerProblemBrief.js";

describe("seller problem brief delivery guardrails", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the Asia/Shanghai date for formal sends", () => {
    const now = new Date("2026-07-19T16:30:00Z");

    expect(dateInShanghai(now)).toBe("2026-07-20");
    expect(() => assertFormalSendDate("2026-07-20", now)).not.toThrow();
    expect(() => assertFormalSendDate("2026-07-19", now)).toThrow(/must be today/);
  });

  it("requires an explicit DingTalk errcode=0 acknowledgement", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ errcode: 0, errmsg: "ok" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ errmsg: "ok" }), { status: 200 }))
      .mockResolvedValueOnce(new Response("not-json", { status: 200 }))
      .mockResolvedValueOnce(new Response("upstream error", { status: 502 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(postMarkdown("https://oapi.dingtalk.com/robot/send?access_token=test", undefined, "title", "message"))
      .resolves.toBeUndefined();
    await expect(postMarkdown("https://oapi.dingtalk.com/robot/send?access_token=test", undefined, "title", "message"))
      .rejects.toThrow(/errcode missing/);
    await expect(postMarkdown("https://oapi.dingtalk.com/robot/send?access_token=test", undefined, "title", "message"))
      .rejects.toThrow(/invalid acknowledgement/);
    await expect(postMarkdown("https://oapi.dingtalk.com/robot/send?access_token=test", undefined, "title", "message"))
      .rejects.toThrow(/HTTP 502/);
  });

  it("blocks oversized markdown before touching the webhook", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(postMarkdown(
      "https://oapi.dingtalk.com/robot/send?access_token=test",
      undefined,
      "title",
      "中".repeat(6_001),
    )).rejects.toThrow(/markdown payload/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
