import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { LocalTime } from "@/components/ui/LocalTime";
import type { TrackRecordEntry } from "@/lib/reports/trackRecord";

const ASSESSMENT_TONE: Record<TrackRecordEntry["assessment"], "good" | "crit" | "neutral"> = {
  "on-track": "good",
  "off-track": "crit",
  inconclusive: "neutral",
};

const ASSESSMENT_LABEL: Record<TrackRecordEntry["assessment"], string> = {
  "on-track": "On track",
  "off-track": "Off track",
  inconclusive: "Too early to tell",
};

export function RatingTrackRecord({
  entries,
  accuratePct,
}: {
  entries: TrackRecordEntry[];
  accuratePct: number | null;
}) {
  if (entries.length === 0) return null;

  return (
    <Card>
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-ink-900">
          Rating Track Record
        </h2>
        {accuratePct != null && (
          <span className="text-sm font-semibold text-ink-700">{accuratePct.toFixed(0)}% on track</span>
        )}
      </div>
      <p className="mb-3 text-xs text-ink-500">
        How past Buy/Hold/Sell calls have held up against real live prices since. Ratings younger than 7 days
        aren&apos;t scored yet.
      </p>
      <div className="flex flex-col gap-2">
        {entries.slice(0, 12).map((e) => (
          <div
            key={`${e.ticker}-${e.ratedAt}`}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-ink-900">{e.ticker}</span>
              <Pill tone="neutral">{e.rating}</Pill>
              <span className="text-xs text-ink-500">
                since <LocalTime date={e.ratedAt} dateOnly />
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-semibold ${e.pctChange >= 0 ? "text-good-600" : "text-crit-600"}`}>
                {e.pctChange >= 0 ? "+" : ""}
                {e.pctChange.toFixed(1)}%
              </span>
              <Pill tone={ASSESSMENT_TONE[e.assessment]}>{ASSESSMENT_LABEL[e.assessment]}</Pill>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
