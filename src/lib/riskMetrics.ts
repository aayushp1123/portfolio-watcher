/**
 * Deterministic risk metrics computed purely from price data already
 * fetched elsewhere (Yahoo daily closes) -- no new external source, no
 * signup, just real math. Standard, well-understood quantitative measures:
 * realized volatility (how much the price actually swings) and beta (how
 * sensitive it is to broad-market moves), both grounded in real historical
 * closes rather than a model's guess.
 */
export interface RiskMetrics {
  /** Annualized realized volatility, as a percent -- stdev of daily returns scaled to a year. */
  annualizedVolatilityPct: number | null;
  /** Beta vs. the S&P 500 (SPY) -- 1.0 means it moves with the market, >1 more volatile, <1 less. */
  beta: number | null;
  /** Largest peak-to-trough decline over the price history covered, as a percent -- how bad it actually got. */
  maxDrawdownPct: number | null;
  /** Total % return over the price history covered, divided by annualized volatility -- a
   * "return per unit of risk" read. Not a formal Sharpe ratio (no risk-free rate subtracted). */
  returnToVolatilityRatio: number | null;
}

function dailyReturns(closes: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }
  return returns;
}

function stdev(values: number[]): number {
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

const TRADING_DAYS_PER_YEAR = 252;

function computeMaxDrawdownPct(closes: number[]): number {
  let peak = closes[0];
  let maxDrawdown = 0;
  for (const price of closes) {
    if (price > peak) peak = price;
    const drawdown = (peak - price) / peak;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }
  return maxDrawdown * 100;
}

export function computeRiskMetrics(tickerCloses: number[] | null, spyCloses: number[] | null): RiskMetrics {
  if (!tickerCloses || tickerCloses.length < 20) {
    return { annualizedVolatilityPct: null, beta: null, maxDrawdownPct: null, returnToVolatilityRatio: null };
  }

  const tickerReturns = dailyReturns(tickerCloses);
  const annualizedVolatilityPct = stdev(tickerReturns) * Math.sqrt(TRADING_DAYS_PER_YEAR) * 100;
  const maxDrawdownPct = computeMaxDrawdownPct(tickerCloses);

  const periodReturnPct = ((tickerCloses[tickerCloses.length - 1] - tickerCloses[0]) / tickerCloses[0]) * 100;
  const returnToVolatilityRatio = annualizedVolatilityPct > 0 ? periodReturnPct / annualizedVolatilityPct : null;

  let beta: number | null = null;
  if (spyCloses && spyCloses.length >= 20) {
    const spyReturns = dailyReturns(spyCloses);
    const n = Math.min(tickerReturns.length, spyReturns.length);
    const tr = tickerReturns.slice(-n);
    const sr = spyReturns.slice(-n);
    const meanT = tr.reduce((s, v) => s + v, 0) / n;
    const meanS = sr.reduce((s, v) => s + v, 0) / n;
    let cov = 0;
    let varS = 0;
    for (let i = 0; i < n; i++) {
      cov += (tr[i] - meanT) * (sr[i] - meanS);
      varS += (sr[i] - meanS) ** 2;
    }
    beta = varS > 0 ? cov / varS : null;
  }

  return { annualizedVolatilityPct, beta, maxDrawdownPct, returnToVolatilityRatio };
}

/** Trailing P/E from a live price and the most recent full fiscal year's
 * diluted EPS -- deliberately uses only the single most recent EPS value,
 * never a multi-year series, since that's the one point not distorted by a
 * stock split (shares outstanding in the latest filing is already
 * split-adjusted). Null if EPS is missing or non-positive (P/E is not
 * meaningful for an unprofitable company). */
export function computeTrailingPE(livePrice: number | null, mostRecentEps: number | null): number | null {
  if (livePrice == null || mostRecentEps == null || mostRecentEps <= 0) return null;
  return livePrice / mostRecentEps;
}
