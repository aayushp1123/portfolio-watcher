import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAiConfigured } from "@/lib/gemini";
import type { DailyDigest } from "@/lib/reports/schemas";
import { Card } from "@/components/ui/Card";
import { GenerateButton } from "@/components/dashboard/GenerateButton";
import { DailyDigestView } from "@/components/reports/DailyDigestView";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const userId = (session!.user as { id: string }).id;
  const aiConfigured = isAiConfigured();

  const reportRow = await prisma.report.findFirst({
    where: { userId, type: "DAILY_DIGEST" },
    orderBy: { generatedAt: "desc" },
  });
  const report: DailyDigest | null = reportRow ? JSON.parse(reportRow.content) : null;

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
        <GenerateButton aiConfigured={aiConfigured} reportType="DAILY_DIGEST" />
      </div>

      {!report ? (
        <Card className="mt-6">
          <p className="text-sm text-ink-700">
            No digest yet.{" "}
            {aiConfigured
              ? "Click Generate Report above to research your holdings and build your first digest."
              : "Once you add your Gemini API key and connect a brokerage account, click Generate Report to build your first digest."}
          </p>
        </Card>
      ) : (
        <div className="mt-6">
          <DailyDigestView report={report} />
        </div>
      )}
    </div>
  );
}
