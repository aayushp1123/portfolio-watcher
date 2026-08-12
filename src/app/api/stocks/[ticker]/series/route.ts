import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getHistoricalSeries } from "@/lib/quotes";

/** Lightweight, deterministic (no AI) historical price series for the "compare
 * with another stock" chart overlay -- deliberately separate from the full
 * snapshot route so adding a quick comparison doesn't pay for fit score,
 * commentary lookup, etc. Free Yahoo data, same as everything else. */
export async function GET(req: Request, { params }: { params: Promise<{ ticker: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ticker: rawTicker } = await params;
  const ticker = rawTicker.toUpperCase();
  const range = new URL(req.url).searchParams.get("range") ?? "1y";

  const series = await getHistoricalSeries(ticker, range);
  if (!series) {
    return NextResponse.json({ error: `No data available for ${ticker}` }, { status: 404 });
  }

  return NextResponse.json({
    ticker,
    points: series.map((p) => ({ date: p.date, value: p.close })),
  });
}
