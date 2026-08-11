import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAiConfigured } from "@/lib/gemini";
import type { BreakingNews } from "@/lib/reports/schemas";
import { BreakingNewsStatusCard, BreakingNewsAlerts } from "@/components/reports/BreakingNewsView";
import { ReportPageHeader } from "@/components/dashboard/ReportPageHeader";
import { BREAKING_NEWS_SCHEDULE, getNextRun } from "@/lib/cronSchedule";

export default async function BreakingNewsPage() {
  const session = await getServerSession(authOptions);
  const userId = (session!.user as { id: string }).id;
  const aiConfigured = isAiConfigured();

  const [latest, history] = await Promise.all([
    prisma.report.findFirst({
      where: { userId, type: "BREAKING_NEWS" },
      orderBy: { generatedAt: "desc" },
    }),
    prisma.report.findMany({
      where: { userId, type: "BREAKING_NEWS", hasMaterialEvents: true },
      orderBy: { generatedAt: "desc" },
      take: 20,
    }),
  ]);

  const latestReport: BreakingNews | null = latest ? JSON.parse(latest.content) : null;

  return (
    <div className="flex flex-col">
      <ReportPageHeader
        eyebrow="Breaking News & Big Moves Watch"
        title="Live Watch"
        updatedAt={latest ? new Date(latest.generatedAt) : null}
        nextRun={getNextRun(BREAKING_NEWS_SCHEDULE)}
      />
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <div>
        <BreakingNewsStatusCard
          hasChecked={!!latest}
          report={latestReport}
          notConfiguredMessage={
            aiConfigured
              ? "This checks automatically several times a day — check back after the next scheduled run."
              : "Add your Gemini API key in Settings — this will then check automatically several times a day."
          }
        />
      </div>

      {latestReport && <BreakingNewsAlerts report={latestReport} />}

      {history.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 font-[family-name:var(--font-heading)] text-lg font-bold text-ink-900">
            History
          </h2>
          <div className="flex flex-col gap-2">
            {history.map((h) => {
              const parsed: BreakingNews = JSON.parse(h.content);
              return (
                <details key={h.id} className="rounded-lg border border-line bg-paper-0 px-4 py-2.5">
                  <summary className="cursor-pointer text-sm font-semibold text-ink-900">
                    {new Date(h.generatedAt).toLocaleString()} — {parsed.alerts.length} item
                    {parsed.alerts.length === 1 ? "" : "s"}
                  </summary>
                  <div className="mt-2 flex flex-col gap-2">
                    {parsed.alerts.map((a, i) => (
                      <p key={i} className="text-sm text-ink-700">
                        <span className="font-semibold">{a.ticker ?? "Market"}:</span> {a.headline}
                      </p>
                    ))}
                  </div>
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
