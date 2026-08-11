export interface RatingChange {
  ticker: string;
  from: "Buy" | "Hold" | "Sell";
  to: "Buy" | "Hold" | "Sell";
}

/** Deterministic diff of two report snapshots' Buy/Hold/Sell calls — pure
 * comparison of already-generated report content, no new AI call, no new
 * data source. */
export function diffRatings(
  current: Array<{ ticker: string; rating: string }>,
  previous: Array<{ ticker: string; rating: string }>
): RatingChange[] {
  const prevMap = new Map(previous.map((i) => [i.ticker, i.rating]));
  const changes: RatingChange[] = [];
  for (const item of current) {
    const prevRating = prevMap.get(item.ticker);
    if (prevRating && prevRating !== item.rating) {
      changes.push({
        ticker: item.ticker,
        from: prevRating as RatingChange["from"],
        to: item.rating as RatingChange["to"],
      });
    }
  }
  return changes;
}
