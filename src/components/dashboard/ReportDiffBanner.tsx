import { Pill } from "@/components/ui/Pill";
import type { RatingChange } from "@/lib/reports/reportDiff";

const RATING_TONE: Record<RatingChange["to"], "good" | "crit" | "neutral"> = {
  Buy: "good",
  Sell: "crit",
  Hold: "neutral",
};

export function ReportDiffBanner({ changes }: { changes: RatingChange[] }) {
  if (changes.length === 0) return null;

  return (
    <div className="mb-4 rounded-lg border border-line bg-paper-50 px-4 py-3">
      <p className="mb-2 text-xs font-semibold tracking-wide text-ink-500 uppercase">Since your last report</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {changes.map((c) => (
          <span key={c.ticker} className="inline-flex items-center gap-1.5 text-sm">
            <span className="font-semibold text-ink-900">{c.ticker}</span>
            <Pill tone="neutral">{c.from}</Pill>
            <span className="text-ink-500">&rarr;</span>
            <Pill tone={RATING_TONE[c.to]}>{c.to}</Pill>
          </span>
        ))}
      </div>
    </div>
  );
}
