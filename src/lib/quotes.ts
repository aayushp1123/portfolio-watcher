/**
 * Free, unauthenticated live price lookups via Yahoo Finance's public chart
 * endpoint. No API key, no rate-limit billing risk -- if a lookup fails for
 * any reason, callers should fall back to treating the price as unknown
 * rather than blocking report generation.
 */
export interface Quote {
  price: number;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
}

export async function getQuote(ticker: string): Promise<Quote | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}`,
      { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;

    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta || typeof meta.regularMarketPrice !== "number") return null;

    return {
      price: meta.regularMarketPrice,
      fiftyTwoWeekHigh: typeof meta.fiftyTwoWeekHigh === "number" ? meta.fiftyTwoWeekHigh : null,
      fiftyTwoWeekLow: typeof meta.fiftyTwoWeekLow === "number" ? meta.fiftyTwoWeekLow : null,
    };
  } catch {
    return null;
  }
}

/** Fetches quotes for many tickers in parallel; failed lookups are simply omitted. */
export async function getQuotes(tickers: string[]): Promise<Map<string, Quote>> {
  const unique = [...new Set(tickers)];
  const results = await Promise.all(unique.map(async (t) => [t, await getQuote(t)] as const));
  const map = new Map<string, Quote>();
  for (const [ticker, quote] of results) {
    if (quote) map.set(ticker, quote);
  }
  return map;
}
