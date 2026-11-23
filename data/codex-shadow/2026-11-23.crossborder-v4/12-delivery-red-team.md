# 2026-11-23 单次交付脚本独立 Red Team

角色：research 独立于当期写稿/发送执行者。审查时间：2026-11-23T14:48:00+08:00。本轮只读取三个脚本并执行纯函数回归，没有执行11/13顶层、没有启动进程、没有操作钉钉、没有读取账户凭据。

## 所审版本

- 11-delivery-continuation.py: c3c31a7e0d799570a18c159998e7f452919fcdd69f4fb180186469bb6096646c
- 13-receipt-git-finalize.py: 58fb8fa2c6b05eb94e26e5a371716f4af57a0d184c791d008ffe86b488481fa4
- 14-readback-selector-regression.py: ed09339aac04cbbd292cbc6ccdcbcd05c09ff1775487708358a8dfd606337045

## 已实际验证

1. 三个文件均实际调用 ast.parse 成功。实际运行 `python3 data/codex-shadow/2026-11-23.crossborder-v4/14-readback-selector-regression.py`，10项测试通过，输出OK。回归脚本只抽取normalized、matching_delivery_messages、delivery_readback_window三个纯函数，不执行正式发送。
2. 本轮扫描未发现旧11/21、11/22期次、Paid、25美分、旧库存账或Amazon Shipping残留。日期为11/23，群固定跨境咨询每日内容，每日键crossborder-v4-group-2026-11-23，账名交运经营账，候选总数13。摘要写USPS、Pango22日与USPS17日，均与当前采集方向一致。17/22为来源日期，不能误改为23。
3. 11的due固定11/23 16:00 +08:00，在25秒以内循环等待；到期前不会运行live。读06-freeze和08的真实记录，要求on_time、dry_run PASS、source all_ok，以及facts/action/copy三角色PASS与审核文件/所审文件SHA一致。等待后重新核配置SHA、内容三份同SHA、input与所审版本SHA、三审SHA。
4. 11使用本期独占flock；等待前、等待后均查询DELIVERED与精确日期/status标记，命中则跳过；ATTEMPTED则阻塞，不自动重试。唯一发送为现有npm run crossborder:v2:dispatch -- --date 2026-11-23 --live。命令超时保留状态，未再发。
5. 正式返回必须同时有零退出码、精确日期marker、本机DELIVERED、delivery_status属于DELIVERED/READ/UNREAD、每日幂等键、目标群及memory标记。脚本自身不以CLI成功退出代替真实回执。ATTEMPTED先写、群唯一解析、auth和wait-delivery由既有dispatch入口负责，本轮没有执行入口，因此不宣称这些运行验收完成。
6. 群读回使用--page-all，并要求complete=true、hasMore=false；一条唯一标题和完整标准化口播匹配。回归已覆盖只标题/部分正文拒绝、双消息保持两条供唯一性门槛拒绝、非法row忽略。读回检查全部候选标题/理由、全部口播段落、A/B、主题、经营账、来源、06-delivery每条非空单位均在同一消息出现。没有只验新闻标题替代全文。上限5页/30条若不全应失败记录，不能假装完整。
7. 读回窗口为attempt前2秒至receipt后2分钟。纯函数实际验证330秒慢回执仍覆盖，UTC/上海时区等价，回执早于attempt拒绝。3次只读查询失败不会重发。送达回执与全文读回分别记录。
8. 13只接受40位固定base，核HEAD、main分支、fetch和push remote精确匹配。仅7个当前回执相关路径可提交，sender SHA manifest键集合必须等于这7路径；hash不符、既有staged、意外未跟踪都停。git commit --only只覆盖这7路径，核新提交唯一parent=base、各blob SHA；推送前远端main仍须base，推送后ls-remote核head。没有force push，用户其他脏文件不在7路径。10-delivery-check为唯一允许新跟踪路径。

## 发现与结论

有条件可用，尚未形成运行通过证据。

R1（待冻结版对齐，实际代码已发现）：11的source flag固定要求URL含`1117-usps-to-close-for-thanksgiving-holiday-on-nov-26.htm`。目前采集原始公告为`.pdf`。06尚未生成，不能断言06会命中。若终稿只放已核PDF，该检查必定false，造成送达回执成功但全文读回失败。应在冻结前使用真实正式源URL进行匹配，或实际核实06采用的.htm第一方正文后再固定。不允许仅为过检查把未经读取的.htm塞进交付。

R2（边界记录）：13依赖11已写DELIVERED状态及7文件hash，未再次独立重验marker/完整readback内容。它会如实提交readback=false的回执，属于可审计失败记录，不代表全文验收通过。该设计不会再发消息。不能把最终Git PUSHED说成内容送达/全文读回通过，必须分别看07/10。

R3（待运行）：审查当时06-final、06-delivery、06-freeze、08均不存在；未有本期PID/WAITING、真实ATTEMPTED、正式回执、分页结果或远端提交证据。因此本记录只证明AST、纯函数10项和静态约束；不能写“今日运行成功”“已等待16点”“今天已送达”。终版产生后核R1、实际PID/WAITING及冻结hash；正式群发后再核07和10，保留不补发边界。

未修改任何发送代码或内容在审版本；本文件由独立Red Team记录实际发现，交执行者修复与恢复验证。

## 静态复核补记：V2原链对齐

复核时间：2026-11-23T14:48:39+08:00。

R1已在当前V2上排除。实际读取02-package-input-v2.json（SHA256 9f2b912b4da79a7d4aada93ba959143418e8ad03a767202dd761217ee1f63c44）与04-action-candidate-v2.md（SHA256 9f9c31c0dd4c6b437e9076bf21cd4cfda7a9254a6a7dcf51ccaf10cb2cadac1d）：两者均实际含11读回flag要求的USPS `.htm`第一方原链。另用Jina实际打开该.htm，正文可见“Nov. 17, 2026”、26日关闭、27日普通恢复、Click-N-Ship打印pre-paid labels；非仅依赖执行者口述。00中的PDF为同公告的另一格式，此处没有为过flag伪造新来源。

本轮仍未有06冻结版、08或PID，结论是当前在审V2与script source flag静态一致，不代表终版hash/PID/运行送达已验。冻结后须再核06实际保留该URL。

内容动作提醒已交执行者，未在此冒充二审：V2正文“确认还没交邮，再问仓库25日最后一班”可能让后台24日ship-by票等到25；应先筛每票平台最晚发货和买家承诺，紧急票问今天真正可用的交运班次，25日只作为后续假日前计划。待一审完成后按正式二审角色复核，不在脚本Red Team中登记内容通过。

## 提交前实际补核：V5冻结及生产准备

复核时间：2026-11-23T14:59:13+08:00。本节替代前文R3中“尚无06/08”的旧阶段事实；旧阶段记录保留，不倒填。

实际读取06-freeze.json、08-verification.json、三审全文、根输入和交付版，程序逐项断言通过：

- 06冻结V5时间为2026-11-23T14:57:11+08:00，早于16:30，on_time=true；08内freeze精确等于06。05-final-candidate-v5、06-final、06-delivery和根MD四份均同SHA256 e4d0420c633d86db1a7f4265e617248c5a6b77ff4e891f07cfb8a281c47ce110。
- 08三角色facts/action/copy均PASS，review_file和reviewed_file的6个实际SHA逐个重算与08一致；三审针对V5，保留早期退回和后续复核。审核与制作身份分开。
- 正式根输入SHA256为2c2700df7f7a4c3413b48b49ab4b932ded3ab05d6548037177f997c46f29b841，与08相同。实际深比较根输入与02-package-input-v5，仅editorial.editor_review批准元数据增加，移除此字段后两份对象完全相等；没有趁批准改稿。
- 根输入研究数13、重点候选5，正文完整在06交付中；交运经营账存在，USPS已核.htm来源在实际06中，命中11脚本source flag。R1在冻结版上实际排除。
- 08记录build.content_valid=true、automated_blockers=[]，A/B各112.6秒；source.all_ok=true、checked_count=2，根严格来源文件对象与08.source精确相同。完整无live dryrun记录为PASS，命令npm run crossborder:v2:dispatch -- --date 2026-11-23、marker表明message not sent。本轮复核这些实际留档和一致性，不冒称重新发起了干跑/来源网络请求。
- 三脚本再次实际ast.parse通过，内容SHA未变：11 c3c31a7e0d799570a18c159998e7f452919fcdd69f4fb180186469bb6096646c；13 58fb8fa2c6b05eb94e26e5a371716f4af57a0d184c791d008ffe86b488481fa4；14 ed09339aac04cbbd292cbc6ccdcbcd05c09ff1775487708358a8dfd606337045。11与08.continuation_sha256一致。前述10项纯函数回归证据可沿用，未改代码不重复制造新测试次数。
- 当日群聊状态只投影status：ABSENT，无ATTEMPTED；memory当日精确success marker=false。07占位状态READY_WAITING_16_00。没有读取、输出任何账号标识或凭据，没有启动发送。

当前结论：内容冻结、三审版本绑定、构建与严格来源留档、干跑留档及静态交付保护均准备可用。可以由唯一执行者选择性提交推送，再固定base启动既有单次继续执行。此时尚未核验本期实际PID/WAITING，不填写运行就绪或送达通过。后续运行审计只读结论/私有memory，不再修改本12以免固定base漂移；正式后仍分别看07精确回执、10完整群读回和Git远端提交。
