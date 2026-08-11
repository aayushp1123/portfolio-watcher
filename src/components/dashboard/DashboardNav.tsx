"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogoMark } from "@/components/graphics/Logo";

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
      <div className="mx-auto grid max-w-3xl grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2 justify-self-start">
          <LogoMark className="h-6 w-6" />
          <span className="font-[family-name:var(--font-heading)] text-sm font-bold text-ink-900">
            Portfolio Watcher
          </span>
        </Link>

        <div className="flex flex-wrap justify-center gap-1.5">
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
          className="justify-self-end text-sm text-ink-500 hover:text-crit-600"
        >
          Log out
        </button>
      </div>
    </nav>
  );
}
