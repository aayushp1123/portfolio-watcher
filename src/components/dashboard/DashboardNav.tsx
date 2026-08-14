"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { LogoMark } from "@/components/graphics/Logo";
import { SlideNavTabs } from "@/components/ui/SlideNavTabs";

const links = [
  { href: "/dashboard", label: "Daily Digest" },
  { href: "/dashboard/weekly", label: "Weekly Trends" },
  { href: "/dashboard/breaking-news", label: "Breaking News" },
  { href: "/dashboard/settings", label: "Settings" },
];

export function DashboardNav() {
  return (
    <nav className="sticky top-0 z-10 border-b border-line bg-paper-50/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
        <Link href="/" className="flex flex-none items-center gap-2">
          <LogoMark className="h-6 w-6" />
          <span className="whitespace-nowrap font-[family-name:var(--font-heading)] text-sm font-bold text-ink-900">
            Portfolio Watcher
          </span>
        </Link>

        <div className="flex flex-1 justify-center overflow-x-auto">
          <SlideNavTabs items={links} />
        </div>

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
