/**
 * Performance Calculation Validation Script
 * 
 * This script validates performance calculations against known scenarios
 * to ensure FX rates and formulas are applied correctly.
 */

import { getDb } from './server/db';
import { portfolioTransactions, exchangeRates, historicalPrices, stocks } from './drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { getFxRate, getStockCurrency, convertToCHF } from './server/fxHelper';

interface TestScenario {
  name: string;
  ticker: string;
  buyDate: string;
  buyShares: number;
  buyPriceLocal: number;
  sellDate?: string;
  sellShares?: number;
  sellPriceLocal: number;
  expectedBuyFxRate: number;
  expectedSellFxRate: number;
  expectedBuyCostCHF: number;
  expectedSellProceedsCHF: number;
  expectedPerformance: number;
}

const testScenarios: TestScenario[] = [
  {
    name: 'USD Stock - No FX Change',
    ticker: 'AAPL',
    buyDate: '2025-11-10',
    buyShares: 100,
    buyPriceLocal: 150.00, // USD
    sellDate: '2025-11-10',
    sellShares: 100,
    sellPriceLocal: 150.00, // USD (same price)
    expectedBuyFxRate: 0.8041, // From DB
    expectedSellFxRate: 0.8041,
    expectedBuyCostCHF: 100 * 150 * 0.8041, // 12061.50
    expectedSellProceedsCHF: 100 * 150 * 0.8041, // 12061.50
    expectedPerformance: 0.0, // No change
  },
  {
    name: 'USD Stock - Price Up 10%, FX Constant',
    ticker: 'AAPL',
    buyDate: '2025-11-10',
    buyShares: 100,
    buyPriceLocal: 150.00, // USD
    sellDate: '2025-11-10',
    sellShares: 100,
    sellPriceLocal: 165.00, // USD (+10%)
    expectedBuyFxRate: 0.8041,
    expectedSellFxRate: 0.8041,
    expectedBuyCostCHF: 100 * 150 * 0.8041, // 12061.50
    expectedSellProceedsCHF: 100 * 165 * 0.8041, // 13267.65
    expectedPerformance: 10.0, // +10%
  },
  {
    name: 'USD Stock - Price Constant, FX Up',
    ticker: 'AAPL',
    buyDate: '2025-11-10', // FX: 0.8041
    buyShares: 100,
    buyPriceLocal: 150.00, // USD
    sellDate: '2025-11-14', // FX: 0.7937
    sellShares: 100,
    sellPriceLocal: 150.00, // USD (same)
    expectedBuyFxRate: 0.8041,
    expectedSellFxRate: 0.7937,
    expectedBuyCostCHF: 100 * 150 * 0.8041, // 12061.50
    expectedSellProceedsCHF: 100 * 150 * 0.7937, // 11905.50
    expectedPerformance: -1.29, // FX loss: (11905.50 - 12061.50) / 12061.50 * 100
  },
  {
    name: 'EUR Stock - No FX Change',
    ticker: 'SAP',
    buyDate: '2025-11-10',
    buyShares: 50,
    buyPriceLocal: 200.00, // EUR
    sellDate: '2025-11-10',
    sellShares: 50,
    sellPriceLocal: 200.00, // EUR (same)
    expectedBuyFxRate: 0.9297, // From DB
    expectedSellFxRate: 0.9297,
    expectedBuyCostCHF: 50 * 200 * 0.9297, // 9297.00
    expectedSellProceedsCHF: 50 * 200 * 0.9297, // 9297.00
    expectedPerformance: 0.0,
  },
];

async function validateScenario(scenario: TestScenario): Promise<void> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Testing: ${scenario.name}`);
  console.log(`${'='.repeat(80)}`);
  
  const db = await getDb();
  if (!db) {
    console.error('❌ Database not available');
    return;
  }
  
  // Get currency for ticker
  const currency = await getStockCurrency(scenario.ticker);
  console.log(`\nStock: ${scenario.ticker} (${currency})`);
  
  // Get actual FX rates from DB
  const buyFxRate = await getFxRate(scenario.buyDate, `${currency}CHF`);
  const sellFxRate = scenario.sellDate 
    ? await getFxRate(scenario.sellDate, `${currency}CHF`)
    : buyFxRate;
  
  console.log(`\nFX Rates:`);
  console.log(`  Buy Date (${scenario.buyDate}):  ${buyFxRate.toFixed(4)} (expected: ${scenario.expectedBuyFxRate.toFixed(4)})`);
  if (scenario.sellDate) {
    console.log(`  Sell Date (${scenario.sellDate}): ${sellFxRate.toFixed(4)} (expected: ${scenario.expectedSellFxRate.toFixed(4)})`);
  }
  
  // Calculate buy cost in CHF
  const buyCostLocal = scenario.buyShares * scenario.buyPriceLocal;
  const buyCostCHF = await convertToCHF(buyCostLocal, currency, scenario.buyDate);
  
  console.log(`\nBuy Transaction:`);
  console.log(`  Shares: ${scenario.buyShares}`);
  console.log(`  Price: ${scenario.buyPriceLocal} ${currency}`);
  console.log(`  Cost (local): ${buyCostLocal.toFixed(2)} ${currency}`);
  console.log(`  Cost (CHF): ${buyCostCHF.toFixed(2)} (expected: ${scenario.expectedBuyCostCHF.toFixed(2)})`);
  
  const buyCostDiff = Math.abs(buyCostCHF - scenario.expectedBuyCostCHF);
  const buyCostMatch = buyCostDiff < 0.01;
  console.log(`  ${buyCostMatch ? '✅' : '❌'} Buy cost ${buyCostMatch ? 'matches' : 'MISMATCH'} (diff: ${buyCostDiff.toFixed(2)})`);
  
  // Calculate sell proceeds if applicable
  if (scenario.sellDate && scenario.sellShares) {
    const sellProceedsLocal = scenario.sellShares * scenario.sellPriceLocal;
    const sellProceedsCHF = await convertToCHF(sellProceedsLocal, currency, scenario.sellDate);
    
    console.log(`\nSell Transaction:`);
    console.log(`  Shares: ${scenario.sellShares}`);
    console.log(`  Price: ${scenario.sellPriceLocal} ${currency}`);
    console.log(`  Proceeds (local): ${sellProceedsLocal.toFixed(2)} ${currency}`);
    console.log(`  Proceeds (CHF): ${sellProceedsCHF.toFixed(2)} (expected: ${scenario.expectedSellProceedsCHF.toFixed(2)})`);
    
    const sellProceedsDiff = Math.abs(sellProceedsCHF - scenario.expectedSellProceedsCHF);
    const sellProceedsMatch = sellProceedsDiff < 0.01;
    console.log(`  ${sellProceedsMatch ? '✅' : '❌'} Sell proceeds ${sellProceedsMatch ? 'match' : 'MISMATCH'} (diff: ${sellProceedsDiff.toFixed(2)})`);
    
    // Calculate performance
    const actualPerformance = ((sellProceedsCHF - buyCostCHF) / buyCostCHF) * 100;
    
    console.log(`\nPerformance Calculation:`);
    console.log(`  Formula: (Sell - Buy) / Buy * 100`);
    console.log(`  = (${sellProceedsCHF.toFixed(2)} - ${buyCostCHF.toFixed(2)}) / ${buyCostCHF.toFixed(2)} * 100`);
    console.log(`  = ${actualPerformance.toFixed(2)}% (expected: ${scenario.expectedPerformance.toFixed(2)}%)`);
    
    const perfDiff = Math.abs(actualPerformance - scenario.expectedPerformance);
    const perfMatch = perfDiff < 0.1;
    console.log(`  ${perfMatch ? '✅' : '❌'} Performance ${perfMatch ? 'matches' : 'MISMATCH'} (diff: ${perfDiff.toFixed(2)}%)`);
    
    // Break down into stock gain and FX gain
    const stockGainLocal = (scenario.sellPriceLocal - scenario.buyPriceLocal) * scenario.sellShares;
    const stockGainCHF = stockGainLocal * sellFxRate;
    const fxGain = (sellFxRate - buyFxRate) * scenario.buyShares * scenario.buyPriceLocal;
    const totalGainCHF = sellProceedsCHF - buyCostCHF;
    
    console.log(`\nGain Breakdown:`);
    console.log(`  Stock Gain (local): ${stockGainLocal.toFixed(2)} ${currency}`);
    console.log(`  Stock Gain (CHF): ${stockGainCHF.toFixed(2)}`);
    console.log(`  FX Gain (CHF): ${fxGain.toFixed(2)}`);
    console.log(`  Total Gain (CHF): ${totalGainCHF.toFixed(2)}`);
    console.log(`  Verification: ${stockGainCHF.toFixed(2)} + ${fxGain.toFixed(2)} = ${(stockGainCHF + fxGain).toFixed(2)} ${Math.abs((stockGainCHF + fxGain) - totalGainCHF) < 0.01 ? '✅' : '❌'}`);
  }
}

async function main() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║         Performance Calculation Validation Test Suite                     ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');
  
  for (const scenario of testScenarios) {
    await validateScenario(scenario);
  }
  
  console.log(`\n${'='.repeat(80)}`);
  console.log('Validation Complete');
  console.log(`${'='.repeat(80)}\n`);
  
  process.exit(0);
}

main().catch(error => {
  console.error('Error running validation:', error);
  process.exit(1);
});
