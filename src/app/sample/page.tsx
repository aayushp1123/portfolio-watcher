import type { Metadata } from "next";
import { sampleDailyDigest } from "@/lib/reports/sampleData";
import { DailyDigestView } from "@/components/reports/DailyDigestView";
import { SampleBanner } from "@/components/sample/SampleBanner";

export const metadata: Metadata = { title: "Sample Daily Digest — Portfolio Watcher" };

export default function SampleDailyDigestPage() {
  return (
    <div className="w-full px-4 py-10 sm:px-8">
      <p className="text-sm font-semibold uppercase tracking-widest text-teal-600">
        Daily Portfolio Digest
      </p>
      <h1 className="mt-1 font-[family-name:var(--font-heading)] text-4xl font-bold text-ink-900">
        Your Portfolio, Today
      </h1>
      <p className="mt-1 text-sm text-ink-500">Example generated Aug 7, 2026</p>

      <SampleBanner />

      <div className="mt-6">
        <DailyDigestView report={sampleDailyDigest} />
      </div>
    </div>
  );
}
