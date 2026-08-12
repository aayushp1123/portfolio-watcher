"use client";

import { useState, type KeyboardEvent } from "react";
import { PortfolioValueChart } from "@/components/dashboard/PortfolioValueChart";
import { PortfolioDashboardModal } from "@/components/dashboard/PortfolioDashboardModal";

export function PortfolioValueChartExpandable({ points }: { points: Array<{ date: string; value: number }> }) {
  const [open, setOpen] = useState(false);

  if (points.length < 2) return null;

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(true);
    }
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        aria-label="Open full portfolio dashboard"
        className="group relative block w-full cursor-pointer text-left transition-transform hover:-translate-y-0.5"
      >
        <PortfolioValueChart points={points} />
        <span className="pointer-events-none absolute top-5 right-5 inline-flex items-center gap-1.5 rounded-full border border-line bg-paper-0 px-2.5 py-1 text-xs font-semibold text-ink-500 shadow-sm transition-colors group-hover:border-teal-600 group-hover:text-teal-600">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"
              style={{ stroke: "currentColor" }}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Expand dashboard
        </span>
      </div>
      <PortfolioDashboardModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
