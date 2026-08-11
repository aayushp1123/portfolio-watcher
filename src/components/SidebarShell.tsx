import type { NewsArticle } from "@/lib/newsFeed";
import { NewsSidebar } from "@/components/NewsSidebar";

export function SidebarShell({
  articles,
  children,
}: {
  articles: NewsArticle[];
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 lg:grid-cols-[1fr_320px] lg:px-8">
      <div className="min-w-0">{children}</div>
      <NewsSidebar articles={articles} />
    </div>
  );
}
