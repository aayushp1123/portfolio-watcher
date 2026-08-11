"use client";

import { useEffect, useState } from "react";
import { searchTickers, type TickerEntry } from "@/lib/tickers";

export function TickerAutocomplete({
  value,
  onChange,
  placeholder = "Ticker (e.g. AAPL)",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [matches, setMatches] = useState<TickerEntry[]>([]);

  useEffect(() => {
    if (!open || !value.trim()) {
      setMatches([]);
      return;
    }

    // Show the bundled list instantly, then try to widen results from the
    // free search API (broader coverage) — fall back silently on failure.
    setMatches(searchTickers(value, 15));

    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/tickers/search?q=${encodeURIComponent(value)}`, { signal: controller.signal })
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data?.results) && data.results.length > 0) {
            setMatches(data.results);
          }
        })
        .catch(() => {
          // Keep the already-shown static-list matches.
        });
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, open]);

  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value.toUpperCase());
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-lg border border-line bg-paper-0 px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-500 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
      />
      {open && matches.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-line bg-paper-0 shadow-lg">
          {matches.map((t) => (
            <li key={t.symbol}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(t.symbol);
                  setOpen(false);
                }}
                className="flex w-full items-baseline justify-between gap-3 px-3.5 py-2 text-left text-sm hover:bg-paper-50"
              >
                <span className="font-[family-name:var(--font-heading)] font-bold text-ink-900">
                  {t.symbol}
                </span>
                <span className="truncate text-ink-500">{t.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
