# Portfolio Watcher

A personal investing dashboard I designed and built from scratch — connect a real brokerage account (or just keep a watchlist), and get AI-written Daily Digest, Weekly Trends, and Breaking News reports generated specifically from your own holdings, grounded in real financial data pulled from official free sources (SEC filings, Federal Reserve economic data, FINRA, live market data, congressional trading disclosures) rather than a generic market feed. Everything runs on a fixed schedule — no manual "generate" button anywhere — and the entire stack runs at **$0/month**, on purpose, by design.

**Live:** https://portfolio-watcher-murex.vercel.app

I built this because I wanted a real tool for tracking my own portfolio and my dad's, not a toy — one that could reason about actual holdings with real numbers behind every claim, run unattended on a schedule, and never risk a surprise bill. It turned into a full-stack project spanning auth, a Postgres schema, a brokerage integration, a scheduled AI pipeline grounded in half a dozen official data sources, and a fair amount of interactive front-end work.

## How I built it

Roughly in the order I actually built it, each stage shipped and working before moving to the next:

1. **Database and auth first.** Designed the Postgres schema in Prisma (`User`, `Goal`, `ExitRule`, `WatchlistItem`, `PlaidItem`, `Report`) before writing any UI, then wired up email/password auth with NextAuth and bcrypt.
2. **Brokerage linking.** Integrated Plaid for account connection, with access tokens encrypted at rest — this is what turns a static watchlist into a real portfolio with live positions and cost basis.
3. **The AI report pipeline.** Built structured-output report generation against a Zod schema (no free-form text parsing) — three report types (Daily Digest, Weekly Trends, Breaking News), each with its own prompt and JSON schema.
4. **Killed the manual button.** Moved report generation entirely onto Vercel Cron so it runs unattended on a real schedule, matching how I'd actually want to use it day to day.
5. **Watchlist mode.** Added a path for research and ratings without requiring a linked brokerage account at all.
6. **Layered in real data sources**, one at a time, to ground every AI claim in something verifiable instead of model guesswork: live market data and computed technical indicators, SEC EDGAR filings and insider activity, real multi-year earnings/balance-sheet/cash-flow history pulled straight from SEC XBRL filings, Federal Reserve macro data, congressional stock trade disclosures, FINRA short-sale volume, and a personalized multi-source news feed.
7. **Built the quantitative layer on top** — realized volatility, beta, max drawdown, holding correlation, and a fully deterministic (non-AI) Fit Score, all computed directly from the real data already being pulled in, specifically to keep the model's output honest and checkable.
8. **Hardened the prompts against hallucination** — an explicit source-of-truth rule requiring every stated fact to trace back to real data given in the prompt, and a required bull-case-vs-bear-case weighing before any rating.
9. **Rebuilt the front end** around an interactive dashboard: a click-to-expand portfolio modal with real benchmark comparisons, a per-ticker detail view with Line/Bar/Candlestick/Compare charts, hover-explained metrics throughout, and a full dark-themed visual pass.
10. **Rounded out account management** — delete-account and forgot-password flows, the last pieces needed to call it a real product rather than a demo.

## Features

- **Auth** — email/password signup and login, forgot-password flow via email, account deletion
- **Brokerage linking** — Plaid Link for connecting accounts, access tokens encrypted at rest
- **Watchlist** — no brokerage account? Add tickers manually and get the same research and ratings
- **Goals & exit rules** — target allocation across core ETF / individual growth / speculative buckets, plus per-ticker price-target, trailing-stop, and stop-loss rules
- **Daily Digest** — live-priced total value, a Buy/Hold/Sell rating and risk read on every holding and watchlist ticker grounded in real fundamentals and momentum, exit-rule status, tax notes, and a forward-looking outlook
- **Weekly Trends** — actual allocation vs. target, concentration/correlation flags, and new stock/ETF ideas worth researching
- **Breaking News** — a deterministic watch for real price moves, fresh headlines, SEC filings, and 52-week extremes on holdings actually owned
- **Interactive dashboard** — click-to-expand portfolio view with real S&P 500 benchmarking, best/worst performers, and allocation breakdowns; a per-stock modal with Line/Bar/Candlestick/Compare charts and a transparent Fit Score
- **Hover-explained everything** — every rating, risk figure, and computed metric has an inline explanation of what it means and why
- **Fully scheduled** — Vercel Cron triggers all three report types automatically; there is no manual "Generate" control anywhere in the UI
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
| AI / research | Gemini (Flash), structured JSON output |
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

Realized volatility, beta, max drawdown, correlation, trailing P/E, and the Fit Score are all computed directly from this data — never left to the model to estimate.

## Architecture

Reports are generated server-side against a Zod schema: the model is given the user's real holdings, cost basis, exit rules, goals, watchlist, and every data source above, and constrained to return structured JSON matching the schema in [`src/lib/reports/schemas.ts`](src/lib/reports/schemas.ts). Each report type (`dailyDigest.ts`, `weeklyTrends.ts`, `breakingNews.ts`) owns its own prompt and schema, invoked exclusively by a Vercel Cron route (`src/app/api/cron/*`) on the schedule defined in [`vercel.json`](vercel.json), sharing generation code via [`runBatch.ts`](src/lib/reports/runBatch.ts).

## Cost

Everything here runs on free tiers — signup, goals, exit rules, the sample dashboard, brokerage linking (Plaid Sandbox), AI report generation (Gemini free tier), hosting (Vercel Hobby), the cron schedule, and the database (Neon free tier) all cost $0, and none of the connected services have a payment method on file. Two features are gated behind your own free API keys and are visibly disabled (not broken) until you add them:

| Feature | Requires |
|---|---|
| Connecting a brokerage account | Free [Plaid Sandbox](https://dashboard.plaid.com/signup) signup |
| AI-generated reports + the schedule | Free [Gemini API](https://aistudio.google.com/apikey) key |

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

Real (production) brokerage linking is also possible for free — Plaid's Trial plan allows up to 10 real connected accounts at $0. Apply for production access from the Plaid dashboard, then swap `PLAID_ENV` from `sandbox` to `production` along with the production keys.

### Enabling AI reports (free)

1. Get a key at https://aistudio.google.com/apikey.
2. Add `GEMINI_API_KEY` to `.env`.
3. Add a `WatchlistItem` or connect a brokerage account, then wait for the next scheduled run (see the schedule in [`vercel.json`](vercel.json)) — there is no manual trigger button by design.
4. In production, set `GEMINI_API_KEY` and `CRON_SECRET` as Vercel environment variables so the cron routes can authenticate.

## Known limitations

- Plaid Sandbox provides realistic *fake* holdings data by default — see the production upgrade path above for real accounts.
- Reports have no live web search (kept out to guarantee the free tier holds forever). Every claim is instead grounded in the structured data sources listed above, fetched fresh at generation time.
- This is a personal project, not an audited fintech product — treat every report as a starting point for your own research, not financial advice.
