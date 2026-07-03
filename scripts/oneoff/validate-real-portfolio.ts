/**
 * Real Portfolio Performance Validation
 * 
 * This script validates the performance calculations using actual portfolio data
 * and compares the results with manual calculations.
 */

import { getDb } from './server/db';
import { portfolioTransactions, savedPortfolios, stocks, historicalPrices } from './drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { getStockCurrency, getFxRate, convertToCHF } from './server/fxHelper';

const db = await getDb();
if (!db) {
  console.log('Database not available');
  process.exit(1);
}

interface HoldingCalculation {
  ticker: string;
  currency: string;
  shares: number;
  totalBought: number;
  avgBuyPrice: number;
  avgBuyPriceCHF: number;
  totalInvestedCHF: number;
  currentPrice: number;
  currentValueCHF: number;
  liveStartPrice: number;
  liveStartValueCHF: number;
  performance: number;
  transactions: any[];
}

async function validatePortfolio(portfolioId: number) {
  console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║              Real Portfolio Performance Validation                         ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');
  
  // Get portfolio
  const [portfolio] = await db.select()
    .from(savedPortfolios)
    .where(eq(savedPortfolios.id, portfolioId))
    .limit(1);
  
  if (!portfolio) {
    console.error(`❌ Portfolio ${portfolioId} not found`);
    return;
  }
  
  if (!portfolio.isLive || !portfolio.liveStartDate) {
    console.error(`❌ Portfolio ${portfolioId} is not live`);
    return;
  }
  
  console.log(`Portfolio: ${portfolio.name} (ID: ${portfolio.id})`);
  console.log(`Live Start Date: ${new Date(portfolio.liveStartDate).toISOString().split('T')[0]}`);
  console.log(`${'='.repeat(80)}\n`);
  
  // Get all transactions
  const transactions = await db.select()
    .from(portfolioTransactions)
    .where(eq(portfolioTransactions.portfolioId, portfolioId))
    .orderBy(portfolioTransactions.transactionDate);
  
  console.log(`Total Transactions: ${transactions.length}\n`);
  
  // Calculate holdings using same logic as server
  const holdingsByTicker: Record<string, HoldingCalculation> = {};
  const liveStartDateStr = new Date(portfolio.liveStartDate).toISOString().split('T')[0];
  const todayStr = new Date().toISOString().split('T')[0];
  
  console.log('Processing Transactions...\n');
  
  for (const tx of transactions) {
    const ticker = tx.ticker;
    if (!ticker) continue;
    
    if (!holdingsByTicker[ticker]) {
      const currency = await getStockCurrency(ticker);
      holdingsByTicker[ticker] = {
        ticker,
        currency,
        shares: 0,
        totalBought: 0,
        avgBuyPrice: 0,
        avgBuyPriceCHF: 0,
        totalInvestedCHF: 0,
        currentPrice: 0,
        currentValueCHF: 0,
        liveStartPrice: 0,
        liveStartValueCHF: 0,
        performance: 0,
        transactions: [],
      };
    }
    
    holdingsByTicker[ticker].transactions.push(tx);
    
    const shares = parseFloat(tx.shares || '0');
    const price = parseFloat(tx.pricePerShare || '0');
    const amountCHF = parseFloat(tx.totalAmountCHF || '0');
    const date = new Date(tx.transactionDate).toISOString().split('T')[0];
    
    if (tx.transactionType === 'buy') {
      holdingsByTicker[ticker].shares += shares;
      holdingsByTicker[ticker].totalBought += shares;
      holdingsByTicker[ticker].totalInvestedCHF += amountCHF;
      holdingsByTicker[ticker].avgBuyPriceCHF = 
        holdingsByTicker[ticker].totalInvestedCHF / holdingsByTicker[ticker].totalBought;
      
      console.log(`${ticker.padEnd(10)} BUY  ${shares.toFixed(0).padStart(4)} @ ${price.toFixed(2).padStart(8)} ${tx.currency} → CHF ${amountCHF.toFixed(2).padStart(10)} (${date})`);
    } else if (tx.transactionType === 'sell') {
      holdingsByTicker[ticker].shares -= shares;
      // Reduce invested using average cost basis
      const costBasisCHF = shares * holdingsByTicker[ticker].avgBuyPriceCHF;
      holdingsByTicker[ticker].totalInvestedCHF -= costBasisCHF;
      
      console.log(`${ticker.padEnd(10)} SELL ${shares.toFixed(0).padStart(4)} @ ${price.toFixed(2).padStart(8)} ${tx.currency} → CHF ${amountCHF.toFixed(2).padStart(10)} (cost basis: CHF ${costBasisCHF.toFixed(2)}) (${date})`);
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('Current Holdings & Performance Calculation');
  console.log('='.repeat(80) + '\n');
  
  let totalCurrentValueCHF = 0;
  let totalLiveStartValueCHF = 0;
  let totalInvestedCHF = 0;
  
  for (const [ticker, holding] of Object.entries(holdingsByTicker)) {
    if (holding.shares <= 0) {
      console.log(`${ticker.padEnd(10)} SOLD (0 shares remaining)\n`);
      continue;
    }
    
    // Get current price
    const [stockData] = await db.select()
      .from(stocks)
      .where(eq(stocks.ticker, ticker))
      .limit(1);
    
    holding.currentPrice = stockData ? parseFloat(stockData.currentPrice || '0') : 0;
    
    // Get live start price
    const [liveStartPriceData] = await db.select()
      .from(historicalPrices)
      .where(
        and(
          eq(historicalPrices.ticker, ticker),
          eq(historicalPrices.date, liveStartDateStr)
        )
      )
      .limit(1);
    
    holding.liveStartPrice = liveStartPriceData 
      ? parseFloat(liveStartPriceData.close || '0')
      : holding.currentPrice;
    
    // Convert to CHF
    const currentValueLocal = holding.shares * holding.currentPrice;
    holding.currentValueCHF = await convertToCHF(currentValueLocal, holding.currency, todayStr);
    
    const liveStartValueLocal = holding.shares * holding.liveStartPrice;
    holding.liveStartValueCHF = await convertToCHF(liveStartValueLocal, holding.currency, liveStartDateStr);
    
    // Calculate performance
    holding.performance = holding.liveStartValueCHF > 0
      ? ((holding.currentValueCHF - holding.liveStartValueCHF) / holding.liveStartValueCHF) * 100
      : 0;
    
    totalCurrentValueCHF += holding.currentValueCHF;
    totalLiveStartValueCHF += holding.liveStartValueCHF;
    totalInvestedCHF += holding.totalInvestedCHF;
    
    console.log(`${ticker.padEnd(10)} (${holding.currency})`);
    console.log(`  Shares: ${holding.shares.toFixed(2)}`);
    console.log(`  Avg Buy Price: CHF ${holding.avgBuyPriceCHF.toFixed(2)} per share`);
    console.log(`  Total Invested: CHF ${holding.totalInvestedCHF.toFixed(2)}`);
    console.log(`  Live Start Price: ${holding.liveStartPrice.toFixed(2)} ${holding.currency}`);
    console.log(`  Current Price: ${holding.currentPrice.toFixed(2)} ${holding.currency}`);
    console.log(`  Live Start Value: CHF ${holding.liveStartValueCHF.toFixed(2)}`);
    console.log(`  Current Value: CHF ${holding.currentValueCHF.toFixed(2)}`);
    console.log(`  Performance: ${holding.performance >= 0 ? '+' : ''}${holding.performance.toFixed(2)}%`);
    
    // Get FX rates for comparison
    const liveStartFxRate = await getFxRate(liveStartDateStr, `${holding.currency}CHF`);
    const currentFxRate = await getFxRate(todayStr, `${holding.currency}CHF`);
    const fxChange = ((currentFxRate - liveStartFxRate) / liveStartFxRate) * 100;
    
    console.log(`  FX Rate (live start): ${liveStartFxRate.toFixed(4)}`);
    console.log(`  FX Rate (current): ${currentFxRate.toFixed(4)} (${fxChange >= 0 ? '+' : ''}${fxChange.toFixed(2)}%)`);
    
    // Break down performance into stock and FX components
    const priceChangeLocal = ((holding.currentPrice - holding.liveStartPrice) / holding.liveStartPrice) * 100;
    console.log(`  Price Change (${holding.currency}): ${priceChangeLocal >= 0 ? '+' : ''}${priceChangeLocal.toFixed(2)}%`);
    console.log(`  Performance Breakdown: Price ${priceChangeLocal.toFixed(2)}% + FX ${fxChange.toFixed(2)}% ≈ ${holding.performance.toFixed(2)}%`);
    
    console.log('');
  }
  
  console.log('='.repeat(80));
  console.log('Portfolio Summary');
  console.log('='.repeat(80) + '\n');
  
  const portfolioPerformance = totalLiveStartValueCHF > 0
    ? ((totalCurrentValueCHF - totalLiveStartValueCHF) / totalLiveStartValueCHF) * 100
    : 0;
  
  console.log(`Total Invested (Cost Basis): CHF ${totalInvestedCHF.toFixed(2)}`);
  console.log(`Live Start Value: CHF ${totalLiveStartValueCHF.toFixed(2)}`);
  console.log(`Current Value: CHF ${totalCurrentValueCHF.toFixed(2)}`);
  console.log(`Portfolio Performance: ${portfolioPerformance >= 0 ? '+' : ''}${portfolioPerformance.toFixed(2)}%`);
  console.log(`Absolute Gain/Loss: CHF ${(totalCurrentValueCHF - totalLiveStartValueCHF).toFixed(2)}`);
  
  console.log('\n' + '='.repeat(80));
  console.log('Validation Complete');
  console.log('='.repeat(80) + '\n');
}

// Get portfolio ID from command line or use default
const portfolioId = process.argv[2] ? parseInt(process.argv[2]) : 240001;

validatePortfolio(portfolioId)
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
