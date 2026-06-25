# YQN Daily Intelligence Portal

这是给 YQN / 运去哪使用的每日商业情报门户：每天由 GitHub Actions 定时生成日报，发布到 GitHub Pages，并通过飞书机器人发送入口卡片。

## 关键原则

- 站点是静态网页：GitHub Pages + GitHub Actions + OpenAI API + 飞书机器人。
- 不使用 ChatGPT 网页 cookie、模拟登录、浏览器自动化或绕过官方 API 的方式。
- ChatGPT Pro 不等于 OpenAI API 免费额度；自动日报必须使用 OpenAI API Key，API 按 OpenAI 官方计费规则单独计费。
- OpenAI 模型名不写死；真实生成必须从 GitHub Variable `OPENAI_MODEL` 读取。
- 如果没有配置 `OPENAI_MODEL`，真实生成会清楚失败，提示到 GitHub Variables 添加。
- sample/backfill 验收模式不需要 OpenAI API Key，也不需要模型。
- GitHub Pages 是公开网页；`noindex` 和 `robots.txt` 不是访问控制。

## 必须配置

GitHub Secrets：

- `OPENAI_API_KEY`：真实 AI 日报必填。
- `FEISHU_WEBHOOK_URL`：需要飞书通知时必填；缺失时只跳过通知，不阻断网页部署。
- `FEISHU_SIGN_SECRET`：飞书机器人如果启用签名校验才需要。
- `PAGE_ACCESS_PASSPHRASE`：只有开启加密模式时必填。

GitHub Variables：

- `OPENAI_MODEL`：真实 AI 日报必填，填写你 OpenAI API 账号里可用的模型名。
- `SITE_URL`：正式 Pages 地址。
- `BRIEF_ENCRYPTION_ENABLED`：是否开启客户端加密，填 `true` 或 `false`。
- `OPENAI_WEB_SEARCH_ENABLED`：是否开启额外搜索增强，填 `true` 或 `false`。
- `MAX_SEARCH_CALLS`：搜索增强最大调用次数。

## 日常运行

- 定时生成：每天 09:37 Asia/Taipei。
- 通知窗口：目标 09:45-10:05 Asia/Taipei。
- 成功通知：飞书只发送入口卡片，不发送完整正文。
- 失败通知：飞书发送失败阶段、Actions 链接和下一步建议。
- 飞书失败不会阻断 GitHub Pages 部署。

## 本地命令

- `npm test`：类型检查和单元测试。
- `npm run build:sample`：用验收样例数据构建站点。
- `npm run visual:audit`：生成 Playwright 全页面截图。
- `npm run visual:audit:local`：本地模式生成截图。
- `npm run preview`：本地预览 `dist`。

## 安全边界

不要把客户名单、报价、合同、内部成本、API Key、飞书 webhook、签名密钥、页面访问密码或私密线索写入仓库、页面、日志、截图、artifact、飞书卡片或聊天。

开启 `BRIEF_ENCRYPTION_ENABLED=true` 后，完整日报和搜索索引会以客户端加密形式发布；这能减少公开 Pages 上的明文暴露，但不是企业级登录系统。
