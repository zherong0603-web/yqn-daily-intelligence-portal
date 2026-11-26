# 2026-11-26 独立一审一校：事实与来源 V2

审核人：primary（/root/produce_1123/primary），独立于本期制作/发送执行者。
实际完成时间：2026-11-26T14:42:46+08:00
结论：V2事实审核PASS。仅表示下列固定版本事实核对通过；不代二审操作、三审口播时长/表达、完整build/strict/dryrun或送达通过。

## 版本与实际读取

- 02-package-input-v1.json SHA-256 `859782637837488d48939b7610d25e787d79a90a945093cdd61ddbd932176b15`
- 04-action-candidate-v1.md SHA-256 `bbed095e70f90b2957568dc815ac74da76ab4f6fb77016207ffd6eff2497d967`
- 00-candidates-and-sources-v1-before-review.md SHA-256 `4faff6887c3c23e31ebd5a4e6aa2500c1bc6face614b550511959cb14d46fb46`
- 02-package-input-v2.json SHA-256 `67a9660515aa2d73aa7b94928ec9d6c5e43109431ab32566e626f69d0236ffc3`
- 04-action-candidate-v2.md SHA-256 `93830ebb494a00bd412e9fde6373e17f050eaddf3ad0d00839b22cd25220d8fb`
- 00-candidates-and-sources.md SHA-256 `1cc6ef2cc38f9c249631a5c6d737e276269497d8b6b4354b2f2056543183cc1f`

已全文读取V1完整JSON、交付稿与采集材料；实际逐字段比对V1到V2，只有正文删除两处重复句，没有改变来源/候选/事实/动作范围。V2正文完整内容与V1差异已读取。采集00修正前后只有观察截至时间变化，14:42:05实际复核新时间14:41:52已经发生。5重点各维度总分重算正确，10事件含5重点，同事件未拆开凑数。

## 一手原文与人工操作参考

1. 主来源 https://www.maersk.com/news/articles/2026/11/25/shipping-instruction-requirements-fmc-trades 已实际公开原页读取。可见25 Nov 2026，原文为FMC监管trade文件要求提醒。Price Owner列于Shipper、Consignee或Notify之一；代理代表Price Owner时，代理名称在Shipper或Consignee地址体现On Behalf Of或As agents of关联。不能只加Notify地址当代理要求完成。原文未定义Price Owner，V2明确不得直接认卖家/付款人/实际货主，而由本票合同/承运确认。原文仅说可能延迟BL释放，没有新统一生效/截止、罚款、延迟天数或海关扣货结论。V2正文及边界一致。
2. https://www.maersk.com/support/faqs/how-do-i-submit-my-shipping-instructions 实际原文读取：hub输入shipment number→View Details→Summary任务区Submit Shipment Instructions；五tabs填写提交，processed后出digital verify copy。V2用本票Shipment Details任务及已提交后核对稿，未说提交就即时放单。
3. https://www.maersk.com/support/faqs/how-do-i-make-an-amendment-to-my-verify-copy-bill-of-lading 实际读取：View Details→Bill of Lading widget→Amend verify copy→SI页修改→review提交→确认后revised verify copy。V2未教无权限者绕开，也未把核对稿等同最终BL/release。
4. https://www.maersk.com/support/faqs/who-can-submit-shipping-instructions 实际读取：Submit、Amend verify copy、Amend bill of lading权限主体各异，原BL修改仅transport document receiver。V2统一称“有权限”方核实和处理，没有把Booked by提交权泛化为全部改单权；卖家无权时通过授权订舱方，不分享凭据。
5. 上述3个FAQ无页面可见日期，仅人工操作范围参考，不伪填published_at、不冒称纳入本批dated严格源。主来源既为当期market_signal又为fact_basis，未虚构第二独立新闻。

## 5重点候选、数学与口径

- 1主选来源11月25日，今天待交/待核SI有动作；公告日与本票截止分开，来源未标时区，不造中国统一截止。本票正常已经确认不重复提交。
- 2 AMZ123 https://www.amz123.com/t/PrvZN4hH 实际Jina正文标题、VIPON及2026-11-26 06:09可见，阅读316是单次快照，非赞转或客户真实案例。未核归因/官方现行后台前不以当天0单叫卖家停投，作为淘汰理由不需证明所有账户均无报告入口。
- 3 Amazon Ads guided campaign creation官方原文已实际读，可见November23,2026，美国控制台、API coming soon，可编辑分组/关键词及排除产品，自动有货不等利润保证。与提单非同经营问题，淘汰符合范围。
- 4 Walmart官方release note实际读，可见Nov23,2026；按时交运且已赢得Ship with Walmart Seller Protection claim，才对纯晚到/未达负评划线且不计绩效。V2保留条件，没有买面单就自动豁免的承诺。
- 5 Maersk欧线PSS原文已实际读，可见25Nov2026，PCD12月14起、箱型/方向/非SPOT与其他费用口径分别核。V2淘汰，没有把订舱当天当锁费时点。
- 正文没有捏造客户/金额。经营账将费用凭证、币种及未核状态分别保留；只将本票确认且非重复文件费/改约费相加，不套2027美加装港出口75美元到本票。资金占用风险没有假装实际现金扣款。

## 发现问题、退回与复核

F01：初审实际系统14:41:24时，00已写观察14:35至14:52，未来结束时间不能作为已发生采集记录。14:41指出并退回整包最终通过。制作方保留00-candidates-and-sources-v1-before-review.md，改当前00截至14:41:52。14:42:05实际重新读取并diff确认只改此行，新SHA为上列1cc6...，问题关闭，不把原错误抹掉。

V1时长：执行者主动发现正文连钩子口号可能超120，另存V2压两处重复；本角色只事实差异复核，不代主编计时或填写时长通过。口号是否进入完整A/B音轨、时长和术语可听懂度交三审实际检查。

V2事实未发现其他阻塞：代理措辞正文较简短但MD账与风险边界保留代理名称/关联/地址位置，不能由此声称已具备真实改稿权限或所有主体已经承运接受。截止未明先书面问本票；若过窗找承运核处理，不保证放单。

## 严格源预检与限制

已在稿前以现有verifyCrossborderV2Sources对主URL只读HTTP预核真实PASS：日期25 Nov 2026，markers Price Owner、documentation parties。未改变源抓取器、安全阈值或生产配置。此预检不替代对最终输入的完整严格源检查；执行者仍须按原交付流程运行。无真实客户订舱数据或后台实测，本审核只证明公开原文和当前编辑稿的事实一致。
