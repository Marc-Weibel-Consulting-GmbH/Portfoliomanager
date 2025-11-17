import { drizzle } from 'drizzle-orm/mysql2';
import { eq } from 'drizzle-orm';
import { portfolioTransactions } from './drizzle/schema.ts';

const db = drizzle(process.env.DATABASE_URL);
const txs = await db.select().from(portfolioTransactions).where(eq(portfolioTransactions.portfolioId, 90001));

let deposits = 0, buyAmounts = 0;
txs.forEach(tx => {
  const amountCHF = parseFloat(tx.totalAmountCHF || '0');
  const isInitialPosition = tx.notes && tx.notes.includes('Initial position');
  
  if (tx.transactionType === 'deposit') {
    deposits += amountCHF;
  } else if (tx.transactionType === 'buy') {
    buyAmounts += amountCHF;
    if (isInitialPosition) {
      deposits += amountCHF;  // Treat as implicit deposit
    }
  }
});

console.log('=== New Calculation ===');
console.log(`Explicit Deposits: CHF ${deposits.toFixed(2)}`);
console.log(`Total Buy Amounts: CHF ${buyAmounts.toFixed(2)}`);
console.log(`Total Deposits (with initial positions): CHF ${deposits.toFixed(2)}`);
console.log(`Cash Position: CHF ${(deposits - buyAmounts).toFixed(2)}`);
