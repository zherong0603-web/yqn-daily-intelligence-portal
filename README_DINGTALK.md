# YQN 北美履约增长晨报 V1

这是钉钉测试群版每日晨报。V1 先跑 Markdown 简洁版，默认 demo 模式和 dry run，避免误发正式业务群。

## 每天几点发

工作日北京时间 8:45。GitHub Actions 使用 UTC cron：

```yaml
45 0 * * 1-5
```

## 群里会看到什么

- 今日一句话判断。
- 政策、平台、履约、增长 4 条核心信号。
- 每条信号包含发生了什么、为什么重要、YQN 可用点、今天动作、来源链接、置信度、是否敏感。
- 今日 3 个动作，分别面向销售、内容、履约或数据。
- 如果配置了 Pages 地址，末尾会带网页归档链接。

## 默认安全设置

- 默认 `mode=demo`，不依赖 OpenAI API。
- 默认 `dry_run=true`，不会真的发到钉钉群。
- 只发公开信号和 YQN 可公开表达的业务动作。
- 命中敏感词或 `is_sensitive=true` 会阻断发送，并生成风险报告。

## 手动测试一次

打开 GitHub 仓库：

1. 点 `Actions`。
2. 点 `DingTalk Morning Brief V1`。
3. 点 `Run workflow`。
4. `mode` 先选 `demo`。
5. `dry_run` 保持 `true`。
6. 点绿色运行按钮。

确认预览没问题后，再把 `dry_run` 改成 `false`，并确保 webhook 是钉钉测试群。

## GitHub Secrets

进入仓库 `Settings` -> `Secrets and variables` -> `Actions` -> `New repository secret`。

- `DINGTALK_WEBHOOK_URL`：钉钉测试群自定义机器人 webhook。必须。
- `DINGTALK_SECRET`：钉钉机器人加签密钥。推荐。
- `DINGTALK_OWNER_WEBHOOK_URL`：风险阻断时给负责人提醒。可选。
- `OPENAI_API_KEY`：live 模式必须。
- `OPENAI_MODEL`：live 模式必须。

如果不想花 OpenAI API 费用，V1 也支持在 GitHub Actions 里用 GitHub Models。它使用 GitHub 自动提供的 `GITHUB_TOKEN` 和账号内置免费限额，不需要单独配置 OpenAI API key。免费限额用完后，如果没有开启付费用量，会被阻断而不是继续扣 OpenAI API 费用。

不要把这些值写进代码、文档、聊天、日志或网页。

## 本地跑 demo

```bash
npm ci
npm run dingtalk:generate -- --mode demo --dry_run true
npm run dingtalk:risk
npm run dingtalk:archive
npm run dingtalk:preview
npm run dingtalk:package
```

交付包会生成在：

```text
delivery/YQN_DingTalk_Morning_Brief_V1_Delivery.zip
```
