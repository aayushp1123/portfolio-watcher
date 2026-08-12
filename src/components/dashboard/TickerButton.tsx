"use client";

import { useState } from "react";
import { StockDetailModal } from "@/components/dashboard/StockDetailModal";

export function TickerButton({ ticker, className = "" }: { ticker: string; className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`cursor-pointer text-left transition-all duration-150 ease-out hover:text-teal-600 active:scale-[0.97] ${className}`}
      >
        {ticker}
      </button>
      <StockDetailModal ticker={ticker} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
