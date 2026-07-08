import { pathToFileURL } from "node:url";
import { writeJsonFile, readJsonFile } from "../utils/fs.js";
import { dataPath, DingtalkRuntimeConfig, readDingtalkRuntimeConfig, riskReportPath } from "./config.js";
import { DingtalkBrief, RiskFlag, validateDingtalkBrief } from "./schema.js";

const forbiddenWords = [
  "客户名称",
  "客户联系方式",
  "报价",
  "合同",
  "毛利",
  "内部成本",
  "未公开客户案例",
  "销售聊天记录",
  "私域客户明细",
  "内部项目路径",
  "API key",
  "apikey",
  "webhook",
  "secret",
  "个人副业",
  "个人赚钱",
  "OPC",
  "Codex",
  "用户个人叙事",
  "持续关注",
  "提升效率",
  "加强学习",
  "赋能业务",
  "值得重视",
  "市场变化明显",
];

export interface RiskCheckResult {
  ok: boolean;
  flags: RiskFlag[];
  riskTypes: string[];
}

function textForScan(brief: DingtalkBrief): string {
  return JSON.stringify({
    title: brief.title,
    one_liner: brief.one_liner,
    signals: brief.signals,
    action_list: brief.action_list,
  });
}

export function checkDingtalkBriefRisk(brief: DingtalkBrief): RiskCheckResult {
  const parsed = validateDingtalkBrief(brief);
  const flags = new Set<RiskFlag>(parsed.risk_flags);
  const riskTypes = new Set<string>();
  const scanText = textForScan(parsed).toLowerCase();

  if (parsed.signals.some((signal) => signal.is_sensitive)) {
    flags.add("sensitive_signal");
    riskTypes.add("sensitive_signal");
  }

  if (parsed.signals.some((signal) => !signal.source_url)) {
    flags.add("missing_source_url");
    riskTypes.add("missing_source_url");
  }

  if (parsed.signals.some((signal) => !signal.source_name.trim())) {
    flags.add("missing_source_name");
    riskTypes.add("missing_source_name");
  }

  if (parsed.signals.some((signal) => !signal.source_published_at.trim())) {
    flags.add("missing_source_published_at");
    riskTypes.add("missing_source_published_at");
  }

  for (const word of forbiddenWords) {
    if (scanText.includes(word.toLowerCase())) {
      flags.add("forbidden_content");
      riskTypes.add("forbidden_content");
      break;
    }
  }

  const lowConfidenceCount = parsed.signals.filter((signal) => signal.confidence_label === "low").length;
  if (lowConfidenceCount > 0) {
    flags.add("low_confidence");
    riskTypes.add("low_confidence");
  }

  return {
    ok: !flags.has("forbidden_content") && !flags.has("sensitive_signal") && !flags.has("missing_source_url"),
    flags: [...flags],
    riskTypes: [...riskTypes],
  };
}

export async function writeRiskReport(
  config: DingtalkRuntimeConfig,
  brief: DingtalkBrief,
  result: RiskCheckResult,
): Promise<void> {
  await writeJsonFile(riskReportPath(config), {
    date: brief.date,
    generated_at: new Date().toISOString(),
    ok: result.ok,
    risk_flags: result.flags,
    risk_types: result.riskTypes,
    note: "风险报告只记录风险类型，不写入原文敏感内容。",
  });
}

export { forbiddenWords };

export async function riskCheckCli(): Promise<void> {
  const config = readDingtalkRuntimeConfig();
  const brief = validateDingtalkBrief(await readJsonFile(dataPath(config)));
  const result = checkDingtalkBriefRisk(brief);
  await writeRiskReport(config, brief, result);
  console.log(JSON.stringify({
    ok: result.ok,
    risk_flags: result.flags,
    risk_types: result.riskTypes,
  }, null, 2));
  if (!result.ok) {
    throw new Error(`DingTalk send blocked by risk check: ${result.riskTypes.join(",") || "unknown risk"}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  riskCheckCli().catch((error) => {
    console.error(error instanceof Error ? error.message : "DingTalk risk check failed");
    process.exit(1);
  });
}
