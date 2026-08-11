type IconProps = { className?: string };

const shared = {
  width: 32,
  height: 32,
  viewBox: "0 0 32 32",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
};

export function IconDigest({ className }: IconProps) {
  return (
    <svg {...shared} className={className} aria-hidden="true">
      <rect x="4" y="4" width="24" height="24" rx="4" stroke="var(--teal-600)" strokeWidth="1.75" />
      <path d="M10 20V15" stroke="var(--teal-600)" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M16 20V11" stroke="var(--teal-600)" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M22 20V17" stroke="var(--teal-600)" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function IconTrends({ className }: IconProps) {
  return (
    <svg {...shared} className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="11" stroke="var(--line)" strokeWidth="3" />
      <path
        d="M16 5a11 11 0 0 1 9.53 16.5"
        stroke="var(--teal-600)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path d="M16 5a11 11 0 0 0-5.5 20.5" stroke="var(--good-600)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function IconNews({ className }: IconProps) {
  return (
    <svg {...shared} className={className} aria-hidden="true">
      <path
        d="M5 17c0-6.075 4.925-11 11-11s11 4.925 11 11"
        stroke="var(--line)"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M9.5 17a6.5 6.5 0 0 1 13 0"
        stroke="var(--teal-600)"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <circle cx="16" cy="17" r="2.25" fill="var(--teal-600)" />
      <path d="M16 17V24" stroke="var(--teal-600)" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}
