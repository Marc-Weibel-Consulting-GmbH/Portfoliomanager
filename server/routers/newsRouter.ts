import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { callDataApi } from "../_core/dataApi";

export const newsRouter = router({
  // Get latest financial news from Yahoo Finance
  getLatest: protectedProcedure
    .input(z.object({
      limit: z.number().int().min(1).max(20).optional().default(5),
    }).optional())
    .query(async ({ input }) => {
      const limit = input?.limit || 5;
      
      try {
        // First try to get news from database
        const { getAllNews } = await import("../db");
        const dbNews = await getAllNews(limit);
        
        if (dbNews && dbNews.length > 0) {
          return dbNews.map(n => ({
            id: n.id,
            title: n.title,
            description: n.description || '',
            url: n.url || '',
            imageUrl: n.imageUrl || '',
            source: n.source || 'Unbekannt',
            publishedAt: n.publishedAt ? new Date(n.publishedAt).toISOString() : new Date().toISOString(),
            ticker: n.ticker,
          }));
        }
        
        // Fallback: fetch from Yahoo Finance API
        const response = await callDataApi("YahooFinance/get_stock_insights", {
          query: { symbol: "^GSPC" }, // S&P 500 for general market news
        });
        
        const typedResponse = response as any;
        if (typedResponse && typedResponse.finance && typedResponse.finance.result) {
          const result = typedResponse.finance.result;
          const newsItems: any[] = [];
          
          // Extract news from significant developments
          if (result.sigDevs && Array.isArray(result.sigDevs)) {
            result.sigDevs.slice(0, limit).forEach((dev: any, index: number) => {
              newsItems.push({
                id: index + 1,
                title: dev.headline || 'Marktentwicklung',
                description: dev.description || '',
                url: '',
                imageUrl: '',
                source: 'Yahoo Finance',
                publishedAt: dev.date ? new Date(dev.date * 1000).toISOString() : new Date().toISOString(),
                ticker: '^GSPC',
              });
            });
          }
          
          return newsItems.slice(0, limit);
        }
        
        // Return empty array if no news available
        return [];
      } catch (error) {
        console.error('[NewsRouter] Error fetching news:', error);
        return [];
      }
    }),

  // Get news for a specific stock
  getByTicker: protectedProcedure
    .input(z.object({
      ticker: z.string(),
      limit: z.number().int().min(1).max(20).optional().default(5),
    }))
    .query(async ({ input }) => {
      try {
        // First try database
        const { getNewsByTicker } = await import("../db");
        const dbNews = await getNewsByTicker(input.ticker, input.limit);
        
        if (dbNews && dbNews.length > 0) {
          return dbNews.map(n => ({
            id: n.id,
            title: n.title,
            description: n.description || '',
            url: n.url || '',
            imageUrl: n.imageUrl || '',
            source: n.source || 'Unbekannt',
            publishedAt: n.publishedAt ? new Date(n.publishedAt).toISOString() : new Date().toISOString(),
            ticker: n.ticker,
          }));
        }
        
        // Fallback: fetch from Yahoo Finance API
        const response = await callDataApi("YahooFinance/get_stock_insights", {
          query: { symbol: input.ticker },
        });
        
        const typedResp = response as any;
        if (typedResp && typedResp.finance && typedResp.finance.result) {
          const result = typedResp.finance.result;
          const newsItems: any[] = [];
          
          // Extract news from significant developments
          if (result.sigDevs && Array.isArray(result.sigDevs)) {
            result.sigDevs.slice(0, input.limit).forEach((dev: any, index: number) => {
              newsItems.push({
                id: index + 1,
                title: dev.headline || 'Unternehmensentwicklung',
                description: dev.description || '',
                url: '',
                imageUrl: '',
                source: 'Yahoo Finance',
                publishedAt: dev.date ? new Date(dev.date * 1000).toISOString() : new Date().toISOString(),
                ticker: input.ticker,
              });
            });
          }
          
          return newsItems;
        }
        
        return [];
      } catch (error) {
        console.error('[NewsRouter] Error fetching news for ticker:', error);
        return [];
      }
    }),


});
