import type { DailyDigest } from "@/lib/reports/schemas";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";

const riskTone = { Low: "good", Medium: "warn", High: "crit" } as const;
const exitTone = { ok: "neutral", approaching: "warn", triggered: "crit", none: "neutral" } as const;
const exitLabel = { ok: "On Track", approaching: "Approaching", triggered: "Triggered", none: "" } as const;
const ratingTone = { Buy: "good", Hold: "warn", Sell: "crit" } as const;

export function DailyDigestView({ report }: { report: DailyDigest }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-xs uppercase tracking-wide text-ink-500">Total Value</p>
          <p className="mt-1 font-[family-name:var(--font-heading)] text-2xl font-bold text-ink-900">
            {report.hasBrokerageConnection
              ? `$${report.totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
              : "N/A"}
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-ink-500">Overall Gain/Loss</p>
          <p
            className={`mt-1 font-[family-name:var(--font-heading)] text-2xl font-bold ${
              report.overallGainLossPct == null
                ? "text-ink-900"
                : report.overallGainLossPct >= 0
                  ? "text-good-600"
                  : "text-crit-600"
            }`}
          >
            {report.overallGainLossPct != null ? `${report.overallGainLossPct.toFixed(1)}%` : "N/A"}
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-ink-500">Cash Available</p>
          <p className="mt-1 font-[family-name:var(--font-heading)] text-2xl font-bold text-ink-900">
            {report.cashAvailable != null ? `$${report.cashAvailable.toLocaleString()}` : "N/A"}
          </p>
        </Card>
      </div>

      <Card>
        <p className="text-sm text-ink-700">{report.portfolioSummary}</p>
      </Card>

      {report.holdings.length > 0 && (
        <section>
          <h2 className="mb-3 font-[family-name:var(--font-heading)] text-lg font-bold text-ink-900">
            Your Holdings
          </h2>
          <div className="flex flex-col gap-3">
            {report.holdings.map((h) => (
              <Card key={h.ticker}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-[family-name:var(--font-heading)] text-lg font-bold text-ink-900">
                    {h.ticker}
                  </span>
                  <div className="flex items-center gap-2">
                    {h.exitRuleStatus && h.exitRuleStatus.status !== "none" && (
                      <Pill tone={exitTone[h.exitRuleStatus.status]}>{exitLabel[h.exitRuleStatus.status]}</Pill>
                    )}
                    <Pill tone={ratingTone[h.rating]}>{h.rating}</Pill>
                    <Pill tone={riskTone[h.riskRating]}>{h.riskRating} risk</Pill>
                  </div>
                </div>
                <p className="mt-2 text-sm text-ink-700">
                  {h.shares} shares · ${h.marketValue.toLocaleString()}
                  {h.gainLossPct != null && (
                    <span className={h.gainLossPct >= 0 ? "text-good-600" : "text-crit-600"}>
                      {" "}
                      ({h.gainLossPct >= 0 ? "+" : ""}
                      {h.gainLossPct.toFixed(1)}%)
                    </span>
                  )}
                </p>
                <p className="mt-1 text-sm text-ink-700">{h.ratingReason}</p>
                <p className="mt-1 text-sm text-ink-500">{h.riskReason}</p>
                {h.exitRuleStatus && h.exitRuleStatus.status !== "none" && (
                  <p className="mt-1 text-sm text-ink-700">{h.exitRuleStatus.message}</p>
                )}
                {h.taxNote && <p className="mt-1 text-sm text-warn-800">{h.taxNote}</p>}
              </Card>
            ))}
          </div>
        </section>
      )}

      {report.watchlistItems.length > 0 && (
        <section>
          <h2 className="mb-3 font-[family-name:var(--font-heading)] text-lg font-bold text-ink-900">
            Watchlist
          </h2>
          <div className="flex flex-col gap-3">
            {report.watchlistItems.map((w) => (
              <Card key={w.ticker}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-[family-name:var(--font-heading)] text-lg font-bold text-ink-900">
                    {w.ticker}
                  </span>
                  <div className="flex items-center gap-2">
                    <Pill tone={ratingTone[w.rating]}>{w.rating}</Pill>
                    <Pill tone={riskTone[w.riskRating]}>{w.riskRating} risk</Pill>
                  </div>
                </div>
                {w.approxPrice != null && (
                  <p className="mt-2 text-sm text-ink-700">~${w.approxPrice.toLocaleString()}</p>
                )}
                <p className="mt-1 text-sm text-ink-700">{w.summary}</p>
                <p className="mt-1 text-sm text-ink-700">{w.ratingReason}</p>
                <p className="mt-1 text-sm text-ink-500">{w.riskReason}</p>
              </Card>
            ))}
          </div>
        </section>
      )}

      {report.dividendNotes.length > 0 && (
        <section>
          <h2 className="mb-2 font-[family-name:var(--font-heading)] text-lg font-bold text-ink-900">
            Dividends
          </h2>
          <Card>
            <ul className="flex flex-col gap-1.5 text-sm text-ink-700">
              {report.dividendNotes.map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      <section>
        <h2 className="mb-2 font-[family-name:var(--font-heading)] text-lg font-bold text-ink-900">
          Bottom Line
        </h2>
        <Card className="bg-teal-100 border-none">
          <p className="text-sm text-ink-900">{report.bottomLine}</p>
        </Card>
      </section>

      <Card className="border-teal-600/30 bg-paper-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-600">
          What to Watch Next
        </p>
        <p className="mt-2 text-sm text-ink-700">{report.whatToWatchNext}</p>
      </Card>

      <p className="text-center text-xs text-ink-500">
        Prices may be inaccurate since this report doesn&apos;t use live market data — all ratings,
        risk assessments, and analysis are Gemini&apos;s own reasoning from general knowledge.
      </p>
    </div>
  );
}
