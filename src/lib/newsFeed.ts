/**
 * Free, unauthenticated financial news via public RSS feeds (Yahoo Finance)
 * -- no API key, no rate-limit billing risk. Personalized per-ticker feeds
 * when the user has holdings/watchlist tickers, otherwise general market
 * headlines. Cached via Next.js fetch revalidation so it refreshes
 * periodically without a dedicated cron job.
 */
export interface NewsArticle {
  title: string;
  link: string;
  pubDate: string;
  /** The actual publisher/feed source (e.g. "Yahoo Finance"). Note: these
   * RSS feeds don't expose a per-article author/byline, so there's no
   * author field here — showing one would mean inventing it. */
  source: string;
  /** Which of the user's tickers this article came from, if personalized. */
  relatedTicker: string | null;
}

const REVALIDATE_SECONDS = 3600; // matches Breaking News' hourly cadence

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function extractTag(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  if (!match) return "";
  const raw = match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, "$1");
  return decodeEntities(raw);
}

function parseRss(xml: string, relatedTicker: string | null): NewsArticle[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  return items
    .map((block) => ({
      title: extractTag(block, "title"),
      link: extractTag(block, "link"),
      pubDate: extractTag(block, "pubDate"),
      source: "Yahoo Finance",
      relatedTicker,
    }))
    .filter((a) => a.title && a.link);
}

async function fetchFeed(url: string, relatedTicker: string | null): Promise<NewsArticle[]> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    return parseRss(await res.text(), relatedTicker);
  } catch {
    return [];
  }
}

function dedupeAndSort(articles: NewsArticle[], limit: number): NewsArticle[] {
  const seen = new Set<string>();
  const unique = articles.filter((a) => {
    if (seen.has(a.link)) return false;
    seen.add(a.link);
    return true;
  });
  unique.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
  return unique.slice(0, limit);
}

/** General market headlines — used when logged out or no personal tickers yet. */
export async function getGeneralMarketNews(limit = 8): Promise<NewsArticle[]> {
  const articles = await fetchFeed("https://finance.yahoo.com/news/rssindex", null);
  return dedupeAndSort(articles, limit);
}

/** Personalized news from the user's own holdings/watchlist tickers, falling
 * back to general market news if there are none or all lookups fail. */
export async function getPersonalizedNews(tickers: string[], limit = 8): Promise<NewsArticle[]> {
  const uniqueTickers = [...new Set(tickers)].slice(0, 8); // cap outbound requests
  if (uniqueTickers.length === 0) return getGeneralMarketNews(limit);

  const perTicker = await Promise.all(
    uniqueTickers.map((t) =>
      fetchFeed(
        `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(t)}&region=US&lang=en-US`,
        t
      )
    )
  );

  const merged = dedupeAndSort(perTicker.flat(), limit);
  return merged.length > 0 ? merged : getGeneralMarketNews(limit);
}
