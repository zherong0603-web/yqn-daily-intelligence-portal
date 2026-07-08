# YQN 每日 5 分钟 V1.2

定位：面向 YQN 团队的钉钉测试群晨报，覆盖行业、市场、客户、平台和履约变化。

默认推送时间：工作日 08:45 Asia/Shanghai，对应 GitHub Actions cron `45 0 * * 1-5`。

当前状态：
- 默认发送到钉钉测试群。
- 标题保留【测试版】。
- demo 模式不消耗 OpenAI API。
- live 模式可使用 OpenAI API；没有 key 时可走 GitHub Models 额度，失败时回退到带测试标识的样例数据。
- 发送前会做 schema、敏感边界、来源字段、消息长度、测试标识和归档链接验收。

关键密钥和变量：
- `DINGTALK_WEBHOOK_URL`：钉钉自定义机器人 webhook，真实发送必须配置。
- `DINGTALK_SECRET`：钉钉机器人加签 secret，开启加签时必须配置。
- `OPENAI_API_KEY`：live 模式需要。
- `OPENAI_MODEL`：live 模式模型名。
- `PUBLIC_BASE_URL` 或 `PAGES_BASE_URL`：GitHub Pages 根地址，推荐 `https://zherong0603-web.github.io/yqn-daily-intelligence-portal`。
- `DINGTALK_FORMAL_GROUP_ENABLED`：仅正式群迁移后才允许设为 `true`。

交付包：
`delivery/YQN_Daily_5_Minutes_V1_2_Delivery.zip`
