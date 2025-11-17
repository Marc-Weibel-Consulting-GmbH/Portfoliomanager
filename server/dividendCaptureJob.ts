/**
 * Dividend Capture Cron Job
 * Automatically creates dividend transactions when ex-dividend dates occur
 */

import cron from 'node-cron';

/**
 * Check all live portfolios for dividend events today
 */
async function captureDividends() {
  console.log('[DividendCapture] Running dividend capture job...');
  
  try {
    const { getDb } = await import('./db');
    const { savedPortfolios, portfolioTransactions } = await import('../drizzle/schema');
    const { eq } = await import('drizzle-orm');
    const { fetchUpcomingDividends } = await import('./dividendCalendar');
    
    const db = await getDb();
    if (!db) {
      console.warn('[DividendCapture] Database not available');
      return;
    }
    
    // Get all live portfolios
    const livePortfolios = await db
      .select()
      .from(savedPortfolios)
      .where(eq(savedPortfolios.isLive, true));
    
    console.log(`[DividendCapture] Found ${livePortfolios.length} live portfolios`);
    
    // Get today's date
    const today = new Date().toISOString().split('T')[0];
    
    // Fetch dividends for today
    const todaysDividends = await fetchUpcomingDividends(today, today);
    
    if (todaysDividends.length === 0) {
      console.log('[DividendCapture] No dividends today');
      return;
    }
    
    console.log(`[DividendCapture] Found ${todaysDividends.length} dividend events today`);
    
    // Process each portfolio
    for (const portfolio of livePortfolios) {
      try {
        // Parse portfolio data to get holdings
        const portfolioData = JSON.parse(portfolio.portfolioData);
        const portfolioTickers = new Set(
          portfolioData.map((stock: any) => stock.ticker.toUpperCase())
        );
        
        // Get actual holdings from transactions
        const transactions = await db
          .select()
          .from(portfolioTransactions)
          .where(eq(portfolioTransactions.portfolioId, portfolio.id));
        
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
        
        // Check for matching dividends
        for (const dividend of todaysDividends) {
          const ticker = dividend.ticker.toUpperCase();
          
          // Skip if we don't own this stock
          if (!portfolioTickers.has(ticker)) continue;
          
          const shares = holdings[ticker] || 0;
          if (shares <= 0) continue;
          
          // Check if we already created a dividend transaction for this
          const existing = await db
            .select()
            .from(portfolioTransactions)
            .where(eq(portfolioTransactions.portfolioId, portfolio.id))
            .where(eq(portfolioTransactions.ticker, ticker))
            .where(eq(portfolioTransactions.transactionType, 'dividend'));
          
          const alreadyRecorded = existing.some((tx: any) => {
            const txDate = new Date(tx.transactionDate).toISOString().split('T')[0];
            return txDate === today;
          });
          
          if (alreadyRecorded) {
            console.log(`[DividendCapture] Dividend already recorded for ${ticker} in portfolio ${portfolio.id}`);
            continue;
          }
          
          // Convert to CHF if needed (simplified - would need real exchange rates)
          const amountInCHF = dividend.currency === 'USD' ? dividend.amount * 0.88 : dividend.amount;
          const totalAmount = shares * amountInCHF;
          
          // Create dividend transaction
          await db.insert(portfolioTransactions).values({
            portfolioId: portfolio.id,
            transactionType: 'dividend',
            ticker,
            shares: shares.toString(),
            pricePerShare: amountInCHF.toString(),
            totalAmount: totalAmount.toString(),
            fees: '0',
            notes: `Automatische Dividende: ${dividend.amount} ${dividend.currency}/Aktie`,
            transactionDate: new Date(today),
            createdAt: new Date(),
          });
          
          console.log(`[DividendCapture] Created dividend transaction: ${ticker} x ${shares} shares = CHF ${totalAmount.toFixed(2)}`);
        }
      } catch (error) {
        console.error(`[DividendCapture] Error processing portfolio ${portfolio.id}:`, error);
      }
    }
    
    console.log('[DividendCapture] Dividend capture job completed');
  } catch (error) {
    console.error('[DividendCapture] Fatal error in dividend capture job:', error);
  }
}

/**
 * Initialize the dividend capture cron job
 * Runs daily at 6:00 AM
 */
export function initDividendCaptureJob() {
  // Run daily at 6:00 AM
  cron.schedule('0 6 * * *', () => {
    captureDividends();
  });
  
  console.log('[DividendCapture] Cron job initialized (runs daily at 6:00 AM)');
  
  // Optional: Run immediately on startup for testing
  // captureDividends();
}
