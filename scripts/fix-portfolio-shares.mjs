/**
 * Fix script: Recalculate correct shares for portfolios where shares were
 * calculated with fxRate=1 (missing exchangeRateToChf in buildProposal).
 *
 * Root cause: buildProposal did not return exchangeRateToChf, so the frontend
 * used fxRate=1 for all foreign currency stocks. This caused shares to be
 * calculated as: shares = CHF_allocation / localPrice (instead of CHF_allocation / priceCHF).
 *
 * Fix: Recalculate shares using the correct CHF price from the stocks table.
 * shares = (investmentAmount × weight/100) / priceCHF
 * where priceCHF = localPrice × exchangeRateToChf
 */

import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

console.log('=== Portfolio Shares Fix Script ===\n');

// Find all demo portfolios created recently (last 7 days) that might be affected
const [portfolios] = await conn.execute(`
  SELECT id, name, investmentAmount, portfolioData, createdAt
  FROM savedPortfolios
  WHERE portfolioType = 'demo'
    AND createdAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)
  ORDER BY createdAt DESC
`);

console.log(`Found ${portfolios.length} demo portfolios created in the last 7 days\n`);

for (const portfolio of portfolios) {
  console.log(`\n--- Portfolio: "${portfolio.name}" (ID: ${portfolio.id}) ---`);
  console.log(`  Investment: CHF ${portfolio.investmentAmount}`);
  console.log(`  Created: ${portfolio.createdAt}`);

  let portfolioData;
  try {
    portfolioData = JSON.parse(portfolio.portfolioData);
  } catch (e) {
    console.log(`  ERROR: Could not parse portfolioData`);
    continue;
  }

  const stocks = portfolioData.stocks || [];
  if (stocks.length === 0) {
    console.log(`  No stocks found, skipping`);
    continue;
  }

  const investmentAmount = parseFloat(portfolio.investmentAmount);
  let needsFix = false;
  const updatedStocks = [];

  for (const stock of stocks) {
    // Get current price and exchangeRateToChf from stocks table
    const [dbRows] = await conn.execute(
      'SELECT ticker, currentPrice, currency, exchangeRateToChf FROM stocks WHERE ticker = ?',
      [stock.ticker]
    );

    if (dbRows.length === 0) {
      console.log(`  WARNING: ${stock.ticker} not found in stocks table, keeping original shares`);
      updatedStocks.push(stock);
      continue;
    }

    const dbStock = dbRows[0];
    const localPrice = parseFloat(dbStock.currentPrice);
    const fxRate = parseFloat(dbStock.exchangeRateToChf || '1');
    const priceCHF = localPrice * fxRate;
    const weight = parseFloat(stock.weight) / 100;
    const allocationCHF = investmentAmount * weight;

    // Correct shares: allocationCHF / priceCHF
    const correctShares = priceCHF > 0 ? allocationCHF / priceCHF : 0;
    const storedShares = parseFloat(stock.shares);

    // Check if shares are significantly wrong (more than 5% off)
    const discrepancyPct = storedShares > 0
      ? Math.abs(correctShares - storedShares) / correctShares * 100
      : 100;

    const storedValue = storedShares * priceCHF;
    const correctValue = correctShares * priceCHF;

    if (discrepancyPct > 5) {
      needsFix = true;
      console.log(`  FIX NEEDED: ${stock.ticker} (${dbStock.currency})`);
      console.log(`    localPrice=${localPrice.toFixed(2)} ${dbStock.currency}, fxRate=${fxRate.toFixed(6)}, priceCHF=${priceCHF.toFixed(2)}`);
      console.log(`    allocationCHF=${allocationCHF.toFixed(2)}, weight=${(weight*100).toFixed(1)}%`);
      console.log(`    storedShares=${storedShares.toFixed(4)} → correctShares=${correctShares.toFixed(4)} (${discrepancyPct.toFixed(1)}% off)`);
      console.log(`    storedValue=CHF ${storedValue.toFixed(2)} → correctValue=CHF ${correctValue.toFixed(2)}`);

      updatedStocks.push({
        ...stock,
        shares: correctShares.toFixed(6),
        totalValue: correctValue.toFixed(2),
        currentPrice: priceCHF.toFixed(2), // store CHF price
        avgBuyPrice: priceCHF.toFixed(2),
      });
    } else {
      console.log(`  OK: ${stock.ticker} shares=${storedShares.toFixed(4)} (${discrepancyPct.toFixed(1)}% off, within tolerance)`);
      updatedStocks.push(stock);
    }
  }

  if (needsFix) {
    const updatedPortfolioData = { ...portfolioData, stocks: updatedStocks };
    const newTotalValue = updatedStocks.reduce((sum, s) => sum + parseFloat(s.totalValue || '0'), 0);
    console.log(`\n  Updating portfolio... New total value: CHF ${newTotalValue.toFixed(2)}`);

    await conn.execute(
      'UPDATE savedPortfolios SET portfolioData = ? WHERE id = ?',
      [JSON.stringify(updatedPortfolioData), portfolio.id]
    );
    console.log(`  ✅ Portfolio ${portfolio.id} updated successfully`);
  } else {
    console.log(`  ✅ No fix needed for this portfolio`);
  }
}

console.log('\n=== Fix script completed ===');
await conn.end();
