import { getDb } from './server/db';
import { portfolioTransactions, savedPortfolios, stocks } from './drizzle/schema';
import { eq, and, isNotNull } from 'drizzle-orm';
import { getStockCurrency, getFxRate, convertToCHF } from './server/fxHelper';

const db = await getDb();
if (!db) {
  console.log('Database not available');
  process.exit(1);
}

// Get all live portfolios
const livePortfolios = await db.select()
  .from(savedPortfolios)
  .where(eq(savedPortfolios.isLive, 1));

console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
console.log('║                Portfolio Transactions Analysis                             ║');
console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');

console.log(`Found ${livePortfolios.length} live portfolio(s)\n`);

for (const portfolio of livePortfolios) {
  console.log(`${'='.repeat(80)}`);
  console.log(`Portfolio: ${portfolio.name} (ID: ${portfolio.id})`);
  console.log(`Live Start Date: ${portfolio.liveStartDate}`);
  console.log(`${'='.repeat(80)}\n`);
  
  // Get all transactions for this portfolio
  const transactions = await db.select()
    .from(portfolioTransactions)
    .where(eq(portfolioTransactions.portfolioId, portfolio.id))
    .orderBy(portfolioTransactions.transactionDate);
  
  console.log(`Total Transactions: ${transactions.length}\n`);
  
  // Group by ticker
  const byTicker: Record<string, any[]> = {};
  transactions.forEach(tx => {
    if (!tx.ticker) return;
    if (!byTicker[tx.ticker]) {
      byTicker[tx.ticker] = [];
    }
    byTicker[tx.ticker].push(tx);
  });
  
  console.log('Transactions by Ticker:\n');
  
  for (const [ticker, txs] of Object.entries(byTicker)) {
    console.log(`\n${ticker}:`);
    
    // Check if ticker exists in stocks table
    const stockData = await db.select()
      .from(stocks)
      .where(eq(stocks.ticker, ticker))
      .limit(1);
    
    const currency = await getStockCurrency(ticker);
    console.log(`  Currency: ${currency} ${stockData.length === 0 ? '(⚠️ TICKER NOT IN STOCKS TABLE)' : '✅'}`);
    
    let totalShares = 0;
    let totalInvestedCHF = 0;
    
    for (const tx of txs) {
      const date = new Date(tx.transactionDate).toISOString().split('T')[0];
      const shares = parseFloat(tx.shares || '0');
      const price = parseFloat(tx.pricePerShare || '0');
      const amountCHF = parseFloat(tx.totalAmountCHF || '0');
      const fxRate = parseFloat(tx.fxRate || '1');
      
      if (tx.transactionType === 'buy') {
        totalShares += shares;
        totalInvestedCHF += amountCHF;
        console.log(`  ${date} BUY  ${shares.toFixed(2)} @ ${price.toFixed(2)} ${tx.currency} (FX: ${fxRate.toFixed(4)}) = CHF ${amountCHF.toFixed(2)}`);
      } else if (tx.transactionType === 'sell') {
        totalShares -= shares;
        totalInvestedCHF -= amountCHF; // Note: This is wrong, should use cost basis
        console.log(`  ${date} SELL ${shares.toFixed(2)} @ ${price.toFixed(2)} ${tx.currency} (FX: ${fxRate.toFixed(4)}) = CHF ${amountCHF.toFixed(2)}`);
      }
    }
    
    console.log(`  → Current Holdings: ${totalShares.toFixed(2)} shares`);
    console.log(`  → Total Invested: CHF ${totalInvestedCHF.toFixed(2)}`);
    
    // Check FX rate consistency
    if (txs.length > 0) {
      const firstTx = txs[0];
      const date = new Date(firstTx.transactionDate).toISOString().split('T')[0];
      const storedFxRate = parseFloat(firstTx.fxRate || '1');
      const dbFxRate = await getFxRate(date, `${currency}CHF`);
      
      if (Math.abs(storedFxRate - dbFxRate) > 0.01) {
        console.log(`  ⚠️ FX RATE MISMATCH: Stored ${storedFxRate.toFixed(4)} vs DB ${dbFxRate.toFixed(4)} on ${date}`);
      }
    }
  }
  
  console.log('\n');
}

console.log(`${'='.repeat(80)}`);
console.log('Analysis Complete');
console.log(`${'='.repeat(80)}\n`);

process.exit(0);
