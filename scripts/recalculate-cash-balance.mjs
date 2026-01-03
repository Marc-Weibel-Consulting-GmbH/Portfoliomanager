#!/usr/bin/env node
/**
 * Migration script to recalculate cashBalance for all existing portfolios
 * 
 * For portfolios WITH transactions (live portfolios):
 *   cashBalance = SUM(deposits) - SUM(buys) + SUM(sells)
 * 
 * For portfolios WITHOUT transactions (test/demo portfolios):
 *   cashBalance = investmentAmount - SUM(current position values)
 */

import { drizzle } from "drizzle-orm/mysql2";
import { eq } from "drizzle-orm";
import { savedPortfolios, portfolioTransactions, stocks } from "../drizzle/schema.ts";
import mysql from "mysql2/promise";

const db = drizzle(process.env.DATABASE_URL);

async function recalculateCashBalance() {
  console.log("[recalculate-cash-balance] Starting migration...");
  
  // Get all portfolios
  const allPortfolios = await db.select().from(savedPortfolios);
  console.log(`[recalculate-cash-balance] Found ${allPortfolios.length} portfolios`);
  
  for (const portfolio of allPortfolios) {
    try {
      console.log(`\n[recalculate-cash-balance] Processing portfolio ${portfolio.id}: ${portfolio.name}`);
      
      // Get all transactions for this portfolio
      const transactions = await db.select()
        .from(portfolioTransactions)
        .where(eq(portfolioTransactions.portfolioId, portfolio.id));
      
      let newCashBalance = 0;
      
      if (transactions.length > 0) {
        // Portfolio HAS transactions (live portfolio)
        console.log(`  - Portfolio has ${transactions.length} transactions (LIVE mode)`);
        
        let deposits = 0;
        let buys = 0;
        let sells = 0;
        
        for (const tx of transactions) {
          const amount = parseFloat(tx.totalAmountCHF || '0');
          if (tx.transactionType === 'deposit') {
            deposits += amount;
          } else if (tx.transactionType === 'buy') {
            buys += amount;
          } else if (tx.transactionType === 'sell') {
            sells += amount;
          }
        }
        
        newCashBalance = deposits - buys + sells;
        console.log(`  - Deposits: CHF ${deposits.toFixed(2)}`);
        console.log(`  - Buys: CHF ${buys.toFixed(2)}`);
        console.log(`  - Sells: CHF ${sells.toFixed(2)}`);
        console.log(`  - Calculated cashBalance: CHF ${newCashBalance.toFixed(2)}`);
        
      } else {
        // Portfolio has NO transactions (test/demo portfolio)
        console.log(`  - Portfolio has NO transactions (TEST/DEMO mode)`);
        
        const investmentAmount = parseFloat(portfolio.investmentAmount || '0');
        console.log(`  - Investment amount: CHF ${investmentAmount.toFixed(2)}`);
        
        // Parse portfolio data to get current position values
        let portfolioData;
        try {
          portfolioData = JSON.parse(portfolio.portfolioData || '{}');
        } catch (e) {
          console.log(`  - WARNING: Could not parse portfolioData, skipping`);
          continue;
        }
        
        const stocksList = portfolioData.stocks || [];
        console.log(`  - Portfolio has ${stocksList.length} positions`);
        
        // Calculate total invested amount based on current prices
        let totalInvested = 0;
        
        for (const stock of stocksList) {
          const ticker = stock.ticker;
          const weight = parseFloat(stock.weight || '0');
          
          // Get current price from stocks table
          const stockData = await db.select()
            .from(stocks)
            .where(eq(stocks.ticker, ticker))
            .limit(1);
          
          if (stockData.length === 0) {
            console.log(`  - WARNING: Stock ${ticker} not found in database`);
            continue;
          }
          
          const currentPrice = parseFloat(stockData[0].currentPrice || '0');
          const currency = stockData[0].currency || 'CHF';
          const fxRate = parseFloat(stockData[0].exchangeRateToChf || '1');
          
          // Calculate position value in CHF
          const positionValueCHF = (investmentAmount * weight / 100);
          totalInvested += positionValueCHF;
          
          console.log(`  - ${ticker}: ${weight.toFixed(2)}% = CHF ${positionValueCHF.toFixed(2)}`);
        }
        
        newCashBalance = investmentAmount - totalInvested;
        console.log(`  - Total invested: CHF ${totalInvested.toFixed(2)}`);
        console.log(`  - Calculated cashBalance: CHF ${newCashBalance.toFixed(2)}`);
      }
      
      // Update the portfolio's cashBalance
      const oldCashBalance = parseFloat(portfolio.cashBalance || '0');
      console.log(`  - Old cashBalance: CHF ${oldCashBalance.toFixed(2)}`);
      console.log(`  - New cashBalance: CHF ${newCashBalance.toFixed(2)}`);
      
      if (Math.abs(newCashBalance - oldCashBalance) > 0.01) {
        await db.update(savedPortfolios)
          .set({ cashBalance: newCashBalance.toFixed(2) })
          .where(eq(savedPortfolios.id, portfolio.id));
        console.log(`  ✅ Updated cashBalance`);
      } else {
        console.log(`  ✓ cashBalance already correct`);
      }
      
    } catch (error) {
      console.error(`  ❌ Error processing portfolio ${portfolio.id}:`, error);
    }
  }
  
  console.log("\n[recalculate-cash-balance] Migration completed!");
}

// Run the migration
recalculateCashBalance()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[recalculate-cash-balance] Migration failed:", error);
    process.exit(1);
  });
