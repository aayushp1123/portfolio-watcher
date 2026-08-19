// ============================================================================
// IMPORTS
// ============================================================================
import { z } from "zod"; // this brings in Zod, used to both validate Gemini's JSON output and to generate the JSON Schema sent to Gemini in the first place

// ============================================================================
// SHARED ENUMS — reused across multiple report schemas below
// ============================================================================
export const riskToneSchema = z.enum(["Low", "Medium", "High"]); // this is the fixed set of allowed risk ratings for any holding, watchlist item, or idea

export const ratingSchema = z.enum(["Buy", "Hold", "Sell"]); // this is the fixed set of allowed Buy/Hold/Sell calls for any holding, watchlist item, or idea

// ============================================================================
// SCHEMA: holdingSchema — one owned position inside a Daily Digest report
// ============================================================================
export const holdingSchema = z.object({
  ticker: z.string(), // this is the stock symbol for this holding
  shares: z.number(), // this is how many shares the user owns, copied through from real Plaid data
  marketValue: z.number(), // this is the dollar value of this holding
  /** As of this Daily Digest fix: deterministically overwritten from real cost-basis/live-price
   * math after generation (see dailyDigest.ts) — no longer trusted from the model's own arithmetic. */
  costBasis: z.number().nullable(), // this is what the user originally paid for this holding, or null if unknown
  /** As of this Daily Digest fix: deterministically overwritten from real cost-basis/live-price
   * math after generation (see dailyDigest.ts) — no longer trusted from the model's own arithmetic. */
  gainLossPct: z.number().nullable(), // this is the real unrealized gain/loss percentage for this holding, or null if cost basis is unknown
  exitRuleStatus: z
    .object({
      status: z.enum(["ok", "approaching", "triggered", "none"]), // this is which of the four exit-rule states this holding is currently in
      message: z.string(), // this is the plain-English explanation of why this status applies right now
    })
    .nullable(), // this whole object is null when the holding has no active exit rule at all (the UI also defensively treats a non-null object with status "none" the same way, in case the model returns that instead)
  riskRating: riskToneSchema, // this is the Low/Medium/High risk call for this holding
  riskReason: z.string(), // this is the plain-English reasoning behind the risk call
  rating: ratingSchema, // this is the Buy/Hold/Sell call for this holding
  ratingReason: z.string(), // this is the plain-English reasoning behind the rating
  taxNote: z.string().nullable(), // this is a wash-sale/tax-loss-harvesting note when the holding is at an unrealized loss, or null otherwise
});

// ============================================================================
// SCHEMA: watchlistItemReportSchema — one watchlist ticker's research, shared shape for Daily Digest and Weekly Trends
// ============================================================================
export const watchlistItemReportSchema = z.object({
  ticker: z.string(), // this is the watchlisted stock symbol
  approxPrice: z.number().nullable(), // this is the live price if one was fetched, otherwise the model's best-guess approximate price
  summary: z.string(), // this is a short plain-English explanation of what the company/fund does
  riskRating: riskToneSchema, // this is the Low/Medium/High risk call for this ticker
  riskReason: z.string(), // this is the plain-English reasoning behind the risk call
  rating: ratingSchema, // this is the Buy/Hold/Sell call for this ticker
  ratingReason: z.string(), // this is the plain-English reasoning behind the rating
  sourceUrls: z.array(z.string()), // this is the list of source URLs backing this research, if any were used
});

// ============================================================================
// SCHEMA: dailyDigestSchema — the full Daily Digest report shape
// ============================================================================
export const dailyDigestSchema = z.object({
  asOf: z.string(), // this is the date this digest was generated for
  portfolioSummary: z.string(), // this is the top-level plain-English portfolio recap
  /** Deterministically overwritten from context after generation — not trusted from the model. */
  hasBrokerageConnection: z.boolean(), // this says whether the user actually has a working brokerage connection
  /** As of this Daily Digest fix: deterministically overwritten from real live-price math
   * after generation (see dailyDigest.ts) — no longer trusted from the model's own arithmetic. */
  totalValue: z.number(), // this is the real total live market value of every holding
  /** As of this Daily Digest fix: deterministically overwritten from real cost-basis/live-price
   * math after generation (see dailyDigest.ts) — no longer trusted from the model's own arithmetic. */
  overallGainLossPct: z.number().nullable(), // this is the real portfolio-wide unrealized gain/loss percentage, or null if no holding has a known cost basis
  cashAvailable: z.number().nullable(), // this is the user's uninvested cash, or null when there's no brokerage connection
  holdings: z.array(holdingSchema), // this is the full list of the user's real owned positions
  watchlistItems: z.array(watchlistItemReportSchema), // this is the full list of the user's researched watchlist tickers
  dividendNotes: z.array(z.string()), // this is any dividend-related notes worth surfacing
  bottomLine: z.string(), // this is the short overall takeaway for the whole digest
  whatToWatchNext: z.string(), // this is the forward-looking "what's worth paying attention to next" section
  sourceUrls: z.array(z.string()), // this is the list of source URLs backing the digest as a whole
});
export type DailyDigest = z.infer<typeof dailyDigestSchema>; // this is the TypeScript type derived straight from the schema above, used everywhere a parsed Daily Digest is passed around

// ============================================================================
// SCHEMA: newIdeaSchema — one new stock/ETF idea suggested inside a Weekly Trends report
// ============================================================================
export const newIdeaSchema = z.object({
  ticker: z.string(), // this is the suggested stock/ETF symbol
  approxPrice: z.number().nullable(), // this is the model's best-guess approximate price, since new-idea tickers have no live price fetched
  whatItDoes: z.string(), // this is a short plain-English explanation of what the company/fund does
  whyNow: z.string(), // this is the reasoning for why this idea is worth researching right now
  riskRating: riskToneSchema, // this is the Low/Medium/High risk call for this idea
  riskReason: z.string(), // this is the plain-English reasoning behind the risk call
  rating: ratingSchema, // this is the Buy/Hold/Sell call for this idea
  ratingReason: z.string(), // this is the plain-English reasoning behind the rating
  bucket: z.enum(["CORE_ETF", "INDIVIDUAL_GROWTH", "SPECULATIVE"]), // this is which of the user's three allocation buckets this idea would fit into
  horizon: z.enum(["long-term", "short-term"]), // this is the model's suggested holding horizon for this idea
  sourceUrls: z.array(z.string()), // this is the list of source URLs backing this idea, if any were used
});

// ============================================================================
// SCHEMA: weeklyTrendsSchema — the full Weekly Trends report shape
// ============================================================================
export const weeklyTrendsSchema = z.object({
  asOf: z.string(), // this is the date this report was generated for
  /** Deterministically overwritten from context after generation — not trusted from the model. */
  hasBrokerageConnection: z.boolean(), // this says whether the user actually has a working brokerage connection
  allocationCheck: z.object({
    targetCoreEtfPct: z.number(), // this is the user's own target % for core ETFs, copied through from their saved goal
    targetGrowthPct: z.number(), // this is the user's own target % for individual growth stocks
    targetSpeculativePct: z.number(), // this is the user's own target % for speculative bets
    /** The one genuinely subjective judgment call left to the model: which bucket each current
     * holding belongs in. One entry per current holding — see weeklyTrends.ts, which uses this
     * classification (never the model's own dollar/percentage math) to deterministically compute
     * the actual* percentages below from real live market values. */
    holdingBuckets: z.array(
      z.object({
        ticker: z.string(), // this is the ticker being classified
        bucket: z.enum(["CORE_ETF", "INDIVIDUAL_GROWTH", "SPECULATIVE"]), // this is which bucket the model placed it in
      })
    ),
    /** Deterministically overwritten from real live market values + the model's own holdingBuckets
     * classification above (see weeklyTrends.ts) — no longer trusted from the model's own arithmetic. */
    actualCoreEtfPct: z.number(), // this is the real % of the portfolio's live value currently in core ETFs
    /** Same fix as actualCoreEtfPct above — deterministically computed, not model-trusted. */
    actualGrowthPct: z.number(), // this is the real % of the portfolio's live value currently in individual growth stocks
    /** Same fix as actualCoreEtfPct above — deterministically computed, not model-trusted. */
    actualSpeculativePct: z.number(), // this is the real % of the portfolio's live value currently in speculative bets
    summary: z.string(), // this is the plain-English explanation of the allocation check, including any concentration/overlap flags
  }),
  marketTrends: z.array(
    z.object({ title: z.string(), summary: z.string(), sourceUrls: z.array(z.string()) })
    // this array holds however many market-trend items the model chose to write: a headline title, a plain-English summary, and its source URLs
  ),
  newIdeas: z.array(newIdeaSchema), // this is the list of new stock/ETF ideas suggested this week
  watchlistItems: z.array(watchlistItemReportSchema), // this is the full list of the user's researched watchlist tickers
  connectionsToExistingHoldings: z.array(z.string()), // this is a list of plain-English notes connecting this week's trends back to the user's actual holdings
});
export type WeeklyTrends = z.infer<typeof weeklyTrendsSchema>; // this is the TypeScript type derived straight from the schema above, used everywhere a parsed Weekly Trends report is passed around

// ============================================================================
// SCHEMA: breakingAlertSchema — one alert inside a Breaking News report
// ============================================================================
export const breakingAlertSchema = z.object({
  /** Deterministically overwritten from the real matched event when sourceEventKey below
   * resolves to a known event (see breakingNews.ts) — no longer trusted from the model's
   * own copy-through. Left as the model wrote it only if sourceEventKey doesn't match anything. */
  ticker: z.string().nullable(), // this is which ticker the alert is about, or null for a market-wide event tied to no single ticker
  headline: z.string(), // this is the short headline for the alert
  whatHappened: z.string(), // this is the plain-English factual description of the real event
  whyItMatters: z.string(), // this is the plain-English explanation of why this event is relevant to the user
  riskRating: riskToneSchema, // this is the Low/Medium/High risk read on this event
  /** Same fix as ticker above — deterministically overwritten from the real matched event. */
  sourceUrls: z.array(z.string()), // this is the list of real source URLs backing this alert
  /** Same fix as ticker above — deterministically overwritten from the real matched event. */
  publishedAt: z.string().nullable(), // this is when the underlying source was published, or null if unknown
  /** Which exact detected event (by the bracketed key shown in the prompt, e.g. "MOVE:AAPL"
   * or "HEADLINE:https://...") this alert was built from — lets the caller deterministically
   * re-attach the real ticker/source URL/publish date instead of trusting the model's own
   * copy-through. Null only if the model didn't tie the alert to a single given event. */
  sourceEventKey: z.string().nullable(), // this is the event key the model copied from the prompt to identify which real event this alert is about
});

// ============================================================================
// SCHEMA: breakingNewsSchema — the full Breaking News report shape
// ============================================================================
export const breakingNewsSchema = z.object({
  asOf: z.string(), // this is the date this report was generated for
  /** Deterministically overwritten from context after generation — not trusted from the model
   * (see breakingNews.ts, follows the real detected trigger signals instead). */
  hasMaterialEvents: z.boolean(), // this says whether any real material event was actually detected this run
  alerts: z.array(breakingAlertSchema), // this is the list of alerts generated this run, empty on a normal no-news run
});
export type BreakingNews = z.infer<typeof breakingNewsSchema>; // this is the TypeScript type derived straight from the schema above, used everywhere a parsed Breaking News report is passed around

// ============================================================================
// FUNCTION: toJsonSchema — converts one of the Zod schemas above into the plain JSON Schema Gemini expects
// ============================================================================
/** Converts a Zod object schema to a plain JSON Schema for Gemini's responseJsonSchema. */
export function toJsonSchema(schema: z.ZodType): Record<string, unknown> { // this defines the function every report generator calls to build Gemini's responseJsonSchema config
  const json = z.toJSONSchema(schema, { target: "draft-7" }) as Record<string, unknown>; // this converts the given Zod schema into a plain draft-7 JSON Schema object
  delete json.$schema; // this strips the $schema metadata key, which Gemini's API doesn't want included
  return json; // this returns the cleaned-up JSON Schema ready to hand to Gemini
}
