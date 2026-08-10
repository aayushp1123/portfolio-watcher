"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";

type Item = {
  id: string;
  institutionName: string | null;
  status: string;
  lastSyncedAt: Date | null;
};

const statusTone = { active: "good", login_required: "warn", error: "crit" } as const;

export function PlaidItemsList({ items, plaidConfigured }: { items: Item[]; plaidConfigured: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function sync(id: string) {
    setPending(id);
    setErrors((e) => ({ ...e, [id]: "" }));
    const res = await fetch(`/api/plaid/sync/${id}`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setPending(null);
    if (!res.ok) {
      setErrors((e) => ({ ...e, [id]: data.error ?? "Sync failed" }));
    }
    router.refresh();
  }

  async function remove(id: string) {
    setPending(id);
    await fetch(`/api/plaid/items/${id}`, { method: "DELETE" });
    setPending(null);
    router.refresh();
  }

  return (
    <Card>
      <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-ink-900">
        Connected Accounts
      </h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-ink-500">
          No accounts connected yet.{" "}
          {plaidConfigured ? (
            <Link href="/onboarding/connect" className="font-semibold text-teal-600 hover:underline">
              Connect one now
            </Link>
          ) : (
            "Add your Plaid Sandbox key to connect one."
          )}
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-2 rounded-lg border border-line px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-ink-900">
                    {item.institutionName ?? "Connected account"}
                  </p>
                  <Pill tone={statusTone[item.status as keyof typeof statusTone] ?? "neutral"}>
                    {item.status === "login_required" ? "Needs reconnect" : item.status}
                  </Pill>
                </div>
                <p className="text-sm text-ink-500">
                  {item.lastSyncedAt
                    ? `Last synced ${new Date(item.lastSyncedAt).toLocaleString()}`
                    : "Not yet synced"}
                </p>
                {errors[item.id] && <p className="text-sm text-crit-600">{errors[item.id]}</p>}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => sync(item.id)}
                  disabled={pending === item.id}
                >
                  {pending === item.id ? "Syncing…" : "Sync Now"}
                </Button>
                <Button variant="ghost" onClick={() => remove(item.id)} disabled={pending === item.id}>
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
