import { router, protectedProcedure } from "../_core/trpc";

export const dividendCalendarRouter = router({
  /**
   * Get dividend calendar for a portfolio (upcoming + estimated)
   */
  calendar: protectedProcedure
    .input((val: unknown) => {
      if (typeof val === "object" && val !== null && "portfolioId" in val && typeof (val as any).portfolioId === "number") {
        return val as { portfolioId: number };
      }
      throw new Error("Invalid portfolio ID");
    })
    .query(async ({ input, ctx }) => {
      const { getSavedPortfolioById, getPortfolioTransactions } = await import("../db");
      const { getPortfolioDividends } = await import("../dividendCalendar");

      // Get portfolio
      const portfolio = await getSavedPortfolioById(input.portfolioId, ctx.user.id);
      if (!portfolio) {
        throw new Error("Portfolio not found");
      }

      // Parse portfolio data to handle both array and {stocks:[]} format
      const rawData = JSON.parse(portfolio.portfolioData);
      const portfolioData: any[] = Array.isArray(rawData) ? rawData : (rawData.stocks || []);
      const tickers = portfolioData.map((stock: any) => stock.ticker);

      // Get actual holdings from transactions
      const transactions = await getPortfolioTransactions(input.portfolioId);
      const holdings: Record<string, number> = {};

      if (transactions.length > 0) {
        // Use transaction-based holdings
        transactions.forEach((tx: any) => {
          if (!holdings[tx.ticker]) {
            holdings[tx.ticker] = 0;
          }
          const shares = parseFloat(tx.shares || "0");
          if (tx.transactionType === "buy") {
            holdings[tx.ticker] += shares;
          } else if (tx.transactionType === "sell") {
            holdings[tx.ticker] -= shares;
          }
        });
      } else {
        // Fallback: use portfolio data shares (for builder portfolios without transactions)
        portfolioData.forEach((stock: any) => {
          if (stock.ticker && stock.ticker !== "CASH") {
            holdings[stock.ticker] = parseFloat(stock.shares || stock.quantity || "0") || 1;
          }
        });
      }

      // Fetch upcoming dividends (365 days ahead)
      const dividends = await getPortfolioDividends(tickers, 365);

      // Enrich dividend data with company names and expected income
      const enrichedDividends = dividends.map(div => {
        const stock = portfolioData.find((s: any) =>
          s.ticker.toUpperCase() === div.ticker.toUpperCase()
        );
        const shares = holdings[div.ticker] || holdings[div.ticker.toUpperCase()] || 0;

        // Convert to CHF if needed
        const amountInCHF = div.currency === "USD" ? div.amount * 0.88
          : div.currency === "EUR" ? div.amount * 0.95
          : div.amount;
        const expectedIncome = shares * amountInCHF;

        return {
          ticker: div.ticker,
          companyName: stock?.name || stock?.companyName || div.ticker,
          exDate: div.exDividendDate,
          paymentDate: div.paymentDate,
          declarationDate: div.declarationDate,
          dividendPerShare: div.amount,
          currency: div.currency,
          period: div.period,
          type: div.type,
          shares,
          expectedAmount: expectedIncome,
        };
      }).filter(div => div.shares > 0); // Only show dividends for stocks we actually hold

      return enrichedDividends;
    }),

  /**
   * Get all dividends (past + upcoming) for full calendar view
   */
  allDividends: protectedProcedure
    .input((val: unknown) => {
      if (typeof val === "object" && val !== null && "portfolioId" in val && typeof (val as any).portfolioId === "number") {
        return val as { portfolioId: number };
      }
      throw new Error("Invalid portfolio ID");
    })
    .query(async ({ input, ctx }) => {
      const { getSavedPortfolioById, getPortfolioTransactions } = await import("../db");
      const { getAllPortfolioDividends } = await import("../dividendCalendar");

      const portfolio = await getSavedPortfolioById(input.portfolioId, ctx.user.id);
      if (!portfolio) {
        throw new Error("Portfolio not found");
      }

      const rawData2 = JSON.parse(portfolio.portfolioData);
      const portfolioData2: any[] = Array.isArray(rawData2) ? rawData2 : (rawData2.stocks || []);
      const tickers = portfolioData2.map((stock: any) => stock.ticker);

      const transactions = await getPortfolioTransactions(input.portfolioId);
      const holdings: Record<string, number> = {};

      if (transactions.length > 0) {
        transactions.forEach((tx: any) => {
          if (!holdings[tx.ticker]) {
            holdings[tx.ticker] = 0;
          }
          const shares = parseFloat(tx.shares || "0");
          if (tx.transactionType === "buy") {
            holdings[tx.ticker] += shares;
          } else if (tx.transactionType === "sell") {
            holdings[tx.ticker] -= shares;
          }
        });
      } else {
        // Fallback: use portfolio data shares (for builder portfolios without transactions)
        portfolioData2.forEach((stock: any) => {
          if (stock.ticker && stock.ticker !== "CASH") {
            holdings[stock.ticker] = parseFloat(stock.shares || stock.quantity || "0") || 1;
          }
        });
      }

      const dividends = await getAllPortfolioDividends(tickers);

      const enrichedDividends = dividends.map(div => {
        const stock = portfolioData2.find((s: any) =>
          s.ticker.toUpperCase() === div.ticker.toUpperCase()
        );
        const shares = holdings[div.ticker] || holdings[div.ticker.toUpperCase()] || 0;

        const amountInCHF = div.currency === "USD" ? div.amount * 0.88
          : div.currency === "EUR" ? div.amount * 0.95
          : div.amount;
        const expectedIncome = shares * amountInCHF;

        return {
          ticker: div.ticker,
          companyName: stock?.name || stock?.companyName || div.ticker,
          exDate: div.exDividendDate,
          paymentDate: div.paymentDate,
          declarationDate: div.declarationDate,
          dividendPerShare: div.amount,
          currency: div.currency,
          period: div.period,
          type: div.type,
          shares,
          expectedAmount: expectedIncome,
        };
      }).filter(div => div.shares > 0);

      return enrichedDividends;
    }),

  /**
   * Get upcoming dividends (backward compatibility)
   */
  getUpcoming: protectedProcedure
    .input((val: unknown) => {
      if (typeof val === "object" && val !== null && "portfolioId" in val && typeof (val as any).portfolioId === "number") {
        return val as { portfolioId: number; daysAhead?: number };
      }
      throw new Error("Invalid portfolio ID");
    })
    .query(async ({ input, ctx }) => {
      const { getSavedPortfolioById, getPortfolioTransactions } = await import("../db");
      const { getPortfolioDividends } = await import("../dividendCalendar");

      const portfolio = await getSavedPortfolioById(input.portfolioId, ctx.user.id);
      if (!portfolio) {
        throw new Error("Portfolio not found");
      }

      const rawData3 = JSON.parse(portfolio.portfolioData);
      const portfolioData3: any[] = Array.isArray(rawData3) ? rawData3 : (rawData3.stocks || []);
      const tickers = portfolioData3.map((stock: any) => stock.ticker);

      const transactions = await getPortfolioTransactions(input.portfolioId);
      const holdings: Record<string, number> = {};

      if (transactions.length > 0) {
        transactions.forEach((tx: any) => {
          if (!holdings[tx.ticker]) {
            holdings[tx.ticker] = 0;
          }
          const shares = parseFloat(tx.shares || "0");
          if (tx.transactionType === "buy") {
            holdings[tx.ticker] += shares;
          } else if (tx.transactionType === "sell") {
            holdings[tx.ticker] -= shares;
          }
        });
      } else {
        // Fallback: use portfolio data shares (for builder portfolios without transactions)
        portfolioData3.forEach((stock: any) => {
          if (stock.ticker && stock.ticker !== "CASH") {
            holdings[stock.ticker] = parseFloat(stock.shares || stock.quantity || "0") || 1;
          }
        });
      }

      const dividends = await getPortfolioDividends(tickers, (input as any).daysAhead || 365);

      const enrichedDividends = dividends.map(div => {
        const stock = portfolioData3.find((s: any) =>
          s.ticker.toUpperCase() === div.ticker.toUpperCase()
        );
        const shares = holdings[div.ticker] || holdings[div.ticker.toUpperCase()] || 0;

        const amountInCHF = div.currency === "USD" ? div.amount * 0.88
          : div.currency === "EUR" ? div.amount * 0.95
          : div.amount;
        const expectedIncome = shares * amountInCHF;

        return {
          ticker: div.ticker,
          companyName: stock?.name || stock?.companyName || div.ticker,
          exDividendDate: div.exDividendDate,
          paymentDate: div.paymentDate,
          amount: div.amount,
          currency: div.currency,
          period: div.period,
          type: div.type,
          shares,
          expectedIncome,
        };
      }).filter(div => div.shares > 0);

      return enrichedDividends;
    }),
});
