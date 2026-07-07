import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { ENV } from "../_core/env";
import { toEodhdSymbol } from "../lib/eodhdSymbol";

export const weeklyOverviewRouter = router({
    generate: protectedProcedure.query(async ({ ctx }) => {
      const { getDb } = await import("../db");
      const { stocks } = await import("../../drizzle/schema");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get all portfolio stocks
      const allStocks = await db.select().from(stocks);
      if (allStocks.length === 0) return { overview: [] };

      const { getFinnhubApiKey } = await import("../_core/env");
      const apiKey = await getFinnhubApiKey();
      if (!apiKey) {
        throw new Error(`Finnhub API key not configured. Please add it via Admin > API Secrets.`);
      }

      // Get date range for current week
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const fromDate = weekAgo.toISOString().split('T')[0];
      const toDate = now.toISOString().split('T')[0];

      console.log(`[WeeklyOverview] Analyzing ${allStocks.length} stocks from ${fromDate} to ${toDate}`);

      // Fetch news and price data for each stock
      const stockAnalysisPromises = allStocks.map(async (stock) => {
        try {
          const cleanTicker = stock.ticker.replace(/\s+•\s+/, '.').replace('.SW', '');
          
          // Fetch news from Finnhub
          const newsUrl = `https://finnhub.io/api/v1/company-news?symbol=${cleanTicker}&from=${fromDate}&to=${toDate}&token=${apiKey}`;
          const newsRes = await fetch(newsUrl);
          const newsData = newsRes.ok ? await newsRes.json() : [];

          // Fetch weekly price data to check for significant moves
          const eodhd_key = ENV.eodhdApiKey;
          let priceChange = 0;
          if (eodhd_key) {
            try {
              const priceUrl = `https://eodhd.com/api/eod/${toEodhdSymbol(stock.ticker)}?api_token=${eodhd_key}&from=${fromDate}&to=${toDate}&fmt=json`;
              const priceRes = await fetch(priceUrl);
              if (priceRes.ok) {
                const priceData = await priceRes.json();
                if (priceData && priceData.length >= 2) {
                  const firstPrice = priceData[0].close;
                  const lastPrice = priceData[priceData.length - 1].close;
                  priceChange = ((lastPrice - firstPrice) / firstPrice) * 100;
                }
              }
            } catch (e) {
              console.error(`[WeeklyOverview] Price fetch failed for ${stock.ticker}:`, e);
            }
          }

          return {
            ticker: stock.ticker,
            companyName: stock.companyName,
            news: newsData || [],
            priceChange,
          };
        } catch (error) {
          console.error(`[WeeklyOverview] Error fetching data for ${stock.ticker}:`, error);
          return {
            ticker: stock.ticker,
            companyName: stock.companyName,
            news: [],
            priceChange: 0,
          };
        }
      });

      const stocksData = await Promise.all(stockAnalysisPromises);

      // Use LLM to filter and summarize relevant news
      const { invokeLLM } = await import("../_core/llm");
      
      const prompt = `Du bist ein Finanzanalyst. Analysiere die folgenden Aktien und ihre News der letzten Woche.

Zeige NUR Aktien an, die WICHTIGE Ereignisse hatten:
- Gewinnpublikationen (Earnings)
- Übernahmen / M&A
- Starke Kursbewegungen (>10% oder <-10%)
- Wichtige Corporate News (neue Produkte, Partnerschaften, Regulierung)
- Neue Kursziele von Analysten

Aktien-Daten:
${JSON.stringify(stocksData.map(s => ({
  ticker: s.ticker,
  name: s.companyName,
  priceChange: s.priceChange.toFixed(2) + '%',
  newsCount: s.news.length,
  headlines: s.news.slice(0, 5).map((n: any) => n.headline)
})), null, 2)}

Antworte im JSON-Format:
{
  "stocks": [
    {
      "ticker": "AAPL",
      "companyName": "Apple Inc.",
      "summary": "Kurze Zusammenfassung der wichtigsten Ereignisse",
      "events": [
        { "type": "earnings", "description": "Q4 Earnings übertreffen Erwartungen" },
        { "type": "price_move", "description": "+12.5% Kursanstieg nach Earnings" }
      ]
    }
  ]
}

Wenn eine Aktie KEINE wichtigen Ereignisse hatte, lasse sie weg.`;

      try {
        const llmResponse = await invokeLLM({
          messages: [
            { role: "system", content: "Du bist ein Finanzanalyst, der relevante Börsennews filtert und zusammenfasst." },
            { role: "user", content: prompt }
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "weekly_overview",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  stocks: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        ticker: { type: "string" },
                        companyName: { type: "string" },
                        summary: { type: "string" },
                        events: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              type: { type: "string" },
                              description: { type: "string" }
                            },
                            required: ["type", "description"],
                            additionalProperties: false
                          }
                        }
                      },
                      required: ["ticker", "companyName", "summary", "events"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["stocks"],
                additionalProperties: false
              }
            }
          }
        });

        const content = llmResponse.choices[0]?.message?.content;
        if (!content) throw new Error("No LLM response");
        if (typeof content !== 'string') throw new Error("Invalid LLM response format");
        
        const result = JSON.parse(content);
        console.log(`[WeeklyOverview] LLM filtered to ${result.stocks.length} stocks with important events`);
        
        return { overview: result.stocks };
      } catch (error: any) {
        console.error("[WeeklyOverview] LLM error:", error);
        throw new Error(`Failed to generate overview: ${error.message}`);
      }
    }),
});
