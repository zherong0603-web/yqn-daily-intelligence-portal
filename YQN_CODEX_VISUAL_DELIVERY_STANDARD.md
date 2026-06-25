# YQN Codex Visual Delivery Standard

This repository requires a complete visual delivery package for every UI, web page, dashboard, portal, report, visual audit, or user-facing presentation task.

## Non-Negotiable Rule

Do not hand off only README updates, commit hashes, test logs, screenshot filenames, or engineering notes. A valid handoff must include a complete package that a non-technical reviewer can open, inspect, and send to ChatGPT for second-pass acceptance.

## Required Package

The required package path is:

`delivery/YQN_Daily_Intelligence_Portal_V4_1_Delivery.zip`

The zip must include:

- `offline-preview/` with `open-here.html`.
- `dist/` with the current deployable static site.
- `visual-audit/full-page/` with V4.1 desktop and mobile full-page screenshots.
- `visual-audit/sections/` with focused screenshots for key modules.
- `recordings/desktop-30s-operator-flow.mp4`.
- `recordings/desktop-30s-setup-flow.mp4`.
- `docs/UI说明文档.md`.
- `docs/视觉验收包.md`.
- `docs/代码验收包.md`.
- `docs/交付说明.md`.
- `docs/甲方3分钟使用说明.md`.
- `docs/配置向导说明.md`.
- `docs/老板演示话术.md`.
- `docs/下一轮优化建议.md`.
- `README_OPEN_FIRST.md`.
- `MANIFEST.json`.

## Required Commands

Run these commands before delivery:

- `npm test`
- `npm run build:sample`
- `npm run visual:audit`
- `npm run visual:sections`
- `npm run visual:record`
- `npm run package:delivery`
- `npm run verify:delivery`

Record truthful pass/fail results in `代码验收包.md` and `MANIFEST.json`.

## Visual Acceptance Angles

Every UI delivery must be checked from five angles:

1. Foolproof operation: the user knows the first click, second read, and third share/archive action.
2. Information architecture: executive summary, MQL quality, organization gaps, content experiments, personal daily, history, and security/config status are visibly separated.
3. Visual design: YQN blue, gold accent, dark command-center surface, logistics route or signal metaphors, consistent tokens and components.
4. Executive readability: a leader can understand the conclusion within 30 seconds.
5. Long-term use: history, search, month/week archive, report navigation, mobile layout, and print flow remain clear as reports accumulate.

## Security Rules

- Never include real API keys, webhook URLs, signing secrets, access passphrases, customer lists, quotes, contracts, internal costs, or private leads.
- GitHub Pages is public; `noindex` and `robots.txt` are not access control.
- Encryption mode is client-side encryption, not enterprise login.
- If encryption is enabled, full report content and search index must not appear in plaintext in `dist` or delivery package.

## If Something Fails

If screenshots, recording, release upload, or zip generation fails, report the exact failed step and reason. Do not fabricate screenshots, recordings, releases, or test results.
