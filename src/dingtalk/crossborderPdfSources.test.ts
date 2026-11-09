import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { validateCrossborderV2Brief, verifyCrossborderV2Sources } from "./buildSellerProblemBrief.js";

// Genuine USTR final notice downloaded from this public URL on 2026-11-09.
const pdfUrl = "https://ustr.gov/sites/default/files/files/Issue_Areas/Enforcement/Section%20301/USTR%20Sec%20301%20Ships%20FRN%20Further%20Suspension.pdf";
const indexUrl = "https://ustr.gov/trade-topics/enforcement/section-301-investigations/section-301-china-targeting-maritime-logistics-and-shipbuilding-sectors-dominance";
const pdf = readFileSync(new URL("./fixtures/ustr-ships-further-suspension-2026-11-06.pdf", import.meta.url));
const sample = JSON.parse(readFileSync(new URL("../../data/codex-shadow/2026-11-02.crossborder-v2.json", import.meta.url), "utf8"));
const anchor = `<a href="${pdfUrl}">Notice of Modification to Further Suspend Action for Two Months – November 6, 2026</a>`;

function pdfBrief() {
  const { brief } = validateCrossborderV2Brief(sample);
  if (!brief) throw new Error("sample must validate");
  const checked = structuredClone(brief);
  checked.signals[0]!.evidence = [{
    ...checked.signals[0]!.evidence[0]!,
    url: pdfUrl,
    source_type: "official",
    published_at: "2026-11-06",
    published_at_source_url: indexUrl,
    markers: ["11:59 p.m. Eastern Time on January 9, 2027", "no party will accrue liability", "effective on November 9, 2026"],
  }];
  return checked;
}

function mockSources(index = anchor, document: Uint8Array = pdf) {
  return vi.fn().mockResolvedValueOnce(new Response(new Uint8Array(document), { headers: { "content-type": "application/pdf" } }))
    .mockResolvedValueOnce(new Response(index));
}

describe("official PDF source verification", () => {
  it("extracts all markers from an actual final notice and attributes the visible date to its exact index anchor", async () => {
    const checks = await verifyCrossborderV2Sources(pdfBrief(), mockSources() as typeof fetch);
    expect(checks[0]).toMatchObject({ ok: true, matched_date: "November 6, 2026", date_source_url: indexUrl });
    expect(checks[0]!.matched_markers).toHaveLength(3);
  });

  it.each([
    `<p>November 6, 2026</p><a href="${pdfUrl}">Undated notice</a>`,
    `<a href="/other.pdf">November 6, 2026</a><a href="${pdfUrl}">November 5, 2026</a>`,
    `<a href="${pdfUrl}"><span hidden>November 6, 2026</span>Undated notice</a>`,
    `<div hidden>${anchor}</div>`,
    `<script>${anchor}</script>`,
    `<base href="https://other.example/">${anchor}`,
  ])("rejects a date from elsewhere, a different document or hidden content", async (index) => {
    const checks = await verifyCrossborderV2Sources(pdfBrief(), mockSources(index) as typeof fetch);
    expect(checks[0]!.ok).toBe(false);
    expect(checks[0]!.error).toContain("exact PDF");
  });

  it("requires every marker in the PDF, without borrowing text from the index", async () => {
    const brief = pdfBrief();
    brief.signals[0]!.evidence[0]!.markers.push("all Chinese goods are tax free");
    const checks = await verifyCrossborderV2Sources(brief, mockSources(`${anchor}<p>all Chinese goods are tax free</p>`) as typeof fetch);
    expect(checks[0]).toMatchObject({ ok: false, date_source_url: indexUrl });
    expect(checks[0]!.error).toContain("missing 1 required evidence marker");
  });

  it("rejects an off-site date index before fetching it", async () => {
    const brief = pdfBrief();
    brief.signals[0]!.evidence[0]!.published_at_source_url = "https://example.com/index";
    const mocked = mockSources();
    const checks = await verifyCrossborderV2Sources(brief, mocked as typeof fetch);
    expect(checks[0]!.ok).toBe(false);
    expect(checks[0]!.error).toContain("same origin");
    expect(mocked).toHaveBeenCalledTimes(1);
  });

  it("rejects cross-origin and private redirects from the date index", async () => {
    for (const destination of ["https://example.com/index", "https://127.0.0.1/index"]) {
      const mocked = vi.fn().mockResolvedValueOnce(new Response(pdf))
        .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: destination } }));
      const checks = await verifyCrossborderV2Sources(pdfBrief(), mocked as typeof fetch);
      expect(checks[0]!.ok).toBe(false);
      expect(mocked).toHaveBeenCalledTimes(2);
    }
  });

  it("fails closed on malformed PDF bytes", async () => {
    const mocked = mockSources(anchor, Buffer.from("%PDF-invalid document"));
    const checks = await verifyCrossborderV2Sources(pdfBrief(), mocked as typeof fetch);
    expect(checks[0]!.ok).toBe(false);
    expect(checks[0]!.error).toContain("PDF extraction failed");
    expect(mocked).toHaveBeenCalledTimes(1);
  });

  it("does not accept an external publication index for HTML or non-official sources", async () => {
    const htmlCheck = await verifyCrossborderV2Sources(pdfBrief(), mockSources(anchor, Buffer.from("<p>November 6, 2026</p>")) as typeof fetch);
    expect(htmlCheck[0]!.ok).toBe(false);
    const brief = pdfBrief();
    brief.signals[0]!.evidence[0]!.source_type = "media";
    const mocked = mockSources();
    const checks = await verifyCrossborderV2Sources(brief, mocked as typeof fetch);
    expect(checks[0]!.ok).toBe(false);
    expect(mocked).not.toHaveBeenCalled();
  });

  it("rejects oversized streamed PDF bodies even without content-length", async () => {
    const cancel = vi.fn();
    let count = 0;
    const body = new ReadableStream({
      pull(controller) { count += 1; controller.enqueue(Buffer.alloc(1_000_001)); },
      cancel,
    });
    const mocked = vi.fn().mockResolvedValueOnce(new Response(body));
    const checks = await verifyCrossborderV2Sources(pdfBrief(), mocked as typeof fetch);
    expect(checks[0]!.ok).toBe(false);
    expect(checks[0]!.error).toContain("too large");
    expect(cancel).toHaveBeenCalled();
    expect(count).toBeLessThanOrEqual(4);
  });

  it("validates date-index URLs through the existing credential protection schema", () => {
    const brief = pdfBrief();
    brief.signals[0]!.evidence[0]!.published_at_source_url = "https://ustr.gov/index?token=redacted";
    const { report } = validateCrossborderV2Brief(brief);
    expect(report.content_valid).toBe(false);
    expect(report.automated_blockers.some((item) => item.includes("published_at_source_url"))).toBe(true);
  });
});
