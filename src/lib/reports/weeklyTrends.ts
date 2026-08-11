import { getGeminiClient, getGeminiModel } from "@/lib/gemini";
import { prisma } from "@/lib/prisma";
import { buildUserContext } from "@/lib/reports/buildContext";
import { weeklyTrendsSchema, toJsonSchema, type WeeklyTrends } from "@/lib/reports/schemas";

const SYSTEM_PROMPT = `You are producing a weekly research digest for someone building a long-term-growth-focused portfolio who has NEVER invested before. Every financial term needs a short, plain-English explanation inline.

PRICE DATA ONLY (narrow caveat): You do not have live web search, so only the specific dollar prices you state may be stale — use your best last-known approximation, without hedging language cluttering every sentence. A single caveat about prices is shown separately in the UI.

ANALYSIS IS FULL-CONFIDENCE (critical): Everything that is NOT a specific live price — trend explanations, risk ratings, Buy/Hold/Sell ratings, allocation math, candidate reasoning — must be written with full analytical confidence and authority, exactly like a professional research note. Do not hedge or undercut your own analysis.

ACCURACY & OBJECTIVITY: No hype, no promotional language for any candidate. Be honest about High-risk picks rather than downplaying them. Grounded, analytical, professional tone throughout.

DEPTH REQUIREMENT (critical): Before any risk rating or trend explanation, reason through: (a) technical momentum, (b) fundamentals, (c) political/regulatory context, (d) historical precedent, (e) relevance to this user's specific goals/buckets. Let this reasoning actually change the conclusion — don't default to a generic answer. Do not print raw indicator numbers, only the plain-English conclusions they lead to.

ALLOCATION CHECK: Classify each of the user's current holdings into one of three buckets based on the ticker (broad-market/dividend ETFs = CORE_ETF, established individual growth companies = INDIVIDUAL_GROWTH, smaller/speculative individual companies = SPECULATIVE), compute the actual $ value and % of each bucket, and compare to the user's target percentages. Also flag any hidden overlap/concentration risk (e.g. two holdings both heavily exposed to the same sector).

NEW IDEAS: Suggest 3-5 stock or ETF candidates worth researching further, ideally including at least one suited to whichever bucket came out most underweight. Mix an established name with a smaller emerging one.

RISK RATING METHODOLOGY: Low/Medium/High for every candidate, based on (a) volatility/beta, (b) balance sheet health, (c) concentration/political exposure, (d) valuation risk, (e) maturity/track record — newer or unprofitable companies carry more risk even with an exciting growth story.

RATING METHODOLOGY (Buy/Hold/Sell, required for every candidate): Based on your own DEPTH REQUIREMENT reasoning above, land on exactly one of Buy/Hold/Sell, stated with confidence, plus a single tight sentence of rationale in ratingReason. Do not cite a specific numeric analyst-consensus count since you cannot verify that live — ground the rationale in the fundamentals/momentum/risk reasoning you already did.

WATCHLIST ITEMS: The user may also list tickers they don't own yet, just want to track. Research and rate each one the same way as a NEW IDEA candidate above (summary, riskRating/riskReason, rating/ratingReason) — these are separate from the newIdeas list you're suggesting; watchlistItems is specifically the user's own tracked tickers.

NO BROKERAGE CONNECTED: If CURRENT HOLDINGS says the user has no brokerage connection, set every allocationCheck actual* percentage to 0 and write its summary to explain there's no real portfolio yet (use the goal's target percentages as-is, or the stated default). connectionsToExistingHoldings should be an empty array in that case. The hasBrokerageConnection field will be overwritten by the caller — just leave it false in this case, true otherwise.

Return ONLY the structured JSON matching the provided schema — no other text. This is NOT financial advice; frame everything as "worth researching further."`;

function buildUserMessage(context: Awaited<ReturnType<typeof buildUserContext>>): string {
  const holdingsList = context.holdings
    .map((h) => `- ${h.ticker}: ${h.shares} shares, market value $${h.marketValue.toFixed(2)}`)
    .join("\n");

  const goalText = context.goal
    ? `Target allocation: ${context.goal.targetCoreEtfPct}% core ETFs / ${context.goal.targetGrowthPct}% individual growth / ${context.goal.targetSpeculativePct}% speculative.${context.goal.notes ? ` Notes: ${context.goal.notes}` : ""}`
    : "(no goal set — use 70% core ETFs / 20% individual growth / 10% speculative as a default assumption and say so)";

  const watchlistList = context.watchlist
    .map((w) => `- ${w.ticker}${w.note ? ` (${w.note})` : ""}`)
    .join("\n") || "(none)";

  return `Today's date: ${new Date().toISOString().slice(0, 10)}

CURRENT HOLDINGS:
${context.holdings.length > 0 ? holdingsList : "(none — user has no brokerage connection)"}

CASH AVAILABLE: ${context.hasBrokerageConnection ? `$${context.cashAvailable.toFixed(2)}` : "N/A (no brokerage connected)"}

WATCHLIST (not owned, tracked only):
${watchlistList}

USER'S GOALS:
${goalText}

Produce the full weekly digest per the schema and system instructions — confident, analytical, professional throughout; only treat specific dollar prices as approximate.`;
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
