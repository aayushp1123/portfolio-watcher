import { getGeminiClient, getGeminiModel } from "@/lib/gemini";
import { prisma } from "@/lib/prisma";
import { buildUserContext } from "@/lib/reports/buildContext";
import { breakingNewsSchema, toJsonSchema, type BreakingNews } from "@/lib/reports/schemas";

const SYSTEM_PROMPT = `You are a once-daily monitor for a user's investment holdings. You do NOT have live web search, so you cannot verify whether anything genuinely fresh happened in the last 24-30 hours — never fabricate a "breaking" event, a specific date/time, or a price move you cannot actually confirm. Set hasMaterialEvents to false and return an empty alerts array every time, unless the user's holdings context itself flags something you can state with genuine confidence (this should be rare to never) — do not invent verifiable-sounding news to fill space. This is the honest, correct behavior here, not a failure state.

Return ONLY the structured JSON matching the provided schema — no other text.`;

function buildUserMessage(context: Awaited<ReturnType<typeof buildUserContext>>): string {
  const tickers = context.holdings.map((h) => h.ticker).join(", ") || "(no holdings connected yet)";

  return `Current UTC time: ${new Date().toISOString()}

HOLDINGS TO WATCH: ${tickers}

Return the structured JSON per the schema and system instructions.`;
}

export async function generateBreakingNews(userId: string): Promise<{ skipped: true; reason: string } | { skipped: false; report: BreakingNews }> {
  const context = await buildUserContext(userId);

  if (context.holdings.length === 0) {
    return { skipped: true, reason: "No holdings connected yet — nothing to watch." };
  }

  const client = getGeminiClient();
  const model = getGeminiModel();

  const response = await client.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: buildUserMessage(context) }] }],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseJsonSchema: toJsonSchema(breakingNewsSchema),
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("No text content in Gemini response");
  }

  const report = breakingNewsSchema.parse(JSON.parse(text));

  await prisma.report.create({
    data: {
      userId,
      type: "BREAKING_NEWS",
      schemaVersion: 1,
      content: JSON.stringify(report),
      hasMaterialEvents: report.hasMaterialEvents,
      model,
      inputTokens: response.usageMetadata?.promptTokenCount ?? null,
      outputTokens: response.usageMetadata?.candidatesTokenCount ?? null,
    },
  });

  return { skipped: false, report };
}
