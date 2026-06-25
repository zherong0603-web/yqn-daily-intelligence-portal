import http from "node:http";
import path from "node:path";
import { execSync } from "node:child_process";
import { createReadStream, existsSync, statSync } from "node:fs";
import { chromium, type Browser, type Page } from "playwright";

export const repoRoot = process.cwd();
export const systemChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
export const desktop = { width: 1440, height: 1200 };
export const tablet = { width: 768, height: 1024 };
export const mobile = { width: 390, height: 844 };
export const githubRepository = "zherong0603-web/yqn-daily-intelligence-portal";

const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

function resolveRequest(root: string, url = "/"): string {
  const pathname = decodeURIComponent(new URL(url, "http://127.0.0.1").pathname);
  const clean = pathname.replace(/^\/+/, "");
  const candidate = path.join(root, clean);
  if (existsSync(candidate) && statSync(candidate).isDirectory()) return path.join(candidate, "index.html");
  if (existsSync(candidate)) return candidate;
  return path.join(root, clean, "index.html");
}

export async function serve(root: string): Promise<{ baseUrl: string; close: () => Promise<void> }> {
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

export async function launchBrowser(): Promise<Browser> {
  return chromium.launch(existsSync(systemChrome) ? { executablePath: systemChrome } : {});
}

export function applyPublicRepoVariablesForLocalBuild(): void {
  for (const name of ["OPENAI_MODEL", "BRIEF_ENCRYPTION_ENABLED", "OPENAI_WEB_SEARCH_ENABLED", "MAX_SEARCH_CALLS", "SITE_URL"]) {
    if (process.env[name]) continue;
    try {
      const value = execSync(`gh variable get ${name} --repo ${githubRepository}`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
      if (value) process.env[name] = value;
    } catch {
      // Local visual builds can still run without GitHub CLI variable access.
    }
  }
}

export async function screenshotFullPage(
  browser: Browser,
  baseUrl: string,
  route: string,
  outputPath: string,
  viewport: { width: number; height: number },
  beforeShot?: (page: Page) => Promise<void>,
): Promise<void> {
  const page = await browser.newPage({ viewport });
  await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
  if (beforeShot) await beforeShot(page);
  await page.screenshot({ path: outputPath, fullPage: true });
  await page.close();
}

export async function screenshotLocator(
  browser: Browser,
  baseUrl: string,
  route: string,
  selector: string,
  outputPath: string,
  viewport: { width: number; height: number } = desktop,
  beforeShot?: (page: Page) => Promise<void>,
): Promise<void> {
  const page = await browser.newPage({ viewport });
  await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
  if (beforeShot) await beforeShot(page);
  const locator = page.locator(selector).first();
  await locator.scrollIntoViewIfNeeded();
  await locator.screenshot({ path: outputPath });
  await page.close();
}
