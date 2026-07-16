# YQN 每日重点简报

这是给 YQN / 运去哪使用的每日重点简报门户：每天定时生成一页 3 分钟可读的业务简报，发布到 GitHub Pages，并可通过飞书发送入口卡片。

## 产品原则

- 默认阅读对象是用户本人，页面语气也能体面转发给团队或管理层。
- 每日最多 3 条重点，不强行包装低信号新闻。
- 内容范围优先：美国仓、跨境物流、小红书获客、AI 自动化工具。
- 首页只做简报，不放工程日志、不放产品自夸说明。
- 旧 `/boss/`、`/executive/` 链接保留兼容，但不进入主导航。

## 线上入口

- 首页：`https://zherong0603-web.github.io/yqn-daily-intelligence-portal/`
- 历史简报：`https://zherong0603-web.github.io/yqn-daily-intelligence-portal/archive/`
- 自动化配置：`https://zherong0603-web.github.io/yqn-daily-intelligence-portal/setup/`
- 系统说明：`https://zherong0603-web.github.io/yqn-daily-intelligence-portal/about/`

## 每天怎么运行

- 生成时间：每天 09:37 Asia/Taipei。
- 通知窗口：目标 09:45-10:05 Asia/Taipei。
- 飞书只发入口卡片，不发送完整正文。
- 飞书失败不会阻断网页部署。

## 钉钉北美情报晨报 V1.4

- 机器人显示名：`YQN 信息小助手`。
- 每次强制联网搜索美国、墨西哥、美墨联动三组官方来源。
- 群内固定为 2 条美国、2 条墨西哥、1 条美墨联动，70 分以下不发送。
- 每条都包含生效时间、影响卖家、物流环节、卖家检查、YQN 可承接和官方链接。
- 现有正式群与 `YQN 直播天团` 是两个独立目标，不相互覆盖，并分别防重复发送。
- 统一业务口径位于 `knowledge/yqn-capabilities.yaml`，完整配置见 `docs/dingtalk/配置说明.md`。

## 必须配置

最傻瓜的配置方式是在本机打开网页配置助手：

```bash
npm run setup:wizard
```

它会打开一个 `127.0.0.1` 开头的本机网页。你在网页里填 API Key 和飞书 webhook，助手会用当前电脑已有的 GitHub 权限写入 GitHub Secrets。密钥不会写进公开网页、仓库、日志或聊天。

GitHub Secrets：

- `OPENAI_API_KEY`：真实 AI 简报必填。
- `FEISHU_WEBHOOK_URL`：需要飞书通知时必填；缺失时只跳过通知。
- `FEISHU_SIGN_SECRET`：飞书机器人启用签名校验时才需要。
- `PAGE_ACCESS_PASSPHRASE`：开启加密模式时必填。

GitHub Variables：

- `OPENAI_MODEL`：真实 AI 简报必填；钉钉强制联网晨报默认使用支持 Responses API `web_search` 的 `gpt-5`。
- `SITE_URL`：正式 Pages 地址。
- `BRIEF_ENCRYPTION_ENABLED`：是否开启客户端加密，填 `true` 或 `false`。
- `OPENAI_WEB_SEARCH_ENABLED`：钉钉 live 模式必须为 `true`。
- `MAX_SEARCH_CALLS`：钉钉 live 模式必须至少为 `3`。

## OpenAI 成本边界

ChatGPT Pro 不等于 OpenAI API 免费额度。自动日报必须使用 OpenAI API Key，API 按 OpenAI 官方计费规则单独计费。

系统不会使用 ChatGPT 网页 cookie、模拟登录、浏览器自动化或绕过官方 API 的方式。

当前代码已支持 OpenAI API。更低成本的默认建议是 `gpt-4o-mini`。Google Gemini API 和阿里云 Model Studio 有免费额度路线，但需要新增对应 API 接入后才能用于自动日报。

## 安全边界

GitHub Pages 是公开网页。`noindex` 和 `robots.txt` 不是访问控制。

不要把客户名单、报价、合同、内部成本、API Key、飞书 webhook、签名密钥、页面访问密码或私密线索写入仓库、页面、日志、截图、artifact、飞书卡片或聊天。

开启 `BRIEF_ENCRYPTION_ENABLED=true` 后，完整日报和搜索索引会以客户端加密形式发布；这能减少公开 Pages 上的明文暴露，但不是企业级登录系统。
