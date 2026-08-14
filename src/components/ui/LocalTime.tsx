"use client";

/** Formats a date in the *viewer's* timezone. Vercel's server functions run
 * in UTC, so calling toLocaleString() directly inside a Server Component
 * bakes UTC into the rendered HTML regardless of who's looking at it -- a
 * report generated at 2:51 PM Eastern shows up as "6:51 PM" for everyone.
 * This component defers formatting to the browser, where the real timezone
 * is actually known. */
export function LocalTime({
  date,
  dateOnly = false,
  options,
}: {
  date: Date | string;
  dateOnly?: boolean;
  options?: Intl.DateTimeFormatOptions;
}) {
  const d = typeof date === "string" ? new Date(date) : date;
  return <>{dateOnly ? d.toLocaleDateString(undefined, options) : d.toLocaleString(undefined, options)}</>;
}
