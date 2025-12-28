#!/usr/bin/env node
/**
 * Backfill realized gains for existing sell transactions
 */

import { drizzle } from "drizzle-orm/mysql2";
import { eq, and } from "drizzle-orm";
import { portfolioTransactions, realizedGains } from "../drizzle/schema.ts";
import { getStockCurrency, getFxRate } from "./fxHelper.ts";

const db = drizzle(process.env.DATABASE_URL);

async function backfillRealizedGains() {
  console.log("=== Backfilling Realized Gains ===\n");
  
  // Get all sell transactions
  const sellTransactions = await db
    .select()
    .from(portfolioTransactions)
    .where(eq(portfolioTransactions.transactionType, 'sell'));
  
  console.log(`Found ${sellTransactions.length} sell transactions\n`);
  
  for (const sellTx of sellTransactions) {
    console.log(`Processing sell transaction ${sellTx.id} (${sellTx.ticker})...`);
    
    // Check if realized gain already exists
    const existing = await db
      .select()
      .from(realizedGains)
      .where(eq(realizedGains.transactionId, sellTx.id));
    
    if (existing.length > 0) {
      console.log(`  ✓ Already has realized gain entry, skipping\n`);
      continue;
    }
    
    // Get all buy transactions for this ticker in this portfolio
    const buyTransactions = await db
      .select()
      .from(portfolioTransactions)
      .where(
        and(
          eq(portfolioTransactions.portfolioId, sellTx.portfolioId),
          eq(portfolioTransactions.ticker, sellTx.ticker),
          eq(portfolioTransactions.transactionType, 'buy')
        )
      );
    
    if (buyTransactions.length === 0) {
      console.log(`  ⚠ No buy transactions found for ${sellTx.ticker}, skipping\n`);
      continue;
    }
    
    // Calculate average cost basis
    let totalShares = 0;
    let totalCost = 0;
    
    for (const buy of buyTransactions) {
      const shares = parseFloat(buy.shares || '0');
      const price = parseFloat(buy.pricePerShare || '0');
      totalShares += shares;
      totalCost += shares * price;
    }
    
    const avgCostBasis = totalShares > 0 ? totalCost / totalShares : 0;
    const sellPrice = parseFloat(sellTx.pricePerShare || '0');
    const sharesSold = parseFloat(sellTx.shares || '0');
    
    // Get stock currency and FX rates
    const currency = await getStockCurrency(sellTx.ticker);
    
    const avgBuyDate = buyTransactions[0].transactionDate;
    const avgBuyDateStr = new Date(avgBuyDate).toISOString().split('T')[0];
    const sellDateStr = new Date(sellTx.transactionDate).toISOString().split('T')[0];
    
    const currencyPair = currency === 'CHF' ? 'CHFCHF' : currency + 'CHF';
    const buyFxRate = await getFxRate(avgBuyDateStr, currencyPair);
    const sellFxRate = await getFxRate(sellDateStr, currencyPair);
    
    // Calculate gains
    const stockGainLocal = (sellPrice - avgCostBasis) * sharesSold;
    const avgCostBasisCHF = avgCostBasis * buyFxRate;
    const sellPriceCHF = sellPrice * sellFxRate;
    const totalGainCHF = (sellPriceCHF - avgCostBasisCHF) * sharesSold;
    const stockGainCHF = stockGainLocal * sellFxRate;
    const fxGain = totalGainCHF - stockGainCHF;
    const realizedGainPercent = avgCostBasis > 0 ? ((sellPrice - avgCostBasis) / avgCostBasis) * 100 : 0;
    
    console.log(`  Stock Gain (${currency}): ${stockGainLocal.toFixed(2)}`);
    console.log(`  FX Gain (CHF): ${fxGain.toFixed(2)}`);
    console.log(`  Total Gain (CHF): ${totalGainCHF.toFixed(2)}`);
    
    // Insert realized gain
    await db.insert(realizedGains).values({
      portfolioId: sellTx.portfolioId,
      transactionId: sellTx.id,
      ticker: sellTx.ticker,
      shares: sellTx.shares,
      avgCostBasis: avgCostBasis.toFixed(2),
      sellPrice: sellPrice.toFixed(2),
      realizedGain: totalGainCHF.toFixed(2),
      realizedGainPercent: realizedGainPercent.toFixed(2),
      transactionDate: sellTx.transactionDate,
      stockGainLocal: stockGainLocal.toFixed(2),
      fxGain: fxGain.toFixed(2),
      currency: currency,
      buyFxRate: buyFxRate.toFixed(4),
      sellFxRate: sellFxRate.toFixed(4),
    });
    
    console.log(`  ✓ Realized gain created\n`);
  }
  
  console.log("=== Backfill Complete ===");
  process.exit(0);
}

backfillRealizedGains().catch(error => {
  console.error("Error:", error);
  process.exit(1);
});
