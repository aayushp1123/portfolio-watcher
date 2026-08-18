# Portfolio Watcher — Handoff Document

**Live URL:** https://portfolio-watcher-murex.vercel.app
**Repo:** https://github.com/aayushp1123/portfolio-watcher
**Last updated:** 2026-08-12

A personal investing dashboard: connects to a real (or sandbox) brokerage via Plaid, generates AI-written reports (Daily Digest, Weekly Trends, Breaking News) grounded in real free financial data, and supports a watchlist for users without a brokerage connection. Built and run at **$0/month forever** — no payment method exists anywhere in this stack, and every design decision was made to keep it that way permanently.

---

## 1. Hard Rules Established This Session

These are non-negotiable constraints that shaped every decision. Any future work should respect them unless the user explicitly says otherwise.

1. **$0 forever, zero billing risk.** No payment method on file anywhere (Vercel, Neon, Plaid, Gemini, GitHub). Every new feature/data source was vetted for a genuinely free tier before being added. Two services were explicitly evaluated and **rejected** for requiring payment: Unusual Whales (options flow/dark pool API, ~$50+/mo) and Perplexity/Firecrawl APIs (no sustainable free tier).
2. **No manual "Generate Report" button.** Everything runs on Vercel Cron on a fixed schedule. The user was explicit and repeated this multiple times early in the project.
3. **Watchlist never affects real portfolio $ amounts or percentages.** Confirmed multiple times — watchlist is purely informational/research, fully separate from actual holdings math.
4. **UI/layout must never change during backend work** unless a UI change is explicitly requested. Many rounds of "make sure everything else looks/works the same" — backend-only batches (report-generation hardening, new data sources) were verified to touch zero UI/schema files.
5. **Always open a new Safari tab automatically after every deploy**, no need to ask each time (standing instruction, confirmed early and followed for the rest of the session).
6. **Prefer no-signup data sources when possible.** FRED (macro data) is the one exception that needs a free signup + API key, kept as optional/gracefully-degrading. Everything else added later in the session was deliberately chosen to require zero signup.
7. **No hallucination, no speculation, no outside/unverified info in AI reports.** A "source-of-truth rule" is now enforced at the top of every report-generation prompt: every specific fact/number/date must come from real data given in the prompt; general analytical reasoning from training knowledge is fine, inventing specific facts is not.

---

## 2. What's Connected / Configured

| Service | Purpose | Plan/Tier | Notes |
|---|---|---|---|
| **Vercel** | Hosting, Cron Jobs | Hobby (free) | Deploys via GitHub push (not local CLI — CLI was flaky). 7 cron jobs registered (see below). |
| **Neon (via Vercel Marketplace)** | Postgres database | Free tier | Provisioned through Vercel Marketplace, throttles rather than bills on overage. |
| **Google Gemini API** | AI report generation | Free tier | Model: `gemini-flash-latest`. **Hard limit: 20 requests/day, shared across the whole project** (not per-user). This is the single biggest constraint on the app — see §7. |
| **Plaid** | Brokerage account linking | Sandbox (currently) | Free forever. Real accounts possible via Plaid's **Trial** plan (up to 10 real linked accounts, $0, no card) — not yet activated, see §8. |
| **FRED** | Macro data (Fed funds, CPI, unemployment) | Free, requires signup | Optional — `FRED_API_KEY` env var; app degrades gracefully if unset. |
| **Gmail SMTP** | Password reset emails | Free (existing Gmail account) | Uses an App Password on the user's own Gmail — zero new signup, just enabling something in an existing Google account. |
| **GitHub** | Source control, triggers Vercel deploys | Free | — |

**No signup required at all** for: Yahoo Finance (quotes/momentum/OHLC), SEC EDGAR (filings, insider activity, XBRL fundamentals), FINRA (short volume), House/Senate Stock Watcher (congressional trades), all 8+ news RSS feeds + Google News.

---

## 3. Cron Schedule (Vercel Cron, all times UTC)

```
/api/cron/daily-digest    35 13 * * 1-5   (9:35am ET, weekdays)
/api/cron/daily-digest     5 20 * * 1-5   (4:05pm ET, weekdays)
/api/cron/weekly-trends    0 12 * * 1     (8:00am ET, Mondays)
/api/cron/breaking-news   20 13 * * 1-5   (9:20am ET, weekdays)
/api/cron/breaking-news   20 15 * * 1-5   (11:20am ET, weekdays)
/api/cron/breaking-news   20 17 * * 1-5   (1:20pm ET, weekdays)
/api/cron/breaking-news   20 19 * * 1-5   (3:20pm ET, weekdays)
```

Breaking News was originally 8x/day but was **reduced to 4x/day** after discovering it was pushing total daily Gemini usage right up against the shared 20-request/day ceiling with zero margin (see §7 for the incident).

---

## 4. What We Built (by category)

### Core report generation
- Migrated from Anthropic to Gemini (Anthropic has no ongoing free API tier).
- Three report types: **Daily Digest** (holdings + watchlist, ratings, exit-rule status, tax notes), **Weekly Trends** (allocation check, new stock ideas, watchlist research), **Breaking News** (deterministic event triggers → AI-written alerts).
- Fully scheduled, zero manual trigger.
- Watchlist feature (users without Plaid can still get research/ratings).
- Auto-sync: Plaid holdings refresh automatically before every report generation (previously required a manual "Sync" click — fixed).

### Free data sources feeding the AI (all real, verified against production data)
- **Yahoo Finance** (unauthenticated): live price, 52-week high/low, full OHLC, momentum (1mo/3mo %, 20/50-day averages).
- **SEC EDGAR**: material filings (8-K/10-Q/10-K), insider activity (Form 4/144), and **real multi-year revenue/net income/balance-sheet/free-cash-flow history** via the XBRL company-facts API (~8 years back).
- **FRED**: Fed funds rate, CPI, unemployment (optional).
- **House/Senate Stock Watcher**: real congressional stock trade disclosures.
- **FINRA**: real daily short-sale-volume % (via the classic anonymous static-file distribution, not their newer auth-required Query API).
- **News**: 8 RSS feeds (Yahoo, CNBC, MarketWatch, Investing.com, Motley Fool, Nasdaq, WSJ Markets, Seeking Alpha) + Google News search, personalized to the user's own tickers, with real publisher attribution and precise timestamps.
- **Computed/derived (pure math, zero new source)**: pairwise holding correlation, realized volatility, beta vs. S&P 500, max drawdown, return-to-volatility ratio, trailing P/E, sector classification (static curated map), a fully deterministic **Fit Score** (0-100, transparent breakdown).

### Report-generation hardening (backend-only, no UI change)
- Centralized "source-of-truth rule" in every prompt: no fact/number/date beyond what's explicitly given.
- Explicit bull-case-vs-bear-case weighing required before every rating.
- Never claims "beat/missed Wall Street consensus" (no free source for analyst estimates exists — the app is honest about this rather than fabricating it).
- Trend classification deliberately uses revenue/net-income/free-cash-flow (dollar totals), **never EPS** — EPS is per-share and gets distorted by stock splits (caught via a real NVDA 2024-split discontinuity during testing).

### UI features
- Site-wide dark theme with a teal "spotlight" radial-gradient background (forced `data-theme="dark"`, leverages the pre-existing full dark-mode token system).
- Portfolio Dashboard modal: click-to-expand from the dashboard, live total value, 1D/1W/1M/YTD returns vs. real S&P 500 benchmark, best/worst holdings, allocation by holding/sector — all deterministic, refreshable for free with zero Gemini cost.
- Per-stock detail modal: click any ticker anywhere in any report → live price, 52wk range, momentum, Fit Score, and the AI's own "bottom line" commentary for that ticker (reused from the most recent report, not a new AI call).
- Shared `PremiumChart` component: smooth curved lines, gradient fill, decorative dots, glow-ring hover, floating tooltip — used everywhere.
- **Chart types**: Line / Bar / Candlestick (real OHLC) / Compare (search a second ticker, overlays a rebased line, shows both tickers' full stats/bottom-line side by side in the per-stock modal).
- `InfoTooltip`: small hover-triggered explanatory bubble applied to nearly every number/rating/pill site-wide, auto-flips to open downward near the top of a modal so it never gets clipped.
- Rating track record (past Buy/Hold/Sell calls checked against real current prices), report diffs ("what changed since last report"), portfolio value-over-time chart.
- Subtle site-wide button/tab hover-lift/press-scale micro-interactions (via the UI/UX Pro Max skill's motion guidance — see §6).
- Delete-account flow (confirmation modal → cascading delete).
- Forgot-password flow (email → reset link → new password), sent via the user's own Gmail App Password, zero new signup.

---

## 5. Skills Used

- **`ui-ux-pro-max`** (installed mid-session via `npx ui-ux-pro-max-cli init --ai claude`, now living in `.claude/skills/`) — used its `motion.csv`/`app-interface.csv` reference data to inform button/tab hover-lift and press-scale timings, and its bento-card/gradient-spotlight aesthetic for the modal headers and page background.
- **`schedule`** — used earlier in the broader session for unrelated personal Claude cloud routines (not part of this app's own Vercel Cron, which is separate).
- **Vercel plugin skills** (`vercel-functions`, `vercel-storage`) — informational context only, no direct actions taken through them this session.

---

## 6. What We Tried and Didn't Pursue (with reasons)

| Idea | Why it didn't happen |
|---|---|
| **Unusual Whales MCP/API** | Real data (options flow, dark pool) requires a paid subscription (~$50+/mo). User chose to skip and stay free. |
| **Perplexity / Firecrawl MCP** | Both are paid APIs with no sustainable free tier for ongoing automated use. |
| **Playwright / Context7 MCP** | Architectural mismatch — MCP servers are tools *I* (Claude) use during a session, not something a deployed Vercel serverless backend calls at runtime. Context7 is a coding-docs lookup tool, irrelevant to stock data. Playwright is free but running headless browser scraping inside a scheduled serverless pipeline is fragile/expensive, and ad-hoc scraping conflicts with the "only reputable structured sources" standard. |
| **SEC 13F institutional holdings ("smart money")** | The only free version buildable without heavy XML parsing is a raw filing-count proxy, too weak/approximate to responsibly present as a "smart money" signal. Explicitly skipped to avoid shipping a misleading number. |
| **Insider Form 4 buy/sell direction** | SEC EDGAR filing metadata (form type, date, URL) doesn't include the parsed transaction code (buy vs. sell) — only the actual filing XML does, which isn't fetched. Presence of insider activity is shown; direction is not claimed. |
| **Free earnings calendar** | No reliable free unauthenticated source found. |
| **Yahoo `quoteSummary` analyst estimates / calendar events** | Requires a session "crumb" (auth token) Yahoo doesn't grant anonymously — confirmed via direct testing, abandoned rather than force a fragile workaround. |
| **Quarterly (10-Q) fundamentals** | Currently only annual (10-K) data is pulled from XBRL — balance sheet figures can be up to ~12 months stale relative to the latest quarter. Flagged as a possible future improvement, not built. |
| **Peer/industry P/E benchmarking** | Only the ticker's own trailing P/E is computed; no reliable free way to aggregate a sector-average P/E for comparison. |

---

## 7. Real Bugs Found and Fixed This Session

Listed because the *root causes* are useful context for future debugging, not just "it's fixed now":

- **Vercel deploys stuck in "UNKNOWN"** — orphaned background `vercel deploy` CLI processes racing each other; switched to git-push-triggered deploys as the reliable path.
- **Git-triggered deploy blocked** — commit author email didn't match a verified account; fixed via `git config --global user.email`.
- **Gemini model 404** — `gemini-2.5-flash` was deprecated for new users; reverted to `gemini-flash-latest`.
- **Google Search grounding tool required billing** even at $0 actual usage — confirmed via direct API testing, dropped entirely rather than risk billing.
- **Invisible hero-page SVG graphics** — `stroke="var(--x)"` as a raw SVG attribute doesn't resolve CSS custom properties; needs the `style` prop instead. Same class of bug recurred and was pre-empted in later chart components by always using `style`.
- **Nav rendering as 3 stacked rows** — a `grid-cols-[1fr_auto_1fr]` layout quirk; replaced with flex.
- **Watchlist-only users silently skipped** in report generation — the batch query only checked for an active Plaid connection.
- **Holdings not auto-reflecting trades** — Plaid sync only happened on manual button click; added auto-refresh before every scheduled report.
- **Gemini's shared 20-req/day quota** — discovered via a real production failure (Weekly Trends/Breaking News silently not generating while Daily Digest succeeded). Root cause: the quota is per-*project*, shared across every user and report type, not per-user as assumed — and it resets at **midnight Pacific**, not midnight UTC. Fixed by cutting Breaking News from 8x/day to 4x/day for real headroom.
- **XBRL revenue data gaps** — the tag-merging logic stopped at the first XBRL tag with *any* data, silently truncating companies (like Apple) that switched tag names mid-history. Fixed to merge across all known tags.
- **NVDA EPS "collapse"** — a real stock-split (2024, 10-for-1) created a fake-looking EPS discontinuity in raw XBRL data. Fixed by computing all trend classifications from revenue/net-income/FCF (dollar totals, split-insensitive) and never from EPS.
- **FINRA's modern Query API requires an auth token** (confirmed via direct testing, 401 response) — the older static file distribution at `cdn.finra.org` does not and was used instead.
- **Allocation bar collapsing after adding hover tooltips** — wrapping a percentage-width flex child in an extra `<span>` wrapper broke the percentage-resolution chain twice over (outer span had no explicit width, then the inner span didn't propagate it either). Fixed by adding proper `className`/`style` passthrough and `flex-1` on the inner wrapper.
- **InfoTooltip clipped near the top of modals** — always opened upward; now measures its position and flips to open downward when there's no room above.
- **Dollar amounts silently dropping trailing zero cents** (`$270.5` instead of `$270.50`) — several `toLocaleString()` calls were missing `minimumFractionDigits: 2`.

---

## 8. What's NOT Done / Suggested Next Steps

1. **Upgrade Plaid from Sandbox to real accounts.** Plaid's Trial plan supports up to 10 real linked brokerage accounts for $0, no card. This is the actual original goal (the user's dad connecting a real account) and hasn't been activated yet — just needs applying for Trial/production access through the Plaid dashboard, then swapping `PLAID_ENV=sandbox` → `production` and the client_id/secret. No code changes needed.
2. **Quarterly fundamentals** — extend the XBRL pull to 10-Q filings for fresher balance-sheet data between annual reports.
3. **Peer/sector P/E benchmarking** — would need a reliable free way to aggregate multiple companies' P/Es by sector; not yet solved.
4. **Monitor the Gemini quota as usage grows.** The 20-req/day shared ceiling was already tight with 1-2 users; if more users are added, the schedule (or user count) will need re-balancing again.
5. Nothing else was left mid-implementation — every task started this session was completed, verified against real data, and deployed.

---

## 9. Public-Facing Text (README, GitHub description)

The `README.md` and the GitHub repo description were rewritten twice at the user's request. First pass used first-person "I built this" narrative framing with a personal backstory paragraph (mentioning tracking the user's and their dad's portfolios) — the user then explicitly corrected this: **no personal pronouns ("I"/"me"/"my"), no personal backstory, no storytelling tone at all.** Final version is fully analytical/neutral engineering voice (matches `it-service-desk-analytics`/`s-p500-etl-dataset` style exactly), keeps the numbered chronological build-process section but phrased as objective engineering stages ("Schema and auth implemented first" not "I built the database first"). **Claude Code is mentioned exactly once**, in the tech stack table, framed as a supplemental coding aid, not the primary dev tool. If the README is touched again: stay analytical/neutral, zero first-person language, zero personal/family references.

## 10. Key File Locations (quick reference for a fresh session)

**Report generation (the core AI pipeline):**
- `src/lib/reports/buildContext.ts` — assembles every real data source into one `UserReportContext` object per user. Start here to see everything a report generator has access to.
- `src/lib/reports/dailyDigest.ts`, `weeklyTrends.ts`, `breakingNews.ts` — the three generators; each has a `SYSTEM_PROMPT` and a `buildUserMessage()` function.
- `src/lib/reports/schemas.ts` — Zod schemas defining the exact JSON shape Gemini must return.
- `src/lib/reports/runBatch.ts` — the cron entry point, loops over all eligible users.
- `src/app/api/cron/*/route.ts` — the three Vercel Cron endpoints.

**Free data source libs (each independently free/verified):**
- `src/lib/quotes.ts` — Yahoo Finance (price, momentum, OHLC, historical closes).
- `src/lib/secEdgar.ts` — SEC EDGAR (filings, insider activity, XBRL earnings/balance-sheet/cash-flow history).
- `src/lib/fred.ts` — FRED macro data (optional key).
- `src/lib/congressTrading.ts` — House/Senate Stock Watcher.
- `src/lib/finra.ts` — FINRA short-sale volume.
- `src/lib/newsFeed.ts` — RSS + Google News aggregation.
- `src/lib/riskMetrics.ts` — pure-math volatility/beta/drawdown/P/E, zero external calls.
- `src/lib/portfolioAnalytics.ts` — holding correlation.
- `src/lib/fitScore.ts` — the deterministic 0-100 Fit Score.
- `src/lib/sectors.ts` — static ticker→sector map.

**Key UI components:**
- `src/components/dashboard/PremiumChart.tsx` — the shared chart (Line/Bar/Candlestick/Compare).
- `src/components/dashboard/PortfolioDashboardModal.tsx`, `StockDetailModal.tsx` — the two big click-to-expand modals.
- `src/components/ui/InfoTooltip.tsx` — the hover-explanation bubble used everywhere.
- `src/app/globals.css` — theme tokens (light/dark) and the site-wide gradient background.

**Schema/DB:**
- `prisma/schema.prisma` — all models (User, Goal, ExitRule, WatchlistItem, PlaidItem, Report, PasswordResetToken).

**Verification pattern used all session** (see §9 below): a throwaway `.mts` script in the repo root, run via `export DATABASE_URL=$(grep ... .env.local) && npx tsx script.mts`, then deleted — never committed. Use this before trusting any new data source's output.

---

## 11. Verification Discipline Used Throughout

Worth preserving as a practice going forward: every new data source added this session was verified against **real production data** (via a temporary `tsx` script hitting the live Neon database + real free APIs) before being wired into the AI prompts, not just built and assumed correct. This caught several of the bugs listed in §7 before they ever reached a real report. Recommend continuing this pattern for any future data-source additions.

---
---

# Session 2 — 2026-08-18 Update

**Last updated:** 2026-08-18

Everything below is additional context from a second working session, laid out in the same shape as the handoff above. Nothing above this line was changed or removed — this picks up from where §1–§11 left off.

---

## 1. Hard Rules Established/Reconfirmed This Session

1. **$0 forever, zero billing risk — reconfirmed, and held even under scaling pressure.** When asked "how do I get more free tokens so this runs more often," the answer was explicitly *not* to chase bigger free-tier pools, but to spend the existing fixed budget more efficiently (see §4, batch efficiency) and to add one more legitimate free-tier AI provider (Groq) rather than a multi-account pooling tool. Two more tools were evaluated and **rejected** this session for real risk, not just cost — see §6.
2. **No manual "Generate Report" button — still holds**, though the Vercel dashboard's own cron "Run" button was used several times this session as an *admin/testing* action (not a user-facing feature) to manually trigger real report generation against production while verifying new code.
3. **New sources of free capability must not require an always-on server.** Both rejected tools this session (OmniRoute, MemOS) failed on this ground specifically — they need a self-hosted service running continuously, which doesn't fit a stateless Vercel Cron architecture and reintroduces the maintenance burden the whole stack was designed to avoid.
4. **New dependencies must be genuinely free with zero external calls, verified before installing.** Applied to `otplib` and `qrcode` (2FA) — both MIT-licensed, pure local computation, no signup, confirmed explicitly before use.
5. **Always open a new Safari tab automatically after every deploy — reconfirmed and followed.** One recurring limitation this session: the Chrome browser extension was unavailable for live visual QA on some UI changes; this was flagged honestly each time rather than claiming an unverified visual check had passed.
6. **When something breaks in production, verify the fix against the live site immediately** — don't just trust that a deploy succeeded. This wasn't written down as a rule before this session, but was followed strictly after a real production incident (§7) and is worth treating as a standing rule going forward.

---

## 2. What's Connected / Configured (Updates)

| Service | Purpose | Plan/Tier | Notes |
|---|---|---|---|
| **Groq** | Optional second AI engine | Free tier | `GROQ_API_KEY`/`GROQ_MODEL` env vars added, but **no real key has been added anywhere yet** (local or Vercel) — currently a complete no-op, every report still runs on Gemini alone. |
| **TOTP encryption key** | Encrypts 2FA secrets at rest | N/A (local secret) | `TOTP_SECRET_ENCRYPTION_KEY` generated and added to `.env.local`, but **not yet added to Vercel's production env vars** — 2FA will show "Not configured on this server" in production until this is added. |

Also learned this session: `GEMINI_API_KEY`, `PLAID_TOKEN_ENCRYPTION_KEY`, and `CRON_SECRET` are all marked **Sensitive** in the Vercel dashboard, which means `vercel env pull` cannot retrieve their real values locally (returns a `[SENSITIVE]` placeholder instead, by design). This blocks any local script from doing real AI report generation or decrypting real Plaid tokens — the only way to exercise those paths for real is through the live deployed app itself.

---

## 3. Cron Schedule

Unchanged from §3 above. Manually triggered a few times this session via the Vercel dashboard's cron "Run" button to test the Groq fallback and technical-indicator changes against real production data.

---

## 4. What We Built (by category)

### Technical indicators engine (new, zero new API cost)
- RSI(14), MACD(12,26,9), Bollinger Bands(20,2), 50/200-day moving-average golden/death cross, and 20-day support/resistance — all pure math (`src/lib/technicalIndicators.ts`), computed from the same free Yahoo daily closes already in use.
- Wired into all three report prompts (Daily Digest, Weekly Trends, Breaking News), a new deterministic Breaking News trigger (golden/death cross), and a new "Technicals" tile row in the stock detail modal.
- Verified against real live AAPL/NVDA/SPY data before being wired into any prompt.

### Optional Groq fallback engine (AI provider diversification)
- `src/lib/groq.ts` — a plain-fetch client (no SDK dependency), piloted only on Breaking News generation.
- Tries Groq first, validates its output against the exact same Zod schema Gemini's output goes through, falls back to Gemini automatically on any failure or schema-validation miss.
- The stored report's `model` field records which engine actually ran (e.g. `groq:openai/gpt-oss-120b` vs `gemini-flash-latest`) for later inspection.

### Batch efficiency for scaling to more users
- `getSharedMarketContext()` (`buildContext.ts`) — SPY momentum, VIX, macro, and SPY closes fetched once per batch run instead of once per user.
- Fair-rotation queue (`runBatch.ts`) — users processed in order of whoever's gone longest without a report of that kind, so a quota crunch doesn't always starve the same people.
- Quota circuit breaker — 3 consecutive quota-style failures stops the batch from continuing to hammer a dead API for the rest of that run.

### Site-wide timezone display fix
- New `src/components/ui/LocalTime.tsx` client component. Root cause: Server Components render on Vercel's server, which defaults to UTC — any `toLocaleString()` call made server-side bakes UTC into the page regardless of the viewer's real location. A report generated at 2:51 PM Eastern was showing as "6:51 PM" for everyone.
- Fixed across 7 files: `ReportPageHeader`, all three report history lists, `NewsSidebar`, `RatingTrackRecord`, `PortfolioValueChart`.

### Two-factor authentication (TOTP) + remember-me
- Full authenticator-app 2FA: QR-code enrollment, 10 single-use backup codes, a 5-attempt/15-minute lockout (the app had zero rate-limiting anywhere before this, so this was built from scratch specifically to cover the new attack surface), password-gated disable/regenerate.
- `src/lib/totp.ts` (otplib + qrcode, both free/local), 4 new API routes under `src/app/api/auth/2fa/`, new `TwoFactorSection.tsx` settings component.
- `src/lib/crypto.ts` generalized to take an optional key `envVar` parameter (defaults to the existing Plaid key, so no existing call sites changed) — the TOTP secret uses its own dedicated `TOTP_SECRET_ENCRYPTION_KEY`.
- Remember-me checkbox on login: unchecked sessions expire after 1 day, checked sessions keep the existing 30-day ceiling, enforced via custom claims in the JWT/session callbacks (NextAuth v4 doesn't support per-login dynamic cookie lifetimes cleanly, so this is the closest correct equivalent).
- Verified with a full scripted end-to-end test against the live dev server and real database (see §11), not just typechecked.

### Sliding-pill nav bar (built, then reverted)
- Adapted a pasted component prompt (animated framer-motion sliding tab highlight) into the dashboard nav, restyled from the demo's black-and-white to the site's actual teal/dark theme.
- Deployed, then the user asked to revert it shortly after — reverted cleanly via `git revert`, `framer-motion` dependency removed. Kept here as a record that it was tried, not because anything about it was broken.

### Production account cleanup
- Removed 2 of 3 user accounts from the live database — both were completely empty (0 reports, 0 Plaid connections, 0 watchlist items). One (`veerhpatel1071@gmail.com`) was flagged and explicitly confirmed before deleting, since it looked like it could be a family member's real signup rather than a test account. Kept `abpslcs@gmail.com` (23 reports, 1 Plaid connection, 2 watchlist items) as the only remaining account.

---

## 5. Skills Used

- **`artifact-design`** — loaded for a resume-interview-prep reference document, which ended up being built as a standalone print-styled PDF (via headless Chrome, embedded Google Fonts as data URIs) rather than a published Artifact, after the user asked for a PDF specifically mid-task.

---

## 6. What We Tried and Didn't Pursue (with reasons)

| Idea | Why it didn't happen |
|---|---|
| **OmniRoute** (LLM gateway pooling free-tier accounts across 90+ AI providers to inflate available tokens) | Architectural mismatch — it's a self-hosted gateway (Docker/Electron/local server), not something a stateless Vercel Cron job can call into. Also a real account-ban risk: it self-flags "15 providers ToS-flagged so you decide," and pooling free-tier accounts across many providers risks a ban landing on a real account. |
| **MemOS** (LLM "long-term memory" layer) | Solves a problem this app deliberately doesn't have — reports are one-shot and grounded fresh in real data every time by design (the whole point of the source-of-truth rule), not meant to rely on the model's own memory of past sessions. The app already has a simpler, purpose-built version of what it actually needs: diffing today's report against the last saved one. Also would've required self-hosting Neo4j *and* Qdrant alongside the existing Postgres — real added infrastructure for a capability not needed. |

---

## 7. Real Bugs Found and Fixed This Session

- **ESM import hoisting broke local env-var loading** — a throwaway verification script called `process.loadEnvFile()` *after* a static `import`, but ES module imports are hoisted and evaluated first, so the Prisma client read `DATABASE_URL` before it was set. Fixed by loading the env file via the Node CLI flag / `dotenv-cli` before the process starts, not inside the script.
- **Prisma migrations were silently targeting a stale placeholder database** — `prisma.config.ts` only auto-loads `.env` (which still has a leftover `file:./dev.db` placeholder from before Postgres was wired up), not `.env.local` (the real Neon URL). Worked around by exporting `DATABASE_URL` from `.env.local` explicitly before running migration commands.
- **A stale Turbopack cache crashed the local dev server outright** — a phantom "instrumentation hook" error referencing a `node-cron` module that doesn't exist anywhere in the repo (no `instrumentation.ts`, no `node-cron` dependency). Fixed by deleting `.next` and restarting clean.
- **Site-wide timezone bug** — see §4. Root cause was Server-Component date formatting always rendering in the server's UTC timezone regardless of the viewer's real location.
- **Production homepage crash (500) introduced by the remember-me feature.** `session` can now be a valid non-null object with `session.user === undefined` once a non-remembered session's 1-day window has elapsed — but several pages/layouts only checked `!!session` or `session ? session.user.id : null`, which still crashes on `.id` when `session.user` itself is undefined. Only `settings/page.tsx` had been proactively fixed when the feature was first built; six other files (the homepage, three dashboard report pages, three layouts) still had the unsafe pattern and one of them broke the live homepage for every visitor. Caught within minutes via production logs, root-caused to the exact line, and fixed across all 7 affected files. **Lesson for next time:** when a code change introduces a new "this can look valid but a nested field can still be missing" state, grep the *whole* codebase for the unsafe pattern immediately — don't just fix the one file already being edited.
- **Gemini transient 503 "high demand" overload**, hit twice in a row during manual testing. Not caught by the batch quota circuit breaker (which only matches 429/quota-style errors, not generic transient unavailability) — no code fix applied, just retried a few minutes later. Flagged as a possible future resilience improvement, not yet built.

---

## 8. What's NOT Done / Suggested Next Steps

1. **Add a real `GROQ_API_KEY`** (local and/or Vercel) to actually activate the Groq fallback — it's fully wired but currently a no-op without a key.
2. **Add `TOTP_SECRET_ENCRYPTION_KEY` to Vercel's production environment variables** — 2FA is fully built but shows "Not configured on this server" in production until this is added.
3. **Login has no rate-limiting on plain password guessing.** Only the 2FA code step got a lockout this session (5 attempts/15 min), since that was the immediate new attack surface. General brute-force protection on the password step itself is still an open gap.
4. **Consider a retry-once for transient Gemini 503s**, since it was hit twice during this session's own testing — not urgent, but a real gap in the current error handling (which only treats quota-style errors as retryable-by-fallback).
5. Everything carried over from the original session's §8 is still true and unchanged: Plaid Sandbox → real accounts not yet activated, quarterly (10-Q) fundamentals not pulled, peer/sector P/E benchmarking not solved, no free earnings calendar found.

---

## 9. Public-Facing Text (README, .env.example)

`README.md` was **updated, not rewritten** — new build-process stages (11, 12), new feature bullets (technical indicators, the golden/death-cross Breaking News trigger), a new tech-stack table row for the optional Groq engine, an extended data-sources closing sentence, a new architecture note about batch efficiency, and a new optional-key table row for Groq — all added in the exact same analytical/neutral voice as the rest of the document, zero new first-person language. `.env.example` got `GROQ_API_KEY`/`GROQ_MODEL` and `TOTP_SECRET_ENCRYPTION_KEY` added, matching the existing optional-key comment convention exactly (`OPTIONAL, free signup... Leave blank to skip`).

---

## 10. Key File Locations (new/changed this session)

- `src/lib/technicalIndicators.ts` — RSI/MACD/Bollinger/moving-average-cross/support-resistance, pure math, no external calls.
- `src/lib/groq.ts` — the optional Groq engine client.
- `src/lib/totp.ts` — TOTP secret/QR generation, code verification, backup-code generate/hash/verify.
- `src/lib/crypto.ts` — now takes an optional `envVar` param so a second secret type can use its own dedicated encryption key.
- `src/components/ui/LocalTime.tsx` — client-side timezone-correct date formatting, used everywhere a timestamp is shown.
- `src/components/dashboard/TwoFactorSection.tsx` — the settings-page 2FA UI (enable/disable/backup codes).
- `src/app/api/auth/2fa/{setup,confirm,disable,backup-codes}/route.ts` — the four 2FA management routes.
- `src/lib/reports/runBatch.ts` — now uses shared market context, fair-rotation ordering, and the quota circuit breaker.
- `src/lib/reports/buildContext.ts` — new `getSharedMarketContext()` export.

---

## 11. Verification Discipline Used Throughout (This Session)

Continued the same pattern from the original session — every new data source or computation was checked against real data before being trusted, not just built and assumed correct:

- Technical indicators verified against real live AAPL/NVDA/SPY closes before being wired into any prompt.
- 2FA verified with a full scripted end-to-end test that replicated NextAuth's actual HTTP sign-in flow (CSRF token, credentials callback, cookie handling) against the live dev server and the real database with throwaway accounts — enrollment, wrong-code rejection, correct-code success, single-use backup codes, and the 5-attempt lockout, all confirmed for real, not just typechecked. Test accounts were deleted afterward, never committed.
- New habit worth carrying forward: after any deploy believed to be "done," actually re-fetch the live URL / check production logs to confirm before calling it finished — this is exactly what caught the remember-me production crash (§7) within minutes instead of it lingering undiscovered.
