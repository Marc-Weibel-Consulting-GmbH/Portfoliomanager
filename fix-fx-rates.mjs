import { getDb } from './server/db.js';
import { portfolioTransactions } from './drizzle/schema.js';
import { eq, and, or, isNull } from 'drizzle-orm';

async function updateMissingFxRates() {
  console.log('[FX Fix] Starting FX rate update...');
  
  const db = await getDb();
  if (!db) {
    console.error('[FX Fix] Database not available');
    process.exit(1);
  }
  
  // Find all transactions with foreign currency but missing FX rate
  const transactionsWithMissingFx = await db
    .select()
    .from(portfolioTransactions)
    .where(
      and(
        or(
          eq(portfolioTransactions.currency, 'USD'),
          eq(portfolioTransactions.currency, 'EUR'),
          eq(portfolioTransactions.currency, 'GBP')
        ),
        or(
          isNull(portfolioTransactions.fxRate),
          eq(portfolioTransactions.fxRate, '0'),
          eq(portfolioTransactions.fxRate, '')
        )
      )
    );
  
  console.log(`[FX Fix] Found ${transactionsWithMissingFx.length} transactions with missing FX rates`);
  
  if (transactionsWithMissingFx.length === 0) {
    console.log('[FX Fix] No transactions need FX rate updates');
    process.exit(0);
  }
  
  // Import FX helper
  const { getFxRate } = await import('./server/fxHelper.js');
  
  let updatedCount = 0;
  let failedCount = 0;
  
  for (const transaction of transactionsWithMissingFx) {
    try {
      const dateStr = new Date(transaction.transactionDate).toISOString().split('T')[0];
      const currencyPair = transaction.currency + 'CHF';
      
      // Fetch FX rate for transaction date
      const fxRate = await getFxRate(dateStr, currencyPair);
      
      if (!fxRate || fxRate === 0) {
        console.warn(`[FX Fix] Could not fetch FX rate for ${currencyPair} on ${dateStr}`);
        failedCount++;
        continue;
      }
      
      // Calculate totalAmountCHF
      const shares = parseFloat(transaction.shares || '0');
      const price = parseFloat(transaction.pricePerShare || '0');
      const totalAmountCHF = (shares * price * fxRate).toFixed(2);
      
      // Update transaction
      await db
        .update(portfolioTransactions)
        .set({
          fxRate: fxRate.toString(),
          totalAmountCHF: totalAmountCHF,
        })
        .where(eq(portfolioTransactions.id, transaction.id));
      
      console.log(`[FX Fix] Updated ${transaction.ticker} (${transaction.id}): ${dateStr} ${currencyPair} = ${fxRate}`);
      updatedCount++;
    } catch (error) {
      console.error(`[FX Fix] Error updating transaction ${transaction.id}:`, error);
      failedCount++;
    }
  }
  
  console.log(`[FX Fix] Update completed: ${updatedCount} updated, ${failedCount} failed`);
  process.exit(0);
}

updateMissingFxRates().catch(err => {
  console.error('[FX Fix] Fatal error:', err);
  process.exit(1);
});
