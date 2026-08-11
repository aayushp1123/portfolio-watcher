import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAiConfigured } from "@/lib/gemini";
import type { WeeklyTrends } from "@/lib/reports/schemas";
import { Card } from "@/components/ui/Card";
import { WeeklyTrendsView } from "@/components/reports/WeeklyTrendsView";
import { ReportPageHeader } from "@/components/dashboard/ReportPageHeader";
import { WEEKLY_TRENDS_SCHEDULE, getNextRun } from "@/lib/cronSchedule";

export default async function WeeklyTrendsPage() {
  const session = await getServerSession(authOptions);
  const userId = (session!.user as { id: string }).id;
  const aiConfigured = isAiConfigured();

  const history = await prisma.report.findMany({
    where: { userId, type: "WEEKLY_TRENDS" },
    orderBy: { generatedAt: "desc" },
    take: 8,
  });
  const reportRow = history[0] ?? null;
  const report: WeeklyTrends | null = reportRow ? JSON.parse(reportRow.content) : null;
  const pastHistory = history.slice(1);

  return (
    <div className="flex flex-col">
      <ReportPageHeader
        eyebrow="Weekly Trends & New Stock Ideas"
        title="This Week's Research"
        updatedAt={reportRow ? new Date(reportRow.generatedAt) : null}
        nextRun={getNextRun(WEEKLY_TRENDS_SCHEDULE)}
      />
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
      {!report ? (
        <Card className="mt-6">
          <p className="text-sm text-ink-700">
            No research digest yet.{" "}
            {aiConfigured
              ? "This generates automatically every Monday morning — check back after the next scheduled run."
              : "Add your Gemini API key in Settings — this will then populate automatically every Monday morning."}
          </p>
        </Card>
      ) : (
        <div className="mt-6">
          <WeeklyTrendsView report={report} />
        </div>
      )}

      {pastHistory.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 font-[family-name:var(--font-heading)] text-lg font-bold text-ink-900">
            History
          </h2>
          <div className="flex flex-col gap-2">
            {pastHistory.map((h) => {
              const parsed: WeeklyTrends = JSON.parse(h.content);
              return (
                <details key={h.id} className="rounded-lg border border-line bg-paper-0 px-4 py-2.5">
                  <summary className="cursor-pointer text-sm font-semibold text-ink-900">
                    {new Date(h.generatedAt).toLocaleString()} — {parsed.newIdeas.length} idea
                    {parsed.newIdeas.length === 1 ? "" : "s"}
                  </summary>
                  <p className="mt-2 text-sm text-ink-700">{parsed.allocationCheck.summary}</p>
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
