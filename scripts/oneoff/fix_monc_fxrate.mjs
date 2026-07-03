import { drizzle } from 'drizzle-orm/mysql2';
import { eq, isNull, and } from 'drizzle-orm';
import { portfolioTransactions } from './drizzle/schema.ts';

const db = drizzle(process.env.DATABASE_URL);

// Import getFxRate
async function getFxRate(date, currencyPair) {
  const dateStr = date.toISOString().split('T')[0];
  const url = `https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/rates_of_exchange?fields=exchange_rate,record_date&filter=currency:eq:${currencyPair.substring(0, 3)},record_date:lte:${dateStr}&sort=-record_date&page[size]=1`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.data && data.data.length > 0) {
      const rate = parseFloat(data.data[0].exchange_rate);
      // Convert USD rate to CHF (approximate)
      if (currencyPair === 'EURCHF') {
        // EUR to USD, then USD to CHF (using 0.88 as CHF/USD rate)
        return rate * 0.88;
      }
      return rate;
    }
  } catch (error) {
    console.error('Error fetching FX rate:', error);
  }
  
  // Fallback rates
  return currencyPair === 'EURCHF' ? 0.93 : 1.0;
}

// Find all EUR transactions with null fxRate
const eurTransactions = await db.select()
  .from(portfolioTransactions)
  .where(and(
    eq(portfolioTransactions.currency, 'EUR'),
    isNull(portfolioTransactions.fxRate)
  ));

console.log(`Found ${eurTransactions.length} EUR transactions with missing fxRate`);

for (const tx of eurTransactions) {
  const fxRate = await getFxRate(tx.transactionDate, 'EURCHF');
  const totalAmountCHF = (parseFloat(tx.totalAmount) * fxRate).toFixed(2);
  
  console.log(`Updating transaction ${tx.id} (${tx.ticker}): fxRate=${fxRate.toFixed(4)}, totalAmountCHF=${totalAmountCHF}`);
  
  await db.update(portfolioTransactions)
    .set({
      fxRate: fxRate.toFixed(4),
      totalAmountCHF: totalAmountCHF
    })
    .where(eq(portfolioTransactions.id, tx.id));
}

console.log('Done!');
process.exit(0);
