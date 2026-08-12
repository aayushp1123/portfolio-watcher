"use client";

import type { WeeklyTrends } from "@/lib/reports/schemas";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
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
          <Card>
            <div className="flex h-8 overflow-hidden rounded-lg border border-line">
              <div
                className="flex items-center justify-center bg-teal-600 text-xs font-bold text-white"
                style={{ width: `${report.allocationCheck.actualCoreEtfPct}%` }}
              >
                {report.allocationCheck.actualCoreEtfPct.toFixed(0)}%
              </div>
              <div
                className="flex items-center justify-center bg-good-600 text-xs font-bold text-white"
                style={{ width: `${report.allocationCheck.actualGrowthPct}%` }}
              >
                {report.allocationCheck.actualGrowthPct.toFixed(0)}%
              </div>
              <div
                className="flex items-center justify-center bg-warn-600 text-xs font-bold text-white"
                style={{ width: `${report.allocationCheck.actualSpeculativePct}%` }}
              >
                {report.allocationCheck.actualSpeculativePct.toFixed(0)}%
              </div>
            </div>
            <p className="mt-3 text-sm text-ink-700">{report.allocationCheck.summary}</p>
          </Card>
        </section>
      ) : (
        <Card>
          <p className="text-sm text-ink-700">
            No brokerage account connected yet, so there&apos;s no real allocation to check —
            add tickers to your watchlist below or connect an account in Settings.
          </p>
        </Card>
      )}

      <section>
        <h2 className="mb-3 font-[family-name:var(--font-heading)] text-lg font-bold text-ink-900">
          This Week&apos;s Trends
        </h2>
        <div className="flex flex-col gap-3">
          {report.marketTrends.map((t, i) => (
            <Card key={i}>
              <h3 className="font-[family-name:var(--font-heading)] font-bold text-ink-900">{t.title}</h3>
              <p className="mt-1 text-sm text-ink-700">{t.summary}</p>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-[family-name:var(--font-heading)] text-lg font-bold text-ink-900">
          New Stock &amp; ETF Ideas
        </h2>
        <div className="flex flex-col gap-3">
          {report.newIdeas.map((idea) => (
            <Card key={idea.ticker}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <TickerButton
                  ticker={idea.ticker}
                  className="font-[family-name:var(--font-heading)] text-lg font-bold text-ink-900"
                />
                <div className="flex items-center gap-2">
                  <Pill tone="neutral">{bucketLabel[idea.bucket]}</Pill>
                  <Pill tone={ratingTone[idea.rating]}>{idea.rating}</Pill>
                  <Pill tone={riskTone[idea.riskRating]}>{idea.riskRating} risk</Pill>
                </div>
              </div>
              <p className="mt-2 text-sm text-ink-700">{idea.whatItDoes}</p>
              <p className="mt-1 text-sm text-ink-500">{idea.whyNow}</p>
              <p className="mt-1 text-sm text-ink-700">{idea.ratingReason}</p>
              <p className="mt-1 text-xs text-ink-500">
                {idea.horizon === "long-term" ? "Long-term hold" : "Shorter-term / opportunistic"}
              </p>
            </Card>
          ))}
        </div>
      </section>

      {report.watchlistItems.length > 0 && (
        <section>
          <h2 className="mb-3 font-[family-name:var(--font-heading)] text-lg font-bold text-ink-900">
            Your Watchlist
          </h2>
          <div className="flex flex-col gap-3">
            {report.watchlistItems.map((w) => (
              <Card key={w.ticker}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <TickerButton
                    ticker={w.ticker}
                    className="font-[family-name:var(--font-heading)] text-lg font-bold text-ink-900"
                  />
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

      <p className="text-center text-xs text-ink-500">
        Prices are live from the market at generation time — ratings, risk assessments, and analysis
        are Gemini&apos;s own reasoning grounded in that live data. This is not financial advice.
      </p>
    </div>
  );
}
