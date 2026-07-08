# YQN 每日 5 分钟 V1.3

定位：面向 YQN 团队的钉钉测试群晨报，覆盖行业、市场、客户、平台和履约变化。

默认推送时间：工作日 08:45 Asia/Shanghai，对应 GitHub Actions cron `45 0 * * 1-5`。
预抓取时间：工作日 06:00 Asia/Shanghai，对应 GitHub Actions cron `0 22 * * 0-4`，只 dry-run，不发群。

当前状态：
- 默认发送到钉钉测试群。
- 标题保留【测试版】。
- demo 模式不消耗 OpenAI API。
- live 模式先抓取真实公开 RSS / 网页信号，再用 OpenAI API 或 GitHub Models 提炼；模型不可用时会用真实候选源生成保守版，不回退 demo。
- 内容比例按 90% 美仓 / 北美履约、10% 墨仓 / 美墨链路控制，并补国内跨境卖家需求背景。
- 发送前会做 schema、敏感边界、来源字段、消息长度、测试标识和归档链接验收。

关键密钥和变量：
- `DINGTALK_WEBHOOK_URL`：钉钉自定义机器人 webhook，真实发送必须配置。
- `DINGTALK_SECRET`：钉钉机器人加签 secret，开启加签时必须配置。
- `OPENAI_API_KEY`：live 模式需要。
- `OPENAI_MODEL`：live 模式模型名。
- `PUBLIC_BASE_URL` 或 `PAGES_BASE_URL`：GitHub Pages 根地址，推荐 `https://zherong0603-web.github.io/yqn-daily-intelligence-portal`。
- `DINGTALK_FORMAL_GROUP_ENABLED`：仅正式群迁移后才允许设为 `true`。

交付包：
`delivery/YQN_Daily_5_Minutes_V1_3_Delivery.zip`
