"use client";

import { useState, type ReactNode } from "react";

/** Small hover/focus-triggered explanatory bubble. Purely additive -- wraps
 * existing content without changing its visible layout or position. */
export function InfoTooltip({ children, label }: { children: ReactNode; label: ReactNode }) {
  const [show, setShow] = useState(false);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span
        tabIndex={0}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        className="cursor-help outline-none"
      >
        {children}
      </span>
      {show && (
        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-56 -translate-x-1/2 rounded-lg border border-line/60 bg-paper-0/85 px-3 py-2 text-xs leading-snug text-ink-700 shadow-lg backdrop-blur-md"
          style={{ animation: "modal-backdrop-in 120ms ease-out" }}
        >
          {label}
          <span className="absolute top-full left-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 border-r border-b border-line/60 bg-paper-0/85" />
        </span>
      )}
    </span>
  );
}
