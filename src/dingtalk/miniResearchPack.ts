import { access } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { readJsonFile, writeJsonFile, writeTextFile } from "../utils/fs.js";
import { readDingtalkRuntimeConfig, sourceReportPath } from "./config.js";

interface SourceReportCandidate {
  title: string;
  url: string;
  source_name: string;
  source_published_at: string;
  market_focus: string;
  score: number;
  account_opening_score?: number;
  score_reasons?: string[];
  business_value_reasons?: string[];
}

interface SourceReport {
  date: string;
  generated_at: string;
  source_window_hours: 72 | 168;
  source_count_before_window: number;
  source_errors: Array<{ source_name: string; reason: string }>;
  candidates: SourceReportCandidate[];
}

function packJsonPath(repoRoot: string, date: string): string {
  return path.join(repoRoot, "data", "dingtalk-briefs", `${date}.mini_research_pack.json`);
}

function packMarkdownPath(repoRoot: string, date: string): string {
  return path.join(repoRoot, "data", "dingtalk-briefs", `${date}.mini_research_pack.md`);
}

function marketLabel(value: string): string {
  const labels: Record<string, string> = {
    us_warehouse: "美仓/北美履约",
    mexico_warehouse: "墨仓/美墨链路",
    domestic_seller: "国内跨境卖家",
    platform: "平台卖家",
    global: "全球/综合",
  };
  return labels[value] || value;
}

function renderMarkdown(report: SourceReport, selected: SourceReportCandidate[]): string {
  const lines = [
    `# YQN 每日 5 分钟 06:00 候选资料包｜${report.date}`,
    "",
    `来源窗口：${report.source_window_hours} 小时`,
    `采集候选：${report.source_count_before_window} 条`,
    `采集异常：${report.source_errors.length} 个`,
    "",
    "## 高优先级候选",
    "",
  ];

  selected.forEach((candidate, index) => {
    lines.push(`${index + 1}. ${candidate.title}`);
    lines.push(`   - 来源：${candidate.source_name}｜${candidate.source_published_at}`);
    lines.push(`   - 方向：${marketLabel(candidate.market_focus)}`);
    lines.push(`   - 开户相关性：${candidate.account_opening_score ?? candidate.score}`);
    lines.push(`   - 理由：${[...(candidate.business_value_reasons || []), ...(candidate.score_reasons || [])].slice(0, 4).join("、") || "公开来源候选"}`);
    lines.push(`   - 链接：${candidate.url}`);
    lines.push("");
  });

  lines.push("## 使用规则");
  lines.push("");
  lines.push("- 只作为正式晨报候选资料，不直接发群。");
  lines.push("- 正式发送仍由 GitHub Actions 在 08:45 执行。");
  lines.push("- 如果 08:45 未触发，09:05 watchdog 会补跑 live dry_run=false。");
  return lines.join("\n");
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function writeMiniResearchPack(config = readDingtalkRuntimeConfig()): Promise<void> {
  const reportPath = sourceReportPath(config);
  if (!await fileExists(reportPath)) {
    console.warn("[dingtalk:mini-pack] source_report.json not found; mini research pack skipped");
    return;
  }

  const report = await readJsonFile<SourceReport>(reportPath);
  const selected = [...report.candidates]
    .sort((a, b) => {
      const openingDiff = (b.account_opening_score ?? b.score) - (a.account_opening_score ?? a.score);
      if (openingDiff !== 0) return openingDiff;
      return b.score - a.score;
    })
    .slice(0, 12);

  const payload = {
    date: report.date,
    generated_at: new Date().toISOString(),
    purpose: "06:00 preflight research pack; official DingTalk send remains controlled by GitHub Actions.",
    source_window_hours: report.source_window_hours,
    source_count_before_window: report.source_count_before_window,
    source_errors: report.source_errors,
    candidates: selected,
  };
  await writeJsonFile(packJsonPath(config.repoRoot, config.date), payload);
  await writeTextFile(packMarkdownPath(config.repoRoot, config.date), renderMarkdown(report, selected));
  console.log(`[dingtalk:mini-pack] wrote ${selected.length} candidates for ${config.date}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeMiniResearchPack().catch((error) => {
    console.error(error instanceof Error ? error.message : "DingTalk mini research pack failed");
    process.exit(1);
  });
}
