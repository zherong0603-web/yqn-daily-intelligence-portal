import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const defaultExecutorIdFile = path.join(repoRoot, ".yqn-primary-executor-id");

function arg(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function dateInShanghai(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const valueOf = (type) => parts.find((part) => part.type === type)?.value || "";
  return `${valueOf("year")}-${valueOf("month")}-${valueOf("day")}`;
}

export function resolveExecutorId(env = process.env, executorIdFile = defaultExecutorIdFile) {
  if (Object.hasOwn(env, "YQN_EXECUTOR_ID")) {
    const executorId = String(env.YQN_EXECUTOR_ID || "").trim();
    if (!executorId) throw new Error("YQN_EXECUTOR_ID is blank; guarded dispatch stopped locally");
    return executorId;
  }

  let executorId;
  try {
    executorId = readFileSync(executorIdFile, "utf8").trim();
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      throw new Error(`Primary executor ID is missing; set YQN_EXECUTOR_ID or create ${path.basename(executorIdFile)}`);
    }
    throw error;
  }
  if (!executorId) throw new Error(`${path.basename(executorIdFile)} is blank; guarded dispatch stopped locally`);
  return executorId;
}

export function dispatchSellerProblemBrief({
  argv = process.argv,
  env = process.env,
  now = new Date(),
  cwd = process.cwd(),
  executorIdFile = defaultExecutorIdFile,
  execute = execFileSync,
  createDispatchId = () => randomUUID().slice(0, 8),
  log = console.log,
} = {}) {
  const executorId = resolveExecutorId(env, executorIdFile);
  log("[seller-brief:executor] authorization input loaded");

  const date = arg(argv, "--date") || dateInShanghai(now);
  const dryRun = arg(argv, "--dry-run") === "true";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
    throw new Error(`Invalid brief date: ${date}`);
  }
  const today = dateInShanghai(now);
  if (!dryRun && date !== today) throw new Error(`Formal dispatch date must be today (${today}), got ${date}`);
  const file = path.resolve(cwd, arg(argv, "--file") || `data/codex-shadow/${date}.seller-problem.json`);
  const brief = JSON.parse(readFileSync(file, "utf8"));
  if (brief.date !== date) throw new Error(`Brief date mismatch: expected ${date}, got ${brief.date}`);
  const briefB64 = Buffer.from(JSON.stringify(brief), "utf8").toString("base64");
  if (Buffer.byteLength(briefB64, "utf8") > 60_000) {
    throw new Error("Brief is too large for a safe workflow_dispatch payload");
  }
  const dispatchId = createDispatchId();
  const payload = {
    ref: "main",
    inputs: {
      brief_b64: briefB64,
      expected_date: date,
      dry_run: dryRun ? "true" : "false",
      dispatch_id: dispatchId,
      executor_id: executorId,
    },
  };

  execute("gh", [
    "api",
    "repos/zherong0603-web/yqn-daily-intelligence-portal/actions/workflows/dingtalk-seller-problem-send.yml/dispatches",
    "--method",
    "POST",
    "--input",
    "-",
  ], { input: JSON.stringify(payload), stdio: ["pipe", "inherit", "inherit"] });
  log(`[seller-brief:dispatch] date=${date} dispatch_id=${dispatchId} workflow dispatched`);
  return { date, dispatchId };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    dispatchSellerProblemBrief();
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Seller brief dispatch failed");
    process.exit(1);
  }
}
