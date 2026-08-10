import Link from "next/link";
import { Button } from "@/components/ui/Button";

export function SampleBanner() {
  return (
    <div className="mx-auto mt-6 flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 rounded-xl border border-teal-600/30 bg-teal-100 px-4 py-3">
      <p className="text-sm text-ink-900">
        <span className="font-semibold">This is sample data</span> — it shows what your dashboard could
        look like. Nothing here is real, and it never calls out to any live service.
      </p>
      <Link href="/signup">
        <Button className="shrink-0">Connect your own account</Button>
      </Link>
    </div>
  );
}
