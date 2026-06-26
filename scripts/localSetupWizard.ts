import http from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const repository = "zherong0603-web/yqn-daily-intelligence-portal";
const workflowUrl = `https://github.com/${repository}/actions/workflows/daily-briefing.yml`;

interface SavePayload {
  openAiApiKey?: string;
  openAiModel?: string;
  feishuWebhookUrl?: string;
  feishuSignSecret?: string;
  encryptionEnabled?: boolean;
  pageAccessPassphrase?: string;
  runAfterSave?: boolean;
}

function runGh(args: string[], input?: string): string {
  const result = spawnSync("gh", args, {
    cwd: repoRoot,
    input,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "GitHub CLI 操作失败").trim());
  }
  return result.stdout.trim();
}

function listConfigured(kind: "secret" | "variable"): Set<string> {
  const output = runGh([kind, "list", "--repo", repository]);
  return new Set(output.split("\n").map((line) => line.split(/\s+/)[0]).filter(Boolean));
}

function setSecret(name: string, value?: string): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  runGh(["secret", "set", name, "--repo", repository], trimmed);
  return name;
}

function setVariable(name: string, value?: string): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  runGh(["variable", "set", name, "--repo", repository], trimmed);
  return name;
}

function validatePayload(payload: SavePayload): string[] {
  const errors: string[] = [];
  const key = payload.openAiApiKey?.trim();
  const model = payload.openAiModel?.trim();
  const feishu = payload.feishuWebhookUrl?.trim();
  if (key && !key.startsWith("sk-")) errors.push("OPENAI_API_KEY 看起来不像 OpenAI API Key。OpenAI Key 通常以 sk- 开头。");
  if (!model) errors.push("OPENAI_MODEL 必填，建议填 gpt-4o-mini。");
  if (feishu) {
    try {
      const url = new URL(feishu);
      if (url.protocol !== "https:") errors.push("FEISHU_WEBHOOK_URL 必须是 https 地址。");
    } catch {
      errors.push("FEISHU_WEBHOOK_URL 不是有效网址。");
    }
  }
  if (payload.encryptionEnabled && !payload.pageAccessPassphrase?.trim()) {
    errors.push("开启加密时必须填写 PAGE_ACCESS_PASSPHRASE。");
  }
  return errors;
}

function sendJson(res: http.ServerResponse, statusCode: number, payload: unknown): void {
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function pageHtml(): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>YQN 每日重点简报 · 本机配置助手</title>
  <style>
    :root { color-scheme: light; --blue:#126bff; --line:#dce6f3; --text:#142033; --muted:#687a92; --bg:#f4f7fb; --paper:#fff; --green:#0f9f6e; --orange:#f97316; --red:#dc2626; }
    * { box-sizing: border-box; }
    body { margin: 0; background: linear-gradient(135deg, rgba(18,107,255,.08), transparent 38%), var(--bg); color: var(--text); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.6; }
    .wrap { width: min(980px, calc(100% - 28px)); margin: 0 auto; padding: 28px 0 54px; }
    .hero, .card { background: var(--paper); border: 1px solid var(--line); border-radius: 10px; box-shadow: 0 18px 45px rgba(32,73,128,.12); }
    .hero { padding: clamp(22px, 5vw, 46px); background: linear-gradient(135deg, rgba(18,107,255,.12), transparent 48%), #fff; }
    .card { padding: 18px; margin-top: 14px; }
    h1 { margin: 0; font-size: clamp(34px, 5vw, 54px); line-height: 1.06; }
    h2 { margin: 0 0 12px; font-size: 22px; }
    p { margin: 0; color: var(--muted); }
    label { display: grid; gap: 6px; font-weight: 780; margin-top: 14px; }
    input, select { width: 100%; min-height: 44px; border: 1px solid var(--line); border-radius: 8px; padding: 9px 11px; font: inherit; color: var(--text); background: #fff; }
    input:focus, select:focus { outline: 0; border-color: var(--blue); box-shadow: 0 0 0 3px rgba(18,107,255,.12); }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-top: 18px; }
    button, a.button { min-height: 42px; border: 1px solid var(--line); border-radius: 8px; padding: 9px 14px; font: inherit; font-weight: 820; cursor: pointer; text-decoration: none; color: var(--text); background: #fff; }
    button.primary { border-color: var(--blue); background: linear-gradient(135deg, #126bff, #0754d8); color: #fff; box-shadow: 0 12px 25px rgba(18,107,255,.22); }
    .hint { font-size: 13px; color: var(--muted); font-weight: 560; }
    .status { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; margin-top: 14px; }
    .pill { border: 1px solid var(--line); border-radius: 8px; padding: 10px; background: #f9fbff; font-weight: 820; overflow-wrap: anywhere; }
    .ok { color: var(--green); }
    .warn { color: #9a5a00; }
    .danger { color: var(--red); }
    .notice { border-left: 4px solid var(--orange); background: #fff7ed; padding: 12px 14px; border-radius: 8px; color: #9a3412; font-weight: 760; margin-top: 14px; }
    .result { white-space: pre-wrap; border: 1px solid var(--line); border-radius: 8px; background: #f8fbff; padding: 14px; margin-top: 14px; min-height: 58px; }
    .switch { display: flex; align-items: center; gap: 9px; margin-top: 14px; font-weight: 780; }
    .switch input { width: 18px; min-height: 18px; }
    @media (max-width: 720px) { .row { grid-template-columns: 1fr; } .actions { display: grid; } button, a.button { width: 100%; text-align: center; } }
  </style>
</head>
<body>
  <main class="wrap">
    <section class="hero">
      <p style="color:#126bff;font-weight:900;text-transform:uppercase;margin-bottom:8px;">Local Setup Wizard</p>
      <h1>YQN 每日重点简报<br>本机配置助手</h1>
      <p style="margin-top:14px;font-size:19px;">你只需要在这个本机网页填表。密钥不会发到聊天里，也不会写进公开网页；它会由你电脑上的 GitHub 权限写入 GitHub Secrets。</p>
      <div class="notice">这个页面只运行在你的电脑 localhost，不是公开网站。填完后可以关闭。</div>
    </section>

    <section class="card">
      <h2>当前配置状态</h2>
      <p>这里只显示已配置 / 缺失，不显示任何密钥值。</p>
      <div id="status" class="status"></div>
    </section>

    <section class="card">
      <h2>第一步：填 OpenAI</h2>
      <label>OPENAI_API_KEY
        <input id="openAiApiKey" type="password" autocomplete="off" placeholder="粘贴 OpenAI API Key，通常以 sk- 开头">
        <span class="hint">真实 AI 日报必须填。ChatGPT Pro 不等于 API 免费额度。</span>
      </label>
      <label>OPENAI_MODEL
        <input id="openAiModel" value="gpt-4o-mini" autocomplete="off">
        <span class="hint">建议先用 gpt-4o-mini，便宜。若账号不可用，再换成账号可用模型。</span>
      </label>
      <div class="actions">
        <a class="button" href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">打开 OpenAI API Key 页面</a>
      </div>
    </section>

    <section class="card">
      <h2>第二步：填飞书，想要通知才填</h2>
      <label>FEISHU_WEBHOOK_URL
        <input id="feishuWebhookUrl" type="password" autocomplete="off" placeholder="粘贴飞书自定义机器人 webhook，可留空">
      </label>
      <label>FEISHU_SIGN_SECRET
        <input id="feishuSignSecret" type="password" autocomplete="off" placeholder="飞书机器人开启签名时才填，可留空">
      </label>
    </section>

    <section class="card">
      <h2>第三步：加密，正式内部内容建议开</h2>
      <label class="switch"><input id="encryptionEnabled" type="checkbox"> 开启网页正文加密</label>
      <label>PAGE_ACCESS_PASSPHRASE
        <input id="pageAccessPassphrase" type="password" autocomplete="off" placeholder="开启加密时填一个访问密码，可留空">
      </label>
    </section>

    <section class="card">
      <h2>第四步：保存并测试</h2>
      <label class="switch"><input id="runAfterSave" type="checkbox" checked> 保存后立刻跑一次真实日报测试</label>
      <div class="actions">
        <button class="primary" id="save">保存配置</button>
        <a class="button" href="${workflowUrl}" target="_blank" rel="noreferrer">打开 Actions 查看结果</a>
      </div>
      <div id="result" class="result">等待你填写并点击“保存配置”。</div>
    </section>
  </main>

  <script>
    async function api(path, options) {
      const response = await fetch(path, options);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '操作失败');
      return data;
    }
    function renderStatus(data) {
      const root = document.getElementById('status');
      const items = [
        ['OPENAI_API_KEY', data.secrets.OPENAI_API_KEY],
        ['OPENAI_MODEL', data.variables.OPENAI_MODEL],
        ['FEISHU_WEBHOOK_URL', data.secrets.FEISHU_WEBHOOK_URL],
        ['PAGE_ACCESS_PASSPHRASE', data.secrets.PAGE_ACCESS_PASSPHRASE],
        ['BRIEF_ENCRYPTION_ENABLED', data.variables.BRIEF_ENCRYPTION_ENABLED],
      ];
      root.innerHTML = items.map(([name, ok]) => '<div class="pill"><span>' + name + '</span><br><strong class="' + (ok ? 'ok' : 'warn') + '">' + (ok ? '已配置' : '缺失') + '</strong></div>').join('');
    }
    async function refresh() {
      try {
        renderStatus(await api('/status'));
      } catch (error) {
        document.getElementById('status').innerHTML = '<div class="pill danger">无法读取状态：' + error.message + '</div>';
      }
    }
    document.getElementById('save').addEventListener('click', async () => {
      const result = document.getElementById('result');
      result.textContent = '正在保存，不要关闭页面...';
      try {
        const payload = {
          openAiApiKey: document.getElementById('openAiApiKey').value,
          openAiModel: document.getElementById('openAiModel').value,
          feishuWebhookUrl: document.getElementById('feishuWebhookUrl').value,
          feishuSignSecret: document.getElementById('feishuSignSecret').value,
          encryptionEnabled: document.getElementById('encryptionEnabled').checked,
          pageAccessPassphrase: document.getElementById('pageAccessPassphrase').value,
          runAfterSave: document.getElementById('runAfterSave').checked,
        };
        const data = await api('/save', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
        result.textContent = data.message + (data.runUrl ? '\\n\\n已触发测试：' + data.runUrl : '');
        document.getElementById('openAiApiKey').value = '';
        document.getElementById('feishuWebhookUrl').value = '';
        document.getElementById('feishuSignSecret').value = '';
        document.getElementById('pageAccessPassphrase').value = '';
        await refresh();
      } catch (error) {
        result.textContent = '保存失败：' + error.message;
      }
    });
    refresh();
  </script>
</body>
</html>`;
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

function handleStatus(res: http.ServerResponse): void {
  const secrets = listConfigured("secret");
  const variables = listConfigured("variable");
  sendJson(res, 200, {
    secrets: {
      OPENAI_API_KEY: secrets.has("OPENAI_API_KEY"),
      FEISHU_WEBHOOK_URL: secrets.has("FEISHU_WEBHOOK_URL"),
      FEISHU_SIGN_SECRET: secrets.has("FEISHU_SIGN_SECRET"),
      PAGE_ACCESS_PASSPHRASE: secrets.has("PAGE_ACCESS_PASSPHRASE"),
    },
    variables: {
      OPENAI_MODEL: variables.has("OPENAI_MODEL"),
      SITE_URL: variables.has("SITE_URL"),
      BRIEF_ENCRYPTION_ENABLED: variables.has("BRIEF_ENCRYPTION_ENABLED"),
      OPENAI_WEB_SEARCH_ENABLED: variables.has("OPENAI_WEB_SEARCH_ENABLED"),
      MAX_SEARCH_CALLS: variables.has("MAX_SEARCH_CALLS"),
    },
  });
}

async function handleSave(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const payload = JSON.parse(await readBody(req)) as SavePayload;
  const errors = validatePayload(payload);
  if (errors.length) {
    sendJson(res, 400, { error: errors.join("\n") });
    return;
  }

  const saved = [
    setSecret("OPENAI_API_KEY", payload.openAiApiKey),
    setVariable("OPENAI_MODEL", payload.openAiModel || "gpt-4o-mini"),
    setSecret("FEISHU_WEBHOOK_URL", payload.feishuWebhookUrl),
    setSecret("FEISHU_SIGN_SECRET", payload.feishuSignSecret),
    setVariable("BRIEF_ENCRYPTION_ENABLED", payload.encryptionEnabled ? "true" : "false"),
    payload.encryptionEnabled ? setSecret("PAGE_ACCESS_PASSPHRASE", payload.pageAccessPassphrase) : null,
  ].filter(Boolean);

  let runUrl = "";
  if (payload.runAfterSave) {
    runGh(["workflow", "run", "daily-briefing.yml", "--repo", repository]);
    const latest = runGh(["run", "list", "--repo", repository, "--workflow", "daily-briefing.yml", "--limit", "1", "--json", "databaseId", "--jq", ".[0].databaseId"]);
    runUrl = latest ? `https://github.com/${repository}/actions/runs/${latest}` : workflowUrl;
  }

  sendJson(res, 200, {
    message: `保存成功。已写入：${saved.join("、") || "无新配置"}。密钥没有显示在页面或日志里。`,
    runUrl,
  });
}

function ensureGhAvailable(): void {
  const gh = spawnSync("gh", ["auth", "status"], { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (gh.status !== 0) {
    throw new Error("当前电脑没有可用的 GitHub 登录权限。请先在 Codex/GitHub 授权后再打开配置助手。");
  }
}

function openBrowser(url: string): void {
  if (process.platform === "darwin") {
    const child = spawn("open", [url], { detached: true, stdio: "ignore" });
    child.unref();
  }
}

async function main(): Promise<void> {
  ensureGhAvailable();
  const server = http.createServer((req, res) => {
    void (async () => {
      try {
        if (req.method === "GET" && req.url === "/") {
          res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
          res.end(pageHtml());
          return;
        }
        if (req.method === "GET" && req.url === "/status") {
          handleStatus(res);
          return;
        }
        if (req.method === "POST" && req.url === "/save") {
          await handleSave(req, res);
          return;
        }
        res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        res.end("Not found");
      } catch (error) {
        sendJson(res, 500, { error: error instanceof Error ? error.message : "未知错误" });
      }
    })();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  const url = `http://127.0.0.1:${port}/`;
  console.log(`[setup-wizard] ${url}`);
  console.log("[setup-wizard] keep this terminal running while you configure secrets");
  openBrowser(url);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "setup wizard failed");
  process.exit(1);
});
