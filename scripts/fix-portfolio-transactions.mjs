/**
 * Migration script to fix portfolios that were created without buy transactions
 * This script will:
 * 1. Find live portfolios that have positions but no buy transactions
 * 2. Fetch current stock prices and FX rates
 * 3. Create buy transactions for each position
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  
  console.log('=== Fix Portfolio Transactions Migration ===\n');
  
  // Find live portfolios with positions but missing buy transactions
  const [portfolios] = await connection.execute(`
    SELECT sp.id, sp.name, sp.portfolioData, sp.investmentAmount, sp.cashBalance, sp.createdAt
    FROM savedPortfolios sp
    WHERE sp.isLive = 1
    AND sp.portfolioData IS NOT NULL
    AND sp.portfolioData != ''
  `);
  
  console.log(`Found ${portfolios.length} live portfolios to check\n`);
  
  for (const portfolio of portfolios) {
    console.log(`\n--- Processing: ${portfolio.name} (ID: ${portfolio.id}) ---`);
    
    // Check if portfolio has buy transactions
    const [existingTx] = await connection.execute(
      `SELECT COUNT(*) as count FROM portfolioTransactions WHERE portfolioId = ? AND transactionType = 'buy'`,
      [portfolio.id]
    );
    
    const buyCount = existingTx[0].count;
    console.log(`  Existing buy transactions: ${buyCount}`);
    
    if (buyCount > 0) {
      console.log(`  Skipping - already has buy transactions`);
      continue;
    }
    
    // Parse portfolio data
    let portfolioData;
    try {
      portfolioData = JSON.parse(portfolio.portfolioData);
    } catch (e) {
      console.log(`  Error parsing portfolioData: ${e.message}`);
      continue;
    }
    
    const stocks = portfolioData.stocks || [];
    if (stocks.length === 0) {
      console.log(`  No stocks in portfolio data`);
      continue;
    }
    
    console.log(`  Found ${stocks.length} stocks in portfolio data`);
    
    const investmentAmount = parseFloat(portfolio.investmentAmount || '0');
    const cashPercentage = portfolioData.cashPercentage || 0;
    const investableAmount = investmentAmount * (1 - cashPercentage / 100);
    
    console.log(`  Investment amount: CHF ${investmentAmount}`);
    console.log(`  Cash percentage: ${cashPercentage}%`);
    console.log(`  Investable amount: CHF ${investableAmount}`);
    
    // Fetch stock prices and FX rates from database
    for (const stock of stocks) {
      const ticker = stock.ticker;
      const weight = parseFloat(stock.weight || stock.portfolioWeight || '0') / 100;
      
      if (weight <= 0) {
        console.log(`  Skipping ${ticker} - weight is 0`);
        continue;
      }
      
      // Get stock data from database
      const [stockData] = await connection.execute(
        `SELECT currentPrice, currency, exchangeRateToChf FROM stocks WHERE ticker = ?`,
        [ticker]
      );
      
      if (stockData.length === 0) {
        console.log(`  Warning: Stock ${ticker} not found in database`);
        continue;
      }
      
      const currentPrice = parseFloat(stockData[0].currentPrice || '0');
      const currency = stockData[0].currency || 'CHF';
      const fxRate = parseFloat(stockData[0].exchangeRateToChf || '1.0');
      
      if (currentPrice <= 0) {
        console.log(`  Warning: Stock ${ticker} has no price`);
        continue;
      }
      
      // Calculate allocation
      const allocationAmountCHF = investableAmount * weight;
      const allocationInLocalCurrency = allocationAmountCHF / fxRate;
      const shares = allocationInLocalCurrency / currentPrice;
      const actualInvestedInCurrency = shares * currentPrice;
      const actualInvestedCHF = actualInvestedInCurrency * fxRate;
      
      console.log(`  Creating buy for ${ticker}: ${shares.toFixed(2)} shares @ ${currency} ${currentPrice} (CHF ${actualInvestedCHF.toFixed(2)})`);
      
      // Insert buy transaction
      await connection.execute(
        `INSERT INTO portfolioTransactions 
         (portfolioId, transactionType, ticker, shares, pricePerShare, currency, totalAmount, fxRate, totalAmountCHF, fees, notes, transactionDate, createdAt)
         VALUES (?, 'buy', ?, ?, ?, ?, ?, ?, ?, '0', 'Initial purchase (migration)', ?, NOW())`,
        [
          portfolio.id,
          ticker,
          shares.toFixed(6),
          currentPrice.toFixed(2),
          currency,
          actualInvestedInCurrency.toFixed(2),
          fxRate.toFixed(4),
          actualInvestedCHF.toFixed(2),
          portfolio.createdAt
        ]
      );
    }
    
    console.log(`  Created buy transactions for ${stocks.length} stocks`);
  }
  
  console.log('\n=== Migration Complete ===');
  await connection.end();
}

main().catch(console.error);
