import { describe, expect, it } from "vitest";
import { buildSampleBrief } from "../../src/dingtalk/sampleBrief.js";
import { checkDingtalkBriefRisk } from "../../src/dingtalk/riskCheck.js";
import { renderDingtalkMarkdown } from "../../src/dingtalk/renderMarkdown.js";
import { DingtalkSourceConfig, validateDingtalkBrief } from "../../src/dingtalk/schema.js";
import { signDingTalkUrl } from "../../src/dingtalk/utils/signDingTalk.js";

const sources: DingtalkSourceConfig[] = [
  {
    category: "policy",
    title: "CBP E-Commerce",
    url: "https://www.cbp.gov/trade/basic-import-export/e-commerce",
    source_type: "official",
    auto_fetch: false,
    enabled: true,
  },
  {
    category: "platform",
    title: "TikTok Shop Seller Center University",
    url: "https://seller-us.tiktok.com/university",
    source_type: "official",
    auto_fetch: false,
    enabled: true,
  },
  {
    category: "fulfillment",
    title: "UPS Service Alerts",
    url: "https://www.ups.com/us/en/service-alerts",
    source_type: "official",
    auto_fetch: false,
    enabled: true,
  },
  {
    category: "growth",
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

describe("DingTalk morning brief V1", () => {
  it("builds a valid 1+4+3 demo brief", () => {
    const brief = buildSampleBrief("2026-07-08", sources);
    expect(() => validateDingtalkBrief(brief)).not.toThrow();
    expect(brief.one_liner.length).toBeLessThanOrEqual(30);
    expect(brief.signals).toHaveLength(4);
    expect(brief.action_list).toHaveLength(3);
    expect(brief.signals.every((signal) => signal.source_url.startsWith("https://"))).toBe(true);
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
    const markdown = renderDingtalkMarkdown(brief, "https://example.com/yqn");
    expect(markdown).toContain("YQN 北美履约增长晨报");
    expect(markdown).toContain("今日 3 个动作");
    expect(markdown).toContain("[查看来源]");
    expect(markdown).toContain("https://example.com/yqn/dingtalk/2026-07-08.html");
  });

  it("adds DingTalk timestamp and sign without exposing the secret", () => {
    const signed = signDingTalkUrl("https://oapi.dingtalk.com/robot/send?access_token=value", "secret-value", 1_788_000_000_000);
    expect(signed).toContain("timestamp=1788000000000");
    expect(signed).toContain("sign=");
    expect(signed).not.toContain("secret-value");
  });
});
