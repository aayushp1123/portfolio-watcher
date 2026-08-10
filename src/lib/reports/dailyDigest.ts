import { getAnthropicClient, getAnthropicModel } from "@/lib/anthropic";
import { prisma } from "@/lib/prisma";
import { buildUserContext } from "@/lib/reports/buildContext";
import { dailyDigestSchema, toJsonSchema, type DailyDigest } from "@/lib/reports/schemas";

const SYSTEM_PROMPT = `You are producing a daily portfolio digest for someone who has NEVER invested before. Every financial term needs a short, plain-English explanation inline — never assume prior investing knowledge.

SOURCE REQUIREMENT (critical): Only pull facts, prices, and news from reliable, reputable sources — official company sources (investor relations, SEC filings, press releases), major financial data/news providers (Yahoo Finance, Google Finance, Bloomberg, Reuters, CNBC, MarketWatch, WSJ, Barron's, AP), established brokerages (Schwab, Robinhood, Fidelity), and established data sites (Morningstar, stockanalysis.com). Do NOT use blogs, unverified SEO sites, forums, or social media. Cross-check figures across sources when possible and note disagreements rather than silently picking one.

ACCURACY & OBJECTIVITY: No hype, no promotional or fear-based language. Explicit "not financial advice" framing. If unsure of a number or claim, say so explicitly rather than presenting it as certain.

DEPTH REQUIREMENT (critical): Before writing any risk rating or bottom line, actually reason through: (a) technical momentum, (b) fundamentals/balance sheet health, (c) political/regulatory context relevant to that holding's sector, (d) historical precedent for similar situations, (e) relevance to this specific user's exit rules and goals. Let this reasoning change the conclusion when warranted — do not default to a generic "Medium, seems fine" answer. Do not print raw indicator numbers (RSI values, etc) — only the plain-English conclusion they lead to.

RISK RATING METHODOLOGY: Low/Medium/High for every holding, based on (a) volatility/beta, (b) balance sheet health, (c) concentration/political exposure, (d) valuation risk. For ETFs, factor in diversification but still flag sector concentration.

EXIT RULES: For each holding with an active exit rule, determine its status:
- PRICE_TARGET: status is "triggered" if current price >= target value, "approaching" if within 5%, else "ok".
- TRAILING_STOP_PCT: find the holding's approximate highest price since it was likely acquired (use available price history), compute the stop level as (value)% below that peak; "triggered" if current price is at/below the stop, "approaching" if within 5% of it, else "ok".
- STOP_LOSS_PRICE: "triggered" if current price <= value, "approaching" if within 5% above it, else "ok".
Holdings with no active exit rule get exitRuleStatus: null (status "none").

TAX NOTES: For any holding currently at an unrealized loss (market value below cost basis), include a taxNote mentioning the wash-sale rule in one plain sentence (selling at a loss and rebuying within 30 days disallows the tax deduction) and that tax-loss harvesting is a legitimate strategy some investors use. For holdings at a gain or with no cost basis data, taxNote should be null.

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

  return `Today's date: ${new Date().toISOString().slice(0, 10)}

HOLDINGS:
${holdingsList}

CASH AVAILABLE: $${context.cashAvailable.toFixed(2)}

ACTIVE EXIT RULES:
${exitRulesList}

USER'S GOALS:
${goalText}

Research each holding's current price and any material news using web search, then produce the full daily digest per the schema and system instructions.`;
}

export async function generateDailyDigest(userId: string): Promise<{ skipped: true; reason: string } | { skipped: false; report: DailyDigest }> {
  const context = await buildUserContext(userId);

  if (context.holdings.length === 0) {
    return { skipped: true, reason: "No holdings connected yet — nothing to research." };
  }

  const client = getAnthropicClient();
  const model = getAnthropicModel();

  const response = await client.messages.create({
    model,
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserMessage(context) }],
    tools: [
      {
        type: "web_search_20260209",
        name: "web_search",
        max_uses: 15,
      },
    ],
    output_config: {
      format: { type: "json_schema", schema: toJsonSchema(dailyDigestSchema) },
      effort: "high",
    },
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text content in Anthropic response");
  }

  const parsedJson = JSON.parse(textBlock.text);
  const report = dailyDigestSchema.parse(parsedJson);

  await prisma.report.create({
    data: {
      userId,
      type: "DAILY_DIGEST",
      schemaVersion: 1,
      content: JSON.stringify(report),
      model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  });

  return { skipped: false, report };
}
