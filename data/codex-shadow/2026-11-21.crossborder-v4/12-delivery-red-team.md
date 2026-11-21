# 2026-11-21 交付链独立 Red Team

审核角色：delivery_audit_1120。执行与此审核分开。
审核时间：2026-11-21T14:38:58+08:00。

当前结论：实际脚本主体静态核验与标题选择器回归通过；回读窗口末端存在一项待修正。尚未冻结、干跑或启动，未记运行就绪和已送达。

## 实际资产及证据

- 11-delivery-continuation.py；SHA-256 b6d6c1a716f2571aebfc1268b637155f20e2a37da4fbd4231ce8f17ca8c5ea99；AST解析通过。
- 13-receipt-git-finalize.py；SHA-256 f8e318e184b21da02f13d0d03e234b5afa4e87ebd018d4bed68519f985a1796c；AST解析通过。
- 14-readback-selector-regression.py；SHA-256 527373650aed43672ccb3b2e78293b5a511221e47eaf774211f40e888c6eb8b6；AST解析通过。

独立实际运行14号回归脚本，7/7通过。测试仅AST提取normalized与matching_delivery_messages，不运行发送块。另以20日原窗口只读投影实放，冻结商业标题与完整正文正确唯一匹配1条。

## 已核实的边界

1. 实际运行日期、锁、指针、归档、幂等键与Git提交说明均指向2026-11-21，无19/20日旧运行字面量。固定群仍为跨境咨询每日内容；16:00等待、同日窗口、ATTEMPTED拒重试和精确送达标记均保留。
2. 选择器要求非空标题和非空正文，标题可用CLI日期标题或冻结稿首行，且完整正文必须匹配。错标题、正文残缺、空条件、畸形记录和重复消息负例已验证。完整页、hasMore=false、唯一消息、5候选及取舍、全口播段、全非空交付单位校验均保留。
3. 本期尾程经营账和shipping.amazon.com/insights-and-news/peak-surcharge-2026来源匹配已设置；memory摘要为Amazon Shipping美国尾程换档。该静态检查不代替实际内容、来源日期与候选数量审核。
4. 发送前保留三审/所审版本、冻结终稿、交付版、根快照和机器输入SHA检查；正式调用仍为单次npm dispatch --date --live。finalizer固定base、main、已授权origin和7个当期回执路径限制均保留，不改其他已暂存文件、不force推送。
5. 未调用发送、新任务或新tab；读取群信息只投影text/createTime，未读取账号标识或凭据。

## 必须修正并复核

query目前以begin=attempted_at-2秒起算，end=begin+5分钟。正式命令允许360秒，且attempted_at取自live入口开始时间，构建和来源检查可能占用部分时间。可重现边界：命令开始330秒后取得有效送达回执，消息落在6分钟命令时限内，却位于当前查询上界之外，造成全文核验假失败。建议将end锚定已核实的delivered_at后若干分钟，仍保留begin、分页完整性、唯一消息及全内容校验；增加延迟送达仍落入查询窗口的负例/边界回归。

## 运行前待核

当期机器输入、06冻结、08校验、三审哈希及候选12条口径；真实完整dry run；准备提交和远端一致的固定base；caffeinate断言、实际PID、WAITING与16:00 due。当前这些资产未齐，本审不提前记通过。

## 回读窗口修正复核

复核时间：2026-11-21T14:41:08+08:00。

- 11-delivery-continuation.py；SHA-256 a03ba2f08bb13914e6463740f03842d66d2a924e06ff6c4444e834c695156a91；AST解析通过。
- 13-receipt-git-finalize.py；SHA-256 f8e318e184b21da02f13d0d03e234b5afa4e87ebd018d4bed68519f985a1796c；AST解析通过。
- 14-readback-selector-regression.py；SHA-256 70167a3314bc9835f0a3cc300822d7cb131e711045c1c4f07c884cf31296454b；AST解析通过。

结论：窗口缺陷已实际修正，当前本期脚本静态复核PASS。保留前述发现与退回记录，不追认旧版本通过；部署和消息送达尚未核验。

实际delivery_readback_window以attempted_at前2秒为起点、已核实delivered_at后2分钟为终点，拒绝送达回执早于尝试。实际群读回query调用该函数生成的begin/end，原分页完整性、hasMore=false、唯一消息、候选取舍、全部口播及全部交付单位校验保留。

独立重新运行14号纯函数回归：10/10通过，包括330秒延迟送达仍在窗口、UTC与北京时间一致和时间倒置拒绝。无发送副作用。脚本memory候选口径已改14条，与执行者报告研究池一致；运行前仍以最终机器输入与00候选档案再次核对。

当前审核范围仅实际代码和上述测试。06冻结、08验证、固定Git base、caffeinate及PID/WAITING仍属部署验收；不得把静态PASS写成已发送。
