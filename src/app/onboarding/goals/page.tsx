"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

export default function GoalsOnboardingPage() {
  const router = useRouter();
  const [coreEtf, setCoreEtf] = useState(70);
  const [growth, setGrowth] = useState(20);
  const [speculative, setSpeculative] = useState(10);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const total = coreEtf + growth + speculative;
  const totalOk = Math.abs(total - 100) < 0.01;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!totalOk) {
      setError("Your three percentages need to add up to 100.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/goals", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetCoreEtfPct: coreEtf,
        targetGrowthPct: growth,
        targetSpeculativePct: speculative,
        notes: notes || undefined,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      setLoading(false);
      return;
    }

    router.push("/onboarding/connect");
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-12">
      <p className="text-xs font-semibold uppercase tracking-widest text-teal-600">
        Step 1 of 2
      </p>
      <h1 className="mt-1 font-[family-name:var(--font-heading)] text-2xl font-bold text-ink-900">
        What are your investing goals?
      </h1>
      <p className="mt-2 text-sm text-ink-500">
        Set a target allocation across three buckets. This is what your Weekly
        Trends digest will measure your actual portfolio against — you can
        change it anytime in Settings.
      </p>

      <Card className="mt-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input
              id="core"
              label="Core ETFs %"
              type="number"
              min={0}
              max={100}
              value={coreEtf}
              onChange={(e) => setCoreEtf(Number(e.target.value))}
            />
            <Input
              id="growth"
              label="Individual Growth %"
              type="number"
              min={0}
              max={100}
              value={growth}
              onChange={(e) => setGrowth(Number(e.target.value))}
            />
            <Input
              id="speculative"
              label="Speculative %"
              type="number"
              min={0}
              max={100}
              value={speculative}
              onChange={(e) => setSpeculative(Number(e.target.value))}
            />
          </div>

          <p className={`text-sm font-medium ${totalOk ? "text-good-600" : "text-crit-600"}`}>
            Total: {total}% {totalOk ? "✓" : "— needs to equal 100%"}
          </p>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="notes" className="text-sm font-medium text-ink-700">
              Anything else about your goals? (optional)
            </label>
            <textarea
              id="notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-lg border border-line bg-paper-0 px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-500 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
              placeholder="e.g. long-term income focus, willing to hold speculative positions for years"
            />
          </div>

          {error && <p className="text-sm text-crit-600">{error}</p>}

          <Button type="submit" disabled={loading} className="mt-1 w-full">
            {loading ? "Saving…" : "Continue"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
