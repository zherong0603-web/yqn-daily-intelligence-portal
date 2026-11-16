# 2026-11-16 采集与候选

搜索基准：2026-11-16 16:00 Asia/Shanghai。先查 24 小时，主要信号不足；扩至 72 小时后，把同日生效但公告日更早的事件作为候选，并检查公告日、页面可见更新日、生效日和卖家操作窗口。最终以 eBay 美国站 USPS Ground Advantage 11 月 14 日调价作单主题。

## 12 条研究记录

1. eBay 美国站：USPS 调整 Ground Advantage 费率，卖家公告更新于 11/13/2026，11/14/2026 生效。页面说明 calculated shipping 自动更新，费率受重量、zone、目的地影响。页面：https://community.ebay.com/forum/announcements-57928/topic/usps-is-adjusting-rates-on-november-14-2026-487561/
2. Amazon SP-API：11/11/2026 公告，11/16/2026 更新商品类型属性 usage 和枚举，影响 Listings Items API 与 JSON_LISTINGS_FEED。页面：https://developer-docs.amazon/sp-api/changelog/november-updates-to-listing-attribute-usage-and-enumeration-values
3. UPS：Holiday 2026 Service Modifications 写明 11/16/2026 至 01/08/2027 部分 Ground 和 Standard 包裹可能多一天；页面没有显示精确的公告发布日期。页面：https://www.ups.com/us/en/support/shipping-support/shipping-services/holiday-shipping-schedule
4. TikTok 美国站：Guide to Samples: Free and Refundable 页面更新 11/11/2026；退款样品需在送达后 14 天内发布合格内容，并在第 54 天前达到销售目标。页面：https://seller-us.tiktok.com/university/essay?knowledge_id=5764641632306946&lang=en
5. CBP CSMS #70435061：11/13/2026 16:36 EST 发布，HSU 2627 含 2 个 harmonized tariff records 和 6 个 ABI records，涉及 Section 301 中国产品排除延期。页面：https://content.govdelivery.com/accounts/USDHSCBP/bulletins/432c0f5
6. CBP CSMS #70422566：11/12/2026 11:38 EST 发布，多晶硅及衍生品 Section 232 最低进口价测试，正式生效 12/04/2026。页面：https://content.govdelivery.com/accounts/USDHSCBP/bulletins/4329026
7. TikTok 美国活动价格建议更新：媒体报道发布于 11/15/2026，称 11/13 更新推荐活动价；推荐价不会自动降价或扣款。页面：https://www.niceggie.com/en/news/tiktok-shop-updates-campaign-price-recommendations-feature-2026-6af9b96a1bc406cba444a401
8. FedEx 2026 Winter holiday service schedule：11/23/2026 至 01/04/2027，部分时效型快递承诺延长 90 分钟；PDF 未显示精确发布日期。页面：https://www.fedex.com/content/dam/fedex/us-united-states/services/2026_winter_holiday_operations_schedule.pdf
9. Shopify：11/10/2026 起可按市场配置自助退货与取消；未设规则就开启，买家可能无期限发起请求。页面：https://changelog.shopify.com/posts/configure-self-serve-returns-and-cancellations-for-each-market-you-sell-in
10. FAA ground stop：11/13/2026 晚间解除，11/14 报道指出 UPS/FedEx 部分航空货件可能仍延迟；事件已恢复，不具备单一持续行动。页面：https://www.editusa.com/news/ups-fedex-package-tracking-faa-ground-stop-november-13-2026
11. Federal Register：11/16/2026 发布中国木制橱柜和梳妆台反补贴行政复审终裁，列明 5.48% 与 113.08% 补贴率。页面：https://www.federalregister.gov/documents/2026/11/16/2026-23264/wooden-cabinets-and-vanities-and-components-thereof-from-the-peoples-republic-of-china-final-results
12. Federal Register：11/16/2026 发布墨西哥钢筋反倾销复审终裁，Deacero Group 加权平均倾销幅度 11.38%。页面：https://www.federalregister.gov/documents/full_text/html/2026/11/16/2026-23277.html

## 5 条重点候选

| 候选 | 分数 | 决定 | 取舍理由 |
| --- | ---: | --- | --- |
| USPS Ground Advantage美国站调价 | 94 | 入选 | 美国、近 72 小时、直接影响运费；页面明确 calculated shipping 自动更新，同时要求卖家重查 listing 成本，今天可执行。 |
| Amazon SP-API 11/16 更新商品属性 | 90 | 淘汰 | 同日生效、操作性明确，但只影响少数使用特定 API/JSON feed 的团队，受众面小于运费。 |
| UPS Ground/Standard 旺季附加时效 | 88 | 淘汰 | 11/16 开始且影响面大，但官方页面缺少精确可见公告日期，严格来源门槛未满足。 |
| TikTok 美国退款样品 14/54 天新时限 | 87 | 淘汰 | 有明确天数，但主要约束创作者发内容；卖家经营账还需额外假设，单题竞争度低于 eBay。 |
| CBP HSU 2627 Section 301 排除延期 | 86 | 淘汰 | 178 项、至 2027-01-09 很重要，但 11/09 已作为主稿交付，去重硬门槛不通过。 |

其余重点但未入前五：TikTok 活动推荐价、CBP 多晶硅最低进口价、FedEx 90 分钟承诺延长、Shopify 分市场自助退货、FAA 航空恢复、木制橱柜反补贴终裁、墨西哥钢筋反倾销终裁。

## 100 分评分明细

- eBay USPS：相关性 35，经营影响 27，数字或案例 13，钩子 9，时效 10，合计 94。公告没有统一涨跌幅度，具体变化按包裹重量、zone、目的地和设置方式核对。
- Amazon SP-API：相关性 33，经营影响 25，数字或案例 12，钩子 10，时效 10，合计 90。
- UPS：相关性 34，经营影响 27，具体证据 12，钩子 8，时效 7，合计 88。送达日期清楚，但公告发布日期不可见。
- TikTok 样品：相关性 33，经营影响 25，具体证据 14，钩子 8，时效 7，合计 87。页面日期可见，但卖家动作要经过创作者履约。
- CBP HSU：相关性 34，经营影响 26，具体证据 12，钩子 6，时效 8，合计 86。与 11/09 主稿重复。

## 委员会意见

卖家经营：eBay 是今天最好用的一条。范围先覆盖全部在售 Ground Advantage 链接，再按 11月14日后的受影响订单量乘单票差额绝对值排序。calculated shipping 查重量、尺寸、handling 和包邮公式；固定运费、包邮、自定义价表算卖家吸收额；第三方 ERP 先拿真实订单或同条件报价核对。只有在没有在售链接且没有新订单，或代表性测试通过且吸收后毛利安全时，才可今天不动。

内容主编：只讲“自动更新为什么还可能要重算”。不要把重量、zone、目的地、运费设置方式混成三件事。公告没有统一涨幅，任何单一百分比都不能上钩子。选择 eBay，暂时淘汰 UPS 和 Amazon。

传播入口：钩子可用“自动更新”和“仍可能算错”的冲突，数字用 11 月 14 日。不得宣称 USPS 全国统一上涨，也不得说 eBay 承诺所有 ERP 自动同步。

分歧：卖家经营一度倾向 UPS，因为 11/16 起影响全部 Ground/Standard；内容主编以严格来源日期和目标群可执行为由裁决 eBay。TikTok 样品有具体 14/54 天，但卖家必须先经过创作者履约，今天能独立完成的事情较少。

## 核心来源

- eBay Announcements（seller_news_team）：<https://community.ebay.com/forum/announcements-57928/topic/usps-is-adjusting-rates-on-november-14-2026-487561/>
  Update 11/13/2026：USPS is adjusting rates for Ground Advantage on November 14, 2026. calculated shipping 自动更新；公告鼓励卖家上架时检查运费，并称费率随重量、zone、destination 以及地理定价变化。
