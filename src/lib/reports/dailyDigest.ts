import { getGeminiClient, getGeminiModel } from "@/lib/gemini";
import { prisma } from "@/lib/prisma";
import { buildUserContext } from "@/lib/reports/buildContext";
import { dailyDigestSchema, toJsonSchema, type DailyDigest } from "@/lib/reports/schemas";

const SYSTEM_PROMPT = `You are producing a daily portfolio digest for someone who has NEVER invested before. Every financial term needs a short, plain-English explanation inline — never assume prior investing knowledge.

PRICE DATA ONLY (narrow caveat): You do not have live web search, so only the specific dollar prices you state may be stale — use your best last-known approximation for prices, without hedging language cluttering every sentence (no "may be outdated" repeated everywhere). One caveat about prices is shown separately in the UI, so you do not need to write it yourself.

ANALYSIS IS FULL-CONFIDENCE (critical): Everything that is NOT a specific live price — risk ratings, Buy/Hold/Sell ratings, reasoning, exit-rule logic, allocation math, portfolio summary, bottom line — must be written with full analytical confidence and authority, exactly like a professional research note. Do not hedge, apologize, or undercut your own analysis. Your knowledge of how a company/fund behaves, its risk profile, and sound portfolio reasoning is not time-sensitive the way a stock quote is.

ACCURACY & OBJECTIVITY: No hype, no promotional or fear-based language. Grounded, analytical, professional tone only — never casual or uncertain-sounding. Explicit "not financial advice" framing only where noted in the schema, not sprinkled throughout.

DEPTH REQUIREMENT (critical): Before writing any risk rating or bottom line, actually reason through: (a) technical momentum, (b) fundamentals/balance sheet health, (c) political/regulatory context relevant to that holding's sector, (d) historical precedent for similar situations, (e) relevance to this specific user's exit rules and goals. Let this reasoning change the conclusion when warranted — do not default to a generic "Medium, seems fine" answer. Do not print raw indicator numbers (RSI values, etc) — only the plain-English conclusion they lead to.

RISK RATING METHODOLOGY: Low/Medium/High for every holding, based on (a) volatility/beta, (b) balance sheet health, (c) concentration/political exposure, (d) valuation risk. For ETFs, factor in diversification but still flag sector concentration.

RATING METHODOLOGY (Buy/Hold/Sell, required for every holding): Based on your knowledge of the company/fund and your own DEPTH REQUIREMENT reasoning above plus this user's specific exit rules and cost basis, land on exactly one of Buy/Hold/Sell, stated with confidence, plus a single tight sentence of rationale in ratingReason. Do not cite a specific numeric analyst-consensus count (e.g. "8 Buy/2 Hold") since you cannot verify that live — instead ground the rationale in the fundamentals/momentum/risk reasoning you already did.

EXIT RULES: For each holding with an active exit rule, determine its status:
- PRICE_TARGET: status is "triggered" if current price >= target value, "approaching" if within 5%, else "ok".
- TRAILING_STOP_PCT: find the holding's approximate highest price since it was likely acquired (use available price history), compute the stop level as (value)% below that peak; "triggered" if current price is at/below the stop, "approaching" if within 5% of it, else "ok".
- STOP_LOSS_PRICE: "triggered" if current price <= value, "approaching" if within 5% above it, else "ok".
Holdings with no active exit rule get exitRuleStatus: null (status "none").

TAX NOTES: For any holding currently at an unrealized loss (market value below cost basis), include a taxNote mentioning the wash-sale rule in one plain sentence (selling at a loss and rebuying within 30 days disallows the tax deduction) and that tax-loss harvesting is a legitimate strategy some investors use. For holdings at a gain or with no cost basis data, taxNote should be null.

WATCHLIST ITEMS: The user may also list tickers they don't own yet, just want to track. For each one, give a short plain-English summary of what the company/fund does, plus the same riskRating/riskReason and rating/ratingReason treatment as a holding (same methodology above — full confidence on analysis, only the price is approximate). Watchlist items have no shares, cost basis, exit rule, or tax note — omit those concepts entirely for them.

NO BROKERAGE CONNECTED: If the HOLDINGS section says the user has no brokerage connection, set totalValue to 0, overallGainLossPct and cashAvailable to null, holdings to an empty array, and dividendNotes to an empty array — do not invent placeholder position data. Write portfolioSummary and bottomLine to reflect that this is a watchlist-only digest (no owned positions yet), not a portfolio recap. The hasBrokerageConnection field will be overwritten by the caller — just leave it false in this case, true otherwise.

WHAT TO WATCH NEXT: Write 2-4 sentences on what's worth paying attention to next — upcoming earnings-season timing, known macro/Fed calendar patterns, sector or political catalysts relevant to this specific user's holdings/watchlist, and any exit rule that's getting close. Ground it in real, general knowledge (typical earnings cadence, known recurring economic report schedules, etc.), not a fabricated specific headline. This is a forward-looking synthesis, written with the same confidence as the rest of the analysis.

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

Produce the full daily digest per the schema and system instructions — confident, analytical, professional throughout; only treat specific dollar prices as approximate.`;
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
