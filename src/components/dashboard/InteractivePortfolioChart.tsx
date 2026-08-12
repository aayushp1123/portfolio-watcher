"use client";

import { useMemo, useRef, useState, type MouseEvent } from "react";

interface SeriesPoint {
  date: string;
  value: number;
}

const RANGES = [
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
  { label: "1Y", days: 365 },
  { label: "YTD", days: null },
  { label: "All", days: null },
] as const;

type RangeLabel = (typeof RANGES)[number]["label"];

function filterByRange(points: SeriesPoint[], range: RangeLabel): SeriesPoint[] {
  if (points.length === 0 || range === "All") return points;
  const now = new Date(points[points.length - 1].date);
  let cutoff: Date;
  if (range === "YTD") {
    cutoff = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  } else {
    const days = RANGES.find((r) => r.label === range)?.days ?? 365;
    cutoff = new Date(now.getTime() - days * 24 * 3600 * 1000);
  }
  return points.filter((p) => new Date(p.date) >= cutoff);
}

const WIDTH = 900;
const HEIGHT = 320;
const PADDING = 32;

export function InteractivePortfolioChart({
  portfolioSeries,
  spSeries,
}: {
  portfolioSeries: SeriesPoint[];
  spSeries: SeriesPoint[];
}) {
  const [range, setRange] = useState<RangeLabel>("3M");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const filteredPortfolio = useMemo(() => filterByRange(portfolioSeries, range), [portfolioSeries, range]);
  const filteredSp = useMemo(() => filterByRange(spSeries, range), [spSeries, range]);

  const allValues = [...filteredPortfolio.map((p) => p.value), ...filteredSp.map((p) => p.value)];
  const min = allValues.length ? Math.min(...allValues) : 0;
  const max = allValues.length ? Math.max(...allValues) : 1;
  const valueRange = max - min || 1;

  function toXY(points: SeriesPoint[], i: number): [number, number] {
    const x = points.length > 1 ? (i / (points.length - 1)) * (WIDTH - PADDING * 2) + PADDING : PADDING;
    const y = HEIGHT - PADDING - ((points[i].value - min) / valueRange) * (HEIGHT - PADDING * 2);
    return [x, y];
  }

  function pathFor(points: SeriesPoint[]): string {
    return points
      .map((_, i) => {
        const [x, y] = toXY(points, i);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  }

  const portfolioPath = pathFor(filteredPortfolio);
  const spPath = pathFor(filteredSp);

  function handleMove(e: MouseEvent<SVGSVGElement>) {
    if (!svgRef.current || filteredPortfolio.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const idx = Math.round(((relX - PADDING) / (WIDTH - PADDING * 2)) * (filteredPortfolio.length - 1));
    setHoverIdx(Math.max(0, Math.min(filteredPortfolio.length - 1, idx)));
  }

  const hoverPoint = hoverIdx != null ? filteredPortfolio[hoverIdx] : null;
  const hoverSpPoint =
    hoverIdx != null && filteredSp.length > 0 ? filteredSp[Math.min(hoverIdx, filteredSp.length - 1)] : null;

  if (portfolioSeries.length < 2) {
    return <p className="text-sm text-ink-500">Not enough history yet to chart a trend.</p>;
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-4 text-xs text-ink-700">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "var(--teal-600)" }} />
            Your Portfolio
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-0 w-3 border-t-2 border-dashed"
              style={{ borderColor: "var(--warn-600)" }}
            />
            S&amp;P 500 (indexed)
          </span>
        </div>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.label}
              onClick={() => setRange(r.label)}
              className={`rounded-md px-2 py-1 text-xs font-semibold transition-colors ${
                range === r.label ? "bg-teal-600 text-white" : "text-ink-500 hover:text-ink-900"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full cursor-crosshair"
        role="img"
        aria-label="Portfolio value vs S&P 500, interactive"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={PADDING}
            y1={PADDING + f * (HEIGHT - PADDING * 2)}
            x2={WIDTH - PADDING}
            y2={PADDING + f * (HEIGHT - PADDING * 2)}
            style={{ stroke: "var(--line)" }}
            strokeWidth="1"
          />
        ))}

        {spPath && (
          <path
            d={spPath}
            fill="none"
            style={{ stroke: "var(--warn-600)" }}
            strokeWidth="2"
            strokeDasharray="6 5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        <path
          d={portfolioPath}
          fill="none"
          style={{ stroke: "var(--teal-600)" }}
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {hoverIdx != null &&
          hoverPoint &&
          (() => {
            const [hx, hy] = toXY(filteredPortfolio, hoverIdx);
            const spIdx = filteredSp.length > 0 ? Math.min(hoverIdx, filteredSp.length - 1) : null;
            const spXY = spIdx != null ? toXY(filteredSp, spIdx) : null;
            return (
              <>
                <line x1={hx} y1={PADDING} x2={hx} y2={HEIGHT - PADDING} style={{ stroke: "var(--line)" }} strokeWidth="1" />
                <circle cx={hx} cy={hy} r="4.5" style={{ fill: "var(--paper-0)", stroke: "var(--teal-600)" }} strokeWidth="2.5" />
                {spXY && (
                  <circle
                    cx={spXY[0]}
                    cy={spXY[1]}
                    r="4.5"
                    style={{ fill: "var(--paper-0)", stroke: "var(--warn-600)" }}
                    strokeWidth="2.5"
                  />
                )}
              </>
            );
          })()}
      </svg>

      <div className="mt-1 flex min-h-[16px] justify-between text-xs text-ink-600">
        {hoverPoint ? (
          <>
            <span>{new Date(hoverPoint.date).toLocaleDateString()}</span>
            <span>
              Portfolio: ${hoverPoint.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              {hoverSpPoint
                ? ` · S&P 500: $${hoverSpPoint.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                : ""}
            </span>
          </>
        ) : (
          <span className="text-ink-500">Hover the chart to see values at a point in time</span>
        )}
      </div>
    </div>
  );
}
