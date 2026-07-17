/**
 * Fix script: 
 * 1. Update exchangeRateToChf for all stocks based on their currency
 * 2. Calculate ytdPerformance from historicalPrices for all stocks with NULL ytd
 */
import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Step 1: Get current FX rates from fxRates table
console.log('=== STEP 1: Get FX Rates ===');
const [fxRows] = await conn.execute(
  "SELECT pair, rate FROM fxRates ORDER BY updatedAt DESC"
);
console.log('FX Rates:', fxRows.map(r => `${r.pair}=${r.rate}`).join(', '));

// Build FX map: currency → CHF rate
const fxMap = {};
fxRows.forEach(r => {
  // pair format: USDCHF, EURCHF, GBPCHF, etc.
  if (r.pair && r.pair.endsWith('CHF')) {
    const currency = r.pair.replace('CHF', '');
    fxMap[currency] = parseFloat(r.rate);
  }
});

// Special: GBp (pence) = GBP / 100
if (fxMap['GBP']) {
  fxMap['GBp'] = fxMap['GBP'] / 100;
}
// ILS (Israeli Shekel)
if (!fxMap['ILS']) {
  // Approximate: 1 ILS ≈ 0.27 CHF
  fxMap['ILS'] = 0.27;
}
// EUR
if (!fxMap['EUR']) fxMap['EUR'] = 0.92;
// USD
if (!fxMap['USD']) fxMap['USD'] = 0.81;

console.log('FX Map:', JSON.stringify(fxMap, null, 2));

// Step 2: Update exchangeRateToChf for all stocks
console.log('\n=== STEP 2: Update exchangeRateToChf ===');
const [allStocks] = await conn.execute(
  "SELECT ticker, currency, exchangeRateToChf FROM stocks WHERE isActive = 1"
);

let fxUpdated = 0;
let fxSkipped = 0;

for (const stock of allStocks) {
  const currency = stock.currency;
  if (!currency) { fxSkipped++; continue; }
  
  // CHF stocks always have rate 1
  if (currency === 'CHF') {
    if (parseFloat(stock.exchangeRateToChf) !== 1) {
      await conn.execute(
        "UPDATE stocks SET exchangeRateToChf = 1 WHERE ticker = ?",
        [stock.ticker]
      );
      fxUpdated++;
    }
    continue;
  }
  
  const rate = fxMap[currency];
  if (rate === undefined) {
    console.log(`  No FX rate for ${stock.ticker} (${currency})`);
    fxSkipped++;
    continue;
  }
  
  const currentRate = parseFloat(stock.exchangeRateToChf);
  if (Math.abs(currentRate - rate) > 0.0001) {
    await conn.execute(
      "UPDATE stocks SET exchangeRateToChf = ? WHERE ticker = ?",
      [rate, stock.ticker]
    );
    fxUpdated++;
    if (fxUpdated <= 10) {
      console.log(`  Updated ${stock.ticker} (${currency}): ${currentRate} → ${rate}`);
    }
  }
}
console.log(`FX rates updated: ${fxUpdated}, skipped: ${fxSkipped}`);

// Step 3: Calculate YTD from historicalPrices for stocks with NULL ytdPerformance
console.log('\n=== STEP 3: Calculate YTD from historicalPrices ===');

const currentYear = new Date().getFullYear();
const ytdStartDate = `${currentYear}-01-01`;
const today = new Date().toISOString().split('T')[0];

// Get all stocks with NULL ytdPerformance that have historical prices
const [nullYtdStocks] = await conn.execute(`
  SELECT DISTINCT s.ticker, s.currentPrice
  FROM stocks s
  WHERE s.ytdPerformance IS NULL
    AND s.isActive = 1
    AND EXISTS (
      SELECT 1 FROM historicalPrices hp 
      WHERE hp.ticker = s.ticker 
        AND hp.date >= ?
    )
`, [ytdStartDate]);

console.log(`Stocks with NULL YTD but have history: ${nullYtdStocks.length}`);

let ytdUpdated = 0;
let ytdFailed = 0;

for (const stock of nullYtdStocks) {
  // Get first price of the year
  const [startPriceRows] = await conn.execute(`
    SELECT close FROM historicalPrices 
    WHERE ticker = ? AND date >= ? 
    ORDER BY date ASC LIMIT 1
  `, [stock.ticker, ytdStartDate]);
  
  if (startPriceRows.length === 0) { ytdFailed++; continue; }
  
  const startPrice = parseFloat(startPriceRows[0].close);
  const currentPrice = parseFloat(stock.currentPrice);
  
  if (startPrice <= 0 || currentPrice <= 0) { ytdFailed++; continue; }
  
  const ytd = ((currentPrice - startPrice) / startPrice) * 100;
  
  await conn.execute(
    "UPDATE stocks SET ytdPerformance = ?, ytdStartPrice = ? WHERE ticker = ?",
    [ytd.toFixed(2), startPrice, stock.ticker]
  );
  ytdUpdated++;
  console.log(`  ${stock.ticker}: startPrice=${startPrice} currentPrice=${currentPrice} YTD=${ytd.toFixed(2)}%`);
}

console.log(`\nYTD updated: ${ytdUpdated}, failed: ${ytdFailed}`);

// Step 4: Verify KI Portfolio tickers
console.log('\n=== STEP 4: Verify KI Portfolio tickers ===');
const kiTickers = ['VZ', 'ADEN.SW', 'IBS.LS', 'T', 'DGE.L', 'UQA.VI', 'KAP.IL', 'AUTN.SW', 'SREN.SW', 'ORCL', 'LISN.SW', 'BKW.SW', 'CMBN.SW', 'BATS.L', 'EN.PA', 'IG.MI', 'BION.SW', 'WHA.AS', 'EQUI.MI', 'BTI'];
const [kiStocks] = await conn.execute(
  `SELECT ticker, currentPrice, ytdPerformance, exchangeRateToChf, currency FROM stocks WHERE ticker IN (${kiTickers.map(() => '?').join(',')})`,
  kiTickers
);

console.log('Ticker       | currentPrice | ytdPerf   | fxRate   | currency | priceCHF');
kiStocks.forEach(s => {
  const fx = parseFloat(s.exchangeRateToChf) || 1;
  const priceCHF = parseFloat(s.currentPrice) * fx;
  const ytd = s.ytdPerformance !== null ? `${parseFloat(s.ytdPerformance).toFixed(1)}%` : 'NULL';
  console.log(`${s.ticker.padEnd(12)} | ${String(s.currentPrice).padEnd(12)} | ${ytd.padEnd(9)} | ${String(fx).padEnd(8)} | ${s.currency.padEnd(8)} | ${priceCHF.toFixed(2)}`);
});

// Step 5: Recalculate KI Portfolio total value with correct FX
console.log('\n=== STEP 5: KI Portfolio value with correct FX ===');
const [pData] = await conn.execute(
  "SELECT portfolioData, investmentAmount FROM savedPortfolios WHERE name LIKE '%KI Portfolio%' LIMIT 1"
);
const stocks = JSON.parse(pData[0].portfolioData).stocks;
const investmentAmount = parseFloat(pData[0].investmentAmount);

const kiMap = {};
kiStocks.forEach(s => { kiMap[s.ticker] = s; });

let totalValueWeightBased = 0;
let totalValueSharesBased = 0;

stocks.forEach(s => {
  const db = kiMap[s.ticker];
  if (!db) return;
  const fx = parseFloat(db.exchangeRateToChf) || 1;
  const currentPriceCHF = parseFloat(db.currentPrice) * fx;
  const buyPrice = parseFloat(s.avgBuyPrice || s.currentPrice || db.currentPrice);
  const buyPriceCHF = buyPrice * fx;
  const weight = parseFloat(s.weight) / 100;
  const shares = parseFloat(s.shares) || 0;
  
  // Weight-based (correct for demo)
  const alloc = investmentAmount * weight;
  const sharesWB = buyPriceCHF > 0 ? alloc / buyPriceCHF : 0;
  totalValueWeightBased += sharesWB * currentPriceCHF;
  
  // Shares-based
  totalValueSharesBased += shares * currentPriceCHF;
});

console.log(`Investment Amount:    CHF ${investmentAmount.toLocaleString('de-CH')}`);
console.log(`Weight-based total:  CHF ${totalValueWeightBased.toFixed(2)}`);
console.log(`Shares-based total:  CHF ${totalValueSharesBased.toFixed(2)}`);

await conn.end();
console.log('\nDone!');
