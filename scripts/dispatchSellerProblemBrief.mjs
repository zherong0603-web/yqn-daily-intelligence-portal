import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
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

const date = arg("--date") || dateInShanghai();
const dryRun = arg("--dry-run") === "true";
if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
  throw new Error(`Invalid brief date: ${date}`);
}
const today = dateInShanghai();
if (!dryRun && date !== today) throw new Error(`Formal dispatch date must be today (${today}), got ${date}`);
const file = path.resolve(arg("--file") || `data/codex-shadow/${date}.seller-problem.json`);
const brief = JSON.parse(readFileSync(file, "utf8"));
if (brief.date !== date) throw new Error(`Brief date mismatch: expected ${date}, got ${brief.date}`);
const briefB64 = Buffer.from(JSON.stringify(brief), "utf8").toString("base64");
if (Buffer.byteLength(briefB64, "utf8") > 60_000) {
  throw new Error("Brief is too large for a safe workflow_dispatch payload");
}
const dispatchId = randomUUID().slice(0, 8);
const payload = {
  ref: "main",
  inputs: {
    brief_b64: briefB64,
    expected_date: date,
    dry_run: dryRun ? "true" : "false",
    dispatch_id: dispatchId,
  },
};

execFileSync("gh", [
  "api",
  "repos/zherong0603-web/yqn-daily-intelligence-portal/actions/workflows/dingtalk-seller-problem-send.yml/dispatches",
  "--method",
  "POST",
  "--input",
  "-",
], { input: JSON.stringify(payload), stdio: ["pipe", "inherit", "inherit"] });
console.log(`[seller-brief:dispatch] date=${date} dispatch_id=${dispatchId} workflow dispatched`);
