/**
 * Portfolio Test Harness v2
 * Tests 10 different portfolio creation scenarios using the improved algorithm
 * Simulates buildProposal logic directly against the DB
 */
import * as dotenv from 'dotenv';
import mysql from 'mysql2/promise';
dotenv.config();

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) { console.error('DATABASE_URL not set'); process.exit(1); }

// ─── Sector benchmark YTD (same as in autoPortfolioRouter.ts) ───
const SECTOR_BENCHMARKS = {
  'Technology': 12.0, 'Healthcare': -2.0, 'Financials': 8.0,
  'Consumer Discretionary': 5.0, 'Consumer Staples': 3.0,
  'Energy': -5.0, 'Utilities': 4.0, 'Real Estate': -3.0,
  'Materials': 2.0, 'Industrials': 6.0, 'Communication Services': 10.0,
};
const SECTOR_UNDERPERFORM_THRESHOLD = 20;

// ─── Profile optimizer params ───
const PROFILE_PARAMS = {
  conservative: { minDivYield: 2.0, maxPE: 20, maxVolatility: 20, minSignalScore: 40, momentumWeight: 0.3 },
  balanced:     { minDivYield: 1.0, maxPE: 30, maxVolatility: 30, minSignalScore: 35, momentumWeight: 0.5 },
  aggressive:   { minDivYield: 0.0, maxPE: 50, maxVolatility: 50, minSignalScore: 30, momentumWeight: 0.8 },
};

// ─── Goal-specific weights ───
const GOAL_WEIGHTS = {
  dividends: { signalW: 0.3, divW: 0.5, momentumW: 0.2 },
  growth:    { signalW: 0.4, divW: 0.1, momentumW: 0.5 },
  balanced:  { signalW: 0.4, divW: 0.3, momentumW: 0.3 },
};

// ─── 10 test scenarios ───
const SCENARIOS = [
  { id: 1, name: 'Konservativ / Dividenden / CHF 100k',  riskProfile: 'conservative', goal: 'dividends',  investmentAmount: 100000, numPositions: 15 },
  { id: 2, name: 'Ausgewogen / Wachstum / CHF 250k',     riskProfile: 'balanced',     goal: 'growth',     investmentAmount: 250000, numPositions: 20 },
  { id: 3, name: 'Aggressiv / Wachstum / CHF 500k',      riskProfile: 'aggressive',   goal: 'growth',     investmentAmount: 500000, numPositions: 20 },
  { id: 4, name: 'Konservativ / Ausgewogen / CHF 50k',   riskProfile: 'conservative', goal: 'balanced',   investmentAmount:  50000, numPositions: 10 },
  { id: 5, name: 'Ausgewogen / Dividenden / CHF 1M',     riskProfile: 'balanced',     goal: 'dividends',  investmentAmount:1000000, numPositions: 25 },
  { id: 6, name: 'Aggressiv / Ausgewogen / CHF 200k',    riskProfile: 'aggressive',   goal: 'balanced',   investmentAmount: 200000, numPositions: 20 },
  { id: 7, name: 'Konservativ / Dividenden / CHF 750k',  riskProfile: 'conservative', goal: 'dividends',  investmentAmount: 750000, numPositions: 20 },
  { id: 8, name: 'Ausgewogen / Wachstum / CHF 150k',     riskProfile: 'balanced',     goal: 'growth',     investmentAmount: 150000, numPositions: 15 },
  { id: 9, name: 'Aggressiv / Dividenden / CHF 300k',    riskProfile: 'aggressive',   goal: 'dividends',  investmentAmount: 300000, numPositions: 20 },
  { id: 10, name: 'Ausgewogen / Ausgewogen / CHF 80k',   riskProfile: 'balanced',     goal: 'balanced',   investmentAmount:  80000, numPositions: 12 },
];

function scoreStock(stock, riskProfile, goal) {
  const params = PROFILE_PARAMS[riskProfile] || PROFILE_PARAMS.balanced;
  const weights = GOAL_WEIGHTS[goal] || GOAL_WEIGHTS.balanced;
  
  const signalScore = parseFloat(stock.signalScore) || 50;
  const divYield = parseFloat(stock.dividendYield) || 0;
  const ytd = stock.ytdPerformance !== null && stock.ytdPerformance !== undefined
    ? parseFloat(stock.ytdPerformance) : null;
  const pe = parseFloat(stock.peRatio) || null;
  const volatility = parseFloat(stock.volatility) || null;
  
  // Base score from signal
  let score = signalScore * weights.signalW;
  
  // Dividend component
  score += Math.min(divYield * 5, 20) * weights.divW;
  
  // Momentum component
  if (ytd !== null) {
    if (ytd > 20) score += 15 * weights.momentumW;
    else if (ytd > 10) score += 10 * weights.momentumW;
    else if (ytd > 5) score += 7 * weights.momentumW;
    else if (ytd > 0) score += 3 * weights.momentumW;
    else if (ytd > -10) score -= 3 * weights.momentumW;
    else if (ytd > -15) score -= 8 * weights.momentumW;
    else score -= 15 * weights.momentumW;
  } else {
    // NULL YTD penalty
    score -= 5;
  }
  
  // Sector benchmark filter
  const sector = stock.sector;
  if (sector && SECTOR_BENCHMARKS[sector] !== undefined && ytd !== null) {
    const sectorBench = SECTOR_BENCHMARKS[sector];
    const underperformance = sectorBench - ytd;
    if (underperformance > SECTOR_UNDERPERFORM_THRESHOLD) {
      score -= 20; // Heavy penalty for sector underperformers
    }
  }
  
  // Risk profile filters
  if (pe !== null && pe > params.maxPE) score -= 10;
  if (volatility !== null && volatility > params.maxVolatility) score -= 5;
  if (params.minDivYield > 0 && divYield < params.minDivYield && goal === 'dividends') score -= 15;
  
  return score;
}

async function runScenario(db, scenario) {
  const { riskProfile, goal, investmentAmount, numPositions } = scenario;
  const params = PROFILE_PARAMS[riskProfile] || PROFILE_PARAMS.balanced;
  
  // Fetch all active stocks with signal scores
  const [stocks] = await db.execute(`
    SELECT ticker, companyName, sector, industry, currency,
           signalScore, signalType, dividendYield, ytdPerformance,
           peRatio, volatility, beta, marketCap, currentPrice,
           exchangeRateToChf, category
    FROM stocks
    WHERE isActive = 1
      AND signalScore IS NOT NULL
      AND (signalScore >= ?)
    ORDER BY signalScore DESC
    LIMIT 300
  `, [params.minSignalScore]);
  
  if (stocks.length === 0) {
    return { ...scenario, error: 'No stocks found', positions: [] };
  }
  
  // Score and sort
  const scored = stocks.map(s => ({
    ...s,
    computedScore: scoreStock(s, riskProfile, goal),
  })).sort((a, b) => b.computedScore - a.computedScore);
  
  // Pick top N with sector diversification (max 3 per sector)
  const selected = [];
  const sectorCount = {};
  for (const stock of scored) {
    if (selected.length >= numPositions) break;
    const sector = stock.sector || 'Unknown';
    sectorCount[sector] = (sectorCount[sector] || 0) + 1;
    if (sectorCount[sector] <= 3) {
      selected.push(stock);
    }
  }
  
  // Equal weight allocation
  const weight = 100 / selected.length;
  const allocationPerStock = investmentAmount / selected.length;
  
  // Calculate metrics
  const avgDivYield = selected.reduce((sum, s) => sum + (parseFloat(s.dividendYield) || 0), 0) / selected.length;
  const avgSignalScore = selected.reduce((sum, s) => sum + (parseFloat(s.signalScore) || 0), 0) / selected.length;
  const avgYtd = selected.filter(s => s.ytdPerformance !== null).reduce((sum, s) => sum + parseFloat(s.ytdPerformance), 0) / selected.filter(s => s.ytdPerformance !== null).length;
  const nullYtdCount = selected.filter(s => s.ytdPerformance === null).length;
  const sectorDiversity = Object.keys(sectorCount).length;
  
  // Top 5 positions
  const top5 = selected.slice(0, 5).map(s => ({
    ticker: s.ticker,
    name: s.companyName,
    sector: s.sector,
    score: s.computedScore.toFixed(1),
    ytd: s.ytdPerformance !== null ? `${parseFloat(s.ytdPerformance).toFixed(1)}%` : 'N/A',
    divYield: `${parseFloat(s.dividendYield || 0).toFixed(1)}%`,
    allocation: `CHF ${(allocationPerStock).toLocaleString('de-CH', { maximumFractionDigits: 0 })}`,
  }));
  
  return {
    ...scenario,
    totalStocksConsidered: stocks.length,
    selectedCount: selected.length,
    avgDivYield: avgDivYield.toFixed(2),
    avgSignalScore: avgSignalScore.toFixed(1),
    avgYtd: isNaN(avgYtd) ? 'N/A' : `${avgYtd.toFixed(1)}%`,
    nullYtdCount,
    sectorDiversity,
    top5,
    sectorBreakdown: sectorCount,
  };
}

async function main() {
  const conn = await mysql.createConnection(DB_URL);
  
  console.log('=== PORTFOLIO TEST HARNESS v2 ===');
  console.log(`Running ${SCENARIOS.length} scenarios...\n`);
  
  const results = [];
  
  for (const scenario of SCENARIOS) {
    try {
      const result = await runScenario(conn, scenario);
      results.push(result);
      
      console.log(`\n[${result.id}] ${result.name}`);
      console.log(`  Stocks considered: ${result.totalStocksConsidered} → Selected: ${result.selectedCount}`);
      console.log(`  Avg Signal Score: ${result.avgSignalScore} | Avg YTD: ${result.avgYtd} | Avg Div: ${result.avgDivYield}%`);
      console.log(`  NULL YTD: ${result.nullYtdCount}/${result.selectedCount} | Sectors: ${result.sectorDiversity}`);
      console.log(`  Top 5:`);
      result.top5.forEach(p => console.log(`    ${p.ticker.padEnd(12)} ${p.name.padEnd(35)} YTD:${p.ytd.padStart(8)} Div:${p.divYield.padStart(6)} Score:${p.score}`));
    } catch (e) {
      console.error(`  ERROR: ${e.message}`);
      results.push({ ...scenario, error: e.message });
    }
  }
  
  // Summary analysis
  console.log('\n\n=== SUMMARY ANALYSIS ===');
  
  // Check differentiation between scenarios
  const allTop5Tickers = results.map(r => r.top5?.map(p => p.ticker).join(',') || '');
  const uniquePortfolios = new Set(allTop5Tickers).size;
  console.log(`\nPortfolio Differentiation: ${uniquePortfolios}/10 unique top-5 combinations`);
  
  // Check YTD coverage
  const avgNullYtd = results.reduce((sum, r) => sum + (r.nullYtdCount || 0), 0) / results.length;
  const avgSelected = results.reduce((sum, r) => sum + (r.selectedCount || 0), 0) / results.length;
  console.log(`Avg NULL YTD per portfolio: ${avgNullYtd.toFixed(1)}/${avgSelected.toFixed(0)}`);
  
  // Check sector diversity
  const avgSectors = results.reduce((sum, r) => sum + (r.sectorDiversity || 0), 0) / results.length;
  console.log(`Avg Sector Diversity: ${avgSectors.toFixed(1)} sectors per portfolio`);
  
  // Check avg YTD performance
  const ytdValues = results.filter(r => r.avgYtd && r.avgYtd !== 'N/A').map(r => parseFloat(r.avgYtd));
  if (ytdValues.length > 0) {
    const overallAvgYtd = ytdValues.reduce((a, b) => a + b, 0) / ytdValues.length;
    console.log(`Overall Avg Portfolio YTD: ${overallAvgYtd.toFixed(1)}%`);
  }
  
  // Dividend scenario check
  const divScenarios = results.filter(r => r.goal === 'dividends');
  const growthScenarios = results.filter(r => r.goal === 'growth');
  const avgDivYieldDiv = divScenarios.reduce((sum, r) => sum + parseFloat(r.avgDivYield || 0), 0) / divScenarios.length;
  const avgDivYieldGrowth = growthScenarios.reduce((sum, r) => sum + parseFloat(r.avgDivYield || 0), 0) / growthScenarios.length;
  console.log(`\nGoal Differentiation:`);
  console.log(`  Dividends portfolios avg div yield: ${avgDivYieldDiv.toFixed(2)}%`);
  console.log(`  Growth portfolios avg div yield:    ${avgDivYieldGrowth.toFixed(2)}%`);
  
  await conn.end();
  
  // Write results to file
  const fs = await import('fs');
  fs.writeFileSync('/tmp/portfolio-test-v2-results.json', JSON.stringify(results, null, 2));
  console.log('\nFull results written to /tmp/portfolio-test-v2-results.json');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
