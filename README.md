# Portfolio Watcher

A full-stack investing dashboard: brokerage account linking (or a manual watchlist), and AI-generated Daily Digest, Weekly Trends, and Breaking News reports produced from real holdings and grounded in structured data pulled from official free sources (SEC filings, Federal Reserve economic data, FINRA, live market data, congressional trading disclosures) rather than a generic market feed or model memory. Report generation runs entirely on a fixed schedule — no manual trigger anywhere in the UI — and the full stack operates at **$0/month** by design, with no payment method on any connected service.

**Live:** https://portfolio-watcher-murex.vercel.app

## Build process

Implemented in stages, each shipped and functional before the next began:

1. **Schema and auth.** Postgres schema designed in Prisma (`User`, `Goal`, `ExitRule`, `WatchlistItem`, `PlaidItem`, `Report`) before any UI work, followed by email/password auth (NextAuth, bcrypt).
2. **Brokerage integration.** Plaid Link for account connection, access tokens encrypted at rest — converts a static watchlist into a real portfolio with live positions and cost basis.
3. **AI report pipeline.** Structured-output generation against a Zod schema (no free-form text parsing); three report types (Daily Digest, Weekly Trends, Breaking News), each with an isolated prompt and JSON schema.
4. **Scheduling.** Report generation moved off any manual trigger and onto Vercel Cron, running unattended on a fixed schedule.
5. **Watchlist mode.** Added a research/ratings path that doesn't require a linked brokerage account.
6. **Data source integration**, layered in incrementally to ground every AI-generated claim in verifiable data rather than model inference: live market data and computed technical indicators, SEC EDGAR filings and insider activity, multi-year revenue/earnings/balance-sheet/cash-flow history via SEC XBRL, Federal Reserve macro data, congressional stock trade disclosures, FINRA short-sale volume, and a personalized multi-source news feed.
7. **Quantitative metrics layer.** Realized volatility, beta, max drawdown, holding correlation, and a fully deterministic (non-AI) Fit Score — all computed directly from the ingested data rather than estimated by the model, to keep output verifiable.
8. **Prompt hardening.** Explicit source-of-truth constraints requiring every stated fact to trace to data provided in-context, plus a required bull-case/bear-case evaluation before any rating is issued.
9. **Front-end build-out.** Interactive dashboard: a click-to-expand portfolio view with real S&P 500 benchmarking, a per-ticker detail view with Line/Bar/Candlestick/Compare charts, inline metric explanations, and a full dark-theme visual pass.
10. **Account management.** Delete-account and forgot-password flows.
11. **Technical indicators.** RSI, MACD, Bollinger Bands, moving-average (50/200-day golden/death cross) crossovers, and rolling support/resistance, computed from the same live price history already in use — folded into every report and the per-stock detail view, and added as a new deterministic Breaking News trigger.
12. **Multi-engine and batch efficiency.** An optional Groq engine piloted as a Breaking News fallback (validated against the same schema, falls back to Gemini on any failure), plus batch-level efficiency work — shared market context fetched once per run instead of once per user, fair-rotation user ordering, and a quota-exhaustion circuit breaker — to keep report generation predictable as the user base grows.

## Features

- **Auth** — email/password signup and login, forgot-password flow via email, account deletion
- **Brokerage linking** — Plaid Link for connecting accounts, access tokens encrypted at rest
- **Watchlist** — research and ratings without a linked brokerage account
- **Goals & exit rules** — target allocation across core ETF / individual growth / speculative buckets, plus per-ticker price-target, trailing-stop, and stop-loss rules
- **Daily Digest** — live-priced total value, a Buy/Hold/Sell rating and risk read on every holding and watchlist ticker grounded in real fundamentals and momentum, exit-rule status, tax notes, and a forward-looking outlook
- **Weekly Trends** — actual allocation vs. target, concentration/correlation flags, and new stock/ETF ideas
- **Breaking News** — deterministic detection of real price moves, fresh headlines, SEC filings, 52-week extremes, and golden/death cross events on owned holdings
- **Technical indicators** — RSI, MACD, Bollinger Bands, moving-average crossovers, and support/resistance levels computed from live price history, factored into every report and shown in the per-stock detail view
- **Interactive dashboard** — click-to-expand portfolio view with S&P 500 benchmarking, best/worst performers, and allocation breakdowns; a per-stock modal with Line/Bar/Candlestick/Compare charts and a transparent Fit Score
- **Inline metric explanations** — every rating, risk figure, and computed metric includes what it means and why
- **Fully scheduled** — Vercel Cron triggers all three report types automatically; no manual generation control in the UI
- **Sample mode** — `/sample` walks through realistic example data with no account needed

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Auth | NextAuth |
| Database | Postgres (Neon), Prisma ORM with driver adapters |
| Brokerage data | Plaid |
| AI / research | Gemini (Flash), structured JSON output; optional Groq fallback engine (free tier) |
| Hosting | Vercel, deployed via GitHub integration |
| Scheduling | Vercel Cron Jobs |
| Email | Nodemailer over Gmail SMTP |
| AI coding assistance | Claude Code (supplemental — used alongside manual development) |

## Data sources behind every report

Every number and claim in a report traces back to one of these, never to the model's own memory:

| Source | What it provides |
|---|---|
| Yahoo Finance (public) | Live prices, 52-week range, OHLC, momentum indicators |
| SEC EDGAR | Filings (8-K/10-Q/10-K), insider activity, multi-year revenue/earnings/balance-sheet/cash-flow history via XBRL |
| Federal Reserve (FRED) | Fed funds rate, CPI, unemployment |
| FINRA | Daily short-sale volume |
| House/Senate Stock Watcher | Congressional stock trade disclosures |
| RSS + Google News | Personalized, multi-outlet news with real publisher attribution |

Realized volatility, beta, max drawdown, correlation, trailing P/E, RSI, MACD, Bollinger Bands, moving-average crossovers, support/resistance levels, and the Fit Score are computed directly from this data rather than estimated by the model.

## Architecture

Reports are generated server-side against a Zod schema: the model is given real holdings, cost basis, exit rules, goals, watchlist, and every data source above, constrained to return structured JSON matching the schema in [`src/lib/reports/schemas.ts`](src/lib/reports/schemas.ts). Each report type (`dailyDigest.ts`, `weeklyTrends.ts`, `breakingNews.ts`) owns its own prompt and schema, invoked exclusively by a Vercel Cron route (`src/app/api/cron/*`) on the schedule defined in [`vercel.json`](vercel.json), sharing generation code via [`runBatch.ts`](src/lib/reports/runBatch.ts). Batch runs fetch market-wide context (S&P 500 momentum, VIX, macro data) once per run rather than once per user, process users in fair-rotation order (whoever's gone longest without a report of that kind first), and stop issuing further AI calls after repeated quota-exhaustion errors rather than failing every remaining user individually.

## Cost

Every component runs on a free tier — signup, goals, exit rules, the sample dashboard, brokerage linking (Plaid Sandbox), AI report generation (Gemini free tier), hosting (Vercel Hobby), the cron schedule, and the database (Neon free tier) — and no connected service has a payment method on file. Two features are gated behind free API keys and are visibly disabled (not broken) until configured:

| Feature | Requires |
|---|---|
| Connecting a brokerage account | Free [Plaid Sandbox](https://dashboard.plaid.com/signup) signup |
| AI-generated reports + the schedule | Free [Gemini API](https://aistudio.google.com/apikey) key |
| Groq fallback engine for Breaking News | Optional free [Groq API](https://console.groq.com) key — the app runs fully on Gemini alone without it |

## Getting started

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL, NEXTAUTH_SECRET, etc.
npx prisma migrate dev
npm run dev
```

See [`.env.example`](.env.example) for the full list of environment variables and where to get each one.

### Enabling brokerage linking (free)

1. Sign up at https://dashboard.plaid.com/signup — instant, Sandbox keys are free.
2. Add `PLAID_CLIENT_ID` and `PLAID_SECRET` to `.env`.
3. Restart the dev server. The "Connect Brokerage Account" button activates.
4. In the Plaid Sandbox popup, pick any institution and log in with username `user_good` / password `pass_good`.

Real (production) brokerage linking is also available for free — Plaid's Trial plan allows up to 10 real connected accounts at $0. Apply for production access from the Plaid dashboard, then swap `PLAID_ENV` from `sandbox` to `production` along with the production keys.

### Enabling AI reports (free)

1. Get a key at https://aistudio.google.com/apikey.
2. Add `GEMINI_API_KEY` to `.env`.
3. Add a `WatchlistItem` or connect a brokerage account, then wait for the next scheduled run (see the schedule in [`vercel.json`](vercel.json)) — there is no manual trigger button by design.
4. In production, set `GEMINI_API_KEY` and `CRON_SECRET` as Vercel environment variables so the cron routes can authenticate.

## Known limitations

- Plaid Sandbox provides realistic *fake* holdings data by default — see the production upgrade path above for real accounts.
- Reports have no live web search (kept out to guarantee the free tier holds forever). Every claim is instead grounded in the structured data sources listed above, fetched fresh at generation time.
- Personal project, not an audited fintech product — every report is a starting point for further research, not financial advice.
