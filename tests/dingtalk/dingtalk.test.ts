import { describe, expect, it } from "vitest";
import { buildSampleBrief } from "../../src/dingtalk/sampleBrief.js";
import { checkDingtalkBriefRisk } from "../../src/dingtalk/riskCheck.js";
import { countMessageCharacters, renderDingtalkMarkdown } from "../../src/dingtalk/renderMarkdown.js";
import { DingtalkSourceConfig, validateDingtalkBrief } from "../../src/dingtalk/schema.js";
import { signDingTalkUrl } from "../../src/dingtalk/utils/signDingTalk.js";
import { decideWatchdog } from "../../src/dingtalk/watchdog.js";

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
    expect(markdown).toContain("## 今日判断｜");
    expect(markdown.match(/^## \d+\./gm)).toHaveLength(5);
    expect(markdown).toContain("https://example.com/yqn/dingtalk/2026-07-08.html");
    expect(markdown).not.toContain("是否敏感");
    expect(markdown).not.toContain("置信度：");
    expect(markdown).not.toContain("[查看来源]");
    expect(countMessageCharacters(markdown)).toBeLessThanOrEqual(2200);
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
});
