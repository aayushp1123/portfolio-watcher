import type { LegalSection } from "@/lib/legal";

export function LegalContent({ sections }: { sections: LegalSection[] }) {
  return (
    <div className="flex flex-col gap-6">
      {sections.map((section) => (
        <section key={section.heading} className="border-b border-line pb-6 last:border-b-0">
          <h2 className="mb-2 font-[family-name:var(--font-heading)] text-base font-bold text-ink-900">
            {section.heading}
          </h2>
          {section.paragraphs.map((p, i) => (
            <p key={i} className="mt-2 text-sm text-ink-700 first:mt-0">
              {p}
            </p>
          ))}
        </section>
      ))}
    </div>
  );
}
