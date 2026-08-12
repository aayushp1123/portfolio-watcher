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

/** Raw daily closing prices over a range — used for correlation/diversification
 * math that needs the actual series, not just a summarized momentum figure. */
export async function getHistoricalCloses(ticker: string, range = "3mo"): Promise<number[] | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${range}&interval=1d`,
      { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;

    const data = await res.json();
    const closesRaw: Array<number | null> = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
    const closes = closesRaw.filter((c): c is number => typeof c === "number");
    return closes.length >= 10 ? closes : null;
  } catch {
    return null;
  }
}

/** Historical closes for many tickers in parallel; failed lookups are simply omitted. */
export async function getManyHistoricalCloses(tickers: string[], range = "6mo"): Promise<Map<string, number[]>> {
  const unique = [...new Set(tickers)];
  const results = await Promise.all(unique.map(async (t) => [t, await getHistoricalCloses(t, range)] as const));
  const map = new Map<string, number[]>();
  for (const [ticker, closes] of results) {
    if (closes) map.set(ticker, closes);
  }
  return map;
}

export interface PricePoint {
  date: string;
  close: number;
}

/** Same free Yahoo chart endpoint as getHistoricalCloses, but keeps the
 * aligned trading-day dates -- needed to compute date-anchored returns
 * (1D/1W/1M/YTD) rather than just a raw series. */
export async function getHistoricalSeries(ticker: string, range = "1y"): Promise<PricePoint[] | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${range}&interval=1d`,
      { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    const timestamps: number[] = result?.timestamp ?? [];
    const closesRaw: Array<number | null> = result?.indicators?.quote?.[0]?.close ?? [];

    const series: PricePoint[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const close = closesRaw[i];
      if (typeof close !== "number") continue;
      series.push({ date: new Date(timestamps[i] * 1000).toISOString().slice(0, 10), close });
    }
    return series.length >= 2 ? series : null;
  } catch {
    return null;
  }
}

export interface OhlcPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
}

/** Full OHLC candles from the same free Yahoo chart endpoint -- it already
 * returns open/high/low/close/volume per day, this just extracts all of
 * them instead of only close. Used for bar/candlestick chart rendering. */
export async function getHistoricalOHLC(ticker: string, range = "1y"): Promise<OhlcPoint[] | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${range}&interval=1d`,
      { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    const timestamps: number[] = result?.timestamp ?? [];
    const quote = result?.indicators?.quote?.[0] ?? {};
    const opens: Array<number | null> = quote.open ?? [];
    const highs: Array<number | null> = quote.high ?? [];
    const lows: Array<number | null> = quote.low ?? [];
    const closes: Array<number | null> = quote.close ?? [];
    const volumes: Array<number | null> = quote.volume ?? [];

    const series: OhlcPoint[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const open = opens[i];
      const high = highs[i];
      const low = lows[i];
      const close = closes[i];
      if (typeof open !== "number" || typeof high !== "number" || typeof low !== "number" || typeof close !== "number")
        continue;
      series.push({
        date: new Date(timestamps[i] * 1000).toISOString().slice(0, 10),
        open,
        high,
        low,
        close,
        volume: typeof volumes[i] === "number" ? volumes[i] : null,
      });
    }
    return series.length >= 2 ? series : null;
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
