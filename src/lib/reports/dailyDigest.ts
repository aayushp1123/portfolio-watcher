import { getGeminiClient, getGeminiModel } from "@/lib/gemini";
import { prisma } from "@/lib/prisma";
import { buildUserContext } from "@/lib/reports/buildContext";
import { dailyDigestSchema, toJsonSchema, type DailyDigest } from "@/lib/reports/schemas";

const SYSTEM_PROMPT = `You are producing a daily portfolio digest for someone who has NEVER invested before. Every financial term needs a short, plain-English explanation inline — never assume prior investing knowledge.

LIVE PRICES: Each holding and watchlist ticker below includes a LIVE PRICE fetched moments ago from a real market data source when available — treat that number as ground truth, use it directly and confidently, no hedging. Only if a ticker has no live price available should you fall back to your best general knowledge and note it's approximate — that is the rare case, not the default.

RECENT REAL HEADLINES: You may be given a list of REAL, recently-published headlines (with publisher and date) pulled from live RSS feeds for these exact tickers — these are genuine, verifiable, not something you need to caveat. Weave relevant ones into portfolioSummary, individual holdings' riskReason/ratingReason, dividendNotes, bottomLine, and especially whatToWatchNext wherever they're actually relevant — this is real, current information you wouldn't otherwise have. Do not reference a headline that isn't in the list, and don't force one in in if none of them are relevant to a given holding.

ANALYSIS IS FULL-CONFIDENCE (critical): Risk ratings, Buy/Hold/Sell ratings, reasoning, exit-rule logic, allocation math, portfolio summary, bottom line — all written with full analytical confidence and authority, exactly like a professional research note. Do not hedge, apologize, or undercut your own analysis.

ACCURACY & OBJECTIVITY: No hype, no promotional or fear-based language. Grounded, analytical, professional tone only — never casual or uncertain-sounding. Explicit "not financial advice" framing only where noted in the schema, not sprinkled throughout.

DEPTH REQUIREMENT (critical): Before writing any risk rating or bottom line, actually reason through: (a) technical momentum — use the REAL computed MOMENTUM figures given (1-month/3-month % change, position vs. 20/50-day averages) as ground truth, not a guess, (b) fundamentals/balance sheet health, (c) political/regulatory context relevant to that holding's sector, (d) historical precedent for similar situations, (e) relevance to this specific user's exit rules and goals. Let this reasoning change the conclusion when warranted — do not default to a generic "Medium, seems fine" answer. Do not print raw indicator numbers (RSI values, etc) — only the plain-English conclusion they lead to.

SEC FILINGS & INSIDER ACTIVITY: You may be given real, recent SEC filings (8-K material events, 10-Q/10-K reports) and insider transactions (Form 4 buys/sells by executives, Form 144 proposed sales) for these tickers — official government data, genuine and verifiable. A recent 8-K is a real material event; weave it into that holding's context. Notable insider buying/selling (especially by multiple insiders, or unusually large) is a real signal worth mentioning. Don't force these in if not relevant, and never invent a filing that isn't listed.

MACRO CONTEXT: If a current federal funds rate, inflation (CPI), and unemployment rate are provided, treat them as real, current, and confidently usable in reasoning about rate-sensitive holdings — do not caveat these numbers.

EXAMPLE OF EXPECTED TONE AND DEPTH (for calibration only, not real data — do not reuse these numbers or this ticker):
"NVDA — $224.50 (live). riskReason: 'Concentrated in a single fast-moving sector (AI infrastructure semiconductors); a leader with a dominant market position, but the stock's valuation already prices in years of growth, so any slowdown in AI capex would hit it disproportionately compared to a diversified fund.' ratingReason: 'Buy — durable competitive moat in AI accelerators and expanding data-center demand outweigh near-term valuation risk for a long-term holder.'"
That is the bar: specific, structural reasoning tied to the actual business — not a vague "seems fine" or a generic disclaimer.

RISK RATING METHODOLOGY: Low/Medium/High for every holding, based on (a) volatility/beta, (b) balance sheet health, (c) concentration/political exposure, (d) valuation risk. For ETFs, factor in diversification but still flag sector concentration.

RATING METHODOLOGY (Buy/Hold/Sell, required for every holding): Based on your knowledge of the company/fund and your own DEPTH REQUIREMENT reasoning above plus this user's specific exit rules and cost basis, land on exactly one of Buy/Hold/Sell, stated with confidence, plus a single tight sentence of rationale in ratingReason. Do not cite a specific numeric analyst-consensus count (e.g. "8 Buy/2 Hold") since you cannot verify that live — instead ground the rationale in the fundamentals/momentum/risk reasoning you already did.

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

function buildUserMessage(context: Awaited<ReturnType<typeof buildUserContext>>): string {
  const holdingsList = context.holdings
    .map((h) => {
      const priceInfo = h.livePrice
        ? `LIVE PRICE $${h.livePrice.price.toFixed(2)}${h.livePrice.fiftyTwoWeekHigh != null ? ` (52-wk high $${h.livePrice.fiftyTwoWeekHigh.toFixed(2)}, low $${h.livePrice.fiftyTwoWeekLow?.toFixed(2)})` : ""}`
        : "no live price available";
      return `- ${h.ticker} (${h.name}): ${h.shares} shares, market value $${h.marketValue.toFixed(2)}, cost basis ${h.costBasis != null ? `$${h.costBasis.toFixed(2)}` : "unknown"}, ${priceInfo}. ${formatMomentum(h.momentum)}`;
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
      return `- ${w.ticker}${w.note ? ` (${w.note})` : ""}, ${priceInfo}. ${formatMomentum(w.momentum)}`;
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

  const macroText = context.macro
    ? `Fed funds rate: ${context.macro.fedFundsRate}% (as of ${context.macro.fedFundsDate}). CPI inflation (YoY): ${context.macro.cpiYoyPct?.toFixed(1)}%. Unemployment: ${context.macro.unemploymentRate}% (as of ${context.macro.unemploymentDate}).`
    : "(not configured — reason from general knowledge if macro context is relevant)";

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

CURRENT MACRO CONTEXT:
${macroText}

USER'S GOALS:
${goalText}

Produce the full daily digest per the schema and system instructions — confident, analytical, professional throughout, using the live prices provided as ground truth.`;
}

export async function generateDailyDigest(userId: string): Promise<{ skipped: true; reason: string } | { skipped: false; report: DailyDigest }> {
  const context = await buildUserContext(userId);

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
