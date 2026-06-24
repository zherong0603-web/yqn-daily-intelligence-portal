# YQN Daily Intelligence Portal

YQN Daily Intelligence Portal is a Chinese daily business-intelligence portal for AI, US warehouse cross-border ecommerce, Xiaohongshu/B2B acquisition, and personal business opportunities.

It is built as a static site: GitHub Pages + GitHub Actions + public sources + OpenAI API + Feishu webhook. There is no database, backend server, login system, browser automation, cookie scraping, or paid cloud dependency.

## Current Assumptions

- Repository: `zherong0603-web/yqn-daily-intelligence-portal`
- Production architecture: static files deployed by GitHub Pages.
- Daily timezone: `Asia/Taipei`.
- Daily start time: `09:37 Asia/Taipei`.
- GitHub Actions cron: `37 1 * * *`, because GitHub cron uses UTC and does not support a timezone field.
- Target deployment and Feishu success notification window: `09:45-10:05 Asia/Taipei`, assuming public sources and OpenAI API respond normally.
- OpenAI default model: `gpt-5.4-mini`, chosen as a lower-cost mini model suitable for daily summarization. Change it with repository variable `OPENAI_MODEL` if the account does not have access or if a stronger model is needed.
- ChatGPT Pro membership is not API credit. OpenAI API usage is billed separately by token.
- V1 uses GitHub Pages, GitHub Actions, public sources, and the OpenAI API only. Tavily, Serper, and OpenAI Web Search are treated as future optional enhancements; missing keys disable them and must not break the run.
- `dist` is kept in the repository only as an initial Pages-safe static shell. The daily workflow copies the freshly built Pages artifact to `_pages`, restores tracked `dist`, and commits only `data/briefs`.

## Required GitHub Secrets

Set these in GitHub repository Settings → Secrets and variables → Actions.

- `OPENAI_API_KEY`: required for a normal AI-generated brief. If absent, the workflow publishes an honest low-signal configuration brief instead of inventing intelligence.
- `FEISHU_WEBHOOK_URL`: optional but recommended. If missing, notification is skipped with a warning.
- `FEISHU_SIGN_SECRET`: optional. If set, the Feishu custom robot request includes `timestamp` and `sign`.
- `PAGE_ACCESS_PASSPHRASE`: required only when `BRIEF_ENCRYPTION_ENABLED=true`.
- `TAVILY_API_KEY` / `SERPER_API_KEY`: optional future enhancement keys. V1 reads their configured/not-configured state but does not require or call them.

Do not put secrets in code, logs, HTML, JSON, README, or artifacts.

## Repository Variables

- `OPENAI_MODEL`: optional, defaults to `gpt-5.4-mini`.
- `BRIEF_ENCRYPTION_ENABLED`: `true` or `false`, defaults to `false`.
- `SITE_URL`: optional. Recommended value after Pages is active: `https://zherong0603-web.github.io/yqn-daily-intelligence-portal`.
- `OPENAI_WEB_SEARCH_ENABLED`: optional future enhancement flag, defaults to `false`.

## Daily Workflow

Workflow name: `Daily Briefing Portal`.

It runs every day at `09:37 Asia/Taipei` and can also be triggered manually with `workflow_dispatch`.

Main steps:

1. Checkout repository.
2. Setup Node.js 20.
3. Run `npm ci`.
4. Run `npm test`.
5. Generate `data/briefs/YYYY-MM-DD.json`.
6. Build static site into `dist`.
7. Commit only `data/briefs` back to `main`. Re-running the same day updates that date file.
8. Deploy `dist` to GitHub Pages.
9. Send Feishu success card.
10. On failure, send Feishu failure card with the failed stage and Actions run link.

Feishu failure does not block a successful Pages deployment. Tests, model output schema validation, or Pages deployment failures block the workflow.

## Downgrade Logic

- Missing `OPENAI_API_KEY`: publish a low-signal configuration brief with no factual items and no invented sources; configure the secret and manually rerun the same date.
- Missing `FEISHU_WEBHOOK_URL`: deploy Pages normally and log a warning.
- Feishu HTTP/network failure: keep workflow successful after Pages deployment and log a warning.
- Missing `FEISHU_SIGN_SECRET`: send unsigned Feishu custom robot payload.
- Missing `PAGE_ACCESS_PASSPHRASE` while `BRIEF_ENCRYPTION_ENABLED=true`: fail before publishing, because encrypted mode cannot be safe without a passphrase.
- Missing Tavily/Serper/OpenAI Web Search optional keys: disable those optional enhancements; V1 continues with RSS/Atom/public webpage sources.
- Some source feeds fail: skip failed sources with a warning and continue with the remaining public sources.
- Too few sources: publish an honest low-signal day.
- Model output fails schema/source validation: retry once, then fail the workflow. This protects the site from garbage content.

## Manual Backfill

Open GitHub → Actions → `Daily Briefing Portal` → Run workflow.

Optional input:

- `brief_date`: `YYYY-MM-DD`

If empty, the workflow uses the current date in `Asia/Taipei`.

## Public Page Warning

GitHub Pages is public. Do not publish customer lists, quotes, contracts, internal costs, API keys, webhooks, signing secrets, access passwords, private lead details, or other sensitive business data.

This repository writes `noindex` meta tags and `robots.txt` with `Disallow: /`, but that is not access control. Use encryption mode for sensitive daily reading, and still avoid publishing private raw data.

## Optional Encryption Mode

Set:

- `BRIEF_ENCRYPTION_ENABLED=true`
- `PAGE_ACCESS_PASSPHRASE` as a GitHub Secret

When enabled:

- Full report JSON is encrypted before publish.
- Historical report content is encrypted.
- `search-index.json` is encrypted.
- Public pages show only site name, date, and limited preview.
- Browser unlock uses WebCrypto AES-GCM.
- The AES key is derived locally from the passphrase with PBKDF2-SHA256.
- The passphrase is never written into the repo, HTML source, JSON, logs, or Feishu cards.

## Content Rules

Each normal brief has up to five core items. Each item must include:

- topic badge
- signal strength
- confidence
- title
- what happened
- why it matters
- YQN insight
- today action
- public source title, domain, URL, and published time

The generator rejects model output that references a `source_url` outside the collected public source set. If sources are insufficient, the system generates an honest low-signal day instead of inventing news.

## Source Policy

Sources live in `config/sources.yaml`.

Each source includes:

- `topic`
- `name`
- `url`
- `type: rss | atom | webpage`
- `enabled`
- `weight`

The collector supports RSS, Atom, and curated public webpages. It does not log into sites, bypass restrictions, use ChatGPT web cookies, or scrape Xiaohongshu with unstable or rule-breaking crawlers.

For Xiaohongshu topics, without an official authorized API this system uses only public marketing industry information, public ad-platform pages, public cases, and public reports. It cannot guarantee coverage of in-platform hot notes.

## Local Commands

Install:

```bash
npm ci
```

Test:

```bash
npm test
```

Build from sample data:

```bash
npm run build:sample
```

Generate real daily brief:

```bash
OPENAI_API_KEY=... npm run generate
npm run build
```

## File Structure

```text
.github/workflows/daily-briefing.yml
config/sources.yaml
data/briefs/
data/samples/
dist/
src/
  collectSources.ts
  generateBrief.ts
  buildSite.ts
  buildArchives.ts
  buildSearchIndex.ts
  encryptContent.ts
  sendFeishu.ts
  schema.ts
  config.ts
  utils/
```

Generated site outputs include:

- `dist/index.html`
- `dist/latest.json`
- `dist/manifest.json`
- `dist/search-index.json`
- `dist/calendar.json`
- `dist/archive/index.html`
- `dist/archive/YYYY/index.html`
- `dist/archive/YYYY/MM/index.html`
- `dist/archive/YYYY/week-WW/index.html`
- `dist/reports/YYYY-MM-DD/index.html`
- `dist/reports/YYYY-MM-DD/brief.json`
