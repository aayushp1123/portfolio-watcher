"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const links = [
  { href: "/dashboard", label: "Daily Digest" },
  { href: "/dashboard/weekly", label: "Weekly Trends" },
  { href: "/dashboard/breaking-news", label: "Breaking News" },
  { href: "/dashboard/settings", label: "Settings" },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-10 border-b border-line bg-paper-50/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
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
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-sm text-ink-500 hover:text-crit-600"
        >
          Log out
        </button>
      </div>
    </nav>
  );
}
