import { drizzle } from "drizzle-orm/mysql2";
import { portfolioTransactions, savedPortfolios } from "./drizzle/schema.ts";
import { eq, and, desc } from "drizzle-orm";

const db = drizzle(process.env.DATABASE_URL);

// Get the newest portfolio (Test Portfolio CHF 100k)
const latestPortfolio = await db
  .select()
  .from(savedPortfolios)
  .orderBy(desc(savedPortfolios.createdAt))
  .limit(1);

if (latestPortfolio.length === 0) {
  console.log("No portfolios found");
  process.exit(0);
}

const portfolio = latestPortfolio[0];
console.log("\n=== Portfolio Info ===");
console.log(`ID: ${portfolio.id}`);
console.log(`Name: ${portfolio.name}`);
console.log(`Investment Amount: CHF ${portfolio.investmentAmount}`);
console.log(`Created: ${portfolio.createdAt}`);

// Get all transactions for this portfolio
const txs = await db
  .select()
  .from(portfolioTransactions)
  .where(eq(portfolioTransactions.portfolioId, portfolio.id))
  .orderBy(portfolioTransactions.transactionDate);

console.log(`\n=== Transactions (${txs.length}) ===`);

let totalDeposits = 0;
let totalBuys = 0;
let totalSells = 0;

for (const tx of txs) {
  const amount = parseFloat(tx.totalAmountCHF || "0");
  console.log(
    `${tx.transactionType.toUpperCase()}: ${tx.ticker || "CASH"} - CHF ${amount.toFixed(2)}`
  );

  if (tx.transactionType === "deposit") totalDeposits += amount;
  if (tx.transactionType === "buy") totalBuys += amount;
  if (tx.transactionType === "sell") totalSells += amount;
}

console.log("\n=== Summary ===");
console.log(`Total Deposits: CHF ${totalDeposits.toFixed(2)}`);
console.log(`Total Buys: CHF ${totalBuys.toFixed(2)}`);
console.log(`Total Sells: CHF ${totalSells.toFixed(2)}`);
console.log(`Cash Position: CHF ${(totalDeposits - totalBuys + totalSells).toFixed(2)}`);
console.log(
  `Total Value (Stocks + Cash): CHF ${(totalDeposits - totalBuys + totalSells + totalBuys).toFixed(2)}`
);
