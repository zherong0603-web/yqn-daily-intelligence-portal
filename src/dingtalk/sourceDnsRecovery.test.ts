import { readFileSync } from "node:fs";
import { Readable } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import { validateCrossborderV2Brief, verifyCrossborderV2Sources } from "./buildSellerProblemBrief.js";

const { lookup, get } = vi.hoisted(() => ({ lookup: vi.fn(), get: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup }));
vi.mock("node:https", () => ({ get }));

const dateText = "16 Nov 2026";
const marker = "LCL Min & W/m";
function makeBrief() {
  const { brief } = validateCrossborderV2Brief(JSON.parse(readFileSync(new URL("../../data/codex-shadow/2026-11-02.crossborder-v2.json", import.meta.url), "utf8")));
  const signal = brief!.signals[0]!;
  signal.evidence = [{ ...signal.evidence[0]!, url: "https://shipping.example.com/notice", published_at: "2026-11-16", markers: [marker] }];
  brief!.signals = [signal];
  return brief!;
}
function dnsResponse(...addresses: string[]) {
  return new Response(JSON.stringify({ Status: 0, Answer: addresses.map((data) => ({ name: "shipping.example.com.", type: 1, data })) }));
}
function mockHttps(options: { hostname: string; servername: string; headers: { Host?: string }; rejectUnauthorized: boolean }, consume: (value: unknown) => void) {
  expect(options).toMatchObject({ hostname: "93.184.216.34", servername: "shipping.example.com", rejectUnauthorized: true, headers: { Host: "shipping.example.com" } });
  const html = Readable.from([Buffer.from(`<p>${dateText}</p><p>${marker}</p>`)]);
  consume(Object.assign(html, { statusCode: 200, headers: {} }));
  return { once: vi.fn() };
}

afterEach(() => {
  vi.unstubAllGlobals();
  lookup.mockReset();
  get.mockReset();
});

describe("strict source recovery for synthetic DNS addresses", () => {
  it("uses a verified public TLS route and still checks the exact visible date and marker", async () => {
    lookup.mockResolvedValue([{ address: "198.18.0.38", family: 4 }]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(dnsResponse("93.184.216.34")));
    get.mockImplementation(mockHttps);
    const [check] = await verifyCrossborderV2Sources(makeBrief());
    expect(check).toMatchObject({ ok: true, matched_date: dateText, matched_markers: [marker] });
  });

  it("rejects a public resolver answer containing a private address without connecting", async () => {
    lookup.mockResolvedValue([{ address: "198.18.0.38", family: 4 }]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(dnsResponse("93.184.216.34", "127.0.0.1")));
    const [check] = await verifyCrossborderV2Sources(makeBrief());
    expect(check).toMatchObject({ ok: false, error: expect.stringContaining("public IPv4") });
    expect(get).not.toHaveBeenCalled();
  });

  it("never retries a real private system DNS answer using the independent resolver", async () => {
    lookup.mockResolvedValue([{ address: "10.0.0.2", family: 4 }]);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const [check] = await verifyCrossborderV2Sources(makeBrief());
    expect(check).toMatchObject({ ok: false, error: "source hostname resolves to a private address" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
  });
});
