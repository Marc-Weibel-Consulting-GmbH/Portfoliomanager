/**
 * Portfolio Algorithm Test Harness
 * Tests 10 different investment profiles against the buildProposal algorithm
 * and analyzes historical performance from the historicalPrices table.
 */

import mysql from 'mysql2/promise';
import fs from 'fs';

const DB_URL = process.env.DATABASE_URL;

// ─── Sector benchmark YTD (same as in autoPortfolioRouter.ts) ───────────────
const SECTOR_BENCHMARK_YTD = {
  "Technologie": 12.0, "Technology": 12.0, "Informationstechnologie": 12.0,
  "Gesundheit": 4.0, "Healthcare": 4.0, "Gesundheitswesen": 4.0,
  "Finanzen": 8.0, "Financials": 8.0, "Finanzdienstleistungen": 8.0,
  "Finance": 8.0,
  "Industrie": 2.0, "Industrials": 2.0,
  "Konsumgüter": -2.0, "Consumer Staples": -2.0, "Nicht-zyklische Konsumgüter": -2.0,
  "Zyklische Konsumgüter": 0.0, "Consumer Discretionary": 0.0,
  "Energie": -5.0, "Energy": -5.0,
  "Rohstoffe": -3.0, "Materials": -3.0,
  "Immobilien": 3.0, "Real Estate": 3.0,
  "Versorger": 6.0, "Utilities": 6.0,
  "Kommunikation": 5.0, "Communication Services": 5.0, "Telekommunikation": 5.0,
  "Andere": 0.0,
};
const SECTOR_UNDERPERFORM_THRESHOLD = -20;

// ─── 10 Test Scenarios ───────────────────────────────────────────────────────
const SCENARIOS = [
  { id: 1, name: "Konservativ / Dividenden / CHF 100k",   riskProfile: "konservativ", goal: "dividends",  amount: 100000, excludedSectors: [], esgOnly: false, liquidityNeedPct: 10, investmentHorizonYears: 15, maxDrawdownTolerancePct: 10 },
  { id: 2, name: "Konservativ / Ausgewogen / CHF 250k",   riskProfile: "konservativ", goal: "balanced",   amount: 250000, excludedSectors: [], esgOnly: false, liquidityNeedPct: 5,  investmentHorizonYears: 12, maxDrawdownTolerancePct: 15 },
  { id: 3, name: "Ausgewogen / Dividenden / CHF 500k",    riskProfile: "ausgewogen",  goal: "dividends",  amount: 500000, excludedSectors: [], esgOnly: false, liquidityNeedPct: 0,  investmentHorizonYears: 10, maxDrawdownTolerancePct: 20 },
  { id: 4, name: "Ausgewogen / Wachstum / CHF 200k",      riskProfile: "ausgewogen",  goal: "growth",     amount: 200000, excludedSectors: [], esgOnly: false, liquidityNeedPct: 0,  investmentHorizonYears: 8,  maxDrawdownTolerancePct: 25 },
  { id: 5, name: "Wachstum / Wachstum / CHF 1 Mio",       riskProfile: "wachstum",    goal: "growth",     amount: 1000000, excludedSectors: [], esgOnly: false, liquidityNeedPct: 0, investmentHorizonYears: 5,  maxDrawdownTolerancePct: 35 },
  { id: 6, name: "Aggressiv / Wachstum / CHF 150k",       riskProfile: "aggressiv",   goal: "growth",     amount: 150000, excludedSectors: [], esgOnly: false, liquidityNeedPct: 0,  investmentHorizonYears: 3,  maxDrawdownTolerancePct: 50 },
  { id: 7, name: "ESG / Ausgewogen / CHF 300k",            riskProfile: "ausgewogen",  goal: "balanced",   amount: 300000, excludedSectors: [], esgOnly: true,  liquidityNeedPct: 0,  investmentHorizonYears: 10, maxDrawdownTolerancePct: 20 },
  { id: 8, name: "Ohne Energie / Konservativ / CHF 400k", riskProfile: "konservativ", goal: "balanced",   amount: 400000, excludedSectors: ["Energie","Energy"], esgOnly: false, liquidityNeedPct: 5, investmentHorizonYears: 15, maxDrawdownTolerancePct: 12 },
  { id: 9, name: "Hohe Liquidität / Ausgewogen / CHF 750k", riskProfile: "ausgewogen", goal: "balanced",  amount: 750000, excludedSectors: [], esgOnly: false, liquidityNeedPct: 30, investmentHorizonYears: 7,  maxDrawdownTolerancePct: 20 },
  { id: 10, name: "Aggressiv / Dividenden / CHF 50k",     riskProfile: "aggressiv",   goal: "dividends",  amount: 50000, excludedSectors: [], esgOnly: false, liquidityNeedPct: 0,  investmentHorizonYears: 20, maxDrawdownTolerancePct: 40 },
];

// ─── Optimizer params (mirrors profileOptimizerParams.ts) ───────────────────
function optimizerParamsForProfile(riskProfile, maxDrawdownTolerancePct, investmentHorizonYears) {
  const method = riskProfile === "konservativ" ? "min_variance" : "max_sharpe";
  const baseMax = 0.25;
  const minW = 0.01;
  const factor = Math.max(0.6, Math.min(1, 0.6 + maxDrawdownTolerancePct / 50));
  const maxW = Math.max(minW * 2, baseMax * factor);
  let momentumWeight = 0.4, qualityWeight = 0.4;
  if (investmentHorizonYears <= 5) { momentumWeight = 0.5; qualityWeight = 0.3; }
  else if (investmentHorizonYears >= 12) { momentumWeight = 0.3; qualityWeight = 0.5; }
  return { method, minW, maxW, momentumWeight, qualityWeight };
}

// ─── Grade helper ─────────────────────────────────────────────────────────────
const grade = (score) => score >= 80 ? "A" : score >= 65 ? "B" : score >= 50 ? "C" : score >= 35 ? "D" : "F";

// ─── Cap & renormalize ────────────────────────────────────────────────────────
function capAndRenormalize(weights, maxW) {
  let changed = true;
  while (changed) {
    changed = false;
    const total = Object.values(weights).reduce((s, v) => s + v, 0) || 1;
    const normalized = {};
    let cappedSum = 0, uncappedSum = 0;
    for (const [t, v] of Object.entries(weights)) {
      const norm = v / total;
      if (norm > maxW) { normalized[t] = maxW; cappedSum += maxW; changed = true; }
      else { normalized[t] = norm; uncappedSum += norm; }
    }
    if (changed && uncappedSum > 0) {
      const scale = (1 - cappedSum) / uncappedSum;
      for (const t of Object.keys(normalized)) {
        if (normalized[t] < maxW) normalized[t] *= scale;
      }
    }
    Object.assign(weights, normalized);
    if (!changed) break;
  }
  return weights;
}

// ─── Build portfolio proposal ─────────────────────────────────────────────────
function buildProposal(allStocks, scenario) {
  const { riskProfile, goal, excludedSectors, esgOnly, liquidityNeedPct,
          investmentHorizonYears, maxDrawdownTolerancePct } = scenario;

  const params = optimizerParamsForProfile(riskProfile, maxDrawdownTolerancePct, investmentHorizonYears);

  // Filter universe
  let universe = allStocks.filter(s => {
    const price = parseFloat(s.currentPrice ?? "0");
    if (!(price > 0)) return false;
    if (s.sector && excludedSectors.includes(s.sector)) return false;
    if (esgOnly && !s.esgCertified) return false;

    // Sector benchmark filter
    const ytdPerf = parseFloat(s.ytdPerformance ?? "0") || 0;
    const sectorBenchmark = SECTOR_BENCHMARK_YTD[s.sector || "Andere"] ?? 0;
    const relativePerf = ytdPerf - sectorBenchmark;
    if (relativePerf < SECTOR_UNDERPERFORM_THRESHOLD) return false;

    return true;
  });

  // Sort by market cap
  universe.sort((a, b) => parseFloat(b.marketCap ?? "0") - parseFloat(a.marketCap ?? "0"));
  universe = universe.slice(0, 40);

  // Score candidates
  const scored = universe.map(s => {
    const rawScore = s.signalScore ?? 50;
    const signalType = s.signalType ?? "hold";
    const signal = signalType === "buy" ? "BUY" : signalType === "sell" ? "SELL" : "HOLD";
    const ytdPerf = parseFloat(s.ytdPerformance ?? "0") || 0;

    let momentumAdj = 0;
    if (ytdPerf > 20) momentumAdj = 8;
    else if (ytdPerf > 10) momentumAdj = 5;
    else if (ytdPerf > 5) momentumAdj = 2;
    else if (ytdPerf < -20) momentumAdj = -15;
    else if (ytdPerf < -15) momentumAdj = -10;
    else if (ytdPerf < -10) momentumAdj = -5;

    let goalAdj = 0;
    if (goal === "growth" && ytdPerf > 5) goalAdj = 5;
    if (goal === "dividends" && ytdPerf < -5) goalAdj = -3;

    const combinedScore = Math.max(0, Math.min(100, rawScore + momentumAdj + goalAdj));
    return {
      stock: s,
      combinedScore,
      rawScore,
      ytdPerf,
      signal,
      momentumGrade: grade(combinedScore),
      qualityGrade: grade(combinedScore - 5),
      dividendYield: parseFloat(s.dividendYield ?? "0"),
    };
  }).filter(x => x.combinedScore > 0);

  if (scored.length < 2) return { error: "Zu wenige bewertete Titel" };

  // Rank
  const rankKey = (x) => {
    let score = x.combinedScore;
    if (goal === "dividends") score += Math.min(x.dividendYield * 100, 5) * 2;
    if (goal !== "dividends" && x.ytdPerf > 0) score += Math.min(x.ytdPerf * 0.2, 5);
    return score;
  };

  const isBuyable = (x) => x.signal !== "SELL" && x.qualityGrade !== "F" && x.momentumGrade !== "F";
  let ranked = scored.filter(x => isBuyable(x) && x.combinedScore >= 55).sort((a, b) => rankKey(b) - rankKey(a));
  if (ranked.length < 10) ranked = scored.filter(x => x.signal !== "SELL" && x.qualityGrade !== "F" && x.combinedScore >= 45).sort((a, b) => rankKey(b) - rankKey(a));
  if (ranked.length < 10) ranked = scored.filter(x => x.signal !== "SELL").sort((a, b) => rankKey(b) - rankKey(a));

  // Select with sector cap
  const maxTitles = 20;
  const maxPerSector = Math.max(1, Math.floor((40 / 100) * Math.min(maxTitles, ranked.length)));
  const selected = [];
  const sectorCount = {};
  for (const c of ranked) {
    if (selected.length >= maxTitles) break;
    const sec = c.stock.sector || "Andere";
    if ((sectorCount[sec] || 0) >= maxPerSector) continue;
    selected.push(c);
    sectorCount[sec] = (sectorCount[sec] || 0) + 1;
  }

  if (selected.length < 2) return { error: "Zu wenige Kandidaten nach Diversifikationsregeln" };

  // Weight
  const total = selected.reduce((s, c) => s + c.combinedScore, 0) || 1;
  let weights = {};
  selected.forEach(c => { weights[c.stock.ticker] = c.combinedScore / total; });
  weights = capAndRenormalize(weights, params.maxW);

  // Build positions
  const kept = selected.map(c => ({ c, w: weights[c.stock.ticker] ?? 0 })).filter(x => x.w > 0);
  const wSum = kept.reduce((s, x) => s + x.w, 0) || 1;
  let positions = kept.map(({ c, w }) => ({
    ticker: c.stock.ticker,
    companyName: c.stock.companyName,
    sector: c.stock.sector || "Andere",
    currency: c.stock.currency || "CHF",
    currentPrice: parseFloat(c.stock.currentPrice ?? "0"),
    weightPct: parseFloat(((w / wSum) * 100).toFixed(2)),
    combinedScore: c.combinedScore,
    rawScore: c.rawScore,
    ytdPerf: c.ytdPerf,
    signal: c.signal,
    dividendYield: c.dividendYield,
  })).sort((a, b) => b.weightPct - a.weightPct);

  // Apply liquidity
  if (liquidityNeedPct > 0 && liquidityNeedPct < 100) {
    const equityPct = 1 - liquidityNeedPct / 100;
    positions.forEach(p => { p.weightPct = parseFloat((p.weightPct * equityPct).toFixed(2)); });
  }

  return {
    positions,
    method: params.method,
    universeCount: universe.length,
    scoredCount: scored.length,
    selectedCount: positions.length,
    sectorDistribution: sectorCount,
    avgScore: parseFloat((positions.reduce((s, p) => s + p.combinedScore, 0) / positions.length).toFixed(1)),
    avgDivYield: parseFloat((positions.reduce((s, p) => s + p.dividendYield, 0) / positions.length).toFixed(2)),
    avgYtd: parseFloat((positions.reduce((s, p) => s + p.ytdPerf, 0) / positions.length).toFixed(1)),
  };
}

// ─── Historical performance analysis ─────────────────────────────────────────
async function analyzeHistoricalPerformance(conn, tickers) {
  if (!tickers.length) return {};

  // Get prices from 6 months ago and 1 year ago vs today
  const tickerList = tickers.map(t => `'${t.replace(/'/g, "''")}'`).join(',');

  const [rows] = await conn.execute(`
    SELECT hp.ticker, hp.date, hp.close AS closePrice
    FROM historicalPrices hp
    WHERE hp.ticker IN (${tickerList})
      AND hp.date >= DATE_SUB(CURDATE(), INTERVAL 13 MONTH)
    ORDER BY hp.ticker, hp.date
  `);

  const byTicker = {};
  for (const row of rows) {
    if (!byTicker[row.ticker]) byTicker[row.ticker] = [];
    byTicker[row.ticker].push({ date: new Date(row.date), price: parseFloat(row.closePrice) });
  }

  const results = {};
  const now = new Date();
  const ytdStart = new Date(now.getFullYear(), 0, 1);
  const sixMonthsAgo = new Date(now); sixMonthsAgo.setMonth(now.getMonth() - 6);
  const oneYearAgo = new Date(now); oneYearAgo.setFullYear(now.getFullYear() - 1);

  for (const [ticker, prices] of Object.entries(byTicker)) {
    if (!prices.length) continue;
    prices.sort((a, b) => a.date - b.date);
    const latest = prices[prices.length - 1].price;

    const findClosest = (targetDate) => {
      let best = null, bestDiff = Infinity;
      for (const p of prices) {
        const diff = Math.abs(p.date - targetDate);
        if (diff < bestDiff) { bestDiff = diff; best = p; }
      }
      return best;
    };

    const ytdStartPrice = findClosest(ytdStart);
    const sixMonthPrice = findClosest(sixMonthsAgo);
    const oneYearPrice = findClosest(oneYearAgo);

    results[ticker] = {
      latestPrice: latest,
      ytdReturn: ytdStartPrice ? ((latest - ytdStartPrice.price) / ytdStartPrice.price * 100) : null,
      sixMonthReturn: sixMonthPrice ? ((latest - sixMonthPrice.price) / sixMonthPrice.price * 100) : null,
      oneYearReturn: oneYearPrice ? ((latest - oneYearPrice.price) / oneYearPrice.price * 100) : null,
      dataPoints: prices.length,
    };
  }
  return results;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const conn = await mysql.createConnection(DB_URL);

  // Load all stocks
  const [allStocks] = await conn.execute(`
    SELECT ticker, companyName, sector, signalScore, signalType, ytdPerformance,
           dividendYield, currentPrice, currency, marketCap, listType
    FROM stocks
    WHERE currentPrice IS NOT NULL AND currentPrice != '0'
  `);

  console.log(`\n📊 Loaded ${allStocks.length} stocks from DB\n`);

  const results = [];

  for (const scenario of SCENARIOS) {
    console.log(`\n━━━ Scenario ${scenario.id}: ${scenario.name} ━━━`);
    const proposal = buildProposal(allStocks, scenario);

    if (proposal.error) {
      console.log(`  ❌ Error: ${proposal.error}`);
      results.push({ scenario, error: proposal.error });
      continue;
    }

    // Get historical performance for selected tickers
    const tickers = proposal.positions.map(p => p.ticker);
    const histPerf = await analyzeHistoricalPerformance(conn, tickers);

    // Calculate portfolio-level historical returns (weighted)
    let portfolioYtd = 0, portfolio6M = 0, portfolio1Y = 0;
    let coveredWeight = 0;
    for (const pos of proposal.positions) {
      const h = histPerf[pos.ticker];
      if (h?.ytdReturn !== null && h?.ytdReturn !== undefined) {
        const w = pos.weightPct / 100;
        portfolioYtd += h.ytdReturn * w;
        if (h.sixMonthReturn !== null) portfolio6M += h.sixMonthReturn * w;
        if (h.oneYearReturn !== null) portfolio1Y += h.oneYearReturn * w;
        coveredWeight += w;
      }
    }
    // Normalize by covered weight
    if (coveredWeight > 0) {
      portfolioYtd /= coveredWeight;
      portfolio6M /= coveredWeight;
      portfolio1Y /= coveredWeight;
    }

    // S&P 500 YTD benchmark (approximate 2026 YTD)
    const SP500_YTD = 12.0;
    const SPI_YTD = 8.0;

    const result = {
      scenario,
      proposal: {
        positionCount: proposal.positions.length,
        method: proposal.method,
        avgScore: proposal.avgScore,
        avgDivYield: proposal.avgDivYield,
        avgYtd: proposal.avgYtd,
        universeCount: proposal.universeCount,
        scoredCount: proposal.scoredCount,
        sectorDistribution: proposal.sectorDistribution,
      },
      performance: {
        portfolioYtd: parseFloat(portfolioYtd.toFixed(2)),
        portfolio6M: parseFloat(portfolio6M.toFixed(2)),
        portfolio1Y: parseFloat(portfolio1Y.toFixed(2)),
        vsSpYtd: parseFloat((portfolioYtd - SP500_YTD).toFixed(2)),
        vsSpiYtd: parseFloat((portfolioYtd - SPI_YTD).toFixed(2)),
        coveredWeightPct: parseFloat((coveredWeight * 100).toFixed(1)),
      },
      topPositions: proposal.positions.slice(0, 5).map(p => ({
        ticker: p.ticker,
        company: p.companyName,
        weight: p.weightPct,
        score: p.combinedScore,
        ytd: p.ytdPerf,
        divYield: p.dividendYield,
        hist: histPerf[p.ticker] ? {
          ytd: histPerf[p.ticker].ytdReturn?.toFixed(1),
          '6m': histPerf[p.ticker].sixMonthReturn?.toFixed(1),
          '1y': histPerf[p.ticker].oneYearReturn?.toFixed(1),
        } : null,
      })),
    };

    results.push(result);

    console.log(`  ✅ ${proposal.positions.length} Positionen | Methode: ${proposal.method}`);
    console.log(`  📈 Portfolio YTD: ${portfolioYtd.toFixed(1)}% | vs S&P500: ${(portfolioYtd - SP500_YTD).toFixed(1)}pp | vs SPI: ${(portfolioYtd - SPI_YTD).toFixed(1)}pp`);
    console.log(`  📊 Ø Score: ${proposal.avgScore} | Ø Div: ${proposal.avgDivYield}% | Ø YTD: ${proposal.avgYtd}%`);
    console.log(`  🏆 Top 3: ${proposal.positions.slice(0, 3).map(p => `${p.ticker}(${p.weightPct}%,YTD:${p.ytdPerf>0?'+':''}${p.ytdPerf}%)`).join(', ')}`);
  }

  await conn.end();

  // Save results to JSON
  fs.writeFileSync('/home/ubuntu/portfolio_test_results.json', JSON.stringify(results, null, 2));
  console.log('\n\n✅ Results saved to /home/ubuntu/portfolio_test_results.json');

  // Summary table
  console.log('\n\n═══════════════════════════════════════════════════════════════════');
  console.log('ZUSAMMENFASSUNG: 10 Portfolio-Szenarien');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('ID | Szenario                              | Pos | YTD%  | vs S&P | vs SPI | ØScore');
  console.log('───────────────────────────────────────────────────────────────────');
  for (const r of results) {
    if (r.error) {
      console.log(`${String(r.scenario.id).padStart(2)} | ${r.scenario.name.padEnd(38)} | ERR`);
    } else {
      const ytd = r.performance.portfolioYtd.toFixed(1).padStart(5);
      const vsSP = (r.performance.vsSpYtd >= 0 ? '+' : '') + r.performance.vsSpYtd.toFixed(1);
      const vsSPI = (r.performance.vsSpiYtd >= 0 ? '+' : '') + r.performance.vsSpiYtd.toFixed(1);
      console.log(`${String(r.scenario.id).padStart(2)} | ${r.scenario.name.padEnd(38)} | ${String(r.proposal.positionCount).padStart(3)} | ${ytd}% | ${vsSP.padStart(6)} | ${vsSPI.padStart(6)} | ${r.proposal.avgScore}`);
    }
  }

  // Identify best/worst scenarios
  const valid = results.filter(r => !r.error);
  const best = valid.sort((a, b) => b.performance.portfolioYtd - a.performance.portfolioYtd)[0];
  const worst = valid.sort((a, b) => a.performance.portfolioYtd - b.performance.portfolioYtd)[0];
  console.log(`\n🏆 Bestes Szenario:    #${best.scenario.id} ${best.scenario.name} → YTD ${best.performance.portfolioYtd.toFixed(1)}%`);
  console.log(`📉 Schwächstes Szenario: #${worst.scenario.id} ${worst.scenario.name} → YTD ${worst.performance.portfolioYtd.toFixed(1)}%`);

  // Algorithm insights
  console.log('\n\n═══════════════════════════════════════════════════════════════════');
  console.log('ALGORITHMUS-ERKENNTNISSE');
  console.log('═══════════════════════════════════════════════════════════════════');

  // Which stocks appear most often across all portfolios?
  const tickerFreq = {};
  for (const r of valid) {
    for (const pos of r.proposal.topPositions || []) {
      tickerFreq[pos.ticker] = (tickerFreq[pos.ticker] || 0) + 1;
    }
  }
  const topTickers = Object.entries(tickerFreq).sort((a, b) => b[1] - a[1]).slice(0, 10);
  console.log('\nHäufigste Top-5-Positionen über alle Szenarien:');
  topTickers.forEach(([t, c]) => console.log(`  ${t}: ${c}x in Top-5`));

  // Average portfolio YTD by goal
  const byGoal = {};
  for (const r of valid) {
    const g = r.scenario.goal;
    if (!byGoal[g]) byGoal[g] = [];
    byGoal[g].push(r.performance.portfolioYtd);
  }
  console.log('\nDurchschnittliche YTD-Performance nach Anlageziel:');
  for (const [g, ytds] of Object.entries(byGoal)) {
    const avg = ytds.reduce((s, v) => s + v, 0) / ytds.length;
    console.log(`  ${g}: ${avg.toFixed(1)}%`);
  }

  // Average portfolio YTD by risk profile
  const byRisk = {};
  for (const r of valid) {
    const rp = r.scenario.riskProfile;
    if (!byRisk[rp]) byRisk[rp] = [];
    byRisk[rp].push(r.performance.portfolioYtd);
  }
  console.log('\nDurchschnittliche YTD-Performance nach Risikoprofil:');
  for (const [rp, ytds] of Object.entries(byRisk)) {
    const avg = ytds.reduce((s, v) => s + v, 0) / ytds.length;
    console.log(`  ${rp}: ${avg.toFixed(1)}%`);
  }
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
