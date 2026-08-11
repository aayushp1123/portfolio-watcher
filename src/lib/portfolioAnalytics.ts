import { getHistoricalCloses } from "@/lib/quotes";

export interface CorrelationFlag {
  tickerA: string;
  tickerB: string;
  correlation: number;
}

function dailyReturns(closes: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }
  return returns;
}

function pearsonCorrelation(a: number[], b: number[]): number | null {
  const n = Math.min(a.length, b.length);
  if (n < 15) return null;
  const x = a.slice(-n);
  const y = b.slice(-n);

  const meanX = x.reduce((s, v) => s + v, 0) / n;
  const meanY = y.reduce((s, v) => s + v, 0) / n;

  let cov = 0;
  let varX = 0;
  let varY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    cov += dx * dy;
    varX += dx * dx;
    varY += dy * dy;
  }
  if (varX === 0 || varY === 0) return null;
  return cov / Math.sqrt(varX * varY);
}

/** Real pairwise correlation of daily returns across holdings, computed from
 * live 3-month price history — flags pairs that move together closely enough
 * to represent hidden concentration risk, even across nominally different
 * tickers. Free (same Yahoo chart endpoint already used for momentum). */
export async function getCorrelationFlags(
  tickers: string[],
  threshold = 0.8,
  limit = 5
): Promise<CorrelationFlag[]> {
  const unique = [...new Set(tickers)];
  if (unique.length < 2) return [];

  const closesMap = new Map<string, number[]>();
  await Promise.all(
    unique.map(async (t) => {
      const closes = await getHistoricalCloses(t);
      if (closes) closesMap.set(t, dailyReturns(closes));
    })
  );

  const withData = [...closesMap.keys()];
  const flags: CorrelationFlag[] = [];

  for (let i = 0; i < withData.length; i++) {
    for (let j = i + 1; j < withData.length; j++) {
      const tickerA = withData[i];
      const tickerB = withData[j];
      const corr = pearsonCorrelation(closesMap.get(tickerA)!, closesMap.get(tickerB)!);
      if (corr != null && corr >= threshold) {
        flags.push({ tickerA, tickerB, correlation: corr });
      }
    }
  }

  return flags.sort((a, b) => b.correlation - a.correlation).slice(0, limit);
}
