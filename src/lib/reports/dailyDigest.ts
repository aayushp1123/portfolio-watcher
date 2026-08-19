// ============================================================================
// IMPORTS
// ============================================================================
import { getGeminiClient, getGeminiModel } from "@/lib/gemini"; // this brings in the Gemini client factory and the configured model name
import { prisma } from "@/lib/prisma"; // this brings in the shared database client used to save the finished report
import { buildUserContext, type SharedMarketContext } from "@/lib/reports/buildContext"; // this brings in the function that assembles all the real data for one user
import { dailyDigestSchema, toJsonSchema, type DailyDigest } from "@/lib/reports/schemas"; // this brings in the Zod schema, its JSON-Schema converter, and the inferred TypeScript type
import { computeTrailingPE } from "@/lib/riskMetrics"; // this brings in the pure-math trailing P/E calculator used while formatting earnings history

// ============================================================================
// SYSTEM PROMPT — the fixed instructions sent to Gemini on every Daily Digest call
// ============================================================================
// This is one long string (the literal prompt text), so it can't have inline `//`
// comments — a comment placed inside a template literal becomes part of the actual
// text sent to Gemini, corrupting a prompt that's already been verified against real
// data. Instead, here's what each paragraph below does, in the order it appears:
//  1. Persona/audience framing — write for a total investing beginner, explain every term.
//  2. SOURCE-OF-TRUTH RULE — the core anti-hallucination rule: only state facts/numbers
//     actually given below; general business/market reasoning is still required.
//  3. LIVE PRICES — treat the given live price as ground truth, no hedging.
//  4. RECENT REAL HEADLINES — real RSS headlines are usable without caveats, but never
//     reference a headline that wasn't actually given.
//  5. ANALYSIS IS FULL-CONFIDENCE — write with authority, no hedging or apologizing.
//  6. ACCURACY & OBJECTIVITY — no hype or fear language, professional tone only.
//  7. DEPTH REQUIREMENT — actually reason through momentum/fundamentals/politics/history/
//     the user's own rules before rating; never print raw indicator numbers.
//  8. SEC FILINGS & INSIDER ACTIVITY — real filings/insider trades are usable, never invented.
//  9. MACRO CONTEXT — real Fed/CPI/unemployment figures are usable without caveats.
// 10. MARKET CONTEXT — use the real SPY momentum and VIX level as the market-wide baseline.
// 11. CONGRESSIONAL TRADING — real STOCK Act disclosures are one data point, never a
//     standalone reason to buy/sell.
// 12. REAL MULTI-YEAR EARNINGS HISTORY — how to use real revenue/income/fundamentals data,
//     and explicitly forbids claiming an analyst "beat/miss" since that data isn't given.
// 13. QUANT RISK DATA — how to use the real volatility/beta/drawdown/return-to-volatility/
//     short-volume numbers.
// 14. TECHNICAL INDICATORS — how to use the real RSI/MACD/Bollinger/MA-cross/support-
//     resistance signals, plain-English only, never raw numbers.
// 15. EXAMPLE OF EXPECTED TONE AND DEPTH — a calibration example, explicitly not real data.
// 16. RISK RATING METHODOLOGY — the exact factors that must drive every Low/Medium/High call.
// 17. RATING METHODOLOGY — the exact factors that must drive every Buy/Hold/Sell call.
// 18. EXIT RULES — the exact deterministic math the model must apply for each exit-rule type.
// 19. TAX NOTES — when to include a wash-sale/tax-loss-harvesting note.
// 20. WATCHLIST ITEMS — same treatment as holdings, minus shares/cost-basis/exit-rule/tax.
// 21. NO BROKERAGE CONNECTED — how to degrade gracefully to a watchlist-only digest.
// 22. WHAT TO WATCH NEXT — the forward-looking closing section.
// 23. Final instruction — return only the JSON, nothing else.
const SYSTEM_PROMPT = `You are producing a daily portfolio digest for someone who has NEVER invested before. Every financial term needs a short, plain-English explanation inline — never assume prior investing knowledge.

SOURCE-OF-TRUTH RULE (governs everything below, read this first): every specific fact, number, date, headline, filing, trade, or earnings figure you state MUST come from the real data sections given to you in this prompt — never from outside knowledge, memory of past training data about recent events, or invention. If something isn't in the data given below, you don't know it happened, full stop. This does NOT mean you can't reason — you should absolutely apply your general knowledge of how businesses, industries, and markets work (e.g. what a semiconductor cycle is, why rate cuts affect growth stocks, how a company's business model creates risk) to interpret the real data you're given. The line is: general analytical/domain reasoning is expected and required; specific claimed facts, events, or numbers not present in the data below are forbidden. If you're not confident a data point was actually given to you, leave it out rather than guess.

LIVE PRICES: Each holding and watchlist ticker below includes a LIVE PRICE fetched moments ago from a real market data source when available — treat that number as ground truth, use it directly and confidently, no hedging. Only if a ticker has no live price available should you fall back to your best general knowledge and note it's approximate — that is the rare case, not the default.

RECENT REAL HEADLINES: You may be given a list of REAL, recently-published headlines (with publisher and date) pulled from live RSS feeds for these exact tickers — these are genuine, verifiable, not something you need to caveat. Weave relevant ones into portfolioSummary, individual holdings' riskReason/ratingReason, dividendNotes, bottomLine, and especially whatToWatchNext wherever they're actually relevant — this is real, current information you wouldn't otherwise have. Do not reference a headline that isn't in the list, and don't force one in in if none of them are relevant to a given holding.

ANALYSIS IS FULL-CONFIDENCE (critical): Risk ratings, Buy/Hold/Sell ratings, reasoning, exit-rule logic, allocation math, portfolio summary, bottom line — all written with full analytical confidence and authority, exactly like a professional research note. Do not hedge, apologize, or undercut your own analysis.

ACCURACY & OBJECTIVITY: No hype, no promotional or fear-based language. Grounded, analytical, professional tone only — never casual or uncertain-sounding. Explicit "not financial advice" framing only where noted in the schema, not sprinkled throughout.

DEPTH REQUIREMENT (critical): Before writing any risk rating or bottom line, actually reason through: (a) technical momentum — use the REAL computed MOMENTUM figures given (1-month/3-month % change, position vs. 20/50-day averages) as ground truth, not a guess, (b) fundamentals/balance sheet health, (c) political/regulatory context relevant to that holding's sector, (d) historical precedent for similar situations, (e) relevance to this specific user's exit rules and goals. Let this reasoning change the conclusion when warranted — do not default to a generic "Medium, seems fine" answer. Do not print raw indicator numbers (RSI values, etc) — only the plain-English conclusion they lead to.

SEC FILINGS & INSIDER ACTIVITY: You may be given real, recent SEC filings (8-K material events, 10-Q/10-K reports) and insider transactions (Form 4 buys/sells by executives, Form 144 proposed sales) for these tickers — official government data, genuine and verifiable. A recent 8-K is a real material event; weave it into that holding's context. Notable insider buying/selling (especially by multiple insiders, or unusually large) is a real signal worth mentioning. Don't force these in if not relevant, and never invent a filing that isn't listed.

MACRO CONTEXT: If a current federal funds rate, inflation (CPI), and unemployment rate are provided, treat them as real, current, and confidently usable in reasoning about rate-sensitive holdings — do not caveat these numbers.

MARKET CONTEXT (S&P 500 momentum, VIX): If given, use the S&P 500 (SPY) momentum figure as a real baseline for whether a holding is genuinely outperforming or lagging the broad market, not just moving in absolute terms. If a VIX level is given, treat it as the real current market-wide volatility/fear gauge (roughly: under 15 is calm, 15-25 is normal, above 25 signals elevated market-wide fear) and let it inform risk framing, especially for High-risk holdings.

CONGRESSIONAL TRADING: You may be given real, recent stock trades disclosed by members of Congress (via the STOCK Act) for these exact tickers — genuine public disclosures, not something to caveat. If a holding has notable recent congressional buying or selling (especially multiple members, or from committees relevant to that sector), mention it briefly as one data point among many — never treat it as a standalone reason to buy or sell, and never invent a trade not in the list.

REAL MULTI-YEAR EARNINGS HISTORY: You may be given each company's actual reported annual revenue, net income, and fundamentals (debt-to-assets ratio, cash position, free cash flow trend, trailing P/E) for the last several fiscal years, straight from their own SEC filings — real, verifiable data, not a guess from memory. Use debt/assets and cash position as your real evidence for "balance sheet health" (previously something you'd have had to guess at); use free cash flow trend as real evidence for whether the business is actually generating cash, not just accounting profit; use trailing P/E as real evidence for whether the stock looks expensive relative to its own earnings. Do not state a specific figure that isn't in the list given. Do not claim the company "beat" or "missed" Wall Street analyst estimates — you are not given analyst consensus data, so you cannot know that; instead speak only to the real reported trend (e.g. "revenue has grown for four straight years" or "net income has declined for two consecutive years"). Weigh both the bull case (what's going right, grounded in the real trend/momentum/filings given) and the bear case (what's going wrong or could) before landing on a rating — a credible Buy still names the real risk, and a credible Sell still names what the bulls would point to.

QUANT RISK DATA: You may be given real computed annualized volatility, beta vs. the S&P 500, max drawdown (the worst real peak-to-trough decline), a return-to-volatility ratio, and daily short-sale-volume % from FINRA for each ticker. Use these as your real evidence for volatility/beta risk-rating factors instead of guessing — e.g. "high beta (1.8) and a max drawdown of 45% mean this holding can move sharply against you" is grounded; a generic "this seems volatile" is not.

TECHNICAL INDICATORS: You may be given real computed RSI(14), MACD, Bollinger Bands, the 50/200-day moving-average relationship, and 20-day support/resistance levels for each ticker — all real math on real daily closes, not a guess. Use these as additional grounded evidence for momentum/timing framing in riskReason, ratingReason, and whatToWatchNext (e.g. an RSI over 70 or price above the upper Bollinger Band supports a "stretched, could pull back" read; a fresh golden cross or RSI recovering from oversold supports a "regaining momentum" read). As stated in the DEPTH REQUIREMENT above, never print the raw numbers — only the plain-English conclusion they lead to, and only when genuinely relevant to the holding's story.

EXAMPLE OF EXPECTED TONE AND DEPTH (for calibration only, not real data — do not reuse these numbers or this ticker):
"NVDA — $224.50 (live). riskReason: 'Concentrated in a single fast-moving sector (AI infrastructure semiconductors); a leader with a dominant market position, but the stock's valuation already prices in years of growth, so any slowdown in AI capex would hit it disproportionately compared to a diversified fund.' ratingReason: 'Buy — durable competitive moat in AI accelerators and expanding data-center demand outweigh near-term valuation risk for a long-term holder.'"
That is the bar: specific, structural reasoning tied to the actual business — not a vague "seems fine" or a generic disclaimer.

RISK RATING METHODOLOGY: Low/Medium/High for every holding, based on (a) the real volatility/beta/max drawdown given, (b) the real debt-to-assets/cash/free-cash-flow-trend given, (c) concentration/political exposure, (d) the real trailing P/E given as a valuation-risk signal. For ETFs, factor in diversification but still flag sector concentration.

RATING METHODOLOGY (Buy/Hold/Sell, required for every holding): Based on the real earnings trend, momentum, filings, and insider/congressional activity given, weigh the bull case against the bear case (see REAL MULTI-YEAR EARNINGS HISTORY above), then land on exactly one of Buy/Hold/Sell, stated with confidence, plus a single tight sentence of rationale in ratingReason that reflects which side of that bull/bear weighing won and why. Do not cite a specific numeric analyst-consensus count (e.g. "8 Buy/2 Hold") since you cannot verify that live — instead ground the rationale in the real fundamentals/momentum/risk reasoning you already did.

EXIT RULES: For each holding with an active exit rule, use the LIVE PRICE to determine its status:
- PRICE_TARGET: status is "triggered" if live price >= target value, "approaching" if within 5%, else "ok".
- TRAILING_STOP_PCT: use the 52-week-high figure provided with the live price as the peak reference, compute the stop level as (value)% below that peak; "triggered" if live price is at/below the stop, "approaching" if within 5% of it, else "ok".
- STOP_LOSS_PRICE: "triggered" if live price <= value, "approaching" if within 5% above it, else "ok".
Holdings with no active exit rule get exitRuleStatus: null (status "none"). If no live price was available for a holding with an exit rule, reason from your best general knowledge instead and say so briefly in the message.

TAX NOTES: For any holding currently at an unrealized loss (market value below cost basis), include a taxNote mentioning the wash-sale rule in one plain sentence (selling at a loss and rebuying within 30 days disallows the tax deduction) and that tax-loss harvesting is a legitimate strategy some investors use. For holdings at a gain or with no cost basis data, taxNote should be null.

WATCHLIST ITEMS: The user may also list tickers they don't own yet, just want to track. For each one, give a short plain-English summary of what the company/fund does, plus the same riskRating/riskReason and rating/ratingReason treatment as a holding (same methodology above, same live-price-first rule). Watchlist items have no shares, cost basis, exit rule, or tax note — omit those concepts entirely for them.

NO BROKERAGE CONNECTED: If the HOLDINGS section says the user has no brokerage connection, set totalValue to 0, overallGainLossPct and cashAvailable to null, holdings to an empty array, and dividendNotes to an empty array — do not invent placeholder position data. Write portfolioSummary and bottomLine to reflect that this is a watchlist-only digest (no owned positions yet), not a portfolio recap. The hasBrokerageConnection field will be overwritten by the caller — just leave it false in this case, true otherwise.

WHAT TO WATCH NEXT: Write 2-4 sentences on what's worth paying attention to next — upcoming earnings-season timing, known macro/Fed calendar patterns, sector or political catalysts relevant to this specific user's holdings/watchlist, and any exit rule that's getting close given the live prices above. This is a forward-looking synthesis, written with the same confidence as the rest of the analysis.

Return ONLY the structured JSON matching the provided schema — no other text.`;

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
    risk?.maxDrawdownPct != null ? `max drawdown ${risk.maxDrawdownPct.toFixed(0)}%` : null, // this formats the real max peak-to-trough decline (previously computed but silently dropped from this prompt — the SYSTEM_PROMPT already promised it, so it's included now)
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
      const priceInfo = h.livePrice
        ? `LIVE PRICE $${h.livePrice.price.toFixed(2)}${
            h.livePrice.fiftyTwoWeekHigh != null
              ? ` (52-wk high $${h.livePrice.fiftyTwoWeekHigh.toFixed(2)}${
                  h.livePrice.fiftyTwoWeekLow != null ? `, low $${h.livePrice.fiftyTwoWeekLow.toFixed(2)}` : ""
                })`
              : ""
          }`
        : "no live price available"; // this builds the live-price text for one holding, independently checking both the high and the low so a missing low never prints the literal text "undefined"
      return `- ${h.ticker} (${h.name}): ${h.shares} shares, market value $${h.marketValue.toFixed(2)}, cost basis ${h.costBasis != null ? `$${h.costBasis.toFixed(2)}` : "unknown"}, ${priceInfo}. ${formatMomentum(h.momentum)} ${formatRisk(h.riskMetrics, h.shortVolume)} ${formatTechnical(h.technicalIndicators)}`; // this assembles the full one-line summary for this holding
    })
    .join("\n"); // this joins every holding's line into one multi-line block

  const exitRulesList = context.exitRules
    .map((r) => `- ${r.ticker}: ${r.ruleType} = ${r.value}${r.note ? ` (${r.note})` : ""}`) // this formats one exit rule as a single text line
    .join("\n") || "(none set)"; // this falls back to a plain "(none set)" line when the user has no active exit rules

  const goalText = context.goal
    ? `Target allocation: ${context.goal.targetCoreEtfPct}% core ETFs / ${context.goal.targetGrowthPct}% individual growth / ${context.goal.targetSpeculativePct}% speculative.${context.goal.notes ? ` Notes: ${context.goal.notes}` : ""}`
    : "(no goal set yet)"; // this describes the user's saved allocation goal, or says none was set

  const watchlistList = context.watchlist
    .map((w) => { // this builds one text line per watchlisted ticker
      const priceInfo = w.livePrice ? `LIVE PRICE $${w.livePrice.price.toFixed(2)}` : "no live price available"; // this builds the live-price text for one watchlist ticker (no 52-week figures needed here since watchlist items have no exit rules)
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

  // The return below is the literal prompt text handed to Gemini as the user message —
  // same constraint as SYSTEM_PROMPT above, no inline comments possible inside it. Each
  // section header in the string corresponds to one of the variables built above it:
  // HOLDINGS ← holdingsList, CASH AVAILABLE ← context.cashAvailable, ACTIVE EXIT RULES ←
  // exitRulesList, WATCHLIST ← watchlistList, RECENT REAL HEADLINES ← headlinesList,
  // RECENT SEC FILINGS ← filingsList, RECENT INSIDER ACTIVITY ← insiderList, REAL
  // MULTI-YEAR EARNINGS HISTORY ← earningsList, CURRENT MACRO CONTEXT ← macroText,
  // CURRENT MARKET CONTEXT ← marketText, RECENT CONGRESSIONAL TRADES ← congressList,
  // USER'S GOALS ← goalText.
  return `Today's date: ${new Date().toISOString().slice(0, 10)}

HOLDINGS:
${context.holdings.length > 0 ? holdingsList : "(none — user has no brokerage connection)"}

CASH AVAILABLE: ${context.hasBrokerageConnection ? `$${context.cashAvailable.toFixed(2)}` : "N/A (no brokerage connected)"}

ACTIVE EXIT RULES:
${exitRulesList}

WATCHLIST (not owned, tracked only):
${watchlistList}

RECENT REAL HEADLINES (from live RSS feeds, genuine and verifiable):
${headlinesList}

RECENT SEC FILINGS (official, genuine):
${filingsList}

RECENT INSIDER ACTIVITY (SEC Form 4/144, official, genuine):
${insiderList}

REAL MULTI-YEAR EARNINGS HISTORY (from each company's own SEC filings, official, genuine — trend already computed from real revenue/net income, never from EPS since stock splits distort it):
${earningsList}

CURRENT MACRO CONTEXT:
${macroText}

CURRENT MARKET CONTEXT:
${marketText}

RECENT CONGRESSIONAL TRADES (official STOCK Act disclosures, genuine):
${congressList}

USER'S GOALS:
${goalText}

Produce the full daily digest per the schema and system instructions — confident, analytical, professional throughout, using the live prices provided as ground truth.`;
}

// ============================================================================
// FUNCTION: generateDailyDigest — the entry point one cron/manual call uses to produce one user's Daily Digest
// ============================================================================
export async function generateDailyDigest(
  userId: string,
  shared?: SharedMarketContext
): Promise<{ skipped: true; reason: string } | { skipped: false; report: DailyDigest }> { // this defines the function runBatch.ts calls once per user for this report kind
  const context = await buildUserContext(userId, shared); // this assembles all of this user's real data, reusing shared batch-wide market data if given

  if (context.holdings.length === 0 && context.watchlist.length === 0) { // this checks whether the user has anything at all to report on
    return { skipped: true, reason: "No holdings or watchlist tickers yet — nothing to research." }; // this skips generation entirely rather than asking the AI to write about nothing
  }

  const client = getGeminiClient(); // this creates the Gemini API client
  const model = getGeminiModel(); // this reads the configured Gemini model name

  const response = await client.models.generateContent({ // this makes the actual call to Gemini
    model, // this is which Gemini model to use
    contents: [{ role: "user", parts: [{ text: buildUserMessage(context) }] }], // this is the real-data prompt built above, sent as the user turn
    config: {
      systemInstruction: SYSTEM_PROMPT, // this is the fixed instructions defined above, sent as the system turn
      responseMimeType: "application/json", // this tells Gemini to return raw JSON
      responseJsonSchema: toJsonSchema(dailyDigestSchema), // this tells Gemini the exact JSON shape it must return
      thinkingConfig: { thinkingBudget: -1 }, // this lets Gemini use its own default/unlimited internal reasoning budget
    },
  });

  const text = response.text; // this pulls the raw JSON text out of Gemini's response
  if (!text) { // this checks whether Gemini actually returned any text
    throw new Error("No text content in Gemini response"); // this fails loudly rather than silently producing an empty report
  }

  const report = dailyDigestSchema.parse(JSON.parse(text)); // this parses the raw JSON and validates it against the real schema, throwing if Gemini's output doesn't match
  // Deterministic, not model-trusted — the model can misjudge this from prose alone.
  report.hasBrokerageConnection = context.hasBrokerageConnection; // this overwrites the model's own guess with the real connection status
  if (!context.hasBrokerageConnection) { // this checks whether the user actually has no brokerage connection
    report.cashAvailable = null; // this forces cash to null rather than trusting whatever the model wrote for a user with no real account
  }

  // Deterministic, not model-trusted — totalValue/overallGainLossPct/per-holding gainLossPct
  // are pure arithmetic on marketValue/costBasis/live price, the same math already computed
  // correctly for the dashboard modal (see dashboard/snapshot/route.ts). The model was only
  // given these numbers as prose and can get the arithmetic wrong, so it's recomputed here
  // instead of trusted. Degrades safely to 0/null when there are no holdings.
  const liveByTicker = new Map(
    context.holdings.map((h) => [
      h.ticker,
      { costBasis: h.costBasis, liveMarketValue: h.livePrice ? h.livePrice.price * h.shares : h.marketValue },
    ])
  ); // this maps each real holding's ticker to its live-priced market value and real cost basis

  report.totalValue = [...liveByTicker.values()].reduce((sum, h) => sum + h.liveMarketValue, 0); // this is the real total live market value across every holding

  const withCostBasis = [...liveByTicker.values()].filter((h) => h.costBasis != null && h.costBasis > 0); // this keeps only holdings where a real cost basis is known
  const totalCostBasis = withCostBasis.reduce((sum, h) => sum + (h.costBasis as number), 0); // this sums the real cost basis across those holdings
  const totalLiveValueWithCostBasis = withCostBasis.reduce((sum, h) => sum + h.liveMarketValue, 0); // this sums the real live market value across those same holdings, kept consistent with the cost-basis total above
  report.overallGainLossPct =
    totalCostBasis > 0 ? ((totalLiveValueWithCostBasis - totalCostBasis) / totalCostBasis) * 100 : null; // this is the real dollar-weighted overall gain/loss percentage, or null if no holding has a known cost basis

  for (const holding of report.holdings) { // this walks every holding the model returned and overwrites its money fields with the real computed values
    const live = liveByTicker.get(holding.ticker); // this looks up this holding's real cost basis and live market value by ticker
    holding.costBasis = live?.costBasis ?? null; // this replaces the model's cost basis with the real one from Plaid
    holding.gainLossPct =
      live && live.costBasis != null && live.costBasis > 0
        ? ((live.liveMarketValue - live.costBasis) / live.costBasis) * 100
        : null; // this replaces the model's gain/loss % with the real computed one, or null if cost basis is unknown
  }

  await prisma.report.create({ // this saves the finished, corrected report to the database
    data: {
      userId, // this is which user the report belongs to
      type: "DAILY_DIGEST", // this is the report kind being saved
      schemaVersion: 3, // this is the schema version this report was generated under
      content: JSON.stringify(report), // this is the full report, serialized to JSON for storage
      model, // this is which AI model actually generated it
      inputTokens: response.usageMetadata?.promptTokenCount ?? null, // this records the real prompt token count for cost/usage tracking
      outputTokens: response.usageMetadata?.candidatesTokenCount ?? null, // this records the real output token count for cost/usage tracking
    },
  });

  return { skipped: false, report }; // this hands the finished report back to the caller
}
