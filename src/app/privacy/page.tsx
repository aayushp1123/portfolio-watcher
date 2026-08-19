import Link from "next/link";
import { LegalContent } from "@/components/LegalContent";
import { PRIVACY_SECTIONS, LAST_UPDATED } from "@/lib/legal";

export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-16">
      <p className="text-xs font-semibold uppercase tracking-widest text-teal-600">Legal</p>
      <h1 className="mt-1 font-[family-name:var(--font-heading)] text-3xl font-bold text-ink-900">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-ink-500">Last updated {LAST_UPDATED}.</p>

      <div className="mt-8">
        <LegalContent sections={PRIVACY_SECTIONS} />
      </div>

      <p className="mt-8 text-sm text-ink-500">
        See also the{" "}
        <Link href="/terms" className="font-semibold text-teal-600 hover:underline">
          Terms of Service
        </Link>
        .
      </p>
    </div>
  );
}
