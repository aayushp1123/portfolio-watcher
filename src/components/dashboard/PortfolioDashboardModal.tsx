"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import { PremiumChart } from "@/components/dashboard/PremiumChart";

interface ReturnRow {
  period: "1D" | "1W" | "1M" | "YTD";
  portfolioPct: number | null;
  spPct: number | null;
}

interface RankedHolding {
  ticker: string;
  gainLossPct: number;
}

interface AllocationRow {
  value: number;
  pct: number;
}

interface Snapshot {
  asOf: string;
  hasBrokerageConnection: boolean;
  totalValue: number;
  returns: ReturnRow[];
  bestHoldings: RankedHolding[];
  worstHoldings: RankedHolding[];
  allocationByHolding: (AllocationRow & { ticker: string })[];
  allocationBySector: (AllocationRow & { sector: string })[];
  chartSeries: Array<{ date: string; value: number }>;
  spChartSeries: Array<{ date: string; value: number }>;
}

function pctLabel(pct: number | null): string {
  if (pct == null) return "—";
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

export function PortfolioDashboardModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/snapshot");
      if (!res.ok) throw new Error("request failed");
      setSnapshot(await res.json());
    } catch {
      setError("Couldn't load live data right now — try refreshing.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Lock background scroll while open, and prevent an ancestor with a
  // transform/filter/backdrop-filter (any of which creates a CSS containing
  // block) from trapping this modal's `fixed` positioning -- rendering
  // straight into document.body via a portal guarantees it always covers
  // the real viewport, not just the page's content column.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-4"
      style={{ animation: "modal-backdrop-in 180ms ease-out" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Portfolio dashboard"
    >
      <div
        className="flex h-[97vh] w-[98vw] flex-col overflow-hidden rounded-xl border border-line bg-paper-0 shadow-2xl"
        style={{ animation: "modal-panel-in 220ms ease-out" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold text-ink-900">
            Portfolio Dashboard
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

          {snapshot && !snapshot.hasBrokerageConnection && (
            <p className="text-sm text-ink-700">
              Connect a brokerage account to see your live portfolio dashboard.
            </p>
          )}

          {snapshot && snapshot.hasBrokerageConnection && (
            <div className="flex flex-col gap-6">
              <div>
                <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">Total Portfolio Value</p>
                <p className="font-[family-name:var(--font-heading)] text-3xl font-bold text-ink-900">
                  ${snapshot.totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </p>
                <p className="mt-1 text-xs text-ink-500">As of {new Date(snapshot.asOf).toLocaleString()}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {snapshot.returns.map((r) => (
                  <div key={r.period} className="rounded-lg border border-line px-3 py-2.5">
                    <p className="text-xs font-semibold text-ink-500">{r.period}</p>
                    <p
                      className={`text-lg font-bold ${
                        r.portfolioPct == null ? "text-ink-500" : r.portfolioPct >= 0 ? "text-good-600" : "text-crit-600"
                      }`}
                    >
                      {pctLabel(r.portfolioPct)}
                    </p>
                    <p className="text-xs text-ink-500">S&amp;P 500: {pctLabel(r.spPct)}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-line p-4">
                <PremiumChart
                  series={[
                    { label: "Your Portfolio", color: "var(--teal-600)", points: snapshot.chartSeries, fill: true },
                    { label: "S&P 500 (indexed)", color: "var(--warn-600)", points: snapshot.spChartSeries, dashed: true },
                  ]}
                  showLegend
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-sm font-bold text-ink-900">Best Performers</h3>
                  {snapshot.bestHoldings.length === 0 ? (
                    <p className="text-sm text-ink-500">Not enough cost-basis data yet.</p>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {snapshot.bestHoldings.map((h) => (
                        <div
                          key={h.ticker}
                          className="flex items-center justify-between rounded-lg border border-line px-3 py-2"
                        >
                          <span className="font-semibold text-ink-900">{h.ticker}</span>
                          <span className="font-semibold text-good-600">{pctLabel(h.gainLossPct)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-bold text-ink-900">Worst Performers</h3>
                  {snapshot.worstHoldings.length === 0 ? (
                    <p className="text-sm text-ink-500">Not enough holdings to rank separately.</p>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {snapshot.worstHoldings.map((h) => (
                        <div
                          key={h.ticker}
                          className="flex items-center justify-between rounded-lg border border-line px-3 py-2"
                        >
                          <span className="font-semibold text-ink-900">{h.ticker}</span>
                          <span className={`font-semibold ${h.gainLossPct >= 0 ? "text-good-600" : "text-crit-600"}`}>
                            {pctLabel(h.gainLossPct)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-sm font-bold text-ink-900">Allocation by Holding</h3>
                  <div className="flex flex-col gap-2">
                    {snapshot.allocationByHolding.map((a) => (
                      <div key={a.ticker}>
                        <div className="mb-0.5 flex justify-between text-xs">
                          <span className="font-semibold text-ink-900">{a.ticker}</span>
                          <span className="text-ink-500">{a.pct.toFixed(1)}%</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-paper-50">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${a.pct}%`, background: "var(--teal-600)" }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-bold text-ink-900">Allocation by Sector</h3>
                  <div className="flex flex-col gap-2">
                    {snapshot.allocationBySector.map((a) => (
                      <div key={a.sector}>
                        <div className="mb-0.5 flex justify-between text-xs">
                          <span className="font-semibold text-ink-900">{a.sector}</span>
                          <span className="text-ink-500">{a.pct.toFixed(1)}%</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-paper-50">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${a.pct}%`, background: "var(--warn-600)" }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
