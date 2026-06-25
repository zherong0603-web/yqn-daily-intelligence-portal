import http from "node:http";
import path from "node:path";
import os from "node:os";
import { createReadStream, existsSync, statSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { chromium, type Browser, type Page } from "playwright";
import { buildSite } from "../src/buildSite.js";

const repoRoot = process.cwd();
const auditDir = path.join(repoRoot, "docs", "visual-audit");
const systemChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const desktop = { width: 1440, height: 1200 };
const tablet = { width: 768, height: 1024 };
const mobile = { width: 390, height: 844 };
const passphrase = "local-visual-audit-passphrase";

const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".txt": "text/plain; charset=utf-8",
};

function resolveRequest(root: string, url = "/"): string {
  const pathname = decodeURIComponent(new URL(url, "http://127.0.0.1").pathname);
  const clean = pathname.replace(/^\/+/, "");
  const candidate = path.join(root, clean);
  if (existsSync(candidate) && statSync(candidate).isDirectory()) return path.join(candidate, "index.html");
  if (existsSync(candidate)) return candidate;
  return path.join(root, clean, "index.html");
}

async function serve(root: string): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const server = http.createServer((req, res) => {
    const file = resolveRequest(root, req.url);
    if (!existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "content-type": contentTypes[path.extname(file)] || "application/octet-stream" });
    createReadStream(file).pipe(res);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

async function screenshot(
  browser: Browser,
  baseUrl: string,
  route: string,
  filename: string,
  viewport: { width: number; height: number },
  beforeShot?: (page: Page) => Promise<void>,
): Promise<void> {
  const page = await browser.newPage({ viewport });
  await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
  if (beforeShot) await beforeShot(page);
  await page.screenshot({ path: path.join(auditDir, filename), fullPage: true });
  await page.close();
}

async function main(): Promise<void> {
  await rm(auditDir, { recursive: true, force: true });
  await mkdir(auditDir, { recursive: true });

  await buildSite({
    repoRoot,
    dataDir: "data/briefs",
    distDir: "dist",
    encryptionEnabled: false,
    siteUrl: "http://127.0.0.1",
  });

  const publicServer = await serve(path.join(repoRoot, "dist"));
  const browser = await chromium.launch(existsSync(systemChrome) ? { executablePath: systemChrome } : {});
  try {
    await screenshot(browser, publicServer.baseUrl, "/", "desktop-home.png", desktop);
    await screenshot(browser, publicServer.baseUrl, "/reports/2026-07-01/", "desktop-report-2026-07-01.png", desktop);
    await screenshot(browser, publicServer.baseUrl, "/reports/2026-07-02/", "desktop-report-2026-07-02.png", desktop);
    await screenshot(browser, publicServer.baseUrl, "/archive/", "desktop-archive.png", desktop);
    await screenshot(browser, publicServer.baseUrl, "/archive/2026/07/", "desktop-month-2026-07.png", desktop);
    await screenshot(browser, publicServer.baseUrl, "/archive/2026/week-27/", "desktop-week-2026-W27.png", desktop);
    await screenshot(browser, publicServer.baseUrl, "/", "tablet-home.png", tablet);
    await screenshot(browser, publicServer.baseUrl, "/", "mobile-home.png", mobile);
    await screenshot(browser, publicServer.baseUrl, "/reports/2026-07-01/", "mobile-report-2026-07-01.png", mobile);

    await screenshot(browser, publicServer.baseUrl, "/", "desktop-search-results.png", desktop, async (page) => {
      await page.fill("#searchInput", "美国仓");
      await page.waitForSelector(".result-row");
    });
    await screenshot(browser, publicServer.baseUrl, "/", "desktop-search-empty.png", desktop, async (page) => {
      await page.fill("#searchInput", "不存在的验收关键词999");
      await page.waitForSelector(".empty");
    });
    await screenshot(browser, publicServer.baseUrl, "/", "desktop-topic-filter.png", desktop, async (page) => {
      await page.selectOption("#topicFilter", "ecommerce_us_warehouse");
      await page.waitForSelector(".result-row");
    });
  } finally {
    await publicServer.close();
  }

  const encryptedDist = await mkdtemp(path.join(os.tmpdir(), "yqn-portal-encrypted-"));
  await buildSite({
    repoRoot,
    dataDir: "data/briefs",
    distDir: encryptedDist,
    encryptionEnabled: true,
    passphrase,
    siteUrl: "http://127.0.0.1",
  });
  const encryptedServer = await serve(encryptedDist);
  try {
    await screenshot(browser, encryptedServer.baseUrl, "/reports/2026-07-01/", "desktop-encrypted-locked.png", desktop);
    await screenshot(browser, encryptedServer.baseUrl, "/reports/2026-07-01/", "desktop-encrypted-unlocked.png", desktop, async (page) => {
      await page.fill("#passphrase", passphrase);
      await page.click("#unlockBrief");
      await page.waitForSelector("#briefRoot .signal-card");
    });
  } finally {
    await encryptedServer.close();
    await browser.close();
    await rm(encryptedDist, { recursive: true, force: true });
  }

  await writeFile(path.join(auditDir, "manifest.json"), JSON.stringify({
    generated_at: new Date().toISOString(),
    mode: "local-build",
    note: "Screenshots were generated from local build output to verify the V2 UI before GitHub Pages deployment.",
    files: [
      "desktop-home.png",
      "desktop-report-2026-07-01.png",
      "desktop-report-2026-07-02.png",
      "desktop-archive.png",
      "desktop-month-2026-07.png",
      "desktop-week-2026-W27.png",
      "desktop-search-results.png",
      "desktop-search-empty.png",
      "desktop-topic-filter.png",
      "desktop-encrypted-locked.png",
      "desktop-encrypted-unlocked.png",
      "mobile-home.png",
      "mobile-report-2026-07-01.png",
      "tablet-home.png"
    ],
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "visual audit failed");
  process.exit(1);
});
