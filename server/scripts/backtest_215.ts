/**
 * Backtest #215: Is Trend Still Your Friend? — Mikrostruktur-Filter
 *
 * Hypothese: Mikrostrukturelle Indikatoren (Trend-Persistenz-Score) filtern
 * kurzfristige Trendfolgesignale und verbessern die Momentum-Strategie,
 * indem Perioden mit geringer Trendpersistenz identifiziert und gemieden werden.
 *
 * Baseline: Top-20 Aktien nach Momentum-Score (12M, 6M, 3M gewichtet)
 * Variante A: Momentum + Trend-Persistenz-Filter (Hurst-Exponent Proxy)
 *             — Aktie nur kaufen wenn Trend-Persistenz > 0.55 (trending market)
 * Variante B: Momentum + Volatility-Regime-Filter
 *             — Aktie nur kaufen wenn 20d-Volatilität < 2x Median-Volatilität
 *
 * Trend-Persistenz-Proxy: Verhältnis von |Gesamtrendite| zu Σ|Tagesrenditen|
 * (Hurst-Exponent Approximation — >0.5 = trendend, <0.5 = mean-revertierend)
 *
 * OOS: 2020-01-01 bis 2024-12-31
 * Kosten: 10 bps pro Trade
 * Rebalancing: monatlich
 * Schwelle: ΔSharpe_netto ≥ +0.05 (Issue-spezifisch)
 */
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const REGIMES = [
  { name: 'crisis_2020q1',     start: '2020-01-01', end: '2020-03-31' },
  { name: 'bull_2020_recovery',start: '2020-04-01', end: '2020-12-31' },
  { name: 'bull_2021',         start: '2021-01-01', end: '2021-12-31' },
  { name: 'bear_2022',         start: '2022-01-01', end: '2022-12-31' },
  { name: 'bull_2023',         start: '2023-01-01', end: '2023-12-31' },
  { name: 'bull_2024',         start: '2024-01-01', end: '2024-12-31' },
];

// ─── Statistics ───────────────────────────────────────────────────────────────

function sharpe(rets: number[]): number {
  if (rets.length < 2) return 0;
  const mean = rets.reduce((s, v) => s + v, 0) / rets.length;
  const std = Math.sqrt(rets.map(r => (r - mean) ** 2).reduce((s, v) => s + v, 0) / rets.length);
  return std > 0 ? (mean / std) * Math.sqrt(252) : 0;
}

function maxDrawdown(rets: number[]): number {
  let peak = 1, value = 1, maxDD = 0;
  for (const r of rets) {
    value *= (1 + r);
    if (value > peak) peak = value;
    const dd = (peak - value) / peak;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD;
}

function cagr(rets: number[]): number {
  if (rets.length === 0) return 0;
  const total = rets.reduce((v, r) => v * (1 + r), 1);
  return Math.pow(total, 252 / rets.length) - 1;
}

function sortino(rets: number[]): number {
  const mean = rets.reduce((s, v) => s + v, 0) / rets.length;
  const downside = rets.filter(r => r < 0);
  if (downside.length === 0) return 999;
  const downStd = Math.sqrt(downside.map(r => r ** 2).reduce((s, v) => s + v, 0) / downside.length);
  return downStd > 0 ? (mean / downStd) * Math.sqrt(252) : 0;
}

// ─── Price helpers ────────────────────────────────────────────────────────────

interface PriceRow { date: string; close: number; }

function subtractDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function getReturn(prices: PriceRow[], fromDate: string, toDate: string): number | null {
  const sorted = prices.filter(p => p.date >= fromDate && p.date <= toDate).sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 2) return null;
  const first = sorted[0].close;
  const last = sorted[sorted.length - 1].close;
  if (!first || first === 0) return null;
  return (last - first) / first;
}

/**
 * Trend-Persistenz-Score (Hurst-Exponent Proxy)
 * = |Gesamtrendite| / Σ|Tagesrenditen|
 * Wert nahe 1.0 = starker Trend (alle Bewegungen in eine Richtung)
 * Wert nahe 0.0 = mean-reverting (viele Richtungswechsel)
 */
function trendPersistenceScore(prices: PriceRow[], fromDate: string, toDate: string): number | null {
  const sorted = prices.filter(p => p.date >= fromDate && p.date <= toDate).sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 10) return null;
  const totalReturn = Math.abs((sorted[sorted.length - 1].close - sorted[0].close) / sorted[0].close);
  let sumAbsReturns = 0;
  for (let i = 1; i < sorted.length; i++) {
    sumAbsReturns += Math.abs((sorted[i].close - sorted[i - 1].close) / sorted[i - 1].close);
  }
  if (sumAbsReturns === 0) return null;
  return totalReturn / sumAbsReturns;
}

/**
 * Volatility relative to universe median (for Vol-Regime filter)
 */
function annualizedVol(prices: PriceRow[], fromDate: string, toDate: string): number | null {
  const sorted = prices.filter(p => p.date >= fromDate && p.date <= toDate).sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 10) return null;
  const rets: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    rets.push((sorted[i].close - sorted[i - 1].close) / sorted[i - 1].close);
  }
  const mean = rets.reduce((s, v) => s + v, 0) / rets.length;
  const variance = rets.map(r => (r - mean) ** 2).reduce((s, v) => s + v, 0) / rets.length;
  return Math.sqrt(variance) * Math.sqrt(252);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);

  // Load universe tickers
  const [tickerRows] = await conn.execute<any[]>(
    `SELECT DISTINCT ticker FROM historical_prices
     WHERE date >= '2019-01-01' AND date <= '2024-12-31'
     GROUP BY ticker HAVING COUNT(*) > 200`
  );
  const allTickers: string[] = tickerRows.map((r: any) => r.ticker);

  // Filter to algo-relevant tickers (exclude benchmarks, bonds, ETFs with dots in exchange)
  const tickers = allTickers.filter(t =>
    !['SPY.US', 'QQQ.US', 'CHSPI.SW', 'ACWI.US', 'FEZ.US', 'AGG.US', 'TLT.US'].includes(t) &&
    t.length <= 12
  ).slice(0, 80); // cap at 80 for performance

  console.log(`Universe: ${tickers.length} tickers`);

  // Load all prices at once
  const [allPrices] = await conn.execute<any[]>(
    `SELECT ticker, DATE_FORMAT(date, '%Y-%m-%d') as date, close
     FROM historical_prices
     WHERE ticker IN (${tickers.map(() => '?').join(',')})
       AND date >= '2019-01-01' AND date <= '2024-12-31'
     ORDER BY ticker, date ASC`,
    tickers
  );

  const priceMap = new Map<string, PriceRow[]>();
  for (const row of allPrices) {
    if (!priceMap.has(row.ticker)) priceMap.set(row.ticker, []);
    priceMap.get(row.ticker)!.push({ date: String(row.date).slice(0, 10), close: Number(row.close) });
  }

  // Monthly rebalancing dates
  const rebalDates: string[] = [];
  let d = new Date('2020-01-01');
  const end = new Date('2024-12-01');
  while (d <= end) {
    rebalDates.push(d.toISOString().slice(0, 10));
    d.setMonth(d.getMonth() + 1);
  }

  const baselineMonthlyRets: number[] = [];
  const variantAMonthlyRets: number[] = []; // Trend-Persistenz-Filter
  const variantBMonthlyRets: number[] = []; // Volatility-Regime-Filter

  const TREND_PERSISTENCE_THRESHOLD = 0.55; // >55% = trending
  const COSTS = 0.001; // 10 bps

  for (let i = 0; i < rebalDates.length - 1; i++) {
    const rebalDate = rebalDates[i];
    const nextDate = rebalDates[i + 1];

    const features: {
      ticker: string;
      momentumScore: number;
      trendPersistence: number | null;
      vol20d: number | null;
      fwdRet: number;
    }[] = [];

    for (const ticker of tickers) {
      const prices = priceMap.get(ticker);
      if (!prices || prices.length < 60) continue;

      // Momentum score (12M, 6M, 3M weighted)
      const ret12m = getReturn(prices, subtractDays(rebalDate, 252), rebalDate);
      const ret6m  = getReturn(prices, subtractDays(rebalDate, 126), rebalDate);
      const ret3m  = getReturn(prices, subtractDays(rebalDate, 63),  rebalDate);

      if (ret12m === null || ret6m === null || ret3m === null) continue;

      const momentumScore = ret12m * 0.5 + ret6m * 0.3 + ret3m * 0.2;

      // Trend persistence (60-day window)
      const tp = trendPersistenceScore(prices, subtractDays(rebalDate, 60), rebalDate);

      // 20-day annualized volatility
      const vol = annualizedVol(prices, subtractDays(rebalDate, 20), rebalDate);

      // Forward return (next month)
      const fwdRet = getReturn(prices, rebalDate, nextDate);
      if (fwdRet === null) continue;

      features.push({ ticker, momentumScore, trendPersistence: tp, vol20d: vol, fwdRet });
    }

    if (features.length < 20) continue;

    // Baseline: Top-20 by momentum score
    const sorted = [...features].sort((a, b) => b.momentumScore - a.momentumScore);
    const top20 = sorted.slice(0, 20);
    const baselineRet = top20.reduce((s, f) => s + f.fwdRet, 0) / top20.length - COSTS;
    baselineMonthlyRets.push(baselineRet);

    // Variant A: Only buy if trend persistence > threshold
    const filteredA = features.filter(f =>
      f.trendPersistence !== null && f.trendPersistence >= TREND_PERSISTENCE_THRESHOLD
    ).sort((a, b) => b.momentumScore - a.momentumScore);
    const topA = filteredA.length >= 10 ? filteredA.slice(0, 20) : sorted.slice(0, 20); // fallback to baseline if too few
    const retA = topA.reduce((s, f) => s + f.fwdRet, 0) / topA.length - COSTS;
    variantAMonthlyRets.push(retA);

    // Variant B: Exclude high-volatility stocks (>2x median vol)
    const vols = features.filter(f => f.vol20d !== null).map(f => f.vol20d!).sort((a, b) => a - b);
    const medianVol = vols[Math.floor(vols.length / 2)] ?? 0.3;
    const filteredB = features.filter(f =>
      f.vol20d === null || f.vol20d <= medianVol * 2.0
    ).sort((a, b) => b.momentumScore - a.momentumScore);
    const topB = filteredB.length >= 10 ? filteredB.slice(0, 20) : sorted.slice(0, 20);
    const retB = topB.reduce((s, f) => s + f.fwdRet, 0) / topB.length - COSTS;
    variantBMonthlyRets.push(retB);
  }

  // Convert monthly to approximate daily
  const baselineDailyRets = baselineMonthlyRets.flatMap(r => Array(21).fill(r / 21));
  const variantADailyRets = variantAMonthlyRets.flatMap(r => Array(21).fill(r / 21));
  const variantBDailyRets = variantBMonthlyRets.flatMap(r => Array(21).fill(r / 21));

  console.log('\n=== BACKTEST RESULTS: Issue #215 — Trend-Persistenz-Filter ===\n');
  console.log('OOS Period: 2020-01-01 to 2024-12-31 | Costs: 10bps | Rebalancing: monatlich\n');

  const configs = [
    { name: 'Baseline (Momentum Top-20, keine Filterung)', rets: baselineDailyRets },
    { name: 'Variante A (Trend-Persistenz-Filter ≥ 0.55)', rets: variantADailyRets },
    { name: 'Variante B (Volatility-Regime-Filter ≤ 2x Median)', rets: variantBDailyRets },
  ];

  console.log('| Strategie | Sharpe | Sortino | MaxDD | CAGR |');
  console.log('|---|---|---|---|---|');
  for (const c of configs) {
    const s = sharpe(c.rets).toFixed(3);
    const so = sortino(c.rets).toFixed(3);
    const dd = (maxDrawdown(c.rets) * 100).toFixed(1) + '%';
    const ca = (cagr(c.rets) * 100).toFixed(1) + '%';
    console.log(`| ${c.name} | ${s} | ${so} | ${dd} | ${ca} |`);
  }

  // Regime breakdown
  console.log('\n### Regime-Analyse (Variante A vs. Baseline)\n');
  console.log('| Regime | Baseline Sharpe | Variante A Sharpe | Δ |');
  console.log('|---|---|---|---|');
  const totalMonths = baselineMonthlyRets.length;
  for (const regime of REGIMES) {
    const regIdx = REGIMES.indexOf(regime);
    const start = Math.floor(regIdx * totalMonths / REGIMES.length);
    const end = Math.floor((regIdx + 1) * totalMonths / REGIMES.length);
    const bRets = baselineMonthlyRets.slice(start, end).flatMap(r => Array(21).fill(r / 21));
    const vRets = variantAMonthlyRets.slice(start, end).flatMap(r => Array(21).fill(r / 21));
    if (bRets.length < 5) continue;
    const bs = sharpe(bRets).toFixed(3);
    const vs = sharpe(vRets).toFixed(3);
    const delta = (Number(vs) - Number(bs)).toFixed(3);
    console.log(`| ${regime.name} | ${bs} | ${vs} | ${delta} |`);
  }

  const baselineSharpe = sharpe(baselineDailyRets);
  const bestVariantSharpe = Math.max(sharpe(variantADailyRets), sharpe(variantBDailyRets));
  const deltaSharpe = bestVariantSharpe - baselineSharpe;
  const threshold = 0.05;

  console.log(`\n**ΔSharpe (beste Variante vs. Baseline): ${deltaSharpe.toFixed(3)}**`);
  console.log(`**Schwelle: ΔSharpe_netto ≥ +${threshold}**`);
  console.log(`**Entscheidung: ${deltaSharpe >= threshold ? '✅ ACCEPTED' : '❌ REJECTED'}**`);

  await conn.end();
}

main().catch(console.error);
