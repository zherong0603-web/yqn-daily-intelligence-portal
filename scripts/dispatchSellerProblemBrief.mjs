import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const date = arg("--date") || new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const file = path.resolve(arg("--file") || `data/codex-shadow/${date}.seller-problem.json`);
const brief = JSON.parse(readFileSync(file, "utf8"));
if (brief.date !== date) throw new Error(`Brief date mismatch: expected ${date}, got ${brief.date}`);
const briefB64 = Buffer.from(JSON.stringify(brief), "utf8").toString("base64");
const payload = {
  ref: "main",
  inputs: {
    brief_b64: briefB64,
    expected_date: date,
    dry_run: arg("--dry-run") === "true" ? "true" : "false",
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
console.log(`[seller-brief:dispatch] date=${date} workflow dispatched`);
