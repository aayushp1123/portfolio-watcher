"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { forwardRef, useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { motion } from "framer-motion";

export interface SlideNavTabItem {
  href: string;
  label: string;
}

interface CursorRect {
  left: number;
  width: number;
  opacity: number;
}

/** Pill-style nav tabs with a sliding highlight that tracks hover and snaps
 * back to the active route on mouse-leave -- adapted from a generic
 * click-to-select tab pattern into a real Next.js Link nav where the
 * "selected" tab is whichever route is actually active, not client state. */
export function SlideNavTabs({ items }: { items: SlideNavTabItem[] }) {
  const pathname = usePathname();
  const activeIndex = items.findIndex((item) => item.href === pathname);

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [cursor, setCursor] = useState<CursorRect>({ left: 0, width: 0, opacity: 0 });
  const tabRefs = useRef<Array<HTMLAnchorElement | null>>([]);

  const highlightedIndex = hoveredIndex ?? activeIndex;

  useEffect(() => {
    const tab = highlightedIndex >= 0 ? tabRefs.current[highlightedIndex] : null;
    if (!tab) {
      setCursor((c) => ({ ...c, opacity: 0 }));
      return;
    }
    setCursor({ left: tab.offsetLeft, width: tab.getBoundingClientRect().width, opacity: 1 });
  }, [highlightedIndex]);

  return (
    <ul
      onMouseLeave={() => setHoveredIndex(null)}
      className="relative flex items-center gap-0.5 rounded-full border border-line bg-paper-0 p-1"
    >
      {items.map((item, i) => (
        <Tab
          key={item.href}
          ref={(el) => {
            tabRefs.current[i] = el;
          }}
          href={item.href}
          active={i === highlightedIndex}
          onMouseEnter={() => setHoveredIndex(i)}
        >
          {item.label}
        </Tab>
      ))}
      <motion.li
        animate={{ left: cursor.left, width: cursor.width, opacity: cursor.opacity }}
        transition={{ type: "spring", stiffness: 400, damping: 32 }}
        className="absolute top-1 z-0 h-[calc(100%-0.5rem)] rounded-full bg-teal-600"
      />
    </ul>
  );
}

function TabInner(
  { href, active, onMouseEnter, children }: { href: string; active: boolean; onMouseEnter: () => void; children: ReactNode },
  ref: Ref<HTMLAnchorElement>
) {
  return (
    <li className="relative">
      <Link
        ref={ref}
        href={href}
        onMouseEnter={onMouseEnter}
        className={`relative z-10 block whitespace-nowrap rounded-full px-3 py-1.5 font-[family-name:var(--font-heading)] text-sm font-semibold transition-colors duration-150 ${
          active ? "text-white" : "text-ink-700"
        }`}
      >
        {children}
      </Link>
    </li>
  );
}

const Tab = forwardRef(TabInner);
