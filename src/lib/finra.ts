/**
 * Free, unauthenticated daily short sale volume from FINRA's public data
 * files -- official regulatory data, no API key, no signup (FINRA's newer
 * Query API requires an auth token; this uses the older static file
 * distribution at cdn.finra.org, confirmed genuinely anonymous).
 *
 * Important: this is DAILY SHORT VOLUME (the fraction of one trading day's
 * volume that was short-sold), not total SHORT INTEREST (total outstanding
 * shorted shares as of a settlement date) -- those are different concepts.
 * FINRA's bi-monthly short interest figures aren't available as a free
 * anonymous file, so this only ever reports the real thing it actually has:
 * a daily short-selling-activity read, never framed as total short interest.
 */
const FINRA_BASE = "https://cdn.finra.org/equity/regsho/daily";
const CACHE_TTL_MS = 6 * 3600 * 1000;

interface ShortVolumeRow {
  shortVolume: number;
  totalVolume: number;
}

interface CachedFile {
  tradingDate: string; // YYYY-MM-DD
  rows: Map<string, ShortVolumeRow>;
  fetchedAt: number;
}

let cache: CachedFile | null = null;

function toFileDate(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

async function fetchMostRecentFile(): Promise<CachedFile | null> {
  const now = new Date();
  // Files post by 6pm ET same day and don't exist for weekends/holidays --
  // walk back up to a week to find the most recent one actually available.
  for (let daysBack = 0; daysBack < 7; daysBack++) {
    const d = new Date(now.getTime() - daysBack * 24 * 3600 * 1000);
    const fileDate = toFileDate(d);
    try {
      const res = await fetch(`${FINRA_BASE}/CNMSshvol${fileDate}.txt`, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) continue;
      const text = await res.text();
      const lines = text.trim().split("\n");
      if (lines.length < 2) continue;

      const rows = new Map<string, ShortVolumeRow>();
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split("|");
        const symbol = parts[1];
        const shortVolume = Number(parts[2]);
        const totalVolume = Number(parts[4]);
        if (!symbol || !Number.isFinite(shortVolume) || !Number.isFinite(totalVolume) || totalVolume <= 0) continue;
        rows.set(symbol.toUpperCase(), { shortVolume, totalVolume });
      }
      if (rows.size === 0) continue;

      return {
        tradingDate: `${fileDate.slice(0, 4)}-${fileDate.slice(4, 6)}-${fileDate.slice(6, 8)}`,
        rows,
        fetchedAt: Date.now(),
      };
    } catch {
      continue;
    }
  }
  return null;
}

export interface ShortVolumeData {
  ticker: string;
  tradingDate: string;
  /** % of that single trading day's volume that was short-sale volume -- a
   * daily activity signal, not total float shorted. */
  shortVolumePct: number;
}

/** Real daily short-sale-volume percentage for several tickers, in
 * parallel-safe fashion (the file is fetched once and cached in-memory for
 * the warm function lifetime, then reused for every ticker in the batch). */
export async function getShortVolumes(tickers: string[]): Promise<Map<string, ShortVolumeData>> {
  const map = new Map<string, ShortVolumeData>();
  if (tickers.length === 0) return map;

  if (!cache || Date.now() - cache.fetchedAt > CACHE_TTL_MS) {
    cache = await fetchMostRecentFile();
  }
  if (!cache) return map;

  for (const ticker of tickers) {
    const row = cache.rows.get(ticker.toUpperCase());
    if (!row) continue;
    map.set(ticker.toUpperCase(), {
      ticker: ticker.toUpperCase(),
      tradingDate: cache.tradingDate,
      shortVolumePct: (row.shortVolume / row.totalVolume) * 100,
    });
  }
  return map;
}
