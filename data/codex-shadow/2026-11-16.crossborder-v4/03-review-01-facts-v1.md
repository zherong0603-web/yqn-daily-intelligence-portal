# 跨境早知道 V4 一审一校事实审核记录

## 审核信息

- 审核人：独立跨境简报事实审核人，不参与本期写稿
- 审核对象：`data/codex-shadow/2026-11-16.crossborder-v4/02-editor-cut-v1.md`
- 所审版本：编辑稿 v1
- 关联候选：`data/codex-shadow/2026-11-16.crossborder-v4/00-candidates-and-sources.md`
- 审核时间：2026-11-16 17:00 CST（Asia/Shanghai）
- 文件指纹：
  - `00-candidates-and-sources.md`：`8ca7e6794c3911ae948fab229dd07290ca78c7d910f9580a0df78e35edc10d60`
  - `02-editor-cut-v1.md`：`18c0c0128ab75e0b483de369c0af21d469be99a53417f26995042ec2090b817b`
- 结论：**PASS**

## 审核方法与原始来源

1. 直接请求 eBay Announcements 页面并解析页面正文和 HTML 元数据：
   - <https://community.ebay.com/forum/announcements-57928/topic/usps-is-adjusting-rates-on-november-14-2026-487561/>
   - 页面正文可见 `Update 11/13/2026`，原句为 `USPS is adjusting rates for Ground Advantage on November 14, 2026.`
   - HTML 元数据显示该主题最初发布于 2026-10-22，修改时间为 2026-11-13。该元数据仅用于交叉确认页面版本，未给稿件补充可见正文没有写出的小时或时区。
2. 核对 eBay 官方地理定价公告：
   - <https://community.ebay.com/forum/announcements-57928/topic/usps-geo-based-pricing-updates-effective-october-18-2026-486459/>
   - 原文写明 USPS 使用三个 Ground Advantage 地理费率组，依据目的地 ZIP 代码；部分 ZIP 的费率会上涨或下降。
3. 核对 eBay 官方 Seller Center 的 Ground Advantage 说明和 FAQ：
   - <https://www.ebay.com/sellercenter/shipping/choosing-a-carrier-and-service/usps-and-ebay-labels>
   - FAQ 原文写明，重量和 shipping zone 相同的两票货物，可能因目的地 ZIP 不同而费率不同。
   - 同页说明 Ground Advantage 按重量和 zone 定价，轻小件重量向上落入 4 oz、8 oz、12 oz、15.999 oz 档位，超过 15.999 oz 后按整磅向上取整。
4. 用 USPS 第一方页面核对 zone 和重量边界：
   - Zone 工具：<https://postcalc.usps.com/domesticzonechart>
   - 页面写明目的地 ZIP 前三位决定 zone，并存在 5 位 ZIP 例外。
   - Ground Advantage：<https://www.usps.com/ship/ground-advantage.htm>
   - USPS 页面写明重量向上取整；包裹超过 1 立方英尺时需要计算体积重量，实重与体积重量取较高值。
5. 核对 USPS Postal Explorer 当前价格入口和 Ground Advantage 价格文件：
   - <https://pe.usps.com/PriceChange/Index>
   - <https://www.usps.com/business/prices/2026/s-ground-advantage-retail.csv>
   - 价格文件按重量与 zone 列价。该文件用于核验常规计费结构，不替代 eBay 对本次平台侧费率更新的公告。

## 重点核验结果

| 核验项 | 结果 | 证据与边界 |
| --- | --- | --- |
| 页面可见更新日 | 通过 | eBay 页面正文可见 `Update 11/13/2026`。编辑稿写 2026-11-13，没有把 HTML 元数据中的修改时间换算成北京时间。 |
| 生效日 | 通过 | 最新更新原句写 Ground Advantage 于 `November 14, 2026` 调整费率。编辑稿写 2026-11-14。 |
| 小时和时区 | 通过 | 页面正文只写更新日和生效日，没有对本次更新提供具体小时或时区。编辑稿明确写“页面未写具体小时和时区”，没有补造。 |
| calculated shipping 自动更新范围 | 通过 | eBay 明确写：`If you use calculated shipping, your rates will update automatically.` 编辑稿只把自动更新归给 calculated shipping，并要求抽查 listing、标签成本和 calculator 报价。 |
| 固定运费、包邮、ERP | 通过 | 公告没有承诺这些设置自动同步。编辑稿使用“不能默认”“不要假设”“按工具记录核对”，来源边界也明确把这些写成推导出的操作提醒，没有冒充 eBay 官方事实。 |
| 统一涨跌幅度 | 通过 | 本次 11/13 更新没有发布适用于全部卖家的统一百分比，也没有说明所有重量和 zone 都上涨或下降。编辑稿明确写“没有统一涨幅”，并用“网上只有一个百分比，不能直接搬”阻止错误外推。 |
| 地理定价、重量、zone、目的地 | 通过 | eBay 官方 FAQ 直接支持“同一重量、同一 zone，目的地 ZIP 不同可能价格不同”；USPS 页面支持重量、zone 与目的地区域影响价格。编辑稿没有声称每个 ZIP 都涨价，也没有给出未经来源支持的具体涨跌金额。 |
| 假设压力测试 | 通过 | 1000 单、每单变化 1 美元、合计 1000 美元均明确标为“假设”和“压力测试”，并声明不是平台公布的涨幅，也未计广告、退货和汇率。没有写成实际已发生费用。 |
| 标题和 A/B 钩子 | 通过 | “再调价”有同一公告主题内 10 月 25 日、10 月 30 日、11 月 8 日和 11 月 14 日连续更新的证据。A/B 使用 11 月 14 日和重量、分区，没有使用统一涨幅。 |

## 发现问题

未发现需要退回编辑的事实错误。

有两项非阻塞的留档和口径加固建议，建议在二审或冻结前顺手完成：

1. “同一个 zone 里的不同邮编出现价格差异”虽然由 eBay 官方 Seller Center FAQ 明确支持，但编辑稿的来源区没有列出该 FAQ 和 10 月 18 日地理定价公告。建议把这两个第一方链接补进最终来源记录，方便逐句回指。
2. “实际打包重量”适合作为卖家填表输入，但不等于 USPS 的计费重量。USPS 会对轻小件重量向上归档，普通包裹按整磅向上取整，超过 1 立方英尺时还要比较实重与体积重量。建议在经营账增加“计费重量或 calculator 计算方式”，或者把“实际重量”改为“实际重量与计费重量”。这一澄清不改变当前稿“用 calculator 和实际收费对账”的正确路径。

## 改法建议

- 保留编辑稿现有事实边界，不增加统一百分比，不把固定运费、包邮或 ERP 写成已确认自动同步。
- 地理定价句可保留，并在来源区补充 eBay Seller Center FAQ 链接。
- 经营账增加一列 `计费重量/是否触发体积重量`，或写明 `实际重量按 USPS 规则进位后再报价`。
- 压力测试继续保留“假设”和“未计费用”的声明，避免把 1000 美元写成已经发生的现金支出。

## 复核结果

**PASS。** 编辑稿 v1 的日期、时区、calculated shipping 范围、固定运费与 ERP 边界、统一涨幅缺失、地理定价和假设压力测试均与第一方证据相符。上述两项属于来源留档和计费口径的可读性加固，不构成阻断性事实错误，可进入二审二校；执行时沿用同一版本链记录。
