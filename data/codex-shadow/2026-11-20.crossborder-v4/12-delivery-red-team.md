# 2026-11-20 群发链独立 Red Team

审核角色：delivery_audit_1120，独立于内容执行与发送执行。
审核时间：2026-11-20T14:45:24+08:00

当前状态：模板预审通过；本期部署待核验。尚未审核不存在的20日脚本，不记本期发送就绪，不记已送达。

## 实际审阅资产

- scripts/sendCrossborderV2Dws.mjs；SHA-256 3a648f4c1d472559a49003b449da0407b404b361f2aee5196335a9725e17bd72。
- data/codex-shadow/2026-11-19.crossborder-v4/11-delivery-continuation.py；SHA-256 95e1b73a54759cd9b308b2a54a632bd8befe689a01226795c36228fcf7b56851。
- data/codex-shadow/2026-11-19.crossborder-v4/13-receipt-git-finalize.py；SHA-256 b2bdb05f50704cfeb0805f13d76d690608ced677078e681eea264d7936d5995e。

19日两份Python模板均通过AST语法解析。20日群聊状态无记录，未出现ATTEMPTED或DELIVERED。现场系统时钟为20日14:43左右，早于16:00。

## 审核发现和裁决

1. 固定群名、当日幂等键、日期同日校验、正式入口16:00保护、唯一群解析、ATTEMPTED拒重试、wait-delivery回执及精确成功标记均在实际代码中存在。模板可以复用；不得靠修改时钟、改规则或直接CLI绕过正式入口。
2. continuation在等待前及等待后核三审PASS与审核文件/所审输入SHA；正式发送前核06-final、06-delivery、根快照三份SHA、机器输入SHA及所审终稿SHA。20日落盘后必须核实所有引用指向20日同一稿件，不能只换消息日期。
3. 必须同步替换所有19日运行日期、归档路径、锁名、指针、幂等键及Git提交说明。账标题须为本期实际标题“提柜经营账”，来源检索须匹配本期APL Logistics公告原链，memory主题摘要须改为本期事实。不得把来源自身18/19日可见发布日期改成20日。
4. 群读回只投影消息正文与创建时间。完整页、无更多页、标题唯一、5候选及取舍、全部口播段、钩子与全部交付行都要匹配。若已有有效送达回执而正文未完整读回，只能继续只读验收，不重发，也不能声称全文已验证。
5. finalizer只在sender已DELIVERED后读7个明确运行回执文件，核sender哈希清单、固定base父提交、main分支和已授权origin地址；仅commit --only这些路径，无force，并核远端提交。其他工作区/暂存区改动不纳入。20日启动时必须传入本期准备提交的真实40位SHA。
6. 一次性continuation依赖本机不休眠与独立进程。须用caffeinate保护，启动后实际核PID、WAITING_UNTIL_16_00、due_at、冻结SHA和无attempt状态；这些仅证明已进入等待，不能记为送达。若16点失败，状态与原因必须保留，已有attempt不得自动重试。
7. 模板不输出凭据或DingTalk账号标识，回执归档不含消息ID/用户ID；公开Git提交前仍需对本期全部新增内容做凭据与私人运行数据检查。

## 待复核

- 20日11-delivery-continuation.py及13-receipt-git-finalize.py实际内容、语法与SHA。
- 真实三审、冻结、严格来源及完整干跑结果，不以此交付链审核替代内容审核。
- 已启动等待进程和16点后的唯一送达回执、完整群读回、远端回执提交。

## 本期实际脚本静态复核

复核时间：2026-11-20T14:47:03+08:00。

- 11-delivery-continuation.py；SHA-256 dfec9889eeafdf4b6f0282b8e0bccb55604adb20ddbd8f3946183ade30846250；AST解析通过。
- 13-receipt-git-finalize.py；SHA-256 4bd6670b23e722904dc24115afb34a46f94957bb8ebf015c09f57f8127f822e1；AST解析通过。

结论：本期两份实际脚本静态复核PASS，允许在冻结、三审、严格来源和完整干跑证据齐全后启动。运行部署尚待核验，未记等待成功或消息送达。

复核证据：全部运行日期、锁、指针、归档、幂等键与Git说明均指向2026-11-20；未残留19日运行字面量、旧回款经营账或旧TikTok来源匹配。提柜经营账、APL公告原链片段和本期港口摘要已改。源码的18/19日新闻日期只用于本期真实公告，不被当作20日发布日期。

固定群、16:00等待、当日到期保护、ATTEMPTED拒自动重试、三审及所审版本SHA、终稿三快照SHA、正式npm入口、合格回执和精确成功标记均保留。群读回完整性检查保留；回查失败不会触发再次发送。Git阶段仅处理本期7个回执路径，核sender哈希清单、固定base、main、授权origin地址、提交parent和远端提交，无force。

部署前仍须实际核：08-verification三审与输入路径及哈希，06-freeze实际冻结时间和3份终稿哈希，本期研究候选总数与脚本memory摘要12条口径，固定base参数，caffeinate/PID/WAITING及due_at。当前实际脚本静态PASS不能替代这些运行证据。
