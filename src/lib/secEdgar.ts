/**
 * Free, unauthenticated SEC EDGAR data -- official government source, no
 * API key, no billing risk. Covers both material company filings (8-K,
 * 10-Q, 10-K) and insider trading activity (Form 4 buys/sells, Form 144
 * proposed sales) per ticker. SEC's fair-access policy requires a
 * descriptive User-Agent identifying the app, not a browser UA string.
 */
const SEC_USER_AGENT = "PortfolioWatcher (personal project; contact: aayushp1123@gmail.com)";
const REVALIDATE_SECONDS = 3600;

export interface SecFiling {
  ticker: string;
  formType: string;
  filedAt: string;
  description: string;
  url: string;
}

interface TickerMapEntry {
  cik_str: number;
  ticker: string;
  title: string;
}

let cikMapPromise: Promise<Map<string, string>> | null = null;

/** Free ticker -> zero-padded 10-digit CIK lookup, fetched once and reused
 * for the process lifetime (the full list rarely changes). */
function getCikMap(): Promise<Map<string, string>> {
  if (!cikMapPromise) {
    cikMapPromise = (async () => {
      try {
        const res = await fetch("https://www.sec.gov/files/company_tickers.json", {
          headers: { "User-Agent": SEC_USER_AGENT },
          next: { revalidate: 86400 },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return new Map<string, string>();
        const data = (await res.json()) as Record<string, TickerMapEntry>;
        const map = new Map<string, string>();
        for (const entry of Object.values(data)) {
          map.set(entry.ticker.toUpperCase(), String(entry.cik_str).padStart(10, "0"));
        }
        return map;
      } catch {
        return new Map<string, string>();
      }
    })();
  }
  return cikMapPromise;
}

const FORM_LABELS: Record<string, string> = {
  "8-K": "Material event report (8-K)",
  "10-Q": "Quarterly report (10-Q)",
  "10-K": "Annual report (10-K)",
  "4": "Insider transaction (Form 4)",
  "144": "Proposed insider sale (Form 144)",
};

/** Real recent SEC filings for a ticker, filtered to the given form types. */
export async function getRecentFilings(
  ticker: string,
  formTypes: string[],
  limit: number
): Promise<SecFiling[]> {
  const cikMap = await getCikMap();
  const cik = cikMap.get(ticker.toUpperCase());
  if (!cik) return [];

  try {
    const res = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, {
      headers: { "User-Agent": SEC_USER_AGENT },
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];

    const data = await res.json();
    const recent = data?.filings?.recent;
    if (!recent) return [];

    const results: SecFiling[] = [];
    const cikNoPad = String(Number(cik));
    for (let i = 0; i < recent.form.length && results.length < limit; i++) {
      const formType: string = recent.form[i];
      if (!formTypes.includes(formType)) continue;
      const accession: string = recent.accessionNumber[i].replace(/-/g, "");
      const doc: string = recent.primaryDocument[i];
      results.push({
        ticker,
        formType,
        filedAt: recent.filingDate[i],
        description: FORM_LABELS[formType] ?? formType,
        url: `https://www.sec.gov/Archives/edgar/data/${cikNoPad}/${accession}/${doc}`,
      });
    }
    return results;
  } catch {
    return [];
  }
}

/** Real material filings (8-K/10-Q/10-K) for several tickers, in parallel. */
export async function getMaterialFilings(tickers: string[], perTicker = 3): Promise<SecFiling[]> {
  const results = await Promise.all(
    tickers.map((t) => getRecentFilings(t, ["8-K", "10-Q", "10-K"], perTicker))
  );
  return results.flat();
}

/** Real insider activity (Form 4 transactions, Form 144 proposed sales). */
export async function getInsiderActivity(tickers: string[], perTicker = 5): Promise<SecFiling[]> {
  const results = await Promise.all(tickers.map((t) => getRecentFilings(t, ["4", "144"], perTicker)));
  return results.flat();
}
