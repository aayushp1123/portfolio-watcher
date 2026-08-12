import { prisma } from "@/lib/prisma";
import { getParsedHoldings } from "@/lib/holdings";
import { getQuotes, getMomentums, getQuote, getMomentum, type Quote, type Momentum } from "@/lib/quotes";
import { getPersonalizedNews, type NewsArticle } from "@/lib/newsFeed";
import {
  getMaterialFilings,
  getInsiderActivity,
  getEarningsHistories,
  type SecFiling,
  type EarningsHistory,
} from "@/lib/secEdgar";
import { getMacroSnapshot, type MacroSnapshot } from "@/lib/fred";
import { getCongressTrades, type CongressTrade } from "@/lib/congressTrading";
import { getCorrelationFlags, type CorrelationFlag } from "@/lib/portfolioAnalytics";

export interface PortfolioHolding {
  ticker: string;
  name: string;
  shares: number;
  marketValue: number;
  costBasis: number | null;
  /** Real current price from a free live quote lookup — null if the lookup failed. */
  livePrice: Quote | null;
  /** Real, computed technical signals from actual daily closes — null if unavailable. */
  momentum: Momentum | null;
}

export interface UserReportContext {
  userId: string;
  goal: {
    targetCoreEtfPct: number;
    targetGrowthPct: number;
    targetSpeculativePct: number;
    notes: string | null;
  } | null;
  exitRules: Array<{
    ticker: string;
    ruleType: string;
    value: number;
    note: string | null;
  }>;
  holdings: PortfolioHolding[];
  cashAvailable: number;
  /** Whether the user has an active Plaid connection at all — distinguishes
   * "connected account with $0 cash" from "no account connected, N/A". */
  hasBrokerageConnection: boolean;
  watchlist: Array<{ ticker: string; note: string | null; livePrice: Quote | null; momentum: Momentum | null }>;
  /** Real, recently-published headlines for the user's own tickers, free via
   * RSS — supplemental grounding since there's no live search tool. */
  recentHeadlines: NewsArticle[];
  /** Real SEC filings (8-K/10-Q/10-K) for the user's tickers — official, free. */
  materialFilings: SecFiling[];
  /** Real insider transactions (Form 4/144) for the user's tickers. */
  insiderActivity: SecFiling[];
  /** Real macro figures (Fed funds rate, CPI, unemployment) — null if FRED_API_KEY isn't set. */
  macro: MacroSnapshot | null;
  /** Real congressional stock trade disclosures for the user's tickers — free, public STOCK Act data. */
  congressTrades: CongressTrade[];
  /** S&P 500 (SPY) momentum — a real baseline to judge whether a holding is out/underperforming the broad market. */
  marketMomentum: Momentum | null;
  /** CBOE Volatility Index (^VIX) live level — a real read on current market-wide risk appetite. */
  vix: Quote | null;
  /** Real pairwise correlation across the user's holdings — flags hidden concentration risk. */
  correlationFlags: CorrelationFlag[];
  /** Real multi-year revenue/net income history straight from each company's own SEC filings — keyed by ticker. */
  earningsHistories: Map<string, EarningsHistory>;
}

/** Builds the per-user context passed into an AI report generation call. Reads
 * cached Plaid holdings data (from the last successful sync) rather than
 * calling Plaid live on every report — keeps report generation to a single
 * external dependency (Gemini) per run. */
export async function buildUserContext(userId: string): Promise<UserReportContext> {
  const [goal, exitRules, { rawHoldings, cashAvailable, hasBrokerageConnection }, watchlistItems] = await Promise.all([
    prisma.goal.findUnique({ where: { userId } }),
    prisma.exitRule.findMany({ where: { userId, active: true } }),
    getParsedHoldings(userId),
    prisma.watchlistItem.findMany({ where: { userId } }),
  ]);

  const allTickers = [...rawHoldings.map((h) => h.ticker), ...watchlistItems.map((w) => w.ticker)];

  // All free, unauthenticated (except macro, which no-ops without a key) —
  // fetched in parallel to keep report generation latency reasonable.
  const holdingTickers = rawHoldings.map((h) => h.ticker);
  const [
    quotes,
    momentums,
    recentHeadlines,
    materialFilings,
    insiderActivity,
    macro,
    congressTrades,
    marketMomentum,
    vix,
    correlationFlags,
    earningsHistories,
  ] = await Promise.all([
    getQuotes(allTickers),
    getMomentums(allTickers),
    allTickers.length > 0 ? getPersonalizedNews(allTickers, 12) : Promise.resolve([]),
    allTickers.length > 0 ? getMaterialFilings(allTickers) : Promise.resolve([]),
    allTickers.length > 0 ? getInsiderActivity(allTickers) : Promise.resolve([]),
    getMacroSnapshot(),
    allTickers.length > 0 ? getCongressTrades(allTickers) : Promise.resolve([]),
    getMomentum("SPY"),
    getQuote("^VIX"),
    holdingTickers.length >= 2 ? getCorrelationFlags(holdingTickers) : Promise.resolve([]),
    allTickers.length > 0 ? getEarningsHistories(allTickers) : Promise.resolve(new Map<string, EarningsHistory>()),
  ]);

  const holdings: PortfolioHolding[] = rawHoldings.map((h) => ({
    ...h,
    livePrice: quotes.get(h.ticker) ?? null,
    momentum: momentums.get(h.ticker) ?? null,
  }));

  return {
    userId,
    goal: goal
      ? {
          targetCoreEtfPct: goal.targetCoreEtfPct,
          targetGrowthPct: goal.targetGrowthPct,
          targetSpeculativePct: goal.targetSpeculativePct,
          notes: goal.notes,
        }
      : null,
    exitRules: exitRules.map((r) => ({
      ticker: r.ticker,
      ruleType: r.ruleType,
      value: r.value,
      note: r.note,
    })),
    holdings,
    cashAvailable,
    hasBrokerageConnection,
    watchlist: watchlistItems.map((w) => ({
      ticker: w.ticker,
      note: w.note,
      livePrice: quotes.get(w.ticker) ?? null,
      momentum: momentums.get(w.ticker) ?? null,
    })),
    recentHeadlines,
    materialFilings,
    insiderActivity,
    macro,
    congressTrades,
    marketMomentum,
    vix,
    correlationFlags,
    earningsHistories,
  };
}
