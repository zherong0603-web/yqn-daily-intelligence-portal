import { DingtalkBrief, DingtalkSourceConfig, productName, validateDingtalkBrief } from "./schema.js";

function sourceFor(category: DingtalkSourceConfig["category"], sources: DingtalkSourceConfig[]): DingtalkSourceConfig {
  const found = sources.find((source) => source.category === category) || sources[0];
  if (!found) throw new Error(`No source configured for ${category}`);
  return found;
}

function sourcePayload(source: DingtalkSourceConfig) {
  return {
    title: source.title,
    url: source.url,
    category: source.category,
    source_type: source.source_type,
    auto_fetch: source.auto_fetch,
  };
}

export function buildSampleBrief(date: string, sources: DingtalkSourceConfig[]): DingtalkBrief {
  const domestic = sourceFor("domestic_crossborder", sources);
  const policy = sourceFor("overseas_policy", sources);
  const platform = sourceFor("platform_seller", sources);
  const competitor = sourceFor("competitor_fulfillment", sources);
  const yqnPublic = sourceFor("yqn_public", sources);
  const collectedAt = new Date().toISOString();

  return validateDingtalkBrief({
    date,
    title: `${productName}｜${date}`,
    one_liner: "平台规则与头仓配判断要合并看",
    signals: [
      {
        category: "market_policy",
        title: "低值包裹与清关口径影响直邮转仓判断",
        what_happened: `${date} demo：CBP 等公开入口用于跟踪低值包裹、关税和清关口径。`,
        why_it_matters: "卖家会据此比较直邮、本土仓、头程和清关方案。",
        yqn_use: "把政策问题转成头仓配和退货方案诊断。",
        today_action: "销售首问补齐目的国、平台、货值和清关方式。",
        source_name: policy.title,
        source_url: policy.url,
        source_published_at: date,
        collected_at: collectedAt,
        info_region: "overseas",
        info_type: "policy",
        confidence_label: "medium",
        is_test_data: true,
        source_summary: policy.sample_summary || "海外政策公开入口，demo 模式仅作来源分类样例。",
        is_sensitive: false,
      },
      {
        category: "platform_seller",
        title: "平台履约规则把卖家痛点前移到发货前",
        what_happened: `${date} demo：平台公开卖家中心用于跟踪发货时效、轨迹和售后规则。`,
        why_it_matters: "发货超时和轨迹缺失会影响店铺评分与买家体验。",
        yqn_use: "把平台规则拆成入库、出库、尾程和异常处理问题。",
        today_action: "内容准备 1 条平台发货超时避坑选题。",
        source_name: platform.title,
        source_url: platform.url,
        source_published_at: date,
        collected_at: collectedAt,
        info_region: "global",
        info_type: "platform",
        confidence_label: "medium",
        is_test_data: true,
        source_summary: platform.sample_summary || "平台公开卖家资料，demo 模式仅作来源分类样例。",
        is_sensitive: false,
      },
      {
        category: "competitor_fulfillment",
        title: "竞品与承运商公开动作要连到头仓配方案",
        what_happened: `${date} demo：竞品和承运商公开页用于观察仓配、尾程和退货表达。`,
        why_it_matters: "卖家会把平台仓、第三方仓、尾程和国内货代一起比较。",
        yqn_use: "反推 YQN 头程、海外仓、尾程、退货的一体化表达。",
        today_action: "履约整理头程、入库、出库、退货、尾程异常 FAQ。",
        source_name: competitor.title,
        source_url: competitor.url,
        source_published_at: date,
        collected_at: collectedAt,
        info_region: "global",
        info_type: "competitor",
        confidence_label: "medium",
        is_test_data: true,
        source_summary: competitor.sample_summary || "竞品和履约公开资料，demo 模式仅作来源分类样例。",
        is_sensitive: false,
      },
      {
        category: "growth_lead",
        title: "线索质量要从开口量转向问题标注",
        what_happened: `${date} demo：小红书和 B2B 线索公开资料用于整理获客承接动作。`,
        why_it_matters: "只看开口量会误判素材质量和销售优先级。",
        yqn_use: "把选题、私信追问和首轮诊断统一到同一套字段。",
        today_action: "新增线索补齐平台、货型、日单量和履约痛点。",
        source_name: domestic.title,
        source_url: domestic.url,
        source_published_at: date,
        collected_at: collectedAt,
        info_region: "domestic",
        info_type: "growth",
        confidence_label: "medium",
        is_test_data: true,
        source_summary: domestic.sample_summary || "国内跨境和获客公开资料，demo 模式仅作来源分类样例。",
        is_sensitive: false,
      },
      {
        category: "yqn_action",
        title: "今日把公开信号落到销售、内容和履约三张表",
        what_happened: `${date} demo：YQN 公开服务页支持头程、海外仓、尾程和退货能力表达。`,
        why_it_matters: "同一条市场信号要分别转成销售问题、内容选题和履约 FAQ。",
        yqn_use: "用公开服务能力承接跨境增长问题，不引入敏感内部信息。",
        today_action: "数据把今日线索按平台、货型、日单量、履约痛点补齐。",
        source_name: yqnPublic.title,
        source_url: yqnPublic.url,
        source_published_at: date,
        collected_at: collectedAt,
        info_region: "domestic",
        info_type: "yqn_action",
        confidence_label: "high",
        is_test_data: true,
        source_summary: yqnPublic.sample_summary || "YQN 公开资料，demo 模式仅作公开表达样例。",
        is_sensitive: false,
      },
    ],
    action_list: [
      "销售：新线索补齐平台、货型、日单量、履约痛点。",
      "内容：输出 1 条平台发货超时避坑选题，不写客户案例。",
      "履约/数据：整理头程、入库、出库、退货、尾程异常 FAQ。",
    ],
    sources: [domestic, policy, platform, competitor, yqnPublic].map(sourcePayload),
    mode: "demo",
    generated_at: collectedAt,
    risk_flags: [],
  });
}
