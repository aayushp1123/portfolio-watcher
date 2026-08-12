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
