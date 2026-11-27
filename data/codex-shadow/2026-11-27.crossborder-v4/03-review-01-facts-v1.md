# 2026-11-27 一审一校：独立事实审核 V1

独立审核角色：primary（/root/produce_1123/primary），未编写本期执行稿，不负责发送。
实际审核完成：2026-11-27T14:42:58+08:00
结论：V1事实审核PASS。只代表所列固定版本的事实、来源、公式与范围审核；后续经营动作二审、口播表达/时长三审、完整严格校验和发送须分别取得真实结果。

## 所审版本

- 02-package-input-v1.json SHA-256 `4d8c4eaea76c8fd4c6bc78eed033662308a3dcf71fcfbd38af8f0de558d10254`
- 04-action-candidate-v1.md SHA-256 `19819b93b4fd3367ae82c40b78186355d1d9f92928dc7fd2fb1590305462db74`
- 00-candidates-and-sources.md SHA-256 `3f1547af64cf087c4b1904be5dfd6aae4155766f482618e32ff11ff0eb3c5837`

实际全文读取上述3文件，含10个去重候选与5重点、全部台账/窗口/正文/风险边界。分项评分重算正确。观察截至14:41:13在本次审阅时已发生，未把未来时点记成观察完成。

## 实际读取的主原文

1. https://amazonbrandguide.com/issues/2026-11-26/ 。公开原页可见November26,2026，更新7:12AM ET。为XENA服务商媒体，非Amazon官方。Total inventory聚合多个供应链位置的提醒可作当期题目信号；作者自拟DueNov26不是平台截止。原文将At fulfillment简化为可买，本稿明确不采这条等式。普通urllib默认UA曾403，而现有verifyCrossborderV2Sources实际HTTP能读取日期/markers，未修改抓取器规避限制。
2. https://sell.amazon.com/blog/send-products-to-amazon-warehousing-and-distribution 。实际公开原文以及普通HTTP去script后标题旁可见Jun5,2025。此是既有AWD操作底座，不能说2026新界面公告。Inventory→Warehousing and distribution(AWD)→View inventory路径有原文；Inventory quantities列AWD available（含箱数）、inbound、reserved，FBA inventory status另列available units in FBA及days of supply；Replenishment settings含auto/manual、upcoming quantities与errors。V1分别取数，不从Total减几列推可售、不把箱数混件数。
3. 同官方原文自动补货：FBA Replenishment列选Auto-replenishment/Manual replenishment，可选Amazon recommended quantity、quantity limit或关闭自动补货；更改后Update。更新可能24小时才生效，此为设置生效非运输、接收或变可用。相同ASIN多个seller SKU以最高设置值决定补货量，首次AWD发货后页面访问可能2至3天开放。V1保留影响范围/权限和未用者不开服务，不保证今日补货今日可售。
4. 额外人工参考 https://sellercentral.amazon.com/seller-forums/discussions/t/2d8620b9-04de-40b4-bf46-c9466cee3f97 ，已实际公开原文读到新Manage Amazon inventory、Total含inbound、Settings展开4个位置列。只有相对时间，不能填11月23日为已核官方published_at。本稿只放人工无日期范围参考，不将其塞入dated严格证据；正式日期来源为上列媒体26日和官方2025指南。

## 五候选复核

- 主选：媒体26日作为近期触发、旧官方文支持今日AWD/FBA分账动作，分别如实标日期，不使用消费者黑五日期替卖家操作deadline。对象限定美国FBA、重点现已用AWD者。
- 美加D&D https://www.maersk.com/news/articles/2026/11/26/us-canada-demurrage-detention-tariff-update 已实际原页读，可见26Nov2026。2027年1月1日按PCD，新阶梯按箱型/方向不同，未给本票免费期/每档起止。V1不把改档当今日已扣、不套全部在港日，与主选不共题淘汰。
- AMZ123 https://www.amz123.com/t/Gtkj79Nq 实际web和Jina正文已读，可见2026-11-26 07:00。32% ACoS和116万来自匿名流传个案，不能推全店保本线或普遍损失。该文观点/广告属性与归因不全已在取舍保留，未据其零单就教停广告。不同抓取阅读值1705/4325是缓存或观察差异，未列增长结论，不拿赞转按钮当互动。
- 墨西哥 https://www.maersk.com/news/articles/2026/11/27/mexico-fuel-surcharge-update-december 已实际原页读，可见27Nov2026。2%基数为inland haulage；标题12月1日，而正文FMC为2027年1月1日，进口后补订陆运另看创建日。V1已写分支，不将总海运费乘2%。
- Coupang https://www.cifnews.com/news/04110579e3d1 实际Jina正文读取，可见2026-11-27 10:20（北京时间）。文写2027年1月31日前新签、2月28日前撤货，现行条款2月1日止；仅媒体摘要，尚无第一方合同，本稿淘汰、不教全部卖家立即撤仓或按摘要改约。原文不能补成已核平台统一最终deadline。

## 算式、口径和动作时点

80÷40=2正确，80件、7个完整店铺日、40件/日均明确是假设，同SKU同FBA单位为售出件数而非订单数。自算静态覆盖与平台days of supply原值分列，不冒称同算法、未来两天售罄、黑五需求预测或统一停投阈值；日均0不除。没有捏造客户个案或实际亏损。费用/广告预算依据本店实际币种和记录，不从总库存计算已亏或节省。

FBA可用快照与某买家地址当前到货承诺不同，本稿没有从available声称买家今天收到。AWD available与FBA available有区别；未确认在途不当已可用，也不一概宣布所有在途offer不能卖，预售/承诺等须本票另核。已存在补货先看状态和预计时间，不重复建单；提交/设置更新与已接收可售分别记。

## 发现的问题及复核结论

预核P01：新MIA论坛无绝对日期，媒体把At fulfillment简化为可买，容易制造日期与库存口径错误。实际复核V1已用旧官方dated底座，论坛仅人工参考，未填11月23日公告日期，且禁止Total减几栏/At fulfillment等可售，关闭。
预核P02：24小时可能被误讲成到仓时效。实际复核V1正文、台账与风险均写设置生效，运输/接收另算，关闭。
本次完整V1无新增事实阻塞。没有真实店铺库存或界面实操，只核公开原文及编辑建议，不冒称后台操作已执行。表达是否紧、前10秒痛感与完整A/B时长交后续独立主编，不在事实审自证。

## 严格源覆盖边界

稿前以现有verifyCrossborderV2Sources只读真实预核两正式URL日期/markers均PASS，未改源抓取器、安全阈值、调度或发送配置；正式完整源检查仍需对最终输入执行。新界面人工参考不冒同批dated严格覆盖。后续任何改版须核SHA及受影响事实差异。
