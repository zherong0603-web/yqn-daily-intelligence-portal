# 2026-11-28 交付链独立 Red Team

结论：静态及无害回归PASS。仅限下列实际脚本版本；今日内容审核、冻结、构建、严格来源、完整dry run、固定Git base与运行进程尚未由本轮验收，不能写准备完成或已送达。

审核角色：copy_review，独立于制作/发送执行者。实际审核时间：2026-11-28T14:44:35+08:00，Asia/Shanghai。

## 实际读取及所审SHA

已完整读取本期11/13/14/15脚本及16 fixture，逐项diff对比27期，检查发送/失败/回读/Git路径和日期。本轮只写此审核记录，未修改脚本、配置或调度，未运行11/13顶层，未调用发送或修改HEAD。

- 11-delivery-continuation.py：8114c29f6ba71b4e5723e027fefeb7801c14afec257ba5bd939e2e030994ed0c
- 13-receipt-git-finalize.py：542886735f366229b8187aecd9bc81e267a7739ebf08eae7d30783d202377f4d
- 14-readback-selector-regression.py：1c9be0f34aea5c7f6c15cbbd59e936d25f0d03e58beb4d200f9f175fa7ed4a69
- 15-failure-continuation-regression.py：1566d340ebe19fd01310f1bc8433f102b3443a4309f48f0c4e073eb0736e0605
- 16-candidate-list-rendering-fixture.json：b1a314cf9d05ef31f2630d2baf5bcab4f586808756547a9c61077ac4e831b016

四脚本AST解析及fixture JSON解析实际通过。程序比较11所有函数AST与27期完全相同；13/14/15仅日期及提交说明替换后与27期逐字相同；16与27字节相同。11实际差异为运行日期和锁名、预算经营账、官方dynamic-budget-control来源flag及当期主题memory摘要，未放宽任何函数逻辑或安全门。

## 独立实际回归

1. 实际运行本期14，17/17通过。仅AST抽纯函数，不执行sender顶层。包括26实际自制稿候选4行被DWS重置为1.的完整文本fixture、金额/日期变化、缺候选/缺理由、候选外步骤编号和区域内非候选行拒绝；空/错标题、正文残缺、重复消息及慢回执窗口亦覆盖。
2. 实际运行本期15，7/7通过。仅抽白名单辅助函数并用临时目录写模拟07/08/memory，未接触真实发送状态。包含fresh本日live journal投影、防旧日/dryrun/旧时间/原始字段泄露、ATTEMPTED不重发、当前caller启动失败实际AST分支，以及真实无害Python进程树超时终止。无npm/dws发送副作用。
3. 16只包含此前本栏目公开来源候选的expected/rendered行及投影SHA，没有其他人消息、账号标识或原群消息时间；旧26日期用于回归证据，未混入本期运行幂等键。

## 发送、失败与回读边界

- 本期date、锁、archive、指针、每日key、Git说明为2026-11-28，固定群仍为跨境咨询每日内容。16:00前等待，同日窗口与原自动化配置hash检查保留；不创建周期任务或新tab。
- 外层只有一次正式dispatch调用。发送前/等待后两次拒绝未核验ATTEMPTED，DELIVERED或精确成功marker跳过。现有sender的无attempt只读预检有限恢复仍在，最多3次且只允许指定瞬时错误，不能当发送重试；300秒内部预算低于父360秒。
- 11为唯一批准dispatch建立新session，超时TERM后必要时KILL本进程组并回收直接子进程；启动OSError走固定脱敏reason到stop，不输出异常原文，不重跑live。15实际确认无可运行的测试子孙残留，不称已测试真实发送超时。
- stop从本日live且当前dispatch时间窗取白名单stage/code/source索引，未知不猜来源；07/08/status/memory回填阻塞或未核验，不把失败遗留为READY。日志不带URL、原始错误或账号字段。
- 发送前复核实际三审角色和所审SHA、冻结06/root/JSON同版；合法回执、每日幂等键、目标群、精确marker均需通过后才记成功。静态模板中的PASS摘要只在这些实际门后写，不表示当前三审已经发生。
- 读回保留完整分页complete=true/hasMore=false、完整标题正文唯一匹配、所有候选/完整理由、各口播段及全部交付unit检查。列表等价仅在指定候选节，完整已知title+reason且单行1至5.才试行首变1.；其余金额、日期、步骤或缺事实仍拒绝。严格匹配数与ordinal调整单独留存，没有泛删数字。
- 读回窗口以attempt前2秒至已验证delivery后2分钟，避免慢回执落在窗口外；读回失败不重新发送。

## Git及待部署验收

13仍绑定启动时固定base、main、已授权origin和push URL，仅7个本期回执路径、写入后manifest哈希及commit parent检查，push后核远端；不force、不覆盖其他暂存文件。BLOCKED/SKIPPED不冒称成功提交。本轮未执行13、未提交或推送。

预算经营账与官方source flag已按当期主题设置，但必须在最终冻结稿实际存在且与机器输入同版后核验。主题memory摘要的公式/来源日期也需随最终事实与内容审查保持一致，本轮只核技术适配，未批准这些新闻事实。

运行前仍须独立核：真实三审及06/08 SHA链、正式构建/strict/完整dry run、Git准备提交远端一致的固定base、caffeinate与实际PID/WAITING、无当日attempt。当前静态PASS不替代这些工作，亦不代表内容已成音或群消息已送达。未发现本次适配新增的程序阻断缺陷；如果后续改脚本或正文相关flag，需按新SHA复核。

## 最终准备独立实际复核与封存

独立research，实际时间2026-11-28T14:55:19+08:00。全文读取06/08/三审V4、00及退回修订链、前技术审记录；仅追加12，不运行11/13顶层、发送或改其他共享资产/HEAD。

实际程序断言全部通过：三审六SHA重算一致；V4冻结14:53:32+08、on_time=true且06与08对象一致；四交付MD及05最终所审稿同SHA e95eb49300ce8a91e78b6dc37d84e89f2b9a4708713845adfcdc927126e79c24。根输入SHA 81249e26e63c1bd066f99ae10d1f250334c77662f60b65b441db21526e52801a，只还原editorial.editor_review与publication.send_allowed后deep-equal已审V4，未改内容。正文精确提取同JSON且无URL。

研究10/重点5，00当前SHA ce41670c4367fa55c59559bfc4fe1e3a44c2a8071c53e331d655c89a0bcef38b。F01 MSC日期、C01-C03首句/外发流程/候选来源及C04回应出处的旧退回保留，V4各审真实复核，不追认旧版。五候选日期/原链及WDR归属已补，对外删流程说明没有删除实质边界。

build有效、blockers空、完整A/B113.1/113.6为文字估计；strict2/2与根sourcechecks同对象，27日媒体与2021官方既有功能分别明示。两份help人工Jina已核可见更新日，普通HTTP壳不冒自动strict覆盖。完整无live干跑PASS及精确未发送标记留08，journal五阶段实际PASSED；此审复核留档，未重复发起网络干跑。

11/13/14/15 AST及16 JSON再次实际通过，SHA全同前独立技术审：
- 11-delivery-continuation.py：8114c29f6ba71b4e5723e027fefeb7801c14afec257ba5bd939e2e030994ed0c
- 13-receipt-git-finalize.py：542886735f366229b8187aecd9bc81e267a7739ebf08eae7d30783d202377f4d
- 14-readback-selector-regression.py：1c9be0f34aea5c7f6c15cbbd59e936d25f0d03e58beb4d200f9f175fa7ed4a69
- 15-failure-continuation-regression.py：1566d340ebe19fd01310f1bc8433f102b3443a4309f48f0c4e073eb0736e0605
- 16-candidate-list-rendering-fixture.json：b1a314cf9d05ef31f2630d2baf5bcab4f586808756547a9c61077ac4e831b016

11与08一致，预算经营账/官方dynamic-budget-control源flag及主题摘要正确，主编V4已核同SHA。前技术审17/17与7/7真实回归保留，本节未重复计数；候选序号等价保全整行，唯一消息/分页/完整正文/理由/全部文本单位及ATTEMPTED门继续保留。

07实际READY_NOT_SENT，真实dates今日NONE、规范化精确successmarker=false；未发送。原6用户tracked dirty集合已核且暂存0，本角色未触碰；无开工前字节hash不作历史字节级保证。提交必须选择性排除原6，fixedbase后再核提交交集。

最终准备PASS，可由唯一执行者commit/push固定base启动单次链。尚无今日PID/WAITING实际证据，不记runtime或送达。12至此封存，后续runtime只读消息/private memory，不改12/08/07/脚本/HEAD。最终回执、唯一完整群读回和远端归档分别验收。
