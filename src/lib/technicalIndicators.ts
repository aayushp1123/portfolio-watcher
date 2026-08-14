/**
 * Deterministic technical-analysis indicators computed purely from real daily
 * closing prices (same free, unauthenticated Yahoo chart endpoint already
 * used elsewhere) -- no new external source, no signup, just real math.
 * Standard, well-known indicators: RSI, MACD, Bollinger Bands, the 50/200-day
 * moving-average "golden/death cross", and rolling support/resistance.
 */
export interface TechnicalIndicators {
  /** 14-day RSI (0-100). >70 conventionally "overbought", <30 "oversold". */
  rsi14: number | null;
  rsiSignal: "overbought" | "oversold" | "neutral" | null;
  /** MACD(12,26,9) on daily closes. */
  macd: { line: number; signal: number; histogram: number } | null;
  /** Whether the MACD histogram flipped sign on the most recent day. */
  macdCrossover: "bullish" | "bearish" | null;
  /** 20-day, 2-stdev Bollinger Bands. */
  bollinger: { upper: number; middle: number; lower: number } | null;
  pricePosition: "above_upper" | "below_lower" | "inside" | null;
  /** 50-day vs. 200-day simple moving average. */
  movingAverages: { sma50: number; sma200: number } | null;
  /** "golden_cross"/"death_cross" only when the crossover happened within the
   * last 5 trading days; otherwise just the standing bullish/bearish state. */
  movingAverageCross: "golden_cross" | "death_cross" | "bullish" | "bearish" | null;
  /** Rolling 20-trading-day high/low as short-term resistance/support levels. */
  supportResistance: { support20d: number; resistance20d: number } | null;
}

const EMPTY: TechnicalIndicators = {
  rsi14: null,
  rsiSignal: null,
  macd: null,
  macdCrossover: null,
  bollinger: null,
  pricePosition: null,
  movingAverages: null,
  movingAverageCross: null,
  supportResistance: null,
};

function sma(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function stdev(values: number[]): number {
  const mean = sma(values);
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/** Standard EMA: seeded with the SMA of the first `period` values, then the
 * recursive EMA formula for the rest. Returned array is the same length as
 * `values`, with the first `period - 1` entries left as NaN (no EMA yet). */
function emaSeries(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result = new Array(values.length).fill(NaN);
  if (values.length < period) return result;
  let prev = sma(values.slice(0, period));
  result[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    result[i] = prev;
  }
  return result;
}

function computeRSI14(closes: number[]): number | null {
  const period = 14;
  if (closes.length < period + 1) return null;

  const changes: number[] = [];
  for (let i = 1; i < closes.length; i++) changes.push(closes[i] - closes[i - 1]);

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    const c = changes[i];
    if (c > 0) avgGain += c;
    else avgLoss += -c;
  }
  avgGain /= period;
  avgLoss /= period;

  // Wilder's smoothing for the rest of the series.
  for (let i = period; i < changes.length; i++) {
    const c = changes[i];
    const gain = c > 0 ? c : 0;
    const loss = c < 0 ? -c : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function computeMACD(
  closes: number[]
): { line: number; signal: number; histogram: number; crossover: "bullish" | "bearish" | null } | null {
  // Need enough bars for a stable 26-EMA plus a 9-EMA of the resulting MACD line.
  if (closes.length < 26 + 9) return null;

  const ema12 = emaSeries(closes, 12);
  const ema26 = emaSeries(closes, 26);

  const macdLine: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (!Number.isNaN(ema12[i]) && !Number.isNaN(ema26[i])) macdLine.push(ema12[i] - ema26[i]);
  }
  if (macdLine.length < 9) return null;

  const signalLine = emaSeries(macdLine, 9);
  const lastIdx = macdLine.length - 1;
  const prevIdx = lastIdx - 1;
  if (Number.isNaN(signalLine[lastIdx])) return null;

  const histogram = macdLine[lastIdx] - signalLine[lastIdx];
  let crossover: "bullish" | "bearish" | null = null;
  if (prevIdx >= 0 && !Number.isNaN(signalLine[prevIdx])) {
    const prevHistogram = macdLine[prevIdx] - signalLine[prevIdx];
    if (prevHistogram <= 0 && histogram > 0) crossover = "bullish";
    else if (prevHistogram >= 0 && histogram < 0) crossover = "bearish";
  }

  return { line: macdLine[lastIdx], signal: signalLine[lastIdx], histogram, crossover };
}

function computeBollinger(
  closes: number[]
): { upper: number; middle: number; lower: number; pricePosition: "above_upper" | "below_lower" | "inside" } | null {
  const period = 20;
  if (closes.length < period) return null;

  const window = closes.slice(-period);
  const middle = sma(window);
  const sd = stdev(window);
  const upper = middle + 2 * sd;
  const lower = middle - 2 * sd;
  const latest = closes[closes.length - 1];
  const pricePosition = latest > upper ? "above_upper" : latest < lower ? "below_lower" : "inside";

  return { upper, middle, lower, pricePosition };
}

function computeMovingAverageCross(
  closes: number[]
): { sma50: number; sma200: number; status: "golden_cross" | "death_cross" | "bullish" | "bearish" } | null {
  if (closes.length < 200) return null;

  const sma50Now = sma(closes.slice(-50));
  const sma200Now = sma(closes.slice(-200));

  // Look back 5 trading days to see if the 50/200 relationship just flipped.
  const lookback = 5;
  let crossedUp = false;
  let crossedDown = false;
  for (let i = 1; i <= lookback && closes.length - 200 - i >= 0; i++) {
    const priorCloses = closes.slice(0, closes.length - i);
    if (priorCloses.length < 200) continue;
    const priorSma50 = sma(priorCloses.slice(-50));
    const priorSma200 = sma(priorCloses.slice(-200));
    if (priorSma50 <= priorSma200 && sma50Now > sma200Now) crossedUp = true;
    if (priorSma50 >= priorSma200 && sma50Now < sma200Now) crossedDown = true;
  }

  const status = crossedUp ? "golden_cross" : crossedDown ? "death_cross" : sma50Now > sma200Now ? "bullish" : "bearish";
  return { sma50: sma50Now, sma200: sma200Now, status };
}

function computeSupportResistance(closes: number[]): { support20d: number; resistance20d: number } | null {
  const period = 20;
  if (closes.length < period) return null;
  const window = closes.slice(-period);
  return { support20d: Math.min(...window), resistance20d: Math.max(...window) };
}

/** `closes` should be at least ~1 year of daily closes (needed for the
 * 200-day moving average); shorter series still produce RSI/MACD/Bollinger
 * /support-resistance, just null out the moving-average cross. */
export function computeTechnicalIndicators(closes: number[] | null): TechnicalIndicators {
  if (!closes || closes.length < 15) return EMPTY;

  const rsi14 = computeRSI14(closes);
  const rsiSignal = rsi14 == null ? null : rsi14 >= 70 ? "overbought" : rsi14 <= 30 ? "oversold" : "neutral";

  const macdResult = computeMACD(closes);
  const bollingerResult = computeBollinger(closes);
  const crossResult = computeMovingAverageCross(closes);
  const supportResistance = computeSupportResistance(closes);

  return {
    rsi14,
    rsiSignal,
    macd: macdResult ? { line: macdResult.line, signal: macdResult.signal, histogram: macdResult.histogram } : null,
    macdCrossover: macdResult?.crossover ?? null,
    bollinger: bollingerResult ? { upper: bollingerResult.upper, middle: bollingerResult.middle, lower: bollingerResult.lower } : null,
    pricePosition: bollingerResult?.pricePosition ?? null,
    movingAverages: crossResult ? { sma50: crossResult.sma50, sma200: crossResult.sma200 } : null,
    movingAverageCross: crossResult?.status ?? null,
    supportResistance,
  };
}
