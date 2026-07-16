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
    one_liner: "增长越来越吃履约确定性",
    signals: [
      {
        category: "market",
        title: "低值包裹监管让直邮不再只是价格题",
        what_happened: "美国公开监管入口持续把低值包裹、申报和清关放进电商进口管理重点。",
        why_it_matters: "老板关心风险，运营会重新比较直邮、小包、备货和本土仓稳定性。",
        yqn_use: "解释美国仓、前置备货和退货能力为什么会进入客户决策。",
        source_name: policy.title,
        source_url: policy.url,
        source_published_at: date,
        effective_at: date,
        collected_at: collectedAt,
        market_focus: "us_warehouse",
        affected_sellers: "经营美国站、使用直邮或美国仓的大中小件卖家",
        impact_stages: ["first_mile", "warehousing"],
        seller_check: "检查申报资料、清关责任和美国仓前置备货方案。",
        value_score: 82,
        info_region: "overseas",
        info_type: "market",
        confidence_label: "medium",
        is_test_data: true,
        source_summary: policy.sample_summary || "海外政策公开入口，demo 模式仅作来源分类样例。",
        is_sensitive: false,
      },
      {
        category: "platform",
        title: "平台继续把履约表现写进卖家经营指标",
        what_happened: "平台公开规则围绕发货时效、有效轨迹、交付表现和售后体验做卖家教育。",
        why_it_matters: "运营看到的是评分，背后是仓配、承运商、库存承诺和异常处理。",
        yqn_use: "把平台扣分语言翻译成入库、出库、尾程和售后能力。",
        source_name: platform.title,
        source_url: platform.url,
        source_published_at: date,
        effective_at: date,
        collected_at: collectedAt,
        market_focus: "us_warehouse",
        affected_sellers: "经营美国电商平台并使用本地配送的卖家",
        impact_stages: ["warehousing", "last_mile"],
        seller_check: "检查库存承诺、有效轨迹、配送时效和售后能力。",
        value_score: 78,
        info_region: "global",
        info_type: "platform",
        confidence_label: "medium",
        is_test_data: true,
        source_summary: platform.sample_summary || "平台公开卖家资料，demo 模式仅作来源分类样例。",
        is_sensitive: false,
      },
      {
        category: "customer",
        title: "墨西哥平台经营更依赖本地库存确定性",
        what_happened: "墨西哥平台和官方规则样例提示卖家同步检查进口、入仓、库存与本地配送。",
        why_it_matters: "大中小件卖家都会受到清关、库存周转和配送稳定性的共同影响。",
        yqn_use: "结合墨西哥双仓布局判断货型、日单量和当前履约卡点。",
        source_name: domestic.title,
        source_url: domestic.url,
        source_published_at: date,
        effective_at: date,
        collected_at: collectedAt,
        market_focus: "mexico_warehouse",
        affected_sellers: "经营墨西哥站、需要墨西哥仓的大中小件卖家",
        impact_stages: ["first_mile", "warehousing", "last_mile"],
        seller_check: "检查进口资料、入仓预约、库存周转和本地尾程。",
        value_score: 76,
        info_region: "overseas",
        info_type: "customer",
        confidence_label: "medium",
        is_test_data: true,
        source_summary: domestic.sample_summary || "国内跨境和获客公开资料，demo 模式仅作来源分类样例。",
        is_sensitive: false,
      },
      {
        category: "fulfillment",
        title: "墨西哥仓与本地尾程需要放在一张表比较",
        what_happened: "墨西哥仓配公开资料样例把仓网、尾程、换标和退货能力放进同一履约方案。",
        why_it_matters: "卖家需要同时比较速度、成本、控制权和异常兜底。",
        yqn_use: "表达重点从单仓价格转到墨西哥双仓、仓配、退货和异常可控。",
        source_name: competitor.title,
        source_url: competitor.url,
        source_published_at: date,
        effective_at: date,
        collected_at: collectedAt,
        market_focus: "mexico_warehouse",
        affected_sellers: "使用墨西哥海外仓与本地配送的大中小件卖家",
        impact_stages: ["warehousing", "last_mile"],
        seller_check: "检查分仓、贴换标、退货和尾程异常处理预案。",
        value_score: 75,
        info_region: "overseas",
        info_type: "fulfillment",
        confidence_label: "medium",
        is_test_data: true,
        source_summary: competitor.sample_summary || "竞品和履约公开资料，demo 模式仅作来源分类样例。",
        is_sensitive: false,
      },
      {
        category: "yqn_view",
        title: "美墨联动要求重新检查跨境补货节奏",
        what_happened: "美墨口岸、跨境运输和双市场库存共同决定北美订单能否稳定履约。",
        why_it_matters: "美国库存与墨西哥补货不能再被当成两个完全分离的问题。",
        yqn_use: "用美国仓、墨西哥双仓和跨境运输能力校准库存位置与补货方案。",
        source_name: yqnPublic.title,
        source_url: yqnPublic.url,
        source_published_at: date,
        effective_at: date,
        collected_at: collectedAt,
        market_focus: "us_mexico_bridge",
        affected_sellers: "同时经营美国与墨西哥市场、需要跨境补货的卖家",
        impact_stages: ["first_mile", "warehousing", "last_mile"],
        seller_check: "检查美国库存、墨西哥库存和跨境补货节奏是否一致。",
        value_score: 80,
        info_region: "overseas",
        info_type: "yqn_view",
        confidence_label: "high",
        is_test_data: true,
        source_summary: yqnPublic.sample_summary || "YQN 公开资料，demo 模式仅作公开表达样例。",
        is_sensitive: false,
      },
    ],
    sources: [domestic, policy, platform, competitor, yqnPublic].map(sourcePayload),
    mode: "demo",
    generated_at: collectedAt,
    risk_flags: [],
  });
}
