import type { NewsArticle } from "@/lib/newsFeed";
import { Card } from "@/components/ui/Card";

function timeAgo(pubDate: string): string {
  const diffMs = Date.now() - new Date(pubDate).getTime();
  const hours = Math.round(diffMs / 3600000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

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
              <p className="mt-1 text-xs text-ink-500">
                {a.source} · {timeAgo(a.pubDate)}
              </p>
            </a>
          ))}
        </div>
      </Card>
    </aside>
  );
}
