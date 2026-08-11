export function HeroChart() {
  return (
    <svg
      viewBox="0 0 560 220"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full max-w-xl"
      role="img"
      aria-label="Portfolio value trending upward over time"
    >
      <defs>
        <linearGradient id="heroChartFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style={{ stopColor: "var(--teal-600)", stopOpacity: 0.22 }} />
          <stop offset="100%" style={{ stopColor: "var(--teal-600)", stopOpacity: 0 }} />
        </linearGradient>
      </defs>

      {[44, 84, 124, 164].map((y) => (
        <line key={y} x1="0" y1={y} x2="560" y2={y} style={{ stroke: "var(--line)" }} strokeWidth="1" />
      ))}

      <path
        d="M0 176 L70 158 L140 168 L210 122 L280 134 L350 88 L420 100 L490 54 L560 40 L560 220 L0 220 Z"
        fill="url(#heroChartFill)"
      />
      <path
        d="M0 176 L70 158 L140 168 L210 122 L280 134 L350 88 L420 100 L490 54 L560 40"
        style={{ stroke: "var(--teal-600)" }}
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {[
        [0, 176],
        [140, 168],
        [280, 134],
        [420, 100],
        [560, 40],
      ].map(([cx, cy]) => (
        <circle
          key={cx}
          cx={cx}
          cy={cy}
          r="4"
          style={{ fill: "var(--paper-0)", stroke: "var(--teal-600)" }}
          strokeWidth="2.5"
        />
      ))}
    </svg>
  );
}
