import type { Metadata } from "next";
import { sampleWeeklyTrends } from "@/lib/reports/sampleData";
import { WeeklyTrendsView } from "@/components/reports/WeeklyTrendsView";
import { SampleBanner } from "@/components/sample/SampleBanner";

export const metadata: Metadata = { title: "Sample Weekly Trends — Portfolio Watcher" };

export default function SampleWeeklyTrendsPage() {
  return (
    <div className="w-full px-4 py-10 sm:px-8">
      <p className="text-sm font-semibold uppercase tracking-widest text-teal-600">
        Weekly Trends &amp; New Stock Ideas
      </p>
      <h1 className="mt-1 font-[family-name:var(--font-heading)] text-4xl font-bold text-ink-900">
        This Week&apos;s Research
      </h1>
      <p className="mt-1 text-sm text-ink-500">Example generated Aug 3, 2026</p>

      <SampleBanner />

      <div className="mt-6">
        <WeeklyTrendsView report={sampleWeeklyTrends} />
      </div>
    </div>
  );
}
