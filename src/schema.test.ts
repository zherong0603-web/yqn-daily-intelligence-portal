import { describe, expect, it } from "vitest";
import { readJsonFile } from "./utils/fs.js";
import { briefSchema } from "./schema.js";

describe("brief schema", () => {
  it("accepts a valid sample brief", async () => {
    const sample = await readJsonFile("data/samples/2026-05-31.json");
    expect(() => briefSchema.parse(sample)).not.toThrow();
  });

  it("rejects items without a public source_url", async () => {
    const sample = await readJsonFile<Record<string, unknown>>("data/samples/2026-05-31.json");
    const items = [...(sample.items as Record<string, unknown>[])];
    delete items[0]?.source_url;
    expect(() => briefSchema.parse({ ...sample, items })).toThrow();
  });
});
