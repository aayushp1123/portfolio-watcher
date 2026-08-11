export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect x="0.5" y="0.5" width="27" height="27" rx="7" style={{ stroke: "var(--teal-600)" }} />
      <path
        d="M6 19 L11 14 L15 17 L22 8"
        style={{ stroke: "var(--teal-600)" }}
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
