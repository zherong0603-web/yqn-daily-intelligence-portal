import http from "node:http";
import path from "node:path";
import { createReadStream, existsSync, statSync } from "node:fs";

const root = path.resolve(process.cwd(), process.argv[2] || "dist");
const port = Number(process.env.PORT || 4173);

const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".txt": "text/plain; charset=utf-8",
};

function resolveRequest(url = "/"): string {
  const pathname = decodeURIComponent(new URL(url, `http://127.0.0.1:${port}`).pathname);
  const clean = pathname.replace(/^\/+/, "");
  const candidate = path.join(root, clean);
  if (existsSync(candidate) && statSync(candidate).isDirectory()) return path.join(candidate, "index.html");
  if (existsSync(candidate)) return candidate;
  return path.join(root, clean, "index.html");
}

const server = http.createServer((req, res) => {
  const file = resolveRequest(req.url);
  if (!existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }
  res.writeHead(200, { "content-type": contentTypes[path.extname(file)] || "application/octet-stream" });
  createReadStream(file).pipe(res);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Preview: http://127.0.0.1:${port}/`);
});
