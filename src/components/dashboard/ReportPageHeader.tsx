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
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-ink-500">
        {updatedAt && <span>Updated {updatedAt.toLocaleString()}</span>}
        <span>Next {nextRun.toLocaleString()}</span>
      </div>
    </div>
  );
}
