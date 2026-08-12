"use client";

import { useId, useMemo, useRef, useState, type MouseEvent } from "react";

export interface ChartPoint {
  date: string;
  value: number;
}

export interface ChartSeries {
  label: string;
  color: string;
  points: ChartPoint[];
  dashed?: boolean;
  fill?: boolean;
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

function filterByRange(points: ChartPoint[], range: RangeLabel, anchor: Date): ChartPoint[] {
  if (points.length === 0 || range === "All") return points;
  let cutoff: Date;
  if (range === "YTD") {
    cutoff = new Date(Date.UTC(anchor.getUTCFullYear(), 0, 1));
  } else {
    const days = RANGES.find((r) => r.label === range)?.days ?? 365;
    cutoff = new Date(anchor.getTime() - days * 24 * 3600 * 1000);
  }
  return points.filter((p) => new Date(p.date) >= cutoff);
}

function nearestByDate(points: ChartPoint[], target: Date): ChartPoint | null {
  if (points.length === 0) return null;
  let best = points[0];
  let bestDiff = Math.abs(new Date(best.date).getTime() - target.getTime());
  for (const p of points) {
    const diff = Math.abs(new Date(p.date).getTime() - target.getTime());
    if (diff < bestDiff) {
      best = p;
      bestDiff = diff;
    }
  }
  return best;
}

/** Catmull-Rom-to-bezier smoothed path through a series of points. */
function smoothPath(coords: Array<[number, number]>): string {
  if (coords.length === 0) return "";
  if (coords.length === 1) return `M ${coords[0][0]} ${coords[0][1]}`;

  let path = `M ${coords[0][0]} ${coords[0][1]}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i - 1] ?? coords[i];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = coords[i + 2] ?? p2;
    const tension = 0.35;
    const cp1x = p1[0] + (p2[0] - p0[0]) * tension;
    const cp1y = p1[1] + (p2[1] - p0[1]) * tension;
    const cp2x = p2[0] - (p3[0] - p1[0]) * tension;
    const cp2y = p2[1] - (p3[1] - p1[1]) * tension;
    path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return path;
}

const WIDTH = 900;
const HEIGHT = 320;
const PADDING = { top: 24, bottom: 32, left: 12, right: 12 };

export function PremiumChart({
  series,
  valuePrefix = "$",
  showLegend = false,
  decorativeDots = true,
  defaultRange = "3M",
}: {
  series: ChartSeries[];
  valuePrefix?: string;
  showLegend?: boolean;
  decorativeDots?: boolean;
  defaultRange?: RangeLabel;
}) {
  const uid = useId();
  const [range, setRange] = useState<RangeLabel>(defaultRange);
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const primary = series[0];
  const anchor = useMemo(() => {
    const last = primary?.points[primary.points.length - 1];
    return last ? new Date(last.date) : new Date();
  }, [primary]);

  const filteredSeries = useMemo(
    () => series.map((s) => ({ ...s, points: filterByRange(s.points, range, anchor) })),
    [series, range, anchor]
  );

  const allValues = filteredSeries.flatMap((s) => s.points.map((p) => p.value));
  const min = allValues.length ? Math.min(...allValues) : 0;
  const max = allValues.length ? Math.max(...allValues) : 1;
  const valueRange = max - min || 1;

  const plotW = WIDTH - PADDING.left - PADDING.right;
  const plotH = HEIGHT - PADDING.top - PADDING.bottom;

  function toX(points: ChartPoint[], i: number): number {
    return points.length > 1 ? (i / (points.length - 1)) * plotW + PADDING.left : PADDING.left;
  }
  function toY(value: number): number {
    return HEIGHT - PADDING.bottom - ((value - min) / valueRange) * plotH;
  }

  const primaryPoints = filteredSeries[0]?.points ?? [];

  const scatteredDots = useMemo(() => {
    if (!decorativeDots) return [];
    return Array.from({ length: 28 }, (_, i) => ({
      x: PADDING.left + 20 + ((i * 37) % (plotW - 40)) + (((i * 53) % 30) - 15),
      y: PADDING.top + 10 + (((i * 29) % (plotH - 40)) || 0) + (((i * 17) % 20) - 10),
      opacity: 0.15 + ((i * 7) % 10) / 40,
      size: 1 + ((i * 3) % 3) * 0.5,
    }));
  }, [decorativeDots, plotW, plotH]);

  function handleMove(e: MouseEvent<SVGSVGElement>) {
    if (!svgRef.current || primaryPoints.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const idx = Math.round(((relX - PADDING.left) / plotW) * (primaryPoints.length - 1));
    const clamped = Math.max(0, Math.min(primaryPoints.length - 1, idx));
    setHoverDate(new Date(primaryPoints[clamped].date));
  }

  if (primaryPoints.length < 2) {
    return <p className="text-sm text-ink-500">Not enough history yet to chart a trend.</p>;
  }

  const hoverPointsBySeries = hoverDate
    ? filteredSeries.map((s) => ({ series: s, point: nearestByDate(s.points, hoverDate) }))
    : [];

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        {showLegend ? (
          <div className="flex items-center gap-4 text-xs text-ink-700">
            {series.map((s) => (
              <span key={s.label} className="flex items-center gap-1.5">
                {s.dashed ? (
                  <span className="inline-block h-0 w-3 border-t-2 border-dashed" style={{ borderColor: s.color }} />
                ) : (
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                )}
                {s.label}
              </span>
            ))}
          </div>
        ) : (
          <span />
        )}
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.label}
              onClick={() => setRange(r.label)}
              className={`rounded-md px-2 py-1 text-xs font-semibold transition-all duration-150 ease-out active:scale-[0.95] ${
                range === r.label
                  ? "bg-teal-600 text-white shadow-sm"
                  : "text-ink-500 hover:-translate-y-0.5 hover:text-ink-900"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full cursor-crosshair"
          role="img"
          aria-label="Price chart, interactive"
          onMouseMove={handleMove}
          onMouseLeave={() => setHoverDate(null)}
        >
          <defs>
            {filteredSeries.map(
              (s, si) =>
                s.fill && (
                  <linearGradient key={si} id={`${uid}-fill-${si}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={s.color} stopOpacity="0.28" />
                    <stop offset="60%" stopColor={s.color} stopOpacity="0.08" />
                    <stop offset="100%" stopColor={s.color} stopOpacity="0" />
                  </linearGradient>
                )
            )}
            <filter id={`${uid}-glow`} x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {primaryPoints.map((p, i) => (
            <line
              key={p.date}
              x1={toX(primaryPoints, i)}
              y1={PADDING.top}
              x2={toX(primaryPoints, i)}
              y2={HEIGHT - PADDING.bottom}
              style={{ stroke: "var(--line)" }}
              strokeWidth="1"
              strokeDasharray="3 5"
              opacity={0.5}
            />
          ))}

          {decorativeDots &&
            scatteredDots.map((d, i) => (
              <circle key={i} cx={d.x} cy={d.y} r={d.size} style={{ fill: "var(--ink-500)" }} opacity={d.opacity} />
            ))}

          {filteredSeries.map((s, si) => {
            const coords = s.points.map((p, i) => [toX(s.points, i), toY(p.value)] as [number, number]);
            const linePath = smoothPath(coords);
            const areaPath =
              s.fill && coords.length > 0
                ? `${linePath} L ${coords[coords.length - 1][0]} ${HEIGHT - PADDING.bottom} L ${coords[0][0]} ${HEIGHT - PADDING.bottom} Z`
                : null;
            return (
              <g key={si}>
                {areaPath && <path d={areaPath} fill={`url(#${uid}-fill-${si})`} />}
                <path
                  d={linePath}
                  fill="none"
                  style={{ stroke: s.color }}
                  strokeWidth={si === 0 ? 2.5 : 2}
                  strokeDasharray={s.dashed ? "6 5" : undefined}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </g>
            );
          })}

          {hoverDate &&
            hoverPointsBySeries.map(
              ({ series: s, point }, si) =>
                point && (
                  <g key={si}>
                    {si === 0 && (
                      <line
                        x1={toX(s.points, s.points.indexOf(point))}
                        y1={PADDING.top}
                        x2={toX(s.points, s.points.indexOf(point))}
                        y2={HEIGHT - PADDING.bottom}
                        style={{ stroke: "var(--line)" }}
                        strokeWidth="1"
                      />
                    )}
                    <circle
                      cx={toX(s.points, s.points.indexOf(point))}
                      cy={toY(point.value)}
                      r="10"
                      style={{ fill: s.color }}
                      opacity="0.15"
                    />
                    <circle
                      cx={toX(s.points, s.points.indexOf(point))}
                      cy={toY(point.value)}
                      r="4.5"
                      style={{ fill: "var(--paper-0)", stroke: s.color }}
                      strokeWidth="2.5"
                      filter={`url(#${uid}-glow)`}
                    />
                  </g>
                )
            )}
        </svg>

        {hoverDate &&
          hoverPointsBySeries[0]?.point &&
          (() => {
            const p = hoverPointsBySeries[0].point!;
            const x = toX(hoverPointsBySeries[0].series.points, hoverPointsBySeries[0].series.points.indexOf(p));
            const y = toY(p.value);
            return (
              <div
                className="pointer-events-none absolute transition-all duration-100 ease-out"
                style={{
                  left: `${(x / WIDTH) * 100}%`,
                  top: `${(y / HEIGHT) * 100}%`,
                  transform: "translate(-50%, -145%)",
                }}
              >
                <div className="relative rounded-lg bg-ink-900 px-3 py-1.5 shadow-lg dark:bg-paper-0">
                  <p className="text-xs font-semibold whitespace-nowrap text-paper-0 dark:text-ink-900">
                    {new Date(p.date).toLocaleDateString()}
                  </p>
                  {hoverPointsBySeries.map(
                    ({ series: s, point: sp }, si) =>
                      sp && (
                        <p key={si} className="text-xs whitespace-nowrap text-paper-0/90 dark:text-ink-900/80">
                          {showLegend ? `${s.label}: ` : ""}
                          {valuePrefix}
                          {sp.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </p>
                      )
                  )}
                  <div className="absolute left-1/2 -bottom-1.5 h-3 w-3 -translate-x-1/2 rotate-45 bg-ink-900 dark:bg-paper-0" />
                </div>
              </div>
            );
          })()}
      </div>
    </div>
  );
}
