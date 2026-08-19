"use client";

import type { DailyDigest } from "@/lib/reports/schemas";
import { ReportRow, ReportCallout } from "@/components/ui/ReportSection";
import { Pill } from "@/components/ui/Pill";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { TickerButton } from "@/components/dashboard/TickerButton";

const riskTone = { Low: "good", Medium: "warn", High: "crit" } as const;
const exitTone = { ok: "neutral", approaching: "warn", triggered: "crit", none: "neutral" } as const;
const exitLabel = { ok: "On Track", approaching: "Approaching", triggered: "Triggered", none: "" } as const;
const ratingTone = { Buy: "good", Hold: "warn", Sell: "crit" } as const;

export function DailyDigestView({ report }: { report: DailyDigest }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-x-10 gap-y-4">
        <InfoTooltip
          label={
            <>
              <p className="font-semibold text-ink-900">Total Value</p>
              <p className="mt-1 text-ink-500">
                The live market value of everything in your connected brokerage account right now.
              </p>
            </>
          }
        >
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-500">Total Value</p>
            <p className="mt-1 font-[family-name:var(--font-heading)] text-2xl font-bold text-ink-900">
              {report.hasBrokerageConnection
                ? `$${report.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : "N/A"}
            </p>
          </div>
        </InfoTooltip>
        <InfoTooltip
          label={
            <>
              <p className="font-semibold text-ink-900">Overall Gain/Loss</p>
              <p className="mt-1 text-ink-500">
                Your total unrealized gain or loss across all holdings, weighted by position size, compared to what
                you originally paid.
              </p>
            </>
          }
        >
          <div>
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
          </div>
        </InfoTooltip>
        <InfoTooltip
          label={
            <>
              <p className="font-semibold text-ink-900">Cash Available</p>
              <p className="mt-1 text-ink-500">
                Uninvested cash sitting in your brokerage account, ready to deploy toward a new position.
              </p>
            </>
          }
        >
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-500">Cash Available</p>
            <p className="mt-1 font-[family-name:var(--font-heading)] text-2xl font-bold text-ink-900">
              {report.cashAvailable != null
                ? `$${report.cashAvailable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : "N/A"}
            </p>
          </div>
        </InfoTooltip>
      </div>

      <p className="text-sm text-ink-700">{report.portfolioSummary}</p>

      {report.holdings.length > 0 && (
        <section>
          <h2 className="mb-3 font-[family-name:var(--font-heading)] text-lg font-bold text-ink-900">
            Your Holdings
          </h2>
          <div className="flex flex-col">
            {report.holdings.map((h) => (
              <ReportRow key={h.ticker}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <TickerButton
                    ticker={h.ticker}
                    className="font-[family-name:var(--font-heading)] text-lg font-bold text-ink-900"
                  />
                  <div className="flex items-center gap-2">
                    {h.exitRuleStatus && h.exitRuleStatus.status !== "none" && (
                      <InfoTooltip label={h.exitRuleStatus.message}>
                        <Pill tone={exitTone[h.exitRuleStatus.status]}>{exitLabel[h.exitRuleStatus.status]}</Pill>
                      </InfoTooltip>
                    )}
                    <InfoTooltip
                      label={
                        <>
                          <p className="font-semibold text-ink-900">{h.rating} rating</p>
                          <p className="mt-1 text-ink-500">{h.ratingReason}</p>
                        </>
                      }
                    >
                      <Pill tone={ratingTone[h.rating]}>{h.rating}</Pill>
                    </InfoTooltip>
                    <InfoTooltip
                      label={
                        <>
                          <p className="font-semibold text-ink-900">{h.riskRating} risk</p>
                          <p className="mt-1 text-ink-500">{h.riskReason}</p>
                        </>
                      }
                    >
                      <Pill tone={riskTone[h.riskRating]}>{h.riskRating} risk</Pill>
                    </InfoTooltip>
                  </div>
                </div>
                <InfoTooltip
                  label={
                    <>
                      <p className="font-semibold text-ink-900">Gain/Loss</p>
                      <p className="mt-1 text-ink-500">
                        Unrealized {h.gainLossPct != null && h.gainLossPct >= 0 ? "gain" : "loss"} vs. your cost
                        basis for this position.
                      </p>
                    </>
                  }
                >
                  <p className="mt-2 text-sm text-ink-700">
                    {h.shares} shares · $
                    {h.marketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    {h.gainLossPct != null && (
                      <span className={h.gainLossPct >= 0 ? "text-good-600" : "text-crit-600"}>
                        {" "}
                        ({h.gainLossPct >= 0 ? "+" : ""}
                        {h.gainLossPct.toFixed(1)}%)
                      </span>
                    )}
                  </p>
                </InfoTooltip>
                <p className="mt-1 text-sm text-ink-700">{h.ratingReason}</p>
                <p className="mt-1 text-sm text-ink-500">{h.riskReason}</p>
                {h.exitRuleStatus && h.exitRuleStatus.status !== "none" && (
                  <p className="mt-1 text-sm text-ink-700">{h.exitRuleStatus.message}</p>
                )}
                {h.taxNote && <p className="mt-1 text-sm text-warn-800">{h.taxNote}</p>}
              </ReportRow>
            ))}
          </div>
        </section>
      )}

      {report.watchlistItems.length > 0 && (
        <section>
          <h2 className="mb-3 font-[family-name:var(--font-heading)] text-lg font-bold text-ink-900">
            Watchlist
          </h2>
          <div className="flex flex-col">
            {report.watchlistItems.map((w) => (
              <ReportRow key={w.ticker}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <TickerButton
                    ticker={w.ticker}
                    className="font-[family-name:var(--font-heading)] text-lg font-bold text-ink-900"
                  />
                  <div className="flex items-center gap-2">
                    <InfoTooltip
                      label={
                        <>
                          <p className="font-semibold text-ink-900">{w.rating} rating</p>
                          <p className="mt-1 text-ink-500">{w.ratingReason}</p>
                        </>
                      }
                    >
                      <Pill tone={ratingTone[w.rating]}>{w.rating}</Pill>
                    </InfoTooltip>
                    <InfoTooltip
                      label={
                        <>
                          <p className="font-semibold text-ink-900">{w.riskRating} risk</p>
                          <p className="mt-1 text-ink-500">{w.riskReason}</p>
                        </>
                      }
                    >
                      <Pill tone={riskTone[w.riskRating]}>{w.riskRating} risk</Pill>
                    </InfoTooltip>
                  </div>
                </div>
                {w.approxPrice != null && (
                  <p className="mt-2 text-sm text-ink-700">
                    ~${w.approxPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                )}
                <p className="mt-1 text-sm text-ink-700">{w.summary}</p>
                <p className="mt-1 text-sm text-ink-700">{w.ratingReason}</p>
                <p className="mt-1 text-sm text-ink-500">{w.riskReason}</p>
              </ReportRow>
            ))}
          </div>
        </section>
      )}

      {report.dividendNotes.length > 0 && (
        <section>
          <h2 className="mb-2 font-[family-name:var(--font-heading)] text-lg font-bold text-ink-900">
            Dividends
          </h2>
          <ul className="flex flex-col gap-1.5 text-sm text-ink-700">
            {report.dividendNotes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 font-[family-name:var(--font-heading)] text-lg font-bold text-ink-900">
          Bottom Line
        </h2>
        <ReportCallout>
          <p className="text-sm text-ink-900">{report.bottomLine}</p>
        </ReportCallout>
      </section>

      <ReportCallout>
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-600">
          What to Watch Next
        </p>
        <p className="mt-2 text-sm text-ink-700">{report.whatToWatchNext}</p>
      </ReportCallout>

      <p className="text-center text-xs text-ink-500">
        Prices are live from the market at generation time — ratings, risk assessments, and analysis
        are Gemini&apos;s own reasoning grounded in that live data. This is not financial advice.
      </p>
    </div>
  );
}
