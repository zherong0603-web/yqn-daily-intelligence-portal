import { DingtalkBrief, DingtalkSourceConfig, validateDingtalkBrief } from "./schema.js";

function sourceFor(category: DingtalkSourceConfig["category"], sources: DingtalkSourceConfig[]): DingtalkSourceConfig {
  const found = sources.find((source) => source.category === category) || sources[0];
  if (!found) throw new Error(`No source configured for ${category}`);
  return found;
}

export function buildSampleBrief(date: string, sources: DingtalkSourceConfig[]): DingtalkBrief {
  const policy = sourceFor("policy", sources);
  const platform = sourceFor("platform", sources);
  const fulfillment = sourceFor("fulfillment", sources);
  const growth = sourceFor("growth", sources);
  const yqnPublic = sourceFor("yqn_public", sources);

  return validateDingtalkBrief({
    date,
    title: `YQN 北美履约增长晨报｜${date}`,
    one_liner: "平台履约变化推动美国仓前置",
    signals: [
      {
        category: "policy",
        title: "低值进口规则变化继续影响直邮判断",
        what_happened: "美国进口合规和低值包裹规则持续受到关注，卖家对直邮、清关和本土仓的比较会更频繁。",
        why_it_matters: "政策不确定会放大发货时效、清关稳定性和售后体验的压力，影响平台店铺履约表现。",
        yqn_use: "用公开政策变化切入美国仓、一件代发、退货处理和平台履约稳定性。",
        today_action: "销售把新线索先标记为直邮转仓、平台履约或退货处理三类。",
        source_url: policy.url,
        confidence: 0.82,
        is_sensitive: false,
      },
      {
        category: "platform",
        title: "平台继续强化发货时效和轨迹要求",
        what_happened: "TikTok Shop、Amazon、Walmart 等平台的履约规则持续围绕发货时效、轨迹同步和售后体验展开。",
        why_it_matters: "履约异常不只是物流问题，也会影响店铺评分、流量分发和转化效率。",
        yqn_use: "把美国仓配和尾程节点可追踪表达成平台经营风险控制方案。",
        today_action: "内容侧准备一条平台发货超时如何提前规避的公开选题。",
        source_url: platform.url,
        confidence: 0.78,
        is_sensitive: false,
      },
      {
        category: "fulfillment",
        title: "北美仓网和尾程稳定性成为旺季前判断点",
        what_happened: "平台仓、第三方仓、承运商服务提醒和退货处理能力共同影响北美履约体验。",
        why_it_matters: "旺季前的仓网选择会影响入库、出库、尾程、退货和异常处理的连续性。",
        yqn_use: "强调多仓布局、节点可见、退货处理和平台转运能力。",
        today_action: "履约同事整理一版美国仓入库、出库、退货、尾程异常 FAQ。",
        source_url: fulfillment.url,
        confidence: 0.8,
        is_sensitive: false,
      },
      {
        category: "growth",
        title: "小红书线索质量要看承接和标注",
        what_happened: "B2B 线索经营不能只看开口量，还要看留资、加 V、MQL 和销售反馈之间的衔接。",
        why_it_matters: "如果阶段混在一起，会误判素材和投放质量，销售也难以及时跟进高意向需求。",
        yqn_use: "把美国仓痛点写进私信追问和销售首轮诊断，减少无效沟通。",
        today_action: "今天新增线索统一补齐平台、货型、日单量、当前履约痛点。",
        source_url: growth.url,
        confidence: 0.76,
        is_sensitive: false,
      },
    ],
    action_list: [
      "销售：新线索补齐平台、货型、日单量、当前履约痛点。",
      "内容：产出 1 条平台履约超时避坑选题，避免写客户案例。",
      "履约：补一版美国仓入库、出库、退货、尾程异常 FAQ。",
    ],
    sources: [policy, platform, fulfillment, growth, yqnPublic].map((source) => ({
      title: source.title,
      url: source.url,
      category: source.category,
      source_type: source.source_type,
      auto_fetch: source.auto_fetch,
    })),
    mode: "demo",
    generated_at: new Date().toISOString(),
    risk_flags: [],
  });
}
