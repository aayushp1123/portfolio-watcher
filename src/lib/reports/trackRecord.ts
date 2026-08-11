import { prisma } from "@/lib/prisma";
import { getQuotes } from "@/lib/quotes";
import type { DailyDigest } from "@/lib/reports/schemas";

export interface TrackRecordEntry {
  ticker: string;
  rating: "Buy" | "Hold" | "Sell";
  ratedAt: string;
  priceAtRating: number;
  currentPrice: number;
  pctChange: number;
  assessment: "on-track" | "off-track" | "inconclusive";
}

const MIN_AGE_DAYS = 7;
const MOVE_THRESHOLD_PCT = 1;
const HOLD_BAND_PCT = 5;

/** Deterministic, non-AI feature: compares past Buy/Hold/Sell ratings from
 * already-stored DAILY_DIGEST reports against real current live prices. No
 * new external data source and no re-running any AI generation — just
 * arithmetic over data already in the database plus one free quote lookup. */
export async function getRatingTrackRecord(userId: string): Promise<{
  entries: TrackRecordEntry[];
  accuratePct: number | null;
}> {
  const cutoff = new Date(Date.now() - MIN_AGE_DAYS * 24 * 3600 * 1000);

  const reports = await prisma.report.findMany({
    where: { userId, type: "DAILY_DIGEST", generatedAt: { lte: cutoff } },
    orderBy: { generatedAt: "desc" },
    take: 60,
  });

  // Only the most recent old-enough rating per ticker matters.
  const latestPerTicker = new Map<string, { rating: string; generatedAt: Date; price: number }>();
  for (const r of reports) {
    let parsed: DailyDigest;
    try {
      parsed = JSON.parse(r.content);
    } catch {
      continue;
    }
    for (const h of parsed.holdings ?? []) {
      if (latestPerTicker.has(h.ticker)) continue;
      if (!h.shares) continue;
      const impliedPrice = h.marketValue / h.shares;
      if (!Number.isFinite(impliedPrice) || impliedPrice <= 0) continue;
      latestPerTicker.set(h.ticker, { rating: h.rating, generatedAt: r.generatedAt, price: impliedPrice });
    }
  }

  if (latestPerTicker.size === 0) return { entries: [], accuratePct: null };

  const quotes = await getQuotes([...latestPerTicker.keys()]);

  const entries: TrackRecordEntry[] = [];
  for (const [ticker, past] of latestPerTicker) {
    const quote = quotes.get(ticker);
    if (!quote) continue;
    const pctChange = ((quote.price - past.price) / past.price) * 100;

    let assessment: TrackRecordEntry["assessment"];
    if (past.rating === "Buy") {
      assessment = pctChange > MOVE_THRESHOLD_PCT ? "on-track" : pctChange < -MOVE_THRESHOLD_PCT ? "off-track" : "inconclusive";
    } else if (past.rating === "Sell") {
      assessment = pctChange < -MOVE_THRESHOLD_PCT ? "on-track" : pctChange > MOVE_THRESHOLD_PCT ? "off-track" : "inconclusive";
    } else {
      assessment = Math.abs(pctChange) <= HOLD_BAND_PCT ? "on-track" : "off-track";
    }

    entries.push({
      ticker,
      rating: past.rating as TrackRecordEntry["rating"],
      ratedAt: past.generatedAt.toISOString(),
      priceAtRating: past.price,
      currentPrice: quote.price,
      pctChange,
      assessment,
    });
  }

  entries.sort((a, b) => new Date(b.ratedAt).getTime() - new Date(a.ratedAt).getTime());

  const scored = entries.filter((e) => e.assessment !== "inconclusive");
  const accuratePct =
    scored.length > 0 ? (scored.filter((e) => e.assessment === "on-track").length / scored.length) * 100 : null;

  return { entries, accuratePct };
}
