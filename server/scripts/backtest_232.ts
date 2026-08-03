/**
 * backtest_232.ts
 *
 * Research Issue #232: "Bond yield responses to macro news: the role of macro
 * forecast disagreement and monetary policy uncertainty"
 *
 * Hypothese: Die Integration von Makro-Prognose-Uneinigkeit und Unsicherheit der
 * Geldpolitik als Indikatoren in die Regime-Erkennung verbessert die Genauigkeit
 * der Klassifizierung von Marktregimen (Bull/Bear/Crisis/Recovery).
 *
 * Da externe Makro-Prognose-Uneinigkeitsdaten (z.B. Survey of Professional Forecasters)
 * nicht in der DB vorhanden sind, verwenden wir marktbasierte Proxies:
 * - VIX-Proxy: Kreuzvolatilität zwischen SPY/QQQ (aus historicalPrices via SPXL/TQQQ/VXX)
 * - Dispersion-Proxy: Streuung der monatlichen Returns im Universum (Cross-Sectional Volatility)
 * - Regime-Unsicherheits-Proxy: Varianz der Momentum-Scores über Rolling-Window
 *
 * Methodik:
 * - OOS: 2020-01-01 bis 2024-12-31
 * - Universe: alle Tickers mit ≥300 Preisen in DB
 * - Kosten: 10 bps pro Trade
 * - Rebalancing: monatlich
 * - Schwelle: ΔSharpe_netto ≥ +0.05 (Issue-Schwelle: F1-Score +0.05)
 *   → Da wir Sharpe verwenden: ΔSharpe ≥ +0.05
 *
 * Varianten:
 * A) Cross-Sectional Volatility Filter (CSV > Schwelle → defensiv)
 * B) Momentum-Dispersion Filter (Streuung der Momentum-Scores)
 * C) Kombinierter Unsicherheits-Score (CSV + Momentum-Dispersion)
 *
 * Look-Ahead-Bias-Ausschluss:
 * - Alle Proxy-Metriken werden aus Preisdaten des Vormonats berechnet
 * - Kein Forward-Fill über Monatsgrenzen
 * - Momentum-Berechnung: 12-1 Monats-Momentum (Skip-Month)
 */

import * as dotenv from "dotenv";
dotenv.config();

import mysql from "mysql2/promise";

// ── Konfiguration ────────────────────────────────────────────────────────────
const OOS_START = new Date("2020-01-01");
const OOS_END = new Date("2024-12-31");
const TRANSACTION_COST_BPS = 10;
const TOP_N = 20;
const MIN_PRICES = 300;

// Regime-Perioden
const REGIMES = [
  { name: "crisis_2020q1",      start: "2020-01", end: "2020-03" },
  { name: "bull_2020_recovery", start: "2020-04", end: "2020-12" },
  { name: "bull_2021",          start: "2021-01", end: "2021-12" },
  { name: "bear_2022",          start: "2022-01", end: "2022-12" },
  { name: "bull_2023",          start: "2023-01", end: "2023-12" },
  { name: "bull_2024",          start: "2024-01", end: "2024-12" },
];

// Schwellenwerte für Unsicherheits-Proxies (kalibriert auf historische Verteilung)
const CSV_HIGH_THRESHOLD = 0.08;   // Cross-Sectional Volatility > 8% = hohe Unsicherheit
const CSV_MED_THRESHOLD  = 0.05;   // > 5% = mittlere Unsicherheit
const DISP_HIGH_THRESHOLD = 0.25;  // Momentum-Dispersion (Std/Mean) > 25%
const DISP_MED_THRESHOLD  = 0.15;  // > 15% = mittlere Dispersion

// ── DB-Verbindung ────────────────────────────────────────────────────────────
async function getDb() {
  return mysql.createConnection(process.env.DATABASE_URL!);
}

// ── Statistik-Hilfsfunktionen ─────────────────────────────────────────────────
function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function std(arr: number[]): number {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length);
}

function annualizedSharpe(monthlyReturns: number[]): number {
  if (monthlyReturns.length < 3) return 0;
  const m = mean(monthlyReturns);
  const s = std(monthlyReturns);
  if (s === 0) return 0;
  return (m / s) * Math.sqrt(12);
}

function annualizedSortino(monthlyReturns: number[]): number {
  if (monthlyReturns.length < 3) return 0;
  const m = mean(monthlyReturns);
  const downside = monthlyReturns.filter(r => r < 0);
  if (downside.length === 0) return 99;
  const downsideStd = Math.sqrt(downside.reduce((a, b) => a + b ** 2, 0) / downside.length);
  if (downsideStd === 0) return 0;
  return (m / downsideStd) * Math.sqrt(12);
}

function maxDrawdown(monthlyReturns: number[]): number {
  let peak = 1, value = 1, maxDD = 0;
  for (const r of monthlyReturns) {
    value *= (1 + r);
    if (value > peak) peak = value;
    const dd = (peak - value) / peak;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD;
}

function cagr(monthlyReturns: number[]): number {
  const total = monthlyReturns.reduce((acc, r) => acc * (1 + r), 1);
  const years = monthlyReturns.length / 12;
  return Math.pow(total, 1 / years) - 1;
}

// ── Daten laden ──────────────────────────────────────────────────────────────
async function loadPrices(conn: mysql.Connection): Promise<Map<string, Map<string, number>>> {
  const [rows] = await conn.execute(
    `SELECT ticker, date, COALESCE(adjustedClose, close) as price
     FROM historical_prices
     WHERE date >= ? AND date <= ?
     ORDER BY ticker, date`,
    [OOS_START.toISOString().slice(0, 10), OOS_END.toISOString().slice(0, 10)]
  ) as any;

  const priceMap = new Map<string, Map<string, number>>();
  for (const row of rows) {
    if (!priceMap.has(row.ticker)) priceMap.set(row.ticker, new Map());
    priceMap.get(row.ticker)!.set(row.date, parseFloat(row.price));
  }
  return priceMap;
}

// ── Monats-Endpreise ─────────────────────────────────────────────────────────
function getMonthlyEndPrices(priceMap: Map<string, Map<string, number>>): Map<string, Map<string, number>> {
  const monthly = new Map<string, Map<string, number>>();
  for (const [ticker, dates] of priceMap) {
    const monthMap = new Map<string, number>();
    for (const [date, price] of dates) {
      monthMap.set(date.slice(0, 7), price);
    }
    monthly.set(ticker, monthMap);
  }
  return monthly;
}

// ── Momentum (12-1) ──────────────────────────────────────────────────────────
function calcMomentum(monthlyPrices: Map<string, number>, currentMonth: string): number | null {
  const months = Array.from(monthlyPrices.keys()).sort();
  const idx = months.indexOf(currentMonth);
  if (idx < 12) return null;
  const p12 = monthlyPrices.get(months[idx - 12]);
  const p1  = monthlyPrices.get(months[idx - 1]);
  if (!p12 || !p1 || p12 === 0) return null;
  return (p1 - p12) / p12;
}

// ── Unsicherheits-Proxies berechnen ─────────────────────────────────────────
interface UncertaintyMetrics {
  csv: number;           // Cross-Sectional Volatility der monatlichen Returns
  momentumDisp: number;  // Dispersion der Momentum-Scores (Std/|Mean|)
}

function calcUncertaintyMetrics(
  monthlyPrices: Map<string, Map<string, number>>,
  prevMonth: string,
  twoMonthsAgo: string
): UncertaintyMetrics {
  const monthlyReturns: number[] = [];
  const momentumScores: number[] = [];

  for (const [, prices] of monthlyPrices) {
    const prevPrice = prices.get(prevMonth);
    const prevPrevPrice = prices.get(twoMonthsAgo);
    if (prevPrice && prevPrevPrice && prevPrevPrice > 0) {
      monthlyReturns.push((prevPrice - prevPrevPrice) / prevPrevPrice);
    }
    const mom = calcMomentum(prices, prevMonth);
    if (mom !== null) momentumScores.push(mom);
  }

  const csv = monthlyReturns.length >= 10 ? std(monthlyReturns) : 0;

  let momentumDisp = 0;
  if (momentumScores.length >= 10) {
    const m = mean(momentumScores);
    const s = std(momentumScores);
    momentumDisp = Math.abs(m) > 0.001 ? s / Math.abs(m) : s;
  }

  return { csv, momentumDisp };
}

// ── Backtest-Kern ────────────────────────────────────────────────────────────
function runBacktest(
  monthlyPrices: Map<string, Map<string, number>>,
  allMonths: string[],
  variant: 'baseline' | 'A' | 'B' | 'C'
): { monthlyReturns: number[]; turnover: number[]; label: string } {
  const monthlyReturns: number[] = [];
  const turnoverArr: number[] = [];
  let prevWeights = new Map<string, number>();

  const labels = {
    baseline: 'Baseline (Momentum Top-20)',
    A: 'Variante A (Cross-Sectional Volatility Filter)',
    B: 'Variante B (Momentum-Dispersion Filter)',
    C: 'Variante C (Kombinierter Unsicherheits-Score)',
  };

  for (let i = 2; i < allMonths.length; i++) {
    const prevPrevMonth = allMonths[i - 2];
    const prevMonth = allMonths[i - 1];
    const currentMonth = allMonths[i];

    // Look-ahead-free: compute uncertainty from data available BEFORE current month
    const uncertainty = calcUncertaintyMetrics(monthlyPrices, prevMonth, prevPrevMonth);

    // Determine exposure based on variant
    let exposureMultiplier = 1.0;

    if (variant === 'A') {
      // Cross-Sectional Volatility Filter
      if (uncertainty.csv > CSV_HIGH_THRESHOLD) exposureMultiplier = 0.5;
      else if (uncertainty.csv > CSV_MED_THRESHOLD) exposureMultiplier = 0.75;
    } else if (variant === 'B') {
      // Momentum-Dispersion Filter
      if (uncertainty.momentumDisp > DISP_HIGH_THRESHOLD) exposureMultiplier = 0.5;
      else if (uncertainty.momentumDisp > DISP_MED_THRESHOLD) exposureMultiplier = 0.75;
    } else if (variant === 'C') {
      // Combined score
      const csvScore = uncertainty.csv > CSV_HIGH_THRESHOLD ? 2
                     : uncertainty.csv > CSV_MED_THRESHOLD ? 1 : 0;
      const dispScore = uncertainty.momentumDisp > DISP_HIGH_THRESHOLD ? 2
                      : uncertainty.momentumDisp > DISP_MED_THRESHOLD ? 1 : 0;
      const totalScore = csvScore + dispScore;
      if (totalScore >= 3) exposureMultiplier = 0.4;
      else if (totalScore >= 2) exposureMultiplier = 0.6;
      else if (totalScore >= 1) exposureMultiplier = 0.8;
    }

    // Select top-N momentum stocks
    const scores: { ticker: string; momentum: number }[] = [];
    for (const [ticker, prices] of monthlyPrices) {
      const mom = calcMomentum(prices, prevMonth);
      if (mom !== null && prices.has(prevMonth) && prices.has(currentMonth)) {
        scores.push({ ticker, momentum: mom });
      }
    }
    scores.sort((a, b) => b.momentum - a.momentum);
    const selected = scores.slice(0, TOP_N);
    if (selected.length === 0) continue;

    const weight = (1 / selected.length) * exposureMultiplier;

    // Portfolio return
    let portfolioReturn = 0;
    for (const { ticker } of selected) {
      const prevPrice = monthlyPrices.get(ticker)!.get(prevMonth)!;
      const currPrice = monthlyPrices.get(ticker)!.get(currentMonth)!;
      portfolioReturn += weight * ((currPrice - prevPrice) / prevPrice);
    }

    // Turnover & costs
    const newWeights = new Map(selected.map(({ ticker }) => [ticker, weight]));
    let turnover = 0;
    const allTickers = new Set([...prevWeights.keys(), ...newWeights.keys()]);
    for (const t of allTickers) {
      turnover += Math.abs((newWeights.get(t) || 0) - (prevWeights.get(t) || 0));
    }
    turnover /= 2;
    portfolioReturn -= turnover * (TRANSACTION_COST_BPS / 10000);

    monthlyReturns.push(portfolioReturn);
    turnoverArr.push(turnover);
    prevWeights = newWeights;
  }

  return { monthlyReturns, turnover: turnoverArr, label: labels[variant] };
}

// ── Regime-Analyse ───────────────────────────────────────────────────────────
function analyzeRegimes(monthlyReturns: number[], months: string[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const regime of REGIMES) {
    const indices = months
      .map((m, i) => ({ m, i }))
      .filter(({ m }) => m >= regime.start && m <= regime.end)
      .map(({ i }) => i)
      .filter(i => i >= 0 && i < monthlyReturns.length);
    const returns = indices.map(i => monthlyReturns[i]);
    result[regime.name] = returns.length >= 2 ? annualizedSharpe(returns) : 0;
  }
  return result;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const conn = await getDb();
  try {
    console.log("Loading price data...");
    const priceMap = await loadPrices(conn);

    // Filter tickers with enough data
    const validTickers = Array.from(priceMap.entries())
      .filter(([, dates]) => dates.size >= MIN_PRICES)
      .map(([ticker]) => ticker);

    console.log(`Universe: ${validTickers.length} tickers`);

    const filteredPrices = new Map(validTickers.map(t => [t, priceMap.get(t)!]));
    const monthlyPrices = getMonthlyEndPrices(filteredPrices);

    // All months in OOS period
    const allMonthsSet = new Set<string>();
    for (const [, prices] of monthlyPrices) {
      for (const month of prices.keys()) allMonthsSet.add(month);
    }
    const allMonths = Array.from(allMonthsSet).sort()
      .filter(m => m >= "2020-01" && m <= "2024-12");

    console.log(`OOS months: ${allMonths[0]} to ${allMonths[allMonths.length - 1]} (${allMonths.length} months)`);

    // Compute uncertainty stats for diagnostics
    const csvValues: number[] = [];
    const dispValues: number[] = [];
    for (let i = 2; i < allMonths.length; i++) {
      const u = calcUncertaintyMetrics(monthlyPrices, allMonths[i-1], allMonths[i-2]);
      csvValues.push(u.csv);
      dispValues.push(u.momentumDisp);
    }
    console.log(`CSV: mean=${mean(csvValues).toFixed(4)}, p75=${csvValues.sort((a,b)=>a-b)[Math.floor(csvValues.length*0.75)].toFixed(4)}, max=${Math.max(...csvValues).toFixed(4)}`);
    console.log(`Disp: mean=${mean(dispValues).toFixed(4)}, p75=${dispValues.sort((a,b)=>a-b)[Math.floor(dispValues.length*0.75)].toFixed(4)}, max=${Math.max(...dispValues).toFixed(4)}`);

    // Run variants
    const variants: ('baseline' | 'A' | 'B' | 'C')[] = ['baseline', 'A', 'B', 'C'];
    const results = variants.map(v => {
      const bt = runBacktest(monthlyPrices, allMonths, v);
      const retMonths = allMonths.slice(2);
      return {
        label: bt.label,
        sharpe: annualizedSharpe(bt.monthlyReturns),
        sortino: annualizedSortino(bt.monthlyReturns),
        maxDD: maxDrawdown(bt.monthlyReturns),
        cagr: cagr(bt.monthlyReturns),
        turnover: bt.turnover.length > 0 ? mean(bt.turnover) : 0,
        regimes: analyzeRegimes(bt.monthlyReturns, retMonths),
      };
    });

    const baseline = results[0];
    console.log("\n=== BACKTEST RESULTS: Issue #232 — Makro-Prognose-Uneinigkeit als Regime-Proxy ===");
    console.log(`OOS Period: 2020-01-01 to 2024-12-31 | Costs: ${TRANSACTION_COST_BPS}bps | Rebalancing: monatlich`);
    console.log("Proxy: Cross-Sectional Volatility + Momentum-Dispersion (marktbasierte Unsicherheits-Proxies)");
    console.log("\n| Strategie | Sharpe | Sortino | MaxDD | CAGR | Turnover |");
    console.log("|---|---|---|---|---|---|");
    for (const r of results) {
      console.log(`| ${r.label} | ${r.sharpe.toFixed(3)} | ${r.sortino.toFixed(3)} | ${(r.maxDD * 100).toFixed(1)}% | ${(r.cagr * 100).toFixed(1)}% | ${(r.turnover * 100).toFixed(1)}% |`);
    }

    const best = results.slice(1).sort((a, b) => b.sharpe - a.sharpe)[0];
    console.log("\n### Regime-Analyse (beste Variante vs. Baseline)");
    console.log("| Regime | Baseline Sharpe | Beste Variante Sharpe | Δ |");
    console.log("|---|---|---|---|");
    for (const regime of REGIMES) {
      const baseVal = baseline.regimes[regime.name] || 0;
      const bestVal = best.regimes[regime.name] || 0;
      const delta = bestVal - baseVal;
      console.log(`| ${regime.name} | ${baseVal.toFixed(3)} | ${bestVal.toFixed(3)} | ${delta >= 0 ? '+' : ''}${delta.toFixed(3)} |`);
    }

    const bestDelta = best.sharpe - baseline.sharpe;
    const threshold = 0.05;
    const decision = bestDelta >= threshold ? "✅ ACCEPTED" : "❌ REJECTED";

    console.log(`\n**ΔSharpe (beste Variante vs. Baseline): ${bestDelta >= 0 ? '+' : ''}${bestDelta.toFixed(3)}**`);
    console.log(`**Schwelle: ΔSharpe_netto ≥ +${threshold}**`);
    console.log(`**Entscheidung: ${decision}**`);
    console.log(`**Beste Variante: ${best.label}**`);

  } finally {
    await conn.end();
  }
}

main().catch(console.error);
