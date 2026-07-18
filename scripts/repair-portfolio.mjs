/**
 * Repair script for KI-Portfolio (id=2250001)
 * Problem: all stock weights are 0 because priceCHF was 0 at creation time (NaN bug)
 * Fix: recalculate weights using current prices, set cashBalance = investmentAmount * 10%
 */
import mysql from 'mysql2/promise';

const PORTFOLIO_ID = 2250001;
const INVESTMENT_AMOUNT = 250000;
const CASH_PCT = 10; // 10% cash reserve from investor profile

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  // 1) Get the portfolio
  const [portfolios] = await conn.execute(
    'SELECT id, name, investmentAmount, cashBalance, portfolioData FROM savedPortfolios WHERE id = ?',
    [PORTFOLIO_ID]
  );
  if (!portfolios.length) { console.error('Portfolio not found'); return; }
  const portfolio = portfolios[0];
  const pd = JSON.parse(portfolio.portfolioData);
  const stocks = pd.stocks || [];
  
  console.log(`Portfolio: ${portfolio.name}, investmentAmount: ${portfolio.investmentAmount}, cashBalance: ${portfolio.cashBalance}`);
  console.log(`Stocks: ${stocks.length}, first weight: ${stocks[0]?.weight}`);
  
  // 2) Get current prices for all tickers
  const tickers = stocks.map(s => s.ticker);
  const [priceRows] = await conn.execute(
    'SELECT ticker, currentPrice, exchangeRateToChf, currency FROM stocks WHERE ticker IN (' + tickers.map(() => '?').join(',') + ')',
    tickers
  );
  const priceMap = {};
  for (const p of priceRows) {
    const rawPrice = parseFloat(p.currentPrice || '0');
    const fxRate = parseFloat(p.exchangeRateToChf || '1') || 1;
    // exchangeRateToChf = "1 CHF = X foreign currency"
    // To convert foreign to CHF: divide by fxRate
    const priceCHF = p.currency === 'CHF' ? rawPrice : rawPrice / fxRate;
    priceMap[p.ticker] = { rawPrice, fxRate, priceCHF, currency: p.currency };
  }
  
  // 3) Calculate correct weights and shares
  // equityPct = 100% - cashPct = 90%
  const equityPct = (100 - CASH_PCT) / 100;
  const equityAmount = INVESTMENT_AMOUNT * equityPct; // 225'000 CHF
  const cashAmount = INVESTMENT_AMOUNT * (CASH_PCT / 100); // 25'000 CHF
  
  // Equal weight across all positions
  const weightPerPosition = (equityPct * 100) / stocks.length; // 4.5% each
  const allocationPerPosition = INVESTMENT_AMOUNT * (weightPerPosition / 100); // 11'250 CHF each
  
  console.log(`\nEquity: ${equityAmount} CHF (${equityPct*100}%), Cash: ${cashAmount} CHF (${CASH_PCT}%)`);
  console.log(`Weight per position: ${weightPerPosition.toFixed(2)}%, Allocation: ${allocationPerPosition.toFixed(2)} CHF`);
  
  // 4) Update each stock in portfolioData
  const updatedStocks = stocks.map(s => {
    const priceData = priceMap[s.ticker];
    if (!priceData || priceData.priceCHF <= 0) {
      console.warn(`No price for ${s.ticker}, keeping weight=0`);
      return s;
    }
    
    const shares = (allocationPerPosition / priceData.priceCHF).toFixed(6);
    const totalValue = (parseFloat(shares) * priceData.priceCHF).toFixed(2);
    
    console.log(`${s.ticker}: priceCHF=${priceData.priceCHF.toFixed(2)}, shares=${shares}, value=${totalValue}`);
    
    return {
      ...s,
      weight: weightPerPosition.toFixed(2),
      shares: shares,
      currentPrice: priceData.rawPrice.toFixed(2),
      avgBuyPrice: priceData.priceCHF.toFixed(4), // CHF price as avgBuyPrice
      totalValue: totalValue,
      currency: priceData.currency,
    };
  });
  
  // 5) Update portfolioData and cashBalance in DB
  const updatedPd = { ...pd, stocks: updatedStocks, cashPercentage: CASH_PCT };
  
  await conn.execute(
    'UPDATE savedPortfolios SET portfolioData = ?, cashBalance = ? WHERE id = ?',
    [JSON.stringify(updatedPd), cashAmount.toFixed(2), PORTFOLIO_ID]
  );
  
  console.log(`\n✅ Portfolio repaired:`);
  console.log(`  - ${updatedStocks.length} positions with weight=${weightPerPosition.toFixed(2)}% each`);
  console.log(`  - cashBalance set to ${cashAmount} CHF (${CASH_PCT}%)`);
  console.log(`  - Total equity: ${equityAmount} CHF + Cash: ${cashAmount} CHF = ${INVESTMENT_AMOUNT} CHF`);
  
  await conn.end();
}

main().catch(console.error);
