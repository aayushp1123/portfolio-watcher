import { getGeminiClient, getGeminiModel } from "@/lib/gemini";
import { prisma } from "@/lib/prisma";
import { buildUserContext } from "@/lib/reports/buildContext";
import { dailyDigestSchema, toJsonSchema, type DailyDigest } from "@/lib/reports/schemas";

const SYSTEM_PROMPT = `You are producing a daily portfolio digest for someone who has NEVER invested before. Every financial term needs a short, plain-English explanation inline — never assume prior investing knowledge.

SOURCE REQUIREMENT (critical): Only pull facts, prices, and news from reliable, reputable sources — official company sources (investor relations, SEC filings, press releases), major financial data/news providers (Yahoo Finance, Google Finance, Bloomberg, Reuters, CNBC, MarketWatch, WSJ, Barron's, AP), established brokerages (Schwab, Robinhood, Fidelity), and established data sites (Morningstar, stockanalysis.com). Do NOT use blogs, unverified SEO sites, forums, or social media. Cross-check figures across sources when possible and note disagreements rather than silently picking one.

ACCURACY & OBJECTIVITY: No hype, no promotional or fear-based language. Explicit "not financial advice" framing. If unsure of a number or claim, say so explicitly rather than presenting it as certain.

DEPTH REQUIREMENT (critical): Before writing any risk rating or bottom line, actually reason through: (a) technical momentum, (b) fundamentals/balance sheet health, (c) political/regulatory context relevant to that holding's sector, (d) historical precedent for similar situations, (e) relevance to this specific user's exit rules and goals. Let this reasoning change the conclusion when warranted — do not default to a generic "Medium, seems fine" answer. Do not print raw indicator numbers (RSI values, etc) — only the plain-English conclusion they lead to.

RISK RATING METHODOLOGY: Low/Medium/High for every holding, based on (a) volatility/beta, (b) balance sheet health, (c) concentration/political exposure, (d) valuation risk. For ETFs, factor in diversification but still flag sector concentration.

RATING METHODOLOGY (Buy/Hold/Sell, required for every holding): Search for the current professional analyst consensus for the ticker from reputable aggregators (Yahoo Finance "Analyst Ratings", TipRanks consensus, Zacks Rank, MarketWatch analyst ratings, WSJ Markets, or Morningstar star rating) — this reflects institutional/accredited-investor opinion. Combine that consensus with your own DEPTH REQUIREMENT reasoning above and this user's specific exit rules and cost basis to land on exactly one of Buy/Hold/Sell, plus a single tight sentence of rationale in ratingReason (e.g. "Street consensus is 8 Buy/2 Hold, and it's still ~30% below its trailing-stop trigger."). If analyst consensus and your own read genuinely conflict, say so briefly in ratingReason rather than silently picking one. This is a synthesis of public professional opinion for informational purposes, not personalized financial advice.

EXIT RULES: For each holding with an active exit rule, determine its status:
- PRICE_TARGET: status is "triggered" if current price >= target value, "approaching" if within 5%, else "ok".
- TRAILING_STOP_PCT: find the holding's approximate highest price since it was likely acquired (use available price history), compute the stop level as (value)% below that peak; "triggered" if current price is at/below the stop, "approaching" if within 5% of it, else "ok".
- STOP_LOSS_PRICE: "triggered" if current price <= value, "approaching" if within 5% above it, else "ok".
Holdings with no active exit rule get exitRuleStatus: null (status "none").

TAX NOTES: For any holding currently at an unrealized loss (market value below cost basis), include a taxNote mentioning the wash-sale rule in one plain sentence (selling at a loss and rebuying within 30 days disallows the tax deduction) and that tax-loss harvesting is a legitimate strategy some investors use. For holdings at a gain or with no cost basis data, taxNote should be null.

WATCHLIST ITEMS: The user may also list tickers they don't own yet, just want to track. For each one, research its current price and a short plain-English summary of what it does and anything notable today, plus the same riskRating/riskReason and rating/ratingReason treatment as a holding (same methodology above). Watchlist items have no shares, cost basis, exit rule, or tax note — omit those concepts entirely for them.

NO BROKERAGE CONNECTED: If the HOLDINGS section says the user has no brokerage connection, set totalValue to 0, overallGainLossPct and cashAvailable to null, holdings to an empty array, and dividendNotes to an empty array — do not invent placeholder position data. Write portfolioSummary and bottomLine to reflect that this is a watchlist-only digest (no owned positions yet), not a portfolio recap. The hasBrokerageConnection field will be overwritten by the caller — just leave it false in this case, true otherwise.

Return ONLY the structured JSON matching the provided schema — no other text.`;

function buildUserMessage(context: Awaited<ReturnType<typeof buildUserContext>>): string {
  const holdingsList = context.holdings
    .map((h) => `- ${h.ticker} (${h.name}): ${h.shares} shares, market value $${h.marketValue.toFixed(2)}, cost basis ${h.costBasis != null ? `$${h.costBasis.toFixed(2)}` : "unknown"}`)
    .join("\n");

  const exitRulesList = context.exitRules
    .map((r) => `- ${r.ticker}: ${r.ruleType} = ${r.value}${r.note ? ` (${r.note})` : ""}`)
    .join("\n") || "(none set)";

  const goalText = context.goal
    ? `Target allocation: ${context.goal.targetCoreEtfPct}% core ETFs / ${context.goal.targetGrowthPct}% individual growth / ${context.goal.targetSpeculativePct}% speculative.${context.goal.notes ? ` Notes: ${context.goal.notes}` : ""}`
    : "(no goal set yet)";

  const watchlistList = context.watchlist
    .map((w) => `- ${w.ticker}${w.note ? ` (${w.note})` : ""}`)
    .join("\n") || "(none)";

  return `Today's date: ${new Date().toISOString().slice(0, 10)}

HOLDINGS:
${context.holdings.length > 0 ? holdingsList : "(none — user has no brokerage connection)"}

CASH AVAILABLE: ${context.hasBrokerageConnection ? `$${context.cashAvailable.toFixed(2)}` : "N/A (no brokerage connected)"}

ACTIVE EXIT RULES:
${exitRulesList}

WATCHLIST (not owned, tracked only):
${watchlistList}

USER'S GOALS:
${goalText}

Research each holding's and watchlist ticker's current price and any material news using web search, then produce the full daily digest per the schema and system instructions.`;
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
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseJsonSchema: toJsonSchema(dailyDigestSchema),
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
