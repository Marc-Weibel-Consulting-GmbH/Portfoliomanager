import { drizzle } from 'drizzle-orm/mysql2';
import { eq } from 'drizzle-orm';
import { portfolioTransactions } from './drizzle/schema.ts';

const db = drizzle(process.env.DATABASE_URL);
const txs = await db.select().from(portfolioTransactions).where(eq(portfolioTransactions.portfolioId, 90001));

console.log('Total transactions:', txs.length);
console.log('\nTransactions:');
txs.forEach(tx => {
  console.log(`${tx.transactionDate.toISOString().split('T')[0]} | ${tx.transactionType.padEnd(10)} | ${(tx.ticker || '-').padEnd(10)} | shares: ${(tx.shares || '-').toString().padEnd(8)} | price: ${(tx.pricePerShare || '-').toString().padEnd(8)} | amount: ${(tx.totalAmount || '-').toString().padEnd(10)} | CHF: ${(tx.totalAmountCHF || '-').toString().padEnd(10)} | fx: ${tx.fxRate || '-'}`);
});

// Calculate expected values
let deposits = 0, withdrawals = 0, buyAmounts = 0, sellProceeds = 0, dividends = 0;
txs.forEach(tx => {
  const amountCHF = parseFloat(tx.totalAmountCHF || tx.totalAmount || '0');
  if (tx.transactionType === 'deposit') deposits += amountCHF;
  else if (tx.transactionType === 'withdrawal') withdrawals += Math.abs(amountCHF);
  else if (tx.transactionType === 'buy') buyAmounts += amountCHF;
  else if (tx.transactionType === 'sell') sellProceeds += amountCHF;
  else if (tx.transactionType === 'dividend') dividends += amountCHF;
});

console.log('\n=== Calculation ===');
console.log(`Deposits: CHF ${deposits.toFixed(2)}`);
console.log(`Withdrawals: CHF ${withdrawals.toFixed(2)}`);
console.log(`Buy Amounts: CHF ${buyAmounts.toFixed(2)}`);
console.log(`Sell Proceeds: CHF ${sellProceeds.toFixed(2)}`);
console.log(`Dividends: CHF ${dividends.toFixed(2)}`);
console.log(`\nTotal Deposits (net): CHF ${(deposits - withdrawals).toFixed(2)}`);
console.log(`Cash Position: CHF ${(deposits - withdrawals - buyAmounts + sellProceeds + dividends).toFixed(2)}`);
console.log(`Total Invested in Stocks: CHF ${(buyAmounts - sellProceeds).toFixed(2)}`);
