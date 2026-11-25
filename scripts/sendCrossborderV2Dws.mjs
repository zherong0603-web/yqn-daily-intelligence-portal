import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const targetGroupName = "跨境咨询每日内容";
const successValues = new Set(["DELIVERED", "READ", "UNREAD"]);
const failureValues = new Set(["FAILED", "FAIL", "REJECTED", "INVALID", "BLOCKED", "ERROR", "CANCELLED", "CANCELED", "TIMEOUT"]);

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

export function readDwsDeliveryStatus(stdout) {
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error("Crossborder V2 DWS returned non-JSON output");
  }
  const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  if (!isRecord(parsed)) return { ok: false, status: "UNKNOWN" };
  // DWS --wait-delivery projects a deliveryStatus receipt. Only the direct
  // receipt or standard result envelope counts; message bodies/examples do not.
  // Source: DingTalk-Real-AI/dingtalk-workspace-cli internal/helpers/chat_delivery.go.
  const receipts = [parsed, ...(isRecord(parsed.result) ? [parsed.result] : [])];
  const normalized = (value) => typeof value === "string" ? value.trim().toUpperCase() : "";
  if (receipts.some((receipt) => receipt.success === false || receipt.ok === false
    || (receipt.error !== undefined && receipt.error !== null && receipt.error !== "" && receipt.error !== false))) {
    return { ok: false, status: "FAILED" };
  }
  for (const receipt of receipts) {
    for (const field of ["deliveryStatus", "readStatus", "sendStatus", "status"]) {
      const status = normalized(receipt[field]);
      if (failureValues.has(status)) return { ok: false, status };
    }
  }
  const states = receipts.flatMap((receipt) => ["deliveryStatus", "readStatus"]
    .filter((field) => Object.hasOwn(receipt, field)).map((field) => normalized(receipt[field])));
  // A contradictory or unknown receipt is not enough evidence to mark delivery.
  if (!states.length || states.some((state) => !successValues.has(state))) return { ok: false, status: "UNKNOWN" };
  return { ok: true, status: states.includes("READ") ? "READ" : states[0] };
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

const transientCodes = new Set(["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EAI_AGAIN", "ENOTFOUND", "NETWORK_TRANSIENT"]);

// Persist only fixed codes, never stdout, stderr, arguments, account data or URLs.
function safeFailureCode(error) {
  return transientCodes.has(error?.code) || error?.code === "BUDGET_EXHAUSTED" ? error.code : "CHECK_FAILED";
}

export function runDispatchCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8",
    timeout: options.timeout ?? 120_000,
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.error) {
    throw Object.assign(new Error("Crossborder child execution failed"), { code: safeFailureCode(result.error) });
  }
  if (result.status !== 0) {
    const error = new Error("Crossborder child command failed");
    // Classify locally; raw child output is deliberately not retained.
    const output = `${result.stdout || ""} ${result.stderr || ""}`;
    if (/ETIMEDOUT|ECONNRESET|EAI_AGAIN|ENOTFOUND|socket hang up|timed? ?out|HTTP (429|50[234])/i.test(output)) {
      error.code = "NETWORK_TRANSIENT";
    }
    throw error;
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

function normalizeDeliveryMarkdown(value) {
  return String(value).replace(/\s+/g, "");
}

function validateArtifacts({ cwd, date }) {
  const base = path.join(cwd, "data", "codex-shadow", date);
  const jsonFile = `${base}.crossborder-v2.json`;
  const generatedMarkdownFile = `${base}.crossborder-v2.md`;
  const reviewFile = `${base}.crossborder-v2.review.json`;
  const sourceFile = `${base}.source-checks.json`;
  const archiveFinalFile = path.join(cwd, "data", "codex-shadow", `${date}.crossborder-v4`, "06-final.md");
  const archiveDeliveryFile = path.join(cwd, "data", "codex-shadow", `${date}.crossborder-v4`, "06-delivery.md");
  const hasArchive = existsSync(archiveFinalFile) || existsSync(archiveDeliveryFile);
  if (hasArchive && (!existsSync(archiveFinalFile) || !existsSync(archiveDeliveryFile))) {
    throw new Error("Crossborder V4 archive must contain both 06-final.md and 06-delivery.md");
  }
  const markdownFile = hasArchive ? archiveDeliveryFile : generatedMarkdownFile;
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
  const markdown = readFileSync(markdownFile, "utf8");
  if (hasArchive) {
    const normalized = normalizeDeliveryMarkdown(markdown);
    const required = [
      ...brief.editorial.candidates.map((candidate) => candidate.title),
      brief.hooks.a,
      brief.hooks.b,
      brief.voiceover_body,
    ];
    const missing = required.find((value) => !normalized.includes(normalizeDeliveryMarkdown(value)));
    if (missing) throw new Error(`Crossborder V4 final markdown is missing approved content: ${missing.slice(0, 80)}`);
    const voiceoverSection = markdown.split(/^## 口播正文$/m)[1]?.split(/^## /m)[0] || "";
    if (!voiceoverSection.trim()) throw new Error("Crossborder V4 final markdown is missing the voiceover section");
    if (/https?:\/\//.test(voiceoverSection)) throw new Error("Crossborder V4 voiceover section must not contain links");
    if (/^\s*\|/m.test(markdown)) throw new Error("Crossborder V4 delivery markdown must not contain tables that DingTalk may drop");
    writeFileSync(generatedMarkdownFile, markdown, "utf8");
  }
  return { markdown, title: `跨境早知道 V4｜${date}` };
}

export function sendCrossborderV2Dws({
  argv = process.argv,
  cwd = process.cwd(),
  env = process.env,
  now = new Date(),
  execute = runDispatchCommand,
  log = console.log,
  monotonic = () => performance.now(),
  wait = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms),
} = {}) {
  const options = parseCrossborderV2DwsArgs(argv);
  const today = dateInShanghai(now);
  if (options.live && options.date !== today) {
    throw new Error(`Crossborder V2 live delivery date must be today (${today}), got ${options.date}`);
  }
  if (options.live && now.getTime() < Date.parse(`${today}T16:00:00+08:00`)) {
    throw new Error("Crossborder V4 live delivery opens at 16:00 Asia/Shanghai");
  }
  const stateFile = path.join(cwd, "logs", "automation", ".crossborder-v4-dws-group-state.json");
  // Stay below the existing continuation's 360-second parent timeout.
  const deadline = monotonic() + 300_000;
  const budget = () => {
    const remaining = Math.floor(deadline - monotonic());
    if (remaining <= 0) throw Object.assign(new Error("Crossborder dispatch execution budget exhausted"), { code: "BUDGET_EXHAUSTED" });
    return remaining;
  };
  const invoke = (command, args, callOptions) => execute(command, args, { ...callOptions, timeout: Math.min(120_000, budget()) });

  const briefFile = path.join(cwd, "data", "codex-shadow", `${options.date}.crossborder-v2.json`);
  const journal = path.join(cwd, "logs", "automation", `.crossborder-v4-dispatch-${options.date}.jsonl`);
  const record = (stage, status, attempt, code, extra = {}) => {
    mkdirSync(path.dirname(journal), { recursive: true });
    appendFileSync(journal, `${JSON.stringify({ date: options.date, mode: options.live ? "live" : "dry_run",
      checked_at: new Date().toISOString(), stage, status, attempt, ...(code ? { code } : {}), ...extra })}\n`, { mode: 0o600 });
  };
  const step = (stage, operation, recover = false) => {
    for (let attempt = 1; ; attempt++) {
      record(stage, "STARTED", attempt);
      const began = Date.now();
      try {
        const value = operation();
        record(stage, "PASSED", attempt);
        return value;
      } catch (error) {
        const code = safeFailureCode(error);
        let evidence = {};
        if (stage === "source_check") {
          try {
            const report = JSON.parse(readFileSync(path.join(cwd, "data", "codex-shadow", `${options.date}.source-checks.json`), "utf8"));
            // Never attribute an older report to a command that could not finish.
            if (report.date === options.date && Date.parse(report.checked_at) >= began && Date.parse(report.checked_at) <= Date.now()
              && Array.isArray(report.checks)) {
              evidence = { source_failures: report.checks.flatMap((check, index) => {
                if (check.ok !== false) return [];
                const text = String(check.error || "");
                const failure = /visible source date/.test(text) ? "VISIBLE_DATE_MISMATCH"
                  : /required evidence marker/.test(text) ? "EVIDENCE_MARKER_MISSING"
                  : /ECONNRESET|ENOTFOUND|EAI_AGAIN/.test(text) ? "NETWORK_TRANSIENT"
                  : /timeout|timed out/i.test(text) ? "TIMEOUT"
                  : /HTTP (429|502|503|504)\b/.test(text) ? "HTTP_TRANSIENT" : "SOURCE_CHECK_FAILED";
                return [{ index, code: failure }];
              }) };
            }
          } catch { /* A missing report is not evidence of a particular source failure. */ }
        }
        // Only read-only preflight can recover, and only before any send attempt.
        const prior = loadState(stateFile).dates[options.date]?.status;
        const failures = evidence.source_failures;
        const sourceRecoverable = !failures || (failures.length > 0 && failures.every(item => ["NETWORK_TRANSIENT", "TIMEOUT", "HTTP_TRANSIENT"].includes(item.code)));
        if (recover && options.live && transientCodes.has(code) && sourceRecoverable && attempt < 3 && !prior) {
          record(stage, "RETRYING", attempt, code, evidence);
          const delay = attempt === 1 ? 5000 : 15000;
          if (budget() <= delay) {
            record(stage, "FAILED", attempt, "BUDGET_EXHAUSTED", evidence);
            throw new Error("Crossborder dispatch execution budget exhausted");
          }
          wait(delay);
          continue;
        }
        record(stage, "FAILED", attempt, code, evidence);
        throw error;
      }
    }
  };
  step("build", () => invoke("npm", ["run", "crossborder:v2:build", "--", "--file", briefFile], { cwd, env }));
  step("source_check", () => invoke("npm", ["run", "crossborder:v2:source-check", "--", "--file", briefFile], {
    cwd,
    env: { ...env, CROSSBORDER_V2_SOURCE_CHECK_STRICT: "true" },
  }), true);
  const artifact = step("artifacts", () => validateArtifacts({ cwd, date: options.date }));

  let state = loadState(stateFile);
  const priorStatus = String(state.dates[options.date]?.status || "").toUpperCase();
  if (options.live && priorStatus === "DELIVERED") {
    log(`[crossborder-v4:dws-group] date=${options.date} already delivered; duplicate skipped`);
    return { status: "DELIVERED", duplicate: true };
  }
  if (options.live && priorStatus === "ATTEMPTED") {
    throw new Error("Crossborder V4 DWS blocked: a prior group attempt has no verified delivery");
  }

  step("authentication", () => {
    const output = invoke("dws", ["auth", "status", "-f", "json"], { cwd, env });
    let auth;
    try { auth = JSON.parse(output); }
    catch { throw new Error("Crossborder authentication response is not valid JSON"); }
    if (auth.authenticated !== true || auth.token_valid !== true) {
      throw new Error("Crossborder V4 DWS authentication required; run the QR login flow before delivery");
    }
  }, true);
  step("group_lookup", () => {
    const groupLookup = invoke("dws", ["chat", "search", "--query", targetGroupName, "-f", "json"], { cwd, env });
    assertUniqueDwsGroup(groupLookup);
  }, true);
  if (!options.live) {
    log(`[crossborder-v4:dws-group] date=${options.date} dry run validated; message not sent`);
    return { status: "DRY_RUN" };
  }

  // Preflight recovery may have waited; do not overwrite a newer delivery/attempt.
  state = loadState(stateFile);
  const latestStatus = String(state.dates[options.date]?.status || "").toUpperCase();
  if (latestStatus === "DELIVERED") {
    log(`[crossborder-v4:dws-group] date=${options.date} already delivered; duplicate skipped`);
    return { status: "DELIVERED", duplicate: true };
  }
  if (latestStatus === "ATTEMPTED") {
    throw new Error("Crossborder V4 DWS blocked: a prior group attempt has no verified delivery");
  }
  step("pre_send_budget", () => budget());
  const idempotencyKey = `crossborder-v4-group-${options.date}`;
  state.dates[options.date] = {
    status: "ATTEMPTED",
    attempted_at: new Date(now).toISOString(),
    idempotency_key: idempotencyKey,
    target: targetGroupName,
  };
  saveState(stateFile, state);

  const output = step("send", () => invoke("dws", [
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
  ], { cwd, env }));

  const delivery = step("delivery_receipt", () => {
    const receipt = readDwsDeliveryStatus(output);
    if (!receipt.ok) throw new Error(`Crossborder V4 DWS group delivery unconfirmed: ${receipt.status}`);
    return receipt;
  });
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
