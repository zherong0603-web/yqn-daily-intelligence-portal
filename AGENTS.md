# AGENTS.md

This repository is the production surface for `YQN Daily Intelligence Portal`.

## Operating Rules

- Keep the architecture static: GitHub Pages, GitHub Actions, public sources, OpenAI API, Feishu webhook.
- Do not add a database, backend server, login system, browser automation, platform-cookie scraping, or paid cloud dependency.
- Never commit secrets, customer lists, quotes, contracts, internal costs, private lead data, API keys, webhook URLs, signing secrets, or access passphrases.
- Keep source items grounded in public `source_url` values. Model output without a public URL must fail validation or be dropped before publish.
- If schema validation fails, fix the generator or schema. Do not loosen schema just to make a broken response pass.
- If encryption mode is enabled, full brief content and search index must remain encrypted in published `dist`.

## Useful Commands

- `npm test` checks TypeScript, schema validation, and sample static builds.
- `npm run generate` collects sources and writes `data/briefs/YYYY-MM-DD.json`.
- `npm run build` builds the production site from `data/briefs`.
- `npm run build:sample` builds a local preview from `data/samples`.

## Delivery Standard

Before handing off, run tests and a sample build. Keep README assumptions current when changing schedules, secrets, model defaults, source policy, encryption behavior, or deployment steps.
