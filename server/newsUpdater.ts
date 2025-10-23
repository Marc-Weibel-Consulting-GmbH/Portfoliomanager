import { addNews, deleteOldNews, getAllStocks, getDb } from "./db";
import { news } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

const NEWSAPI_KEY = process.env.NEWSAPI_KEY || "1ffc14ccb23748ed948ed406da52bf5c";
const NEWSAPI_URL = "https://newsapi.org/v2/everything";

// Track processed articles to avoid duplicates
const processedArticles = new Set<string>();

export async function updateNewsForAllStocks() {
  console.log("[News Updater] Starting news update...");
  
  try {
    const stocks = await getAllStocks();
    processedArticles.clear();
    
    for (const stock of stocks) {
      await updateNewsForStock(stock.ticker, stock.companyName);
      // Rate limiting: wait 200ms between requests
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // Clean up old news (older than 30 days)
    await deleteOldNews(30);
    
    console.log("[News Updater] News update completed successfully");
  } catch (error) {
    console.error("[News Updater] Error updating news:", error);
  }
}

// Check if news article already exists globally (not just for this ticker)
async function newsExists(ticker: string, title: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  try {
    // Check if the exact title already exists for ANY ticker
    const existing = await db
      .select()
      .from(news)
      .where(eq(news.title, title))
      .limit(1);
    return existing.length > 0;
  } catch (error) {
    console.error("[News Updater] Error checking if news exists:", error);
    return false;
  }
}

// Check if article is relevant to the ticker
function isRelevantArticle(article: any, ticker: string, companyName: string): boolean {
  const title = article.title.toLowerCase();
  const description = (article.description || "").toLowerCase();
  const cleanTicker = ticker.split(":")[0].toLowerCase();
  const cleanCompanyName = companyName.toLowerCase();
  
  // Title MUST contain ticker or company name (stricter requirement)
  const tickerInTitle = title.includes(cleanTicker);
  const companyInTitle = title.includes(cleanCompanyName);
  const hasRelevantInTitle = tickerInTitle || companyInTitle;
  
  // Exclude generic tech news that's not about the specific company
  const excludedKeywords = ["web browser", "web3", "crypto", "nft", "metaverse", "openai", "chatgpt", "google", "microsoft", "apple", "amazon"];
  const hasExcludedKeyword = excludedKeywords.some(keyword => {
    // Only exclude if it's a different company
    if (keyword === cleanCompanyName) return false;
    return title.includes(keyword);
  });
  
  return hasRelevantInTitle && !hasExcludedKeyword;
}

async function updateNewsForStock(ticker: string, companyName: string) {
  try {
    // Search specifically for the ticker first
    const query = ticker.split(":")[0]; // Remove exchange suffix
    const response = await fetch(
      `${NEWSAPI_URL}?q=${encodeURIComponent(query)}&sortBy=publishedAt&language=en&apiKey=${NEWSAPI_KEY}`
    );
    
    if (!response.ok) {
      console.warn(`[News Updater] Failed to fetch news for ${ticker}: ${response.statusText}`);
      return;
    }
    
    const data = await response.json() as any;
    
    if (data.articles && Array.isArray(data.articles)) {
      let addedCount = 0;
      
      for (const article of data.articles.slice(0, 10)) {
        // Skip if already processed in this run
        const articleKey = `${article.title}|${article.url}`;
        if (processedArticles.has(articleKey)) {
          continue;
        }
        processedArticles.add(articleKey);
        
        // Check if article is relevant
        if (!isRelevantArticle(article, ticker, companyName)) {
          continue;
        }
        
        // Check if already in database
        if (await newsExists(ticker, article.title)) {
          continue;
        }
        
        // Add news to database
        await addNews({
          ticker,
          title: article.title,
          description: article.description,
          url: article.url,
          imageUrl: article.urlToImage,
          source: article.source?.name,
          publishedAt: new Date(article.publishedAt),
          priority: "Mittel",
        });
        addedCount++;
      }
      
      if (addedCount > 0) {
        console.log(`[News Updater] Added ${addedCount} new relevant news items for ${ticker}`);
      }
    }
  } catch (error) {
    console.error(`[News Updater] Error fetching news for ${ticker}:`, error);
  }
}

// Initialize news updater on server start
export function initializeNewsUpdater() {
  console.log("[News Updater] Initialized. First update will run in 1 hour.");
  
  // Run update every hour
  setInterval(() => {
    updateNewsForAllStocks();
  }, 60 * 60 * 1000);
  
  // Also run on startup after 30 seconds
  setTimeout(() => {
    updateNewsForAllStocks();
  }, 30 * 1000);
}
