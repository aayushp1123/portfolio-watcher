"use client";

import { useState, type FormEvent } from "react";
import { PremiumChart, type ChartSeries, type ChartType } from "@/components/dashboard/PremiumChart";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface RawSeriesPoint {
  date: string;
  value: number;
}

/** Wraps PremiumChart with a "compare with another stock" mode -- fetches a
 * second free ticker series, rebases it to the primary series' starting
 * value (same indexing technique used for the S&P 500 overlay) so two
 * differently-priced instruments are visually comparable on one chart. No
 * OHLC/Candlestick here since portfolio value isn't a single instrument. */
export function ComparableChart({
  series,
  valuePrefix = "$",
  showLegend = false,
}: {
  series: ChartSeries[];
  valuePrefix?: string;
  showLegend?: boolean;
}) {
  const [chartType, setChartType] = useState<ChartType>("line");
  const [input, setInput] = useState("");
  const [compareTicker, setCompareTicker] = useState<string | null>(null);
  const [compareSeries, setCompareSeries] = useState<ChartSeries | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function removeCompare() {
    setCompareSeries(null);
    setCompareTicker(null);
    setInput("");
    setError(null);
  }

  function handleChartTypeChange(type: ChartType) {
    setChartType(type);
    if (type !== "compare") removeCompare();
  }

  async function handleCompare(e: FormEvent) {
    e.preventDefault();
    const ticker = input.trim().toUpperCase();
    if (!ticker) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/stocks/${encodeURIComponent(ticker)}/series`);
      if (!res.ok) throw new Error("no data");
      const data: { points: RawSeriesPoint[] } = await res.json();
      if (!data.points || data.points.length < 2) throw new Error("no data");

      const primaryPoints = series[0]?.points ?? [];
      if (primaryPoints.length === 0) throw new Error("no primary series");
      const primaryStart = primaryPoints[0];
      const primaryStartTime = new Date(primaryStart.date).getTime();

      let basePoint = data.points[0];
      let bestDiff = Math.abs(new Date(basePoint.date).getTime() - primaryStartTime);
      for (const p of data.points) {
        const diff = Math.abs(new Date(p.date).getTime() - primaryStartTime);
        if (diff < bestDiff) {
          basePoint = p;
          bestDiff = diff;
        }
      }

      const rebased = data.points
        .filter((p) => new Date(p.date).getTime() >= primaryStartTime)
        .map((p) => ({
          date: p.date,
          value: basePoint.value > 0 ? (p.value / basePoint.value) * primaryStart.value : primaryStart.value,
        }));

      if (rebased.length < 2) throw new Error("no overlap");

      setCompareSeries({ label: `${ticker} (indexed)`, color: "var(--warn-600)", points: rebased, dashed: true });
      setCompareTicker(ticker);
    } catch {
      setError(`Couldn't load data for "${ticker}".`);
    } finally {
      setLoading(false);
    }
  }

  const isComparing = chartType === "compare" && !!compareSeries;
  const fullSeries = isComparing ? [...series, compareSeries!] : series;

  return (
    <div>
      <PremiumChart
        series={fullSeries}
        valuePrefix={valuePrefix}
        showLegend={showLegend || isComparing}
        showCompareOption
        chartType={chartType}
        onChartTypeChange={handleChartTypeChange}
      />

      {chartType === "compare" && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          {compareTicker ? (
            <button
              type="button"
              onClick={removeCompare}
              className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink-700 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:border-crit-600 hover:text-crit-600"
            >
              Comparing to {compareTicker} &times;
            </button>
          ) : (
            <form onSubmit={handleCompare} className="flex items-center gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value.toUpperCase())}
                placeholder="Compare with a ticker…"
                className="w-40 py-1.5 text-xs"
                maxLength={10}
              />
              <Button type="submit" variant="secondary" disabled={loading || !input} className="px-3 py-1.5 text-xs">
                {loading ? "Loading…" : "Compare"}
              </Button>
            </form>
          )}
          {error && <span className="text-xs text-crit-600">{error}</span>}
        </div>
      )}
    </div>
  );
}
