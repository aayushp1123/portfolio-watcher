// ============================================================================
// IMPORTS
// ============================================================================
import { prisma } from "@/lib/prisma"; // this brings in the shared database client used for every query in this file
import { getParsedHoldings } from "@/lib/holdings"; // this brings in the function that turns cached Plaid JSON into a clean list of holdings
import {
  getQuotes, // this is the function that fetches live prices for a list of tickers at once
  getMomentums, // this is the function that fetches 1mo/3mo momentum for a list of tickers at once
  getQuote, // this is the function that fetches a live price for a single ticker
  getMomentum, // this is the function that fetches momentum for a single ticker
  getManyHistoricalCloses, // this is the function that fetches daily closing prices for a list of tickers at once
  getHistoricalCloses, // this is the function that fetches daily closing prices for a single ticker
  type Quote, // this is the type describing one live price lookup result
  type Momentum, // this is the type describing one momentum computation result
} from "@/lib/quotes";
import { computeRiskMetrics, type RiskMetrics } from "@/lib/riskMetrics"; // this brings in the pure-math volatility/beta/drawdown calculator and its result type
import { computeTechnicalIndicators, type TechnicalIndicators } from "@/lib/technicalIndicators"; // this brings in the pure-math RSI/MACD/Bollinger calculator and its result type
import { getShortVolumes, type ShortVolumeData } from "@/lib/finra"; // this brings in the FINRA short-sale-volume fetcher and its result type
import { getPersonalizedNews, type NewsArticle } from "@/lib/newsFeed"; // this brings in the RSS/Google News fetcher and its result type
import {
  getMaterialFilings, // this is the function that fetches recent 8-K/10-Q/10-K filings for a list of tickers
  getInsiderActivity, // this is the function that fetches recent Form 4/144 insider filings for a list of tickers
  getEarningsHistories, // this is the function that fetches multi-year revenue/income history for a list of tickers
  type SecFiling, // this is the type describing one SEC filing entry
  type EarningsHistory, // this is the type describing one ticker's multi-year earnings history
} from "@/lib/secEdgar";
import { getMacroSnapshot, type MacroSnapshot } from "@/lib/fred"; // this brings in the FRED macro-data fetcher and its result type
import { getCongressTrades, type CongressTrade } from "@/lib/congressTrading"; // this brings in the House/Senate stock-trade fetcher and its result type
import { getCorrelationFlags, type CorrelationFlag } from "@/lib/portfolioAnalytics"; // this brings in the pairwise-holding-correlation calculator and its result type

// ============================================================================
// TYPE: PortfolioHolding — everything real and computed known about one position
// ============================================================================
export interface PortfolioHolding {
  ticker: string; // this is the stock symbol for this holding
  name: string; // this is the human-readable company/security name for this holding
  shares: number; // this is how many shares of this holding the user owns
  marketValue: number; // this is the current total dollar value of this holding, straight from Plaid
  costBasis: number | null; // this is what the user originally paid for this holding, or null if Plaid didn't provide it
  /** Real current price from a free live quote lookup — null if the lookup failed. */
  livePrice: Quote | null; // this holds the live price lookup result for this ticker, or null if the lookup failed
  /** Real, computed technical signals from actual daily closes — null if unavailable. */
  momentum: Momentum | null; // this holds the 1mo/3mo momentum numbers for this ticker, or null if unavailable
  /** Real, computed realized volatility and beta vs. S&P 500 — null if unavailable. */
  riskMetrics: RiskMetrics | null; // this holds the volatility/beta/drawdown numbers for this ticker, or null if unavailable
  /** Real, computed RSI/MACD/Bollinger Bands/moving-average-cross/support-resistance
   * from actual daily closes — null if unavailable. */
  technicalIndicators: TechnicalIndicators | null; // this holds the RSI/MACD/Bollinger numbers for this ticker, or null if unavailable
  /** Real daily short-sale-volume % from FINRA, for the most recent trading day — null if unavailable. */
  shortVolume: ShortVolumeData | null; // this holds today's short-sale-volume percentage for this ticker, or null if unavailable
}

// ============================================================================
// TYPE: UserReportContext — the full bundle of real data handed to an AI report generator
// ============================================================================
export interface UserReportContext {
  userId: string; // this identifies which user this context belongs to
  goal: {
    targetCoreEtfPct: number; // this is the user's target % allocation to core ETFs
    targetGrowthPct: number; // this is the user's target % allocation to growth stocks
    targetSpeculativePct: number; // this is the user's target % allocation to speculative bets
    notes: string | null; // this is any free-text notes the user attached to their goal
  } | null; // this whole block is null if the user hasn't set an allocation goal
  exitRules: Array<{
    ticker: string; // this is which ticker this exit rule applies to
    ruleType: string; // this is the kind of rule (price target / trailing stop / stop loss)
    value: number; // this is the numeric threshold that triggers the rule
    note: string | null; // this is any free-text note attached to this rule
  }>; // this is the list of the user's active sell/exit rules
  holdings: PortfolioHolding[]; // this is the user's full list of real brokerage positions, each with its computed data attached
  cashAvailable: number; // this is the user's total uninvested cash across all linked accounts
  /** Whether the user has an active Plaid connection at all — distinguishes
   * "connected account with $0 cash" from "no account connected, N/A". */
  hasBrokerageConnection: boolean; // this says whether the user has any working brokerage connection at all
  watchlist: Array<{
    ticker: string; // this is the watchlisted ticker symbol
    note: string | null; // this is any free-text note the user attached to this watchlist entry
    livePrice: Quote | null; // this holds this watchlist ticker's live price lookup, or null if it failed
    momentum: Momentum | null; // this holds this watchlist ticker's momentum numbers, or null if unavailable
    riskMetrics: RiskMetrics | null; // this holds this watchlist ticker's volatility/beta numbers, or null if unavailable
    technicalIndicators: TechnicalIndicators | null; // this holds this watchlist ticker's RSI/MACD/Bollinger numbers, or null if unavailable
    shortVolume: ShortVolumeData | null; // this holds this watchlist ticker's short-volume percentage, or null if unavailable
  }>; // this is the user's full watchlist, each entry with its own computed research data attached
  /** Real, recently-published headlines for the user's own tickers, free via
   * RSS — supplemental grounding since there's no live search tool. */
  recentHeadlines: NewsArticle[]; // this is the list of real recent news headlines for the user's tickers
  /** Real SEC filings (8-K/10-Q/10-K) for the user's tickers — official, free. */
  materialFilings: SecFiling[]; // this is the list of real recent material SEC filings for the user's tickers
  /** Real insider transactions (Form 4/144) for the user's tickers. */
  insiderActivity: SecFiling[]; // this is the list of real recent insider-transaction filings for the user's tickers
  /** Real macro figures (Fed funds rate, CPI, unemployment) — null if FRED_API_KEY isn't set. */
  macro: MacroSnapshot | null; // this holds the real macro-economic snapshot, or null if the optional FRED key isn't configured
  /** Real congressional stock trade disclosures for the user's tickers — free, public STOCK Act data. */
  congressTrades: CongressTrade[]; // this is the list of real congressional stock trades touching the user's tickers
  /** S&P 500 (SPY) momentum — a real baseline to judge whether a holding is out/underperforming the broad market. */
  marketMomentum: Momentum | null; // this holds SPY's own momentum numbers, used as the broad-market baseline
  /** CBOE Volatility Index (^VIX) live level — a real read on current market-wide risk appetite. */
  vix: Quote | null; // this holds the live VIX level, used as a market-wide risk-appetite read
  /** Real pairwise correlation across the user's holdings — flags hidden concentration risk. */
  correlationFlags: CorrelationFlag[]; // this is the list of real pairwise correlation warnings across the user's holdings
  /** Real multi-year revenue/net income history straight from each company's own SEC filings — keyed by ticker. */
  earningsHistories: Map<string, EarningsHistory>; // this maps each ticker to its real multi-year revenue/income history
}

// ============================================================================
// TYPE: SharedMarketContext — the subset of the above that's identical for every user in a batch run
// ============================================================================
export interface SharedMarketContext {
  marketMomentum: Momentum | null; // this holds the one SPY momentum result shared across every user in this batch
  vix: Quote | null; // this holds the one VIX level shared across every user in this batch
  macro: MacroSnapshot | null; // this holds the one macro snapshot shared across every user in this batch
  /** SPY daily closes (6mo) -- used as the market benchmark in every holding's
   * beta calculation, identical for every user. */
  spyCloses: number[] | null; // this holds the one SPY closing-price series shared across every user's beta calculation in this batch
}

// ============================================================================
// FUNCTION: getSharedMarketContext — fetches the batch-wide market data once, before any per-user work starts
// ============================================================================
/** SPY momentum, VIX, macro (FRED), and SPY's own closing-price history are
 * identical for every user in a given batch run -- fetching them once per
 * batch instead of once per user cuts real duplicated work as the user count
 * grows. Callers running a batch (runBatch.ts) should fetch this once and
 * pass it to every buildUserContext call; callers building context for a
 * single user (e.g. the manual /api/reports/generate route) can omit it and
 * it's fetched fresh. */
export async function getSharedMarketContext(): Promise<SharedMarketContext> { // this defines the function that fetches the batch-wide market numbers exactly once
  const [marketMomentum, vix, macro, spyCloses] = await Promise.all([ // this fetches all four batch-wide values at the same time
    getMomentum("SPY"), // this fetches SPY's own momentum numbers
    getQuote("^VIX"), // this fetches the live VIX level
    getMacroSnapshot(), // this fetches the current Fed-funds/CPI/unemployment snapshot
    getHistoricalCloses("SPY", "6mo"), // this fetches SPY's 6-month daily closing-price history
  ]);
  return { marketMomentum, vix, macro, spyCloses }; // this bundles the four results into the SharedMarketContext object callers pass around
}

// ============================================================================
// FUNCTION: buildUserContext — assembles one user's full real-data bundle for a single AI report call
// ============================================================================
/** Builds the per-user context passed into an AI report generation call. Reads
 * cached Plaid holdings data (from the last successful sync) rather than
 * calling Plaid live on every report — keeps report generation to a single
 * external dependency (Gemini) per run. `shared` should be passed by batch
 * callers to avoid refetching SPY momentum/VIX/macro per user. */
export async function buildUserContext(userId: string, shared?: SharedMarketContext): Promise<UserReportContext> { // this defines the function that builds one user's complete report context
  const [goal, exitRules, { rawHoldings, cashAvailable, hasBrokerageConnection }, watchlistItems] = await Promise.all([ // this loads this user's goal, exit rules, holdings, and watchlist all at the same time
    prisma.goal.findUnique({ where: { userId } }), // this loads the user's allocation goal, or null if they haven't set one
    prisma.exitRule.findMany({ where: { userId, active: true } }), // this loads the user's currently-active exit rules
    getParsedHoldings(userId), // this loads and parses this user's cached Plaid holdings, cash, and connection status
    prisma.watchlistItem.findMany({ where: { userId } }), // this loads every ticker the user has added to their watchlist
  ]);

  const allTickers = [...new Set([...rawHoldings.map((h) => h.ticker), ...watchlistItems.map((w) => w.ticker)])];
  // this builds ONE deduped list of every ticker across holdings + watchlist, so a ticker that's both held and
  // watchlisted isn't fetched twice from SEC EDGAR and doesn't show up twice in the filings/insider-activity lists below

  // All free, unauthenticated (except macro, which no-ops without a key) —
  // fetched in parallel to keep report generation latency reasonable.
  const holdingTickers = rawHoldings.map((h) => h.ticker); // this is a holdings-only ticker list, used below for the correlation check which needs actual positions, not watchlist names
  const [
    quotes, // this will hold live prices for every ticker, keyed by ticker
    momentums, // this will hold momentum numbers for every ticker, keyed by ticker
    recentHeadlines, // this will hold the real news headlines for this user's tickers
    materialFilings, // this will hold the real material SEC filings for this user's tickers
    insiderActivity, // this will hold the real insider-transaction filings for this user's tickers
    macro, // this will hold the macro snapshot, either reused from `shared` or fetched fresh
    congressTrades, // this will hold the real congressional trades touching this user's tickers
    marketMomentum, // this will hold SPY's momentum, either reused from `shared` or fetched fresh
    vix, // this will hold the live VIX level, either reused from `shared` or fetched fresh
    correlationFlags, // this will hold the real pairwise correlation warnings across this user's holdings
    earningsHistories, // this will hold each ticker's real multi-year earnings history
    historicalClosesByTicker, // this will hold each ticker's 6-month daily closes, used for the risk-metrics/beta math
    spyCloses, // this will hold SPY's 6-month closes, either reused from `shared` or fetched fresh
    shortVolumes, // this will hold each ticker's real FINRA short-sale-volume percentage
    // Separate, longer (1y) closes fetch dedicated to technical indicators
    // (needed for the 200-day moving average) -- kept apart from the 6mo
    // series above so the already-verified risk-metrics math is untouched.
    technicalClosesByTicker, // this will hold each ticker's 1-year daily closes, used only for the technical-indicators math
  ] = await Promise.all([
    getQuotes(allTickers), // this fetches live prices for every ticker in one batched call
    getMomentums(allTickers), // this fetches momentum numbers for every ticker in one batched call
    allTickers.length > 0 ? getPersonalizedNews(allTickers, 12) : Promise.resolve([]), // this fetches up to 12 real headlines for this user's tickers, or skips the call entirely if there are no tickers
    allTickers.length > 0 ? getMaterialFilings(allTickers) : Promise.resolve([]), // this fetches real recent material filings for this user's tickers, or skips the call if there are no tickers
    allTickers.length > 0 ? getInsiderActivity(allTickers) : Promise.resolve([]), // this fetches real recent insider filings for this user's tickers, or skips the call if there are no tickers
    shared ? Promise.resolve(shared.macro) : getMacroSnapshot(), // this reuses the batch-wide macro snapshot if one was passed in, otherwise fetches its own
    allTickers.length > 0 ? getCongressTrades(allTickers) : Promise.resolve([]), // this fetches real congressional trades touching this user's tickers, or skips the call if there are no tickers
    shared ? Promise.resolve(shared.marketMomentum) : getMomentum("SPY"), // this reuses the batch-wide SPY momentum if one was passed in, otherwise fetches its own
    shared ? Promise.resolve(shared.vix) : getQuote("^VIX"), // this reuses the batch-wide VIX level if one was passed in, otherwise fetches its own
    holdingTickers.length >= 2 ? getCorrelationFlags(holdingTickers) : Promise.resolve([]), // this computes real correlation flags only if the user holds at least 2 positions, otherwise skips it
    allTickers.length > 0 ? getEarningsHistories(allTickers) : Promise.resolve(new Map<string, EarningsHistory>()), // this fetches each ticker's real multi-year earnings history, or skips the call if there are no tickers
    allTickers.length > 0 ? getManyHistoricalCloses(allTickers) : Promise.resolve(new Map<string, number[]>()), // this fetches each ticker's 6-month closes for the risk-metrics math, or skips the call if there are no tickers
    shared ? Promise.resolve(shared.spyCloses) : getHistoricalCloses("SPY", "6mo"), // this reuses the batch-wide SPY closes if one was passed in, otherwise fetches its own
    allTickers.length > 0 ? getShortVolumes(allTickers) : Promise.resolve(new Map<string, ShortVolumeData>()), // this fetches each ticker's real FINRA short-volume data, or skips the call if there are no tickers
    allTickers.length > 0 ? getManyHistoricalCloses(allTickers, "1y") : Promise.resolve(new Map<string, number[]>()), // this fetches each ticker's 1-year closes for the technical-indicators math, or skips the call if there are no tickers
  ]);

  const holdings: PortfolioHolding[] = rawHoldings.map((h) => ({ // this builds the final holdings list by attaching every computed/fetched value onto each raw Plaid holding
    ...h, // this keeps the raw ticker/name/shares/marketValue/costBasis fields from Plaid as-is
    livePrice: quotes.get(h.ticker) ?? null, // this attaches this holding's live price, or null if the lookup failed
    momentum: momentums.get(h.ticker) ?? null, // this attaches this holding's momentum numbers, or null if unavailable
    riskMetrics: computeRiskMetrics(historicalClosesByTicker.get(h.ticker) ?? null, spyCloses), // this computes this holding's volatility/beta against SPY's closes
    technicalIndicators: computeTechnicalIndicators(technicalClosesByTicker.get(h.ticker) ?? null), // this computes this holding's RSI/MACD/Bollinger numbers from its 1-year closes
    shortVolume: shortVolumes.get(h.ticker) ?? null, // this attaches this holding's real short-sale-volume percentage, or null if unavailable
  }));

  return { // this assembles the final UserReportContext object handed to the AI report generator
    userId, // this is the user this context was built for
    goal: goal
      ? {
          targetCoreEtfPct: goal.targetCoreEtfPct, // this copies over the user's core-ETF target %
          targetGrowthPct: goal.targetGrowthPct, // this copies over the user's growth target %
          targetSpeculativePct: goal.targetSpeculativePct, // this copies over the user's speculative target %
          notes: goal.notes, // this copies over the user's free-text goal notes
        }
      : null, // this is null if the user never set an allocation goal
    exitRules: exitRules.map((r) => ({ // this reshapes each database exit rule into the plain object the report context expects
      ticker: r.ticker, // this is the ticker this rule applies to
      ruleType: r.ruleType, // this is the kind of rule
      value: r.value, // this is the rule's numeric threshold
      note: r.note, // this is the rule's free-text note
    })),
    holdings, // this is the fully-enriched holdings list built above
    cashAvailable, // this is the user's total uninvested cash
    hasBrokerageConnection, // this says whether the user has any working brokerage connection at all
    watchlist: watchlistItems.map((w) => ({ // this reshapes each watchlist item into a fully-enriched entry, same as holdings above
      ticker: w.ticker, // this is the watchlisted ticker
      note: w.note, // this is the user's free-text note on this watchlist entry
      livePrice: quotes.get(w.ticker) ?? null, // this attaches this ticker's live price, or null if the lookup failed
      momentum: momentums.get(w.ticker) ?? null, // this attaches this ticker's momentum numbers, or null if unavailable
      riskMetrics: computeRiskMetrics(historicalClosesByTicker.get(w.ticker) ?? null, spyCloses), // this computes this ticker's volatility/beta against SPY's closes
      technicalIndicators: computeTechnicalIndicators(technicalClosesByTicker.get(w.ticker) ?? null), // this computes this ticker's RSI/MACD/Bollinger numbers from its 1-year closes
      shortVolume: shortVolumes.get(w.ticker) ?? null, // this attaches this ticker's real short-sale-volume percentage, or null if unavailable
    })),
    recentHeadlines, // this is the real news headlines fetched above
    materialFilings, // this is the real material SEC filings fetched above
    insiderActivity, // this is the real insider filings fetched above
    macro, // this is the macro snapshot, shared or freshly fetched
    congressTrades, // this is the real congressional trades fetched above
    marketMomentum, // this is SPY's momentum, shared or freshly fetched
    vix, // this is the live VIX level, shared or freshly fetched
    correlationFlags, // this is the real correlation warnings computed above
    earningsHistories, // this is the real multi-year earnings histories fetched above
  };
}
