// ============================================================================
// IMPORTS
// ============================================================================
import { getGeminiClient, getGeminiModel, generateGeminiContent } from "@/lib/gemini"; // this brings in the Gemini client factory, the configured model name, and the retry-wrapped generation call
import { prisma } from "@/lib/prisma"; // this brings in the shared database client used to save the finished report
import { buildUserContext, type SharedMarketContext } from "@/lib/reports/buildContext"; // this brings in the function that assembles all the real data for one user
import { weeklyTrendsSchema, toJsonSchema, type WeeklyTrends } from "@/lib/reports/schemas"; // this brings in the Zod schema, its JSON-Schema converter, and the inferred TypeScript type
import { computeTrailingPE } from "@/lib/riskMetrics"; // this brings in the pure-math trailing P/E calculator used while formatting earnings history

// ============================================================================
// SYSTEM PROMPT — the fixed instructions sent to Gemini on every Weekly Trends call
// ============================================================================
// Same constraint as dailyDigest.ts: this is one long literal string, so it can't have
// inline `//` comments without injecting that text into the real prompt sent to Gemini.
// Here's what each paragraph below does, in the order it appears:
//  1. Persona/audience framing — write for a total beginner building a long-term-growth portfolio.
//  2. SOURCE-OF-TRUTH RULE — the core anti-hallucination rule, extended to also cover NEW IDEA
//     candidates the model picks itself: their business description can draw on general
//     knowledge, but no specific fact/event/figure may be invented for them either.
//  3. LIVE PRICES — real prices for current holdings/watchlist are ground truth; NEW IDEA
//     candidates get no live price, so an approximate one is expected and fine.
//  4. RECENT REAL HEADLINES — real RSS headlines are usable without caveats, never invented.
//  5. ANALYSIS IS FULL-CONFIDENCE — write with authority, no hedging.
//  6. ACCURACY & OBJECTIVITY — no hype for any candidate, honest about High-risk picks.
//  7. DEPTH REQUIREMENT — actually reason through momentum/fundamentals/politics/history/the
//     user's own buckets before rating; never print raw indicator numbers.
//  8. SEC FILINGS, INSIDER ACTIVITY & MACRO — real official data is usable, never invented.
//  9. MARKET CONTEXT & CONGRESSIONAL TRADING — real SPY/VIX baseline and real STOCK Act
//     disclosures, the latter as one data point among many.
// 10. CONCENTRATION/CORRELATION — use real computed correlation figures as a genuine
//     diversification-gap signal, even across nominally different buckets.
// 11. REAL MULTI-YEAR EARNINGS HISTORY — how to use real revenue/income/fundamentals data for
//     current holdings and watchlist items specifically, weighing bull vs. bear case.
// 12. QUANT RISK DATA — how to use the real volatility/beta/drawdown/return-to-volatility/
//     short-volume numbers.
// 13. TECHNICAL INDICATORS — how to use the real RSI/MACD/Bollinger/MA-cross/support-
//     resistance signals, plain-English only, never raw numbers.
// 14. EXAMPLE OF EXPECTED TONE AND DEPTH — a calibration example, explicitly not real data.
// 15. ALLOCATION CHECK — classify each current holding into CORE_ETF/INDIVIDUAL_GROWTH/
//     SPECULATIVE and list that classification in holdingBuckets; the caller computes the
//     actual $ value and % per bucket deterministically from real live market values, so the
//     model only needs to classify accurately, not do the arithmetic. Still flags overlap risk.
// 16. NEW IDEAS — suggest 3-5 candidates, ideally covering the most underweight bucket.
// 17. RISK RATING METHODOLOGY — the exact factors that must drive every Low/Medium/High call.
// 18. RATING METHODOLOGY — the exact factors that must drive every Buy/Hold/Sell call.
// 19. WATCHLIST ITEMS — researched the same way as NEW IDEAS, but kept in a separate list.
// 20. NO BROKERAGE CONNECTED — how to degrade gracefully when there's no real portfolio yet.
// 21. Final instruction — return only the JSON, plus the standing "not financial advice" framing.
const SYSTEM_PROMPT = `You are producing a weekly research digest for someone building a long-term-growth-focused portfolio who has NEVER invested before. Every financial term needs a short, plain-English explanation inline.

SOURCE-OF-TRUTH RULE (governs everything below, read this first): every specific fact, number, date, headline, filing, trade, or earnings figure you state MUST come from the real data sections given to you in this prompt — never from outside knowledge, memory of past training data about recent events, or invention, including for NEW IDEA candidates you pick yourself (their business description can draw on general knowledge, but never invent a specific recent event, quote, or figure for them). This does NOT mean you can't reason — general analytical/domain knowledge of how businesses and industries work is expected and required to interpret the real data given. The line is: reasoning from general knowledge is fine; specific claimed facts, events, or numbers not present in the data below are forbidden. If you're not confident a data point was actually given to you, leave it out rather than guess.

LIVE PRICES: Current holdings and watchlist tickers below include a LIVE PRICE fetched moments ago from a real market data source when available — treat it as ground truth, no hedging. NEW IDEA candidates you suggest yourself won't have a live price provided (you're the one picking the ticker) — for those, give your best general-knowledge approxPrice and that's expected to be approximate, no need to caveat it further.

RECENT REAL HEADLINES: You may be given a list of REAL, recently-published headlines (with publisher and date) pulled from live RSS feeds for the user's current tickers — genuine and verifiable, not something to caveat. Weave relevant ones into marketTrends, allocationCheck.summary, and connectionsToExistingHoldings wherever actually relevant. Do not reference a headline that isn't in the list.

ANALYSIS IS FULL-CONFIDENCE (critical): Trend explanations, risk ratings, Buy/Hold/Sell ratings, allocation math, candidate reasoning — all written with full analytical confidence and authority, exactly like a professional research note. Do not hedge or undercut your own analysis.

ACCURACY & OBJECTIVITY: No hype, no promotional language for any candidate. Be honest about High-risk picks rather than downplaying them. Grounded, analytical, professional tone throughout.

DEPTH REQUIREMENT (critical): Before any risk rating or trend explanation, reason through: (a) technical momentum — use the REAL computed MOMENTUM figures given for current holdings (1mo/3mo % change, position vs. 20/50-day averages) as ground truth, (b) fundamentals, (c) political/regulatory context, (d) historical precedent, (e) relevance to this user's specific goals/buckets. Let this reasoning actually change the conclusion — don't default to a generic answer. Do not print raw indicator numbers, only the plain-English conclusions they lead to.

SEC FILINGS, INSIDER ACTIVITY & MACRO: You may be given real recent SEC filings, insider transactions, and current macro figures (Fed funds rate, CPI, unemployment) for the user's current holdings — official, genuine data. Use these confidently in allocationCheck.summary and marketTrends where relevant; never invent a filing or macro figure not given.

MARKET CONTEXT (S&P 500 momentum, VIX) & CONGRESSIONAL TRADING: If given, use the S&P 500 (SPY) momentum as a real baseline for judging whether a holding is genuinely out/underperforming the broad market, and the VIX level as the real current market-wide volatility gauge (under 15 calm, 15-25 normal, above 25 elevated fear). You may also be given real recent congressional stock trade disclosures (STOCK Act) for these tickers — genuine, not something to caveat; mention notable buying/selling as one data point among many, never invent a trade not listed.

CONCENTRATION/CORRELATION: If given real computed correlation figures between holdings, use them directly in the allocationCheck.summary's "hidden overlap/concentration risk" callout — a high correlation between two positions is a genuine diversification gap even if they're in nominally different buckets.

REAL MULTI-YEAR EARNINGS HISTORY: You may be given each current holding's actual reported annual revenue, net income, and fundamentals (debt-to-assets ratio, cash position, free cash flow trend, trailing P/E) for the last several fiscal years, straight from their own SEC filings — real, verifiable data, not a guess from memory. Use debt/assets and cash position as real evidence for balance sheet health, free cash flow trend as real evidence for whether the business generates real cash (not just accounting profit), and trailing P/E as real evidence for whether it's expensive relative to its own earnings. Do not state a specific figure not in the list, and never claim a company "beat" or "missed" Wall Street estimates since you have no analyst-consensus data — speak only to the real reported trend. For every current holding and watchlist item with earnings history given, weigh the bull case (what's genuinely going right, grounded in the real trend/momentum/filings) against the bear case (what's going wrong or could) before landing on a rating.

QUANT RISK DATA: You may be given real computed annualized volatility, beta vs. the S&P 500, max drawdown, a return-to-volatility ratio, and daily short-sale-volume % from FINRA for holdings and watchlist tickers. Use these as your real evidence for volatility/beta risk-rating factors instead of guessing.

TECHNICAL INDICATORS: You may be given real computed RSI(14), MACD, Bollinger Bands, the 50/200-day moving-average relationship, and 20-day support/resistance levels for current holdings and watchlist tickers — real math on real daily closes, not a guess. Use these as additional grounded evidence for momentum/timing framing (e.g. an RSI over 70 or price above the upper Bollinger Band supports a "stretched, could pull back" read; a fresh golden cross supports a "regaining momentum" read). Never print the raw numbers in the output — only the plain-English conclusion, and only when genuinely relevant.

EXAMPLE OF EXPECTED TONE AND DEPTH (for calibration only, not real data): "SCHD — allocationCheck should reflect the real % of the account it represents given its live-priced market value. A new idea candidate like a semiconductor ETF: whatItDoes explains it plainly ('a fund holding the largest US chip companies'), whyNow ties to a real structural trend ('AI infrastructure buildout is a multi-year capex cycle, not a one-quarter story'), and ratingReason is specific ('Buy — broad exposure to a durable secular trend without single-company concentration risk')." That is the bar: specific and structural, never a generic "looks promising."

ALLOCATION CHECK: Classify each of the user's current holdings into one of three buckets based on the ticker (broad-market/dividend ETFs = CORE_ETF, established individual growth companies = INDIVIDUAL_GROWTH, smaller/speculative individual companies = SPECULATIVE) and list every current holding's ticker and bucket in holdingBuckets — one entry per current holding, no omissions and no tickers that aren't an actual current holding. The actualCoreEtfPct/actualGrowthPct/actualSpeculativePct fields will be computed automatically by the caller from your holdingBuckets classification and the real live market values given above, so you do not need to compute any $ value or % yourself — just classify accurately. Use the real market values given above and your own classification to compare against the user's target percentages in your summary, and flag any hidden overlap/concentration risk (e.g. two holdings both heavily exposed to the same sector).

NEW IDEAS: Suggest 3-5 stock or ETF candidates worth researching further, ideally including at least one suited to whichever bucket came out most underweight. Mix an established name with a smaller emerging one.

RISK RATING METHODOLOGY: Low/Medium/High for every candidate, based on (a) the real volatility/beta/max drawdown given where available, (b) the real debt-to-assets/cash/free-cash-flow-trend given where available, (c) concentration/political exposure, (d) the real trailing P/E given as a valuation-risk signal where available, (e) maturity/track record — newer or unprofitable companies carry more risk even with an exciting growth story.

RATING METHODOLOGY (Buy/Hold/Sell, required for every candidate): Based on your own DEPTH REQUIREMENT reasoning above and, where given, the real earnings trend and bull/bear weighing described in REAL MULTI-YEAR EARNINGS HISTORY, land on exactly one of Buy/Hold/Sell, stated with confidence, plus a single tight sentence of rationale in ratingReason. Do not cite a specific numeric analyst-consensus count since you cannot verify that live — ground the rationale in the real fundamentals/momentum/risk reasoning you already did.

WATCHLIST ITEMS: The user may also list tickers they don't own yet, just want to track. Research and rate each one the same way as a NEW IDEA candidate above (summary, riskRating/riskReason, rating/ratingReason) — these are separate from the newIdeas list you're suggesting; watchlistItems is specifically the user's own tracked tickers.

NO BROKERAGE CONNECTED: If CURRENT HOLDINGS says the user has no brokerage connection, set every allocationCheck actual* percentage to 0, leave holdingBuckets as an empty array, and write the summary to explain there's no real portfolio yet (use the goal's target percentages as-is, or the stated default). connectionsToExistingHoldings should be an empty array in that case. The hasBrokerageConnection field will be overwritten by the caller — just leave it false in this case, true otherwise.

Return ONLY the structured JSON matching the provided schema — no other text. This is NOT financial advice; frame everything as "worth researching further."`;

// ============================================================================
// HELPER: formatMomentum — turns a real Momentum object into a one-line plain-text summary
// ============================================================================
function formatMomentum(m: import("@/lib/quotes").Momentum | null): string { // this defines the function that renders one ticker's momentum data as prompt text
  if (!m) return "no momentum data available"; // this handles the case where momentum couldn't be computed at all
  const parts = [
    m.pct1Month != null ? `1mo ${m.pct1Month >= 0 ? "+" : ""}${m.pct1Month.toFixed(1)}%` : null, // this formats the 1-month % change, with an explicit + sign for gains
    m.pct3Month != null ? `3mo ${m.pct3Month >= 0 ? "+" : ""}${m.pct3Month.toFixed(1)}%` : null, // this formats the 3-month % change, with an explicit + sign for gains
    m.aboveTwentyDayAvg != null ? `${m.aboveTwentyDayAvg ? "above" : "below"} 20-day avg` : null, // this states whether price is above or below its 20-day average
    m.aboveFiftyDayAvg != null ? `${m.aboveFiftyDayAvg ? "above" : "below"} 50-day avg` : null, // this states whether price is above or below its 50-day average
  ].filter(Boolean); // this drops any pieces that were unavailable
  return `MOMENTUM: ${parts.join(", ")}`; // this joins whatever pieces are available into one line
}

// ============================================================================
// HELPER: formatRisk — turns real RiskMetrics + FINRA short-volume data into a one-line plain-text summary
// ============================================================================
function formatRisk(
  risk: import("@/lib/riskMetrics").RiskMetrics | null,
  shortVolume: import("@/lib/finra").ShortVolumeData | null
): string { // this defines the function that renders one ticker's quant risk data as prompt text
  const parts = [
    risk?.annualizedVolatilityPct != null ? `annualized volatility ${risk.annualizedVolatilityPct.toFixed(0)}%` : null, // this formats the real annualized volatility
    risk?.beta != null ? `beta ${risk.beta.toFixed(2)} vs. S&P 500` : null, // this formats the real beta vs. the S&P 500
    risk?.maxDrawdownPct != null ? `max drawdown ${risk.maxDrawdownPct.toFixed(0)}%` : null, // this formats the real max peak-to-trough decline
    risk?.returnToVolatilityRatio != null ? `return-to-volatility ratio ${risk.returnToVolatilityRatio.toFixed(2)}` : null, // this formats the real return-per-unit-of-risk ratio (previously computed but silently dropped from this prompt — the SYSTEM_PROMPT already promised it, so it's included now)
    shortVolume != null
      ? `${shortVolume.shortVolumePct.toFixed(0)}% of ${shortVolume.tradingDate} volume was short-sale volume`
      : null, // this formats the real FINRA short-sale-volume percentage for the most recent trading day
  ].filter(Boolean); // this drops any pieces that were unavailable
  return parts.length > 0 ? `QUANT RISK: ${parts.join(", ")}` : ""; // this returns an empty string instead of an empty "QUANT RISK:" label when nothing was available
}

// ============================================================================
// HELPER: formatTechnical — turns real TechnicalIndicators into a one-line plain-text summary
// ============================================================================
function formatTechnical(t: import("@/lib/technicalIndicators").TechnicalIndicators | null): string { // this defines the function that renders one ticker's technical-indicator signals as prompt text
  if (!t) return ""; // this handles the case where no technical data is available at all
  const parts = [
    t.rsi14 != null ? `RSI(14) ${t.rsi14.toFixed(0)}${t.rsiSignal && t.rsiSignal !== "neutral" ? ` (${t.rsiSignal})` : ""}` : null, // this formats the real RSI value plus its overbought/oversold read, if any
    t.macdCrossover ? `MACD ${t.macdCrossover} crossover just occurred` : null, // this notes a real bullish/bearish MACD crossover only when one just happened
    t.pricePosition && t.pricePosition !== "inside" ? `price is ${t.pricePosition.replace("_", " ")} Bollinger Band` : null, // this notes when price is real-world outside its Bollinger Band
    t.movingAverageCross === "golden_cross" || t.movingAverageCross === "death_cross"
      ? `${t.movingAverageCross.replace("_", " ")} just occurred (50-day vs. 200-day MA)`
      : t.movingAverageCross
        ? `50-day MA ${t.movingAverageCross === "bullish" ? "above" : "below"} 200-day MA`
        : null, // this notes a fresh golden/death cross, or otherwise just the standing 50/200-day MA relationship
    t.supportResistance
      ? `20-day range $${t.supportResistance.support20d.toFixed(2)}-$${t.supportResistance.resistance20d.toFixed(2)}`
      : null, // this formats the real rolling 20-day support/resistance range
  ].filter(Boolean); // this drops any pieces that were unavailable
  return parts.length > 0 ? `TECHNICALS: ${parts.join(", ")}` : ""; // this returns an empty string instead of an empty "TECHNICALS:" label when nothing was available
}

// ============================================================================
// FUNCTION: buildUserMessage — turns one user's full real-data context into the actual prompt text sent to Gemini
// ============================================================================
function buildUserMessage(context: Awaited<ReturnType<typeof buildUserContext>>): string { // this defines the function that renders one user's context object into the final prompt string
  const holdingsList = context.holdings
    .map((h) => { // this builds one text line per real holding
      const priceInfo = h.livePrice ? `LIVE PRICE $${h.livePrice.price.toFixed(2)}` : "no live price available"; // this builds the live-price text for one holding (no 52-week figures needed here since Weekly Trends has no exit-rule logic)
      return `- ${h.ticker}: ${h.shares} shares, market value $${h.marketValue.toFixed(2)}, ${priceInfo}. ${formatMomentum(h.momentum)} ${formatRisk(h.riskMetrics, h.shortVolume)} ${formatTechnical(h.technicalIndicators)}`; // this assembles the full one-line summary for this holding
    })
    .join("\n"); // this joins every holding's line into one multi-line block

  const goalText = context.goal
    ? `Target allocation: ${context.goal.targetCoreEtfPct}% core ETFs / ${context.goal.targetGrowthPct}% individual growth / ${context.goal.targetSpeculativePct}% speculative.${context.goal.notes ? ` Notes: ${context.goal.notes}` : ""}`
    : "(no goal set — use 70% core ETFs / 20% individual growth / 10% speculative as a default assumption and say so)"; // this describes the user's saved allocation goal, or supplies the app's own default assumption when none was set

  const watchlistList = context.watchlist
    .map((w) => { // this builds one text line per watchlisted ticker
      const priceInfo = w.livePrice ? `LIVE PRICE $${w.livePrice.price.toFixed(2)}` : "no live price available"; // this builds the live-price text for one watchlist ticker
      return `- ${w.ticker}${w.note ? ` (${w.note})` : ""}, ${priceInfo}. ${formatMomentum(w.momentum)} ${formatRisk(w.riskMetrics, w.shortVolume)} ${formatTechnical(w.technicalIndicators)}`; // this assembles the full one-line summary for this watchlist ticker
    })
    .join("\n") || "(none)"; // this falls back to a plain "(none)" line when the watchlist is empty

  const headlinesList = context.recentHeadlines
    .map(
      (a) =>
        `- [${a.relatedTicker ?? "general"}] "${a.title}" — ${a.source}, ${new Date(a.pubDate).toLocaleString()}` // this formats one real headline as a single text line
    )
    .join("\n") || "(none available)"; // this falls back to a plain "(none available)" line when there are no headlines

  const filingsList = context.materialFilings
    .map((f) => `- [${f.ticker}] ${f.description}, filed ${f.filedAt}`) // this formats one real SEC filing as a single text line
    .join("\n") || "(none in the recent record)"; // this falls back to a plain "(none in the recent record)" line when there are no filings

  const insiderList = context.insiderActivity
    .map((f) => `- [${f.ticker}] ${f.description}, filed ${f.filedAt}`) // this formats one real insider filing as a single text line
    .join("\n") || "(none in the recent record)"; // this falls back to a plain "(none in the recent record)" line when there's no insider activity

  const livePriceByTicker = new Map<string, number>(); // this will map each ticker to its live price, used below only for the trailing-P/E calculation
  for (const h of context.holdings) if (h.livePrice) livePriceByTicker.set(h.ticker, h.livePrice.price); // this records every holding's live price
  for (const w of context.watchlist) if (w.livePrice) livePriceByTicker.set(w.ticker, w.livePrice.price); // this records every watchlist ticker's live price too

  const earningsList =
    [...context.earningsHistories.entries()]
      .map(([ticker, h]) => { // this builds one text block per ticker with real earnings history
        const years = h.points
          .filter((p) => p.revenue != null || p.netIncome != null) // this keeps only fiscal years that actually have real revenue or net income data
          .map(
            (p) =>
              `FY${p.fiscalYear}: revenue ${p.revenue != null ? `$${(p.revenue / 1e9).toFixed(2)}B` : "n/a"}, net income ${p.netIncome != null ? `$${(p.netIncome / 1e9).toFixed(2)}B` : "n/a"}` // this formats one fiscal year's real revenue/net income in billions
          )
          .join("; "); // this joins every fiscal year into one line

        const mostRecentEps = [...h.points].reverse().find((p) => p.eps != null)?.eps ?? null; // this finds the most recent fiscal year that has a real reported EPS figure
        const trailingPE = computeTrailingPE(livePriceByTicker.get(ticker) ?? null, mostRecentEps); // this computes the real trailing P/E from the live price and that EPS

        const fundamentals = [
          h.latestDebtToAssetsRatio != null ? `debt/assets ${(h.latestDebtToAssetsRatio * 100).toFixed(0)}%` : null, // this formats the real debt-to-assets ratio
          h.latestCashPosition != null ? `cash position $${(h.latestCashPosition / 1e9).toFixed(2)}B` : null, // this formats the real cash position in billions
          `free cash flow trend ${h.freeCashFlowTrend}`, // this states the real free-cash-flow trend classification
          trailingPE != null ? `trailing P/E ${trailingPE.toFixed(1)}` : null, // this formats the real computed trailing P/E
        ]
          .filter(Boolean) // this drops any fundamentals that were unavailable
          .join(", "); // this joins the available fundamentals into one line

        return `- ${ticker}: revenue trend ${h.revenueTrend}, net income trend ${h.netIncomeTrend}, ${fundamentals}. ${years}`; // this assembles the full earnings-history line for this ticker
      })
      .join("\n") || "(none available)"; // this falls back to a plain "(none available)" line when no earnings history was fetched

  const macroText = context.macro
    ? `Fed funds rate: ${context.macro.fedFundsRate}% (as of ${context.macro.fedFundsDate}). CPI inflation (YoY): ${context.macro.cpiYoyPct?.toFixed(1)}%. Unemployment: ${context.macro.unemploymentRate}% (as of ${context.macro.unemploymentDate}).`
    : "(not configured — reason from general knowledge if macro context is relevant)"; // this describes the real macro snapshot, or explains it's simply not configured

  const marketText = [
    context.marketMomentum
      ? `S&P 500 (SPY) ${formatMomentum(context.marketMomentum)}`
      : "S&P 500 momentum unavailable", // this states SPY's real momentum, or that it's unavailable
    context.vix ? `VIX (volatility index) at ${context.vix.price.toFixed(1)}` : "VIX unavailable", // this states the real live VIX level, or that it's unavailable
  ].join(". "); // this joins the two market-context sentences together

  const congressList = context.congressTrades
    .map(
      (t) =>
        `- [${t.ticker}] ${t.chamber} member ${t.person}: ${t.type}, ${t.amountRange}, transacted ${t.transactionDate} (disclosed ${t.disclosureDate})` // this formats one real congressional trade as a single text line
    )
    .join("\n") || "(none in the recent record)"; // this falls back to a plain "(none in the recent record)" line when there are no congressional trades

  const correlationText = context.correlationFlags.length > 0
    ? context.correlationFlags
        .map((c) => `- ${c.tickerA} & ${c.tickerB}: ${(c.correlation * 100).toFixed(0)}% correlated over the last 3 months`) // this formats one real pairwise correlation flag as a single text line
        .join("\n") // this joins every correlation flag into one multi-line block
    : "(none computed — fewer than two holdings with enough price history)"; // this explains why no correlation data is present, rather than just showing an empty section

  // The return below is the literal prompt text handed to Gemini as the user message —
  // same constraint as SYSTEM_PROMPT above, no inline comments possible inside it. Each
  // section header in the string corresponds to one of the variables built above it:
  // CURRENT HOLDINGS ← holdingsList, CASH AVAILABLE ← context.cashAvailable, WATCHLIST ←
  // watchlistList, RECENT REAL HEADLINES ← headlinesList, RECENT SEC FILINGS ← filingsList,
  // RECENT INSIDER ACTIVITY ← insiderList, REAL MULTI-YEAR EARNINGS HISTORY ← earningsList,
  // CURRENT MACRO CONTEXT ← macroText, CURRENT MARKET CONTEXT ← marketText, RECENT
  // CONGRESSIONAL TRADES ← congressList, HOLDING CORRELATION ← correlationText, USER'S
  // GOALS ← goalText.
  return `Today's date: ${new Date().toISOString().slice(0, 10)}

CURRENT HOLDINGS:
${context.holdings.length > 0 ? holdingsList : "(none — user has no brokerage connection)"}

CASH AVAILABLE: ${context.hasBrokerageConnection ? `$${context.cashAvailable.toFixed(2)}` : "N/A (no brokerage connected)"}

WATCHLIST (not owned, tracked only):
${watchlistList}

RECENT REAL HEADLINES (from live RSS feeds, genuine and verifiable):
${headlinesList}

RECENT SEC FILINGS (official, genuine):
${filingsList}

RECENT INSIDER ACTIVITY (SEC Form 4/144, official, genuine):
${insiderList}

REAL MULTI-YEAR EARNINGS HISTORY (from each company's own SEC filings, official, genuine — trend computed from real revenue/net income, never EPS):
${earningsList}

CURRENT MACRO CONTEXT:
${macroText}

CURRENT MARKET CONTEXT:
${marketText}

RECENT CONGRESSIONAL TRADES (official STOCK Act disclosures, genuine):
${congressList}

HOLDING CORRELATION (real, computed from 3-month price history):
${correlationText}

USER'S GOALS:
${goalText}

Produce the full weekly digest per the schema and system instructions — confident, analytical, professional throughout, using the live prices provided as ground truth for current holdings/watchlist.`;
}

// ============================================================================
// FUNCTION: generateWeeklyTrends — the entry point one cron/manual call uses to produce one user's Weekly Trends report
// ============================================================================
export async function generateWeeklyTrends(
  userId: string,
  shared?: SharedMarketContext
): Promise<{ skipped: true; reason: string } | { skipped: false; report: WeeklyTrends }> { // this defines the function runBatch.ts calls once per user for this report kind
  const context = await buildUserContext(userId, shared); // this assembles all of this user's real data, reusing shared batch-wide market data if given

  if (context.holdings.length === 0 && context.watchlist.length === 0 && !context.goal) { // this checks whether the user has any holdings, watchlist tickers, or a goal at all
    return { skipped: true, reason: "Connect a brokerage account, add a watchlist ticker, or set your goals first." }; // this skips generation entirely rather than asking the AI to write about nothing
  }

  const client = getGeminiClient(); // this creates the Gemini API client
  const model = getGeminiModel(); // this reads the configured Gemini model name

  const response = await generateGeminiContent(client, { // this makes the actual call to Gemini, retrying once if it's a transient overload error
    model, // this is which Gemini model to use
    contents: [{ role: "user", parts: [{ text: buildUserMessage(context) }] }], // this is the real-data prompt built above, sent as the user turn
    config: {
      systemInstruction: SYSTEM_PROMPT, // this is the fixed instructions defined above, sent as the system turn
      responseMimeType: "application/json", // this tells Gemini to return raw JSON
      responseJsonSchema: toJsonSchema(weeklyTrendsSchema), // this tells Gemini the exact JSON shape it must return
      thinkingConfig: { thinkingBudget: -1 }, // this lets Gemini use its own default/unlimited internal reasoning budget
    },
  });

  const text = response.text; // this pulls the raw JSON text out of Gemini's response
  if (!text) { // this checks whether Gemini actually returned any text
    throw new Error("No text content in Gemini response"); // this fails loudly rather than silently producing an empty report
  }

  const report = weeklyTrendsSchema.parse(JSON.parse(text)); // this parses the raw JSON and validates it against the real schema, throwing if Gemini's output doesn't match
  // Deterministic, not model-trusted — the model can misjudge this from prose alone.
  report.hasBrokerageConnection = context.hasBrokerageConnection; // this overwrites the model's own guess with the real connection status

  // Deterministic, not model-trusted — actualCoreEtfPct/actualGrowthPct/actualSpeculativePct
  // are pure arithmetic on real live market values once each holding has a bucket. The bucket
  // classification itself (CORE_ETF vs. INDIVIDUAL_GROWTH vs. SPECULATIVE) is a genuine judgment
  // call and stays with the model via holdingBuckets above; only the resulting math is redone.
  const bucketByTicker = new Map(report.allocationCheck.holdingBuckets.map((b) => [b.ticker, b.bucket])); // this maps each ticker the model classified to the bucket it chose
  const liveValueByTicker = new Map(
    context.holdings.map((h) => [h.ticker, h.livePrice ? h.livePrice.price * h.shares : h.marketValue])
  ); // this maps each real holding's ticker to its live-priced market value, same formula as dailyDigest.ts
  const totalLiveValue = [...liveValueByTicker.values()].reduce((sum, v) => sum + v, 0); // this is the real total live value across every current holding

  const bucketTotals: Record<"CORE_ETF" | "INDIVIDUAL_GROWTH" | "SPECULATIVE", number> = {
    CORE_ETF: 0,
    INDIVIDUAL_GROWTH: 0,
    SPECULATIVE: 0,
  }; // this will hold the real summed live value per bucket
  for (const [ticker, value] of liveValueByTicker) { // this walks every real holding's live value
    const bucket = bucketByTicker.get(ticker); // this looks up which bucket the model put this ticker in
    if (bucket) bucketTotals[bucket] += value; // this adds the holding's value into its bucket total; a holding the model never classified is still counted in totalLiveValue above but not in any bucket, rather than guessing where it belongs
  }

  report.allocationCheck.actualCoreEtfPct = totalLiveValue > 0 ? (bucketTotals.CORE_ETF / totalLiveValue) * 100 : 0; // this is the real % of the portfolio's live value in the core-ETF bucket
  report.allocationCheck.actualGrowthPct = totalLiveValue > 0 ? (bucketTotals.INDIVIDUAL_GROWTH / totalLiveValue) * 100 : 0; // this is the real % of the portfolio's live value in the individual-growth bucket
  report.allocationCheck.actualSpeculativePct = totalLiveValue > 0 ? (bucketTotals.SPECULATIVE / totalLiveValue) * 100 : 0; // this is the real % of the portfolio's live value in the speculative bucket

  await prisma.report.create({ // this saves the finished report to the database
    data: {
      userId, // this is which user the report belongs to
      type: "WEEKLY_TRENDS", // this is the report kind being saved
      schemaVersion: 3, // this is the schema version this report was generated under
      content: JSON.stringify(report), // this is the full report, serialized to JSON for storage
      model, // this is which AI model actually generated it
      inputTokens: response.usageMetadata?.promptTokenCount ?? null, // this records the real prompt token count for cost/usage tracking
      outputTokens: response.usageMetadata?.candidatesTokenCount ?? null, // this records the real output token count for cost/usage tracking
    },
  });

  return { skipped: false, report }; // this hands the finished report back to the caller
}
