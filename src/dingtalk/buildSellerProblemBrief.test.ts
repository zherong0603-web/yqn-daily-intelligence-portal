import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  renderSellerProblemMarkdown,
  validateSellerProblemBrief,
} from "./buildSellerProblemBrief.js";

const fixture = JSON.parse(
  readFileSync(new URL("../../data/codex-shadow/2026-07-16.seller-problem.json", import.meta.url), "utf8"),
) as Record<string, unknown>;

describe("seller problem brief guardrails", () => {
  it("accepts the reviewed 2+2+1 sample but never permits sending", () => {
    const { brief, report } = validateSellerProblemBrief(fixture, "2026-07-16T12:30:00+08:00");

    expect(report.content_valid).toBe(true);
    expect(report.send_allowed).toBe(false);
    expect(report.counts).toEqual({ us_warehouse: 2, mexico_warehouse: 2, us_mexico_bridge: 1 });
    expect(renderSellerProblemMarkdown(brief!, { publication: "production" })).not.toContain("待验收");
    expect(renderSellerProblemMarkdown(brief!, { publication: "production" })).toContain("工作日 08:45 更新");
  });

  it("blocks a signal that loses its fact basis", () => {
    const invalid = structuredClone(fixture) as { signals: Array<{ evidence: Array<{ roles: string[] }> }> };
    invalid.signals[0]!.evidence = invalid.signals[0]!.evidence.slice(0, 1);
    invalid.signals[0]!.evidence[0]!.roles = ["seller_signal"];

    const { report } = validateSellerProblemBrief(invalid, "2026-07-16T12:30:00+08:00");

    expect(report.content_valid).toBe(false);
    expect(report.automated_blockers).toContain("signal:0:missing_fact_basis");
    expect(report.send_allowed).toBe(false);
  });

  it("blocks a report with the wrong market ratio", () => {
    const invalid = structuredClone(fixture) as { signals: Array<{ market_focus: string }> };
    invalid.signals[4]!.market_focus = "us_warehouse";

    const { report } = validateSellerProblemBrief(invalid, "2026-07-16T12:30:00+08:00");

    expect(report.content_valid).toBe(false);
    expect(report.automated_blockers).toContain("ratio:us_warehouse:3");
    expect(report.automated_blockers).toContain("ratio:us_mexico_bridge:0");
    expect(report.send_allowed).toBe(false);
  });
});
