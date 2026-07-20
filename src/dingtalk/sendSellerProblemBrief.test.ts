import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertGithubFormalContext,
  assertFormalSendDate,
  dateInShanghai,
  formalAttemptMarker,
  postMarkdown,
  priorSendStateInGithub,
  resolveTargetLabel,
  successMarker,
} from "./sendSellerProblemBrief.js";

describe("seller problem brief delivery guardrails", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_REPOSITORY;
    delete process.env.GITHUB_RUN_ID;
    delete process.env.GITHUB_OUTPUT;
    delete process.env.SELLER_BRIEF_TARGET_LABEL;
  });

  it("uses the Asia/Shanghai date for formal sends", () => {
    const now = new Date("2026-07-19T16:30:00Z");

    expect(dateInShanghai(now)).toBe("2026-07-20");
    expect(() => assertFormalSendDate("2026-07-20", now)).not.toThrow();
    expect(() => assertFormalSendDate("2026-07-19", now)).toThrow(/must be today/);
    delete process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_REPOSITORY;
    delete process.env.GITHUB_RUN_ID;
    expect(() => assertGithubFormalContext()).toThrow(/must run in GitHub Actions/);
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

  it("recognizes only the exact prior successful-send marker as a duplicate", async () => {
    process.env.GITHUB_TOKEN = "test-token";
    process.env.GITHUB_REPOSITORY = "owner/repo";
    process.env.GITHUB_RUN_ID = "200";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        workflow_runs: [
          { id: 200, status: "in_progress", conclusion: null, created_at: "2026-07-20T00:00:00Z" },
          { id: 199, status: "completed", conclusion: "success", created_at: "2026-07-20T00:00:00Z" },
        ],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ jobs: [{ id: 99 }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(
        "[seller-brief:send] date=2026-07-20 yqn-livestream-group markdown message sent",
        { status: 200 },
      ));
    vi.stubGlobal("fetch", fetchMock);

    await expect(priorSendStateInGithub("2026-07-20", "yqn-livestream-group")).resolves.toBe("sent");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[0]![0])).toContain("per_page=100");
  });

  it("blocks an automatic retry after an unconfirmed prior webhook attempt", async () => {
    process.env.GITHUB_TOKEN = "test-token";
    process.env.GITHUB_REPOSITORY = "owner/repo";
    process.env.GITHUB_RUN_ID = "300";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        workflow_runs: [
          { id: 300, status: "in_progress", conclusion: null, created_at: "2026-07-20T00:00:00Z" },
          { id: 299, status: "completed", conclusion: "failure", created_at: "2026-07-20T00:00:00Z" },
        ],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ jobs: [{ id: 199 }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(
        "[seller-brief:attempt] date=2026-07-20 yqn-livestream-group formal webhook attempt authorized",
        { status: 200 },
      ));
    vi.stubGlobal("fetch", fetchMock);

    await expect(priorSendStateInGithub("2026-07-20", "yqn-livestream-group")).resolves.toBe("ambiguous");
  });

  it("keeps duplicate protection independent for each DingTalk group", async () => {
    process.env.GITHUB_TOKEN = "test-token";
    process.env.GITHUB_REPOSITORY = "owner/repo";
    process.env.GITHUB_RUN_ID = "400";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        workflow_runs: [
          { id: 400, status: "in_progress", conclusion: null, created_at: "2026-07-20T00:00:00Z" },
          { id: 399, status: "completed", conclusion: "success", created_at: "2026-07-20T00:00:00Z" },
        ],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ jobs: [{ id: 299 }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(
        successMarker("2026-07-20", "yqn-livestream-group"),
        { status: 200 },
      ));
    vi.stubGlobal("fetch", fetchMock);

    await expect(priorSendStateInGithub("2026-07-20", "ryan-internal-group")).resolves.toBe("none");
  });

  it("does not download job logs outside the requested Shanghai date", async () => {
    process.env.GITHUB_TOKEN = "test-token";
    process.env.GITHUB_REPOSITORY = "owner/repo";
    process.env.GITHUB_RUN_ID = "500";
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      workflow_runs: [
        { id: 500, status: "in_progress", conclusion: null, created_at: "2026-07-20T00:00:00Z" },
        { id: 499, status: "completed", conclusion: "success", created_at: "2026-07-19T15:59:59Z" },
      ],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(priorSendStateInGithub("2026-07-20", "ryan-internal-group")).resolves.toBe("none");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("accepts only safe log labels for configured delivery targets", () => {
    process.env.SELLER_BRIEF_TARGET_LABEL = "ryan-internal-group";
    expect(resolveTargetLabel()).toBe("ryan-internal-group");
    process.env.SELLER_BRIEF_TARGET_LABEL = "unsafe label";
    expect(() => resolveTargetLabel()).toThrow(/lowercase letters/);
  });

  it("keeps the durable workflow marker synchronized with duplicate detection", () => {
    const workflow = readFileSync(
      new URL("../../.github/workflows/dingtalk-seller-problem-send.yml", import.meta.url),
      "utf8",
    );

    expect(formalAttemptMarker("${BRIEF_DATE}")).toBe(
      "[seller-brief:attempt] date=${BRIEF_DATE} yqn-livestream-group formal webhook attempt authorized",
    );
    expect(workflow).toContain(formalAttemptMarker("${BRIEF_DATE}"));
    expect(workflow).toContain(formalAttemptMarker("${BRIEF_DATE}", "ryan-internal-group"));
    expect(workflow).toContain("needs: validate-brief");
  });
});
