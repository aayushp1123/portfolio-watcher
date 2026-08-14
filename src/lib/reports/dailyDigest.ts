import { getGeminiClient, getGeminiModel } from "@/lib/gemini";
import { prisma } from "@/lib/prisma";
import { buildUserContext, type SharedMarketContext } from "@/lib/reports/buildContext";
import { dailyDigestSchema, toJsonSchema, type DailyDigest } from "@/lib/reports/schemas";
import { computeTrailingPE } from "@/lib/riskMetrics";

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

function formatMomentum(m: import("@/lib/quotes").Momentum | null): string {
  if (!m) return "no momentum data available";
  const parts = [
    m.pct1Month != null ? `1mo ${m.pct1Month >= 0 ? "+" : ""}${m.pct1Month.toFixed(1)}%` : null,
    m.pct3Month != null ? `3mo ${m.pct3Month >= 0 ? "+" : ""}${m.pct3Month.toFixed(1)}%` : null,
    m.aboveTwentyDayAvg != null ? `${m.aboveTwentyDayAvg ? "above" : "below"} 20-day avg` : null,
    m.aboveFiftyDayAvg != null ? `${m.aboveFiftyDayAvg ? "above" : "below"} 50-day avg` : null,
  ].filter(Boolean);
  return `MOMENTUM: ${parts.join(", ")}`;
}

function formatRisk(
  risk: import("@/lib/riskMetrics").RiskMetrics | null,
  shortVolume: import("@/lib/finra").ShortVolumeData | null
): string {
  const parts = [
    risk?.annualizedVolatilityPct != null ? `annualized volatility ${risk.annualizedVolatilityPct.toFixed(0)}%` : null,
    risk?.beta != null ? `beta ${risk.beta.toFixed(2)} vs. S&P 500` : null,
    shortVolume != null
      ? `${shortVolume.shortVolumePct.toFixed(0)}% of ${shortVolume.tradingDate} volume was short-sale volume`
      : null,
  ].filter(Boolean);
  return parts.length > 0 ? `QUANT RISK: ${parts.join(", ")}` : "";
}

function formatTechnical(t: import("@/lib/technicalIndicators").TechnicalIndicators | null): string {
  if (!t) return "";
  const parts = [
    t.rsi14 != null ? `RSI(14) ${t.rsi14.toFixed(0)}${t.rsiSignal && t.rsiSignal !== "neutral" ? ` (${t.rsiSignal})` : ""}` : null,
    t.macdCrossover ? `MACD ${t.macdCrossover} crossover just occurred` : null,
    t.pricePosition && t.pricePosition !== "inside" ? `price is ${t.pricePosition.replace("_", " ")} Bollinger Band` : null,
    t.movingAverageCross === "golden_cross" || t.movingAverageCross === "death_cross"
      ? `${t.movingAverageCross.replace("_", " ")} just occurred (50-day vs. 200-day MA)`
      : t.movingAverageCross
        ? `50-day MA ${t.movingAverageCross === "bullish" ? "above" : "below"} 200-day MA`
        : null,
    t.supportResistance
      ? `20-day range $${t.supportResistance.support20d.toFixed(2)}-$${t.supportResistance.resistance20d.toFixed(2)}`
      : null,
  ].filter(Boolean);
  return parts.length > 0 ? `TECHNICALS: ${parts.join(", ")}` : "";
}

function buildUserMessage(context: Awaited<ReturnType<typeof buildUserContext>>): string {
  const holdingsList = context.holdings
    .map((h) => {
      const priceInfo = h.livePrice
        ? `LIVE PRICE $${h.livePrice.price.toFixed(2)}${h.livePrice.fiftyTwoWeekHigh != null ? ` (52-wk high $${h.livePrice.fiftyTwoWeekHigh.toFixed(2)}, low $${h.livePrice.fiftyTwoWeekLow?.toFixed(2)})` : ""}`
        : "no live price available";
      return `- ${h.ticker} (${h.name}): ${h.shares} shares, market value $${h.marketValue.toFixed(2)}, cost basis ${h.costBasis != null ? `$${h.costBasis.toFixed(2)}` : "unknown"}, ${priceInfo}. ${formatMomentum(h.momentum)} ${formatRisk(h.riskMetrics, h.shortVolume)} ${formatTechnical(h.technicalIndicators)}`;
    })
    .join("\n");

  const exitRulesList = context.exitRules
    .map((r) => `- ${r.ticker}: ${r.ruleType} = ${r.value}${r.note ? ` (${r.note})` : ""}`)
    .join("\n") || "(none set)";

  const goalText = context.goal
    ? `Target allocation: ${context.goal.targetCoreEtfPct}% core ETFs / ${context.goal.targetGrowthPct}% individual growth / ${context.goal.targetSpeculativePct}% speculative.${context.goal.notes ? ` Notes: ${context.goal.notes}` : ""}`
    : "(no goal set yet)";

  const watchlistList = context.watchlist
    .map((w) => {
      const priceInfo = w.livePrice ? `LIVE PRICE $${w.livePrice.price.toFixed(2)}` : "no live price available";
      return `- ${w.ticker}${w.note ? ` (${w.note})` : ""}, ${priceInfo}. ${formatMomentum(w.momentum)} ${formatRisk(w.riskMetrics, w.shortVolume)} ${formatTechnical(w.technicalIndicators)}`;
    })
    .join("\n") || "(none)";

  const headlinesList = context.recentHeadlines
    .map(
      (a) =>
        `- [${a.relatedTicker ?? "general"}] "${a.title}" — ${a.source}, ${new Date(a.pubDate).toLocaleString()}`
    )
    .join("\n") || "(none available)";

  const filingsList = context.materialFilings
    .map((f) => `- [${f.ticker}] ${f.description}, filed ${f.filedAt}`)
    .join("\n") || "(none in the recent record)";

  const insiderList = context.insiderActivity
    .map((f) => `- [${f.ticker}] ${f.description}, filed ${f.filedAt}`)
    .join("\n") || "(none in the recent record)";

  const livePriceByTicker = new Map<string, number>();
  for (const h of context.holdings) if (h.livePrice) livePriceByTicker.set(h.ticker, h.livePrice.price);
  for (const w of context.watchlist) if (w.livePrice) livePriceByTicker.set(w.ticker, w.livePrice.price);

  const earningsList =
    [...context.earningsHistories.entries()]
      .map(([ticker, h]) => {
        const years = h.points
          .filter((p) => p.revenue != null || p.netIncome != null)
          .map(
            (p) =>
              `FY${p.fiscalYear}: revenue ${p.revenue != null ? `$${(p.revenue / 1e9).toFixed(2)}B` : "n/a"}, net income ${p.netIncome != null ? `$${(p.netIncome / 1e9).toFixed(2)}B` : "n/a"}`
          )
          .join("; ");

        const mostRecentEps = [...h.points].reverse().find((p) => p.eps != null)?.eps ?? null;
        const trailingPE = computeTrailingPE(livePriceByTicker.get(ticker) ?? null, mostRecentEps);

        const fundamentals = [
          h.latestDebtToAssetsRatio != null ? `debt/assets ${(h.latestDebtToAssetsRatio * 100).toFixed(0)}%` : null,
          h.latestCashPosition != null ? `cash position $${(h.latestCashPosition / 1e9).toFixed(2)}B` : null,
          `free cash flow trend ${h.freeCashFlowTrend}`,
          trailingPE != null ? `trailing P/E ${trailingPE.toFixed(1)}` : null,
        ]
          .filter(Boolean)
          .join(", ");

        return `- ${ticker}: revenue trend ${h.revenueTrend}, net income trend ${h.netIncomeTrend}, ${fundamentals}. ${years}`;
      })
      .join("\n") || "(none available)";

  const macroText = context.macro
    ? `Fed funds rate: ${context.macro.fedFundsRate}% (as of ${context.macro.fedFundsDate}). CPI inflation (YoY): ${context.macro.cpiYoyPct?.toFixed(1)}%. Unemployment: ${context.macro.unemploymentRate}% (as of ${context.macro.unemploymentDate}).`
    : "(not configured — reason from general knowledge if macro context is relevant)";

  const marketText = [
    context.marketMomentum
      ? `S&P 500 (SPY) ${formatMomentum(context.marketMomentum)}`
      : "S&P 500 momentum unavailable",
    context.vix ? `VIX (volatility index) at ${context.vix.price.toFixed(1)}` : "VIX unavailable",
  ].join(". ");

  const congressList = context.congressTrades
    .map(
      (t) =>
        `- [${t.ticker}] ${t.chamber} member ${t.person}: ${t.type}, ${t.amountRange}, transacted ${t.transactionDate} (disclosed ${t.disclosureDate})`
    )
    .join("\n") || "(none in the recent record)";

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

export async function generateDailyDigest(
  userId: string,
  shared?: SharedMarketContext
): Promise<{ skipped: true; reason: string } | { skipped: false; report: DailyDigest }> {
  const context = await buildUserContext(userId, shared);

  if (context.holdings.length === 0 && context.watchlist.length === 0) {
    return { skipped: true, reason: "No holdings or watchlist tickers yet — nothing to research." };
  }

  const client = getGeminiClient();
  const model = getGeminiModel();

  const response = await client.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: buildUserMessage(context) }] }],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseJsonSchema: toJsonSchema(dailyDigestSchema),
      thinkingConfig: { thinkingBudget: -1 },
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("No text content in Gemini response");
  }

  const report = dailyDigestSchema.parse(JSON.parse(text));
  // Deterministic, not model-trusted — the model can misjudge this from prose alone.
  report.hasBrokerageConnection = context.hasBrokerageConnection;
  if (!context.hasBrokerageConnection) {
    report.cashAvailable = null;
  }

  await prisma.report.create({
    data: {
      userId,
      type: "DAILY_DIGEST",
      schemaVersion: 3,
      content: JSON.stringify(report),
      model,
      inputTokens: response.usageMetadata?.promptTokenCount ?? null,
      outputTokens: response.usageMetadata?.candidatesTokenCount ?? null,
    },
  });

  return { skipped: false, report };
}
