import { LocalTime } from "@/components/ui/LocalTime";

export function ReportPageHeader({
  eyebrow,
  title,
  updatedAt,
  nextRun,
}: {
  eyebrow: string;
  title: string;
  updatedAt: Date | null;
  nextRun: Date;
}) {
  return (
    <div className="w-full border-b border-line bg-paper-0 py-10 text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-teal-600">{eyebrow}</p>
      <h1 className="mt-1 font-[family-name:var(--font-heading)] text-3xl font-bold text-ink-900">
        {title}
      </h1>
      <p className="mt-3 text-xs text-ink-500">
        {updatedAt && (
          <>
            Updated <LocalTime date={updatedAt} />
            {"  ·  "}
          </>
        )}
        Next <LocalTime date={nextRun} />
      </p>
    </div>
  );
}
