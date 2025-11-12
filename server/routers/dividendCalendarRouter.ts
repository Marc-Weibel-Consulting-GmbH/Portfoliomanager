import { router, protectedProcedure } from "../_core/trpc";

export const dividendCalendarRouter = router({
  getUpcoming: protectedProcedure
    .input((val: unknown) => {
      if (typeof val === "object" && val !== null && "portfolioId" in val && typeof val.portfolioId === "number") {
        return val as { portfolioId: number; daysAhead?: number };
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
      
      // Parse portfolio data to get tickers and company names
      const portfolioData = JSON.parse(portfolio.portfolioData);
      const tickers = portfolioData.map((stock: any) => stock.ticker);
      
      // Get actual holdings from transactions
      const transactions = await getPortfolioTransactions(input.portfolioId);
      const holdings: Record<string, number> = {};
      
      transactions.forEach((tx: any) => {
        if (!holdings[tx.ticker]) {
          holdings[tx.ticker] = 0;
        }
        const shares = parseFloat(tx.shares || '0');
        if (tx.transactionType === 'buy') {
          holdings[tx.ticker] += shares;
        } else if (tx.transactionType === 'sell') {
          holdings[tx.ticker] -= shares;
        }
      });
      
      // Fetch upcoming dividends
      const dividends = await getPortfolioDividends(tickers, input.daysAhead || 365);
      
      // Enrich dividend data with company names and expected income
      const enrichedDividends = dividends.map(div => {
        const stock = portfolioData.find((s: any) => s.ticker.toUpperCase() === div.ticker.toUpperCase());
        const shares = holdings[div.ticker] || holdings[div.ticker.toUpperCase()] || 0;
        
        // Convert to CHF if needed (simplified - would need real exchange rates)
        const amountInCHF = div.currency === 'USD' ? div.amount * 0.88 : div.amount;
        const expectedIncome = shares * amountInCHF;
        
        return {
          ticker: div.ticker,
          companyName: stock?.name || div.ticker,
          exDividendDate: div.exDividendDate,
          paymentDate: div.paymentDate,
          amount: div.amount,
          currency: div.currency,
          shares,
          expectedIncome
        };
      }).filter(div => div.shares > 0); // Only show dividends for stocks we own
      
      const totalExpectedIncome = enrichedDividends.reduce((sum, div) => sum + div.expectedIncome, 0);
      
      return enrichedDividends;
    }),
});
