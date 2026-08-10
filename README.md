# Portfolio Watcher

A personal investing command center: create an account, connect a brokerage
account, set your goals, and get AI-researched Daily Digest, Weekly Trends,
and Breaking News reports — built for you specifically, not hardcoded.

## Cost — read this first

**Everything in this app is free by default and stays that way until you
personally add paid credentials.** Two features are gated behind your own
keys and are visibly disabled (not broken) until you add them:

| Feature | Requires | Cost |
|---|---|---|
| Connecting a brokerage account | Free Plaid Sandbox signup | $0 forever (Sandbox has no billing) |
| AI-generated reports + the auto-scheduler | Your own Anthropic API key | Pay-per-use — the one real cost |

Everything else — signup/login, goals, exit rules, the whole dashboard UI —
works fully with **zero keys of any kind**.

## Setup

```bash
npm install
# .env already exists with NEXTAUTH_SECRET and PLAID_TOKEN_ENCRYPTION_KEY
# pre-generated locally — no external signup needed for those two.
npx prisma migrate dev # only needed if you delete dev.db and start fresh
npm run dev
```

Open the URL the terminal prints (usually http://localhost:3000, or the
next free port if 3000 is taken).

### Enabling brokerage linking (free)

1. Sign up at https://dashboard.plaid.com/signup — instant, Sandbox keys are free.
2. Add `PLAID_CLIENT_ID` and `PLAID_SECRET` to `.env`.
3. Restart the dev server. The "Connect Brokerage Account" button activates.
4. In the Plaid Sandbox popup, pick any institution and log in with
   username `user_good` / password `pass_good`.

### Enabling AI reports (the one real cost)

1. Get a key at https://console.anthropic.com.
2. Add `ANTHROPIC_API_KEY` to `.env`.
3. Restart the dev server. The "Generate Report" buttons activate and the
   background scheduler starts (check the terminal log for confirmation —
   it prints the cron schedule it registered).

You can enable either feature independently, in either order, whenever
you're ready — nothing else in the app depends on them.

## What's here

- **Auth**: email/password signup and login (NextAuth, bcrypt-hashed passwords).
- **Onboarding**: set a target allocation, optionally connect a brokerage account.
- **Dashboard**: Daily Digest (holdings, exit rules, risk ratings, tax notes),
  Weekly Trends (allocation check, new stock ideas), Breaking News (quiet
  unless something material happened).
- **Settings**: edit your goal, manage exit rules (price target / trailing
  stop / stop-loss per ticker), see connected accounts and setup status.
- **Scheduler**: once an API key is added, reports also generate automatically
  on a schedule (`CRON_*` env vars) — but only while the dev/prod server
  process stays running; there's no external cron infra, by design.

## Known limitations

- Plaid Sandbox gives you realistic *fake* holdings data, not your real
  brokerage account — real (production) Plaid access is a separate, harder
  step not covered here.
- The scheduler only fires while this process is running — no catch-up on
  missed runs if your laptop sleeps or the server isn't up.
- This is a personal project, not an audited fintech product. AI-generated
  research is not licensed real-time market data — treat every report as a
  starting point for your own research, not financial advice.
