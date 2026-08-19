"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogoMark } from "@/components/graphics/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

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
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
        <Link href="/" className="flex flex-none items-center gap-2">
          <LogoMark className="h-6 w-6" />
          <span className="whitespace-nowrap font-[family-name:var(--font-heading)] text-sm font-bold text-ink-900">
            Portfolio Watcher
          </span>
        </Link>

        <div className="flex flex-1 justify-center gap-1.5 overflow-x-auto">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`whitespace-nowrap rounded-full border px-3 py-1.5 font-[family-name:var(--font-heading)] text-sm font-semibold transition-all duration-150 ease-out hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] ${
                  active
                    ? "border-teal-600 bg-teal-600 text-white shadow-sm"
                    : "border-line text-ink-700 hover:border-teal-600 hover:text-teal-600 hover:shadow-sm"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        <ThemeToggle className="flex-none" />

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex-none whitespace-nowrap text-sm text-ink-500 hover:text-crit-600"
        >
          Log out
        </button>
      </div>
    </nav>
  );
}
