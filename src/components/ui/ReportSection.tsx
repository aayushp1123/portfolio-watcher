import { HTMLAttributes } from "react";

/** A plain item inside a report body -- just vertical spacing, no border or
 * background box, so a stack of these reads as continuous text sitting
 * directly on the page rather than a list of separated tiles. */
export function ReportRow({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`py-4 first:pt-0 ${className}`} {...props} />;
}

/** A callout inside a report body (e.g. "Bottom Line") -- no border/box,
 * just spacing; the section heading above it already sets it apart. */
export function ReportCallout({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={className} {...props} />;
}
