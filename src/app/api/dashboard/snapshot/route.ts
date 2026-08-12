import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getParsedHoldings } from "@/lib/holdings";
import { getQuotes, getQuote, getHistoricalSeries, type PricePoint } from "@/lib/quotes";
import { getSector } from "@/lib/sectors";
import type { DailyDigest } from "@/lib/reports/schemas";

interface ValuePoint {
  date: string;
  value: number;
}

function valueAtOrBefore(points: ValuePoint[], target: Date): number | null {
  let best: ValuePoint | null = null;
  for (const p of points) {
    const d = new Date(p.date);
    if (d <= target && (!best || d > new Date(best.date))) best = p;
  }
  return best ? best.value : null;
}

function priceAtOrBefore(points: PricePoint[], target: Date): number | null {
  let best: PricePoint | null = null;
  for (const p of points) {
    const d = new Date(p.date);
    if (d <= target && (!best || d > new Date(best.date))) best = p;
  }
  return best ? best.close : null;
}

/** Fully deterministic, no AI call involved -- combines live free Yahoo
 * quotes with already-stored report history, so it can be refreshed as
 * often as the user wants at no cost and with no quota risk. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const { rawHoldings, hasBrokerageConnection } = await getParsedHoldings(userId);

  if (!hasBrokerageConnection || rawHoldings.length === 0) {
    return NextResponse.json({
      asOf: new Date().toISOString(),
      hasBrokerageConnection,
      totalValue: 0,
      returns: [],
      bestHoldings: [],
      worstHoldings: [],
      allocationByHolding: [],
      allocationBySector: [],
      chartSeries: [],
      spChartSeries: [],
    });
  }

  const tickers = [...new Set(rawHoldings.map((h) => h.ticker))];
  const now = new Date();

  const [quotes, spySeries, spyQuote, history] = await Promise.all([
    getQuotes(tickers),
    getHistoricalSeries("SPY", "1y"),
    getQuote("SPY"),
    prisma.report.findMany({
      where: { userId, type: "DAILY_DIGEST" },
      orderBy: { generatedAt: "desc" },
      take: 90,
    }),
  ]);

  const livedHoldings = rawHoldings.map((h) => {
    const quote = quotes.get(h.ticker);
    const liveMarketValue = quote ? quote.price * h.shares : h.marketValue;
    return { ...h, livePrice: quote?.price ?? null, liveMarketValue };
  });

  const totalValue = livedHoldings.reduce((sum, h) => sum + h.liveMarketValue, 0);

  const historicalPoints: ValuePoint[] = history
    .map((h) => {
      const parsed: DailyDigest = JSON.parse(h.content);
      return parsed.hasBrokerageConnection ? { date: h.generatedAt.toISOString(), value: parsed.totalValue } : null;
    })
    .filter((p): p is ValuePoint => p !== null)
    .reverse();
  const chartSeries: ValuePoint[] = [...historicalPoints, { date: now.toISOString(), value: totalValue }];

  const currentYearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const periods: Array<{ period: "1D" | "1W" | "1M" | "YTD"; target: Date }> = [
    { period: "1D", target: new Date(now.getTime() - 1 * 24 * 3600 * 1000) },
    { period: "1W", target: new Date(now.getTime() - 7 * 24 * 3600 * 1000) },
    { period: "1M", target: new Date(now.getTime() - 30 * 24 * 3600 * 1000) },
    { period: "YTD", target: currentYearStart },
  ];

  const spySeriesSafe = spySeries ?? [];
  const spyNow = spyQuote?.price ?? (spySeriesSafe.length > 0 ? spySeriesSafe[spySeriesSafe.length - 1].close : null);

  const returns = periods.map(({ period, target }) => {
    const pastValue = valueAtOrBefore(historicalPoints, target);
    const portfolioPct = pastValue != null && pastValue !== 0 ? ((totalValue - pastValue) / pastValue) * 100 : null;

    const pastSpy = priceAtOrBefore(spySeriesSafe, target);
    const spPct = pastSpy != null && spyNow != null ? ((spyNow - pastSpy) / pastSpy) * 100 : null;

    return { period, portfolioPct, spPct };
  });

  const rankable = livedHoldings
    .filter((h): h is typeof h & { costBasis: number } => h.costBasis != null && h.costBasis > 0)
    .map((h) => ({
      ticker: h.ticker,
      gainLossPct: ((h.liveMarketValue - h.costBasis) / h.costBasis) * 100,
    }))
    .sort((a, b) => b.gainLossPct - a.gainLossPct);
  const bestHoldings = rankable.slice(0, 3);
  const worstHoldings = rankable.length > 3 ? rankable.slice(-3).reverse() : [];

  const allocationByHolding = livedHoldings
    .map((h) => ({
      ticker: h.ticker,
      value: h.liveMarketValue,
      pct: totalValue > 0 ? (h.liveMarketValue / totalValue) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);

  const sectorTotals = new Map<string, number>();
  for (const h of livedHoldings) {
    const sector = getSector(h.ticker);
    sectorTotals.set(sector, (sectorTotals.get(sector) ?? 0) + h.liveMarketValue);
  }
  const allocationBySector = [...sectorTotals.entries()]
    .map(([sector, value]) => ({ sector, value, pct: totalValue > 0 ? (value / totalValue) * 100 : 0 }))
    .sort((a, b) => b.value - a.value);

  // Rebase SPY onto the portfolio's own starting value so both lines read on one chart.
  let spChartSeries: ValuePoint[] = [];
  if (spySeriesSafe.length > 0 && chartSeries.length > 0) {
    const firstPortfolioDate = new Date(chartSeries[0].date);
    const basePrice = priceAtOrBefore(spySeriesSafe, firstPortfolioDate) ?? spySeriesSafe[0].close;
    const baseValue = chartSeries[0].value;
    spChartSeries = spySeriesSafe
      .filter((p) => new Date(p.date) >= firstPortfolioDate)
      .map((p) => ({ date: p.date, value: basePrice > 0 ? (p.close / basePrice) * baseValue : baseValue }));
    if (spyNow != null) {
      spChartSeries.push({
        date: now.toISOString(),
        value: basePrice > 0 ? (spyNow / basePrice) * baseValue : baseValue,
      });
    }
  }

  return NextResponse.json({
    asOf: now.toISOString(),
    hasBrokerageConnection,
    totalValue,
    returns,
    bestHoldings,
    worstHoldings,
    allocationByHolding,
    allocationBySector,
    chartSeries,
    spChartSeries,
  });
}
