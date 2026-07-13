/**
 * Diagnostic: simulate calculatePortfolioValueFromData for KI Portfolio
 * Shows exactly which positions get 0 value and why
 */
import mysql from 'mysql2/promise';
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) { console.error('No DATABASE_URL in environment'); process.exit(1); }

const conn = await mysql.createConnection(dbUrl);
const today = new Date().toISOString().split('T')[0];

// 1. Get KI Portfolio
const [portfolios] = await conn.execute(
  `SELECT id, name, portfolioData, investmentAmount, portfolioType, cashBalance FROM savedPortfolios WHERE name = 'KI Portfolio' LIMIT 1`
);
const portfolio = portfolios[0];
if (!portfolio) { console.error('KI Portfolio not found'); process.exit(1); }

const portfolioData = JSON.parse(portfolio.portfolioData || '{}');
const stocks = portfolioData.stocks || portfolioData.positions || [];
const investmentAmount = parseFloat(portfolio.investmentAmount || '0');
console.log(`\n=== KI Portfolio ===`);
console.log(`Investment: CHF ${investmentAmount.toLocaleString()}`);
console.log(`Portfolio type: ${portfolio.portfolioType}`);
console.log(`Positions: ${stocks.length}\n`);

// 2. Get all FX rates from exchangeRates table
const [fxRows] = await conn.execute(
  `SELECT currencyPair, rate FROM exchangeRates ORDER BY date DESC`
);
const fxMap = {};
for (const row of fxRows) {
  if (!fxMap[row.currencyPair]) {
    fxMap[row.currencyPair] = parseFloat(row.rate);
  }
}
// GBp = GBP / 100
if (fxMap['GBPCHF']) fxMap['GBpCHF'] = fxMap['GBPCHF'] / 100;
console.log('FX rates available:', Object.keys(fxMap).join(', '));
console.log('');

// 3. Simulate calculation
let totalValueCHF = 0;
const results = [];

for (const stock of stocks) {
  const ticker = stock.ticker;
  const weight = parseFloat(stock.weight || '0') / 100;
  
  // Get stock data
  const [stockRows] = await conn.execute(
    `SELECT ticker, currency, currentPrice, exchangeRateToChf FROM stocks WHERE ticker = ? LIMIT 1`,
    [ticker]
  );
  const stockData = stockRows[0];
  
  if (!stockData) {
    results.push({ ticker, weight: (weight*100).toFixed(1)+'%', issue: 'NOT IN DB', valueCHF: 0 });
    continue;
  }
  
  const currentPrice = parseFloat(stockData.currentPrice || '0');
  const currency = stockData.currency || 'CHF';
  const exchangeRateToChf = parseFloat(stockData.exchangeRateToChf || '1');
  
  // Try FX conversion (same logic as tryConvertToCHF)
  let priceCHF = null;
  if (currency === 'CHF') {
    priceCHF = currentPrice;
  } else {
    const fxPair = `${currency}CHF`;
    const fxRate = fxMap[fxPair];
    if (fxRate !== undefined) {
      priceCHF = currentPrice * fxRate;
    } else {
      // No FX rate in exchangeRates table → null → position gets 0
      priceCHF = null;
    }
  }
  
  if (priceCHF === null || priceCHF <= 0) {
    const fxPair = `${currency}CHF`;
    results.push({ 
      ticker, 
      weight: (weight*100).toFixed(1)+'%', 
      currency,
      currentPrice,
      issue: `NO FX RATE for ${fxPair} in exchangeRates table`,
      valueCHF: 0,
      exchangeRateToChf
    });
    continue;
  }
  
  // Weight-based shares (demo portfolio)
  const shares = investmentAmount * weight / priceCHF;
  const valueCHF = shares * priceCHF; // = investmentAmount * weight
  totalValueCHF += valueCHF;
  
  results.push({ 
    ticker, 
    weight: (weight*100).toFixed(1)+'%', 
    currency,
    currentPrice: currentPrice.toFixed(4),
    fxRate: currency === 'CHF' ? 1 : (fxMap[`${currency}CHF`] || 'MISSING'),
    priceCHF: priceCHF.toFixed(4),
    shares: shares.toFixed(2),
    valueCHF: valueCHF.toFixed(0),
    exchangeRateToChf
  });
}

// Cash
const cashBalance = parseFloat(portfolio.cashBalance || '0');
totalValueCHF += cashBalance;

console.log('Position breakdown:');
console.log('─'.repeat(100));
for (const r of results) {
  if (r.issue) {
    console.log(`❌ ${r.ticker.padEnd(12)} ${r.weight.padEnd(6)} ${r.currency || ''} ${r.currentPrice || ''} → ${r.issue}`);
  } else {
    console.log(`✅ ${r.ticker.padEnd(12)} ${r.weight.padEnd(6)} ${r.currency.padEnd(4)} price=${r.currentPrice} fx=${r.fxRate} → CHF ${r.valueCHF}`);
  }
}
console.log('─'.repeat(100));
console.log(`\nTotal calculated: CHF ${totalValueCHF.toLocaleString('de-CH', {minimumFractionDigits: 2})}`);
console.log(`Expected:         CHF ${investmentAmount.toLocaleString('de-CH', {minimumFractionDigits: 2})}`);
console.log(`Difference:       CHF ${(totalValueCHF - investmentAmount).toLocaleString('de-CH', {minimumFractionDigits: 2})}`);

const missing = results.filter(r => r.issue);
if (missing.length > 0) {
  console.log(`\n⚠️  ${missing.length} positions with missing FX rates (valued at 0):`);
  for (const r of missing) console.log(`   ${r.ticker}: ${r.issue}`);
}

await conn.end();
