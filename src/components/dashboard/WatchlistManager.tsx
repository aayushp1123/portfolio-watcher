"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

type WatchlistItem = {
  id: string;
  ticker: string;
  note: string | null;
};

export function WatchlistManager({ initialItems }: { initialItems: WatchlistItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [ticker, setTicker] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function addItem() {
    setError(null);
    if (!ticker.trim()) {
      setError("Ticker is required.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker: ticker.trim(), note: note || undefined }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not add ticker");
      setSaving(false);
      return;
    }
    setItems((prev) => [data.watchlistItem, ...prev]);
    setTicker("");
    setNote("");
    setSaving(false);
  }

  async function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await fetch(`/api/watchlist/${id}`, { method: "DELETE" });
  }

  return (
    <Card>
      <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-ink-900">
        Watchlist
      </h2>
      <p className="mt-1 text-sm text-ink-500">
        No brokerage account? Add tickers you&apos;re curious about here and
        your reports will research and rate them the same way — no
        connection required.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        {items.length === 0 && (
          <p className="text-sm italic text-ink-500">Nothing on your watchlist yet.</p>
        )}
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-line px-3.5 py-2.5"
          >
            <div>
              <span className="font-[family-name:var(--font-heading)] font-bold text-ink-900">
                {item.ticker}
              </span>
              {item.note && <p className="mt-0.5 text-sm text-ink-700">{item.note}</p>}
            </div>
            <Button variant="ghost" onClick={() => removeItem(item.id)}>
              Remove
            </Button>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-line pt-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            placeholder="Ticker (e.g. AAPL)"
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
          />
          <Input
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-crit-600">{error}</p>}
        <Button variant="secondary" onClick={addItem} disabled={saving} className="self-start">
          {saving ? "Adding…" : "Add to Watchlist"}
        </Button>
      </div>
    </Card>
  );
}
