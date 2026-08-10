import type { BreakingNews } from "@/lib/reports/schemas";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";

const riskTone = { Low: "good", Medium: "warn", High: "crit" } as const;

export function BreakingNewsStatusCard({
  hasChecked,
  report,
  notConfiguredMessage,
}: {
  hasChecked: boolean;
  report: BreakingNews | null;
  notConfiguredMessage: string;
}) {
  return (
    <Card className="flex items-center gap-3">
      <span
        className={`h-2.5 w-2.5 rounded-full ${
          report?.hasMaterialEvents ? "bg-warn-600" : "bg-good-600"
        }`}
      />
      <div>
        <p className="font-[family-name:var(--font-heading)] font-bold text-ink-900">
          {!hasChecked ? "Not checked yet" : report?.hasMaterialEvents ? "Something happened" : "All quiet"}
        </p>
        <p className="text-sm text-ink-500">
          {!hasChecked
            ? notConfiguredMessage
            : report?.hasMaterialEvents
              ? "See the latest alert below."
              : "No material news or big moves on the last check."}
        </p>
      </div>
    </Card>
  );
}

export function BreakingNewsAlerts({ report }: { report: BreakingNews }) {
  if (!report.hasMaterialEvents || report.alerts.length === 0) return null;
  return (
    <section className="mt-6">
      <h2 className="mb-3 font-[family-name:var(--font-heading)] text-lg font-bold text-ink-900">
        Most Recent Items
      </h2>
      <div className="flex flex-col gap-3">
        {report.alerts.map((alert, i) => (
          <Card key={i} className="border-l-4 border-l-teal-600">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-[family-name:var(--font-heading)] font-bold text-ink-900">
                {alert.ticker ?? "Market"}: {alert.headline}
              </span>
              <Pill tone={riskTone[alert.riskRating]}>{alert.riskRating} risk</Pill>
            </div>
            <p className="mt-2 text-sm text-ink-700">{alert.whatHappened}</p>
            <p className="mt-1 text-sm text-ink-500">{alert.whyItMatters}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
