import { drizzle } from 'drizzle-orm/mysql2';
import { eq, and } from 'drizzle-orm';

const db = drizzle(process.env.DATABASE_URL);

const result = await db.execute(`
  SELECT id, ticker, transactionType, shares, pricePerShare, totalAmount, currency, fxRate, totalAmountCHF 
  FROM portfolioTransactions 
  WHERE portfolioId = 90001 AND transactionType = 'buy' 
  ORDER BY transactionDate
`);

console.log('Buy transactions:');
let totalCHF = 0;
result[0].forEach(tx => {
  const chf = parseFloat(tx.totalAmountCHF || '0');
  totalCHF += chf;
  console.log(`${tx.ticker}: ${tx.shares} @ ${tx.pricePerShare} ${tx.currency} (FX: ${tx.fxRate}) = ${tx.totalAmount} ${tx.currency} = CHF ${tx.totalAmountCHF}`);
});
console.log(`\nTotal invested (CHF): ${totalCHF.toFixed(2)}`);
