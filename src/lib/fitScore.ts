/**
 * Deterministic "Fit Score" (0-100) -- pure math over data already fetched
 * elsewhere in the app, no AI call, fully explainable. Starts at a neutral
 * 50 and moves up/down based on real, verifiable signals only.
 *
 * Deliberately does NOT use insider Form 4 filings as a directional signal:
 * the SEC data this app fetches is filing metadata only (form type, date,
 * URL) -- it doesn't parse the actual transaction codes inside each filing,
 * so there's no reliable way to know whether a given Form 4 was a buy or a
 * sell. Claiming a direction from data that doesn't support it would be a
 * fabrication, so that signal is left out entirely rather than guessed.
 */
export interface FitScoreInput {
  tickerMomentum: {
    pct1Month: number | null;
    aboveTwentyDayAvg: boolean | null;
    aboveFiftyDayAvg: boolean | null;
  } | null;
  marketMomentum1Month: number | null;
  congressTrades: Array<{ type: string }>;
  bucketFit: "underweight" | "overweight" | "neutral" | "unknown";
}

export interface FitScoreResult {
  score: number;
  breakdown: string[];
}

export function computeFitScore(input: FitScoreInput): FitScoreResult {
  let score = 50;
  const breakdown: string[] = [];

  if (input.tickerMomentum?.pct1Month != null && input.marketMomentum1Month != null) {
    const relative = input.tickerMomentum.pct1Month - input.marketMomentum1Month;
    const clamped = Math.max(-20, Math.min(20, relative));
    score += clamped;
    breakdown.push(
      relative >= 0
        ? `Outperforming the S&P 500 by ${relative.toFixed(1)} points over the past month`
        : `Underperforming the S&P 500 by ${Math.abs(relative).toFixed(1)} points over the past month`
    );
  }

  if (input.tickerMomentum?.aboveTwentyDayAvg != null) {
    score += input.tickerMomentum.aboveTwentyDayAvg ? 6 : -6;
    breakdown.push(
      input.tickerMomentum.aboveTwentyDayAvg ? "Trading above its 20-day average" : "Trading below its 20-day average"
    );
  }
  if (input.tickerMomentum?.aboveFiftyDayAvg != null) {
    score += input.tickerMomentum.aboveFiftyDayAvg ? 6 : -6;
    breakdown.push(
      input.tickerMomentum.aboveFiftyDayAvg ? "Trading above its 50-day average" : "Trading below its 50-day average"
    );
  }

  const purchases = input.congressTrades.filter((t) => t.type.toLowerCase().includes("purchase")).length;
  const sales = input.congressTrades.filter((t) => t.type.toLowerCase().includes("sale")).length;
  if (purchases > sales && purchases > 0) {
    score += 8;
    breakdown.push(`${purchases} recent congressional purchase${purchases > 1 ? "s" : ""} disclosed`);
  } else if (sales > purchases && sales > 0) {
    score -= 8;
    breakdown.push(`${sales} recent congressional sale${sales > 1 ? "s" : ""} disclosed`);
  }

  if (input.bucketFit === "underweight") {
    score += 12;
    breakdown.push("Fits a part of your portfolio that's currently underweight vs. your target allocation");
  } else if (input.bucketFit === "overweight") {
    score -= 12;
    breakdown.push("Adds to a part of your portfolio that's already overweight vs. your target allocation");
  }

  if (breakdown.length === 0) {
    breakdown.push("Not enough data available yet to score this one confidently");
  }

  return { score: Math.max(0, Math.min(100, Math.round(score))), breakdown };
}
