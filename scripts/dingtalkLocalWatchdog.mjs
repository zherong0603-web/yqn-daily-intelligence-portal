#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = "zherong0603-web/yqn-daily-intelligence-portal";
const workflow = "dingtalk-morning-brief.yml";
const cwd = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const logDir = path.join(cwd, "logs");
const logPath = path.join(logDir, "dingtalk-local-watchdog.log");
const env = {
  ...process.env,
  PATH: [
    "/opt/homebrew/bin",
    "/usr/local/bin",
    "/usr/bin",
    "/bin",
    "/usr/sbin",
    "/sbin",
    process.env.PATH || "",
  ].join(":"),
};

function log(message) {
  mkdirSync(logDir, { recursive: true });
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  appendFileSync(logPath, `${line}\n`);
}

function gh(args, options = {}) {
  return execFileSync("gh", args, {
    cwd,
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  }).trim();
}

function shanghaiDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function shanghaiWeekday() {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    weekday: "short",
  }).format(new Date());
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function listRuns() {
  const raw = gh([
    "-R",
    repo,
    "run",
    "list",
    "--workflow",
    workflow,
    "--limit",
    "30",
    "--json",
    "databaseId,createdAt,event,status,conclusion,url",
  ]);
  return JSON.parse(raw || "[]");
}

function runsAfterMorningWindow(runs, date) {
  const expectedStart = new Date(`${date}T00:45:00.000Z`).getTime();
  return runs.filter((run) => new Date(run.createdAt).getTime() >= expectedStart);
}

function runLog(runId) {
  try {
    return gh(["-R", repo, "run", "view", String(runId), "--log"], { maxBuffer: 10 * 1024 * 1024 });
  } catch (error) {
    log(`unable to read run ${runId} log: ${error instanceof Error ? error.message : "unknown error"}`);
    return "";
  }
}

function hasFormalSend(run) {
  if (run.status !== "completed" || run.conclusion !== "success") return false;
  return runLog(run.databaseId).includes("[dingtalk:send] formal-group markdown message sent");
}

function activeRun(runs) {
  return runs.find((run) => ["queued", "requested", "waiting", "in_progress"].includes(run.status));
}

function notifyMac(title, message) {
  try {
    execFileSync("osascript", [
      "-e",
      `display notification ${JSON.stringify(message)} with title ${JSON.stringify(title)}`,
    ], { env, stdio: "ignore" });
  } catch {
    // Local desktop notification is best-effort only.
  }
}

async function waitForDispatchedRun(date, triggeredAt) {
  const deadline = Date.now() + 12 * 60 * 1000;
  while (Date.now() < deadline) {
    const candidates = runsAfterMorningWindow(listRuns(), date)
      .filter((run) => new Date(run.createdAt).getTime() >= triggeredAt - 60_000)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const latest = candidates[0];
    if (latest) {
      log(`watching run ${latest.databaseId}: ${latest.status}/${latest.conclusion || ""}`);
      if (latest.status === "completed") return latest;
    }
    await sleep(20_000);
  }
  return undefined;
}

async function main() {
  const explicitDate = process.argv[2];
  if (!explicitDate && ["Sat", "Sun"].includes(shanghaiWeekday())) {
    log("weekend in Asia/Shanghai; skip check");
    return;
  }
  const date = explicitDate || shanghaiDate();
  log(`checking YQN DingTalk brief for ${date}`);

  const morningRuns = runsAfterMorningWindow(listRuns(), date);
  const sent = morningRuns.find(hasFormalSend);
  if (sent) {
    log(`formal-group send already confirmed in run ${sent.databaseId}`);
    return;
  }

  const active = activeRun(morningRuns);
  if (active) {
    log(`run ${active.databaseId} is still ${active.status}; skip duplicate dispatch`);
    return;
  }

  const triggeredAt = Date.now();
  log("no confirmed formal-group send found; dispatching live dry_run=false fallback");
  gh([
    "-R",
    repo,
    "workflow",
    "run",
    workflow,
    "--ref",
    "main",
    "-f",
    "mode=live",
    "-f",
    `brief_date=${date}`,
    "-f",
    "dry_run=false",
  ]);

  const dispatched = await waitForDispatchedRun(date, triggeredAt);
  if (!dispatched) {
    const message = "已触发补发，但 12 分钟内未确认完成。请打开 GitHub Actions 检查。";
    log(message);
    notifyMac("YQN 晨报兜底未确认", message);
    process.exitCode = 1;
    return;
  }

  if (hasFormalSend(dispatched)) {
    log(`fallback send confirmed in run ${dispatched.databaseId}`);
    return;
  }

  const message = `补发 run ${dispatched.databaseId} 未确认正式群发送：${dispatched.conclusion || dispatched.status}`;
  log(message);
  notifyMac("YQN 晨报补发失败", message);
  process.exitCode = 1;
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "unknown error";
  log(`fatal: ${message}`);
  notifyMac("YQN 晨报兜底失败", message);
  process.exit(1);
});
