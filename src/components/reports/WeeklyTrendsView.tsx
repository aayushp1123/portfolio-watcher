"use client";

import type { WeeklyTrends } from "@/lib/reports/schemas";
import { ReportRow } from "@/components/ui/ReportSection";
import { Pill } from "@/components/ui/Pill";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { TickerButton } from "@/components/dashboard/TickerButton";

const riskTone = { Low: "good", Medium: "warn", High: "crit" } as const;
const ratingTone = { Buy: "good", Hold: "warn", Sell: "crit" } as const;
const bucketLabel = {
  CORE_ETF: "Core ETF",
  INDIVIDUAL_GROWTH: "Individual Growth",
  SPECULATIVE: "Speculative",
} as const;

export function WeeklyTrendsView({ report }: { report: WeeklyTrends }) {
  return (
    <div className="flex flex-col gap-6">
      {report.hasBrokerageConnection ? (
        <section>
          <h2 className="mb-3 font-[family-name:var(--font-heading)] text-lg font-bold text-ink-900">
            Portfolio Allocation Check
          </h2>
          <div>
            <div className="flex h-8 overflow-hidden rounded-lg border border-line">
              <InfoTooltip
                className="h-8"
                style={{ width: `${report.allocationCheck.actualCoreEtfPct}%` }}
                label={
                  <>
                    <p className="font-semibold text-ink-900">Core ETFs</p>
                    <p className="mt-1 text-ink-500">
                      Broad-market/dividend ETFs. Target: {report.allocationCheck.targetCoreEtfPct}% · Actual:{" "}
                      {report.allocationCheck.actualCoreEtfPct.toFixed(0)}%
                    </p>
                  </>
                }
              >
                <div className="flex h-8 w-full items-center justify-center bg-teal-600 text-xs font-bold text-white">
                  {report.allocationCheck.actualCoreEtfPct.toFixed(0)}%
                </div>
              </InfoTooltip>
              <InfoTooltip
                className="h-8"
                style={{ width: `${report.allocationCheck.actualGrowthPct}%` }}
                label={
                  <>
                    <p className="font-semibold text-ink-900">Individual Growth</p>
                    <p className="mt-1 text-ink-500">
                      Established individual growth companies. Target: {report.allocationCheck.targetGrowthPct}% ·
                      Actual: {report.allocationCheck.actualGrowthPct.toFixed(0)}%
                    </p>
                  </>
                }
              >
                <div className="flex h-8 w-full items-center justify-center bg-good-600 text-xs font-bold text-white">
                  {report.allocationCheck.actualGrowthPct.toFixed(0)}%
                </div>
              </InfoTooltip>
              <InfoTooltip
                className="h-8"
                style={{ width: `${report.allocationCheck.actualSpeculativePct}%` }}
                label={
                  <>
                    <p className="font-semibold text-ink-900">Speculative</p>
                    <p className="mt-1 text-ink-500">
                      Smaller/higher-risk individual companies. Target: {report.allocationCheck.targetSpeculativePct}%
                      · Actual: {report.allocationCheck.actualSpeculativePct.toFixed(0)}%
                    </p>
                  </>
                }
              >
                <div className="flex h-8 w-full items-center justify-center bg-warn-600 text-xs font-bold text-white">
                  {report.allocationCheck.actualSpeculativePct.toFixed(0)}%
                </div>
              </InfoTooltip>
            </div>
            <p className="mt-3 text-sm text-ink-700">{report.allocationCheck.summary}</p>
          </div>
        </section>
      ) : (
        <p className="text-sm text-ink-700">
          No brokerage account connected yet, so there&apos;s no real allocation to check —
          add tickers to your watchlist below or connect an account in Settings.
        </p>
      )}

      <section>
        <h2 className="mb-3 font-[family-name:var(--font-heading)] text-lg font-bold text-ink-900">
          This Week&apos;s Trends
        </h2>
        <div className="flex flex-col">
          {report.marketTrends.map((t, i) => (
            <ReportRow key={i}>
              <h3 className="font-[family-name:var(--font-heading)] font-bold text-ink-900">{t.title}</h3>
              <p className="mt-1 text-sm text-ink-700">{t.summary}</p>
            </ReportRow>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-[family-name:var(--font-heading)] text-lg font-bold text-ink-900">
          New Stock &amp; ETF Ideas
        </h2>
        <div className="flex flex-col">
          {report.newIdeas.map((idea) => (
            <ReportRow key={idea.ticker}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <TickerButton
                  ticker={idea.ticker}
                  className="font-[family-name:var(--font-heading)] text-lg font-bold text-ink-900"
                />
                <div className="flex items-center gap-2">
                  <InfoTooltip label={`One of your three allocation buckets: ${bucketLabel[idea.bucket]}.`}>
                    <Pill tone="neutral">{bucketLabel[idea.bucket]}</Pill>
                  </InfoTooltip>
                  <InfoTooltip
                    label={
                      <>
                        <p className="font-semibold text-ink-900">{idea.rating} rating</p>
                        <p className="mt-1 text-ink-500">{idea.ratingReason}</p>
                      </>
                    }
                  >
                    <Pill tone={ratingTone[idea.rating]}>{idea.rating}</Pill>
                  </InfoTooltip>
                  <InfoTooltip
                    label={
                      <>
                        <p className="font-semibold text-ink-900">{idea.riskRating} risk</p>
                        <p className="mt-1 text-ink-500">{idea.riskReason}</p>
                      </>
                    }
                  >
                    <Pill tone={riskTone[idea.riskRating]}>{idea.riskRating} risk</Pill>
                  </InfoTooltip>
                </div>
              </div>
              <p className="mt-2 text-sm text-ink-700">{idea.whatItDoes}</p>
              <p className="mt-1 text-sm text-ink-500">{idea.whyNow}</p>
              <p className="mt-1 text-sm text-ink-700">{idea.ratingReason}</p>
              <p className="mt-1 text-xs text-ink-500">
                {idea.horizon === "long-term" ? "Long-term hold" : "Shorter-term / opportunistic"}
              </p>
            </ReportRow>
          ))}
        </div>
      </section>

      {report.watchlistItems.length > 0 && (
        <section>
          <h2 className="mb-3 font-[family-name:var(--font-heading)] text-lg font-bold text-ink-900">
            Your Watchlist
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
                  <p className="mt-2 text-sm text-ink-700">~${w.approxPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                )}
                <p className="mt-1 text-sm text-ink-700">{w.summary}</p>
                <p className="mt-1 text-sm text-ink-700">{w.ratingReason}</p>
                <p className="mt-1 text-sm text-ink-500">{w.riskReason}</p>
              </ReportRow>
            ))}
          </div>
        </section>
      )}

      <p className="text-center text-xs text-ink-500">
        Prices are live from the market at generation time — ratings, risk assessments, and analysis
        are Gemini&apos;s own reasoning grounded in that live data. This is not financial advice.
      </p>
    </div>
  );
}
