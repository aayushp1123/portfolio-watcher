import { Card } from "@/components/ui/Card";

export function PortfolioValueChart({ points }: { points: Array<{ date: string; value: number }> }) {
  if (points.length < 2) return null;

  const width = 560;
  const height = 160;
  const padding = 8;

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * (width - padding * 2) + padding;
    const y = height - padding - ((p.value - min) / range) * (height - padding * 2);
    return [x, y] as const;
  });

  const linePath = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${coords[coords.length - 1][0].toFixed(1)} ${height} L${coords[0][0].toFixed(1)} ${height} Z`;

  const first = points[0];
  const last = points[points.length - 1];
  const pctChange = first.value !== 0 ? ((last.value - first.value) / first.value) * 100 : 0;

  return (
    <Card>
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-ink-900">
          Portfolio Value Over Time
        </h2>
        <span className={`text-sm font-semibold ${pctChange >= 0 ? "text-good-600" : "text-crit-600"}`}>
          {pctChange >= 0 ? "+" : ""}
          {pctChange.toFixed(1)}%
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Portfolio value trend over time">
        <defs>
          <linearGradient id="portfolioValueFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: "var(--teal-600)", stopOpacity: 0.2 }} />
            <stop offset="100%" style={{ stopColor: "var(--teal-600)", stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#portfolioValueFill)" />
        <path
          d={linePath}
          fill="none"
          style={{ stroke: "var(--teal-600)" }}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <div className="mt-1 flex justify-between text-xs text-ink-500">
        <span>
          {new Date(first.date).toLocaleDateString()} · $
          {first.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </span>
        <span>
          {new Date(last.date).toLocaleDateString()} · $
          {last.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </span>
      </div>
    </Card>
  );
}
