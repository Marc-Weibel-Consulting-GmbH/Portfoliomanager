/**
 * Transaction FX Rate Update Job
 * 
 * Scans all transactions for missing FX rates and updates them with historical data.
 * Runs daily at 7:00 AM (after FX rates fetch job at 6:30 AM).
 */

import cron from 'node-cron';
import { getDb } from './db';
import { portfolioTransactions } from '../drizzle/schema';
import { eq, and, or, isNull } from 'drizzle-orm';

/**
 * Update missing FX rates in transactions
 */
async function updateMissingFxRates() {
  console.log('[TransactionFxUpdate] Starting FX rate update for transactions...');
  
  const db = await getDb();
  if (!db) {
    console.error('[TransactionFxUpdate] Database not available');
    return;
  }
  
  try {
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
    
    console.log(`[TransactionFxUpdate] Found ${transactionsWithMissingFx.length} transactions with missing FX rates`);
    
    if (transactionsWithMissingFx.length === 0) {
      console.log('[TransactionFxUpdate] No transactions need FX rate updates');
      return;
    }
    
    // Import FX helper
    const { getFxRate } = await import('./fxHelper');
    
    let updatedCount = 0;
    let failedCount = 0;
    
    for (const transaction of transactionsWithMissingFx) {
      try {
        const dateStr = new Date(transaction.transactionDate).toISOString().split('T')[0];
        const currencyPair = transaction.currency + 'CHF';
        
        // Fetch FX rate for transaction date
        const fxRate = await getFxRate(dateStr, currencyPair);
        
        if (!fxRate || fxRate === 0) {
          console.warn(`[TransactionFxUpdate] Could not fetch FX rate for ${currencyPair} on ${dateStr}`);
          failedCount++;
          continue;
        }
        
        // Calculate totalAmountCHF if missing
        const shares = parseFloat(transaction.shares || '0');
        const price = parseFloat(transaction.pricePerShare || '0');
        const totalAmountCHF = (shares * price * fxRate).toFixed(2);
        
        // Update transaction with FX rate and CHF amount
        await db
          .update(portfolioTransactions)
          .set({
            fxRate: fxRate.toString(),
            totalAmountCHF: totalAmountCHF,
          })
          .where(eq(portfolioTransactions.id, transaction.id));
        
        console.log(`[TransactionFxUpdate] Updated transaction ${transaction.id}: ${transaction.ticker} on ${dateStr} with FX rate ${fxRate}`);
        updatedCount++;
        
        // Rate limit: wait 100ms between updates
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`[TransactionFxUpdate] Error updating transaction ${transaction.id}:`, error);
        failedCount++;
      }
    }
    
    console.log(`[TransactionFxUpdate] Update completed: ${updatedCount} updated, ${failedCount} failed`);
  } catch (error) {
    console.error('[TransactionFxUpdate] Error during FX rate update:', error);
  }
}

/**
 * Initialize the transaction FX update cron job
 */
export function initTransactionFxUpdateCron() {
  // Run daily at 7:00 AM (after FX rates fetch at 6:30 AM)
  cron.schedule('0 7 * * *', async () => {
    await updateMissingFxRates();
  });
  
  console.log('[TransactionFxUpdate] Cron job initialized (runs daily at 7:00 AM)');
  
  // Run immediately on startup (with delay to ensure FX rates are available)
  setTimeout(async () => {
    await updateMissingFxRates();
  }, 10000); // 10 second delay
}

/**
 * Manual trigger for updating missing FX rates (can be called from admin panel)
 */
export async function manualUpdateMissingFxRates() {
  await updateMissingFxRates();
}
