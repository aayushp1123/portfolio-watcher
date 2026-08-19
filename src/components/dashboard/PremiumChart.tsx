"use client";

import { useId, useMemo, useRef, useState, type MouseEvent, type ReactNode, type TouchEvent } from "react";

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

export interface OhlcPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
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
export type ChartType = "line" | "bar" | "candlestick" | "compare";

const TYPE_ICONS: Record<ChartType, ReactNode> = {
  line: (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M1 12 L6 6 L9.5 9 L15 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  bar: (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.5" y="8" width="3" height="6.5" rx="0.5" fill="currentColor" />
      <rect x="6.5" y="4" width="3" height="10.5" rx="0.5" fill="currentColor" />
      <rect x="11.5" y="1.5" width="3" height="13" rx="0.5" fill="currentColor" />
    </svg>
  ),
  candlestick: (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <line x1="3" y1="1.5" x2="3" y2="14.5" stroke="currentColor" strokeWidth="1.2" />
      <rect x="1.3" y="5" width="3.4" height="5" fill="currentColor" />
      <line x1="11" y1="3" x2="11" y2="13" stroke="currentColor" strokeWidth="1.2" />
      <rect x="9.3" y="6.5" width="3.4" height="4" fill="currentColor" />
    </svg>
  ),
  compare: (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="6" cy="8" r="4.5" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="10.5" cy="8" r="4.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  ),
};

function filterByRange<T extends { date: string }>(points: T[], range: RangeLabel, anchor: Date): T[] {
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

function nearestByDate<T extends { date: string }>(points: T[], target: Date): T | null {
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
  ohlc,
  valuePrefix = "$",
  showLegend = false,
  decorativeDots = true,
  defaultRange = "3M",
  chartType: controlledType,
  onChartTypeChange,
  showCompareOption = false,
}: {
  series: ChartSeries[];
  /** Real open/high/low/close for the primary instrument -- enables the
   * Candlestick chart type. Omit when the series isn't a single tradable
   * instrument (e.g. total portfolio value has no meaningful OHLC). */
  ohlc?: OhlcPoint[];
  valuePrefix?: string;
  showLegend?: boolean;
  decorativeDots?: boolean;
  defaultRange?: RangeLabel;
  /** Pass both to let a parent own chart-type state (e.g. to show a
   * "compare with another stock" panel when Compare is selected). Omit
   * both to let the chart manage its own type state internally. */
  chartType?: ChartType;
  onChartTypeChange?: (type: ChartType) => void;
  /** Shows a 4th "Compare" button in the type toggle -- purely a UI signal;
   * rendering-wise Compare behaves identically to Line (the parent is
   * responsible for adding a second series and reacting to the selection). */
  showCompareOption?: boolean;
}) {
  const uid = useId();
  const [range, setRange] = useState<RangeLabel>(defaultRange);
  const [internalType, setInternalType] = useState<ChartType>("line");
  const chartType = controlledType ?? internalType;
  const setChartType = onChartTypeChange ?? setInternalType;
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
  const filteredOhlc = useMemo(() => (ohlc ? filterByRange(ohlc, range, anchor) : []), [ohlc, range, anchor]);

  const isCandlestick = chartType === "candlestick" && filteredOhlc.length >= 2;

  const allValues = isCandlestick
    ? filteredOhlc.flatMap((p) => [p.high, p.low])
    : filteredSeries.flatMap((s) => s.points.map((p) => p.value));
  const min = allValues.length ? Math.min(...allValues) : 0;
  const max = allValues.length ? Math.max(...allValues) : 1;
  const valueRange = max - min || 1;

  const plotW = WIDTH - PADDING.left - PADDING.right;
  const plotH = HEIGHT - PADDING.top - PADDING.bottom;

  function toXAt<T>(points: T[], i: number): number {
    return points.length > 1 ? (i / (points.length - 1)) * plotW + PADDING.left : PADDING.left;
  }
  function toY(value: number): number {
    return HEIGHT - PADDING.bottom - ((value - min) / valueRange) * plotH;
  }

  const primaryPoints = filteredSeries[0]?.points ?? [];
  const hoverBasisLength = isCandlestick ? filteredOhlc.length : primaryPoints.length;

  const scatteredDots = useMemo(() => {
    if (!decorativeDots) return [];
    return Array.from({ length: 28 }, (_, i) => ({
      x: PADDING.left + 20 + ((i * 37) % (plotW - 40)) + (((i * 53) % 30) - 15),
      y: PADDING.top + 10 + (((i * 29) % (plotH - 40)) || 0) + (((i * 17) % 20) - 10),
      opacity: 0.15 + ((i * 7) % 10) / 40,
      size: 1 + ((i * 3) % 3) * 0.5,
    }));
  }, [decorativeDots, plotW, plotH]);

  function handleMoveAtX(clientX: number) {
    if (!svgRef.current || hoverBasisLength === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = ((clientX - rect.left) / rect.width) * WIDTH;
    const idx = Math.round(((relX - PADDING.left) / plotW) * (hoverBasisLength - 1));
    const clamped = Math.max(0, Math.min(hoverBasisLength - 1, idx));
    const dateSource = isCandlestick ? filteredOhlc : primaryPoints;
    setHoverDate(new Date(dateSource[clamped].date));
  }

  function handleMouseMove(e: MouseEvent<SVGSVGElement>) {
    handleMoveAtX(e.clientX);
  }

  // Touch equivalent of hover, so the price tooltip works on phones/tablets
  // (the SVG has no mouse events there) -- same finger-hold-to-scrub feel.
  function handleTouchMove(e: TouchEvent<SVGSVGElement>) {
    const touch = e.touches[0];
    if (touch) handleMoveAtX(touch.clientX);
  }

  if (primaryPoints.length < 2) {
    return <p className="text-sm text-ink-500">Not enough history yet to chart a trend.</p>;
  }

  const hoverPointsBySeries = hoverDate
    ? filteredSeries.map((s) => ({ series: s, point: nearestByDate(s.points, hoverDate) }))
    : [];
  const hoverOhlc = hoverDate && isCandlestick ? nearestByDate(filteredOhlc, hoverDate) : null;

  const typeOptions: Array<{ value: ChartType; label: string }> = [
    { value: "line", label: "Line" },
    { value: "bar", label: "Bar" },
    ...(ohlc && ohlc.length >= 2 ? [{ value: "candlestick" as ChartType, label: "Candles" }] : []),
    ...(showCompareOption ? [{ value: "compare" as ChartType, label: "Compare" }] : []),
  ];

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

      <div className="mb-3 flex gap-1">
        {typeOptions.map((t) => (
          <button
            key={t.value}
            onClick={() => setChartType(t.value)}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold transition-all duration-150 ease-out active:scale-[0.95] ${
              chartType === t.value
                ? "border-teal-600 bg-teal-600 text-white shadow-sm"
                : "border-line text-ink-500 hover:-translate-y-0.5 hover:border-teal-600 hover:text-ink-900"
            }`}
          >
            {TYPE_ICONS[t.value]}
            {t.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full cursor-crosshair"
          role="img"
          aria-label="Price chart, interactive"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverDate(null)}
          onTouchStart={handleTouchMove}
          onTouchMove={handleTouchMove}
          onTouchEnd={() => setHoverDate(null)}
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

          {(isCandlestick ? filteredOhlc.map((p) => p.date) : primaryPoints.map((p) => p.date)).map((date, i, arr) => (
            <line
              key={date}
              x1={toXAt(arr, i)}
              y1={PADDING.top}
              x2={toXAt(arr, i)}
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

          {isCandlestick &&
            (() => {
              const candleWidth = Math.max(2, Math.min(14, plotW / filteredOhlc.length - 3));
              return filteredOhlc.map((p, i) => {
                const x = toXAt(filteredOhlc, i);
                const up = p.close >= p.open;
                const color = up ? "var(--good-600)" : "var(--crit-600)";
                const bodyTop = toY(Math.max(p.open, p.close));
                const bodyBottom = toY(Math.min(p.open, p.close));
                return (
                  <g key={p.date}>
                    <line x1={x} y1={toY(p.high)} x2={x} y2={toY(p.low)} style={{ stroke: color }} strokeWidth="1" />
                    <rect
                      x={x - candleWidth / 2}
                      y={bodyTop}
                      width={candleWidth}
                      height={Math.max(1, bodyBottom - bodyTop)}
                      style={{ fill: color }}
                    />
                  </g>
                );
              });
            })()}

          {chartType === "bar" &&
            primaryPoints.map((p, i) => {
              const x = toXAt(primaryPoints, i);
              const barWidth = Math.max(2, Math.min(16, plotW / primaryPoints.length - 3));
              const y = toY(p.value);
              return (
                <rect
                  key={p.date}
                  x={x - barWidth / 2}
                  y={y}
                  width={barWidth}
                  height={Math.max(1, HEIGHT - PADDING.bottom - y)}
                  style={{ fill: series[0]?.color ?? "var(--teal-600)" }}
                  opacity={0.85}
                />
              );
            })}

          {(chartType === "line" || chartType === "compare") &&
            filteredSeries.map((s, si) => {
              const coords = s.points.map((p, i) => [toXAt(s.points, i), toY(p.value)] as [number, number]);
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

          {chartType === "bar" &&
            filteredSeries.slice(1).map((s, si) => {
              const coords = s.points.map((p, i) => [toXAt(s.points, i), toY(p.value)] as [number, number]);
              return (
                <path
                  key={si}
                  d={smoothPath(coords)}
                  fill="none"
                  style={{ stroke: s.color }}
                  strokeWidth={2}
                  strokeDasharray={s.dashed ? "6 5" : undefined}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              );
            })}

          {hoverDate && !isCandlestick &&
            hoverPointsBySeries.map(
              ({ series: s, point }, si) =>
                point && (
                  <g key={si}>
                    {si === 0 && (
                      <line
                        x1={toXAt(s.points, s.points.indexOf(point))}
                        y1={PADDING.top}
                        x2={toXAt(s.points, s.points.indexOf(point))}
                        y2={HEIGHT - PADDING.bottom}
                        style={{ stroke: "var(--line)" }}
                        strokeWidth="1"
                      />
                    )}
                    <circle
                      cx={toXAt(s.points, s.points.indexOf(point))}
                      cy={toY(point.value)}
                      r="10"
                      style={{ fill: s.color }}
                      opacity="0.15"
                    />
                    <circle
                      cx={toXAt(s.points, s.points.indexOf(point))}
                      cy={toY(point.value)}
                      r="4.5"
                      style={{ fill: "var(--paper-0)", stroke: s.color }}
                      strokeWidth="2.5"
                      filter={`url(#${uid}-glow)`}
                    />
                  </g>
                )
            )}

          {hoverDate && isCandlestick && hoverOhlc && (
            <line
              x1={toXAt(filteredOhlc, filteredOhlc.indexOf(hoverOhlc))}
              y1={PADDING.top}
              x2={toXAt(filteredOhlc, filteredOhlc.indexOf(hoverOhlc))}
              y2={HEIGHT - PADDING.bottom}
              style={{ stroke: "var(--line)" }}
              strokeWidth="1"
            />
          )}
        </svg>

        {hoverDate && !isCandlestick && hoverPointsBySeries[0]?.point &&
          (() => {
            const p = hoverPointsBySeries[0].point!;
            const x = toXAt(hoverPointsBySeries[0].series.points, hoverPointsBySeries[0].series.points.indexOf(p));
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
                          {sp.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      )
                  )}
                  <div className="absolute left-1/2 -bottom-1.5 h-3 w-3 -translate-x-1/2 rotate-45 bg-ink-900 dark:bg-paper-0" />
                </div>
              </div>
            );
          })()}

        {hoverDate && isCandlestick && hoverOhlc &&
          (() => {
            const x = toXAt(filteredOhlc, filteredOhlc.indexOf(hoverOhlc));
            const y = toY(hoverOhlc.high);
            return (
              <div
                className="pointer-events-none absolute transition-all duration-100 ease-out"
                style={{
                  left: `${(x / WIDTH) * 100}%`,
                  top: `${(y / HEIGHT) * 100}%`,
                  transform: "translate(-50%, -110%)",
                }}
              >
                <div className="relative rounded-lg bg-ink-900 px-3 py-1.5 shadow-lg dark:bg-paper-0">
                  <p className="text-xs font-semibold whitespace-nowrap text-paper-0 dark:text-ink-900">
                    {new Date(hoverOhlc.date).toLocaleDateString()}
                  </p>
                  <p className="text-xs whitespace-nowrap text-paper-0/90 dark:text-ink-900/80">
                    O {valuePrefix}
                    {hoverOhlc.open.toFixed(2)} · H {valuePrefix}
                    {hoverOhlc.high.toFixed(2)}
                  </p>
                  <p className="text-xs whitespace-nowrap text-paper-0/90 dark:text-ink-900/80">
                    L {valuePrefix}
                    {hoverOhlc.low.toFixed(2)} · C {valuePrefix}
                    {hoverOhlc.close.toFixed(2)}
                  </p>
                  <div className="absolute left-1/2 -bottom-1.5 h-3 w-3 -translate-x-1/2 rotate-45 bg-ink-900 dark:bg-paper-0" />
                </div>
              </div>
            );
          })()}
      </div>
    </div>
  );
}
