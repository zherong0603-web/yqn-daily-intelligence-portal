import OpenAI from "openai";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import YAML from "yaml";
import { writeTextFile, writeJsonFile } from "../utils/fs.js";
import { collectDingtalkSources } from "./collectSources.js";
import {
  dataPath,
  markdownPath,
  readDingtalkRuntimeConfig,
  DingtalkRuntimeConfig,
  sourceReportPath,
} from "./config.js";
import {
  collectDingtalkRealSignals,
  DingtalkNewsCandidate,
  DingtalkRealSignalCollection,
} from "./collectRealSignals.js";
import { collectMandatoryWebResearch, WebSearchAudit } from "./webResearch.js";
import { renderDingtalkMarkdown } from "./renderMarkdown.js";
import { buildSampleBrief } from "./sampleBrief.js";
import {
  DingtalkBrief,
  DingtalkSourceConfig,
  SignalCategory,
  dingtalkBriefJsonSchema,
  productName,
  validateDingtalkBrief,
} from "./schema.js";

function extractOutputText(response: unknown): string {
  const candidate = response as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
  if (typeof candidate.output_text === "string" && candidate.output_text.trim()) return candidate.output_text;
  const text = candidate.output?.flatMap((item) => item.content || []).map((content) => content.text).filter(Boolean).join("\n");
  if (text) return text;
  throw new Error("OpenAI response did not contain text output");
}

function coerceJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
    throw new Error("model output was not parseable JSON");
  }
}

function mergeCandidates(candidates: DingtalkNewsCandidate[]): DingtalkNewsCandidate[] {
  const seen = new Set<string>();
  return candidates
    .slice()
    .sort((a, b) => b.value_score - a.value_score || b.published_at_iso.localeCompare(a.published_at_iso))
    .filter((candidate) => {
      const key = candidate.url.replace(/\/$/, "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function buildLivePrompt(
  config: DingtalkRuntimeConfig,
  sources: DingtalkSourceConfig[],
  candidates: DingtalkNewsCandidate[],
  businessKnowledge: unknown,
): string {
  const promptCandidates = promptCandidateList(candidates);
  return JSON.stringify({
    date: config.date,
    title: `${productName}｜${config.date}`,
    role: "你是 YQN 北美跨境电商物流情报编辑。你必须从卖家成本、时效、合规、库存和订单履约判断信息价值。",
    format: "固定 1+5：1条专家判断、2条美国、2条墨西哥、1条美墨联动。",
    hard_rules: [
      "只输出符合 schema 的 JSON，不输出 Markdown。",
      "one_liner 必须 30 字以内，说明今天最值得 YQN 团队花 5 分钟看的判断。",
      "signals 必须使用给出的5个 candidates 各一次：2条 us_warehouse、2条 mexico_warehouse、1条 us_mexico_bridge。",
      "每条 value_score 必须至少70，不能使用低分候选或其他地区新闻填空。",
      "每条 signal 必须写发生事实、生效时间、受影响卖家、影响环节、卖家检查项和 YQN 可承接需求。",
      "impact_stages 只能从 first_mile、warehousing、last_mile 选择。",
      "政策类信息 effective_at 必须是 YYYY-MM-DD 的明确日期。",
      "每条 signal 必须有 source_name、source_url、source_published_at、effective_at、market_focus、affected_sellers、impact_stages、seller_check、value_score、collected_at、info_region、info_type、confidence_label、is_test_data、source_summary。",
      "source_url 只能使用 candidates 里的 url；source_name 必须使用对应 candidate 的 source_name。",
      `source_published_at 必须写 YYYY-MM-DD；如果来源没有发布日期，写当天日期 ${config.date}，不要写“来源未注明日期”。`,
      "collected_at 必须是 ISO datetime。",
      "confidence_label 只能是 high、medium、low，不得输出百分比。",
      "倒金字塔：发生了什么先写最重要事实。",
      "5W1H：每条至少明确谁、何时、发生什么、为什么影响。",
      "事实和判断分开：发生了什么只写事实；为什么重要只写影响；YQN 可用点只写业务看法。",
      "不允许使用空话：持续关注、提升效率、加强学习、赋能业务、值得重视、市场变化明显。除非后面有具体动作。",
      "不允许把模型判断伪装成事实。",
      "不得出现客户名单、客户联系方式、报价、合同、毛利、内部成本、未公开客户案例、销售聊天记录、私域客户明细。",
      "不得出现 Codex、OPC、个人副业、个人赚钱、用户个人叙事。",
      "只写公开信号和 YQN 可公开表达的业务动作；任何需要登录、后台、客户数据的来源不得进入群版。",
      "资料不足时不得编造或使用 low 置信度，生成流程会直接阻断发送。",
      "live 模式必须基于 candidates 的真实公开条目；is_test_data 必须为 false。",
    ],
    business_knowledge: businessKnowledge,
    sources: sources.map((source) => ({
      title: source.title,
      url: source.url,
      category: source.category,
      source_type: source.source_type,
      auto_fetch: source.auto_fetch,
      sample_summary: source.sample_summary || "",
    })),
    candidates: promptCandidates.map((candidate, index) => ({
      id: index + 1,
      title: candidate.title,
      url: candidate.url,
      source_name: candidate.source_name,
      source_published_at: candidate.source_published_at,
      published_at_iso: candidate.published_at_iso,
      category_hint: candidate.source_category,
      market_focus: candidate.market_focus,
      score: candidate.score,
      account_opening_score: candidate.account_opening_score,
      value_score: candidate.value_score,
      effective_at: candidate.effective_at,
      affected_sellers: candidate.affected_sellers,
      impact_stages: candidate.impact_stages,
      seller_check: candidate.seller_check,
      score_reasons: candidate.score_reasons,
      business_value_reasons: candidate.business_value_reasons,
      summary: candidate.summary,
    })),
  });
}

async function loadBusinessKnowledge(repoRoot: string): Promise<unknown> {
  const knowledgePath = path.join(repoRoot, "knowledge", "yqn-capabilities.yaml");
  return YAML.parse(await readFile(knowledgePath, "utf8"));
}

function ensureSignalDiversity(brief: DingtalkBrief): void {
  const counts = new Map<SignalCategory, number>();
  for (const signal of brief.signals) {
    counts.set(signal.category, (counts.get(signal.category) || 0) + 1);
  }
  if (counts.size < 2) {
    throw new Error("schema validation failed: signals must cover at least 2 categories");
  }
}

function clipText(value: string, max: number): string {
  const text = value.replace(/\s+/g, " ").trim();
  if (Array.from(text).length <= max) return text;
  return `${Array.from(text).slice(0, Math.max(0, max - 1)).join("")}…`;
}

function textOf(candidate: DingtalkNewsCandidate): string {
  return `${candidate.title} ${candidate.summary}`.toLowerCase();
}

function isMexicoOrLatamCandidate(candidate: DingtalkNewsCandidate): boolean {
  const text = textOf(candidate);
  return candidate.market_focus === "mexico_warehouse"
    || /mexico|mexican|usmca|nearshoring|laredo|monterrey|墨西哥|墨仓|美墨|近岸|拉美|美客多|mercado\s*libre|mercadolibre|巴西/i.test(text);
}

function isExplicitNonNorthAmericaCandidate(candidate: DingtalkNewsCandidate): boolean {
  const text = textOf(candidate);
  return /东南亚|欧英|欧洲|欧盟|英国|泰国|马来西亚|越南|印尼|俄罗斯|俄电商|lazada|shopee|sendo|thaimart/i.test(text);
}

function promptCandidateList(candidates: DingtalkNewsCandidate[]): DingtalkNewsCandidate[] {
  return candidates.slice(0, 5);
}

function categoryForCandidate(candidate: DingtalkNewsCandidate): SignalCategory {
  const text = textOf(candidate);
  if (isMexicoOrLatamCandidate(candidate)) return "yqn_view";
  if (/亚马逊|tiktok|美客多|lazada|shopee|temu|shein|wayfair|buy box|fba|fbt|prime|平台|店铺|大促|黑五|旺季/i.test(text)) return "platform";
  if (/清关|海关|关税|efiling|cpsc|低值|小包|美线|合规大洗牌/i.test(text)) return "market";
  if (/海外仓|美国仓|仓库|仓储|物流|履约|发货|配送|尾程|退货|承运商|dhl|岗位/i.test(text)) return "fulfillment";
  if (/tariff|customs|de minimis|section 321|usmca|ocean|rate|transpacific|import|port/i.test(text)) return "market";
  if (/seller|marketplace|amazon|walmart|ebay|tiktok|shopify|usps|fee|noncompliance/i.test(text)) return "platform";
  if (/warehouse|fulfillment|3pl|carrier|ltl|last mile|delivery|returns|supply chain|inventory/i.test(text)) return "fulfillment";
  if (candidate.market_focus === "domestic_seller") return "customer";
  return "customer";
}

export function selectBalancedBusinessCandidates(
  candidates: DingtalkNewsCandidate[],
  minimumValueScore = 70,
  requiredMix = { us_warehouse: 2, mexico_warehouse: 2, us_mexico_bridge: 1 },
): DingtalkNewsCandidate[] {
  const ranked = candidates
    .filter((candidate) => candidate.value_score >= minimumValueScore)
    .filter((candidate) => !isExplicitNonNorthAmericaCandidate(candidate))
    .filter((candidate) => ["us_warehouse", "mexico_warehouse", "us_mexico_bridge"].includes(candidate.market_focus))
    .filter((candidate) => candidate.source_category !== "overseas_policy" || /^\d{4}-\d{2}-\d{2}$/.test(candidate.effective_at))
    .slice()
    .sort((a, b) => {
      const officialDiff = Number(b.source_type === "official") - Number(a.source_type === "official");
      if (officialDiff !== 0) return officialDiff;
      const valueDiff = b.value_score - a.value_score;
      if (valueDiff !== 0) return valueDiff;
      return b.published_at_iso.localeCompare(a.published_at_iso);
    });

  const usedUrls = new Set<string>();
  const take = (focus: DingtalkNewsCandidate["market_focus"], count: number): DingtalkNewsCandidate[] => {
    const selected: DingtalkNewsCandidate[] = [];
    for (const candidate of ranked) {
      if (candidate.market_focus !== focus || usedUrls.has(candidate.url)) continue;
      if (selected.some((item) => item.title.trim().toLowerCase() === candidate.title.trim().toLowerCase())) continue;
      selected.push(candidate);
      usedUrls.add(candidate.url);
      if (selected.length >= count) break;
    }
    if (selected.length !== count) {
      throw new Error(`send_blocked: ${focus} requires ${count} core signals but only ${selected.length} passed value/source checks`);
    }
    return selected;
  };

  return [
    ...take("us_warehouse", requiredMix.us_warehouse),
    ...take("mexico_warehouse", requiredMix.mexico_warehouse),
    ...take("us_mexico_bridge", requiredMix.us_mexico_bridge),
  ];
}

function pickCandidate(
  candidates: DingtalkNewsCandidate[],
  usedUrls: Set<string>,
  predicate: (candidate: DingtalkNewsCandidate) => boolean,
): DingtalkNewsCandidate {
  const matched = candidates.find((candidate) => !usedUrls.has(candidate.url) && predicate(candidate));
  const fallback = candidates.find((candidate) => !usedUrls.has(candidate.url)) || candidates[0];
  if (!fallback) throw new Error("No real news candidates available");
  const selected = matched || fallback;
  usedUrls.add(selected.url);
  return selected;
}

function candidateCategory(category: SignalCategory, candidate: DingtalkNewsCandidate) {
  const title = localizedTitle(category, candidate);
  const what = clipText(candidate.summary || `公开来源发布「${candidate.title}」。`, 170);
  const summary = clipText(candidate.summary || candidate.title, 120);
  const sourceSummary = clipText(summary || `${candidate.source_name} 公开条目，按真实来源采集。`, 160);

  const categoryCopy: Record<SignalCategory, { title: string; why: string; yqn: string; infoType: DingtalkBrief["signals"][number]["info_type"] }> = {
    market: {
      title,
      why: "运价、清关和库存变化会影响卖家是否从直邮转向本土仓。",
      yqn: "开户沟通先问平台、货型、日单量、清关和备货节奏。",
      infoType: "market",
    },
    platform: {
      title,
      why: "平台费用、时效和合规变化会直接影响卖家履约成本。",
      yqn: "把平台规则翻译成入库、出库、尾程、退货和异常处理能力。",
      infoType: "platform",
    },
    customer: {
      title,
      why: "卖家会把配送稳定、费用变化和售后体验放进服务商筛选。",
      yqn: "内容和销售切口从低价改为确定性、风险兜底和可追踪。",
      infoType: "customer",
    },
    fulfillment: {
      title,
      why: "承运商、仓网和尾程波动会改变客户对海外仓的紧迫感。",
      yqn: "优先解释美国仓备货、退货、尾程和异常处理的组合价值。",
      infoType: "fulfillment",
    },
    yqn_view: {
      title,
      why: candidate.market_focus === "mexico_warehouse"
        ? "墨仓只占少量内容，但美墨链路变化会影响部分卖家的北美布局。"
        : "多条信号都指向一个方向：客户更关心交付确定性而非单点价格。",
      yqn: "晨报只保留能转成开户问题、选题或履约解释的信号。",
      infoType: candidate.market_focus === "mexico_warehouse" ? "fulfillment" : "yqn_view",
    },
  };
  const copy = tailoredCopy(category, candidate) || categoryCopy[category];
  return {
    category,
    title: clipText(copy.title, 80),
    what_happened: clipText(what, 170),
    why_it_matters: clipText(copy.why, 130),
    yqn_use: clipText(copy.yqn, 130),
    source_name: candidate.source_name,
    source_url: candidate.url,
    source_published_at: candidate.source_published_at,
    effective_at: candidate.effective_at,
    collected_at: candidate.collected_at,
    market_focus: candidate.market_focus,
    affected_sellers: clipText(candidate.affected_sellers, 120),
    impact_stages: candidate.impact_stages,
    seller_check: clipText(candidate.seller_check, 130),
    value_score: candidate.value_score,
    info_region: candidate.market_focus === "domestic_seller" ? "domestic" as const : candidate.market_focus === "global" ? "global" as const : "overseas" as const,
    info_type: copy.infoType,
    confidence_label: candidate.source_type === "official" && candidate.value_score >= 70 ? "high" as const : "medium" as const,
    is_test_data: false,
    source_summary: sourceSummary,
    is_sensitive: false,
  };
}

function tailoredCopy(
  category: SignalCategory,
  candidate: DingtalkNewsCandidate,
): { title: string; why: string; yqn: string; infoType: DingtalkBrief["signals"][number]["info_type"] } | undefined {
  const text = textOf(candidate);
  if (/cpsc|efiling|电子申报|美国海关|清关强制/i.test(text)) {
    return {
      title: "国内卖家关注美国 eFiling 清关执行",
      why: "清关申报尺度会影响直邮、小包和美国仓备货的风险判断。",
      yqn: "销售可用这条追问客户品类、申报资料和是否需要美国仓兜底。",
      infoType: "policy",
    };
  }
  if (/buy box|前置资格预审/i.test(text)) {
    return {
      title: "Amazon Buy Box 门槛变化影响卖家履约选择",
      why: "Buy Box 竞争仍看价格、配送速度、绩效和 Prime 等履约因素。",
      yqn: "内容和销售可把话题落到库存深度、配送时效和平台仓替代方案。",
      infoType: "platform",
    };
  }
  if (/tiktok shop.*fbt|fbt.*tiktok shop|美区 fbt/i.test(text)) {
    return {
      title: "TikTok Shop 美区 FBT 强化平台仓吸引力",
      why: "平台仓政策会改变卖家对自建美国仓、平台仓和第三方仓的比较。",
      yqn: "销售要准备平台仓与 YQN 美国仓在尾程、退货和异常处理上的差异问答。",
      infoType: "platform",
    };
  }
  if (/tiktok shop.*侵权|世界杯 ip|fifa/i.test(text)) {
    return {
      title: "TikTok Shop IP 合规提醒卖家收紧选品",
      why: "平台合规动作会影响卖家上新节奏和旺季选品风险。",
      yqn: "内容可做平台合规选题，销售可追问客户是否有高风险品类。",
      infoType: "platform",
    };
  }
  if (/人民币结算|狂挖中国卖家|中国卖家/i.test(text)) {
    return {
      title: "平台继续争夺中国跨境卖家供给",
      why: "平台招商和结算便利会推动卖家扩平台，也会带来多仓多平台履约需求。",
      yqn: "开户沟通可从客户是否扩平台、是否需要美国仓多平台出库切入。",
      infoType: "customer",
    };
  }
  if (candidate.market_focus === "us_mexico_bridge") {
    return {
      title: "美墨链路变化要求卖家重算双仓与跨境运输",
      why: "口岸、关税或跨境运力变化会同时影响美国库存、墨西哥补货和尾程承诺。",
      yqn: "结合美国仓与墨西哥双仓布局，先核对货型、库存位置和跨境补货节奏。",
      infoType: "fulfillment",
    };
  }
  if (/墨西哥|墨仓|美客多|mercado\s*libre|mercadolibre/i.test(text)) {
    return {
      title: "墨西哥规则与履约变化影响本地备货",
      why: "墨西哥政策、平台和本地配送变化会直接影响入仓、库存周转与订单履约。",
      yqn: "结合墨西哥1号仓与2号仓双仓布局，核对大中小件的备货、分仓和尾程需求。",
      infoType: "fulfillment",
    };
  }
  if (/海运|运价|舱位|跨太平洋|ocean shipping|ocean rates|transpacific/i.test(text)) {
    return {
      title: "海运涨价压缩美国仓备货窗口",
      why: "运价上行会让卖家更早决定是否前置备货、转美国仓或调整补货频率。",
      yqn: "销售可追问客户备货周期、日单量和是否需要美国仓承接旺季库存。",
      infoType: "market",
    };
  }
  if ((/黑五|网络星期一|旺季|大促|holiday deal/i.test(text)) && (/亚马逊|amazon/i.test(text))) {
    return {
      title: "Amazon 旺季节点推动卖家提前备货",
      why: "黑五和网一活动会提前牵动入仓、库存深度、尾程时效和退货预案。",
      yqn: "内容和销售可围绕旺季前入仓、退货和尾程异常做开户切入。",
      infoType: "platform",
    };
  }
  if (text.includes("amazon") && text.includes("holiday deal")) {
    return {
      title: "Amazon 旺季活动提报窗口打开",
      why: "旺季活动会提前牵动备货、入仓、尾程时效和异常处理预案。",
      yqn: "销售可追问客户是否参加旺季活动、库存是否已进美国仓。",
      infoType: "platform",
    };
  }
  if (text.includes("usps") && (text.includes("rate") || text.includes("rates"))) {
    return {
      title: text.includes("noncompliance") ? "USPS 合规费用提醒卖家重算尾程成本" : "USPS 费率变化影响平台卖家尾程成本",
      why: "尾程费用变化会直接影响卖家对海外仓、平台仓和自发货的选择。",
      yqn: "内容和销售可把话题落到尾程成本、异常兜底和退货体验。",
      infoType: "platform",
    };
  }
  if (text.includes("ltl") && (text.includes("shut") || text.includes("shutdown"))) {
    return {
      title: "LTL 承运商停运提醒客户重视尾程兜底",
      why: "区域承运商波动会影响大件、B2B 和补货链路的稳定性。",
      yqn: "履约沟通要强调多承运商方案、异常响应和替代路线。",
      infoType: "fulfillment",
    };
  }
  if (text.includes("frontloading") && text.includes("transpacific")) {
    return {
      title: "旺季前置推高跨太平洋运价",
      why: "前置备货会压缩卖家决策窗口，推动一部分客户提前布局美国仓。",
      yqn: "销售可把问题从运价转到入仓节奏、备货周期和库存周转。",
      infoType: "market",
    };
  }
  if (text.includes("ocean shipping") || (text.includes("ocean") && text.includes("rates"))) {
    return {
      title: "跨太平洋运价上行，备货窗口变紧",
      why: "海运价格和舱位变化会影响卖家是否提前备货到本土仓。",
      yqn: "开户沟通先问货型、平台、备货周期和美国仓切换意愿。",
      infoType: "market",
    };
  }
  if (text.includes("warehouse") && (text.includes("close") || text.includes("closing"))) {
    return {
      title: "品牌仓网调整提醒卖家重看备货策略",
      why: "仓网调整会影响入库、出库、尾程和库存安全边界。",
      yqn: "履约同事可准备美国仓入库、出库、退货和异常 FAQ。",
      infoType: "fulfillment",
    };
  }
  if (category === "customer" && candidate.market_focus === "domestic_seller") {
    return {
      title: localizedTitle(category, candidate),
      why: "卖家在旺季前会同时比较费用、时效、售后和库存风险。",
      yqn: "内容选题要从低价转向确定性、退货和尾程异常处理。",
      infoType: "customer",
    };
  }
  return undefined;
}

function localizedTitle(category: SignalCategory, candidate: DingtalkNewsCandidate): string {
  const text = textOf(candidate);
  if (/cpsc|efiling|电子申报|美国海关|清关强制/i.test(text)) return "国内卖家关注美国 eFiling 清关执行";
  if (/buy box|前置资格预审/i.test(text)) return "Amazon Buy Box 门槛变化影响卖家履约选择";
  if (/tiktok shop.*fbt|fbt.*tiktok shop|美区 fbt/i.test(text)) return "TikTok Shop 美区 FBT 强化平台仓吸引力";
  if (/tiktok shop.*侵权|世界杯 ip|fifa/i.test(text)) return "TikTok Shop IP 合规提醒卖家收紧选品";
  if (/人民币结算|狂挖中国卖家|中国卖家/i.test(text)) return "平台继续争夺中国跨境卖家供给";
  if (candidate.market_focus === "us_mexico_bridge") return "美墨链路变化要求卖家重算双仓与跨境运输";
  if (/墨西哥|墨仓|美客多|mercado\s*libre|mercadolibre/i.test(text)) return "墨西哥规则与履约变化影响本地备货";
  if (/海运|运价|舱位|跨太平洋|ocean shipping|ocean rates|transpacific/i.test(text)) return "海运涨价压缩美国仓备货窗口";
  if ((/黑五|网络星期一|旺季|大促|holiday deal/i.test(text)) && (/亚马逊|amazon/i.test(text))) return "Amazon 旺季节点推动卖家提前备货";
  if (text.includes("amazon") && text.includes("holiday deal")) return "Amazon 旺季活动提报窗口打开";
  if (text.includes("usps") && text.includes("noncompliance")) return "USPS 合规费用提醒卖家重算尾程成本";
  if (text.includes("usps") && (text.includes("rate") || text.includes("rates"))) return "USPS 费率变化影响平台卖家履约成本";
  if (text.includes("frontloading") && text.includes("transpacific")) return "旺季前置推高跨太平洋运价";
  if (text.includes("transpacific") || (text.includes("ocean") && text.includes("rate"))) return "跨太平洋运价上行，备货窗口变紧";
  if (text.includes("usmca")) return "USMCA 仍是北美供应链稳定性的关键变量";
  if (text.includes("mexico") && text.includes("customs")) return "墨西哥海关规则变化考验美墨链路数据";
  if (text.includes("ltl") && (text.includes("shut") || text.includes("shutdown"))) return "LTL 承运商波动提醒客户重视尾程兜底";
  if (text.includes("warehouse") && (text.includes("close") || text.includes("closing"))) return "美国仓网调整会影响卖家备货判断";
  if (text.includes("walmart") && text.includes("delivery")) return "平台配送用工变化会传导到履约稳定性";
  if (text.includes("returns")) return "退货体验继续影响卖家选择海外仓";
  const prefix: Record<SignalCategory, string> = {
    market: "市场信号",
    platform: "平台信号",
    customer: "客户信号",
    fulfillment: "履约信号",
    yqn_view: candidate.market_focus === "mexico_warehouse" ? "墨仓信号" : "YQN 观察",
  };
  return `${prefix[category]}：${clipText(candidate.title, 34)}`;
}

function buildFallbackRealBrief(
  config: DingtalkRuntimeConfig,
  realSignals: DingtalkRealSignalCollection,
  minimumValueScore = 70,
  requiredMix = { us_warehouse: 2, mexico_warehouse: 2, us_mexico_bridge: 1 },
): DingtalkBrief {
  const candidates = realSignals.candidates;
  if (candidates.length < 5) {
    throw new Error("Not enough real public candidates to build a fallback brief");
  }
  const selected = selectBalancedBusinessCandidates(candidates, minimumValueScore, requiredMix)
    .map((candidate) => candidateCategory(categoryForCandidate(candidate), candidate));
  return validateDingtalkBrief({
    date: config.date,
    title: `${productName}｜${config.date}`,
    one_liner: "美墨规则正在重算履约成本",
    signals: selected,
    sources: selected.map((signal) => {
      const candidate = candidates.find((item) => item.url === signal.source_url);
      return {
        title: signal.source_name,
        url: signal.source_url,
        category: candidate?.source_category || "competitor_fulfillment",
        source_type: candidate?.source_type || "media",
        auto_fetch: true,
      };
    }),
    mode: "live",
    generated_at: new Date().toISOString(),
    risk_flags: [],
  });
}

function anchorCandidateMetadata(brief: DingtalkBrief, candidates: DingtalkNewsCandidate[]): DingtalkBrief {
  const byUrl = new Map(candidates.map((candidate) => [candidate.url.replace(/\/$/, ""), candidate]));
  return validateDingtalkBrief({
    ...brief,
    signals: brief.signals.map((signal) => {
      const candidate = byUrl.get(signal.source_url.replace(/\/$/, ""));
      if (!candidate) return signal;
      return {
        ...signal,
        source_name: candidate.source_name,
        source_type: candidate.source_type,
        source_published_at: candidate.source_published_at,
        effective_at: candidate.effective_at,
        collected_at: candidate.collected_at,
        market_focus: candidate.market_focus,
        affected_sellers: candidate.affected_sellers,
        impact_stages: candidate.impact_stages,
        seller_check: candidate.seller_check,
        value_score: candidate.value_score,
        confidence_label: candidate.source_type === "official" ? "high" : "medium",
        is_test_data: false,
        is_sensitive: false,
      };
    }),
  });
}

function ensureRequiredMix(brief: DingtalkBrief, minimumValueScore = 70): void {
  const counts = new Map<string, number>();
  for (const signal of brief.signals) {
    counts.set(signal.market_focus, (counts.get(signal.market_focus) || 0) + 1);
    if (signal.value_score < minimumValueScore) throw new Error(`send_blocked: signal value score below ${minimumValueScore}`);
    if (signal.info_type === "policy" && !/^\d{4}-\d{2}-\d{2}$/.test(signal.effective_at)) {
      throw new Error("send_blocked: policy signal missing an explicit effective date");
    }
    if (!signal.impact_stages.length) throw new Error("send_blocked: signal missing impact stage");
  }
  if (counts.get("us_warehouse") !== 2 || counts.get("mexico_warehouse") !== 2 || counts.get("us_mexico_bridge") !== 1) {
    throw new Error("send_blocked: brief must contain exactly 2 US, 2 Mexico and 1 US-Mexico bridge signals");
  }
}

function validateSourceUrls(
  brief: DingtalkBrief,
  candidatesOrUrls: DingtalkNewsCandidate[] | string[],
  minimumValueScore = 70,
): DingtalkBrief {
  const candidateObjects = typeof candidatesOrUrls[0] === "string" ? undefined : candidatesOrUrls as DingtalkNewsCandidate[];
  const urls = new Set((candidateObjects || candidatesOrUrls as string[]).map((item) =>
    (typeof item === "string" ? item : item.url).replace(/\/$/, ""),
  ));
  const anchored = candidateObjects ? anchorCandidateMetadata(brief, candidateObjects) : brief;
  for (const signal of anchored.signals) {
    if (!urls.has(signal.source_url.replace(/\/$/, ""))) {
      throw new Error("model selected source_url outside configured source list");
    }
  }
  ensureSignalDiversity(anchored);
  if (anchored.mode === "live") ensureRequiredMix(anchored, minimumValueScore);
  return anchored;
}

async function callOpenAi(
  config: DingtalkRuntimeConfig,
  sources: DingtalkSourceConfig[],
  candidates: DingtalkNewsCandidate[],
): Promise<DingtalkBrief> {
  if (!config.openAiApiKey) throw new Error("SETUP_ERROR: OPENAI_API_KEY is required in live mode");
  if (!config.openAiModel) throw new Error("SETUP_ERROR: OPENAI_MODEL is required in live mode");

  const client = new OpenAI({ apiKey: config.openAiApiKey });
  const businessKnowledge = await loadBusinessKnowledge(config.repoRoot);
  const response = await client.responses.create({
    model: config.openAiModel,
    input: [
      {
        role: "system",
        content: "你只输出符合 schema 的 JSON。不要输出解释，不要输出 Markdown。",
      },
      {
        role: "user",
        content: buildLivePrompt(config, sources, candidates, businessKnowledge),
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "yqn_dingtalk_morning_brief",
        strict: true,
        schema: dingtalkBriefJsonSchema,
      },
    },
  });

  return validateSourceUrls(validateDingtalkBrief(coerceJson(extractOutputText(response))), candidates);
}

function extractGitHubModelsText(response: unknown): string {
  const candidate = response as { choices?: Array<{ message?: { content?: string } }> };
  const text = candidate.choices?.[0]?.message?.content;
  if (typeof text === "string" && text.trim()) return text;
  throw new Error("GitHub Models response did not contain message content");
}

async function callGitHubModels(
  config: DingtalkRuntimeConfig,
  sources: DingtalkSourceConfig[],
  candidates: DingtalkNewsCandidate[],
): Promise<DingtalkBrief> {
  if (!config.githubToken) {
    throw new Error("SETUP_ERROR: live mode requires OPENAI_API_KEY or GitHub Actions GITHUB_TOKEN with models: read");
  }
  const businessKnowledge = await loadBusinessKnowledge(config.repoRoot);
  const response = await fetch("https://models.github.ai/inference/chat/completions", {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.githubToken}`,
    },
    body: JSON.stringify({
      model: config.githubModelsModel,
      temperature: 0.2,
      max_tokens: 2600,
      messages: [
        {
          role: "system",
          content: "你只输出符合 schema 的 JSON。不要输出 Markdown，不要输出解释。",
        },
        {
          role: "user",
          content: buildLivePrompt(config, sources, candidates, businessKnowledge),
        },
      ],
    }),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`GitHub Models request failed with HTTP ${response.status}`);
  }
  return validateSourceUrls(validateDingtalkBrief(coerceJson(extractGitHubModelsText(JSON.parse(body)))), candidates);
}

async function callLiveModel(
  config: DingtalkRuntimeConfig,
  sources: DingtalkSourceConfig[],
  candidates: DingtalkNewsCandidate[],
): Promise<DingtalkBrief> {
  if (config.openAiApiKey) return callOpenAi(config, sources, candidates);
  return callGitHubModels(config, sources, candidates);
}

async function generateLiveWithRetry(
  config: DingtalkRuntimeConfig,
  sources: DingtalkSourceConfig[],
  realSignals: DingtalkRealSignalCollection,
  minimumValueScore: number,
  requiredMix: { us_warehouse: number; mexico_warehouse: number; us_mexico_bridge: number },
): Promise<DingtalkBrief> {
  const balancedCandidates = selectBalancedBusinessCandidates(realSignals.candidates, minimumValueScore, requiredMix);
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await callLiveModel(config, sources, balancedCandidates);
    } catch (error) {
      lastError = error;
      console.warn(`[dingtalk:generate] live schema/source validation failed on attempt ${attempt}`);
    }
  }
  console.warn(`[dingtalk:generate] live model failed; publishing deterministic real-source brief: ${lastError instanceof Error ? lastError.message : "unknown error"}`);
  return buildFallbackRealBrief(config, realSignals, minimumValueScore, requiredMix);
}

export async function generateDingtalkBrief(config = readDingtalkRuntimeConfig()): Promise<DingtalkBrief> {
  const collection = await collectDingtalkSources(config.repoRoot);
  let webSearchAudits: WebSearchAudit[] = [];
  let minimumValueScore = 70;
  let requiredMix = { us_warehouse: 2, mexico_warehouse: 2, us_mexico_bridge: 1 };
  let realSignals: DingtalkRealSignalCollection | undefined;
  if (config.mode === "live") {
    const [rssSignals, webResearch] = await Promise.all([
      collectDingtalkRealSignals(config.repoRoot),
      collectMandatoryWebResearch(config),
    ]);
    webSearchAudits = webResearch.audits;
    minimumValueScore = webResearch.minimumCoreValueScore;
    requiredMix = webResearch.requiredMix;
    realSignals = {
      ...rssSignals,
      candidates: mergeCandidates([...webResearch.candidates, ...rssSignals.candidates]),
      source_count_before_window: rssSignals.source_count_before_window + webResearch.candidates.length,
    };
  }
  if (realSignals) {
    await writeJsonFile(sourceReportPath(config), {
      date: config.date,
      generated_at: new Date().toISOString(),
      research_method: "openai_responses_web_search",
      send_authorized: true,
      source_window_hours: realSignals.source_window_hours,
      source_count_before_window: realSignals.source_count_before_window,
      source_errors: realSignals.source_errors,
      web_search_required: true,
      web_search_audits: webSearchAudits,
      minimum_core_value_score: minimumValueScore,
      required_mix: requiredMix,
      candidates: realSignals.candidates.map((candidate) => ({
        title: candidate.title,
        url: candidate.url,
        source_name: candidate.source_name,
        source_type: candidate.source_type,
        source_published_at: candidate.source_published_at,
        market_focus: candidate.market_focus,
        effective_at: candidate.effective_at,
        affected_sellers: candidate.affected_sellers,
        impact_stages: candidate.impact_stages,
        seller_check: candidate.seller_check,
        value_score: candidate.value_score,
        score: candidate.score,
        account_opening_score: candidate.account_opening_score,
        score_reasons: candidate.score_reasons,
        business_value_reasons: candidate.business_value_reasons,
      })),
    });
  }
  const brief = config.mode === "demo"
    ? buildSampleBrief(config.date, collection.sources)
    : await generateLiveWithRetry(
        config,
        collection.sources,
        realSignals as DingtalkRealSignalCollection,
        minimumValueScore,
        requiredMix,
      );

  const candidateInputs = config.mode === "demo"
    ? collection.sources.map((source) => source.url)
    : (realSignals as DingtalkRealSignalCollection).candidates;
  const parsed = validateSourceUrls(validateDingtalkBrief({
    ...brief,
    date: config.date,
    title: `${productName}｜${config.date}`,
    mode: brief.mode === "demo" ? "demo" : config.mode,
  }), candidateInputs, minimumValueScore);

  await writeJsonFile(dataPath(config), parsed);
  await writeTextFile(markdownPath(config), renderDingtalkMarkdown(parsed, {
    publicBaseUrl: config.publicBaseUrl,
    archiveAvailable: Boolean(config.publicBaseUrl),
    testLabel: true,
  }));
  console.log(`[dingtalk:generate] wrote data/dingtalk-briefs/${config.date}.json (${config.mode})`);
  return parsed;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  generateDingtalkBrief().catch((error) => {
    console.error(error instanceof Error ? error.message : "DingTalk brief generation failed");
    process.exit(1);
  });
}
