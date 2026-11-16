# 冻结候选 v5

## 本期商业问题

同一条美国轻小件链接，为什么 USPS 调价后，有人自动算对，有人仍在用旧运费？

## 标题

eBay 美国 USPS 再调价：运费“自动更新”后，为什么还要重算？

## 行动窗口

- 页面可见更新日：2026-11-13。
- Ground Advantage 费率变化生效日：2026-11-14。
- 页面未写具体小时和时区，只写到日。
- eBay 明确写 calculated shipping 的费率会自动更新，并建议卖家上架时检查运费、用 eBay shipping calculator 查当前价。
- 今天可执行：范围先覆盖全部 active 的美国 Ground Advantage listing；有 11 月 14 日以后订单的，按“受影响单量 × 单票差额”排序。对 11 月 14 日以后无单的在售链接，用当前 calculator 做一次未来订单压力检查。
- 今天可以先不动：没有任何 active 的美国 Ground Advantage listing，且 11 月 14 日后也没有订单；或者代表性重量、zone、目的地 ZIP 与各类运费设置均已复核，差异有明确公式或设置解释，卖家实际吸收后毛利仍高于店铺阈值。

## 卖家经营账

填写列：

- SKU、listing 和站点
- 服务：USPS Ground Advantage
- 运费设置：calculated、flat、free、custom rate table、第三方 ERP
- 包装长宽高、实际重量、后台计费重量，以及是否触发体积重量
- 发货 ZIP、目的 ZIP、zone、地理费率例外
- 11 月 14 日以后受影响订单数
- 同一服务、尺寸、重量、发货 ZIP、目的 ZIP 的 11 月 14 日前历史标签基准
- 买家 listing 运费报价
- eBay shipping calculator 当前报价
- 11 月 14 日后同条件实际标签成本
- 调价前后实际标签成本差额
- 卖家实际吸收额
- 同口径毛利与店铺毛利阈值
- 动作：不改、改价、改 handling、改包邮门槛、改 rate table、换包装、换服务
- 剩余未抽样 SKU、原因、负责人和下次复核日

筛选与覆盖：

1. 先列出全部 active 的 Ground Advantage listing，再用 11 月 14 日后的订单量乘单票差额绝对值排序。没有订单的在售链接不能从候选范围消失。
2. 影响金额最高的链接至少覆盖 4/8 oz、12/15.999 oz、1 磅及以上；近距离、远距离、同一 zone 的不同 ZIP；calculated、flat/free、custom rate table 或 ERP。某格没有样本时写明“无样本”。
3. 同一 SKU 必须固定包装尺寸、实际重量、service、发货 ZIP、目的 ZIP 和日期，再分别记录买家 listing 报价、calculator 报价、实际标签成本，不能拿估算代替成交后的实际成本。
4. calculated shipping：查基础费率是否更新，同时查重量、尺寸、handling、折扣和包邮规则是否仍匹配。flat/free/custom rate table：查卖家实际吸收差额和毛利。ERP：做一次订单或同条件影子报价；无法确认更新时，先停该工具的批量改价。

## A/B 黄金 3 秒

A：USPS 调价，自动更新就够了吗？

B：11/14起，重量和邮编重算。

## 口播正文

跨境卖家注意……今天老王只讲一件事。美国 USPS Ground Advantage 在 11 月 14 日已经调价。eBay 只明确 calculated shipping 会自动更新，其他运费设置仍要核对。

第一，公告没有统一涨幅。同一票要固定服务、包装尺寸、实际和计费重量、发货 ZIP、目的 ZIP 和日期。实际价受重量、zone 和地理定价影响，同一个 zone 里的不同邮编也可能不同，单一百分比不能覆盖全部链接。

第二，范围先看全部在售 Ground Advantage 链接，按 11 月 14 日后的受影响单量乘单票差额排序。高风险格子要覆盖常见重量、近远 zone、同一 zone 的不同邮编，以及 calculated、flat、free、rate table 和 ERP。买家 listing 报价、calculator 报价、11 月 14 日后实际标签成本要分三列，再和 11 月 14 日前的同条件基准对账。

第三，calculated 查重量、尺寸、handling 和包邮公式；flat、free、rate table 算卖家实际吸收额；ERP 先做一票同条件实测。假设 1000 单全部受影响、每单增加 1 美元、都由卖家吸收，成本增加上限是 1000 美元；如果 calculated 完整转给买家，就不是卖家现金流损失。

active 链接暂时没单，也要用 calculator 检查未来订单；只有没有 active 链接，也没有新订单，才能直接不动。差额吃掉毛利就改价、handling、包邮门槛、包装或服务；代表性测试通过且吸收后毛利安全，今天先不改。

我是老王，跨境生意，先算利润，再谈爆单。

## 来源和事实边界

- eBay Announcements，seller_news_team，页面可见 `Update 11/13/2026`：USPS 于 2026-11-14 调整 Ground Advantage 费率；calculated shipping 自动更新；卖家应检查 listing 运费并使用 eBay shipping calculator。
- 公告没有统一百分比、具体小时或时区。
- 地理定价和同一 zone、不同目的地 ZIP 可能价差：https://community.ebay.com/forum/announcements-57928/topic/usps-geo-based-pricing-updates-effective-october-18-2026-486459/
- Ground Advantage 重量档与问答：https://www.ebay.com/sellercenter/shipping/choosing-a-carrier-and-service/usps-and-ebay-labels
- USPS 体积重量规则：https://www.usps.com/ship/ground-advantage.htm
- calculated 自动更新只覆盖 eBay 明确写出的这一项。flat、free、custom rate table 和第三方 ERP 的分支是卖家经营核对方法，不能写成 eBay 已宣布这些工具失效。
- 1000 单、1 美元、1000 美元是“全部受影响且全部由卖家吸收”的假设上限，不是 USPS 或 eBay 公布的实际涨价，也不是实际亏损。
