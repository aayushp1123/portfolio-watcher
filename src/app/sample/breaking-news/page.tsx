import type { Metadata } from "next";
import { sampleBreakingNews } from "@/lib/reports/sampleData";
import { BreakingNewsStatusCard, BreakingNewsAlerts } from "@/components/reports/BreakingNewsView";
import { SampleBanner } from "@/components/sample/SampleBanner";

export const metadata: Metadata = { title: "Sample Breaking News — Portfolio Watcher" };

export default function SampleBreakingNewsPage() {
  return (
    <div className="w-full px-4 py-10 sm:px-8">
      <p className="text-sm font-semibold uppercase tracking-widest text-teal-600">
        Breaking News &amp; Big Moves Watch
      </p>
      <h1 className="mt-1 font-[family-name:var(--font-heading)] text-4xl font-bold text-ink-900">
        Live Watch
      </h1>
      <p className="mt-1 text-sm text-ink-500">Example checked Aug 6, 2026</p>

      <SampleBanner />

      <div className="mt-6">
        <BreakingNewsStatusCard hasChecked report={sampleBreakingNews} notConfiguredMessage="" />
      </div>

      <BreakingNewsAlerts report={sampleBreakingNews} />
    </div>
  );
}
