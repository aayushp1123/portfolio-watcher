import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAiConfigured } from "@/lib/gemini";
import type { DailyDigest } from "@/lib/reports/schemas";
import { getRatingTrackRecord } from "@/lib/reports/trackRecord";
import { diffRatings } from "@/lib/reports/reportDiff";
import { DailyDigestView } from "@/components/reports/DailyDigestView";
import { ReportPageHeader } from "@/components/dashboard/ReportPageHeader";
import { LocalTime } from "@/components/ui/LocalTime";
import { ReportDiffBanner } from "@/components/dashboard/ReportDiffBanner";
import { RatingTrackRecord } from "@/components/dashboard/RatingTrackRecord";
import { PortfolioValueChartExpandable } from "@/components/dashboard/PortfolioValueChartExpandable";
import { DAILY_DIGEST_SCHEDULE, getNextRun } from "@/lib/cronSchedule";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const userId = (session.user as { id: string }).id;
  const aiConfigured = isAiConfigured();

  const [history, trackRecord] = await Promise.all([
    prisma.report.findMany({
      where: { userId, type: "DAILY_DIGEST" },
      orderBy: { generatedAt: "desc" },
      take: 14,
    }),
    getRatingTrackRecord(userId),
  ]);
  const reportRow = history[0] ?? null;
  const report: DailyDigest | null = reportRow ? JSON.parse(reportRow.content) : null;
  const pastHistory = history.slice(1);

  const previousReport: DailyDigest | null = pastHistory[0] ? JSON.parse(pastHistory[0].content) : null;
  const ratingChanges =
    report && previousReport
      ? diffRatings(
          [...report.holdings, ...report.watchlistItems],
          [...previousReport.holdings, ...previousReport.watchlistItems]
        )
      : [];

  const valuePoints = history
    .map((h) => {
      const parsed: DailyDigest = JSON.parse(h.content);
      return parsed.hasBrokerageConnection ? { date: h.generatedAt.toISOString(), value: parsed.totalValue } : null;
    })
    .filter((p): p is { date: string; value: number } => p !== null)
    .reverse();

  return (
    <div className="flex flex-col">
      <ReportPageHeader
        eyebrow="Daily Portfolio Digest"
        title="Your Portfolio, Today"
        updatedAt={reportRow ? new Date(reportRow.generatedAt) : null}
        nextRun={getNextRun(DAILY_DIGEST_SCHEDULE)}
      />
      <div className="w-full px-4 pt-2 pb-10 sm:px-8">
      {!report ? (
        <p className="mt-6 text-sm text-ink-700">
          No digest yet.{" "}
          {aiConfigured
            ? "This generates automatically at market open and close on weekdays — check back after the next scheduled run."
            : "Once your Gemini API key is set and a brokerage account or watchlist ticker is added, this will populate automatically at market open and close on weekdays."}
        </p>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          <ReportDiffBanner changes={ratingChanges} />
          <PortfolioValueChartExpandable points={valuePoints} />
          <DailyDigestView report={report} />
          <RatingTrackRecord entries={trackRecord.entries} accuratePct={trackRecord.accuratePct} />
        </div>
      )}

      {pastHistory.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 font-[family-name:var(--font-heading)] text-lg font-bold text-ink-900">
            History
          </h2>
          <div className="flex flex-col">
            {pastHistory.map((h) => {
              const parsed: DailyDigest = JSON.parse(h.content);
              return (
                <details key={h.id} className="py-2.5">
                  <summary className="cursor-pointer text-sm font-semibold text-ink-900">
                    <LocalTime date={h.generatedAt} /> —{" "}
                    {parsed.hasBrokerageConnection
                      ? `$${parsed.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${
                          parsed.overallGainLossPct != null ? ` · ${parsed.overallGainLossPct.toFixed(1)}%` : ""
                        }`
                      : "Watchlist only"}
                  </summary>
                  <p className="mt-2 text-sm text-ink-700">{parsed.portfolioSummary}</p>
                  <p className="mt-1 text-sm text-ink-500">{parsed.bottomLine}</p>
                </details>
              );
            })}
          </div>
        </section>
      )}
      </div>
    </div>
  );
}
