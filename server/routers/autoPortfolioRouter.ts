import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { invokeLLM } from "../_core/llm";

export const autoPortfolioRouter = router({
  generatePortfolio: protectedProcedure
    .input(
      z.object({
        strategy: z.enum(['growth', 'dividends', 'balanced']),
        investmentHorizon: z.enum(['short', 'medium', 'long']),
        riskTolerance: z.enum(['low', 'medium', 'high']).optional(),
        targetStockCount: z.number().min(5).max(20).default(10),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      
      if (!db) {
        throw new Error("Database not available");
      }

      // Fetch all available stocks
      const { stocks: stocksTable } = await import("../../drizzle/schema");
      const allStocks = await db.select().from(stocksTable);

      if (allStocks.length === 0) {
        throw new Error("No stocks available in database");
      }

      // Prepare stock data for LLM
      const stocksData = allStocks.map(stock => ({
        ticker: stock.ticker,
        companyName: stock.companyName,
        sector: stock.sector,
        currentPrice: stock.currentPrice,
        ytdPerformance: stock.ytdPerformance,
        dividendYield: stock.dividendYield,
        marketCap: stock.marketCap,
      }));

      // Create prompt for LLM
      const strategyDescription = {
        growth: 'high capital appreciation with focus on growth stocks',
        dividends: 'steady income through dividend-paying stocks',
        balanced: 'balanced mix of growth and dividend stocks',
      }[input.strategy];

      const horizonDescription = {
        short: 'short-term (< 3 years)',
        medium: 'medium-term (3-7 years)',
        long: 'long-term (> 7 years)',
      }[input.investmentHorizon];

      const prompt = `You are a professional portfolio manager. Create a diversified stock portfolio with the following criteria:

Strategy: ${strategyDescription}
Investment Horizon: ${horizonDescription}
Target Number of Stocks: ${input.targetStockCount}

Available stocks (JSON):
${JSON.stringify(stocksData, null, 2)}

Requirements:
1. Select exactly ${input.targetStockCount} stocks from the available list
2. Ensure good sector diversification (max 30% in any single sector)
3. Assign percentage weights that sum to exactly 100%
4. For growth strategy: prioritize stocks with high YTD performance and growth potential
5. For dividends strategy: prioritize stocks with high dividend yields (> 2%)
6. For balanced strategy: mix of both growth and dividend stocks
7. Consider market cap for stability (prefer larger caps for conservative strategies)

Return ONLY a valid JSON array with this exact structure (no additional text):
[
  {
    "ticker": "AAPL",
    "weight": 15.5,
    "reason": "Strong growth potential and market leader"
  }
]

The weights must sum to exactly 100.0. Include a brief reason for each selection.`;

      try {
        // Call LLM to generate portfolio
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: "You are a professional portfolio manager. Return only valid JSON, no markdown formatting.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "portfolio_selection",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  selections: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        ticker: { type: "string", description: "Stock ticker symbol" },
                        weight: { type: "number", description: "Percentage weight in portfolio (0-100)" },
                        reason: { type: "string", description: "Brief reason for selection" },
                      },
                      required: ["ticker", "weight", "reason"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["selections"],
                additionalProperties: false,
              },
            },
          },
        });

        const content = response.choices[0]?.message?.content;
        if (!content || typeof content !== 'string') {
          throw new Error("No valid response from LLM");
        }

        const result = JSON.parse(content);
        const selections = result.selections || [];

        // Validate and normalize weights
        const totalWeight = selections.reduce((sum: number, s: any) => sum + s.weight, 0);
        const normalizedSelections = selections.map((s: any) => ({
          ...s,
          weight: (s.weight / totalWeight) * 100, // Normalize to exactly 100%
        }));

        // Enrich with stock data
        const enrichedSelections = normalizedSelections
          .map((selection: any) => {
            const stock = allStocks.find(s => s.ticker === selection.ticker);
            if (!stock) return null;

            return {
              ticker: stock.ticker,
              companyName: stock.companyName,
              weight: parseFloat(selection.weight.toFixed(2)),
              type: 'stock' as const,
              currentPrice: stock.currentPrice,
              ytdPerformance: stock.ytdPerformance,
              dividendYield: stock.dividendYield,
              sector: stock.sector,
              reason: selection.reason,
            };
          })
          .filter(Boolean);

        // Final weight adjustment to ensure exactly 100%
        const finalTotalWeight = enrichedSelections.reduce((sum: number, s: any) => sum + s.weight, 0);
        if (Math.abs(finalTotalWeight - 100) > 0.01) {
          const adjustment = (100 - finalTotalWeight) / enrichedSelections.length;
          enrichedSelections.forEach((s: any) => {
            s.weight = parseFloat((s.weight + adjustment).toFixed(2));
          });
        }

        return {
          success: true,
          positions: enrichedSelections,
          metadata: {
            strategy: input.strategy,
            investmentHorizon: input.investmentHorizon,
            generatedAt: new Date().toISOString(),
          },
        };
      } catch (error: any) {
        console.error("Error generating portfolio:", error);
        throw new Error(`Failed to generate portfolio: ${error.message}`);
      }
    }),
});
