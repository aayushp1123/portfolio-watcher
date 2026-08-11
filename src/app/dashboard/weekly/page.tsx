import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAiConfigured } from "@/lib/gemini";
import type { WeeklyTrends } from "@/lib/reports/schemas";
import { Card } from "@/components/ui/Card";
import { GenerateButton } from "@/components/dashboard/GenerateButton";
import { WeeklyTrendsView } from "@/components/reports/WeeklyTrendsView";

export default async function WeeklyTrendsPage() {
  const session = await getServerSession(authOptions);
  const userId = (session!.user as { id: string }).id;
  const aiConfigured = isAiConfigured();

  const reportRow = await prisma.report.findFirst({
    where: { userId, type: "WEEKLY_TRENDS" },
    orderBy: { generatedAt: "desc" },
  });
  const report: WeeklyTrends | null = reportRow ? JSON.parse(reportRow.content) : null;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-teal-600">
            Weekly Trends &amp; New Stock Ideas
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-heading)] text-3xl font-bold text-ink-900">
            This Week&apos;s Research
          </h1>
          {reportRow && (
            <p className="mt-1 text-xs text-ink-500">
              Last updated {new Date(reportRow.generatedAt).toLocaleString()}
            </p>
          )}
        </div>
        <GenerateButton aiConfigured={aiConfigured} reportType="WEEKLY_TRENDS" />
      </div>

      {!report ? (
        <Card className="mt-6">
          <p className="text-sm text-ink-700">
            No research digest yet.{" "}
            {aiConfigured
              ? "Click Generate Report above to research this week's trends."
              : "Add your Gemini API key in Settings, then click Generate Report."}
          </p>
        </Card>
      ) : (
        <div className="mt-6">
          <WeeklyTrendsView report={report} />
        </div>
      )}
    </div>
  );
}
