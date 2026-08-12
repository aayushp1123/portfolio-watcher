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
        className="group relative block w-full cursor-pointer text-left"
      >
        <PortfolioValueChart points={points} />
        <span className="pointer-events-none absolute top-5 right-5 rounded-md border border-line bg-paper-0 px-2 py-1 text-xs font-semibold text-ink-500 opacity-0 transition-opacity group-hover:opacity-100">
          Expand &#10530;
        </span>
      </div>
      <PortfolioDashboardModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
