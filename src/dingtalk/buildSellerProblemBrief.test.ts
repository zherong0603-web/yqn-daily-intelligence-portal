import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  renderSellerProblemMarkdown,
  validateSellerProblemBrief,
} from "./buildSellerProblemBrief.js";

const sourceFixture = JSON.parse(
  readFileSync(new URL("../../data/codex-shadow/2026-07-16.seller-problem.json", import.meta.url), "utf8"),
) as Record<string, unknown>;

function validFixture(): Record<string, unknown> {
  const fixture = structuredClone(sourceFixture) as {
    date: string;
    title: string;
    generated_at: string;
    publication: { proposed_send_at: string };
    signals: Array<{
      market_focus: string;
      evidence: unknown[];
    }>;
  };
  fixture.date = "2026-07-16";
  fixture.title = "7月16日北美卖家问题晨报";
  fixture.generated_at = "2026-07-16T00:10:00Z";
  fixture.publication.proposed_send_at = "2026-07-16T08:45:00+08:00";
  fixture.signals.forEach((signal, index) => {
    const bridge = signal.market_focus === "us_mexico_bridge";
    signal.evidence = [
      {
        title: bridge ? "墨西哥卖家讨论发往美国的补货问题" : `卖家经营问题 ${index + 1}`,
        url: `https://seller.example.com/problem-${index + 1}`,
        source_type: "seller_forum",
        published_at: "2026-07-15",
        effective_at: null,
        checked_at: "2026-07-16T08:10:00+08:00",
        roles: ["seller_signal"],
        supports: bridge ? "墨西哥卖家讨论货物发往美国时的实际物流衔接问题。" : "卖家在最近七天公开讨论这一经营问题。",
      },
      {
        title: bridge ? "美国官方说明墨西哥至美国货物规则" : `官方事实依据 ${index + 1}`,
        url: `https://official.example.com/fact-${index + 1}`,
        source_type: "official",
        published_at: "2026-07-10",
        effective_at: null,
        checked_at: "2026-07-16T08:12:00+08:00",
        roles: ["fact_basis"],
        supports: bridge ? "官方页面明确说明墨西哥货物进入美国时适用的条件。" : "官方页面确认规则、费用或适用条件。",
      },
    ];
  });
  return fixture;
}

describe("seller problem brief guardrails", () => {
  it("accepts the reviewed 2+2+1 sample but never permits sending", () => {
    const fixture = validFixture();
    const { brief, report } = validateSellerProblemBrief(fixture, "2026-07-16T12:30:00+08:00");

    expect(report.content_valid).toBe(true);
    expect(report.send_allowed).toBe(false);
    expect(report.counts).toEqual({ us_warehouse: 2, mexico_warehouse: 2, us_mexico_bridge: 1 });
    expect(renderSellerProblemMarkdown(brief!, { publication: "production" })).not.toContain("待验收");
    expect(renderSellerProblemMarkdown(brief!, { publication: "production" })).toContain("工作日 08:45 更新");
  });

  it("blocks a signal that loses its fact basis", () => {
    const fixture = validFixture();
    const invalid = structuredClone(fixture) as { signals: Array<{ evidence: Array<{ roles: string[] }> }> };
    invalid.signals[0]!.evidence = invalid.signals[0]!.evidence.slice(0, 1);
    invalid.signals[0]!.evidence[0]!.roles = ["seller_signal"];

    const { report } = validateSellerProblemBrief(invalid, "2026-07-16T12:30:00+08:00");

    expect(report.content_valid).toBe(false);
    expect(report.automated_blockers).toContain("signal:0:missing_fact_basis");
    expect(report.send_allowed).toBe(false);
  });

  it("blocks a report with the wrong market ratio", () => {
    const fixture = validFixture();
    const invalid = structuredClone(fixture) as { signals: Array<{ market_focus: string }> };
    invalid.signals[4]!.market_focus = "us_warehouse";

    const { report } = validateSellerProblemBrief(invalid, "2026-07-16T12:30:00+08:00");

    expect(report.content_valid).toBe(false);
    expect(report.automated_blockers).toContain("ratio:us_warehouse:3");
    expect(report.automated_blockers).toContain("ratio:us_mexico_bridge:0");
    expect(report.send_allowed).toBe(false);
  });

  it("blocks one source from impersonating both evidence roles", () => {
    const invalid = validFixture() as { signals: Array<{ evidence: Array<{ roles: string[] }> }> };
    invalid.signals[0]!.evidence[0]!.roles = ["seller_signal", "fact_basis"];
    invalid.signals[0]!.evidence.splice(1, 1);

    const { report } = validateSellerProblemBrief(invalid, "2026-07-16T12:30:00+08:00");

    expect(report.content_valid).toBe(false);
    expect(report.automated_blockers).toContain("signal:0:evidence:0:roles_must_be_separate");
  });

  it("blocks stale, future, and undated seller signals", () => {
    const stale = validFixture() as { signals: Array<{ evidence: Array<{ published_at: string | null }> }> };
    stale.signals[0]!.evidence[0]!.published_at = "2026-07-08";
    stale.signals[1]!.evidence[0]!.published_at = "2026-07-17";
    stale.signals[2]!.evidence[0]!.published_at = null;

    const { report } = validateSellerProblemBrief(stale, "2026-07-16T12:30:00+08:00");

    expect(report.automated_blockers).toContain("signal:0:evidence:0:seller_signal_older_than_7_days");
    expect(report.automated_blockers).toContain("signal:1:evidence:0:seller_signal_from_future");
    expect(report.automated_blockers).toContain("signal:2:evidence:0:seller_signal_missing_date");
  });

  it("blocks copied drafts whose generation, check, or send dates do not match", () => {
    const copied = validFixture() as {
      generated_at: string;
      publication: { proposed_send_at: string };
      signals: Array<{ evidence: Array<{ checked_at: string }> }>;
    };
    copied.generated_at = "2026-07-15T00:10:00Z";
    copied.publication.proposed_send_at = "2026-07-17T08:45:00+08:00";
    copied.signals[0]!.evidence[0]!.checked_at = "2026-07-15T08:10:00+08:00";

    const { report } = validateSellerProblemBrief(copied, "2026-07-16T12:30:00+08:00");

    expect(report.automated_blockers).toContain("brief:generated_at_date_mismatch");
    expect(report.automated_blockers).toContain("brief:proposed_send_at_mismatch");
    expect(report.automated_blockers).toContain("signal:0:evidence:0:checked_at_date_mismatch");
  });

  it("blocks duplicate sources and a bridge claim without US-Mexico evidence", () => {
    const invalid = validFixture() as {
      signals: Array<{ market_focus: string; evidence: Array<{ title: string; url: string; supports: string }> }>;
    };
    invalid.signals[1]!.evidence[0]!.url = invalid.signals[0]!.evidence[0]!.url;
    const bridge = invalid.signals.find((signal) => signal.market_focus === "us_mexico_bridge")!;
    bridge.evidence.forEach((evidence) => {
      evidence.title = "跨境规则页面";
      evidence.supports = "页面只描述一般跨境事项，没有明确两国业务链路。";
    });

    const { report } = validateSellerProblemBrief(invalid, "2026-07-16T12:30:00+08:00");

    expect(report.automated_blockers).toContain("signal:1:evidence:0:duplicate_source_url");
    expect(report.automated_blockers.some((blocker) => blocker.endsWith("bridge_seller_signal_missing_us_mexico_link"))).toBe(true);
    expect(report.automated_blockers.some((blocker) => blocker.endsWith("bridge_fact_basis_missing_us_mexico_link"))).toBe(true);
  });
});
