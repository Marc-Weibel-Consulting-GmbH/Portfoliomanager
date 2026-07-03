import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';

const db = drizzle(process.env.DATABASE_URL);

// Simulate getHoldingsWithChfPerformance logic
const portfolioId = 240001;

const connection = await mysql.createConnection(process.env.DATABASE_URL);

// Get all transactions for this portfolio
const [transactions] = await connection.execute(`
  SELECT ticker, transactionType, shares, pricePerShare, totalAmount, totalAmountCHF, currency, fxRate, transactionDate
  FROM portfolioTransactions
  WHERE portfolioId = ?
  ORDER BY transactionDate ASC, id ASC
`, [portfolioId]);

console.log('\n=== Building Holdings ===');

const holdingsByTicker = {};

for (const tx of transactions) {
  const ticker = tx.ticker;
  const shares = parseFloat(tx.shares || '0');
  const price = parseFloat(tx.pricePerShare || '0');
  
  if (!holdingsByTicker[ticker]) {
    // Get currency from stocks table
    const [stocks] = await connection.execute(`SELECT currency FROM stocks WHERE ticker = ?`, [ticker]);
    const currency = stocks[0]?.currency || 'CHF';
    
    holdingsByTicker[ticker] = {
      shares: 0,
      totalBought: 0,
      totalSold: 0,
      totalInvestedLocal: 0,
      totalInvestedCHF: 0,
      avgBuyPrice: 0,
      currency
    };
  }
  
  const amountLocal = parseFloat(tx.totalAmount || '0') || (shares * price);
  const amountCHF = parseFloat(tx.totalAmountCHF || '0') || amountLocal;
  
  if (ticker === 'NVDA') {
    console.log(`\n[NVDA] Processing transaction:`);
    console.log(`  transactionType: ${tx.transactionType}`);
    console.log(`  shares: ${shares}`);
    console.log(`  totalAmount: "${tx.totalAmount}"`);
    console.log(`  totalAmountCHF: "${tx.totalAmountCHF}"`);
    console.log(`  amountLocal (parsed): ${amountLocal}`);
    console.log(`  amountCHF (parsed): ${amountCHF}`);
    console.log(`  amountCHF === amountLocal? ${amountCHF === amountLocal}`);
  }
  
  if (tx.transactionType === 'buy') {
    holdingsByTicker[ticker].shares += shares;
    holdingsByTicker[ticker].totalBought += shares;
    holdingsByTicker[ticker].totalInvestedLocal += amountLocal;
    holdingsByTicker[ticker].totalInvestedCHF += amountCHF;
  }
}

console.log('\n=== Final Holdings ===');
const nvda = holdingsByTicker['NVDA'];
if (nvda) {
  console.log('\nNVDA holding:');
  console.log(`  shares: ${nvda.shares}`);
  console.log(`  totalInvestedLocal: ${nvda.totalInvestedLocal}`);
  console.log(`  totalInvestedCHF: ${nvda.totalInvestedCHF}`);
  console.log(`  currency: ${nvda.currency}`);
  
  const avgFxRate = nvda.totalInvestedLocal > 0 
    ? nvda.totalInvestedCHF / nvda.totalInvestedLocal
    : 1.0;
  
  console.log(`  avgFxRate: ${avgFxRate}`);
  console.log(`  avgFxRate (4 decimals): ${avgFxRate.toFixed(4)}`);
}

await connection.end();
