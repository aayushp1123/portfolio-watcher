"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

type Goal = {
  targetCoreEtfPct: number;
  targetGrowthPct: number;
  targetSpeculativePct: number;
  notes: string | null;
} | null;

export function GoalEditor({ initialGoal }: { initialGoal: Goal }) {
  const [coreEtf, setCoreEtf] = useState(initialGoal?.targetCoreEtfPct ?? 70);
  const [growth, setGrowth] = useState(initialGoal?.targetGrowthPct ?? 20);
  const [speculative, setSpeculative] = useState(initialGoal?.targetSpeculativePct ?? 10);
  const [notes, setNotes] = useState(initialGoal?.notes ?? "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const total = coreEtf + growth + speculative;
  const totalOk = Math.abs(total - 100) < 0.01;

  async function save() {
    setError(null);
    setSaved(false);
    if (!totalOk) {
      setError("Percentages need to add up to 100.");
      return;
    }
    setSaving(true);
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
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Could not save");
      return;
    }
    setSaved(true);
  }

  return (
    <Card>
      <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-ink-900">
        Target Allocation
      </h2>
      <p className="mt-1 text-sm text-ink-500">
        Your Weekly Trends digest measures your actual portfolio against this.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Input
          label="Core ETFs %"
          type="number"
          min={0}
          max={100}
          value={coreEtf}
          onChange={(e) => setCoreEtf(Number(e.target.value))}
        />
        <Input
          label="Individual Growth %"
          type="number"
          min={0}
          max={100}
          value={growth}
          onChange={(e) => setGrowth(Number(e.target.value))}
        />
        <Input
          label="Speculative %"
          type="number"
          min={0}
          max={100}
          value={speculative}
          onChange={(e) => setSpeculative(Number(e.target.value))}
        />
      </div>

      <p className={`mt-2 text-sm font-medium ${totalOk ? "text-good-600" : "text-crit-600"}`}>
        Total: {total}% {totalOk ? "✓" : "— needs to equal 100%"}
      </p>

      <div className="mt-3 flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink-700">Notes</label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="rounded-lg border border-line bg-paper-0 px-3.5 py-2.5 text-sm text-ink-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
        />
      </div>

      {error && <p className="mt-2 text-sm text-crit-600">{error}</p>}
      {saved && <p className="mt-2 text-sm text-good-600">Saved ✓</p>}

      <Button variant="secondary" onClick={save} disabled={saving} className="mt-4">
        {saving ? "Saving…" : "Save Goal"}
      </Button>
    </Card>
  );
}
