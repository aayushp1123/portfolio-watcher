import { getGeminiClient, getGeminiModel } from "@/lib/gemini";
import { prisma } from "@/lib/prisma";
import { buildUserContext } from "@/lib/reports/buildContext";
import { breakingNewsSchema, toJsonSchema, type BreakingNews } from "@/lib/reports/schemas";

const MOVE_THRESHOLD_PCT = 4;

const SYSTEM_PROMPT = `You are a monitor for a user's investment holdings. You do NOT have live web search, so you cannot verify news events — never fabricate a "breaking" headline, a specific date/time, or a price move you weren't explicitly given.

CONFIRMED PRICE MOVES: Below, you may be given a list of CONFIRMED PRICE MOVES — these are real, measured price changes since the last check, computed from live market data, not something you need to verify. If the list is non-empty, write exactly one alert per confirmed move: headline states the ticker and the real % move given, whatHappened restates the real numbers given (do not invent additional facts like earnings or news causes unless you are highly confident they're real and well-known), whyItMatters gives grounded context for why a move of this size matters for this holding given its risk profile, and set hasMaterialEvents to true. If the CONFIRMED PRICE MOVES list is empty, set hasMaterialEvents to false and return an empty alerts array — that is the correct, expected behavior on most runs, not a failure state.

Return ONLY the structured JSON matching the provided schema — no other text.`;

function buildUserMessage(
  context: Awaited<ReturnType<typeof buildUserContext>>,
  confirmedMoves: Array<{ ticker: string; price: number; priorPrice: number; pctChange: number }>
): string {
  const tickers = context.holdings.map((h) => h.ticker).join(", ") || "(no holdings connected yet)";

  const movesText =
    confirmedMoves.length > 0
      ? confirmedMoves
          .map(
            (m) =>
              `- ${m.ticker}: ${m.pctChange >= 0 ? "+" : ""}${m.pctChange.toFixed(1)}% (from $${m.priorPrice.toFixed(2)} to $${m.price.toFixed(2)})`
          )
          .join("\n")
      : "(none — no holding has moved enough since the last check)";

  return `Current UTC time: ${new Date().toISOString()}

HOLDINGS TO WATCH: ${tickers}

CONFIRMED PRICE MOVES SINCE LAST CHECK:
${movesText}

Return the structured JSON per the schema and system instructions.`;
}

export async function generateBreakingNews(userId: string): Promise<{ skipped: true; reason: string } | { skipped: false; report: BreakingNews }> {
  const context = await buildUserContext(userId);

  if (context.holdings.length === 0) {
    return { skipped: true, reason: "No holdings connected yet — nothing to watch." };
  }

  // Deterministic move detection: compare today's live prices to the snapshot
  // saved with the last Breaking News report for this user, rather than
  // asking the model to guess whether something "happened."
  const priorReport = await prisma.report.findFirst({
    where: { userId, type: "BREAKING_NEWS" },
    orderBy: { generatedAt: "desc" },
  });
  let priorSnapshot: Record<string, number> = {};
  if (priorReport) {
    try {
      const parsed = JSON.parse(priorReport.content) as { priceSnapshot?: Record<string, number> };
      priorSnapshot = parsed.priceSnapshot ?? {};
    } catch {
      priorSnapshot = {};
    }
  }

  const confirmedMoves: Array<{ ticker: string; price: number; priorPrice: number; pctChange: number }> = [];
  const newSnapshot: Record<string, number> = {};

  for (const h of context.holdings) {
    if (!h.livePrice) continue;
    newSnapshot[h.ticker] = h.livePrice.price;
    const prior = priorSnapshot[h.ticker];
    if (prior == null || prior === 0) continue;
    const pctChange = ((h.livePrice.price - prior) / prior) * 100;
    if (Math.abs(pctChange) >= MOVE_THRESHOLD_PCT) {
      confirmedMoves.push({ ticker: h.ticker, price: h.livePrice.price, priorPrice: prior, pctChange });
    }
  }

  const client = getGeminiClient();
  const model = getGeminiModel();

  const response = await client.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: buildUserMessage(context, confirmedMoves) }] }],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseJsonSchema: toJsonSchema(breakingNewsSchema),
      thinkingConfig: { thinkingBudget: -1 },
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("No text content in Gemini response");
  }

  const report = breakingNewsSchema.parse(JSON.parse(text));
  // Deterministic, not model-trusted — hasMaterialEvents follows the real detected moves.
  report.hasMaterialEvents = confirmedMoves.length > 0;

  await prisma.report.create({
    data: {
      userId,
      type: "BREAKING_NEWS",
      schemaVersion: 1,
      content: JSON.stringify({ ...report, priceSnapshot: newSnapshot }),
      hasMaterialEvents: report.hasMaterialEvents,
      model,
      inputTokens: response.usageMetadata?.promptTokenCount ?? null,
      outputTokens: response.usageMetadata?.candidatesTokenCount ?? null,
    },
  });

  return { skipped: false, report };
}
