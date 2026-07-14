/**
 * Fix portfolio shares using creation-day FX rates.
 * 
 * For each demo portfolio created in the last 7 days, recalculate shares using
 * the FX rates from the creation date (from exchangeRates table).
 * This ensures that shares × creation-day-price = investmentAmount × weight,
 * so the portfolio shows 0% performance on the creation day.
 */
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Find all demo portfolios created recently
const [portfolios] = await conn.execute(`
  SELECT id, name, investmentAmount, portfolioData, createdAt
  FROM savedPortfolios
  WHERE portfolioType = 'demo'
    AND createdAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)
  ORDER BY createdAt DESC
`);

console.log(`Found ${portfolios.length} demo portfolios to check\n`);

for (const portfolio of portfolios) {
  const createdAt = new Date(portfolio.createdAt);
  const creationDate = createdAt.toISOString().split('T')[0];
  console.log(`\n--- Portfolio: "${portfolio.name}" (ID: ${portfolio.id}) ---`);
  console.log(`  Created: ${creationDate}`);
  console.log(`  Investment: CHF ${portfolio.investmentAmount}`);

  let portfolioData;
  try {
    portfolioData = JSON.parse(portfolio.portfolioData);
  } catch (e) {
    console.log(`  ERROR: Could not parse portfolioData`);
    continue;
  }

  const stocks = portfolioData.stocks || [];
  if (stocks.length === 0) { console.log('  No stocks, skipping'); continue; }

  const investmentAmount = parseFloat(portfolio.investmentAmount);

  // Get FX rates for the creation date (or nearest available)
  const [fxRows] = await conn.execute(`
    SELECT currencyPair, rate FROM exchangeRates 
    WHERE date <= ? 
    ORDER BY date DESC
    LIMIT 50
  `, [creationDate]);

  // Build FX map from creation-day rates
  const fxMap = { CHF: 1 };
  const seen = new Set();
  for (const r of fxRows) {
    const currency = r.currencyPair.replace('CHF', '');
    if (!seen.has(currency)) {
      seen.add(currency);
      fxMap[currency] = parseFloat(r.rate);
    }
  }
  if (fxMap['GBP']) fxMap['GBp'] = fxMap['GBP'] / 100;

  console.log(`  FX rates for ${creationDate}: USD=${fxMap['USD']?.toFixed(4)}, EUR=${fxMap['EUR']?.toFixed(4)}, GBp=${fxMap['GBp']?.toFixed(6)}, CAD=${fxMap['CAD']?.toFixed(4)}`);

  // Get current prices from stocks table
  const tickers = stocks.map(s => s.ticker);
  const placeholders = tickers.map(() => '?').join(',');
  const [stockRows] = await conn.execute(
    `SELECT ticker, currentPrice, currency FROM stocks WHERE ticker IN (${placeholders})`,
    tickers
  );
  const stockMap = {};
  stockRows.forEach(s => { stockMap[s.ticker] = s; });

  let needsFix = false;
  const updatedStocks = [];
  let totalValue = 0;

  for (const stock of stocks) {
    const dbStock = stockMap[stock.ticker];
    if (!dbStock) {
      console.log(`  WARNING: ${stock.ticker} not found in stocks table`);
      updatedStocks.push(stock);
      continue;
    }

    const currency = dbStock.currency || 'CHF';
    const localPrice = parseFloat(dbStock.currentPrice);
    const fxRate = fxMap[currency] ?? 1;
    const priceCHF = localPrice * fxRate;
    const weight = parseFloat(stock.weight) / 100;
    const allocationCHF = investmentAmount * weight;

    // Correct shares: allocationCHF / priceCHF (using creation-day FX rate)
    const correctShares = priceCHF > 0 ? allocationCHF / priceCHF : 0;
    const storedShares = parseFloat(stock.shares);

    const discrepancyPct = storedShares > 0
      ? Math.abs(correctShares - storedShares) / correctShares * 100
      : 100;

    const correctValue = correctShares * priceCHF;
    totalValue += correctValue;

    if (discrepancyPct > 2) {
      needsFix = true;
      console.log(`  FIX: ${stock.ticker} (${currency}) fxRate=${fxRate.toFixed(6)}, priceCHF=${priceCHF.toFixed(2)}`);
      console.log(`    stored=${storedShares.toFixed(4)} → correct=${correctShares.toFixed(4)} (${discrepancyPct.toFixed(1)}% off)`);
      console.log(`    value: CHF ${(storedShares * priceCHF).toFixed(0)} → CHF ${correctValue.toFixed(0)}`);

      updatedStocks.push({
        ...stock,
        shares: correctShares.toFixed(6),
        totalValue: correctValue.toFixed(2),
        currentPrice: priceCHF.toFixed(2),
        avgBuyPrice: priceCHF.toFixed(2),
      });
    } else {
      updatedStocks.push(stock);
    }
  }

  console.log(`  Expected total: CHF ${totalValue.toFixed(2)} (investment: CHF ${investmentAmount})`);
  const perfPct = ((totalValue - investmentAmount) / investmentAmount * 100).toFixed(2);
  console.log(`  Expected performance: ${perfPct}%`);

  if (needsFix) {
    const updatedPortfolioData = { ...portfolioData, stocks: updatedStocks };
    await conn.execute(
      'UPDATE savedPortfolios SET portfolioData = ? WHERE id = ?',
      [JSON.stringify(updatedPortfolioData), portfolio.id]
    );
    console.log(`  ✅ Portfolio ${portfolio.id} updated`);
  } else {
    console.log(`  ✅ No fix needed`);
  }
}

console.log('\n=== Done ===');
await conn.end();
