# 2026-11-25 一审一校：事实与原文 V2

审核角色：独立事实审核 primary（/root/produce_1123/primary），未参与本期执行稿编写和发送。
实际审核时间：2026-11-25T14:50:58+08:00
结论：PASS，仅代表下列固定 V2 的事实审核；二审动作、三审表达与正式完整严格校验尚须独立执行。本记录不代替其通过。

## 所审版本

- 02-package-input-v2.json：SHA-256 `61bbf698191fc06e5244ef14da71e8740f8ff4212fac6794051bfa6a9e973db8`
- 04-action-candidate-v2.md：SHA-256 `2117554527daf5d7e7202daa1e7e695615bc9764aa616e4d7f8cd4d237af601c`
- 00-candidates-and-sources.md：SHA-256 `540555d8776f8bb7acd330197ab4eeac7433950433426728d94417f176b948e3`

实际全文读取 JSON、交付候选稿和采集档；首次合并输出截断后另读完整交付稿及采集前段补齐，不以未读内容记功。5条候选评分各分项与总分重算一致，13条研究事件与5重点对照一致。

## 原文核对与证据

1. 雨果 https://www.cifnews.com/news/50c9ab1eb05a 。实际 Jina 正文含“2026-11-24 12:13（北京时间）”。仅假日退货关注触发，未当成首扫机制新生效。消费者日期不充卖家退款截止。
2. Walmart https://marketplacelearn.walmart.com/guides/returns-policy 。实际公开原文可见 Last updated on Aug 31, 2026。退款节区分门店收件退款与 Walmart.com/Customer Care 退回承运首次扫描退款；有客服及特殊流程例外。多中心默认最近但 item-level 可覆盖；无效地址导致转 Walmart 中心才可能 failed delivery fee，未列统一金额。V2适用范围排开WFS、门店、Keep It、换货、特殊品类，不把所有退款都等同首扫或立即买家到账。
3. Walmart https://marketplacelearn.walmart.com/guides/Payment-statements-and-transactions 。实际普通HTTP剥离脚本后的可见正文为 Last updated on Nov 16, 2026。旧web索引Sep24不是当前页面日，V2已采用11月16日。Payments→Transactions按PO/CO、type/date检索；报表列有PO、Order Line、Transaction Type、SKU和Refunded Retail Sales。Pending/Settled为结算状态，不能当客户到账证明。按PO+行/数量核对属运营建议，未伪称Transactions有任意行号筛选器。
4. Walmart https://marketplacelearn.walmart.com/guides/Issue-a-standard-refund-in-Seller-Center 。实际可见Sep24,2025，未符合自动退款条件时收退货中心后48小时发起退款，否则平台可代退。Orders下Returns、Received→View Returns筛已收，展开Return Details。官方同文FAQ在公开搜索可见展开答案：最多5,000条previously processed returns，含refund channel与return reason；普通HTTP/Jina折叠FAQ只显问题，本次未声称直接HTTP已展开。V2保留“已处理”范围，未把导出列当所有在途/退款金额/目的地全量表。
5. 额外人工路径参考（不在4条机器strict覆盖内）：退货中心设置 https://marketplacelearn.walmart.com/guides/Order%20management/Returns%20%26%20refunds/Update-seller-fulfilled-return-center-settings ，公开原文可见May4,2026，Shipping Profile→Returns→Return Centers。客服退款争议 https://marketplacelearn.walmart.com/guides/Order%20management/Troubleshooting/Dispute-a-Walmart-Customer-Care-refund ，公开原文可见Sep10,2025，可按PO/RMA展开并查Dispute this return；按钮缺失可因未退款/过窗/已争议。V2按本票资格/时限核，不把45天套所有交易、不保证赔款。

## 5候选与金额复核

- eBay亿恩原页实际打开标题及正文，可见2026-11-24 09:25:59；可选买家鉴定费不说成卖家强制扣项，缺官方原文淘汰合理。
- Ozon AMZ123原文实际打开可见2026-11-24 06:40，三类改百分比、已运行卢布活动到期结束。未有第一方政策，V2淘汰且不叫卖家提前终止旧活动。研究记录阅读252为早前一次观察，本次页面1047，不据此推涨幅或热度。
- 原纸生意社Jina实际原文可见2026年11月25日08:30，2818与月初2978对应约-5.37%，24日2848与25日差30元/吨。成品纸箱降幅不由原纸指数直接推出，V2淘汰。无厂函不称全部保价合同今天失效。
- 易仓原文Jina实际读到【2026年11月25日讯-易仓】及10月功能更新，V2不把发表日当全部功能刚生效，不把模块更新当本店库存已准确。
- 正文没有虚构金额、客户案例或固定损失。退款售额、结算扣项、库存成本分列；同币种refund行求和与应回数减已验收数是自建核对口径，后者只能视待核差额，不代表物理丢失；V2已经保留正常在途/未验收状态及负数映射复查。

## 发现、处理与复核

F01（预核阶段）：长路径抓取部分仅壳；Payment搜索索引日期过旧。处理建议为同文官方成功短路径，按普通HTTP当前可见11月16日，不改checker、不借元数据。实际复核V2四个URL与日期采用正确值。
F02（预核阶段）：已处理报告容易被误说全量在途，48小时容易被写成等质检或所有已退单再手退。实际复核V2正文、窗口和风险边界均已限定；未自动标准件从退货中心收件起算，已退不重复。
F03（本次完整V2）：未发现需退回修改的事实阻塞。退款触发不等银行到账、普通在途不等可索赔、签收不等可售；正文、台账及来源范围一致。没有实际店铺数据，本次只核公开规则与编辑的操作建议，未声称客户操作实测通过。

## 严格源预检边界

在收到冻结稿前，以现有verifyCrossborderV2Sources只读执行，4个最终URL的日期/markers逐项真实PASS；未覆盖全文所有操作参考，也未执行对冻结内容的完整build/strict/dryrun。正式执行者仍需对V2或后续冻结版运行原流程。任何修改导致SHA变化，相关事实差异须回审。
