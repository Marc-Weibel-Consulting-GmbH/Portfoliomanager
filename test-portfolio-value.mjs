import { drizzle } from "drizzle-orm/mysql2";
import { eq } from "drizzle-orm";

const db = drizzle(process.env.DATABASE_URL);

// Get portfolio 990001
const portfolio = await db.execute(`SELECT id, name, cashBalance, portfolioData FROM savedPortfolios WHERE id = 990001`);
console.log("Portfolio:", portfolio[0]);

const portfolioData = JSON.parse(portfolio[0][0].portfolioData || '{}');
console.log("\nStocks in portfolioData:", portfolioData.stocks?.map(s => ({ ticker: s.ticker, shares: s.shares })));
console.log("\nCashBalance from DB:", portfolio[0][0].cashBalance);

// Calculate total value
let totalValue = 0;
for (const stock of portfolioData.stocks || []) {
  if (stock.ticker === 'CASH') {
    console.log(`Found CASH ticker with ${stock.shares} shares`);
  }
  const shares = parseFloat(stock.shares) || 0;
  const price = parseFloat(stock.currentPrice) || 0;
  const value = shares * price;
  totalValue += value;
  console.log(`${stock.ticker}: ${shares} × ${price} = ${value}`);
}

console.log("\nTotal value (without cashBalance):", totalValue);
console.log("CashBalance:", parseFloat(portfolio[0][0].cashBalance || '0'));
console.log("Total value (with cashBalance):", totalValue + parseFloat(portfolio[0][0].cashBalance || '0'));
