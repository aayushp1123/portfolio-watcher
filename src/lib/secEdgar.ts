/**
 * Free, unauthenticated SEC EDGAR data -- official government source, no
 * API key, no billing risk. Covers both material company filings (8-K,
 * 10-Q, 10-K) and insider trading activity (Form 4 buys/sells, Form 144
 * proposed sales) per ticker. SEC's fair-access policy requires a
 * descriptive User-Agent identifying the app, not a browser UA string.
 */
import { prisma } from "@/lib/prisma";

const SEC_USER_AGENT = "PortfolioWatcher (personal project; contact: aayushp1123@gmail.com)";
const REVALIDATE_SECONDS = 3600;
// Full SEC company-facts files run 5-8MB for large companies, well over
// Next.js's built-in fetch-cache 2MB limit (it silently no-ops above that),
// so this file's own extracted-result cache is the only thing that actually
// avoids re-downloading those multi-MB files on every report run.
const EARNINGS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

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

export interface EarningsHistoryPoint {
  fiscalYear: number;
  /** Real reported annual revenue in USD, from the company's own 10-K -- null if not tagged. */
  revenue: number | null;
  /** Real reported annual net income in USD -- null if not tagged. */
  netIncome: number | null;
  /** Real reported diluted EPS, from the company's own 10-K -- shown for reference only, never
   * used for trend classification since stock splits create discontinuities that look like a
   * real business change but aren't (see revenueTrend/netIncomeTrend instead). Null if not tagged. */
  eps: number | null;
  /** Real total assets as of fiscal year end -- null if not tagged. */
  totalAssets: number | null;
  /** Real total liabilities as of fiscal year end -- null if not tagged. */
  totalLiabilities: number | null;
  /** Real cash and cash equivalents as of fiscal year end -- null if not tagged. */
  cashAndEquivalents: number | null;
  /** Real net cash from operating activities for the fiscal year -- null if not tagged. */
  operatingCashFlow: number | null;
  /** Real capital expenditures for the fiscal year -- null if not tagged. */
  capex: number | null;
  /** Computed: operatingCashFlow - capex. Null if either input is missing. */
  freeCashFlow: number | null;
  filedAt: string;
}

export interface EarningsHistory {
  ticker: string;
  /** Sorted ascending by fiscal year, most recent ~8 annual reports available. */
  points: EarningsHistoryPoint[];
  revenueTrend: "improving" | "worsening" | "mixed" | "unknown";
  netIncomeTrend: "improving" | "worsening" | "mixed" | "unknown";
  freeCashFlowTrend: "improving" | "worsening" | "mixed" | "unknown";
  /** Real total liabilities / total assets from the most recent fiscal year with both figures -- null if unavailable. */
  latestDebtToAssetsRatio: number | null;
  /** Real cash and cash equivalents from the most recent fiscal year with the figure -- null if unavailable. */
  latestCashPosition: number | null;
}

// Different companies/filing years tag the same concept differently. Checks
// every tag and merges by fiscal year (does NOT stop at the first tag with
// any data) so a company that switched XBRL tags mid-history -- e.g. Apple
// moved off "Revenues" onto the ASC 606 contract-revenue tag in FY2019 --
// still gets complete year-by-year coverage instead of silently truncating.
const REVENUE_TAGS = [
  "Revenues",
  "RevenueFromContractWithCustomerExcludingAssessedTax",
  "RevenueFromContractWithCustomerIncludingAssessedTax",
  "SalesRevenueNet",
  "SalesRevenueGoodsNet",
];
const NET_INCOME_TAGS = ["NetIncomeLoss", "ProfitLoss"];
const EPS_TAGS = ["EarningsPerShareDiluted", "EarningsPerShareBasicAndDiluted"];
const ASSETS_TAGS = ["Assets"];
const LIABILITIES_TAGS = ["Liabilities"];
const CASH_TAGS = [
  "CashAndCashEquivalentsAtCarryingValue",
  "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents",
];
const OPERATING_CASH_FLOW_TAGS = ["NetCashProvidedByUsedInOperatingActivities"];
const CAPEX_TAGS = [
  "PaymentsToAcquirePropertyPlantAndEquipment",
  "PaymentsToAcquireProductiveAssets",
  "PaymentsForCapitalImprovements",
  "PaymentsToAcquireOtherPropertyPlantAndEquipment",
];

function extractAnnualSeries(
  usGaapFacts: Record<string, { units?: Record<string, Array<Record<string, unknown>>> }>,
  tags: string[]
): Map<number, { val: number; filed: string }> {
  const byYear = new Map<number, { val: number; filed: string }>();
  for (const tag of tags) {
    const units = usGaapFacts?.[tag]?.units;
    if (!units) continue;
    for (const entries of Object.values(units)) {
      for (const entry of entries) {
        if (entry.form !== "10-K" || entry.fp !== "FY" || typeof entry.val !== "number") continue;
        const end = entry.end as string | undefined;
        const fy = typeof entry.fy === "number" ? entry.fy : end ? Number(end.slice(0, 4)) : null;
        const filed = (entry.filed as string) ?? "";
        if (!fy) continue;
        // Only fill years this tag hasn't already supplied a value for, or
        // replace with a more recently filed (e.g. restated) value.
        const existing = byYear.get(fy);
        if (!existing || filed > existing.filed) {
          byYear.set(fy, { val: entry.val as number, filed });
        }
      }
    }
  }
  return byYear;
}

function computeTrend(values: Array<number | null>): "improving" | "worsening" | "mixed" | "unknown" {
  const valid = values.filter((v): v is number => v != null);
  if (valid.length < 2) return "unknown";
  let increases = 0;
  let decreases = 0;
  for (let i = 1; i < valid.length; i++) {
    if (valid[i] > valid[i - 1]) increases++;
    else if (valid[i] < valid[i - 1]) decreases++;
  }
  if (increases === 0 && decreases === 0) return "unknown";
  if (increases >= decreases * 2) return "improving";
  if (decreases >= increases * 2) return "worsening";
  return "mixed";
}

/** Real historical annual revenue/net income/EPS for a ticker, straight from
 * the SEC's XBRL "company facts" API -- the same structured data extracted
 * from every company's actual filed 10-Ks, free and official. Used to
 * ground reasoning in real reported multi-year trends instead of guessing
 * whether a company is executing well.
 *
 * Trend is computed from revenue and net income only, never EPS -- EPS is a
 * per-share figure, so a stock split (e.g. NVDA's 10-for-1 split in 2024)
 * creates a discontinuity that looks like a business collapsed when nothing
 * about the underlying company changed. Revenue and net income are total
 * dollar figures, unaffected by share count, so they're the only reliable
 * real signal for "is this company's business actually improving."
 *
 * Deliberately does not claim "beat/missed Wall Street consensus" -- this
 * app has no free source for analyst estimates, so it only reports the real
 * reported growth trend, which is what it can actually verify. */
export async function getEarningsHistory(ticker: string, years = 8): Promise<EarningsHistory | null> {
  const cached = await prisma.secFactsCache.findUnique({ where: { ticker } }).catch(() => null);
  if (cached && Date.now() - cached.fetchedAt.getTime() < EARNINGS_CACHE_TTL_MS) {
    return JSON.parse(cached.json) as EarningsHistory;
  }

  const cikMap = await getCikMap();
  const cik = cikMap.get(ticker.toUpperCase());
  if (!cik) return null;

  try {
    const res = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, {
      headers: { "User-Agent": SEC_USER_AGENT },
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;

    const data = await res.json();
    const usGaap = data?.facts?.["us-gaap"];
    if (!usGaap) return null;

    const revenueByYear = extractAnnualSeries(usGaap, REVENUE_TAGS);
    const netIncomeByYear = extractAnnualSeries(usGaap, NET_INCOME_TAGS);
    const epsByYear = extractAnnualSeries(usGaap, EPS_TAGS);
    const assetsByYear = extractAnnualSeries(usGaap, ASSETS_TAGS);
    const liabilitiesByYear = extractAnnualSeries(usGaap, LIABILITIES_TAGS);
    const cashByYear = extractAnnualSeries(usGaap, CASH_TAGS);
    const operatingCashFlowByYear = extractAnnualSeries(usGaap, OPERATING_CASH_FLOW_TAGS);
    const capexByYear = extractAnnualSeries(usGaap, CAPEX_TAGS);

    const allYears = [
      ...new Set([
        ...revenueByYear.keys(),
        ...netIncomeByYear.keys(),
        ...epsByYear.keys(),
        ...assetsByYear.keys(),
        ...operatingCashFlowByYear.keys(),
      ]),
    ].sort((a, b) => a - b);
    const recentYears = allYears.slice(-years);
    if (recentYears.length === 0) return null;

    const points: EarningsHistoryPoint[] = recentYears.map((fy) => {
      const operatingCashFlow = operatingCashFlowByYear.get(fy)?.val ?? null;
      const capex = capexByYear.get(fy)?.val ?? null;
      return {
        fiscalYear: fy,
        revenue: revenueByYear.get(fy)?.val ?? null,
        netIncome: netIncomeByYear.get(fy)?.val ?? null,
        eps: epsByYear.get(fy)?.val ?? null,
        totalAssets: assetsByYear.get(fy)?.val ?? null,
        totalLiabilities: liabilitiesByYear.get(fy)?.val ?? null,
        cashAndEquivalents: cashByYear.get(fy)?.val ?? null,
        operatingCashFlow,
        // Capex is reported as a positive outflow amount in XBRL; free cash flow subtracts it.
        capex,
        freeCashFlow: operatingCashFlow != null && capex != null ? operatingCashFlow - Math.abs(capex) : null,
        filedAt: revenueByYear.get(fy)?.filed ?? netIncomeByYear.get(fy)?.filed ?? epsByYear.get(fy)?.filed ?? "",
      };
    });

    const latestWithRatio = [...points].reverse().find((p) => p.totalAssets != null && p.totalLiabilities != null);
    const latestWithCash = [...points].reverse().find((p) => p.cashAndEquivalents != null);

    const result: EarningsHistory = {
      ticker,
      points,
      revenueTrend: computeTrend(points.map((p) => p.revenue)),
      netIncomeTrend: computeTrend(points.map((p) => p.netIncome)),
      freeCashFlowTrend: computeTrend(points.map((p) => p.freeCashFlow)),
      latestDebtToAssetsRatio:
        latestWithRatio && latestWithRatio.totalAssets
          ? (latestWithRatio.totalLiabilities as number) / latestWithRatio.totalAssets
          : null,
      latestCashPosition: latestWithCash?.cashAndEquivalents ?? null,
    };

    await prisma.secFactsCache
      .upsert({
        where: { ticker },
        create: { ticker, json: JSON.stringify(result) },
        update: { json: JSON.stringify(result), fetchedAt: new Date() },
      })
      .catch(() => {});

    return result;
  } catch {
    return null;
  }
}

/** Real earnings history for several tickers, in parallel; failed/unavailable lookups are simply omitted. */
export async function getEarningsHistories(tickers: string[]): Promise<Map<string, EarningsHistory>> {
  const results = await Promise.all(tickers.map(async (t) => [t, await getEarningsHistory(t)] as const));
  const map = new Map<string, EarningsHistory>();
  for (const [ticker, history] of results) {
    if (history) map.set(ticker, history);
  }
  return map;
}
