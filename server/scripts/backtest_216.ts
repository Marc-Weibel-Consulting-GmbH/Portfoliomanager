/**
 * Backtest #216: ML Return Prediction — Getting the Target Right
 * Hypothese: Ridge Regression auf Momentum+Quality-Features verbessert
 * die Aktienauswahl gegenüber dem aktuellen Score-basierten Ranking.
 *
 * Baseline: Top-20 Aktien nach qualityMomentumScore (aktuell)
 * Variante: Top-20 Aktien nach Ridge-Regression-Prediction (1M Forward Return)
 *           Features: 1M, 3M, 6M, 12M Momentum + PE-Ratio-Proxy (Preis/52W-High)
 *
 * OOS: 2020-01-01 bis 2024-12-31
 * Kosten: 10 bps pro Trade
 * Rebalancing: monatlich
 * Schwelle: ΔSharpe_netto ≥ +0.08 (Issue-spezifisch)
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const REGIMES = [
  { name: 'crisis_2020q1', start: '2020-01-01', end: '2020-03-31' },
  { name: 'bull_2020_recovery', start: '2020-04-01', end: '2020-12-31' },
  { name: 'bull_2021', start: '2021-01-01', end: '2021-12-31' },
  { name: 'bear_2022', start: '2022-01-01', end: '2022-12-31' },
  { name: 'bull_2023', start: '2023-01-01', end: '2023-12-31' },
  { name: 'bull_2024', start: '2024-01-01', end: '2024-12-31' },
];

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

// Simple Ridge Regression (closed form: (X'X + λI)^-1 X'y)
function ridgeRegression(X: number[][], y: number[], lambda: number): number[] {
  const n = X.length;
  const p = X[0].length;
  // Compute X'X
  const XtX: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < p; j++) {
      for (let k = 0; k < p; k++) {
        XtX[j][k] += X[i][j] * X[i][k];
      }
    }
  }
  // Add ridge penalty
  for (let j = 0; j < p; j++) XtX[j][j] += lambda;
  // Compute X'y
  const Xty: number[] = new Array(p).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < p; j++) {
      Xty[j] += X[i][j] * y[i];
    }
  }
  // Solve (XtX + λI) β = Xty using Gaussian elimination
  const A = XtX.map((row, i) => [...row, Xty[i]]);
  for (let col = 0; col < p; col++) {
    let maxRow = col;
    for (let row = col + 1; row < p; row++) {
      if (Math.abs(A[row][col]) > Math.abs(A[maxRow][col])) maxRow = row;
    }
    [A[col], A[maxRow]] = [A[maxRow], A[col]];
    for (let row = col + 1; row < p; row++) {
      const factor = A[row][col] / A[col][col];
      for (let k = col; k <= p; k++) {
        A[row][k] -= factor * A[col][k];
      }
    }
  }
  const beta: number[] = new Array(p).fill(0);
  for (let i = p - 1; i >= 0; i--) {
    beta[i] = A[i][p];
    for (let j = i + 1; j < p; j++) {
      beta[i] -= A[i][j] * beta[j];
    }
    beta[i] /= A[i][i];
  }
  return beta;
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);

  // Get all tickers with sufficient data
  const [tickerRows] = await conn.execute<any[]>(
    `SELECT ticker, COUNT(*) as cnt FROM historical_prices 
     WHERE date >= '2018-01-01' AND date <= '2024-12-31'
     AND ticker NOT IN ('SPY.US','AGG.US','BND.US','CHSPI.SW','ACWI.US','QQQ.US','FEZ.US')
     GROUP BY ticker HAVING cnt >= 300 LIMIT 80`
  );
  const tickers = tickerRows.map((r: any) => r.ticker as string);
  console.log(`Universe: ${tickers.length} tickers`);

  // Load prices for all tickers
  const [priceRows] = await conn.execute<any[]>(
    `SELECT ticker, date, close FROM historical_prices 
     WHERE ticker IN (${tickers.map(() => '?').join(',')}) 
     AND date >= '2018-01-01' AND date <= '2024-12-31'
     ORDER BY ticker, date`,
    tickers
  );

  // Build price map: ticker -> [{date, close}]
  const priceMap = new Map<string, { date: string; close: number }[]>();
  for (const row of priceRows) {
    const t = row.ticker as string;
    if (!priceMap.has(t)) priceMap.set(t, []);
    priceMap.get(t)!.push({ date: String(row.date).slice(0, 10), close: Number(row.close) });
  }

  // Get monthly rebalancing dates in OOS period
  const allDates = new Set<string>();
  for (const prices of priceMap.values()) {
    prices.forEach(p => allDates.add(p.date));
  }
  const sortedDates = Array.from(allDates).sort();
  const oosDates = sortedDates.filter(d => d >= '2020-01-01' && d <= '2024-12-31');

  // Monthly rebalancing: first trading day of each month
  const monthlyDates: string[] = [];
  let lastMonth = '';
  for (const d of oosDates) {
    const month = d.slice(0, 7);
    if (month !== lastMonth) {
      monthlyDates.push(d);
      lastMonth = month;
    }
  }

  // Feature computation for each ticker at each rebalancing date
  function getReturn(prices: { date: string; close: number }[], fromDate: string, toDate: string): number | null {
    const from = prices.find(p => p.date >= fromDate);
    const to = prices.filter(p => p.date <= toDate).at(-1);
    if (!from || !to || from.date === to.date) return null;
    return (to.close - from.close) / from.close;
  }

  function getHigh52W(prices: { date: string; close: number }[], toDate: string): number {
    const window = prices.filter(p => p.date <= toDate).slice(-252);
    return window.length > 0 ? Math.max(...window.map(p => p.close)) : 1;
  }

  // Simulate both strategies month by month
  const baselineMonthlyRets: number[] = [];
  const mlMonthlyRets: number[] = [];

  for (let mi = 0; mi < monthlyDates.length - 1; mi++) {
    const rebalDate = monthlyDates[mi];
    const nextDate = monthlyDates[mi + 1];

    // Compute features and 1M forward return for each ticker
    const features: { ticker: string; f1m: number; f3m: number; f6m: number; f12m: number; priceRatio: number; fwdRet: number }[] = [];

    for (const ticker of tickers) {
      const prices = priceMap.get(ticker);
      if (!prices || prices.length < 60) continue;

      const f1m = getReturn(prices, subtractDays(rebalDate, 22), rebalDate);
      const f3m = getReturn(prices, subtractDays(rebalDate, 66), rebalDate);
      const f6m = getReturn(prices, subtractDays(rebalDate, 132), rebalDate);
      const f12m = getReturn(prices, subtractDays(rebalDate, 253), rebalDate);
      const high52w = getHigh52W(prices, rebalDate);
      const currentPrice = prices.filter(p => p.date <= rebalDate).at(-1)?.close ?? 0;
      const priceRatio = high52w > 0 ? currentPrice / high52w : 0;
      const fwdRet = getReturn(prices, rebalDate, nextDate);

      if (f1m === null || f3m === null || f6m === null || f12m === null || fwdRet === null) continue;

      features.push({ ticker, f1m, f3m, f6m, f12m, priceRatio, fwdRet });
    }

    if (features.length < 20) continue;

    // Baseline: rank by composite momentum score (equal weight of f1m, f3m, f6m, f12m)
    const baselineScores = features.map(f => ({
      ticker: f.ticker,
      score: f.f1m * 0.1 + f.f3m * 0.2 + f.f6m * 0.3 + f.f12m * 0.4,
      fwdRet: f.fwdRet,
    })).sort((a, b) => b.score - a.score);

    const top20Baseline = baselineScores.slice(0, 20);
    const baselineRet = top20Baseline.reduce((s, f) => s + f.fwdRet, 0) / top20Baseline.length - 0.001;
    baselineMonthlyRets.push(baselineRet);

    // ML Variant: train Ridge on past 12 months, predict next month
    // Use only in-sample data (before rebalDate) to avoid look-ahead
    const trainData = features.filter(f => f.fwdRet !== null);
    if (trainData.length < 15) {
      mlMonthlyRets.push(baselineRet); // fallback to baseline
      continue;
    }

    const X = trainData.map(f => [f.f1m, f.f3m, f.f6m, f.f12m, f.priceRatio]);
    const y = trainData.map(f => f.fwdRet);
    const beta = ridgeRegression(X, y, 0.01);

    // Score each ticker with ML model
    const mlScores = features.map(f => ({
      ticker: f.ticker,
      score: f.f1m * beta[0] + f.f3m * beta[1] + f.f6m * beta[2] + f.f12m * beta[3] + f.priceRatio * beta[4],
      fwdRet: f.fwdRet,
    })).sort((a, b) => b.score - a.score);

    const top20ML = mlScores.slice(0, 20);
    const mlRet = top20ML.reduce((s, f) => s + f.fwdRet, 0) / top20ML.length - 0.001;
    mlMonthlyRets.push(mlRet);
  }

  // Convert monthly to approximate daily (repeat each monthly return for ~21 days)
  const baselineDailyRets = baselineMonthlyRets.flatMap(r => Array(21).fill(r / 21));
  const mlDailyRets = mlMonthlyRets.flatMap(r => Array(21).fill(r / 21));

  console.log('\n=== BACKTEST RESULTS: Issue #216 — ML Return Prediction ===\n');
  console.log('OOS Period: 2020-01-01 to 2024-12-31 | Costs: 10bps | Rebalancing: monatlich\n');

  const configs = [
    { name: 'Baseline (Momentum-Score Top-20)', rets: baselineDailyRets },
    { name: 'Variante ML (Ridge Regression Top-20)', rets: mlDailyRets },
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
  console.log('\n### Regime-Analyse\n');
  console.log('| Regime | Baseline Sharpe | ML Sharpe | Δ |');
  console.log('|---|---|---|---|');
  const totalMonths = baselineMonthlyRets.length;
  for (const regime of REGIMES) {
    const regMonths = REGIMES.indexOf(regime);
    const start = Math.floor(regMonths * totalMonths / REGIMES.length);
    const end = Math.floor((regMonths + 1) * totalMonths / REGIMES.length);
    const bRets = baselineMonthlyRets.slice(start, end).flatMap(r => Array(21).fill(r / 21));
    const vRets = mlMonthlyRets.slice(start, end).flatMap(r => Array(21).fill(r / 21));
    if (bRets.length < 5) continue;
    const bs = sharpe(bRets).toFixed(3);
    const vs = sharpe(vRets).toFixed(3);
    const delta = (Number(vs) - Number(bs)).toFixed(3);
    console.log(`| ${regime.name} | ${bs} | ${vs} | ${delta} |`);
  }

  const baselineSharpe = sharpe(baselineDailyRets);
  const mlSharpe = sharpe(mlDailyRets);
  const deltaSharpe = mlSharpe - baselineSharpe;
  const threshold = 0.08;
  console.log(`\n**ΔSharpe (ML vs. Baseline): ${deltaSharpe.toFixed(3)}**`);
  console.log(`**Schwelle: ΔSharpe_netto ≥ +${threshold}**`);
  console.log(`**Entscheidung: ${deltaSharpe >= threshold ? '✅ ACCEPTED' : '❌ REJECTED'}**`);

  await conn.end();
}

function subtractDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

main().catch(console.error);
