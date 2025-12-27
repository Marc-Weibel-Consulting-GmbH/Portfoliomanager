import { getFinnhubApiKey } from "./env";

export interface NewsArticle {
  ticker: string;
  title: string;
  description: string | null;
  url: string | null;
  imageUrl: string | null;
  source: string | null;
  publishedAt: Date | null;
}

/**
 * Fetch company news from Finnhub API
 * @param ticker Stock ticker symbol
 * @param limit Maximum number of articles to return (default: 10)
 * @returns Array of news articles
 */
export async function fetchCompanyNews(ticker: string, limit: number = 10): Promise<NewsArticle[]> {
  try {
    const apiKey = await getFinnhubApiKey();
    if (!apiKey) {
      console.warn("[NewsAPI] Finnhub API key not available");
      return [];
    }

    // Fetch news from last 30 days
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 30);

    const fromStr = fromDate.toISOString().split('T')[0];
    const toStr = toDate.toISOString().split('T')[0];

    const url = `https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${fromStr}&to=${toStr}&token=${apiKey}`;
    
    console.log(`[NewsAPI] Fetching news for ${ticker} from ${fromStr} to ${toStr}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`[NewsAPI] Finnhub API error: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    
    if (!Array.isArray(data)) {
      console.warn(`[NewsAPI] Unexpected response format for ${ticker}:`, data);
      return [];
    }

    // Transform and filter news articles
    const articles: NewsArticle[] = data
      .slice(0, limit)
      .map((item: any) => ({
        ticker,
        title: item.headline || "No title",
        description: item.summary || null,
        url: item.url || null,
        imageUrl: item.image || null,
        source: item.source || null,
        publishedAt: item.datetime ? new Date(item.datetime * 1000) : null,
      }))
      .filter((article: NewsArticle) => article.title && article.url);

    console.log(`[NewsAPI] Fetched ${articles.length} articles for ${ticker}`);
    
    return articles;
  } catch (error) {
    console.error(`[NewsAPI] Error fetching news for ${ticker}:`, error);
    return [];
  }
}

/**
 * Fetch market news from Finnhub API (general market news, not ticker-specific)
 * @param category News category: "general", "forex", "crypto", "merger"
 * @param limit Maximum number of articles to return (default: 20)
 * @returns Array of news articles
 */
export async function fetchMarketNews(category: string = "general", limit: number = 20): Promise<NewsArticle[]> {
  try {
    const apiKey = await getFinnhubApiKey();
    if (!apiKey) {
      console.warn("[NewsAPI] Finnhub API key not available");
      return [];
    }

    const url = `https://finnhub.io/api/v1/news?category=${category}&token=${apiKey}`;
    
    console.log(`[NewsAPI] Fetching market news (category: ${category})`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`[NewsAPI] Finnhub API error: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    
    if (!Array.isArray(data)) {
      console.warn(`[NewsAPI] Unexpected response format for market news:`, data);
      return [];
    }

    // Transform and filter news articles
    const articles: NewsArticle[] = data
      .slice(0, limit)
      .map((item: any) => ({
        ticker: "MARKET", // General market news
        title: item.headline || "No title",
        description: item.summary || null,
        url: item.url || null,
        imageUrl: item.image || null,
        source: item.source || null,
        publishedAt: item.datetime ? new Date(item.datetime * 1000) : null,
      }))
      .filter((article: NewsArticle) => article.title && article.url);

    console.log(`[NewsAPI] Fetched ${articles.length} market news articles`);
    
    return articles;
  } catch (error) {
    console.error(`[NewsAPI] Error fetching market news:`, error);
    return [];
  }
}

/**
 * Fetch news for multiple tickers and combine results
 * @param tickers Array of stock ticker symbols
 * @param limitPerTicker Maximum number of articles per ticker (default: 5)
 * @returns Combined array of news articles sorted by publish date
 */
export async function fetchMultiTickerNews(tickers: string[], limitPerTicker: number = 5): Promise<NewsArticle[]> {
  try {
    const newsPromises = tickers.map(ticker => fetchCompanyNews(ticker, limitPerTicker));
    const newsArrays = await Promise.all(newsPromises);
    
    // Flatten and sort by publish date (most recent first)
    const allNews = newsArrays
      .flat()
      .filter(article => article.publishedAt)
      .sort((a, b) => {
        const dateA = a.publishedAt?.getTime() || 0;
        const dateB = b.publishedAt?.getTime() || 0;
        return dateB - dateA;
      });

    console.log(`[NewsAPI] Fetched total ${allNews.length} articles for ${tickers.length} tickers`);
    
    return allNews;
  } catch (error) {
    console.error(`[NewsAPI] Error fetching multi-ticker news:`, error);
    return [];
  }
}
