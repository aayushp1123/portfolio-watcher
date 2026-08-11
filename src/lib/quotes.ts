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

/** Real, computed technical signals from actual daily closing prices — not
 * a model's guess. Same free Yahoo chart endpoint, just a longer range. */
export interface Momentum {
  pct1Month: number | null;
  pct3Month: number | null;
  twentyDayAvg: number | null;
  fiftyDayAvg: number | null;
  aboveTwentyDayAvg: boolean | null;
  aboveFiftyDayAvg: boolean | null;
}

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export async function getMomentum(ticker: string): Promise<Momentum | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=3mo&interval=1d`,
      { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;

    const data = await res.json();
    const closesRaw: Array<number | null> = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
    const closes = closesRaw.filter((c): c is number => typeof c === "number");
    if (closes.length < 5) return null;

    const latest = closes[closes.length - 1];
    const last20 = closes.slice(-20);
    const last50 = closes.slice(-50);
    const twentyDayAvg = last20.length >= 10 ? average(last20) : null;
    const fiftyDayAvg = last50.length >= 30 ? average(last50) : null;

    const oneMonthAgoIdx = Math.max(0, closes.length - 21);
    const pct1Month = ((latest - closes[oneMonthAgoIdx]) / closes[oneMonthAgoIdx]) * 100;
    const pct3Month = ((latest - closes[0]) / closes[0]) * 100;

    return {
      pct1Month,
      pct3Month,
      twentyDayAvg,
      fiftyDayAvg,
      aboveTwentyDayAvg: twentyDayAvg != null ? latest > twentyDayAvg : null,
      aboveFiftyDayAvg: fiftyDayAvg != null ? latest > fiftyDayAvg : null,
    };
  } catch {
    return null;
  }
}

/** Fetches momentum for many tickers in parallel; failed lookups are simply omitted. */
export async function getMomentums(tickers: string[]): Promise<Map<string, Momentum>> {
  const unique = [...new Set(tickers)];
  const results = await Promise.all(unique.map(async (t) => [t, await getMomentum(t)] as const));
  const map = new Map<string, Momentum>();
  for (const [ticker, momentum] of results) {
    if (momentum) map.set(ticker, momentum);
  }
  return map;
}
