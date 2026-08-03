/**
 * backtest_229.ts
 *
 * Research Issue #229: "The AI Investment Race" — KI-Boom Overinvestment Regime Filter
 *
 * Hypothese: Die Integration von KI-Boom-Indikatoren (overallZone, scenarioCrash,
 * vixLevel, mag7AvgYtd) in die Regime-Erkennung ermöglicht frühzeitigere Identifizierung
 * von Boom-Bust-Zyklen und reduziert Drawdowns in Phasen erhöhter finanzieller Fragilität.
 *
 * Methodik:
 * - OOS: 2021-07-16 bis 2024-12-31 (KiBoom-Daten ab 2021-07-16)
 * - Universe: alle Tickers mit ≥300 Preisen in DB
 * - Kosten: 10 bps pro Trade
 * - Rebalancing: monatlich
 * - Schwelle: ΔSharpe_netto ≥ +0.10 (Issue-Standard)
 *
 * Varianten:
 * A) KiBoom-Zone als Regime-Override (overallZone='red' → defensiv)
 * B) KiBoom-Crash-Szenario-Filter (scenarioCrash > 30 → Exposure reduzieren)
 * C) Kombinierter Filter (Zone + Crash + VIX)
 *
 * Look-Ahead-Bias-Ausschluss:
 * - KiBoom-Daten werden nur bis zum Monatsende des Vormonats verwendet
 * - Kein Forward-Fill über Monatsgrenzen hinaus
 */

import * as dotenv from "dotenv";
dotenv.config();

import mysql from "mysql2/promise";

// ── Konfiguration ────────────────────────────────────────────────────────────
const OOS_START = new Date("2021-07-16");
const OOS_END = new Date("2024-12-31");
const TRANSACTION_COST_BPS = 10;
const TOP_N = 20; // Top-20 Momentum-Aktien
const MIN_PRICES = 300;

// Regime-Perioden für Analyse
const REGIMES = [
  { name: "crisis_2020q1",     start: "2020-01-01", end: "2020-03-31" },
  { name: "bull_2020_recovery",start: "2020-04-01", end: "2020-12-31" },
  { name: "bull_2021",         start: "2021-01-01", end: "2021-12-31" },
  { name: "bear_2022",         start: "2022-01-01", end: "2022-12-31" },
  { name: "bull_2023",         start: "2023-01-01", end: "2023-12-31" },
  { name: "bull_2024",         start: "2024-01-01", end: "2024-12-31" },
];

// ── DB-Verbindung ────────────────────────────────────────────────────────────
async function getDb() {
  return mysql.createConnection(process.env.DATABASE_URL!);
}

// ── Hilfsfunktionen ──────────────────────────────────────────────────────────
function annualizedSharpe(monthlyReturns: number[]): number {
  if (monthlyReturns.length < 3) return 0;
  const mean = monthlyReturns.reduce((a, b) => a + b, 0) / monthlyReturns.length;
  const variance = monthlyReturns.reduce((a, b) => a + (b - mean) ** 2, 0) / monthlyReturns.length;
  const std = Math.sqrt(variance);
  if (std === 0) return 0;
  return (mean / std) * Math.sqrt(12);
}

function annualizedSortino(monthlyReturns: number[]): number {
  if (monthlyReturns.length < 3) return 0;
  const mean = monthlyReturns.reduce((a, b) => a + b, 0) / monthlyReturns.length;
  const downside = monthlyReturns.filter(r => r < 0);
  if (downside.length === 0) return 99;
  const downsideVariance = downside.reduce((a, b) => a + b ** 2, 0) / downside.length;
  const downsideStd = Math.sqrt(downsideVariance);
  if (downsideStd === 0) return 0;
  return (mean / downsideStd) * Math.sqrt(12);
}

function maxDrawdown(monthlyReturns: number[]): number {
  let peak = 1;
  let value = 1;
  let maxDD = 0;
  for (const r of monthlyReturns) {
    value *= (1 + r);
    if (value > peak) peak = value;
    const dd = (peak - value) / peak;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD;
}

function cagr(monthlyReturns: number[]): number {
  const totalReturn = monthlyReturns.reduce((acc, r) => acc * (1 + r), 1);
  const years = monthlyReturns.length / 12;
  return Math.pow(totalReturn, 1 / years) - 1;
}

// ── Daten laden ──────────────────────────────────────────────────────────────
async function loadPrices(conn: mysql.Connection): Promise<Map<string, Map<string, number>>> {
  const [rows] = await conn.execute(
    `SELECT ticker, date, COALESCE(adjustedClose, close) as close FROM historical_prices
     WHERE date >= ? AND date <= ?
     ORDER BY ticker, date`,
    [OOS_START.toISOString().slice(0, 10), OOS_END.toISOString().slice(0, 10)]
  ) as any;

  const priceMap = new Map<string, Map<string, number>>();
  for (const row of rows) {
    if (!priceMap.has(row.ticker)) priceMap.set(row.ticker, new Map());
    priceMap.get(row.ticker)!.set(row.date, parseFloat(row.close));
  }
  return priceMap;
}

async function loadKiBoomData(conn: mysql.Connection): Promise<Map<string, { zone: string; crashProb: number; vix: number; mag7: number }>> {
  const [rows] = await conn.execute(
    `SELECT 
       DATE_FORMAT(recordedAt, '%Y-%m') as month,
       overallZone,
       AVG(CAST(scenarioCrash AS DECIMAL(10,2))) as avgCrash,
       AVG(CAST(vixLevel AS DECIMAL(10,2))) as avgVix,
       AVG(CAST(mag7AvgYtd AS DECIMAL(10,2))) as avgMag7
     FROM ki_boom_metrics_history
     WHERE recordedAt >= ? AND recordedAt <= ?
     GROUP BY DATE_FORMAT(recordedAt, '%Y-%m'), overallZone
     ORDER BY month`,
    [OOS_START.toISOString().slice(0, 10), OOS_END.toISOString().slice(0, 10)]
  ) as any;

  // Take last entry per month (most recent overallZone)
  const [rows2] = await conn.execute(
    `SELECT 
       DATE_FORMAT(recordedAt, '%Y-%m') as month,
       overallZone,
       CAST(scenarioCrash AS DECIMAL(10,2)) as crashProb,
       CAST(vixLevel AS DECIMAL(10,2)) as vix,
       CAST(mag7AvgYtd AS DECIMAL(10,2)) as mag7
     FROM ki_boom_metrics_history k1
     WHERE recordedAt = (
       SELECT MAX(k2.recordedAt) 
       FROM ki_boom_metrics_history k2 
       WHERE DATE_FORMAT(k2.recordedAt, '%Y-%m') = DATE_FORMAT(k1.recordedAt, '%Y-%m')
     )
     AND recordedAt >= ? AND recordedAt <= ?
     ORDER BY month`,
    [OOS_START.toISOString().slice(0, 10), OOS_END.toISOString().slice(0, 10)]
  ) as any;

  const kiBoomMap = new Map<string, { zone: string; crashProb: number; vix: number; mag7: number }>();
  for (const row of rows2) {
    kiBoomMap.set(row.month, {
      zone: row.overallZone || 'gruen',
      crashProb: parseFloat(row.crashProb) || 0,
      vix: parseFloat(row.vix) || 20,
      mag7: parseFloat(row.mag7) || 0,
    });
  }
  return kiBoomMap;
}

// ── Monats-Endpreise extrahieren ─────────────────────────────────────────────
function getMonthlyEndPrices(priceMap: Map<string, Map<string, number>>): Map<string, Map<string, number>> {
  const monthly = new Map<string, Map<string, number>>();
  for (const [ticker, dates] of priceMap) {
    const monthMap = new Map<string, number>();
    for (const [date, price] of dates) {
      const month = date.slice(0, 7);
      monthMap.set(month, price); // last date in month wins
    }
    monthly.set(ticker, monthMap);
  }
  return monthly;
}

// ── Momentum berechnen (12-1 Monats-Momentum) ────────────────────────────────
function calcMomentum(monthlyPrices: Map<string, number>, currentMonth: string): number | null {
  const months = Array.from(monthlyPrices.keys()).sort();
  const idx = months.indexOf(currentMonth);
  if (idx < 12) return null;
  const price12 = monthlyPrices.get(months[idx - 12]);
  const price1 = monthlyPrices.get(months[idx - 1]);
  if (!price12 || !price1 || price12 === 0) return null;
  return (price1 - price12) / price12;
}

// ── Backtest-Kern ────────────────────────────────────────────────────────────
interface BacktestResult {
  monthlyReturns: number[];
  turnover: number[];
  label: string;
}

function runBacktest(
  monthlyPrices: Map<string, Map<string, number>>,
  allMonths: string[],
  kiBoomData: Map<string, { zone: string; crashProb: number; vix: number; mag7: number }>,
  variant: 'baseline' | 'A' | 'B' | 'C'
): BacktestResult {
  const monthlyReturns: number[] = [];
  const turnoverArr: number[] = [];
  let prevWeights = new Map<string, number>();

  for (let i = 1; i < allMonths.length; i++) {
    const prevMonth = allMonths[i - 1];
    const currentMonth = allMonths[i];

    // Look-ahead-free: use KiBoom data from PREVIOUS month for current month's portfolio
    const kiBoom = kiBoomData.get(prevMonth) || { zone: 'green', crashProb: 0, vix: 20, mag7: 0 };

    // Determine defensive mode based on variant
    let defensiveMode = false;
    let exposureMultiplier = 1.0;

    if (variant === 'A') {
      // Variante A: Zone-basierter Override (Zonen auf Deutsch: rot/gelb/gruen)
      if (kiBoom.zone === 'rot') { defensiveMode = true; exposureMultiplier = 0.5; }
      else if (kiBoom.zone === 'gelb') { exposureMultiplier = 0.75; }
    } else if (variant === 'B') {
      // Variante B: Crash-Szenario-Filter
      if (kiBoom.crashProb > 40) { defensiveMode = true; exposureMultiplier = 0.4; }
      else if (kiBoom.crashProb > 25) { exposureMultiplier = 0.7; }
    } else if (variant === 'C') {
      // Variante C: Kombiniert (Zone + Crash + VIX)
      const riskScore = (kiBoom.zone === 'rot' ? 3 : kiBoom.zone === 'gelb' ? 1 : 0)
                      + (kiBoom.crashProb > 35 ? 2 : kiBoom.crashProb > 20 ? 1 : 0)
                      + (kiBoom.vix > 30 ? 2 : kiBoom.vix > 22 ? 1 : 0);
      if (riskScore >= 5) { defensiveMode = true; exposureMultiplier = 0.3; }
      else if (riskScore >= 3) { exposureMultiplier = 0.6; }
      else if (riskScore >= 1) { exposureMultiplier = 0.85; }
    }

    // Calculate momentum scores for all tickers
    const scores: { ticker: string; momentum: number }[] = [];
    for (const [ticker, prices] of monthlyPrices) {
      const mom = calcMomentum(prices, prevMonth);
      if (mom !== null && prices.has(prevMonth) && prices.has(currentMonth)) {
        scores.push({ ticker, momentum: mom });
      }
    }

    // Sort by momentum, take top N
    scores.sort((a, b) => b.momentum - a.momentum);
    const selected = scores.slice(0, TOP_N);

    if (selected.length === 0) continue;

    // Equal weight, adjusted by exposure multiplier
    const weight = (1 / selected.length) * exposureMultiplier;
    const cashWeight = 1 - exposureMultiplier;

    // Calculate portfolio return
    let portfolioReturn = cashWeight * 0; // cash = 0% return (simplified)
    for (const { ticker } of selected) {
      const prevPrice = monthlyPrices.get(ticker)!.get(prevMonth)!;
      const currPrice = monthlyPrices.get(ticker)!.get(currentMonth)!;
      const ret = (currPrice - prevPrice) / prevPrice;
      portfolioReturn += weight * ret;
    }

    // Calculate turnover
    const newWeights = new Map<string, number>();
    for (const { ticker } of selected) newWeights.set(ticker, weight);
    let turnover = 0;
    const allTickers = new Set([...prevWeights.keys(), ...newWeights.keys()]);
    for (const t of allTickers) {
      turnover += Math.abs((newWeights.get(t) || 0) - (prevWeights.get(t) || 0));
    }
    turnover /= 2;

    // Apply transaction costs
    const cost = turnover * (TRANSACTION_COST_BPS / 10000);
    portfolioReturn -= cost;

    monthlyReturns.push(portfolioReturn);
    turnoverArr.push(turnover);
    prevWeights = newWeights;
  }

  const labels = { baseline: 'Baseline (Momentum Top-20)', A: 'Variante A (KiBoom-Zone-Override)', B: 'Variante B (Crash-Szenario-Filter)', C: 'Variante C (Kombinierter Filter)' };
  return { monthlyReturns, turnover: turnoverArr, label: labels[variant] };
}

// ── Regime-Analyse ───────────────────────────────────────────────────────────
function analyzeRegimes(monthlyReturns: number[], allMonths: string[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const regime of REGIMES) {
    const regimeMonths = allMonths.filter(m => m >= regime.start.slice(0, 7) && m <= regime.end.slice(0, 7));
    const indices = regimeMonths.map(m => allMonths.indexOf(m) - 1).filter(i => i >= 0 && i < monthlyReturns.length);
    const returns = indices.map(i => monthlyReturns[i]);
    result[regime.name] = returns.length >= 3 ? annualizedSharpe(returns) : 0;
  }
  return result;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const conn = await getDb();
  try {
    console.log("Loading price data...");
    const priceMap = await loadPrices(conn);

    console.log("Loading KiBoom data...");
    const kiBoomData = await loadKiBoomData(conn);

    // Filter tickers with enough data
    const validTickers = Array.from(priceMap.entries())
      .filter(([, dates]) => dates.size >= MIN_PRICES)
      .map(([ticker]) => ticker);

    console.log(`Universe: ${validTickers.length} tickers`);

    const filteredPrices = new Map(validTickers.map(t => [t, priceMap.get(t)!]));
    const monthlyPrices = getMonthlyEndPrices(filteredPrices);

    // Get all months in OOS period
    const allMonthsSet = new Set<string>();
    for (const [, prices] of monthlyPrices) {
      for (const month of prices.keys()) allMonthsSet.add(month);
    }
    const allMonths = Array.from(allMonthsSet).sort().filter(m => m >= "2021-07" && m <= "2024-12");

    console.log(`OOS months: ${allMonths[0]} to ${allMonths[allMonths.length - 1]} (${allMonths.length} months)`);
    console.log(`KiBoom months available: ${kiBoomData.size}`);

    // Run all variants
    const variants: ('baseline' | 'A' | 'B' | 'C')[] = ['baseline', 'A', 'B', 'C'];
    const results: { label: string; sharpe: number; sortino: number; maxDD: number; cagr: number; turnover: number; regimes: Record<string, number> }[] = [];

    for (const variant of variants) {
      const bt = runBacktest(monthlyPrices, allMonths, kiBoomData, variant);
      const sharpe = annualizedSharpe(bt.monthlyReturns);
      const sortino = annualizedSortino(bt.monthlyReturns);
      const dd = maxDrawdown(bt.monthlyReturns);
      const cagrVal = cagr(bt.monthlyReturns);
      const avgTurnover = bt.turnover.reduce((a, b) => a + b, 0) / bt.turnover.length;
      const regimes = analyzeRegimes(bt.monthlyReturns, allMonths.slice(1));

      results.push({ label: bt.label, sharpe, sortino, maxDD: dd, cagr: cagrVal, turnover: avgTurnover, regimes });
    }

    // Print results
    const baseline = results[0];
    console.log("\n=== BACKTEST RESULTS: Issue #229 — KI-Boom Overinvestment Regime Filter ===");
    console.log(`OOS Period: 2021-07-16 to 2024-12-31 | Costs: ${TRANSACTION_COST_BPS}bps | Rebalancing: monatlich`);
    console.log("Note: OOS ab 2021-07-16 da KiBoom-Daten erst ab diesem Datum verfügbar");
    console.log("\n| Strategie | Sharpe | Sortino | MaxDD | CAGR | Turnover |");
    console.log("|---|---|---|---|---|---|");
    for (const r of results) {
      console.log(`| ${r.label} | ${r.sharpe.toFixed(3)} | ${r.sortino.toFixed(3)} | ${(r.maxDD * 100).toFixed(1)}% | ${(r.cagr * 100).toFixed(1)}% | ${(r.turnover * 100).toFixed(1)}% |`);
    }

    console.log("\n### Regime-Analyse (beste Variante vs. Baseline)");
    const best = results.slice(1).sort((a, b) => b.sharpe - a.sharpe)[0];
    console.log("| Regime | Baseline Sharpe | Beste Variante Sharpe | Δ |");
    console.log("|---|---|---|---|");
    for (const regime of REGIMES) {
      const baseVal = baseline.regimes[regime.name] || 0;
      const bestVal = best.regimes[regime.name] || 0;
      const delta = bestVal - baseVal;
      console.log(`| ${regime.name} | ${baseVal.toFixed(3)} | ${bestVal.toFixed(3)} | ${delta >= 0 ? '+' : ''}${delta.toFixed(3)} |`);
    }

    const bestDelta = best.sharpe - baseline.sharpe;
    const threshold = 0.10;
    const decision = bestDelta >= threshold ? "✅ ACCEPTED" : "❌ REJECTED";

    console.log(`\n**ΔSharpe (beste Variante vs. Baseline): ${bestDelta >= 0 ? '+' : ''}${bestDelta.toFixed(3)}**`);
    console.log(`**Schwelle: ΔSharpe_netto ≥ +${threshold}**`);
    console.log(`**Entscheidung: ${decision}**`);

  } finally {
    await conn.end();
  }
}

main().catch(console.error);
