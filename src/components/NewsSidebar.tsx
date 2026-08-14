import type { NewsArticle } from "@/lib/newsFeed";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { LocalTime } from "@/components/ui/LocalTime";

const dateTimeOptions: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

export function NewsSidebar({ articles }: { articles: NewsArticle[] }) {
  if (articles.length === 0) return null;

  return (
    <aside className="lg:sticky lg:top-20 lg:self-start">
      <Card>
        <h2 className="font-[family-name:var(--font-heading)] text-base font-bold text-ink-900">
          Articles We Think You&apos;d Enjoy
        </h2>
        <div className="mt-3 flex flex-col gap-3">
          {articles.map((a) => (
            <a
              key={a.link}
              href={a.link}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-lg border border-line px-3 py-2.5 transition-colors hover:border-teal-600"
            >
              <p className="text-sm font-medium leading-snug text-ink-900">{a.title}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-xs text-ink-500">
                  {a.source} ·{" "}
                  {isNaN(new Date(a.pubDate).getTime()) ? (
                    a.pubDate
                  ) : (
                    <LocalTime date={a.pubDate} options={dateTimeOptions} />
                  )}
                </span>
                {a.relatedTicker && <Pill tone="neutral">{a.relatedTicker}</Pill>}
              </div>
            </a>
          ))}
        </div>
      </Card>
    </aside>
  );
}
