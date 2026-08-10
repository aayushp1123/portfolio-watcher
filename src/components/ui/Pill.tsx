type Tone = "good" | "warn" | "crit" | "neutral";

const toneClasses: Record<Tone, string> = {
  good: "bg-good-100 text-good-800",
  warn: "bg-warn-100 text-warn-800",
  crit: "bg-crit-100 text-crit-800",
  neutral: "bg-teal-100 text-teal-700",
};

export function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}
