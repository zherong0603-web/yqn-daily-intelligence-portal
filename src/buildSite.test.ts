import { access, cp, mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildSite } from "./buildSite.js";

async function tempWorkspace() {
  const root = await mkdtemp(path.join(os.tmpdir(), "yqn-portal-"));
  const dataDir = path.join(root, "samples");
  const distDir = path.join(root, "dist");
  await cp(path.join(process.cwd(), "data", "samples"), dataDir, { recursive: true });
  return { root, dataDir, distDir };
}

describe("static site build", () => {
  it("keeps two consecutive sample days in manifest history", async () => {
    const { dataDir, distDir } = await tempWorkspace();
    await buildSite({ dataDir, distDir, encryptionEnabled: false, siteUrl: "" });
    const manifest = JSON.parse(await readFile(path.join(distDir, "manifest.json"), "utf8"));
    expect(manifest.reports.map((entry: { date: string }) => entry.date)).toEqual(["2026-06-01", "2026-05-31"]);
  });

  it("creates cross-month archive pages", async () => {
    const { dataDir, distDir } = await tempWorkspace();
    await buildSite({ dataDir, distDir, encryptionEnabled: false, siteUrl: "" });
    await expect(access(path.join(distDir, "archive", "2026", "05", "index.html"))).resolves.toBeUndefined();
    await expect(access(path.join(distDir, "archive", "2026", "06", "index.html"))).resolves.toBeUndefined();
  });

  it("creates setup, system overview, and legacy compatibility pages", async () => {
    const { dataDir, distDir } = await tempWorkspace();
    await buildSite({ dataDir, distDir, encryptionEnabled: false, siteUrl: "" });
    await expect(access(path.join(distDir, "setup", "index.html"))).resolves.toBeUndefined();
    await expect(access(path.join(distDir, "about", "index.html"))).resolves.toBeUndefined();
    await expect(access(path.join(distDir, "boss", "index.html"))).resolves.toBeUndefined();
    await expect(access(path.join(distDir, "executive", "index.html"))).resolves.toBeUndefined();
  });

  it("encrypts report JSON and search index without leaking full plaintext", async () => {
    const { dataDir, distDir } = await tempWorkspace();
    await buildSite({ dataDir, distDir, encryptionEnabled: true, passphrase: "value-b", siteUrl: "" });

    const reportJson = await readFile(path.join(distDir, "reports", "2026-06-01", "brief.json"), "utf8");
    const searchJson = await readFile(path.join(distDir, "search-index.json"), "utf8");
    const homeHtml = await readFile(path.join(distDir, "index.html"), "utf8");
    const legacyHtml = await readFile(path.join(distDir, "boss", "index.html"), "utf8");

    expect(JSON.parse(reportJson).encrypted).toBe(true);
    expect(JSON.parse(searchJson).encrypted).toBe(true);
    expect(reportJson).not.toContain("美国仓客户更关心可执行的库存与退货方案");
    expect(searchJson).not.toContain("美国仓客户更关心可执行的库存与退货方案");
    expect(homeHtml).not.toContain("美国仓客户更关心可执行的库存与退货方案");
    expect(legacyHtml).not.toContain("美国仓客户更关心可执行的库存与退货方案");
    expect(homeHtml).toContain("今日简报已加密");
  });
});
