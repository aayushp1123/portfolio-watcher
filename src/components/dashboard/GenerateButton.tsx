"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function GenerateButton({
  aiConfigured,
  reportType,
  label = "Generate Report",
}: {
  aiConfigured: boolean;
  reportType: "DAILY_DIGEST" | "WEEKLY_TRENDS" | "BREAKING_NEWS";
  label?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/reports/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: reportType }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      return;
    }
    if (data.skipped) {
      setError(data.reason);
      return;
    }
    router.refresh();
  }

  if (!aiConfigured) {
    return (
      <div className="flex flex-col gap-1.5">
        <Button disabled>{label}</Button>
        <p className="text-xs text-ink-500">
          Add your Anthropic API key in{" "}
          <span className="font-medium">Settings</span> to enable AI-generated
          reports (console.anthropic.com — the one real cost in this app).
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Button onClick={generate} disabled={loading}>
        {loading ? "Generating…" : label}
      </Button>
      {error && <p className="text-sm text-crit-600">{error}</p>}
    </div>
  );
}
