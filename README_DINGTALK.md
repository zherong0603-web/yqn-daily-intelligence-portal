# YQN 跨境电商 5 分钟晨报 V1.3 + 跨境早知道 V2

## 跨境早知道 V2（当前每日主线）

- 调度：每天北京时间 16:00，由 Codex 自动化 `yqn-3` 生成并受保护调度。
- 内容：美国优先，其次墨西哥、欧洲；先搜 24 小时，不足再扩到 72 小时。
- 交付：3 条情报简报、A/B 黄金 3 秒、90–120 秒 HeyGen A/B 纯文本口播稿、来源与风险说明。
- 私聊通道：钉钉企业内部机器人 `/v1.0/robot/oToMessages/batchSend`；发送后必须用 `/v1.0/robot/oToMessages/readStatus` 核验。
- 构建：`npm run crossborder:v2:build -- --file data/codex-shadow/YYYY-MM-DD.crossborder-v2.json`
- 干跑：`npm run crossborder:v2:send -- --file <file>`
- 调度：`npm run crossborder:v2:dispatch -- --date YYYY-MM-DD`
- 配置文档：`docs/automation/跨境早知道V2执行规则.md`、`docs/automation/工作日晨报执行规则.md`。

V2 私聊需要 GitHub Actions Secrets：`DINGTALK_APP_KEY`、`DINGTALK_APP_SECRET`、`DINGTALK_ROBOT_CODE`、`DINGTALK_USER_ID`，并启用仓库 Variable `CROSSBORDER_V2_TARGET_ENABLED=true`。未配置时构建和干跑仍可执行，但正式私聊发送必须失败关闭，不能回退成群消息。

以下为旧版 V1.3 说明，保留用于回滚和历史任务。

定位：面向 YQN 团队的钉钉测试群晨报，覆盖行业、市场、客户、平台和履约变化。

默认推送时间：工作日 08:45 Asia/Shanghai，对应 GitHub Actions cron `45 0 * * 1-5`。
预抓取时间：工作日 06:00 Asia/Shanghai，对应 GitHub Actions cron `0 22 * * 0-4`，只 dry-run，不发群。
兜底检查时间：工作日 09:05 / 09:20 / 09:35 / 09:50 Asia/Shanghai，对应 GitHub Actions cron `5 1 * * 1-5`、`20 1 * * 1-5`、`35 1 * * 1-5`、`50 1 * * 1-5`。如果 08:45 后没有成功或正在运行的主任务，会自动触发一次 `workflow_dispatch live dry_run=false` 补发到钉钉测试群；后续兜底检查会识别已成功或运行中的主任务，避免重复发送。

当前状态：
- 默认发送到钉钉测试群。
- 标题保留【测试版】。
- 配置 `DINGTALK_FORMAL_WEBHOOK_URL` / `DINGTALK_FORMAL_SECRET` 且设置 `DINGTALK_FORMAL_GROUP_ENABLED=true` 后，才会切到正式内部群；测试群 webhook 会保留用于回滚。
- demo 模式不消耗 OpenAI API。
- live 模式先抓取真实公开 RSS / 网页信号，再用 OpenAI API 或 GitHub Models 提炼；模型不可用时会用真实候选源生成保守版，不回退 demo。
- 内容按开户价值 top-down 排序，群内和归档都展示五条；优先 90% 美仓 / 北美履约 / 美国平台卖家，只有强信号才保留墨仓 / 美墨链路。
- 06:00 预演会额外生成 `mini_research_pack` 候选资料包，只作为资料员输出，不直接发群。
- 发送前会做 schema、敏感边界、来源字段、消息长度、测试标识和归档链接验收。

关键密钥和变量：
- `DINGTALK_WEBHOOK_URL`：测试群钉钉自定义机器人 webhook，测试群真实发送必须配置。
- `DINGTALK_SECRET`：测试群钉钉机器人加签 secret，开启加签时必须配置。
- `DINGTALK_FORMAL_WEBHOOK_URL`：正式内部群机器人 webhook，切正式群时配置。
- `DINGTALK_FORMAL_SECRET`：正式内部群机器人加签 secret，正式群机器人开启加签时配置。
- `OPENAI_API_KEY`：live 模式需要。
- `OPENAI_MODEL`：live 模式模型名。
- `PUBLIC_BASE_URL` 或 `PAGES_BASE_URL`：GitHub Pages 根地址，推荐 `https://zherong0603-web.github.io/yqn-daily-intelligence-portal`。
- `DINGTALK_FORMAL_GROUP_ENABLED`：仅正式群迁移后才允许设为 `true`。
- `DINGTALK_OWNER_WEBHOOK_URL`：可选。配置后 09:05 兜底和失败提醒优先发到负责人提醒通道；未配置时兜底提醒会尝试发到测试群。

交付包：
`delivery/YQN_Daily_5_Minutes_V1_3_Delivery.zip`
