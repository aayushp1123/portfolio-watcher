"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/Button";

const links = [
  { href: "/sample", label: "Daily Digest" },
  { href: "/sample/weekly", label: "Weekly Trends" },
  { href: "/sample/breaking-news", label: "Breaking News" },
];

export function SampleNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-10 border-b border-line bg-paper-50/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="font-[family-name:var(--font-heading)] text-sm font-bold text-ink-900"
          >
            Portfolio Watcher
          </Link>
          <div className="flex flex-wrap gap-1.5">
            {links.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-full border px-3 py-1.5 font-[family-name:var(--font-heading)] text-sm font-semibold transition-colors ${
                    active
                      ? "border-teal-600 text-teal-600"
                      : "border-line text-ink-700 hover:border-teal-600 hover:text-teal-600"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/login" className="text-sm text-ink-500 hover:text-teal-600">
            Log in
          </Link>
          <Link href="/signup">
            <Button>Sign up free</Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}
