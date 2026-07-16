import { describe, expect, it } from "vitest";
import { buildSampleBrief } from "../../src/dingtalk/sampleBrief.js";
import { checkDingtalkBriefRisk } from "../../src/dingtalk/riskCheck.js";
import { countMessageCharacters, renderDingtalkMarkdown } from "../../src/dingtalk/renderMarkdown.js";
import { DingtalkSourceConfig, validateDingtalkBrief } from "../../src/dingtalk/schema.js";
import { signDingTalkUrl } from "../../src/dingtalk/utils/signDingTalk.js";
import { hasForbiddenDisplayMarker } from "../../src/dingtalk/validateBeforeSend.js";
import { decideWatchdog } from "../../src/dingtalk/watchdog.js";
import { priorCompletedRunCandidates, priorSuccessfulRunCandidates } from "../../src/dingtalk/sendDingTalk.js";
import { deliveryTargets } from "../../src/dingtalk/sendDingTalk.js";
import { selectBalancedBusinessCandidates } from "../../src/dingtalk/generateBrief.js";
import { calculateValueScore } from "../../src/dingtalk/webResearch.js";
import { DingtalkNewsCandidate } from "../../src/dingtalk/collectRealSignals.js";
import { DingtalkRuntimeConfig } from "../../src/dingtalk/config.js";

const sources: DingtalkSourceConfig[] = [
  {
    category: "overseas_policy",
    title: "CBP E-Commerce",
    url: "https://www.cbp.gov/trade/basic-import-export/e-commerce",
    source_type: "official",
    auto_fetch: false,
    enabled: true,
  },
  {
    category: "platform_seller",
    title: "TikTok Shop Seller Center University",
    url: "https://seller-us.tiktok.com/university",
    source_type: "official",
    auto_fetch: false,
    enabled: true,
  },
  {
    category: "competitor_fulfillment",
    title: "UPS Service Alerts",
    url: "https://www.ups.com/us/en/service-alerts",
    source_type: "official",
    auto_fetch: false,
    enabled: true,
  },
  {
    category: "domestic_crossborder",
    title: "小红书聚光帮助中心",
    url: "https://ad.xiaohongshu.com/help/home",
    source_type: "official",
    auto_fetch: false,
    enabled: true,
  },
  {
    category: "yqn_public",
    title: "运去哪海外仓公开页",
    url: "https://www.yqn.com/cn/warehousing/home",
    source_type: "public_yqn",
    auto_fetch: false,
    enabled: true,
  },
];

function candidate(id: string, marketFocus: DingtalkNewsCandidate["market_focus"], valueScore = 80): DingtalkNewsCandidate {
  return {
    title: `${marketFocus} official change ${id}`,
    url: `https://example.gov/${marketFocus}/${id}`,
    domain: "example.gov",
    summary: "Official customs warehouse delivery cost and compliance change affecting ecommerce sellers.",
    source_name: "Official Authority",
    source_home_url: "https://example.gov",
    source_category: "overseas_policy",
    source_type: "official",
    source_published_at: "2026-07-16",
    published_at_iso: "2026-07-16T00:00:00.000Z",
    effective_at: "2026-07-20",
    affected_sellers: "大中小件跨境电商卖家",
    impact_stages: ["first_mile", "warehousing", "last_mile"],
    seller_check: "检查申报、库存和配送方案是否需要调整。",
    collected_at: "2026-07-16T01:00:00.000Z",
    market_focus: marketFocus,
    score: valueScore,
    value_score: valueScore,
    account_opening_score: valueScore,
    score_reasons: ["official"],
    business_value_reasons: ["merchant impact"],
  };
}

describe("DingTalk YQN Daily 5 Minutes V1.2", () => {
  it("builds a valid 1+5 demo brief", () => {
    const brief = buildSampleBrief("2026-07-08", sources);
    expect(() => validateDingtalkBrief(brief)).not.toThrow();
    expect(brief.one_liner.length).toBeLessThanOrEqual(30);
    expect(brief.signals).toHaveLength(5);
    expect(brief.signals.map((signal) => signal.category)).toEqual([
      "market",
      "platform",
      "customer",
      "fulfillment",
      "yqn_view",
    ]);
    expect(brief.signals.every((signal) => signal.source_url.startsWith("https://"))).toBe(true);
    expect(brief.signals.every((signal) => signal.is_test_data)).toBe(true);
    expect(brief.signals.map((signal) => signal.market_focus)).toEqual([
      "us_warehouse",
      "us_warehouse",
      "mexico_warehouse",
      "mexico_warehouse",
      "us_mexico_bridge",
    ]);
  });

  it("blocks forbidden content before sending", () => {
    const brief = buildSampleBrief("2026-07-08", sources);
    brief.signals[0].what_happened = "这里出现报价信息，应阻断。";
    const result = checkDingtalkBriefRisk(brief);
    expect(result.ok).toBe(false);
    expect(result.flags).toContain("forbidden_content");
  });

  it("renders Markdown with source links and archive link", () => {
    const brief = buildSampleBrief("2026-07-08", sources);
    const markdown = renderDingtalkMarkdown(brief, { publicBaseUrl: "https://example.com/yqn", archiveAvailable: true });
    expect(markdown).toContain("【测试版】YQN 跨境电商 5 分钟晨报");
    expect(markdown).not.toContain("今日 3 个动作");
    expect(markdown).not.toContain("今天动作");
    expect(markdown).toContain("完整归档：[打开网页看完整版]");
    expect(markdown).toContain("- 来源：");
    expect(markdown).toContain("- 生效：");
    expect(markdown).toContain("- 卖家检查：");
    expect(markdown).toContain("## 今日判断｜");
    expect(markdown.match(/^## \d+\./gm)).toHaveLength(5);
    expect(markdown).toContain("https://example.com/yqn/dingtalk/2026-07-08.html");
    expect(markdown).not.toContain("是否敏感");
    expect(markdown).not.toContain("置信度：");
    expect(markdown).not.toContain("[查看来源]");
    expect(countMessageCharacters(markdown)).toBeLessThanOrEqual(2200);
  });

  it("allows public percentage figures while blocking forbidden debug fields", () => {
    expect(hasForbiddenDisplayMarker("平台费率公开调整 5%，卖家需要关注履约成本变化。")).toBe(false);
    expect(hasForbiddenDisplayMarker("是否敏感：否")).toBe(true);
    expect(hasForbiddenDisplayMarker("置信度：82%")).toBe(true);
    expect(hasForbiddenDisplayMarker("今日 3 个动作")).toBe(true);
  });

  it("adds DingTalk timestamp and sign without exposing the secret", () => {
    const signed = signDingTalkUrl("https://oapi.dingtalk.com/robot/send?access_token=value", "secret-value", 1_788_000_000_000);
    expect(signed).toContain("timestamp=1788000000000");
    expect(signed).toContain("sign=");
    expect(signed).not.toContain("secret-value");
  });

  it("dispatches fallback when the 08:45 sender is missing", () => {
    const decision = decideWatchdog([], "2026-07-09", new Date("2026-07-09T01:05:00.000Z"));
    expect(decision.shouldDispatch).toBe(true);
    expect(decision.reason).toContain("未发现");
  });

  it("does not dispatch fallback when a post-08:45 run is active or successful", () => {
    const active = decideWatchdog([
      {
        id: 1,
        event: "schedule",
        status: "in_progress",
        conclusion: null,
        created_at: "2026-07-09T00:50:00.000Z",
        html_url: "https://github.com/example/actions/runs/1",
      },
    ], "2026-07-09", new Date("2026-07-09T01:05:00.000Z"));
    expect(active.shouldDispatch).toBe(false);

    const successful = decideWatchdog([
      {
        id: 2,
        event: "schedule",
        status: "completed",
        conclusion: "success",
        created_at: "2026-07-09T00:46:00.000Z",
        html_url: "https://github.com/example/actions/runs/2",
      },
    ], "2026-07-09", new Date("2026-07-09T01:05:00.000Z"));
    expect(successful.shouldDispatch).toBe(false);
  });

  it("does not dispatch duplicate fallback after a manual补发 has succeeded", () => {
    const decision = decideWatchdog([
      {
        id: 3,
        event: "workflow_dispatch",
        status: "completed",
        conclusion: "success",
        created_at: "2026-07-09T01:12:00.000Z",
        html_url: "https://github.com/example/actions/runs/3",
      },
    ], "2026-07-09", new Date("2026-07-09T01:35:00.000Z"));
    expect(decision.shouldDispatch).toBe(false);
  });

  it("skips duplicate DingTalk sends when today's formal send already succeeded", () => {
    const candidates = priorSuccessfulRunCandidates([
      {
        id: 10,
        status: "completed",
        conclusion: "success",
        created_at: "2026-07-13T03:14:32.000Z",
        html_url: "https://github.com/example/actions/runs/10",
      },
      {
        id: 11,
        status: "completed",
        conclusion: "success",
        created_at: "2026-07-13T04:20:56.000Z",
        html_url: "https://github.com/example/actions/runs/11",
      },
      {
        id: 12,
        status: "completed",
        conclusion: "failure",
        created_at: "2026-07-13T01:05:00.000Z",
        html_url: "https://github.com/example/actions/runs/12",
      },
      {
        id: 13,
        status: "completed",
        conclusion: "success",
        created_at: "2026-07-12T22:00:00.000Z",
        html_url: "https://github.com/example/actions/runs/13",
      },
    ], "2026-07-13", "11");

    expect(candidates.map((run) => run.id)).toEqual([10]);
  });

  it("keeps per-target duplicate markers from a partially failed multi-group run", () => {
    const candidates = priorCompletedRunCandidates([
      {
        id: 21,
        status: "completed",
        conclusion: "failure",
        created_at: "2026-07-13T01:02:00.000Z",
        html_url: "https://github.com/example/actions/runs/21",
      },
    ], "2026-07-13", "22");

    expect(candidates.map((run) => run.id)).toEqual([21]);
  });

  it("selects exactly 2 US, 2 Mexico and 1 bridge signal without unrelated filler", () => {
    const selected = selectBalancedBusinessCandidates([
      candidate("us-1", "us_warehouse", 92),
      candidate("us-2", "us_warehouse", 88),
      candidate("mx-1", "mexico_warehouse", 91),
      candidate("mx-2", "mexico_warehouse", 85),
      candidate("bridge-1", "us_mexico_bridge", 89),
      { ...candidate("russia", "global", 99), title: "俄罗斯电商物流变化" },
    ]);
    expect(selected.map((item) => item.market_focus)).toEqual([
      "us_warehouse",
      "us_warehouse",
      "mexico_warehouse",
      "mexico_warehouse",
      "us_mexico_bridge",
    ]);
  });

  it("blocks generation when one side cannot meet the core signal quota", () => {
    expect(() => selectBalancedBusinessCandidates([
      candidate("us-1", "us_warehouse"),
      candidate("us-2", "us_warehouse"),
      candidate("mx-1", "mexico_warehouse"),
      candidate("bridge-1", "us_mexico_bridge"),
    ])).toThrow(/mexico_warehouse requires 2/);
  });

  it("does not admit an official policy without an explicit effective date", () => {
    expect(() => selectBalancedBusinessCandidates([
      candidate("us-1", "us_warehouse"),
      candidate("us-2", "us_warehouse"),
      candidate("mx-1", "mexico_warehouse"),
      { ...candidate("mx-undated", "mexico_warehouse"), effective_at: "未公布" },
      candidate("bridge-1", "us_mexico_bridge"),
    ])).toThrow(/mexico_warehouse requires 2/);
  });

  it("scores a recent official compliance change above the group threshold", () => {
    const score = calculateValueScore({
      title: "Mandatory customs eFiling takes effect",
      summary: "Importer compliance certificates affect customs cost, delays and warehouse inventory.",
      affectedSellers: "美国站大中小件进口商和跨境电商卖家",
      impactStages: ["first_mile", "warehousing"],
      publishedAt: new Date("2026-07-16T00:00:00.000Z"),
      effectiveAt: "2026-07-16",
      official: true,
      now: new Date("2026-07-16T02:00:00.000Z"),
    });
    expect(score).toBeGreaterThanOrEqual(70);
  });

  it("keeps the formal group and YQN livestream group as separate delivery targets", () => {
    const config = {
      formalGroupEnabled: true,
      formalWebhookUrl: "https://oapi.dingtalk.com/robot/send?access_token=formal",
      livestreamGroupEnabled: true,
      livestreamWebhookUrl: "https://oapi.dingtalk.com/robot/send?access_token=live",
    } as DingtalkRuntimeConfig;
    expect(deliveryTargets(config).map((target) => target.label)).toEqual(["formal-group", "yqn-livestream-group"]);
  });
});
