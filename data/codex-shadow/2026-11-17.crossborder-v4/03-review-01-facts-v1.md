# 跨境早知道 V4 · 一审一校事实复核

- 审核角色：独立事实审校，未参与初稿和编辑稿。
- 审核时间：2026-11-17T14:41:52+08:00（Asia/Shanghai）。
- 所审版本：02-editor-cut-v1.md；SHA-256 6bc73a30be9dceb5a271fff6ab4c7ca96cb03d6e8cdbf3ad4a0c4cdd51b2135b。
- 候选版本：00-candidates-and-sources.md；SHA-256 ea29c810e76726537c2084ab8a52be66003dfcefe285fd8c79e6d5fde0270f41。
- 结论：正文核心事实和算式经复核成立；v1 有两处口径需改，修订版复核前不得进终审或发送。

## 核实证据

1. [UPS 美国新闻室首发](https://about.ups.com/us/en/newsroom/press-releases/customer-first/ups-scales-seasonal-workforce--eyes-ninth-consecutive-peak-seaso.html) 页面可见日期 10-07-2026、正文署 “Oct. 7, 2026”。在 New Package Protection 小节，UPS 明确是合资格货件，收件人向司机提供 PIN 后才交货。首发稿未写价格或 11 月 16 日生效；不能据此推断所有 UPS 包裹都要验证码。
2. [UPS 美国公开费率目录](https://www.ups.com/us/en/support/shipping-support/shipping-costs-rates) 的 UPS Protected Delivery 项，明确 2026-11-16 生效、选用该服务的货件公开费率 $10.70/票、PIN 通过后放货。未标页面发布日或生效具体小时、时区；没有统一卖家报名期限。保留此链接在终稿/交付稿事实边界里，标注“页面未标发布日”；不能用生效日或检索日代填 published_at。单票发运前确认可用性是建议动作，不是 UPS 宣布的统一截止时刻。
3. [Supply Chain Savings 当期线索](https://www.supplychainsavings.com/articles/ups-protected-delivery-amazon-peak-fee-budget-2026/) 页面可见 Published 16 Nov 2026 13:54 UTC，实际北京时间 11-16 21:54，距今日开工约 17 小时。此页明确含 UPS 生效日、价格、验码要求，链接回上述 UPS 费率目录。页面同时声明此文 AI-assisted、无独立人工审核；仅作 market_signal，事实来自对 UPS 两页独立交叉核验。日期化 UPS 新闻室页可作 fact_basis；不要将无公开发布日的费率目录硬塞为带日期的结构化 evidence。
4. 此次范围只写美国仓、可控制交付选项的卖家、已确认合资格货件。公开费用为每 shipment，经营账用“票”而非“每件商品”；不能推定所有服务/账号可选，也不能承诺免丢、保险赔付、特定重派次数或价格。
5. 独立复算：100 × $10.70 = $1,070；$1,070 ÷ $150 = 7.133…；7 × $150 = $1,050，差 $20；8 × $150 = $1,200，超过费用 $130。8 次指假设下实际可避免的净损次数、未计重派和通知成本；不能用历史投诉总数等同可减少次数。

## 问题、改法、复核

- A 钩子 “没验证码，UPS 不放货” 单独听容易被解读为 UPS 全面强制。建议 “UPS 验码单，没码不放。” 或等义短句；本稿后文虽有限定，钩子仍须独立准确。对照官方两页，改法可消除扩大范围，待复核写入。
- 开头 “一票 10.70 美元” 应明确“公开价”；试用筛选的末句建议用 “同类预计发货量 × 实际报价” 与同口径基线净损比较，避免将不同票数的历史净损与此次服务费直接比较。可在可填经营账说明：历史净损仅是理论上限，实际可避免部分未知；合资格且预计可避免净损覆盖费用才小批测试。算例不改。
- 机器源核验建议：当期线索取 published_at=2026-11-16（标记 16 Nov 2026、UPS Protected Delivery launches at $10.70 per shipment、shipment release after PIN confirmation）；UPS首发取 published_at=2026-10-07（标记 10-07-2026、Protected Delivery, a new service for eligible shipments）。严格校验器实际运行结果由后续构建记录保存，本记录不预填通过。


## 修订版复核

- 复核时间：2026-11-17T14:43:41+08:00（Asia/Shanghai）；复核版本：03b-editor-cut-v2.md；SHA-256 4aa75682b3f78a705a7af79bd3fce23861090c49a30423888443538bbaec196d。
- A 钩子改为“验码交付，没码不放货”，语义限定在选择该服务的交付。开头明确 10.70 美元为公开价、仅合资格件可以选择，生效日仍为 11 月 16 日。
- 比较口径改为同一类货、同样发货票数；未把已发生投诉当成可避免损失。算例不变，必要的费用排除仍在事实底稿；仓库账户、收码与重派均留作确认条件。
- 复核结果：一审事实通过，可交二审；自动构建、严格来源检查、试用结果与实际扣费均不在本次事实通过范围。
