"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { PremiumChart } from "@/components/dashboard/PremiumChart";

interface Momentum {
  pct1Month: number | null;
  pct3Month: number | null;
  aboveTwentyDayAvg: boolean | null;
  aboveFiftyDayAvg: boolean | null;
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

interface StockSnapshot {
  ticker: string;
  livePrice: number | null;
  changePct: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  momentum: Momentum | null;
  chartSeries: Array<{ date: string; value: number }>;
  commentary: Commentary;
  position: Position | null;
}

const ratingTone = { Buy: "good", Hold: "warn", Sell: "crit" } as const;
const riskTone = { Low: "good", Medium: "warn", High: "crit" } as const;
const sourceLabel = { holding: "Your holding", watchlist: "Watchlist", newIdea: "New idea" } as const;

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

  if (!open || !ticker) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-4"
      style={{ animation: "modal-backdrop-in 180ms ease-out" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${ticker} details`}
    >
      <div
        className="flex h-[95vh] w-[95vw] max-w-4xl flex-col overflow-hidden rounded-xl border border-line bg-paper-0 shadow-2xl"
        style={{ animation: "modal-panel-in 220ms ease-out" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold text-ink-900">{ticker}</h2>
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
              {/* Bento-style header: label + big price + change pill */}
              <div className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-b from-paper-50 to-paper-0 p-6 shadow-sm">
                {snapshot.commentary.source && (
                  <Pill tone="neutral">{sourceLabel[snapshot.commentary.source]}</Pill>
                )}
                <p className="mt-3 font-[family-name:var(--font-heading)] text-4xl font-bold text-ink-900">
                  {snapshot.livePrice != null ? `$${snapshot.livePrice.toFixed(2)}` : "—"}
                </p>
                {snapshot.changePct != null && (
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
                )}

                {snapshot.position && (
                  <p className="mt-3 text-sm text-ink-700">
                    {snapshot.position.shares} shares · ${snapshot.position.marketValue.toLocaleString()}
                    {snapshot.position.gainLossPct != null && (
                      <span className={snapshot.position.gainLossPct >= 0 ? "text-good-600" : "text-crit-600"}>
                        {" "}
                        ({snapshot.position.gainLossPct >= 0 ? "+" : ""}
                        {snapshot.position.gainLossPct.toFixed(1)}%)
                      </span>
                    )}
                  </p>
                )}
              </div>

              <div className="rounded-lg border border-line p-4">
                <PremiumChart
                  series={[{ label: ticker, color: "var(--teal-600)", points: snapshot.chartSeries, fill: true }]}
                />
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-line px-3 py-2.5">
                  <p className="text-xs font-semibold text-ink-500">52-wk High</p>
                  <p className="text-lg font-bold text-ink-900">
                    {snapshot.fiftyTwoWeekHigh != null ? `$${snapshot.fiftyTwoWeekHigh.toFixed(2)}` : "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-line px-3 py-2.5">
                  <p className="text-xs font-semibold text-ink-500">52-wk Low</p>
                  <p className="text-lg font-bold text-ink-900">
                    {snapshot.fiftyTwoWeekLow != null ? `$${snapshot.fiftyTwoWeekLow.toFixed(2)}` : "—"}
                  </p>
                </div>
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
              </div>

              {snapshot.commentary.source && (
                <section>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-[family-name:var(--font-heading)] text-lg font-bold text-ink-900">
                      Bottom Line
                    </h3>
                    <div className="flex items-center gap-2">
                      {snapshot.commentary.rating && (
                        <Pill tone={ratingTone[snapshot.commentary.rating]}>{snapshot.commentary.rating}</Pill>
                      )}
                      {snapshot.commentary.riskRating && (
                        <Pill tone={riskTone[snapshot.commentary.riskRating]}>
                          {snapshot.commentary.riskRating} risk
                        </Pill>
                      )}
                    </div>
                  </div>
                  <div className="rounded-xl border-none bg-teal-100 p-5">
                    {snapshot.commentary.summary && (
                      <p className="text-sm text-ink-900">{snapshot.commentary.summary}</p>
                    )}
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
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
