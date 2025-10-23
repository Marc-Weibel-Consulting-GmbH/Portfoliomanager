import { addNews, deleteOldNews, getAllStocks } from "./db";

const NEWSAPI_KEY = process.env.NEWSAPI_KEY || "1ffc14ccb23748ed948ed406da52bf5c";
const NEWSAPI_URL = "https://newsapi.org/v2/everything";

export async function updateNewsForAllStocks() {
  console.log("[News Updater] Starting news update...");
  
  try {
    const stocks = await getAllStocks();
    
    for (const stock of stocks) {
      await updateNewsForStock(stock.ticker, stock.companyName);
      // Rate limiting: wait 100ms between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Clean up old news (older than 30 days)
    await deleteOldNews(30);
    
    console.log("[News Updater] News update completed successfully");
  } catch (error) {
    console.error("[News Updater] Error updating news:", error);
  }
}

async function updateNewsForStock(ticker: string, companyName: string) {
  try {
    const query = `${ticker} OR "${companyName}"`;
    const response = await fetch(
      `${NEWSAPI_URL}?q=${encodeURIComponent(query)}&sortBy=publishedAt&language=en&apiKey=${NEWSAPI_KEY}`
    );
    
    if (!response.ok) {
      console.warn(`[News Updater] Failed to fetch news for ${ticker}: ${response.statusText}`);
      return;
    }
    
    const data = await response.json() as any;
    
    if (data.articles && Array.isArray(data.articles)) {
      for (const article of data.articles.slice(0, 5)) {
        // Add news to database
        await addNews({
          ticker,
          title: article.title,
          description: article.description,
          url: article.url,
          imageUrl: article.urlToImage,
          source: article.source?.name,
          publishedAt: new Date(article.publishedAt),
        });
      }
      console.log(`[News Updater] Updated ${Math.min(5, data.articles.length)} news items for ${ticker}`);
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
