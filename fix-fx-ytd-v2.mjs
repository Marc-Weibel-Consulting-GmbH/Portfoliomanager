/**
 * Fix script v2:
 * 1. Get latest FX rates from exchangeRates table
 * 2. Update exchangeRateToChf in stocks table
 * 3. Calculate ytdPerformance from historicalPrices for NULL stocks
 */
import { createConnection } from 'mysql2/promise';
import { config } from 'dotenv';
config();

const conn = await createConnection(process.env.DATABASE_URL);

// Step 1: Get latest FX rates
console.log('=== STEP 1: Get latest FX rates ===');
const [fxRows] = await conn.execute(`
  SELECT currencyPair, rate 
  FROM exchangeRates 
  WHERE date = (SELECT MAX(date) FROM exchangeRates)
  ORDER BY currencyPair
`);
console.log('Latest FX rates:', fxRows.map(r => `${r.currencyPair}=${r.rate}`).join(', '));

// Build currency → CHF map
const rateMap = { CHF: 1 };
for (const r of fxRows) {
  const currency = r.currencyPair.replace('CHF', '');
  rateMap[currency] = parseFloat(r.rate);
}
// GBp (pence) = GBP / 100
if (rateMap['GBP']) rateMap['GBp'] = rateMap['GBP'] / 100;
// ILS fallback (not in exchangeRates table)
if (!rateMap['ILS']) rateMap['ILS'] = 0.27;

console.log('Currency → CHF map:', JSON.stringify(rateMap, null, 2));

// Step 2: Update exchangeRateToChf in stocks table
console.log('\n=== STEP 2: Update exchangeRateToChf in stocks ===');
let totalUpdated = 0;

for (const [currency, rate] of Object.entries(rateMap)) {
  if (currency === 'CHF') {
    const [r] = await conn.execute(
      "UPDATE stocks SET exchangeRateToChf = '1' WHERE currency = 'CHF' AND (exchangeRateToChf IS NULL OR exchangeRateToChf != '1')"
    );
    if (r.affectedRows > 0) {
      console.log(`  CHF: set ${r.affectedRows} stocks to 1`);
      totalUpdated += r.affectedRows;
    }
    continue;
  }
  const [r] = await conn.execute(
    "UPDATE stocks SET exchangeRateToChf = ? WHERE currency = ?",
    [rate.toString(), currency]
  );
  if (r.affectedRows > 0) {
    console.log(`  ${currency}: updated ${r.affectedRows} stocks → rate=${rate}`);
    totalUpdated += r.affectedRows;
  }
}
console.log(`Total FX rate updates: ${totalUpdated}`);

// Step 3: Calculate YTD from historicalPrices for NULL stocks
console.log('\n=== STEP 3: Calculate YTD from historicalPrices ===');
const currentYear = new Date().getFullYear();
const ytdStartDate = `${currentYear}-01-01`;

const [nullYtdStocks] = await conn.execute(`
  SELECT s.ticker, s.currentPrice
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
for (const stock of nullYtdStocks) {
  const [startRows] = await conn.execute(
    "SELECT close FROM historicalPrices WHERE ticker = ? AND date >= ? ORDER BY date ASC LIMIT 1",
    [stock.ticker, ytdStartDate]
  );
  if (!startRows.length) continue;
  
  const startPrice = parseFloat(startRows[0].close);
  const currentPrice = parseFloat(stock.currentPrice);
  if (startPrice <= 0 || currentPrice <= 0) continue;
  
  const ytd = ((currentPrice - startPrice) / startPrice) * 100;
  await conn.execute(
    "UPDATE stocks SET ytdPerformance = ?, ytdStartPrice = ? WHERE ticker = ?",
    [ytd.toFixed(2), startPrice, stock.ticker]
  );
  ytdUpdated++;
  console.log(`  ${stock.ticker}: ${startPrice} → ${currentPrice} = YTD ${ytd.toFixed(1)}%`);
}
console.log(`YTD updated: ${ytdUpdated}`);

// Step 4: Verify KI Portfolio
console.log('\n=== STEP 4: KI Portfolio verification ===');
const kiTickers = ['VZ','ADEN.SW','IBS.LS','T','DGE.L','UQA.VI','KAP.IL','AUTN.SW','SREN.SW','ORCL','LISN.SW','BKW.SW','CMBN.SW','BATS.L','EN.PA','IG.MI','BION.SW','WHA.AS','EQUI.MI','BTI'];
const ph = kiTickers.map(() => '?').join(',');
const [kiData] = await conn.execute(
  `SELECT ticker, currentPrice, ytdPerformance, exchangeRateToChf, currency FROM stocks WHERE ticker IN (${ph})`,
  kiTickers
);

const [pData] = await conn.execute(
  "SELECT portfolioData, investmentAmount FROM savedPortfolios WHERE name LIKE '%KI Portfolio%' LIMIT 1"
);
const pStocks = JSON.parse(pData[0].portfolioData).stocks;
const investAmt = parseFloat(pData[0].investmentAmount);
const kiMap = {};
kiData.forEach(s => { kiMap[s.ticker] = s; });

let totalWB = 0;
let nullYtdCount = 0;
console.log('Ticker       | YTD      | FX       | priceCHF | weight%');
pStocks.forEach(s => {
  const db = kiMap[s.ticker];
  if (!db) { console.log(`${s.ticker.padEnd(12)} | MISSING`); return; }
  const fx = parseFloat(db.exchangeRateToChf) || 1;
  const priceCHF = parseFloat(db.currentPrice) * fx;
  const weight = parseFloat(s.weight) / 100;
  const alloc = investAmt * weight;
  const buyPriceCHF = parseFloat(s.avgBuyPrice || s.currentPrice || db.currentPrice) * fx;
  const sharesWB = buyPriceCHF > 0 ? alloc / buyPriceCHF : 0;
  totalWB += sharesWB * priceCHF;
  const ytd = db.ytdPerformance !== null ? `${parseFloat(db.ytdPerformance).toFixed(1)}%` : 'NULL';
  if (db.ytdPerformance === null) nullYtdCount++;
  console.log(`${s.ticker.padEnd(12)} | ${ytd.padEnd(8)} | ${String(fx).padEnd(8)} | ${priceCHF.toFixed(2).padEnd(8)} | ${s.weight}%`);
});

console.log(`\nInvestment:     CHF ${investAmt.toLocaleString('de-CH')}`);
console.log(`Weight-based:   CHF ${totalWB.toFixed(2)}`);
console.log(`Performance:    ${((totalWB - investAmt) / investAmt * 100).toFixed(2)}%`);
console.log(`NULL YTD left:  ${nullYtdCount}/20`);

await conn.end();
console.log('\nDone!');
