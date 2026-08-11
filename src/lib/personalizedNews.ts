import { prisma } from "@/lib/prisma";
import { getPersonalizedNews, getGeneralMarketNews, type NewsArticle } from "@/lib/newsFeed";

async function getUserTickers(userId: string): Promise<string[]> {
  const [watchlistItems, plaidItems] = await Promise.all([
    prisma.watchlistItem.findMany({ where: { userId }, select: { ticker: true } }),
    prisma.plaidItem.findMany({
      where: { userId, status: "active" },
      select: { lastHoldingsJson: true },
    }),
  ]);

  const tickers = watchlistItems.map((w) => w.ticker);
  for (const item of plaidItems) {
    if (!item.lastHoldingsJson) continue;
    try {
      const parsed = JSON.parse(item.lastHoldingsJson) as {
        securities?: Array<{ ticker_symbol: string | null }>;
      };
      for (const s of parsed.securities ?? []) {
        if (s.ticker_symbol) tickers.push(s.ticker_symbol);
      }
    } catch {
      // Skip malformed cached holdings.
    }
  }
  return tickers;
}

/** Sidebar articles for any page: personalized to the user's own holdings +
 * watchlist when logged in, general market headlines otherwise. */
export async function getSidebarArticles(userId: string | null): Promise<NewsArticle[]> {
  if (!userId) return getGeneralMarketNews();
  const tickers = await getUserTickers(userId);
  return getPersonalizedNews(tickers);
}
