"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TickerAutocomplete } from "@/components/ui/TickerAutocomplete";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";

type ExitRule = {
  id: string;
  ticker: string;
  ruleType: "PRICE_TARGET" | "TRAILING_STOP_PCT" | "STOP_LOSS_PRICE";
  value: number;
  note: string | null;
  active: boolean;
};

const ruleTypeLabels: Record<ExitRule["ruleType"], string> = {
  PRICE_TARGET: "Price target ($)",
  TRAILING_STOP_PCT: "Trailing stop (%)",
  STOP_LOSS_PRICE: "Stop-loss price ($)",
};

export function ExitRulesManager({ initialRules }: { initialRules: ExitRule[] }) {
  const [rules, setRules] = useState(initialRules);
  const [ticker, setTicker] = useState("");
  const [ruleType, setRuleType] = useState<ExitRule["ruleType"]>("PRICE_TARGET");
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function addRule() {
    setError(null);
    if (!ticker.trim() || !value) {
      setError("Ticker and value are required.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/exit-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticker: ticker.trim(),
        ruleType,
        value: Number(value),
        note: note || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not add rule");
      setSaving(false);
      return;
    }
    setRules((prev) => [data.exitRule, ...prev]);
    setTicker("");
    setValue("");
    setNote("");
    setSaving(false);
  }

  async function removeRule(id: string) {
    setRules((prev) => prev.filter((r) => r.id !== id));
    await fetch(`/api/exit-rules/${id}`, { method: "DELETE" });
  }

  return (
    <Card>
      <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-ink-900">
        Exit Rules
      </h2>
      <p className="mt-1 text-sm text-ink-500">
        Set a price target, trailing stop, or stop-loss per ticker. Your Daily
        Digest checks these every time it runs.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        {rules.length === 0 && (
          <p className="text-sm italic text-ink-500">No exit rules yet.</p>
        )}
        {rules.map((rule) => (
          <div
            key={rule.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-line px-3.5 py-2.5"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-[family-name:var(--font-heading)] font-bold text-ink-900">
                  {rule.ticker}
                </span>
                <Pill tone="neutral">{ruleTypeLabels[rule.ruleType]}</Pill>
              </div>
              <p className="mt-0.5 text-sm text-ink-700">
                {rule.ruleType === "TRAILING_STOP_PCT" ? `${rule.value}%` : `$${rule.value}`}
                {rule.note ? ` — ${rule.note}` : ""}
              </p>
            </div>
            <Button variant="ghost" onClick={() => removeRule(rule.id)}>
              Remove
            </Button>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-line pt-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TickerAutocomplete value={ticker} onChange={setTicker} placeholder="Ticker (e.g. VOO)" />
          <select
            value={ruleType}
            onChange={(e) => setRuleType(e.target.value as ExitRule["ruleType"])}
            className="rounded-lg border border-line bg-paper-0 px-3.5 py-2.5 text-sm text-ink-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
          >
            {Object.entries(ruleTypeLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            type="number"
            placeholder="Value"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <Input
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-crit-600">{error}</p>}
        <Button variant="secondary" onClick={addRule} disabled={saving} className="self-start">
          {saving ? "Adding…" : "Add Exit Rule"}
        </Button>
      </div>
    </Card>
  );
}
