/**
 * Walk-Forward Validation #216: ML Return Prediction — Ridge Regression
 *
 * Validiert die Ergebnisse aus backtest_216.ts mit echter Walk-Forward Methodik:
 * - Training-Fenster: 12 Monate
 * - Test-Fenster: 6 Monate (kein Overlap)
 * - Modell wird für jedes Fenster neu trainiert (kein Look-Ahead)
 *
 * Ziel: Prüfen ob ΔSharpe +6.421 aus dem ersten Backtest robust ist,
 * oder ob es auf Overfitting im Trainings-Zeitraum zurückzuführen ist.
 *
 * OOS: 2020-01-01 bis 2024-12-31 (10 Fenster à 6 Monate)
 * Kosten: 10 bps pro Trade
 * Schwelle: ΔSharpe_netto ≥ +0.08 in ≥ 7/10 Fenstern (Robustheit)
 */
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

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

// ─── Ridge Regression (closed form) ──────────────────────────────────────────

function ridgeRegression(X: number[][], y: number[], lambda: number): number[] {
  const n = X.length;
  const p = X[0].length;
  const XtX: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < p; j++) {
      for (let k = 0; k < p; k++) {
        XtX[j][k] += X[i][j] * X[i][k];
      }
    }
  }
  for (let j = 0; j < p; j++) XtX[j][j] += lambda;
  const Xty: number[] = new Array(p).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < p; j++) {
      Xty[j] += X[i][j] * y[i];
    }
  }
  // Gaussian elimination
  const aug: number[][] = XtX.map((row, i) => [...row, Xty[i]]);
  for (let col = 0; col < p; col++) {
    let maxRow = col;
    for (let row = col + 1; row < p; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    for (let row = col + 1; row < p; row++) {
      if (aug[col][col] === 0) continue;
      const factor = aug[row][col] / aug[col][col];
      for (let k = col; k <= p; k++) {
        aug[row][k] -= factor * aug[col][k];
      }
    }
  }
  const beta = new Array(p).fill(0);
  for (let i = p - 1; i >= 0; i--) {
    if (aug[i][i] === 0) continue;
    beta[i] = aug[i][p];
    for (let j = i + 1; j < p; j++) {
      beta[i] -= aug[i][j] * beta[j];
    }
    beta[i] /= aug[i][i];
  }
  return beta;
}

// ─── Price helpers ────────────────────────────────────────────────────────────

interface PriceRow { date: string; close: number; }

function subtractDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - days);
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

function getHigh52W(prices: PriceRow[], asOfDate: string): number {
  const fromDate = subtractDays(asOfDate, 252);
  const filtered = prices.filter(p => p.date >= fromDate && p.date <= asOfDate);
  return filtered.length > 0 ? Math.max(...filtered.map(p => p.close)) : 0;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);

  // Load universe tickers
  const [tickerRows] = await conn.execute<any[]>(
    `SELECT DISTINCT ticker FROM historical_prices
     WHERE date >= '2018-01-01' AND date <= '2024-12-31'
     GROUP BY ticker HAVING COUNT(*) > 300`
  );
  const allTickers: string[] = tickerRows.map((r: any) => r.ticker);
  const tickers = allTickers.filter(t =>
    !['SPY.US', 'QQQ.US', 'CHSPI.SW', 'ACWI.US', 'FEZ.US', 'AGG.US', 'TLT.US'].includes(t) &&
    t.length <= 12
  ).slice(0, 80);

  console.log(`Universe: ${tickers.length} tickers`);

  // Load all prices (need 2018 data for training first window)
  const [allPrices] = await conn.execute<any[]>(
    `SELECT ticker, DATE_FORMAT(date, '%Y-%m-%d') as date, close
     FROM historical_prices
     WHERE ticker IN (${tickers.map(() => '?').join(',')})
       AND date >= '2018-01-01' AND date <= '2024-12-31'
     ORDER BY ticker, date ASC`,
    tickers
  );

  const priceMap = new Map<string, PriceRow[]>();
  for (const row of allPrices) {
    if (!priceMap.has(row.ticker)) priceMap.set(row.ticker, []);
    priceMap.get(row.ticker)!.push({ date: String(row.date).slice(0, 10), close: Number(row.close) });
  }

  // Walk-Forward windows: 12M train + 6M test, rolling by 6M
  // Window 1: Train 2019-01 to 2019-12, Test 2020-01 to 2020-06
  // Window 2: Train 2019-07 to 2020-06, Test 2020-07 to 2020-12
  // ...
  // Window 10: Train 2023-07 to 2024-06, Test 2024-07 to 2024-12

  const windows: Array<{
    trainStart: string; trainEnd: string;
    testStart: string;  testEnd: string;
  }> = [];

  for (let i = 0; i < 10; i++) {
    const testStartDate = new Date('2020-01-01');
    testStartDate.setMonth(testStartDate.getMonth() + i * 6);
    const testEndDate = new Date(testStartDate);
    testEndDate.setMonth(testEndDate.getMonth() + 6);
    testEndDate.setDate(testEndDate.getDate() - 1);

    const trainEndDate = new Date(testStartDate);
    trainEndDate.setDate(trainEndDate.getDate() - 1);
    const trainStartDate = new Date(trainEndDate);
    trainStartDate.setMonth(trainStartDate.getMonth() - 12);

    windows.push({
      trainStart: trainStartDate.toISOString().slice(0, 10),
      trainEnd:   trainEndDate.toISOString().slice(0, 10),
      testStart:  testStartDate.toISOString().slice(0, 10),
      testEnd:    testEndDate.toISOString().slice(0, 10),
    });
  }

  const COSTS = 0.001;
  const windowResults: Array<{
    window: string;
    baselineSharpe: number;
    mlSharpe: number;
    delta: number;
    accepted: boolean;
    baselineRets: number[];
    mlRets: number[];
  }> = [];

  console.log('\n=== WALK-FORWARD VALIDATION: Issue #216 — ML Return Prediction ===\n');
  console.log('Methodik: 12M Training + 6M Test, 10 Fenster, kein Look-Ahead\n');

  for (const win of windows) {
    // ── Training phase: collect features + labels ──────────────────────────────
    const trainMonthDates: string[] = [];
    let td = new Date(win.trainStart);
    while (td.toISOString().slice(0, 10) < win.trainEnd) {
      trainMonthDates.push(td.toISOString().slice(0, 10));
      td.setMonth(td.getMonth() + 1);
    }

    const trainFeatures: number[][] = [];
    const trainLabels: number[] = [];

    for (let mi = 0; mi < trainMonthDates.length - 1; mi++) {
      const rebalDate = trainMonthDates[mi];
      const nextDate = trainMonthDates[mi + 1];
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
        trainFeatures.push([f1m, f3m, f6m, f12m, priceRatio]);
        trainLabels.push(fwdRet);
      }
    }

    // Train Ridge model on this window's training data
    let beta: number[] = [0.1, 0.2, 0.3, 0.4, 0.1]; // fallback weights
    if (trainFeatures.length >= 20) {
      beta = ridgeRegression(trainFeatures, trainLabels, 0.01);
    }

    // ── Test phase: apply trained model ───────────────────────────────────────
    const testMonthDates: string[] = [];
    let testD = new Date(win.testStart);
    while (testD.toISOString().slice(0, 10) < win.testEnd) {
      testMonthDates.push(testD.toISOString().slice(0, 10));
      testD.setMonth(testD.getMonth() + 1);
    }

    const baselineMonthlyRets: number[] = [];
    const mlMonthlyRets: number[] = [];

    for (let mi = 0; mi < testMonthDates.length - 1; mi++) {
      const rebalDate = testMonthDates[mi];
      const nextDate = testMonthDates[mi + 1];

      const features: { ticker: string; baseScore: number; mlScore: number; fwdRet: number }[] = [];
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

        const baseScore = f1m * 0.1 + f3m * 0.2 + f6m * 0.3 + f12m * 0.4;
        const mlScore = f1m * beta[0] + f3m * beta[1] + f6m * beta[2] + f12m * beta[3] + priceRatio * beta[4];
        features.push({ ticker, baseScore, mlScore, fwdRet });
      }

      if (features.length < 20) continue;

      const top20Base = [...features].sort((a, b) => b.baseScore - a.baseScore).slice(0, 20);
      const top20ML   = [...features].sort((a, b) => b.mlScore  - a.mlScore).slice(0, 20);

      baselineMonthlyRets.push(top20Base.reduce((s, f) => s + f.fwdRet, 0) / top20Base.length - COSTS);
      mlMonthlyRets.push(top20ML.reduce((s, f) => s + f.fwdRet, 0) / top20ML.length - COSTS);
    }

    const bDailyRets = baselineMonthlyRets.flatMap(r => Array(21).fill(r / 21));
    const mDailyRets = mlMonthlyRets.flatMap(r => Array(21).fill(r / 21));

    const bSharpe = sharpe(bDailyRets);
    const mSharpe = sharpe(mDailyRets);
    const delta = mSharpe - bSharpe;

    windowResults.push({
      window: `${win.testStart} → ${win.testEnd}`,
      baselineSharpe: bSharpe,
      mlSharpe: mSharpe,
      delta,
      accepted: delta >= 0.08,
      baselineRets: bDailyRets,
      mlRets: mDailyRets,
    });
  }

  // Print per-window results
  console.log('| Fenster | Baseline Sharpe | ML Sharpe | Δ | Akzeptiert |');
  console.log('|---|---|---|---|---|');
  for (const w of windowResults) {
    const accepted = w.accepted ? '✅' : '❌';
    console.log(`| ${w.window} | ${w.baselineSharpe.toFixed(3)} | ${w.mlSharpe.toFixed(3)} | ${w.delta.toFixed(3)} | ${accepted} |`);
  }

  const acceptedCount = windowResults.filter(w => w.accepted).length;
  const allBaselineRets = windowResults.flatMap(w => w.baselineRets);
  const allMLRets = windowResults.flatMap(w => w.mlRets);
  const overallDelta = sharpe(allMLRets) - sharpe(allBaselineRets);

  console.log(`\n### Gesamtergebnis über alle Fenster`);
  console.log(`| Metrik | Baseline | ML | Δ |`);
  console.log(`|---|---|---|---|`);
  console.log(`| Sharpe (gesamt) | ${sharpe(allBaselineRets).toFixed(3)} | ${sharpe(allMLRets).toFixed(3)} | ${overallDelta.toFixed(3)} |`);
  console.log(`| MaxDD (gesamt) | ${(maxDrawdown(allBaselineRets)*100).toFixed(1)}% | ${(maxDrawdown(allMLRets)*100).toFixed(1)}% | – |`);
  console.log(`| CAGR (gesamt) | ${(cagr(allBaselineRets)*100).toFixed(1)}% | ${(cagr(allMLRets)*100).toFixed(1)}% | – |`);
  console.log(`\n**Fenster mit ΔSharpe ≥ +0.08: ${acceptedCount}/10**`);
  console.log(`**Robustheitsschwelle: ≥ 7/10 Fenster**`);
  console.log(`**ΔSharpe gesamt: ${overallDelta.toFixed(3)}**`);
  console.log(`**Schwelle: ΔSharpe_netto ≥ +0.08**`);

  const robust = acceptedCount >= 7 && overallDelta >= 0.08;
  console.log(`\n**Walk-Forward Entscheidung: ${robust ? '✅ ROBUST — Production-ready' : '⚠️  NICHT ROBUST — weitere Validierung nötig'}**`);

  await conn.end();
}

main().catch(console.error);
