"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { LegalContent } from "@/components/LegalContent";
import { TERMS_SECTIONS, PRIVACY_SECTIONS, LAST_UPDATED } from "@/lib/legal";

/** A full-page, non-dismissible block shown instead of the normal app when a
 * user hasn't yet agreed to the current Terms/Privacy version -- either a
 * brand new signup edge case or an existing user after the docs changed.
 * Deliberately has no close/escape/backdrop-click affordance since agreeing
 * is mandatory to continue. */
export function TermsGate({ isUpdate }: { isUpdate: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAgree() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/accept-terms", { method: "POST" });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col px-4 py-16">
      <p className="text-xs font-semibold uppercase tracking-widest text-teal-600">
        {isUpdate ? "Updated" : "Please review"}
      </p>
      <h1 className="mt-1 font-[family-name:var(--font-heading)] text-3xl font-bold text-ink-900">
        {isUpdate ? "Our Terms & Privacy Policy have changed" : "Terms of Service & Privacy Policy"}
      </h1>
      <p className="mt-2 text-sm text-ink-500">
        {isUpdate
          ? "Please review the updated documents below and agree to continue using Portfolio Watcher."
          : "Please review and agree to continue."}{" "}
        Last updated {LAST_UPDATED}.
      </p>

      <div className="mt-8">
        <h2 className="mb-4 font-[family-name:var(--font-heading)] text-xl font-bold text-ink-900">
          Terms of Service
        </h2>
        <LegalContent sections={TERMS_SECTIONS} />
      </div>

      <div className="mt-8">
        <h2 className="mb-4 font-[family-name:var(--font-heading)] text-xl font-bold text-ink-900">
          Privacy Policy
        </h2>
        <LegalContent sections={PRIVACY_SECTIONS} />
      </div>

      <div className="sticky bottom-0 mt-8 border-t border-line bg-paper-50 py-4">
        {error && <p className="mb-2 text-sm text-crit-600">{error}</p>}
        <Button onClick={handleAgree} disabled={loading} className="w-full">
          {loading ? "Saving…" : "I Agree — Continue to Portfolio Watcher"}
        </Button>
      </div>
    </div>
  );
}
