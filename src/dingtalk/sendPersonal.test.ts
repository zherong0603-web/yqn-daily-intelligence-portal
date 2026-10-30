import { afterEach, describe, expect, it, vi } from "vitest";
import {
  crossborderV2AttemptMarker,
  crossborderV2SuccessPrefix,
  getDingTalkAccessToken,
  priorSendStateInGithub,
  sendDingTalkPersonalMarkdown,
  verifyDingTalkPersonalDelivery,
} from "./sendSellerProblemBrief.js";

describe("DingTalk private-chat delivery", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("obtains a token, sends one private markdown message, and verifies delivery status", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ accessToken: "token-1", expireIn: 7200 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ processQueryKey: "query-1", invalidStaffIdList: [], flowControlledStaffIdList: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        sendStatus: "SUCCESS",
        messageReadInfoList: [{ userId: "user-1", readStatus: "UNREAD" }],
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const token = await getDingTalkAccessToken("app-key", "app-secret");
    const processQueryKey = await sendDingTalkPersonalMarkdown({
      accessToken: token,
      robotCode: "robot-1",
      userId: "user-1",
      title: "跨境早知道",
      markdown: "测试消息",
    });
    const delivery = await verifyDingTalkPersonalDelivery({
      accessToken: token,
      robotCode: "robot-1",
      userId: "user-1",
      processQueryKey,
      attempts: 1,
      sleep: async () => {},
    });

    expect(token).toBe("token-1");
    expect(processQueryKey).toBe("query-1");
    expect(delivery).toEqual({ sendStatus: "SUCCESS", readStatus: "UNREAD" });
    expect(String(fetchMock.mock.calls[1]![0])).toContain("/v1.0/robot/oToMessages/batchSend");
    expect(String(fetchMock.mock.calls[2]![0])).toContain("/v1.0/robot/oToMessages/readStatus");
  });

  it("fails when the read-status API never confirms the recipient", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ sendStatus: "UNKNOWN", messageReadInfoList: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ sendStatus: "UNKNOWN", messageReadInfoList: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(verifyDingTalkPersonalDelivery({
      accessToken: "token-1",
      robotCode: "robot-1",
      userId: "user-1",
      processQueryKey: "query-1",
      attempts: 2,
      sleep: async () => {},
    })).rejects.toThrow(/delivery unconfirmed/);
  });

  it("recognizes the private-chat success prefix from workflow logs as a duplicate", async () => {
    process.env.GITHUB_TOKEN = "test-token";
    process.env.GITHUB_REPOSITORY = "owner/repo";
    process.env.GITHUB_RUN_ID = "600";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        workflow_runs: [
          { id: 600, status: "in_progress", conclusion: null, created_at: "2026-10-30T08:00:00Z" },
          { id: 599, status: "completed", conclusion: "success", created_at: "2026-10-30T08:00:00Z" },
        ],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ jobs: [{ id: 99 }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(
        `${crossborderV2SuccessPrefix("2026-10-30")} sendStatus=SUCCESS readStatus=UNREAD`,
        { status: 200 },
      ));
    vi.stubGlobal("fetch", fetchMock);

    await expect(priorSendStateInGithub(
      "2026-10-30",
      "dingtalk-private",
      "dingtalk-crossborder-v2-send.yml",
      crossborderV2SuccessPrefix,
      crossborderV2AttemptMarker,
    )).resolves.toBe("sent");

    delete process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_REPOSITORY;
    delete process.env.GITHUB_RUN_ID;
  });
});
