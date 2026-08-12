import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getQuote, getMomentum, getHistoricalSeries, getHistoricalOHLC, getQuotes } from "@/lib/quotes";
import { getCongressTrades } from "@/lib/congressTrading";
import { getSector } from "@/lib/sectors";
import { getParsedHoldings } from "@/lib/holdings";
import { computeFitScore, type FitScoreResult } from "@/lib/fitScore";
import type { DailyDigest, WeeklyTrends } from "@/lib/reports/schemas";

type BucketFit = "underweight" | "overweight" | "neutral" | "unknown";

/** Coarse, deterministic 2-bucket classification (ETF vs. individual stock)
 * -- a reliable 3-way core/growth/speculative split would need fundamentals
 * data this app doesn't have a free source for, so this stays honest about
 * what it can actually tell from the sector map alone. */
function classifyBucket(ticker: string): "CORE_ETF" | "INDIVIDUAL" {
  return getSector(ticker) === "Diversified (ETF)" ? "CORE_ETF" : "INDIVIDUAL";
}

async function computeBucketFit(userId: string, ticker: string): Promise<BucketFit> {
  const [goal, { rawHoldings }] = await Promise.all([
    prisma.goal.findUnique({ where: { userId } }),
    getParsedHoldings(userId),
  ]);
  if (!goal || rawHoldings.length === 0) return "unknown";

  const holdingTickers = [...new Set(rawHoldings.map((h) => h.ticker))];
  const quotes = await getQuotes(holdingTickers);

  let coreValue = 0;
  let individualValue = 0;
  for (const h of rawHoldings) {
    const price = quotes.get(h.ticker)?.price;
    const value = price != null ? price * h.shares : h.marketValue;
    if (classifyBucket(h.ticker) === "CORE_ETF") coreValue += value;
    else individualValue += value;
  }
  const total = coreValue + individualValue;
  if (total <= 0) return "unknown";

  const actualCorePct = (coreValue / total) * 100;
  const actualIndividualPct = 100 - actualCorePct;
  const targetCorePct = goal.targetCoreEtfPct;
  const targetIndividualPct = goal.targetGrowthPct + goal.targetSpeculativePct;

  const tickerBucket = classifyBucket(ticker);
  const BAND = 5;
  if (tickerBucket === "CORE_ETF") {
    if (actualCorePct < targetCorePct - BAND) return "underweight";
    if (actualCorePct > targetCorePct + BAND) return "overweight";
  } else {
    if (actualIndividualPct < targetIndividualPct - BAND) return "underweight";
    if (actualIndividualPct > targetIndividualPct + BAND) return "overweight";
  }
  return "neutral";
}

interface Commentary {
  source: "holding" | "watchlist" | "newIdea" | null;
  rating: "Buy" | "Hold" | "Sell" | null;
  ratingReason: string | null;
  riskRating: "Low" | "Medium" | "High" | null;
  riskReason: string | null;
  summary: string | null;
  asOf: string | null;
}

function findCommentary(
  ticker: string,
  dailyDigests: Array<{ content: string; generatedAt: Date }>,
  weeklyTrends: Array<{ content: string; generatedAt: Date }>
): { commentary: Commentary; position: { shares: number; marketValue: number; costBasis: number | null; gainLossPct: number | null } | null } {
  for (const r of dailyDigests) {
    let parsed: DailyDigest;
    try {
      parsed = JSON.parse(r.content);
    } catch {
      continue;
    }
    const holding = parsed.holdings?.find((h) => h.ticker === ticker);
    if (holding) {
      return {
        commentary: {
          source: "holding",
          rating: holding.rating,
          ratingReason: holding.ratingReason,
          riskRating: holding.riskRating,
          riskReason: holding.riskReason,
          summary: null,
          asOf: r.generatedAt.toISOString(),
        },
        position: {
          shares: holding.shares,
          marketValue: holding.marketValue,
          costBasis: holding.costBasis,
          gainLossPct: holding.gainLossPct,
        },
      };
    }
    const watchlistItem = parsed.watchlistItems?.find((w) => w.ticker === ticker);
    if (watchlistItem) {
      return {
        commentary: {
          source: "watchlist",
          rating: watchlistItem.rating,
          ratingReason: watchlistItem.ratingReason,
          riskRating: watchlistItem.riskRating,
          riskReason: watchlistItem.riskReason,
          summary: watchlistItem.summary,
          asOf: r.generatedAt.toISOString(),
        },
        position: null,
      };
    }
  }

  for (const r of weeklyTrends) {
    let parsed: WeeklyTrends;
    try {
      parsed = JSON.parse(r.content);
    } catch {
      continue;
    }
    const watchlistItem = parsed.watchlistItems?.find((w) => w.ticker === ticker);
    if (watchlistItem) {
      return {
        commentary: {
          source: "watchlist",
          rating: watchlistItem.rating,
          ratingReason: watchlistItem.ratingReason,
          riskRating: watchlistItem.riskRating,
          riskReason: watchlistItem.riskReason,
          summary: watchlistItem.summary,
          asOf: r.generatedAt.toISOString(),
        },
        position: null,
      };
    }
    const idea = parsed.newIdeas?.find((n) => n.ticker === ticker);
    if (idea) {
      return {
        commentary: {
          source: "newIdea",
          rating: idea.rating,
          ratingReason: idea.ratingReason,
          riskRating: idea.riskRating,
          riskReason: idea.riskReason,
          summary: idea.whatItDoes,
          asOf: r.generatedAt.toISOString(),
        },
        position: null,
      };
    }
  }

  return {
    commentary: { source: null, rating: null, ratingReason: null, riskRating: null, riskReason: null, summary: null, asOf: null },
    position: null,
  };
}

/** Fully deterministic, no AI call -- combines a live free Yahoo quote/chart
 * with commentary already written by the most recent scheduled report for
 * this ticker (never re-runs Gemini), so it's free to open/refresh anytime. */
export async function GET(_req: Request, { params }: { params: Promise<{ ticker: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const { ticker: rawTicker } = await params;
  const ticker = rawTicker.toUpperCase();

  const [quote, momentum, series, ohlc, dailyDigests, weeklyTrends, spyMomentum, congressTrades, bucketFit] =
    await Promise.all([
      getQuote(ticker),
      getMomentum(ticker),
      getHistoricalSeries(ticker, "1y"),
      getHistoricalOHLC(ticker, "1y"),
      prisma.report.findMany({
        where: { userId, type: "DAILY_DIGEST" },
        orderBy: { generatedAt: "desc" },
        take: 3,
        select: { content: true, generatedAt: true },
      }),
      prisma.report.findMany({
        where: { userId, type: "WEEKLY_TRENDS" },
        orderBy: { generatedAt: "desc" },
        take: 3,
        select: { content: true, generatedAt: true },
      }),
      getMomentum("SPY"),
      getCongressTrades([ticker]),
      computeBucketFit(userId, ticker),
    ]);

  const { commentary, position } = findCommentary(ticker, dailyDigests, weeklyTrends);

  const chartSeries = (series ?? []).map((p) => ({ date: p.date, value: p.close }));
  const previousClose = series && series.length >= 2 ? series[series.length - 2].close : null;
  const changePct =
    quote && previousClose ? ((quote.price - previousClose) / previousClose) * 100 : null;

  const fitScore: FitScoreResult = computeFitScore({
    tickerMomentum: momentum,
    marketMomentum1Month: spyMomentum?.pct1Month ?? null,
    congressTrades: congressTrades.map((t) => ({ type: t.type })),
    bucketFit,
  });

  return NextResponse.json({
    ticker,
    livePrice: quote?.price ?? null,
    previousClose,
    changePct,
    fiftyTwoWeekHigh: quote?.fiftyTwoWeekHigh ?? null,
    fiftyTwoWeekLow: quote?.fiftyTwoWeekLow ?? null,
    momentum,
    marketMomentum1Month: spyMomentum?.pct1Month ?? null,
    chartSeries,
    ohlc: ohlc ?? undefined,
    commentary,
    position,
    fitScore,
    asOf: new Date().toISOString(),
  });
}
