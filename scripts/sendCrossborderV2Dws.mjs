import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const targetGroupName = "跨境咨询每日内容";
const successValues = new Set(["DELIVERED", "READ", "UNREAD"]);
const failureValues = new Set(["FAILED", "FAIL", "REJECTED", "INVALID", "BLOCKED"]);

function dateInShanghai(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const valueOf = (type) => parts.find((item) => item.type === type)?.value || "";
  return `${valueOf("year")}-${valueOf("month")}-${valueOf("day")}`;
}

export function parseCrossborderV2DwsArgs(argv) {
  const args = argv.slice(2);
  const dateIndexes = args.flatMap((value, index) => value === "--date" ? [index] : []);
  if (dateIndexes.length !== 1) throw new Error("Crossborder V2 DWS requires exactly one --date argument");
  const liveIndexes = args.flatMap((value, index) => value === "--live" ? [index] : []);
  if (liveIndexes.length > 1) throw new Error("Crossborder V2 DWS accepts --live at most once");
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--live") continue;
    if (args[index] === "--date") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new Error("Crossborder V2 DWS requires a date value");
      index += 1;
      continue;
    }
    throw new Error(`Unsupported Crossborder V2 DWS argument: ${args[index]}`);
  }
  const date = args[dateIndexes[0] + 1];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
    throw new Error(`Invalid brief date: ${date}`);
  }
  return { date, live: liveIndexes.length === 1 };
}

function collectStrings(value, output = []) {
  if (typeof value === "string") output.push(value);
  else if (Array.isArray(value)) for (const item of value) collectStrings(item, output);
  else if (value && typeof value === "object") for (const item of Object.values(value)) collectStrings(item, output);
  return output;
}

export function readDwsDeliveryStatus(stdout) {
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error("Crossborder V2 DWS returned non-JSON output");
  }
  const values = collectStrings(parsed).map((value) => value.toUpperCase());
  const status = values.find((value) => successValues.has(value) || failureValues.has(value)) || "UNKNOWN";
  return { ok: successValues.has(status), status };
}

export function assertUniqueDwsGroup(stdout, expectedTitle = targetGroupName) {
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error("Crossborder V4 DWS group lookup returned non-JSON output");
  }
  if (parsed?.success !== true || !Array.isArray(parsed?.result?.groups)) {
    throw new Error("Crossborder V4 DWS group lookup failed");
  }
  const matches = parsed.result.groups.filter((group) => group?.title === expectedTitle);
  if (matches.length !== 1) {
    throw new Error(`Crossborder V4 DWS requires exactly one group named ${expectedTitle}`);
  }
  return true;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8",
    timeout: options.timeout ?? 120_000,
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    let detail = "";
    try {
      const error = JSON.parse(result.stdout || result.stderr)?.error;
      detail = [error?.category, error?.message].filter(Boolean).join(": ");
    } catch {
      detail = "command failed";
    }
    throw new Error(`${command} ${args[0] || ""} failed${detail ? `: ${detail}` : ""}`.trim());
  }
  return result.stdout || "";
}

function loadState(file) {
  if (!existsSync(file)) return { dates: {} };
  const parsed = JSON.parse(readFileSync(file, "utf8"));
  return parsed && typeof parsed === "object" && parsed.dates ? parsed : { dates: {} };
}

function saveState(file, state) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
}

function validateArtifacts({ cwd, date }) {
  const base = path.join(cwd, "data", "codex-shadow", date);
  const jsonFile = `${base}.crossborder-v2.json`;
  const markdownFile = `${base}.crossborder-v2.md`;
  const reviewFile = `${base}.crossborder-v2.review.json`;
  const sourceFile = `${base}.source-checks.json`;
  for (const file of [jsonFile, markdownFile, reviewFile, sourceFile]) {
    if (!existsSync(file)) throw new Error(`Missing Crossborder V2 artifact: ${path.relative(cwd, file)}`);
  }
  const brief = JSON.parse(readFileSync(jsonFile, "utf8"));
  const review = JSON.parse(readFileSync(reviewFile, "utf8"));
  const source = JSON.parse(readFileSync(sourceFile, "utf8"));
  if (brief.format_version !== "v2" || brief.date !== date) throw new Error("Crossborder V2 brief date or format mismatch");
  if (review.content_valid !== true || review.date !== date || (review.automated_blockers || []).length > 0) {
    throw new Error("Crossborder V2 review is not send-ready");
  }
  if (source.all_ok !== true || source.date !== date || source.failed_count !== 0) {
    throw new Error("Crossborder V2 source checks are not all green");
  }
  return { markdown: readFileSync(markdownFile, "utf8"), title: `跨境早知道 V4｜${date}` };
}

export function sendCrossborderV2Dws({
  argv = process.argv,
  cwd = process.cwd(),
  env = process.env,
  now = new Date(),
  execute = run,
  log = console.log,
} = {}) {
  const options = parseCrossborderV2DwsArgs(argv);
  const today = dateInShanghai(now);
  if (options.live && options.date !== today) {
    throw new Error(`Crossborder V2 live delivery date must be today (${today}), got ${options.date}`);
  }
  const stateFile = path.join(cwd, "logs", "automation", ".crossborder-v4-dws-group-state.json");
  const briefFile = path.join(cwd, "data", "codex-shadow", `${options.date}.crossborder-v2.json`);
  execute("npm", ["run", "crossborder:v2:build", "--", "--file", briefFile], { cwd, env });
  execute("npm", ["run", "crossborder:v2:source-check", "--", "--file", briefFile], {
    cwd,
    env: { ...env, CROSSBORDER_V2_SOURCE_CHECK_STRICT: "true" },
  });
  const artifact = validateArtifacts({ cwd, date: options.date });

  const state = loadState(stateFile);
  const priorStatus = String(state.dates[options.date]?.status || "").toUpperCase();
  if (options.live && priorStatus === "DELIVERED") {
    log(`[crossborder-v4:dws-group] date=${options.date} already delivered; duplicate skipped`);
    return { status: "DELIVERED", duplicate: true };
  }
  if (options.live && priorStatus === "ATTEMPTED") {
    throw new Error("Crossborder V4 DWS blocked: a prior group attempt has no verified delivery");
  }

  const auth = JSON.parse(execute("dws", ["auth", "status", "-f", "json"], { cwd, env }));
  if (auth.authenticated !== true || auth.token_valid !== true) {
    throw new Error("Crossborder V4 DWS authentication required; run the QR login flow before delivery");
  }
  const groupLookup = execute("dws", ["chat", "search", "--query", targetGroupName, "-f", "json"], { cwd, env });
  assertUniqueDwsGroup(groupLookup);
  if (!options.live) {
    log(`[crossborder-v4:dws-group] date=${options.date} dry run validated; message not sent`);
    return { status: "DRY_RUN" };
  }

  const idempotencyKey = `crossborder-v4-group-${options.date}`;
  state.dates[options.date] = {
    status: "ATTEMPTED",
    attempted_at: new Date(now).toISOString(),
    idempotency_key: idempotencyKey,
    target: targetGroupName,
  };
  saveState(stateFile, state);

  const output = execute("dws", [
    "chat", "+messages-send",
    "--identity", "user",
    "--chat-query", targetGroupName,
    "--markdown", artifact.markdown,
    "--title", artifact.title,
    "--idempotency-key", idempotencyKey,
    "--wait-delivery",
    "--ai-tag=false",
    "-y",
    "-f", "json",
  ], { cwd, env });

  const delivery = readDwsDeliveryStatus(output);
  if (!delivery.ok) throw new Error(`Crossborder V4 DWS group delivery unconfirmed: ${delivery.status}`);
  state.dates[options.date] = {
    ...state.dates[options.date],
    status: "DELIVERED",
    delivery_status: delivery.status,
    delivered_at: new Date().toISOString(),
  };
  saveState(stateFile, state);
  const logFile = path.join(cwd, "logs", "automation", "yqn-2.md");
  mkdirSync(path.dirname(logFile), { recursive: true });
  appendFileSync(logFile, `\n- ${new Date(now).toISOString()}：\`[crossborder-v4:dws-group-delivered]\` date=${options.date} status=${delivery.status}\n`, "utf8");
  log(`[crossborder-v4:dws-group-delivered] date=${options.date} status=${delivery.status}`);
  return { status: delivery.status, duplicate: false };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  try {
    sendCrossborderV2Dws();
  } catch (error) {
    console.error(`[crossborder-v2:dws-error] ${error instanceof Error ? error.message : "delivery failed"}`);
    process.exit(1);
  }
}
