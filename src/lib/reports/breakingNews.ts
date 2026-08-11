import { getGeminiClient, getGeminiModel } from "@/lib/gemini";
import { prisma } from "@/lib/prisma";
import { buildUserContext } from "@/lib/reports/buildContext";
import { breakingNewsSchema, toJsonSchema, type BreakingNews } from "@/lib/reports/schemas";

const SYSTEM_PROMPT = `You are a once-daily monitor for a user's investment holdings, checking what's changed since the prior day — NOT a full recap. The user has NEVER invested before, so any alert needs plain-English explanations.

CRITICAL FRESHNESS RULE: Only report something as material if it is genuinely fresh (published/updated within roughly the last 24-30 hours, since this runs once per day) and hasn't already been reported in a prior check (see PRIOR ALERTS below — do not repeat those unless there is a genuine new development). Do not re-flag something just because it's still true or important.

SOURCE REQUIREMENT: Only reliable sources — official company sources, Yahoo Finance, Google Finance, Bloomberg, Reuters, CNBC, MarketWatch, WSJ, Barron's, AP, established brokerages, Morningstar, stockanalysis.com. No blogs, forums, or social media. Only report something as material if verifiable from a credible source.

ACCURACY & OBJECTIVITY: No hype, alarmist, or promotional language — describe neutrally with actual facts. Do not editorialize beyond what the data shows.

Check for genuinely MATERIAL, FRESH, VERIFIABLE developments only: (1) holdings making a sharp recent move (roughly >5%) or hitting real confirmed news (earnings surprise, M&A, executive change, lawsuit, major regulatory action, guidance change), (2) major market-moving news (Fed decisions, macro data, major geopolitical events), (3) major verified breaking news relevant to the user's holdings' sectors.

If nothing material and fresh happened, set hasMaterialEvents to false and return an empty alerts array — most runs should look like this. If something IS material, reason through technical momentum + fundamentals + political context + historical precedent before writing whyItMatters, so it's a distilled conclusion, not a rephrased headline.

Return ONLY the structured JSON matching the provided schema — no other text. This is context, not financial advice.`;

function buildUserMessage(
  context: Awaited<ReturnType<typeof buildUserContext>>,
  priorAlerts: string[]
): string {
  const tickers = context.holdings.map((h) => h.ticker).join(", ") || "(no holdings connected yet)";

  return `Current UTC time: ${new Date().toISOString()}

HOLDINGS TO WATCH: ${tickers}

PRIOR ALERTS ALREADY REPORTED (do not repeat these unless there's a genuine new development):
${priorAlerts.length > 0 ? priorAlerts.map((a) => `- ${a}`).join("\n") : "(none yet)"}

Check for material, fresh developments now.`;
}

export async function generateBreakingNews(userId: string): Promise<{ skipped: true; reason: string } | { skipped: false; report: BreakingNews }> {
  const context = await buildUserContext(userId);

  if (context.holdings.length === 0) {
    return { skipped: true, reason: "No holdings connected yet — nothing to watch." };
  }

  const recentReports = await prisma.report.findMany({
    where: { userId, type: "BREAKING_NEWS", hasMaterialEvents: true },
    orderBy: { generatedAt: "desc" },
    take: 3,
  });
  const priorAlerts = recentReports.flatMap((r) => {
    try {
      const parsed = JSON.parse(r.content) as BreakingNews;
      return parsed.alerts.map((a) => `${a.ticker ?? "Market"}: ${a.headline}`);
    } catch {
      return [];
    }
  });

  const client = getGeminiClient();
  const model = getGeminiModel();

  const response = await client.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: buildUserMessage(context, priorAlerts) }] }],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      tools: [{ googleSearch: {} }],
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
