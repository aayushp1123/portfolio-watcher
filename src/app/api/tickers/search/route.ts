import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { searchTickers } from "@/lib/tickers";

interface YahooSearchQuote {
  symbol?: string;
  shortname?: string;
  longname?: string;
  quoteType?: string;
}

/** Free, unauthenticated ticker search via Yahoo Finance's public search
 * endpoint — far broader coverage than the bundled static list. Falls back
 * to the static list on any failure so the autocomplete never breaks. */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const query = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (!query) return NextResponse.json({ results: [] });

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=15&newsCount=0`,
      { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) throw new Error(`Yahoo search returned ${res.status}`);

    const data = await res.json();
    const quotes: YahooSearchQuote[] = Array.isArray(data?.quotes) ? data.quotes : [];
    const results = quotes
      .filter((q) => q.symbol && q.quoteType === "EQUITY")
      .map((q) => ({ symbol: q.symbol as string, name: q.longname ?? q.shortname ?? (q.symbol as string) }));

    if (results.length > 0) {
      return NextResponse.json({ results });
    }
    throw new Error("No results from Yahoo search");
  } catch {
    return NextResponse.json({ results: searchTickers(query, 15) });
  }
}
