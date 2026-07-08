import { pathToFileURL } from "node:url";
import { readJsonFile, writeJsonFile } from "../utils/fs.js";
import {
  DingtalkRuntimeConfig,
  archiveLinkCheckPath,
  dataPath,
  readDingtalkRuntimeConfig,
  validationReportPath,
} from "./config.js";
import {
  buildMessageTitle,
  briefHasTestData,
  countMessageCharacters,
  getArchiveUrl,
  renderDingtalkMarkdown,
} from "./renderMarkdown.js";
import { checkDingtalkBriefRisk, writeRiskReport } from "./riskCheck.js";
import { DingtalkBrief, RiskFlag, productName, validateDingtalkBrief } from "./schema.js";

export interface ArchiveLinkCheck {
  checked_at: string;
  ok: boolean;
  archive_url: string;
  http_status: number | null;
  contains_product_name: boolean;
  contains_date: boolean;
  fallback_text: string;
  warning?: string;
}

export interface ValidationReport {
  checked_at: string;
  ok: boolean;
  p0_passed: boolean;
  message_length: number;
  test_label_required: boolean;
  test_label_present: boolean;
  archive_link_ok: boolean;
  archive_link_safe_for_group: boolean;
  checks: Record<string, boolean>;
  risk_flags: RiskFlag[];
  blockers: string[];
}

export function shouldUseTestLabel(config: DingtalkRuntimeConfig, brief: DingtalkBrief): boolean {
  return !(brief.mode === "live" && config.formalGroupEnabled && !briefHasTestData(brief));
}

function hasDisplayableSourceDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

export async function checkArchiveLink(config: DingtalkRuntimeConfig, brief: DingtalkBrief): Promise<ArchiveLinkCheck> {
  const archiveUrl = getArchiveUrl(brief, config.publicBaseUrl);
  const base: ArchiveLinkCheck = {
    checked_at: new Date().toISOString(),
    ok: false,
    archive_url: archiveUrl,
    http_status: null,
    contains_product_name: false,
    contains_date: false,
    fallback_text: "归档暂未启用",
  };
  if (!archiveUrl) {
    return { ...base, warning: "PUBLIC_BASE_URL / PAGES_BASE_URL / SITE_URL 未配置，群内不发送归档链接。" };
  }
  try {
    const response = await fetch(archiveUrl, { method: "GET" });
    const body = await response.text();
    const containsProduct = body.includes(productName);
    const containsDate = body.includes(brief.date);
    const ok = response.status === 200 && containsProduct && containsDate;
    return {
      ...base,
      ok,
      http_status: response.status,
      contains_product_name: containsProduct,
      contains_date: containsDate,
      warning: ok ? undefined : "归档链接未通过 200 / 标题 / 日期校验，群内不发送该链接。",
    };
  } catch (error) {
    return {
      ...base,
      warning: `归档链接请求失败，群内不发送该链接：${error instanceof Error ? error.message : "unknown error"}`,
    };
  }
}

export async function runPreSendValidation(
  config = readDingtalkRuntimeConfig(),
): Promise<{ brief: DingtalkBrief; markdown: string; archive: ArchiveLinkCheck; report: ValidationReport }> {
  const brief = validateDingtalkBrief(await readJsonFile(dataPath(config)));
  const archive = await checkArchiveLink(config, brief);
  await writeJsonFile(archiveLinkCheckPath(config), archive);
  if (!archive.ok) console.warn(`::warning::${archive.warning || "archive link unavailable"}`);

  const testLabelRequired = shouldUseTestLabel(config, brief);
  const markdown = renderDingtalkMarkdown(brief, {
    publicBaseUrl: config.publicBaseUrl,
    archiveUrl: archive.archive_url,
    archiveAvailable: archive.ok,
    testLabel: testLabelRequired,
  });
  const risk = checkDingtalkBriefRisk(brief);
  await writeRiskReport(config, brief, risk);

  const messageLength = countMessageCharacters(markdown);
  const sourceUrlOk = brief.signals.every((signal) => Boolean(signal.source_url));
  const sourceNameOk = brief.signals.every((signal) => Boolean(signal.source_name.trim()));
  const sourceDateOk = brief.signals.every((signal) => hasDisplayableSourceDate(signal.source_published_at));
  const modeOk = brief.mode === "demo" || brief.mode === "live";
  const testLabelPresent = markdown.includes(buildMessageTitle(brief, true));
  const testLabelOk = !testLabelRequired || testLabelPresent;
  const noSensitiveInfo = !brief.signals.some((signal) => signal.is_sensitive);
  const noForbiddenDisplay = !markdown.includes("是否敏感：")
    && !markdown.includes("置信度：")
    && !markdown.includes("[查看来源]")
    && !/%/.test(markdown);
  const archiveSafeForGroup = archive.ok || markdown.includes("归档暂未启用");
  const messageLengthOk = messageLength <= 1200;
  const checks = {
    schema: true,
    forbidden_words: risk.ok,
    source_url: sourceUrlOk,
    source_name: sourceNameOk,
    source_published_at: sourceDateOk,
    archive_url: archiveSafeForGroup,
    message_length: messageLengthOk,
    mode: modeOk,
    test_label: testLabelOk,
    no_sensitive_info: noSensitiveInfo,
    no_forbidden_display: noForbiddenDisplay,
  };
  const blockers = Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => name);
  const report: ValidationReport = {
    checked_at: new Date().toISOString(),
    ok: blockers.length === 0,
    p0_passed: blockers.length === 0,
    message_length: messageLength,
    test_label_required: testLabelRequired,
    test_label_present: testLabelOk,
    archive_link_ok: archive.ok,
    archive_link_safe_for_group: archiveSafeForGroup,
    checks,
    risk_flags: risk.flags,
    blockers,
  };
  await writeJsonFile(validationReportPath(config), report);
  if (!report.ok) {
    throw new Error(`DingTalk send blocked by validation: ${blockers.join(",")}`);
  }
  return { brief, markdown, archive, report };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runPreSendValidation().then(({ report }) => {
    console.log(JSON.stringify({
      ok: report.ok,
      message_length: report.message_length,
      archive_link_ok: report.archive_link_ok,
      blockers: report.blockers,
    }, null, 2));
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : "DingTalk validation failed");
    process.exit(1);
  });
}
