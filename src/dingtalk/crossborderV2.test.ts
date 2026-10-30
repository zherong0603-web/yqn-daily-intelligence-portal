import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  renderCrossborderV2Markdown,
  renderCrossborderV2Scripts,
  validateCrossborderV2Brief,
  verifyCrossborderV2Sources,
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

  it("blocks Mexico and Europe in reverse priority order", () => {
    const invalid = structuredClone(sample) as { signals: Array<{ region: string }> };
    const mexico = invalid.signals[1]!;
    invalid.signals[1] = invalid.signals[2]!;
    invalid.signals[2] = mexico;

    const { report } = validateCrossborderV2Brief(invalid, "2026-10-30T14:40:00+08:00");

    expect(report.content_valid).toBe(false);
    expect(report.region_priority_valid).toBe(false);
    expect(report.automated_blockers).toContain("signals:region_priority_invalid");
  });

  it("fails closed when schema validation fails", () => {
    const { report } = validateCrossborderV2Brief({ format_version: "v2", date: "2026-10-30" });

    expect(report.content_valid).toBe(false);
    expect(report.send_allowed).toBe(false);
  });

  it("rejects non-HTTPS sources with embedded credentials", () => {
    const invalid = structuredClone(sample) as { signals: Array<{ evidence: Array<{ url: string }> }> };
    invalid.signals[0]!.evidence[0]!.url = "http://user:pass@example.com/source";

    const { report } = validateCrossborderV2Brief(invalid, "2026-10-30T14:40:00+08:00");

    expect(report.content_valid).toBe(false);
    expect(report.automated_blockers.some((blocker) => blocker.includes("signals.0.evidence.0.url"))).toBe(true);
  });

  it("enforces the declared 24-hour window when coverage says 24 hours", () => {
    const invalid = structuredClone(sample) as {
      coverage: { searched_window_hours: number };
      signals: Array<{ evidence: Array<{ published_at: string }> }>;
    };
    invalid.coverage.searched_window_hours = 24;
    invalid.signals[1]!.evidence[0]!.published_at = "2026-10-28";

    const { report } = validateCrossborderV2Brief(invalid, "2026-10-30T14:40:00+08:00");

    expect(report.content_valid).toBe(false);
    expect(report.automated_blockers.some((blocker) => blocker.endsWith("market_signal_older_than_24_hours"))).toBe(true);
  });

  it("writes the required stable output file names", () => {
    expect(() => readFileSync(new URL("../../data/codex-shadow/2026-10-30.crossborder-v2.md", import.meta.url))).not.toThrow();
    expect(() => readFileSync(new URL("../../data/codex-shadow/2026-10-30.heygen-a.txt", import.meta.url))).not.toThrow();
    expect(() => readFileSync(new URL("../../data/codex-shadow/2026-10-30.heygen-b.txt", import.meta.url))).not.toThrow();
  });

  it("does not fetch private or credential-bearing source URLs", async () => {
    const { brief } = validateCrossborderV2Brief(sample);
    if (!brief) throw new Error("sample brief must validate");
    const unsafe = structuredClone(brief);
    unsafe.signals[0]!.evidence[0]!.url = "https://127.0.0.1/private?access_token=bad";
    const fetchMock = vi.fn();

    const unsafeOnlySignal = { ...unsafe.signals[0]!, evidence: [unsafe.signals[0]!.evidence[0]!] };
    const unsafeOnly = { ...unsafe, signals: [unsafeOnlySignal] };
    const checks = await verifyCrossborderV2Sources(unsafeOnly, fetchMock as typeof fetch);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(checks[0]!.ok).toBe(false);
    expect(checks[0]!.url).toBe("https://127.0.0.1/private");
  });
});
