import { getGeminiClient, getGeminiModel } from "@/lib/gemini";
import { prisma } from "@/lib/prisma";
import { buildUserContext } from "@/lib/reports/buildContext";
import { breakingNewsSchema, toJsonSchema, type BreakingNews } from "@/lib/reports/schemas";

const MOVE_THRESHOLD_PCT = 4;
const FRESH_HEADLINE_HOURS = 30;
const FIFTY_TWO_WEEK_PROXIMITY_PCT = 3;

const SYSTEM_PROMPT = `You are a monitor for a user's investment holdings. You do NOT have live web search, so you cannot verify news events on your own — never fabricate a "breaking" headline, a specific date/time, a price move, or any other specific fact you weren't explicitly given below. Every alert must be built entirely from the real, verified data sections given to you (confirmed price moves, real RSS headlines, real SEC filings, real 52-week proximity) — never from outside knowledge or memory of past events. The only place general reasoning belongs is whyItMatters, where you're expected to explain the real-world significance of a real, given fact (e.g. why an 8-K matters, why a move of this size is notable for this holding's risk profile) — reasoning about a real fact is fine, inventing a new fact is not.

CONFIRMED PRICE MOVES: A real, measured price change since the last check, computed from live market data — not something you need to verify.

FRESH REAL HEADLINES: Genuine, recently-published headlines (with publisher, date, and real link) pulled from live RSS feeds for these exact holdings, filtered to ones you haven't already reported before — also not something you need to verify.

FRESH SEC 8-K FILINGS: A company filing an 8-K with the SEC is, by definition, disclosing a material event — this is the most authoritative signal available, official and genuine, filtered to ones not already reported.

52-WEEK HIGH/LOW PROXIMITY: A real, measured signal that a holding's live price is now within a few percent of its 52-week high or low — a genuine technical milestone, not something you need to verify.

For each confirmed move, write one alert: headline states the ticker and the real % move, whatHappened restates the real numbers (do not invent additional facts like an earnings cause unless a fresh headline or 8-K below actually confirms it), whyItMatters gives grounded context for why a move of this size matters given the holding's risk profile.

For each fresh headline that's genuinely material (real business news — earnings, M&A, guidance, executive change, major regulatory action — not routine market commentary or opinion pieces), write one alert: headline is a plain-English restatement of the real headline, whatHappened summarizes only what the headline actually says, whyItMatters gives grounded context for this specific holding, sourceUrls includes the real link given, publishedAt is the real date given. Skip headlines that are just generic commentary/opinion with no real news content.

For each fresh 8-K filing, write one alert: headline notes the ticker filed a material event disclosure with the SEC, whatHappened says an 8-K was filed on the given date (you don't know the specific content unless a headline below also covers it — say so honestly rather than guessing what it's about), whyItMatters explains what an 8-K filing means in plain English and why the user should look at it, sourceUrls includes the real filing link given.

For each 52-week high/low proximity event, write one alert: headline states the ticker and that it's trading near its 52-week high or low with the real price and level given, whatHappened restates the real numbers, whyItMatters gives grounded context (near a high can mean strong momentum but also stretched valuation; near a low can mean a genuine buying opportunity or a warning sign, depending on whether anything else in this alert set explains why).

If all four lists are empty, or the only items are non-material commentary, set hasMaterialEvents to false and return an empty alerts array — that is the correct, expected behavior on most runs, not a failure state.

Return ONLY the structured JSON matching the provided schema — no other text.`;

function buildUserMessage(
  context: Awaited<ReturnType<typeof buildUserContext>>,
  confirmedMoves: Array<{ ticker: string; price: number; priorPrice: number; pctChange: number }>,
  freshHeadlines: Array<{ ticker: string; title: string; source: string; pubDate: string; link: string }>,
  freshFilings: Array<{ ticker: string; description: string; filedAt: string; url: string }>,
  nearFiftyTwoWeek: Array<{ ticker: string; direction: "high" | "low"; price: number; level: number; pct: number }>
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

  const headlinesText =
    freshHeadlines.length > 0
      ? freshHeadlines
          .map(
            (h) =>
              `- [${h.ticker}] "${h.title}" — ${h.source}, ${new Date(h.pubDate).toLocaleString()} — ${h.link}`
          )
          .join("\n")
      : "(none — no fresh unreported headlines for these holdings)";

  const filingsText =
    freshFilings.length > 0
      ? freshFilings.map((f) => `- [${f.ticker}] ${f.description}, filed ${f.filedAt} — ${f.url}`).join("\n")
      : "(none — no fresh unreported SEC filings for these holdings)";

  const fiftyTwoWeekText =
    nearFiftyTwoWeek.length > 0
      ? nearFiftyTwoWeek
          .map(
            (n) =>
              `- ${n.ticker}: now $${n.price.toFixed(2)}, within ${n.pct.toFixed(1)}% of its 52-week ${n.direction} ($${n.level.toFixed(2)})`
          )
          .join("\n")
      : "(none — no holding is newly near its 52-week high/low)";

  return `Current UTC time: ${new Date().toISOString()}

HOLDINGS TO WATCH: ${tickers}

CONFIRMED PRICE MOVES SINCE LAST CHECK:
${movesText}

FRESH REAL HEADLINES SINCE LAST CHECK (within ~${FRESH_HEADLINE_HOURS}h, not previously reported):
${headlinesText}

FRESH SEC 8-K FILINGS SINCE LAST CHECK (not previously reported):
${filingsText}

52-WEEK HIGH/LOW PROXIMITY (newly within ${FIFTY_TWO_WEEK_PROXIMITY_PCT}%, not previously reported this month):
${fiftyTwoWeekText}

Return the structured JSON per the schema and system instructions.`;
}

export async function generateBreakingNews(userId: string): Promise<{ skipped: true; reason: string } | { skipped: false; report: BreakingNews }> {
  const context = await buildUserContext(userId);

  if (context.holdings.length === 0) {
    return { skipped: true, reason: "No holdings connected yet — nothing to watch." };
  }

  // Deterministic move + headline detection: compare today's live prices and
  // real RSS headlines to what was saved with the last report, rather than
  // asking the model to guess whether something "happened."
  const priorReport = await prisma.report.findFirst({
    where: { userId, type: "BREAKING_NEWS" },
    orderBy: { generatedAt: "desc" },
  });
  let priorSnapshot: Record<string, number> = {};
  let priorReportedLinks: string[] = [];
  if (priorReport) {
    try {
      const parsed = JSON.parse(priorReport.content) as {
        priceSnapshot?: Record<string, number>;
        reportedLinks?: string[];
      };
      priorSnapshot = parsed.priceSnapshot ?? {};
      priorReportedLinks = parsed.reportedLinks ?? [];
    } catch {
      priorSnapshot = {};
    }
  }
  const priorReportedLinkSet = new Set(priorReportedLinks);

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

  const holdingTickers = new Set(context.holdings.map((h) => h.ticker));
  const freshCutoff = Date.now() - FRESH_HEADLINE_HOURS * 3600 * 1000;
  const freshHeadlines = context.recentHeadlines
    .filter((a) => a.relatedTicker && holdingTickers.has(a.relatedTicker))
    .filter((a) => !priorReportedLinkSet.has(a.link))
    .filter((a) => new Date(a.pubDate).getTime() >= freshCutoff)
    .map((a) => ({
      ticker: a.relatedTicker as string,
      title: a.title,
      source: a.source,
      pubDate: a.pubDate,
      link: a.link,
    }));

  const filingCutoffDate = new Date(freshCutoff).toISOString().slice(0, 10);
  const freshFilings = context.materialFilings
    .filter((f) => f.formType === "8-K")
    .filter((f) => !priorReportedLinkSet.has(f.url))
    .filter((f) => f.filedAt >= filingCutoffDate);

  // Dedup key includes the calendar month so a holding hovering near its
  // 52-week line doesn't re-trigger an alert on every single check.
  const monthBucket = new Date().toISOString().slice(0, 7);
  const nearFiftyTwoWeek: Array<{
    ticker: string;
    direction: "high" | "low";
    price: number;
    level: number;
    pct: number;
    key: string;
  }> = [];
  for (const h of context.holdings) {
    if (!h.livePrice?.fiftyTwoWeekHigh || !h.livePrice?.fiftyTwoWeekLow) continue;
    const { price, fiftyTwoWeekHigh, fiftyTwoWeekLow } = h.livePrice;
    const pctFromHigh = ((fiftyTwoWeekHigh - price) / fiftyTwoWeekHigh) * 100;
    const pctFromLow = ((price - fiftyTwoWeekLow) / fiftyTwoWeekLow) * 100;
    const highKey = `52wk-high:${h.ticker}:${monthBucket}`;
    const lowKey = `52wk-low:${h.ticker}:${monthBucket}`;
    if (pctFromHigh >= 0 && pctFromHigh <= FIFTY_TWO_WEEK_PROXIMITY_PCT && !priorReportedLinkSet.has(highKey)) {
      nearFiftyTwoWeek.push({ ticker: h.ticker, direction: "high", price, level: fiftyTwoWeekHigh, pct: pctFromHigh, key: highKey });
    }
    if (pctFromLow >= 0 && pctFromLow <= FIFTY_TWO_WEEK_PROXIMITY_PCT && !priorReportedLinkSet.has(lowKey)) {
      nearFiftyTwoWeek.push({ ticker: h.ticker, direction: "low", price, level: fiftyTwoWeekLow, pct: pctFromLow, key: lowKey });
    }
  }

  const client = getGeminiClient();
  const model = getGeminiModel();

  const response = await client.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [{ text: buildUserMessage(context, confirmedMoves, freshHeadlines, freshFilings, nearFiftyTwoWeek) }],
      },
    ],
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
  // Deterministic, not model-trusted — hasMaterialEvents follows the real detected signals.
  report.hasMaterialEvents =
    confirmedMoves.length > 0 || freshHeadlines.length > 0 || freshFilings.length > 0 || nearFiftyTwoWeek.length > 0;

  // Track every fresh headline/filing/52-week event we surfaced this run
  // (whether or not the model judged it material) so it's never re-considered next check.
  const newReportedLinks = [
    ...priorReportedLinkSet,
    ...freshHeadlines.map((h) => h.link),
    ...freshFilings.map((f) => f.url),
    ...nearFiftyTwoWeek.map((n) => n.key),
  ].slice(-200);

  await prisma.report.create({
    data: {
      userId,
      type: "BREAKING_NEWS",
      schemaVersion: 1,
      content: JSON.stringify({ ...report, priceSnapshot: newSnapshot, reportedLinks: newReportedLinks }),
      hasMaterialEvents: report.hasMaterialEvents,
      model,
      inputTokens: response.usageMetadata?.promptTokenCount ?? null,
      outputTokens: response.usageMetadata?.candidatesTokenCount ?? null,
    },
  });

  return { skipped: false, report };
}
