import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { renderDingtalkMarkdown } from "./renderMarkdown.js";
import { DingtalkBrief, dingtalkBriefSchema } from "./schema.js";

const shadowPurpose = "codex_shadow_only" as const;
const officialHostSuffixes = [
  ".gov",
  ".gob.mx",
  ".amazon.com",
  ".amazon.com.mx",
  ".fedex.com",
  ".mercadolibre.com",
  ".mercadolibre.com.mx",
  ".tiktok.com",
  ".ups.com",
  ".usps.com",
  ".walmart.com",
];

export interface CodexShadowValidationReport {
  date: string;
  purpose: typeof shadowPurpose;
  valid: boolean;
  send_allowed: false;
  counts: {
    us_warehouse: number;
    mexico_warehouse: number;
    us_mexico_bridge: number;
  };
  blockers: string[];
  checked_at: string;
}

function isOfficialUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return officialHostSuffixes.some((suffix) => host === suffix.slice(1) || host.endsWith(suffix));
  } catch {
    return false;
  }
}

function countFocus(brief: DingtalkBrief, focus: DingtalkBrief["signals"][number]["market_focus"]): number {
  return brief.signals.filter((signal) => signal.market_focus === focus).length;
}

export function validateCodexShadowBrief(input: unknown, checkedAt = new Date().toISOString()): {
  brief?: DingtalkBrief;
  report: CodexShadowValidationReport;
} {
  const parsed = dingtalkBriefSchema.safeParse(input);
  if (!parsed.success) {
    const date = z.object({ date: z.string() }).safeParse(input);
    return {
      report: {
        date: date.success ? date.data.date : "unknown",
        purpose: shadowPurpose,
        valid: false,
        send_allowed: false,
        counts: { us_warehouse: 0, mexico_warehouse: 0, us_mexico_bridge: 0 },
        blockers: parsed.error.issues.map((issue) => `schema:${issue.path.join(".")}:${issue.message}`),
        checked_at: checkedAt,
      },
    };
  }

  const brief = parsed.data;
  const counts = {
    us_warehouse: countFocus(brief, "us_warehouse"),
    mexico_warehouse: countFocus(brief, "mexico_warehouse"),
    us_mexico_bridge: countFocus(brief, "us_mexico_bridge"),
  };
  const blockers: string[] = [];

  if (counts.us_warehouse !== 2) blockers.push(`ratio:us_warehouse:${counts.us_warehouse}`);
  if (counts.mexico_warehouse !== 2) blockers.push(`ratio:mexico_warehouse:${counts.mexico_warehouse}`);
  if (counts.us_mexico_bridge !== 1) blockers.push(`ratio:us_mexico_bridge:${counts.us_mexico_bridge}`);
  if (brief.mode !== "live") blockers.push("mode:must_be_live");
  if (brief.risk_flags.length > 0) blockers.push("risk_flags:must_be_empty");

  const seenUrls = new Set<string>();
  brief.signals.forEach((signal, index) => {
    if (signal.value_score < 70) blockers.push(`signal:${index}:value_score_below_70`);
    if (signal.confidence_label !== "high") blockers.push(`signal:${index}:confidence_not_high`);
    if (signal.is_test_data) blockers.push(`signal:${index}:test_data_forbidden`);
    if (signal.is_sensitive) blockers.push(`signal:${index}:sensitive_data_forbidden`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(signal.source_published_at)) {
      blockers.push(`signal:${index}:published_date_not_iso`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(signal.effective_at)) {
      blockers.push(`signal:${index}:effective_date_not_iso`);
    }
    if (!isOfficialUrl(signal.source_url)) blockers.push(`signal:${index}:source_not_official_allowlist`);
    if (seenUrls.has(signal.source_url)) blockers.push(`signal:${index}:duplicate_source_url`);
    seenUrls.add(signal.source_url);
  });

  brief.sources.forEach((source, index) => {
    if (source.source_type !== "official") blockers.push(`source:${index}:source_type_not_official`);
    if (!isOfficialUrl(source.url)) blockers.push(`source:${index}:url_not_official_allowlist`);
  });

  return {
    brief,
    report: {
      date: brief.date,
      purpose: shadowPurpose,
      valid: blockers.length === 0,
      send_allowed: false,
      counts,
      blockers,
      checked_at: checkedAt,
    },
  };
}

function readArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

export function renderCodexShadowMarkdown(brief: DingtalkBrief): string {
  const rendered = renderDingtalkMarkdown(brief, { testLabel: true, archiveAvailable: false });
  return rendered
    .replace("# 【测试版】", "# 【Codex影子预览·不发送】")
    .replace(
      "完整归档：归档暂未启用",
      "运行状态：仅用于专家验证，未连接钉钉发送链路",
    );
}

async function main(): Promise<void> {
  const file = readArg("--file");
  if (!file) throw new Error("Usage: npm run codex:shadow:build -- --file <brief.json>");

  const absoluteFile = path.resolve(file);
  const parsed = JSON.parse(await readFile(absoluteFile, "utf8")) as unknown;
  const { brief, report } = validateCodexShadowBrief(parsed);
  const reportPath = absoluteFile.replace(/\.json$/i, ".validation.json");
  await mkdir(path.dirname(absoluteFile), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  if (!brief || !report.valid) {
    throw new Error(`Codex shadow validation failed: ${report.blockers.join(", ")}`);
  }

  const markdownPath = absoluteFile.replace(/\.json$/i, ".md");
  await writeFile(markdownPath, `${renderCodexShadowMarkdown(brief)}\n`, "utf8");
  console.log(`[codex:shadow] validated ${brief.date}; send_allowed=false`);
  console.log(`[codex:shadow] markdown ${markdownPath}`);
  console.log(`[codex:shadow] report ${reportPath}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Codex shadow build failed");
    process.exit(1);
  });
}
