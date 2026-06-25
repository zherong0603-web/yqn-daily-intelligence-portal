# AGENTS.md

This repository is the production surface for `YQN Daily Intelligence Portal` and the V4.1 `YQN Growth War Room`.

## Operating Rules

- Keep the architecture static: GitHub Pages, GitHub Actions, public sources, OpenAI API, Feishu webhook.
- Do not add a database, backend server, login system, platform-cookie scraping, or paid cloud dependency.
- Never commit secrets, customer lists, quotes, contracts, internal costs, private lead data, API keys, webhook URLs, signing secrets, or access passphrases.
- Keep source items grounded in public `source_url` values. Model output without a public URL must fail validation or be dropped before publish.
- If schema validation fails, fix the generator or schema. Do not loosen schema just to make a broken response pass.
- If encryption mode is enabled, full brief content and search index must remain encrypted in published `dist`.
- OpenAI model names must come from `OPENAI_MODEL`; do not hard-code an unverified default model.

## Visual Delivery Standard

For any UI, web page, visual, dashboard, portal, report, archive, screenshot, recording, or product-facing task in this repository:

- Produce a complete visual delivery package, not only README, commit, test logs, or file paths.
- Run and record `npm test`, `npm run build:sample`, `npm run visual:audit`, `npm run visual:sections`, `npm run visual:record`, `npm run package:delivery`, and `npm run verify:delivery`.
- Generate full-page screenshots, section screenshots, a 25-40 second operator-flow recording, and a 25-40 second setup-flow recording.
- Package `offline-preview/`, `dist/`, `visual-audit/`, `recordings/`, docs, `README_OPEN_FIRST.md`, and `MANIFEST.json` into `delivery/YQN_Daily_Intelligence_Portal_V4_1_Delivery.zip`.
- If a recording or screenshot step fails, state the exact failure. Do not claim completion without artifacts.
- The UI must be judged as a YQN growth command center: foolproof operation, clear business information architecture, executive readability, long-term maintainability, and mobile usability.

See `YQN_CODEX_VISUAL_DELIVERY_STANDARD.md` for the full required package structure and acceptance checklist.

## Useful Commands

- `npm test` checks TypeScript, schema validation, and sample static builds.
- `npm run generate` collects sources and writes `data/briefs/YYYY-MM-DD.json`.
- `npm run build` builds the production site from `data/briefs`.
- `npm run build:sample` builds a sample preview from `data/briefs`.
- `npm run visual:audit` generates full-page visual screenshots.
- `npm run visual:sections` generates section screenshots.
- `npm run visual:record` generates the 30 second operator-flow and setup-flow recordings.
- `npm run package:delivery` creates the delivery zip.
- `npm run verify:delivery` verifies delivery package completeness.

## Handoff Rule

Before handing off, the repository must contain the visual delivery package or a precise single blocker. Keep README and Chinese delivery docs current when changing schedules, secrets, model defaults, source policy, encryption behavior, deployment steps, or visual delivery scripts.
