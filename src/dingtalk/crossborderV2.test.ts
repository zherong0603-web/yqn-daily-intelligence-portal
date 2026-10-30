import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  renderCrossborderV2Markdown,
  renderCrossborderV2Scripts,
  validateCrossborderV2Brief,
} from "./buildSellerProblemBrief.js";

const sample = JSON.parse(
  readFileSync(new URL("../../data/codex-shadow/2026-10-30.crossborder-v2.json", import.meta.url), "utf8"),
) as Record<string, unknown>;

describe("Crossborder V2 brief guardrails", () => {
  it("accepts the reviewed three-market sample and estimates 90-120 seconds", () => {
    const { brief, report } = validateCrossborderV2Brief(sample, "2026-10-30T14:40:00+08:00");

    expect(report.content_valid).toBe(true);
    expect(report.signal_count).toBe(3);
    expect(report.us_first).toBe(true);
    expect(report.estimated_seconds.a).toBeGreaterThanOrEqual(90);
    expect(report.estimated_seconds.a).toBeLessThanOrEqual(120);
    expect(report.automated_blockers).toEqual([]);

    const rendered = renderCrossborderV2Markdown(brief!);
    expect(rendered).toContain("HeyGen A版纯文本口播稿");
    expect(rendered).toContain("A/B 黄金3秒");
    expect(rendered).toContain("核实来源与风险说明");
  });

  it("keeps A and B scripts on the exact same body and plain text", () => {
    const { brief } = validateCrossborderV2Brief(sample);
    const scripts = renderCrossborderV2Scripts(brief!);

    expect(scripts.a.endsWith(scripts.body)).toBe(true);
    expect(scripts.b.endsWith(scripts.body)).toBe(true);
    expect(scripts.a).toContain("两分钟，听懂跨境事！");
    expect(scripts.a).not.toMatch(/https?:\/\/|\*\*|!\[|\]\(/);
    expect(scripts.b).not.toMatch(/https?:\/\/|\*\*|!\[|\]\(/);
  });

  it("blocks a non-US first item and an injected link in the voiceover", () => {
    const invalid = structuredClone(sample) as {
      signals: Array<{ region: string }>;
      voiceover_body: string;
    };
    invalid.signals[0]!.region = "mexico";
    invalid.voiceover_body += "\n来源https://bad.example.com";

    const { report } = validateCrossborderV2Brief(invalid);

    expect(report.content_valid).toBe(false);
    expect(report.automated_blockers).toContain("signals:first_must_be_us");
    expect(report.automated_blockers).toContain("voiceover:contains_markup_or_link");
  });
});
