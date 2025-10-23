import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { systemRouter } from "./_core/systemRouter";

// Helper function to calculate equal weight for remaining stocks
async function recalculateWeights(excludeTicker?: string) {
  const { getAllStocks, updateStock } = await import("./db");
  const stocks = await getAllStocks();
  
  // Filter out the excluded ticker (if deleting)
  const activeStocks = excludeTicker 
    ? stocks.filter(s => s.ticker !== excludeTicker)
    : stocks;
  
  if (activeStocks.length === 0) return;
  
  // Calculate total weight of manually weighted stocks
  let manualWeight = 0;
  const manualStocks: string[] = [];
  
  activeStocks.forEach(stock => {
    const weight = parseFloat(stock.portfolioWeight || "0");
    // Consider a stock "manually weighted" if it differs from equal weight
    const equalWeight = 100 / activeStocks.length;
    if (Math.abs(weight - equalWeight) > 0.01) {
      manualWeight += weight;
      manualStocks.push(stock.ticker);
    }
  });
  
  // Calculate remaining weight for auto-weighted stocks
  const remainingWeight = 100 - manualWeight;
  const autoWeightedStocks = activeStocks.filter(s => !manualStocks.includes(s.ticker));
  const autoWeight = autoWeightedStocks.length > 0 
    ? remainingWeight / autoWeightedStocks.length
    : 0;
  
  // Update all stocks
  for (const stock of activeStocks) {
    let newWeight: number;
    
    if (manualStocks.includes(stock.ticker)) {
      // Keep manually weighted stocks as they are
      newWeight = parseFloat(stock.portfolioWeight || "0");
    } else {
      // Auto-weighted stocks get equal share of remaining weight
      newWeight = autoWeight;
    }
    
    await updateStock(stock.ticker, {
      portfolioWeight: newWeight.toFixed(4),
    });
  }
}

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  stocks: router({
    list: publicProcedure.query(async () => {
      const { getAllStocks } = await import("./db");
      return await getAllStocks();
    }),
    byCategory: publicProcedure
      .input((val: unknown) => {
        if (typeof val === "string") return val;
        throw new Error("Invalid category");
      })
      .query(async ({ input }) => {
        const { getStocksByCategory } = await import("./db");
        return await getStocksByCategory(input);
      }),
    byTicker: publicProcedure
      .input((val: unknown) => {
        if (typeof val === "string") return val;
        throw new Error("Invalid ticker");
      })
      .query(async ({ input }) => {
        const { getStockByTicker } = await import("./db");
        return await getStockByTicker(input);
      }),
    stats: publicProcedure.query(async () => {
      const { getAllStocks } = await import("./db");
      const stocks = await getAllStocks();
      
      const categories = stocks.reduce((acc, stock) => {
        const cat = stock.category || "Andere";
        acc[cat] = (acc[cat] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Calculate weighted dividend yield based on portfolio weight
      const dividendStocks = stocks.filter(s => s.dividendYield && s.portfolioWeight);
      let totalWeight = 0;
      let weightedYield = 0;

      dividendStocks.forEach(s => {
        const weight = parseFloat(s.portfolioWeight || "0");
        const yield_ = parseFloat(s.dividendYield || "0");
        totalWeight += weight;
        weightedYield += (weight * yield_) / 100;
      });

      const avgDividendYield = totalWeight > 0 ? weightedYield : 0;

      return {
        totalStocks: stocks.length,
        categories,
        avgDividendYield: avgDividendYield.toFixed(2),
        totalPortfolioWeight: totalWeight.toFixed(2),
        categoryCounts: Object.entries(categories).map(([name, count]) => ({ name, count })),
      };
    }),
    add: protectedProcedure
      .input((val: unknown) => {
        if (typeof val === "object" && val !== null) return val;
        throw new Error("Invalid input");
      })
      .mutation(async ({ input }) => {
        const { insertStock, getAllStocks } = await import("./db");
        await insertStock(input as any);
        
        // Recalculate weights for all stocks after adding a new one
        await recalculateWeights();
        
        return { success: true };
      }),
    update: protectedProcedure
      .input((val: unknown) => {
        if (typeof val === "object" && val !== null && "ticker" in val) return val;
        throw new Error("Invalid input");
      })
      .mutation(async ({ input }) => {
        const { updateStock } = await import("./db");
        const { ticker, ...updates } = input as any;
        
        // Check if portfolioWeight is being updated
        const hasWeightUpdate = "portfolioWeight" in updates;
        
        await updateStock(ticker, updates);
        
        // If weight was manually updated, recalculate other weights
        if (hasWeightUpdate) {
          await recalculateWeights();
        }
        
        return { success: true };
      }),
    delete: protectedProcedure
      .input((val: unknown) => {
        if (typeof val === "string") return val;
        throw new Error("Invalid ticker");
      })
      .mutation(async ({ input }) => {
        const { deleteStock } = await import("./db");
        await deleteStock(input);
        
        // Recalculate weights for remaining stocks after deletion
        await recalculateWeights();
        
        return { success: true };
      }),
  }),

  news: router({
    getByTicker: publicProcedure
      .input((val: unknown) => {
        if (typeof val === "string") return val;
        throw new Error("Invalid ticker");
      })
      .query(async ({ input }) => {
        const { getNewsByTicker } = await import("./db");
        return await getNewsByTicker(input, 10);
      }),
    getAll: publicProcedure.query(async () => {
      const { getAllNews } = await import("./db");
      return await getAllNews(50);
    }),
  }),
});

export type AppRouter = typeof appRouter;

