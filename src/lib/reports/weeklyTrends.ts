import { getAnthropicClient, getAnthropicModel } from "@/lib/anthropic";
import { prisma } from "@/lib/prisma";
import { buildUserContext } from "@/lib/reports/buildContext";
import { weeklyTrendsSchema, toJsonSchema, type WeeklyTrends } from "@/lib/reports/schemas";

const SYSTEM_PROMPT = `You are producing a weekly research digest for someone building a long-term-growth-focused portfolio who has NEVER invested before. Every financial term needs a short, plain-English explanation inline.

SOURCE REQUIREMENT (critical): Only reliable sources — official company sources, Yahoo Finance, Google Finance, Bloomberg, Reuters, CNBC, MarketWatch, WSJ, Barron's, established brokerages, Morningstar, stockanalysis.com. No blogs, unverified SEO sites, forums, or social media. Cross-check figures across sources when possible and note disagreements.

ACCURACY & OBJECTIVITY: No hype, no promotional language for any candidate. Be honest about High-risk picks rather than downplaying them.

DEPTH REQUIREMENT (critical): Before any risk rating or trend explanation, reason through: (a) technical momentum, (b) fundamentals, (c) political/regulatory context, (d) historical precedent, (e) relevance to this user's specific goals/buckets. Let this reasoning actually change the conclusion — don't default to a generic answer. Do not print raw indicator numbers, only the plain-English conclusions they lead to.

ALLOCATION CHECK: Classify each of the user's current holdings into one of three buckets based on the ticker (broad-market/dividend ETFs = CORE_ETF, established individual growth companies = INDIVIDUAL_GROWTH, smaller/speculative individual companies = SPECULATIVE), compute the actual $ value and % of each bucket, and compare to the user's target percentages. Also flag any hidden overlap/concentration risk (e.g. two holdings both heavily exposed to the same sector).

NEW IDEAS: Suggest 3-5 stock or ETF candidates worth researching further, ideally including at least one suited to whichever bucket came out most underweight. Mix an established name with a smaller emerging one.

RISK RATING METHODOLOGY: Low/Medium/High for every candidate, based on (a) volatility/beta, (b) balance sheet health, (c) concentration/political exposure, (d) valuation risk, (e) maturity/track record — newer or unprofitable companies carry more risk even with an exciting growth story.

RATING METHODOLOGY (Buy/Hold/Sell, required for every candidate): Search for the current professional analyst consensus for the ticker from reputable aggregators (Yahoo Finance "Analyst Ratings", TipRanks consensus, Zacks Rank, MarketWatch analyst ratings, WSJ Markets, or Morningstar star rating) — this reflects institutional/accredited-investor opinion. Combine that consensus with your own DEPTH REQUIREMENT reasoning above to land on exactly one of Buy/Hold/Sell, plus a single tight sentence of rationale in ratingReason. If a candidate has thin or no analyst coverage, say so explicitly in ratingReason instead of inventing a consensus. This is a synthesis of public professional opinion for informational purposes, not personalized financial advice.

Return ONLY the structured JSON matching the provided schema — no other text. This is NOT financial advice; frame everything as "worth researching further."`;

function buildUserMessage(context: Awaited<ReturnType<typeof buildUserContext>>): string {
  const holdingsList = context.holdings
    .map((h) => `- ${h.ticker}: ${h.shares} shares, market value $${h.marketValue.toFixed(2)}`)
    .join("\n");

  const goalText = context.goal
    ? `Target allocation: ${context.goal.targetCoreEtfPct}% core ETFs / ${context.goal.targetGrowthPct}% individual growth / ${context.goal.targetSpeculativePct}% speculative.${context.goal.notes ? ` Notes: ${context.goal.notes}` : ""}`
    : "(no goal set — use 70% core ETFs / 20% individual growth / 10% speculative as a default assumption and say so)";

  return `Today's date: ${new Date().toISOString().slice(0, 10)}

CURRENT HOLDINGS:
${holdingsList}

CASH AVAILABLE: $${context.cashAvailable.toFixed(2)}

USER'S GOALS:
${goalText}

Research current market trends and produce the full weekly digest per the schema and system instructions.`;
}

export async function generateWeeklyTrends(userId: string): Promise<{ skipped: true; reason: string } | { skipped: false; report: WeeklyTrends }> {
  const context = await buildUserContext(userId);

  if (context.holdings.length === 0 && !context.goal) {
    return { skipped: true, reason: "Connect a brokerage account or set your goals first." };
  }

  const client = getAnthropicClient();
  const model = getAnthropicModel();

  const response = await client.messages.create({
    model,
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserMessage(context) }],
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 15 }],
    output_config: {
      format: { type: "json_schema", schema: toJsonSchema(weeklyTrendsSchema) },
      effort: "high",
    },
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text content in Anthropic response");
  }

  const report = weeklyTrendsSchema.parse(JSON.parse(textBlock.text));

  await prisma.report.create({
    data: {
      userId,
      type: "WEEKLY_TRENDS",
      schemaVersion: 2,
      content: JSON.stringify(report),
      model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  });

  return { skipped: false, report };
}
