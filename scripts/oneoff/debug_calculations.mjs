import { drizzle } from 'drizzle-orm/mysql2';
import { eq } from 'drizzle-orm';
import { portfolioTransactions } from './drizzle/schema.ts';

const db = drizzle(process.env.DATABASE_URL);

const portfolioId = 90001;

console.log('Fetching transactions for portfolio', portfolioId);
const transactions = await db
  .select()
  .from(portfolioTransactions)
  .where(eq(portfolioTransactions.portfolioId, portfolioId));

console.log(`\nFound ${transactions.length} transactions\n`);

// Method 1: calculateLivePerformance logic
console.log('=== METHOD 1: calculateLivePerformance ===');
let totalInvestedMethod1 = 0;
transactions.forEach(tx => {
  if (tx.transactionType === 'buy') {
    const amount = parseFloat(tx.totalAmountCHF || '0');
    console.log(`BUY ${tx.ticker}: totalAmountCHF = ${amount}`);
    totalInvestedMethod1 += amount;
  }
});
console.log(`Total Invested (Method 1): CHF ${totalInvestedMethod1.toFixed(2)}\n`);

// Method 2: getHoldingsWithChfPerformance logic
console.log('=== METHOD 2: getHoldingsWithChfPerformance ===');
const holdingsByTicker = {};

for (const tx of transactions) {
  const ticker = tx.ticker;
  if (!holdingsByTicker[ticker]) {
    holdingsByTicker[ticker] = {
      shares: 0,
      totalInvestedCHF: 0,
      totalBought: 0,
      avgBuyPriceCHF: 0
    };
  }

  const shares = parseFloat(tx.shares || '0');
  const price = parseFloat(tx.pricePerShare || '0');
  const amountLocal = parseFloat(tx.totalAmount || '0') || (shares * price);
  const amountCHF = parseFloat(tx.totalAmountCHF || '0') || amountLocal;

  if (tx.transactionType === 'buy') {
    console.log(`BUY ${ticker}: ${shares} shares, amountCHF = ${amountCHF}`);
    holdingsByTicker[ticker].shares += shares;
    holdingsByTicker[ticker].totalBought += shares;
    holdingsByTicker[ticker].totalInvestedCHF += amountCHF;
    holdingsByTicker[ticker].avgBuyPriceCHF = 
      holdingsByTicker[ticker].totalInvestedCHF / holdingsByTicker[ticker].totalBought;
    console.log(`  → ${ticker} totalInvestedCHF now: ${holdingsByTicker[ticker].totalInvestedCHF}`);
  } else if (tx.transactionType === 'sell') {
    console.log(`SELL ${ticker}: ${shares} shares`);
    holdingsByTicker[ticker].shares -= shares;
    const costBasisCHF = shares * holdingsByTicker[ticker].avgBuyPriceCHF;
    console.log(`  → Cost basis: ${costBasisCHF}`);
    holdingsByTicker[ticker].totalInvestedCHF -= costBasisCHF;
    console.log(`  → ${ticker} totalInvestedCHF now: ${holdingsByTicker[ticker].totalInvestedCHF}`);
  }
}

let totalInvestedMethod2 = 0;
console.log('\nFinal holdings:');
for (const [ticker, holding] of Object.entries(holdingsByTicker)) {
  if (holding.shares > 0) {
    console.log(`${ticker}: ${holding.shares} shares, totalInvestedCHF = ${holding.totalInvestedCHF.toFixed(2)}`);
    totalInvestedMethod2 += holding.totalInvestedCHF;
  }
}
console.log(`\nTotal Invested (Method 2): CHF ${totalInvestedMethod2.toFixed(2)}`);

console.log('\n=== COMPARISON ===');
console.log(`Method 1 (calculateLivePerformance): CHF ${totalInvestedMethod1.toFixed(2)}`);
console.log(`Method 2 (getHoldingsWithChfPerformance): CHF ${totalInvestedMethod2.toFixed(2)}`);
console.log(`Difference: CHF ${(totalInvestedMethod2 - totalInvestedMethod1).toFixed(2)}`);
console.log(`Expected: CHF 44'174.00`);

process.exit(0);
