import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAiConfigured } from "@/lib/gemini";
import type { DailyDigest } from "@/lib/reports/schemas";
import { Card } from "@/components/ui/Card";
import { DailyDigestView } from "@/components/reports/DailyDigestView";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const userId = (session!.user as { id: string }).id;
  const aiConfigured = isAiConfigured();

  const history = await prisma.report.findMany({
    where: { userId, type: "DAILY_DIGEST" },
    orderBy: { generatedAt: "desc" },
    take: 14,
  });
  const reportRow = history[0] ?? null;
  const report: DailyDigest | null = reportRow ? JSON.parse(reportRow.content) : null;
  const pastHistory = history.slice(1);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-teal-600">
            Daily Portfolio Digest
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-heading)] text-3xl font-bold text-ink-900">
            Your Portfolio, Today
          </h1>
          {reportRow && (
            <p className="mt-1 text-xs text-ink-500">
              Last updated {new Date(reportRow.generatedAt).toLocaleString()}
            </p>
          )}
        </div>
      </div>

      {!report ? (
        <Card className="mt-6">
          <p className="text-sm text-ink-700">
            No digest yet.{" "}
            {aiConfigured
              ? "This generates automatically at market open and close on weekdays — check back after the next scheduled run."
              : "Once your Gemini API key is set and a brokerage account or watchlist ticker is added, this will populate automatically at market open and close on weekdays."}
          </p>
        </Card>
      ) : (
        <div className="mt-6">
          <DailyDigestView report={report} />
        </div>
      )}

      {pastHistory.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 font-[family-name:var(--font-heading)] text-lg font-bold text-ink-900">
            History
          </h2>
          <div className="flex flex-col gap-2">
            {pastHistory.map((h) => {
              const parsed: DailyDigest = JSON.parse(h.content);
              return (
                <details key={h.id} className="rounded-lg border border-line bg-paper-0 px-4 py-2.5">
                  <summary className="cursor-pointer text-sm font-semibold text-ink-900">
                    {new Date(h.generatedAt).toLocaleString()} —{" "}
                    {parsed.hasBrokerageConnection
                      ? `$${parsed.totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}${
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
  );
}
