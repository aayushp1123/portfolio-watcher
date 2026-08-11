/**
 * Free macro data from FRED (Federal Reserve Economic Data) -- official,
 * free forever, no billing. Requires a free API key (fred.stlouisfed.org)
 * set as FRED_API_KEY; gracefully returns nothing if not configured, same
 * pattern as the other optional keys in this app.
 */
export interface MacroSnapshot {
  fedFundsRate: number | null;
  fedFundsDate: string | null;
  cpiYoyPct: number | null;
  unemploymentRate: number | null;
  unemploymentDate: string | null;
}

export function isFredConfigured(): boolean {
  return !!process.env.FRED_API_KEY;
}

const REVALIDATE_SECONDS = 21600; // macro data moves slowly; 6h is plenty fresh

async function fetchLatestObservation(seriesId: string): Promise<{ value: number; date: string } | null> {
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${process.env.FRED_API_KEY}&file_type=json&sort_order=desc&limit=1`;
    const res = await fetch(url, {
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const obs = data?.observations?.[0];
    if (!obs || obs.value === "." || isNaN(Number(obs.value))) return null;
    return { value: Number(obs.value), date: obs.date };
  } catch {
    return null;
  }
}

/** Real, current macro figures — federal funds rate, YoY CPI inflation, and
 * unemployment rate — from the Fed's own public data. */
export async function getMacroSnapshot(): Promise<MacroSnapshot | null> {
  if (!isFredConfigured()) return null;

  const [fedFunds, cpiLatest, cpiYearAgo, unemployment] = await Promise.all([
    fetchLatestObservation("FEDFUNDS"),
    fetchLatestObservation("CPIAUCSL"),
    fetchLatestObservationOffset("CPIAUCSL", 12),
    fetchLatestObservation("UNRATE"),
  ]);

  const cpiYoyPct =
    cpiLatest && cpiYearAgo ? ((cpiLatest.value - cpiYearAgo.value) / cpiYearAgo.value) * 100 : null;

  return {
    fedFundsRate: fedFunds?.value ?? null,
    fedFundsDate: fedFunds?.date ?? null,
    cpiYoyPct,
    unemploymentRate: unemployment?.value ?? null,
    unemploymentDate: unemployment?.date ?? null,
  };
}

/** Fetches the observation from `monthsAgo` months back, for YoY comparisons. */
async function fetchLatestObservationOffset(
  seriesId: string,
  monthsAgo: number
): Promise<{ value: number; date: string } | null> {
  try {
    const end = new Date();
    end.setMonth(end.getMonth() - monthsAgo);
    const endDate = end.toISOString().slice(0, 10);
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${process.env.FRED_API_KEY}&file_type=json&sort_order=desc&observation_end=${endDate}&limit=1`;
    const res = await fetch(url, {
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const obs = data?.observations?.[0];
    if (!obs || obs.value === "." || isNaN(Number(obs.value))) return null;
    return { value: Number(obs.value), date: obs.date };
  } catch {
    return null;
  }
}
