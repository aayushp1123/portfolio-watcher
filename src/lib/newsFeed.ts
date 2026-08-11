/**
 * Free, unauthenticated financial news via public RSS feeds -- no API key,
 * no rate-limit billing risk. Sources: Yahoo Finance (general + per-ticker),
 * CNBC and MarketWatch (general), and Google News search (per-ticker,
 * aggregates many reputable outlets with real per-article publisher
 * attribution). Personalized to the user's own holdings/watchlist tickers
 * when available. Cached via Next.js fetch revalidation so it refreshes
 * periodically without a dedicated cron job.
 */
export interface NewsArticle {
  title: string;
  link: string;
  pubDate: string;
  /** The actual publisher (e.g. "Yahoo Finance", "Barron's", "CNBC"). Note:
   * these RSS feeds don't expose a per-article author/byline, so there's no
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

async function fetchXml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(6000),
    });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

/** Standard RSS 2.0 feeds (Yahoo, CNBC, MarketWatch) — one fixed publisher per feed. */
async function fetchStandardFeed(
  url: string,
  publisher: string,
  relatedTicker: string | null
): Promise<NewsArticle[]> {
  const xml = await fetchXml(url);
  if (!xml) return [];
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  return items
    .map((block) => ({
      title: extractTag(block, "title"),
      link: extractTag(block, "link"),
      pubDate: extractTag(block, "pubDate"),
      source: publisher,
      relatedTicker,
    }))
    .filter((a) => a.title && a.link);
}

/** Google News search RSS — aggregates many outlets, each item carries its
 * own real <source> publisher tag, and titles often end in " - Publisher"
 * (stripped here since the source tag already has it cleanly). */
async function fetchGoogleNews(query: string, relatedTicker: string | null): Promise<NewsArticle[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  const xml = await fetchXml(url);
  if (!xml) return [];
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  return items
    .map((block) => {
      const sourceMatch = block.match(/<source[^>]*>([\s\S]*?)<\/source>/i);
      const publisher = sourceMatch ? decodeEntities(sourceMatch[1]) : "Google News";
      let title = extractTag(block, "title");
      if (title.endsWith(` - ${publisher}`)) {
        title = title.slice(0, -(publisher.length + 3));
      }
      return {
        title,
        link: extractTag(block, "link"),
        pubDate: extractTag(block, "pubDate"),
        source: publisher,
        relatedTicker,
      };
    })
    .filter((a) => a.title && a.link);
}

function dedupeAndSort(articles: NewsArticle[], limit: number): NewsArticle[] {
  const seenTitles = new Set<string>();
  const unique = articles.filter((a) => {
    const key = a.title.toLowerCase();
    if (seenTitles.has(key)) return false;
    seenTitles.add(key);
    return true;
  });
  unique.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
  return unique.slice(0, limit);
}

/** General market headlines — used when logged out or no personal tickers yet. */
export async function getGeneralMarketNews(limit = 8): Promise<NewsArticle[]> {
  const feeds = await Promise.all([
    fetchStandardFeed("https://finance.yahoo.com/news/rssindex", "Yahoo Finance", null),
    fetchStandardFeed("https://www.cnbc.com/id/100003114/device/rss/rss.html", "CNBC", null),
    fetchStandardFeed("https://feeds.content.dowjones.io/public/rss/mw_topstories", "MarketWatch", null),
    fetchStandardFeed("https://www.investing.com/rss/news.rss", "Investing.com", null),
    fetchStandardFeed("https://www.fool.com/feeds/index.aspx", "The Motley Fool", null),
    fetchStandardFeed("https://www.nasdaq.com/feed/rssoutbound?category=Markets", "Nasdaq", null),
    fetchStandardFeed("https://feeds.a.dj.com/rss/RSSMarketsMain.xml", "WSJ Markets", null),
    fetchStandardFeed("https://seekingalpha.com/market_currents.xml", "Seeking Alpha", null),
  ]);
  return dedupeAndSort(feeds.flat(), limit);
}

/** Personalized news from the user's own holdings/watchlist tickers —
 * pulls direct per-ticker feeds (Yahoo, Nasdaq) plus a broader Google News
 * search per ticker (many outlets, real publisher attribution) — falling
 * back to general market news if there are none or all lookups fail. */
export async function getPersonalizedNews(tickers: string[], limit = 8): Promise<NewsArticle[]> {
  const uniqueTickers = [...new Set(tickers)].slice(0, 6); // cap outbound requests
  if (uniqueTickers.length === 0) return getGeneralMarketNews(limit);

  const perTicker = await Promise.all(
    uniqueTickers.flatMap((t) => [
      fetchStandardFeed(
        `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(t)}&region=US&lang=en-US`,
        "Yahoo Finance",
        t
      ),
      fetchStandardFeed(`https://www.nasdaq.com/feed/rssoutbound?symbol=${encodeURIComponent(t)}`, "Nasdaq", t),
      fetchGoogleNews(`${t} stock`, t),
    ])
  );

  const merged = dedupeAndSort(perTicker.flat(), limit);
  return merged.length > 0 ? merged : getGeneralMarketNews(limit);
}
