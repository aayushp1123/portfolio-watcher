/**
 * Free, unauthenticated congressional stock trading disclosures -- public
 * data from the House and Senate stock-watcher projects (aggregated from
 * official STOCK Act disclosure filings). No API key, no billing risk. If
 * either feed is unreachable, callers get an empty array rather than a
 * blocked report.
 */
const HOUSE_URL = "https://house-stock-watcher-data.s3-us-west-2.amazonaws.com/data/all_transactions.json";
const SENATE_URL = "https://senate-stock-watcher-data.s3-us-west-2.amazonaws.com/aggregate/all_transactions.json";
const REVALIDATE_SECONDS = 6 * 3600;

export interface CongressTrade {
  ticker: string;
  person: string;
  chamber: "House" | "Senate";
  type: string;
  amountRange: string;
  transactionDate: string;
  disclosureDate: string;
}

interface RawTransaction {
  ticker?: string;
  representative?: string;
  senator?: string;
  type?: string;
  amount?: string;
  transaction_date?: string;
  disclosure_date?: string;
}

async function fetchFeed(url: string, chamber: "House" | "Senate"): Promise<CongressTrade[]> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as RawTransaction[];
    if (!Array.isArray(data)) return [];

    return data
      .filter((t) => t.ticker && t.ticker !== "--" && t.ticker !== "N/A")
      .map((t) => ({
        ticker: String(t.ticker).toUpperCase(),
        person: (chamber === "House" ? t.representative : t.senator) ?? "Unknown",
        chamber,
        type: t.type ?? "unknown",
        amountRange: t.amount ?? "unknown",
        transactionDate: t.transaction_date ?? "",
        disclosureDate: t.disclosure_date ?? "",
      }));
  } catch {
    return [];
  }
}

/** Real, recent congressional trades for the given tickers, most recent first. */
export async function getCongressTrades(tickers: string[], limit = 8): Promise<CongressTrade[]> {
  if (tickers.length === 0) return [];
  const tickerSet = new Set(tickers.map((t) => t.toUpperCase()));

  const [house, senate] = await Promise.all([
    fetchFeed(HOUSE_URL, "House"),
    fetchFeed(SENATE_URL, "Senate"),
  ]);

  return [...house, ...senate]
    .filter((t) => tickerSet.has(t.ticker))
    .sort((a, b) => (b.transactionDate ?? "").localeCompare(a.transactionDate ?? ""))
    .slice(0, limit);
}
