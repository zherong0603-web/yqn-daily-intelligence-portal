import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { readEnv } from "../utils/env.js";
import {
  validateCrossborderV2Brief,
  verifyCrossborderV2Sources,
} from "./buildSellerProblemBrief.js";

function readArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function readInput(): Promise<unknown> {
  const encoded = readEnv("SELLER_BRIEF_JSON_B64");
  if (encoded) return JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) as unknown;
  const file = readArg("--file");
  if (!file) throw new Error("Usage: npm run crossborder:v2:source-check -- --file <brief.json>");
  return JSON.parse(await readFile(path.resolve(file), "utf8")) as unknown;
}

async function main(): Promise<void> {
  const input = await readInput();
  const { brief, report } = validateCrossborderV2Brief(input);
  if (!brief || !report.content_valid) throw new Error(`Crossborder V2 blocked before source check: ${report.automated_blockers.join(", ")}`);
  const checks = await verifyCrossborderV2Sources(brief);
  const failed = checks.filter((check) => !check.ok);
  const result = {
    date: brief.date,
    checked_at: new Date().toISOString(),
    all_ok: failed.length === 0,
    checked_count: checks.length,
    failed_count: failed.length,
    checks,
  };
  const file = readArg("--file");
  if (file) {
    const output = path.join(path.dirname(path.resolve(file)), `${brief.date}.source-checks.json`);
    await writeFile(output, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  }
  console.log(JSON.stringify({
    all_ok: result.all_ok,
    checked_count: result.checked_count,
    failed_count: result.failed_count,
    failures: failed.map((check) => ({ url: check.url, error: check.error })),
  }, null, 2));
  if (readEnv("CROSSBORDER_V2_SOURCE_CHECK_STRICT") === "true" && failed.length > 0) {
    throw new Error(`Crossborder V2 blocked: ${failed.length} source checks failed`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Crossborder V2 source check failed");
    process.exit(1);
  });
}
