# Portfolio Watcher

A personal investing dashboard: connect a brokerage account (or just build a
watchlist), set an allocation target and exit rules, and get Daily Digest,
Weekly Trends, and Breaking News reports generated specifically from your own
holdings — not a generic market feed. Reports run entirely on a schedule; no
manual button, no external data subscription.

**Live demo:** https://portfolio-watcher-murex.vercel.app

## Features

- **Auth** — email/password signup and login (NextAuth, bcrypt-hashed passwords)
- **Brokerage linking** — Plaid Link for connecting accounts, access tokens encrypted at rest
- **Watchlist** — no brokerage account? Add tickers manually and get the same research and ratings, no connection required
- **Goals & exit rules** — target allocation across core ETF / individual growth / speculative buckets, plus per-ticker price-target, trailing-stop, and stop-loss rules, with autocomplete ticker search
- **Daily Digest** — total value, a Buy/Hold/Sell rating and risk read on every holding and watchlist ticker, exit-rule status, dividend and tax notes, and a forward-looking "What to Watch Next" section
- **Weekly Trends** — actual allocation vs. target, market trends, and new stock/ETF ideas worth researching
- **Breaking News** — a quiet watch for material developments on holdings you actually own
- **Fully scheduled** — Vercel Cron triggers all three report types automatically (Daily Digest at market open + close, Breaking News hourly during market hours, Weekly Trends every Monday) — there is no manual "Generate" control anywhere in the UI
- **History** — every report page keeps a browsable history of past runs, plus "last updated" / "next scheduled run" shown on each page
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
| Dev tooling | Built with Claude Code |

## Architecture

Reports are generated server-side against a Zod schema: the model is given
the user's real holdings, cost basis, exit rules, goals, and watchlist, and
constrained to return structured JSON matching the schema in
[`src/lib/reports/schemas.ts`](src/lib/reports/schemas.ts) — no free-form
text parsing. Each report type (`dailyDigest.ts`, `weeklyTrends.ts`,
`breakingNews.ts`) owns its own prompt and schema, and is invoked exclusively
by a Vercel Cron route (`src/app/api/cron/*`) on the schedule defined in
[`vercel.json`](vercel.json), sharing generation code via
[`runBatch.ts`](src/lib/reports/runBatch.ts). The same schedule is mirrored
in [`src/lib/cronSchedule.ts`](src/lib/cronSchedule.ts) so each page can show
its own next-run time without an extra API call.

## Cost

Everything here runs on free tiers — signup, goals, exit rules, the sample
dashboard, brokerage linking (Plaid Sandbox), AI report generation (Gemini
free tier), hosting (Vercel Hobby), the cron schedule, and the database (Neon
free tier) all cost $0, and none of the connected services have a payment
method on file — nothing can auto-upgrade to a paid tier on its own. Two
features are gated behind your own free API keys and are visibly disabled
(not broken) until you add them:

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

Real (production) brokerage linking is also possible for free — Plaid's
Trial plan allows up to 10 real connected accounts at $0. Apply for
production access from the Plaid dashboard, then swap `PLAID_ENV` from
`sandbox` to `production` along with the production keys.

### Enabling AI reports (free)

1. Get a key at https://aistudio.google.com/apikey.
2. Add `GEMINI_API_KEY` to `.env`.
3. Add a `WatchlistItem` or connect a brokerage account, then wait for the
   next scheduled run (see the schedule in [`vercel.json`](vercel.json)) —
   there is no manual trigger button by design.
4. In production, set `GEMINI_API_KEY` and `CRON_SECRET` as Vercel
   environment variables so the cron routes can authenticate.

## Known limitations

- Plaid Sandbox provides realistic *fake* holdings data, not a real
  brokerage account by default — see the production upgrade path above.
- Reports do not use live web search (kept out to guarantee this stays free
  forever on Gemini's free tier). Every report discloses that prices may be
  approximate; the risk ratings, Buy/Hold/Sell calls, and analysis are still
  the model's own full-confidence reasoning, just not tied to a live quote.
- This is a personal project, not an audited fintech product — treat every
  report as a starting point for your own research, not financial advice.
