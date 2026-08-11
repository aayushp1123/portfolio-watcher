# Portfolio Watcher

A personal investing dashboard: connect a brokerage account, set an allocation
target and exit rules, and get AI-researched Daily Digest, Weekly Trends, and
Breaking News reports generated specifically from your own holdings — not a
generic market feed.

**Live demo:** https://portfolio-watcher-murex.vercel.app

## Features

- **Auth** — email/password signup and login (NextAuth, bcrypt-hashed passwords)
- **Brokerage linking** — Plaid Link for connecting accounts, access tokens encrypted at rest
- **Goals & exit rules** — target allocation across core ETF / individual growth / speculative buckets, plus per-ticker price-target, trailing-stop, and stop-loss rules
- **Daily Digest** — total value, a Buy/Hold/Sell rating and risk read on every holding, exit-rule status, dividend and tax notes
- **Weekly Trends** — actual allocation vs. target, market trends, and new stock/ETF ideas worth researching
- **Breaking News** — a quiet watch for material news or large price moves on holdings you actually own
- **Scheduled reports** — Vercel Cron triggers all three report types automatically once an API key is configured; no manual button required
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
| AI / research | Gemini (Flash + Google Search grounding), structured JSON output |
| Hosting | Vercel, deployed via GitHub integration |
| Scheduling | Vercel Cron Jobs |

## Architecture

Reports are generated server-side against a Zod schema: the model is given
the user's real holdings, cost basis, exit rules, and goals, grounded with
live web search, and constrained to return structured JSON matching the
schema in [`src/lib/reports/schemas.ts`](src/lib/reports/schemas.ts) — no
free-form text parsing. Each report type (`dailyDigest.ts`, `weeklyTrends.ts`,
`breakingNews.ts`) owns its own prompt and schema, and is invoked either
on-demand from the dashboard or by a Vercel Cron route
(`src/app/api/cron/*`), which shares the same generation code via
[`runBatch.ts`](src/lib/reports/runBatch.ts).

## Cost

Everything here runs on free tiers — signup, goals, exit rules, the sample
dashboard, brokerage linking (Plaid Sandbox), AI report generation (Gemini
free tier), hosting (Vercel Hobby), and the database (Neon free tier) all
cost $0. Two features are gated behind your own free API keys and are
visibly disabled (not broken) until you add them:

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

See [`.env.example`](.env.example) for the full list of environment
variables and where to get each one.

### Enabling brokerage linking (free)

1. Sign up at https://dashboard.plaid.com/signup — instant, Sandbox keys are free.
2. Add `PLAID_CLIENT_ID` and `PLAID_SECRET` to `.env`.
3. Restart the dev server. The "Connect Brokerage Account" button activates.
4. In the Plaid Sandbox popup, pick any institution and log in with
   username `user_good` / password `pass_good`.

### Enabling AI reports (free)

1. Get a key at https://aistudio.google.com/apikey.
2. Add `GEMINI_API_KEY` to `.env`.
3. Restart the dev server. The "Generate Report" buttons activate.
4. In production, set `GEMINI_API_KEY` and `CRON_SECRET` as Vercel
   environment variables — [`vercel.json`](vercel.json) wires up the daily
   and weekly cron schedule automatically.

## Known limitations

- Plaid Sandbox provides realistic *fake* holdings data, not a real
  brokerage account — real (production) Plaid access is a separate,
  harder step not covered here.
- This is a personal project, not an audited fintech product. AI-generated
  research is not licensed real-time market data — treat every report as a
  starting point for your own research, not financial advice.
