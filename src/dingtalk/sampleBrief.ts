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
        collected_at: collectedAt,
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
        collected_at: collectedAt,
        info_region: "global",
        info_type: "platform",
        confidence_label: "medium",
        is_test_data: true,
        source_summary: platform.sample_summary || "平台公开卖家资料，demo 模式仅作来源分类样例。",
        is_sensitive: false,
      },
      {
        category: "customer",
        title: "客户问题从运费便宜转向确定性",
        what_happened: "跨境公开资讯和投放资料都在强调卖家经营、平台规则和获客承接。",
        why_it_matters: "销售会更常听到销量、库存、配送稳定、退货体验一起被问。",
        yqn_use: "首轮判断重点放在平台、货型、日单量和当前履约卡点。",
        source_name: domestic.title,
        source_url: domestic.url,
        source_published_at: date,
        collected_at: collectedAt,
        info_region: "domestic",
        info_type: "customer",
        confidence_label: "medium",
        is_test_data: true,
        source_summary: domestic.sample_summary || "国内跨境和获客公开资料，demo 模式仅作来源分类样例。",
        is_sensitive: false,
      },
      {
        category: "fulfillment",
        title: "平台仓和第三方仓会被放在一张表比较",
        what_happened: "平台化供应链、承运商和海外仓公开页都在突出仓网、尾程和退货能力。",
        why_it_matters: "卖家旺季前会同时比较速度、成本、控制权和异常兜底。",
        yqn_use: "表达重点从单仓价格转到头程、仓配、退货和异常可控。",
        source_name: competitor.title,
        source_url: competitor.url,
        source_published_at: date,
        collected_at: collectedAt,
        info_region: "global",
        info_type: "fulfillment",
        confidence_label: "medium",
        is_test_data: true,
        source_summary: competitor.sample_summary || "竞品和履约公开资料，demo 模式仅作来源分类样例。",
        is_sensitive: false,
      },
      {
        category: "yqn_view",
        title: "今天只保留能改变判断的信号",
        what_happened: "监管、平台、客户和履约供给都指向同一件事：增长更依赖交付确定性。",
        why_it_matters: "老板看风险，运营看规则，销售看客户提问，内容看选题切口。",
        yqn_use: "晨报只保留能影响卖家决策和团队协同的高权重信息。",
        source_name: yqnPublic.title,
        source_url: yqnPublic.url,
        source_published_at: date,
        collected_at: collectedAt,
        info_region: "domestic",
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
