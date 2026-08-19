"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Pill } from "@/components/ui/Pill";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { PremiumChart, type ChartType } from "@/components/dashboard/PremiumChart";

interface Momentum {
  pct1Month: number | null;
  pct3Month: number | null;
  aboveTwentyDayAvg: boolean | null;
  aboveFiftyDayAvg: boolean | null;
}

interface TechnicalIndicators {
  rsi14: number | null;
  rsiSignal: "overbought" | "oversold" | "neutral" | null;
  macd: { line: number; signal: number; histogram: number } | null;
  macdCrossover: "bullish" | "bearish" | null;
  bollinger: { upper: number; middle: number; lower: number } | null;
  pricePosition: "above_upper" | "below_lower" | "inside" | null;
  movingAverages: { sma50: number; sma200: number } | null;
  movingAverageCross: "golden_cross" | "death_cross" | "bullish" | "bearish" | null;
  supportResistance: { support20d: number; resistance20d: number } | null;
}

interface Commentary {
  source: "holding" | "watchlist" | "newIdea" | null;
  rating: "Buy" | "Hold" | "Sell" | null;
  ratingReason: string | null;
  riskRating: "Low" | "Medium" | "High" | null;
  riskReason: string | null;
  summary: string | null;
  asOf: string | null;
}

interface Position {
  shares: number;
  marketValue: number;
  costBasis: number | null;
  gainLossPct: number | null;
}

interface FitScore {
  score: number;
  breakdown: string[];
}

interface OhlcPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface StockSnapshot {
  ticker: string;
  livePrice: number | null;
  changePct: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  momentum: Momentum | null;
  marketMomentum1Month: number | null;
  chartSeries: Array<{ date: string; value: number }>;
  ohlc?: OhlcPoint[];
  commentary: Commentary;
  position: Position | null;
  fitScore: FitScore;
  technicalIndicators: TechnicalIndicators | null;
}

const ratingTone = { Buy: "good", Hold: "warn", Sell: "crit" } as const;
const riskTone = { Low: "good", Medium: "warn", High: "crit" } as const;
const sourceLabel = { holding: "Your holding", watchlist: "Watchlist", newIdea: "New idea" } as const;

function fitScoreTone(score: number): "good" | "warn" | "crit" {
  if (score >= 65) return "good";
  if (score <= 35) return "crit";
  return "warn";
}

const maCrossLabel = {
  golden_cross: "Golden cross",
  death_cross: "Death cross",
  bullish: "50d > 200d MA",
  bearish: "50d < 200d MA",
} as const;
const maCrossTone = {
  golden_cross: "good",
  death_cross: "crit",
  bullish: "good",
  bearish: "crit",
} as const;

/** Header + key stats + bottom line for one ticker's snapshot. Used once in
 * the normal (Line/Bar/Candlestick) view, and twice side-by-side in Compare
 * mode -- kept as one component so both renders always stay identical. */
function StockInfoPanel({ snapshot, ticker }: { snapshot: StockSnapshot; ticker: string }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-b from-paper-50 to-paper-0 p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-[family-name:var(--font-heading)] text-lg font-bold text-ink-900">{ticker}</span>
          {snapshot.commentary.source && <Pill tone="neutral">{sourceLabel[snapshot.commentary.source]}</Pill>}
          <InfoTooltip
            label={
              <>
                <p className="font-semibold text-ink-900">Fit Score: {snapshot.fitScore.score}/100</p>
                <p className="mt-1 text-ink-500">
                  A deterministic score (not AI) combining momentum vs. the S&amp;P 500, technical trend,
                  congressional trading activity, and how well this fits your target allocation.
                </p>
                <ul className="mt-1.5 list-disc space-y-0.5 pl-3.5 text-ink-700">
                  {snapshot.fitScore.breakdown.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </>
            }
          >
            <Pill tone={fitScoreTone(snapshot.fitScore.score)}>Fit {snapshot.fitScore.score}</Pill>
          </InfoTooltip>
        </div>
        <p className="mt-3 font-[family-name:var(--font-heading)] text-4xl font-bold text-ink-900">
          {snapshot.livePrice != null ? `$${snapshot.livePrice.toFixed(2)}` : "—"}
        </p>
        {snapshot.changePct != null && (
          <InfoTooltip
            label={
              <>
                <p className="font-semibold text-ink-900">Change today</p>
                <p className="mt-1 text-ink-500">
                  Live price vs. yesterday&apos;s closing price. This move is{" "}
                  {Math.abs(snapshot.changePct) >= 4 ? "larger than" : "within"} typical daily swings for most
                  stocks (roughly ±1-2%).
                </p>
              </>
            }
          >
            <div
              className={`mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold ${
                snapshot.changePct >= 0
                  ? "border-good-100 bg-good-100 text-good-800"
                  : "border-crit-100 bg-crit-100 text-crit-800"
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d={snapshot.changePct >= 0 ? "M2 11L6 7L9 10L14 4M10 4H14V8" : "M2 5L6 9L9 6L14 12M10 12H14V8"}
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {snapshot.changePct >= 0 ? "+" : ""}
              {snapshot.changePct.toFixed(2)}% today
            </div>
          </InfoTooltip>
        )}

        {snapshot.position && (
          <InfoTooltip
            label={
              <>
                <p className="font-semibold text-ink-900">Your position</p>
                <p className="mt-1 text-ink-500">
                  {snapshot.position.gainLossPct != null
                    ? `Your unrealized ${snapshot.position.gainLossPct >= 0 ? "gain" : "loss"} since you bought, based on your actual cost basis.`
                    : "Cost basis not available for this holding."}
                </p>
              </>
            }
          >
            <p className="mt-3 text-sm text-ink-700">
              {snapshot.position.shares} shares · $
              {snapshot.position.marketValue.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
              {snapshot.position.gainLossPct != null && (
                <span className={snapshot.position.gainLossPct >= 0 ? "text-good-600" : "text-crit-600"}>
                  {" "}
                  ({snapshot.position.gainLossPct >= 0 ? "+" : ""}
                  {snapshot.position.gainLossPct.toFixed(1)}%)
                </span>
              )}
            </p>
          </InfoTooltip>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <InfoTooltip
          label={
            <>
              <p className="font-semibold text-ink-900">52-Week High</p>
              <p className="mt-1 text-ink-500">
                The highest price this stock has traded at over the past year.
                {snapshot.livePrice != null && snapshot.fiftyTwoWeekHigh != null && (
                  <>
                    {" "}
                    Currently{" "}
                    {(((snapshot.fiftyTwoWeekHigh - snapshot.livePrice) / snapshot.fiftyTwoWeekHigh) * 100).toFixed(1)}
                    % below this level.
                  </>
                )}
              </p>
            </>
          }
        >
          <div className="rounded-lg border border-line px-3 py-2.5">
            <p className="text-xs font-semibold text-ink-500">52-wk High</p>
            <p className="text-lg font-bold text-ink-900">
              {snapshot.fiftyTwoWeekHigh != null ? `$${snapshot.fiftyTwoWeekHigh.toFixed(2)}` : "—"}
            </p>
          </div>
        </InfoTooltip>
        <InfoTooltip
          label={
            <>
              <p className="font-semibold text-ink-900">52-Week Low</p>
              <p className="mt-1 text-ink-500">
                The lowest price this stock has traded at over the past year.
                {snapshot.livePrice != null && snapshot.fiftyTwoWeekLow != null && (
                  <>
                    {" "}
                    Currently{" "}
                    {(((snapshot.livePrice - snapshot.fiftyTwoWeekLow) / snapshot.fiftyTwoWeekLow) * 100).toFixed(1)}
                    % above this level.
                  </>
                )}
              </p>
            </>
          }
        >
          <div className="rounded-lg border border-line px-3 py-2.5">
            <p className="text-xs font-semibold text-ink-500">52-wk Low</p>
            <p className="text-lg font-bold text-ink-900">
              {snapshot.fiftyTwoWeekLow != null ? `$${snapshot.fiftyTwoWeekLow.toFixed(2)}` : "—"}
            </p>
          </div>
        </InfoTooltip>
        <InfoTooltip
          label={
            <>
              <p className="font-semibold text-ink-900">1-Month Change</p>
              <p className="mt-1 text-ink-500">
                How much the price has moved over the last month.
                {snapshot.momentum?.pct1Month != null && snapshot.marketMomentum1Month != null && (
                  <>
                    {" "}
                    The S&amp;P 500 moved {snapshot.marketMomentum1Month >= 0 ? "+" : ""}
                    {snapshot.marketMomentum1Month.toFixed(1)}% over the same period, so this stock is{" "}
                    {snapshot.momentum.pct1Month >= snapshot.marketMomentum1Month ? "outperforming" : "underperforming"}{" "}
                    the broad market.
                  </>
                )}
              </p>
            </>
          }
        >
          <div className="rounded-lg border border-line px-3 py-2.5">
            <p className="text-xs font-semibold text-ink-500">1-Month</p>
            <p
              className={`text-lg font-bold ${
                snapshot.momentum?.pct1Month == null
                  ? "text-ink-500"
                  : snapshot.momentum.pct1Month >= 0
                    ? "text-good-600"
                    : "text-crit-600"
              }`}
            >
              {snapshot.momentum?.pct1Month != null
                ? `${snapshot.momentum.pct1Month >= 0 ? "+" : ""}${snapshot.momentum.pct1Month.toFixed(1)}%`
                : "—"}
            </p>
          </div>
        </InfoTooltip>
        <InfoTooltip
          label={
            <>
              <p className="font-semibold text-ink-900">3-Month Change</p>
              <p className="mt-1 text-ink-500">
                How much the price has moved over the last three months — a longer-term trend read than the 1-month
                figure.
              </p>
            </>
          }
        >
          <div className="rounded-lg border border-line px-3 py-2.5">
            <p className="text-xs font-semibold text-ink-500">3-Month</p>
            <p
              className={`text-lg font-bold ${
                snapshot.momentum?.pct3Month == null
                  ? "text-ink-500"
                  : snapshot.momentum.pct3Month >= 0
                    ? "text-good-600"
                    : "text-crit-600"
              }`}
            >
              {snapshot.momentum?.pct3Month != null
                ? `${snapshot.momentum.pct3Month >= 0 ? "+" : ""}${snapshot.momentum.pct3Month.toFixed(1)}%`
                : "—"}
            </p>
          </div>
        </InfoTooltip>
      </div>

      {snapshot.technicalIndicators && (
        <div>
          <h3 className="mb-2 font-[family-name:var(--font-heading)] text-sm font-bold text-ink-900">
            Technicals
          </h3>
          <div className="flex flex-wrap gap-2">
            {snapshot.technicalIndicators.rsi14 != null && (
              <InfoTooltip
                label={
                  <>
                    <p className="font-semibold text-ink-900">RSI (14-day)</p>
                    <p className="mt-1 text-ink-500">
                      Relative Strength Index, a real momentum measure computed from daily closes. Above 70 is
                      conventionally read as &quot;overbought&quot;, below 30 as &quot;oversold&quot; — not a
                      standalone buy/sell signal on its own.
                    </p>
                  </>
                }
              >
                <Pill tone={snapshot.technicalIndicators.rsiSignal && snapshot.technicalIndicators.rsiSignal !== "neutral" ? "warn" : "neutral"}>
                  RSI {snapshot.technicalIndicators.rsi14.toFixed(0)}
                  {snapshot.technicalIndicators.rsiSignal && snapshot.technicalIndicators.rsiSignal !== "neutral"
                    ? ` (${snapshot.technicalIndicators.rsiSignal})`
                    : ""}
                </Pill>
              </InfoTooltip>
            )}
            {snapshot.technicalIndicators.macdCrossover && (
              <InfoTooltip
                label={
                  <>
                    <p className="font-semibold text-ink-900">MACD crossover</p>
                    <p className="mt-1 text-ink-500">
                      A real, just-occurred crossover between the MACD line and its signal line — a{" "}
                      {snapshot.technicalIndicators.macdCrossover} crossover is conventionally read as a shift in
                      short-term momentum.
                    </p>
                  </>
                }
              >
                <Pill tone={snapshot.technicalIndicators.macdCrossover === "bullish" ? "good" : "crit"}>
                  MACD {snapshot.technicalIndicators.macdCrossover}
                </Pill>
              </InfoTooltip>
            )}
            {snapshot.technicalIndicators.pricePosition && snapshot.technicalIndicators.pricePosition !== "inside" && (
              <InfoTooltip
                label={
                  <>
                    <p className="font-semibold text-ink-900">Bollinger Bands</p>
                    <p className="mt-1 text-ink-500">
                      Price is currently {snapshot.technicalIndicators.pricePosition.replace("_", " ")} its 20-day,
                      2-standard-deviation Bollinger Band — a real statistical read on whether the current price is
                      stretched relative to its recent range.
                    </p>
                  </>
                }
              >
                <Pill tone="warn">Price {snapshot.technicalIndicators.pricePosition.replace("_", " ")} band</Pill>
              </InfoTooltip>
            )}
            {snapshot.technicalIndicators.movingAverageCross && (
              <InfoTooltip
                label={
                  <>
                    <p className="font-semibold text-ink-900">Moving-average trend</p>
                    <p className="mt-1 text-ink-500">
                      {snapshot.technicalIndicators.movingAverages && (
                        <>
                          50-day MA ${snapshot.technicalIndicators.movingAverages.sma50.toFixed(2)} vs. 200-day MA $
                          {snapshot.technicalIndicators.movingAverages.sma200.toFixed(2)}.{" "}
                        </>
                      )}
                      A golden cross (50-day crossing above 200-day) is conventionally read as bullish; a death
                      cross (crossing below) as bearish.
                    </p>
                  </>
                }
              >
                <Pill tone={maCrossTone[snapshot.technicalIndicators.movingAverageCross]}>
                  {maCrossLabel[snapshot.technicalIndicators.movingAverageCross]}
                </Pill>
              </InfoTooltip>
            )}
            {snapshot.technicalIndicators.supportResistance && (
              <InfoTooltip
                label={
                  <>
                    <p className="font-semibold text-ink-900">20-day support/resistance</p>
                    <p className="mt-1 text-ink-500">
                      The lowest and highest close over the last 20 trading days — short-term levels the price has
                      recently respected.
                    </p>
                  </>
                }
              >
                <Pill tone="neutral">
                  ${snapshot.technicalIndicators.supportResistance.support20d.toFixed(2)}–$
                  {snapshot.technicalIndicators.supportResistance.resistance20d.toFixed(2)}
                </Pill>
              </InfoTooltip>
            )}
          </div>
        </div>
      )}

      {snapshot.commentary.source && (
        <section>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-[family-name:var(--font-heading)] text-lg font-bold text-ink-900">Bottom Line</h3>
            <div className="flex items-center gap-2">
              {snapshot.commentary.rating && (
                <InfoTooltip
                  label={
                    <>
                      <p className="font-semibold text-ink-900">{snapshot.commentary.rating} rating</p>
                      <p className="mt-1 text-ink-500">
                        {snapshot.commentary.ratingReason ?? "From your most recent report."}
                      </p>
                    </>
                  }
                >
                  <Pill tone={ratingTone[snapshot.commentary.rating]}>{snapshot.commentary.rating}</Pill>
                </InfoTooltip>
              )}
              {snapshot.commentary.riskRating && (
                <InfoTooltip
                  label={
                    <>
                      <p className="font-semibold text-ink-900">{snapshot.commentary.riskRating} risk</p>
                      <p className="mt-1 text-ink-500">
                        {snapshot.commentary.riskReason ?? "From your most recent report."}
                      </p>
                    </>
                  }
                >
                  <Pill tone={riskTone[snapshot.commentary.riskRating]}>{snapshot.commentary.riskRating} risk</Pill>
                </InfoTooltip>
              )}
            </div>
          </div>
          <div className="rounded-xl border-none bg-teal-100 p-5">
            {snapshot.commentary.summary && <p className="text-sm text-ink-900">{snapshot.commentary.summary}</p>}
            {snapshot.commentary.ratingReason && (
              <p className="mt-1 text-sm text-ink-900">{snapshot.commentary.ratingReason}</p>
            )}
            {snapshot.commentary.riskReason && (
              <p className="mt-1 text-sm text-ink-700">{snapshot.commentary.riskReason}</p>
            )}
          </div>
          {snapshot.commentary.asOf && (
            <p className="mt-2 text-xs text-ink-500">
              From your report generated {new Date(snapshot.commentary.asOf).toLocaleString()}
            </p>
          )}
        </section>
      )}
    </div>
  );
}

export function StockDetailModal({
  ticker,
  open,
  onClose,
}: {
  ticker: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const [snapshot, setSnapshot] = useState<StockSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [chartType, setChartType] = useState<ChartType>("line");
  const [compareInput, setCompareInput] = useState("");
  const [compareTicker, setCompareTicker] = useState<string | null>(null);
  const [compareSnapshot, setCompareSnapshot] = useState<StockSnapshot | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!ticker) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/stocks/${encodeURIComponent(ticker)}/snapshot`);
      if (!res.ok) throw new Error("request failed");
      setSnapshot(await res.json());
    } catch {
      setError("Couldn't load live data right now — try refreshing.");
    } finally {
      setLoading(false);
    }
  }, [ticker]);

  useEffect(() => {
    if (open && ticker) {
      setSnapshot(null);
      setChartType("line");
      setCompareTicker(null);
      setCompareSnapshot(null);
      setCompareInput("");
      setCompareError(null);
      load();
    }
  }, [open, ticker, load]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  async function handleCompareSubmit(e: FormEvent) {
    e.preventDefault();
    const t = compareInput.trim().toUpperCase();
    if (!t) return;
    setCompareLoading(true);
    setCompareError(null);
    try {
      const res = await fetch(`/api/stocks/${encodeURIComponent(t)}/snapshot`);
      if (!res.ok) throw new Error("failed");
      const data: StockSnapshot = await res.json();
      if (!data.chartSeries || data.chartSeries.length < 2) throw new Error("no data");
      setCompareSnapshot(data);
      setCompareTicker(t);
    } catch {
      setCompareError(`Couldn't load data for "${t}".`);
    } finally {
      setCompareLoading(false);
    }
  }

  function removeCompare() {
    setCompareSnapshot(null);
    setCompareTicker(null);
    setCompareInput("");
    setCompareError(null);
  }

  function handleChartTypeChange(type: ChartType) {
    setChartType(type);
    if (type !== "compare") removeCompare();
  }

  if (!open || !ticker) return null;

  const isComparing = chartType === "compare" && !!compareSnapshot && !!snapshot;

  let compareRebasedPoints: Array<{ date: string; value: number }> = [];
  if (isComparing && snapshot && compareSnapshot) {
    const primaryStart = snapshot.chartSeries[0];
    const primaryStartTime = new Date(primaryStart.date).getTime();
    let basePoint = compareSnapshot.chartSeries[0];
    let bestDiff = Math.abs(new Date(basePoint.date).getTime() - primaryStartTime);
    for (const p of compareSnapshot.chartSeries) {
      const diff = Math.abs(new Date(p.date).getTime() - primaryStartTime);
      if (diff < bestDiff) {
        basePoint = p;
        bestDiff = diff;
      }
    }
    compareRebasedPoints = compareSnapshot.chartSeries
      .filter((p) => new Date(p.date).getTime() >= primaryStartTime)
      .map((p) => ({
        date: p.date,
        value: basePoint.value > 0 ? (p.value / basePoint.value) * primaryStart.value : primaryStart.value,
      }));
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4"
      style={{
        animation: "modal-backdrop-in 180ms ease-out",
        background: "var(--body-bg)",
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${ticker} details`}
    >
      <div
        className={`flex h-[95vh] w-[95vw] flex-col overflow-hidden rounded-xl border border-line bg-paper-0 shadow-2xl transition-[max-width] duration-200 ${
          isComparing ? "max-w-6xl" : "max-w-4xl"
        }`}
        style={{ animation: "modal-panel-in 220ms ease-out" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold text-ink-900">
            {ticker}
            {isComparing && ` vs ${compareTicker}`}
          </h2>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={load} disabled={loading}>
              {loading ? "Refreshing…" : "Refresh"}
            </Button>
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg px-3 py-2 text-lg leading-none text-ink-500 hover:bg-paper-50 hover:text-ink-900"
            >
              &times;
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading && !snapshot && <p className="text-sm text-ink-500">Loading live data…</p>}
          {error && <p className="text-sm text-crit-600">{error}</p>}

          {snapshot && (
            <div className="flex flex-col gap-6">
              <div className="rounded-lg border border-line p-4">
                <PremiumChart
                  series={
                    isComparing
                      ? [
                          { label: ticker, color: "var(--teal-600)", points: snapshot.chartSeries, fill: true },
                          {
                            label: `${compareTicker} (indexed)`,
                            color: "var(--warn-600)",
                            points: compareRebasedPoints,
                            dashed: true,
                          },
                        ]
                      : [{ label: ticker, color: "var(--teal-600)", points: snapshot.chartSeries, fill: true }]
                  }
                  ohlc={chartType === "candlestick" ? snapshot.ohlc : undefined}
                  showLegend={isComparing}
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
                      <form onSubmit={handleCompareSubmit} className="flex items-center gap-2">
                        <Input
                          value={compareInput}
                          onChange={(e) => setCompareInput(e.target.value.toUpperCase())}
                          placeholder="Compare with a ticker…"
                          className="w-40 py-1.5 text-xs"
                          maxLength={10}
                        />
                        <Button
                          type="submit"
                          variant="secondary"
                          disabled={compareLoading || !compareInput}
                          className="px-3 py-1.5 text-xs"
                        >
                          {compareLoading ? "Loading…" : "Compare"}
                        </Button>
                      </form>
                    )}
                    {compareError && <span className="text-xs text-crit-600">{compareError}</span>}
                  </div>
                )}
              </div>

              {isComparing && compareSnapshot ? (
                <div className="grid gap-6 lg:grid-cols-2">
                  <StockInfoPanel snapshot={snapshot} ticker={ticker} />
                  <StockInfoPanel snapshot={compareSnapshot} ticker={compareTicker!} />
                </div>
              ) : (
                <StockInfoPanel snapshot={snapshot} ticker={ticker} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
