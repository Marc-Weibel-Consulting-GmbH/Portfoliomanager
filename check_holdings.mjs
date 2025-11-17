import { drizzle } from 'drizzle-orm/mysql2';

const db = drizzle(process.env.DATABASE_URL);

// Get CHF holdings from backend procedure
const result = await db.execute(`
  SELECT ticker, totalInvestedCHF 
  FROM (
    SELECT 
      ticker,
      SUM(CASE 
        WHEN transactionType = 'buy' THEN CAST(totalAmountCHF AS DECIMAL(20,4))
        WHEN transactionType = 'sell' THEN -CAST(totalAmountCHF AS DECIMAL(20,4))
        ELSE 0
      END) as totalInvestedCHF
    FROM portfolioTransactions
    WHERE portfolioId = 90001 AND ticker IS NOT NULL
    GROUP BY ticker
    HAVING SUM(CASE 
      WHEN transactionType = 'buy' THEN CAST(shares AS DECIMAL(20,4))
      WHEN transactionType = 'sell' THEN -CAST(shares AS DECIMAL(20,4))
      ELSE 0
    END) > 0
  ) as holdings
`);

console.log('Portfolio Positionen (from getHoldingsWithChfPerformance logic):');
let total = 0;
result[0].forEach(h => {
  const invested = parseFloat(h.totalInvestedCHF || '0');
  total += invested;
  console.log(`${h.ticker}: CHF ${invested.toFixed(2)}`);
});
console.log(`\nTotal: CHF ${total.toFixed(2)}`);
