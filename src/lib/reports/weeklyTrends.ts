import { getGeminiClient, getGeminiModel } from "@/lib/gemini";
import { prisma } from "@/lib/prisma";
import { buildUserContext } from "@/lib/reports/buildContext";
import { weeklyTrendsSchema, toJsonSchema, type WeeklyTrends } from "@/lib/reports/schemas";

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

REAL MULTI-YEAR EARNINGS HISTORY: You may be given each current holding's actual reported annual revenue and net income for the last several fiscal years, straight from their own SEC filings, plus a computed trend (improving/worsening/mixed) — real, verifiable data, not a guess from memory. Do not state a specific year's figure not in the list, and never claim a company "beat" or "missed" Wall Street estimates since you have no analyst-consensus data — speak only to the real reported trend. For every current holding and watchlist item with earnings history given, weigh the bull case (what's genuinely going right, grounded in the real trend/momentum/filings) against the bear case (what's going wrong or could) before landing on a rating.

EXAMPLE OF EXPECTED TONE AND DEPTH (for calibration only, not real data): "SCHD — allocationCheck should reflect the real % of the account it represents given its live-priced market value. A new idea candidate like a semiconductor ETF: whatItDoes explains it plainly ('a fund holding the largest US chip companies'), whyNow ties to a real structural trend ('AI infrastructure buildout is a multi-year capex cycle, not a one-quarter story'), and ratingReason is specific ('Buy — broad exposure to a durable secular trend without single-company concentration risk')." That is the bar: specific and structural, never a generic "looks promising."

ALLOCATION CHECK: Classify each of the user's current holdings into one of three buckets based on the ticker (broad-market/dividend ETFs = CORE_ETF, established individual growth companies = INDIVIDUAL_GROWTH, smaller/speculative individual companies = SPECULATIVE), compute the actual $ value and % of each bucket, and compare to the user's target percentages. Also flag any hidden overlap/concentration risk (e.g. two holdings both heavily exposed to the same sector).

NEW IDEAS: Suggest 3-5 stock or ETF candidates worth researching further, ideally including at least one suited to whichever bucket came out most underweight. Mix an established name with a smaller emerging one.

RISK RATING METHODOLOGY: Low/Medium/High for every candidate, based on (a) volatility/beta, (b) balance sheet health, (c) concentration/political exposure, (d) valuation risk, (e) maturity/track record — newer or unprofitable companies carry more risk even with an exciting growth story.

RATING METHODOLOGY (Buy/Hold/Sell, required for every candidate): Based on your own DEPTH REQUIREMENT reasoning above and, where given, the real earnings trend and bull/bear weighing described in REAL MULTI-YEAR EARNINGS HISTORY, land on exactly one of Buy/Hold/Sell, stated with confidence, plus a single tight sentence of rationale in ratingReason. Do not cite a specific numeric analyst-consensus count since you cannot verify that live — ground the rationale in the real fundamentals/momentum/risk reasoning you already did.

WATCHLIST ITEMS: The user may also list tickers they don't own yet, just want to track. Research and rate each one the same way as a NEW IDEA candidate above (summary, riskRating/riskReason, rating/ratingReason) — these are separate from the newIdeas list you're suggesting; watchlistItems is specifically the user's own tracked tickers.

NO BROKERAGE CONNECTED: If CURRENT HOLDINGS says the user has no brokerage connection, set every allocationCheck actual* percentage to 0 and write its summary to explain there's no real portfolio yet (use the goal's target percentages as-is, or the stated default). connectionsToExistingHoldings should be an empty array in that case. The hasBrokerageConnection field will be overwritten by the caller — just leave it false in this case, true otherwise.

Return ONLY the structured JSON matching the provided schema — no other text. This is NOT financial advice; frame everything as "worth researching further."`;

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

function buildUserMessage(context: Awaited<ReturnType<typeof buildUserContext>>): string {
  const holdingsList = context.holdings
    .map((h) => {
      const priceInfo = h.livePrice ? `LIVE PRICE $${h.livePrice.price.toFixed(2)}` : "no live price available";
      return `- ${h.ticker}: ${h.shares} shares, market value $${h.marketValue.toFixed(2)}, ${priceInfo}. ${formatMomentum(h.momentum)}`;
    })
    .join("\n");

  const goalText = context.goal
    ? `Target allocation: ${context.goal.targetCoreEtfPct}% core ETFs / ${context.goal.targetGrowthPct}% individual growth / ${context.goal.targetSpeculativePct}% speculative.${context.goal.notes ? ` Notes: ${context.goal.notes}` : ""}`
    : "(no goal set — use 70% core ETFs / 20% individual growth / 10% speculative as a default assumption and say so)";

  const watchlistList = context.watchlist
    .map((w) => {
      const priceInfo = w.livePrice ? `LIVE PRICE $${w.livePrice.price.toFixed(2)}` : "no live price available";
      return `- ${w.ticker}${w.note ? ` (${w.note})` : ""}, ${priceInfo}`;
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
        return `- ${ticker}: revenue trend ${h.revenueTrend}, net income trend ${h.netIncomeTrend}. ${years}`;
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

  const correlationText = context.correlationFlags.length > 0
    ? context.correlationFlags
        .map((c) => `- ${c.tickerA} & ${c.tickerB}: ${(c.correlation * 100).toFixed(0)}% correlated over the last 3 months`)
        .join("\n")
    : "(none computed — fewer than two holdings with enough price history)";

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

export async function generateWeeklyTrends(userId: string): Promise<{ skipped: true; reason: string } | { skipped: false; report: WeeklyTrends }> {
  const context = await buildUserContext(userId);

  if (context.holdings.length === 0 && context.watchlist.length === 0 && !context.goal) {
    return { skipped: true, reason: "Connect a brokerage account, add a watchlist ticker, or set your goals first." };
  }

  const client = getGeminiClient();
  const model = getGeminiModel();

  const response = await client.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: buildUserMessage(context) }] }],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseJsonSchema: toJsonSchema(weeklyTrendsSchema),
      thinkingConfig: { thinkingBudget: -1 },
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("No text content in Gemini response");
  }

  const report = weeklyTrendsSchema.parse(JSON.parse(text));
  // Deterministic, not model-trusted — the model can misjudge this from prose alone.
  report.hasBrokerageConnection = context.hasBrokerageConnection;

  await prisma.report.create({
    data: {
      userId,
      type: "WEEKLY_TRENDS",
      schemaVersion: 3,
      content: JSON.stringify(report),
      model,
      inputTokens: response.usageMetadata?.promptTokenCount ?? null,
      outputTokens: response.usageMetadata?.candidatesTokenCount ?? null,
    },
  });

  return { skipped: false, report };
}
