import { Router } from 'express';
import { getDb } from './db';
import { savedPortfolios } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

export const debugRouter = Router();

debugRouter.get('/debug/portfolio/:id', async (req, res) => {
  try {
    const portfolioId = parseInt(req.params.id);
    
    // Get portfolio directly without user check
    const db = await getDb();
    if (!db) {
      return res.json({ error: 'Database not available' });
    }
    
    const [portfolio] = await db.select().from(savedPortfolios).where(eq(savedPortfolios.id, portfolioId)).limit(1);
    
    if (!portfolio) {
      return res.json({ error: 'Portfolio not found' });
    }
    
    // Parse portfolio data
    let portfolioData: { stocks: any[] } = { stocks: [] };
    try {
      portfolioData = JSON.parse(portfolio.portfolioData || '{}');
    } catch (e) {
      console.error('Failed to parse portfolio data:', e);
    }
    
    // Filter out CASH ticker
    const stocksWithoutCash = (portfolioData.stocks || []).filter((s: any) => s.ticker !== 'CASH');
    
    // Calculate total value
    let totalValueCHF = 0;
    stocksWithoutCash.forEach((stock: any) => {
      const shares = parseFloat(stock.shares) || 0;
      const price = parseFloat(stock.currentPrice) || 0;
      totalValueCHF += shares * price;
    });
    
    // Fix Decimal/Number type issue: explicitly convert cashBalance to number
    const cashBalance = portfolio.cashBalance == null
      ? 0
      : typeof portfolio.cashBalance === 'number'
        ? portfolio.cashBalance
        : Number(portfolio.cashBalance); // Decimal/String -> number
    const totalWithCash = totalValueCHF + cashBalance;
    
    res.json({
      portfolioId: portfolio.id,
      name: portfolio.name,
      cashBalance,
      originalStockCount: portfolioData.stocks?.length || 0,
      stocksWithoutCashCount: stocksWithoutCash.length,
      stockTickers: portfolioData.stocks?.map((s: any) => s.ticker),
      stocksWithoutCashTickers: stocksWithoutCash.map((s: any) => s.ticker),
      firstStockSample: portfolioData.stocks?.[0] || null,
      totalValueWithoutCash: totalValueCHF,
      totalValueWithCash: totalWithCash,
      calculation: {
        step1_stocks: totalValueCHF,
        step2_add_cash: cashBalance,
        step3_total: totalWithCash,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
