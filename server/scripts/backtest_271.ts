/**
 * backtest_271.ts
 *
 * Research Issue #271: "The AI Investment Race — KI-Capex als Regime-Indikator"
 * Source: BIS Working Paper No. 1367 (Rungcharoenkitkul, Juli 2026)
 *
 * Hypothese: Ein Scoring-Malus für Titel mit hoher KI-Infrastruktur-Exposition
 * (NVDA, MSFT, GOOGL/GOOG, META, AMD) in Phasen hoher KI-Sektor-Volatilität
 * verbessert das Risiko-adjustierte Rendite des Portfolios.
 *
 * Da historische Hyperscaler-Capex-Daten (Quartalsberichte) nicht als Zeitreihe
 * in der DB vorliegen, verwenden wir einen marktbasierten Proxy:
 * - KI-Sektor-Volatilität: Relative Volatilität von NVDA vs. SPY (30-Tage-Fenster)
 * - Wenn NVDA-Volatilität > 2× SPY-Volatilität → KI-Boom-Stress-Regime
 * - In diesem Regime: Scoring-Malus für KI-exponierte Titel
 *
 * Varianten:
 * A) Kein Malus (Baseline)
 * B) Malus -20% Gewichtung für KI-Titel in Stress-Regime
 * C) Malus -40% Gewichtung für KI-Titel in Stress-Regime
 * D) Vollständiger Ausschluss von KI-Titeln in Stress-Regime
 *
 * OOS-Fenster: 2020-01-01 bis 2024-12-31
 * Universe: alle Tickers mit ≥300 Preisen in DB
 * Kosten: 10 bps pro Trade
 * Rebalancing: monatlich
 * Schwelle: ΔSharpe_netto ≥ +0.05 (Issue-Schwelle)
 *
 * Look-Ahead-Bias-Ausschluss:
 * - Volatilität aus Preisdaten des Vormonats berechnet
 * - Kein Forward-Fill über Monatsgrenzen
 * - Momentum: 12-1 Monats-Momentum (Skip-Month)
 */

import * as dotenv from "dotenv";
dotenv.config();

import mysql from "mysql2/promise";

// ── Konfiguration ────────────────────────────────────────────────────────────
const OOS_START = new Date("2020-01-01");
const OOS_END   = new Date("2024-12-31");
const TRANSACTION_COST_BPS = 10;
const TOP_N = 20;
const MIN_PRICES = 300;

// KI-exponierte Titel (aus BIS Paper: Hyperscaler + Chipmaker)
const KI_EXPOSED_TICKERS = new Set([
  'NVDA', 'NVDA.US',
  'MSFT', 'MSFT.US',
  'GOOGL', 'GOOGL.US', 'GOOG', 'GOOG.US',
  'META', 'META.US',
  'AMD', 'AMD.US',
  'AMZN', 'AMZN.US',
  'ORCL', 'ORCL.US',
]);

// Volatilitäts-Schwelle: NVDA-Vol / SPY-Vol > threshold → Stress-Regime
const VOL_STRESS_THRESHOLD = 2.0;

// Regime-Perioden
const REGIMES = [
  { name: "crisis_2020q1",      start: "2020-01", end: "2020-03" },
  { name: "bull_2020_recovery", start: "2020-04", end: "2020-12" },
  { name: "bull_2021",          start: "2021-01", end: "2021-12" },
  { name: "bear_2022",          start: "2022-01", end: "2022-12" },
  { name: "bull_2023",          start: "2023-01", end: "2023-12" },
  { name: "bull_2024",          start: "2024-01", end: "2024-12" },
];

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
  // Load slightly more data for volatility calculation (need 30 days before OOS start)
  const extStart = new Date("2019-10-01");
  const [rows] = await conn.execute(
    `SELECT ticker, date, COALESCE(adjustedClose, close) as price
     FROM historical_prices
     WHERE date >= ? AND date <= ?
     ORDER BY ticker, date`,
    [extStart.toISOString().slice(0, 10), OOS_END.toISOString().slice(0, 10)]
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

// ── Tägliche Returns für Volatilitätsberechnung ───────────────────────────────
function getDailyReturns(priceMap: Map<string, Map<string, number>>, ticker: string): Map<string, number> {
  const prices = priceMap.get(ticker);
  if (!prices) return new Map();
  const sorted = Array.from(prices.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const returns = new Map<string, number>();
  for (let i = 1; i < sorted.length; i++) {
    const ret = (sorted[i][1] - sorted[i-1][1]) / sorted[i-1][1];
    returns.set(sorted[i][0], ret);
  }
  return returns;
}

// ── KI-Stress-Regime berechnen ───────────────────────────────────────────────
function calcKiStressRegime(
  priceMap: Map<string, Map<string, number>>,
  month: string
): boolean {
  // Use NVDA vs SPY daily volatility ratio for the previous month
  const nvdaReturns = getDailyReturns(priceMap, 'NVDA.US') || getDailyReturns(priceMap, 'NVDA');
  const spyReturns  = getDailyReturns(priceMap, 'SPY.US')  || getDailyReturns(priceMap, 'SPY');

  if (nvdaReturns.size === 0 || spyReturns.size === 0) return false;

  // Get previous month's daily returns
  const prevMonth = month <= "2020-01" ? "2019-12" : 
    new Date(month + "-01").toISOString().slice(0, 7);
  
  // Actually compute previous month properly
  const [year, mon] = month.split('-').map(Number);
  const prevDate = new Date(year, mon - 2, 1);
  const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

  const nvdaMonthReturns: number[] = [];
  const spyMonthReturns: number[] = [];

  for (const [date, ret] of nvdaReturns) {
    if (date.startsWith(prevMonthStr)) nvdaMonthReturns.push(ret);
  }
  for (const [date, ret] of spyReturns) {
    if (date.startsWith(prevMonthStr)) spyMonthReturns.push(ret);
  }

  if (nvdaMonthReturns.length < 10 || spyMonthReturns.length < 10) return false;

  const nvdaVol = std(nvdaMonthReturns);
  const spyVol  = std(spyMonthReturns);

  if (spyVol === 0) return false;
  return (nvdaVol / spyVol) > VOL_STRESS_THRESHOLD;
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

// ── Backtest-Kern ────────────────────────────────────────────────────────────
function runBacktest(
  monthlyPrices: Map<string, Map<string, number>>,
  priceMap: Map<string, Map<string, number>>,
  allMonths: string[],
  variant: 'baseline' | 'B' | 'C' | 'D',
  malusMultiplier: number  // 1.0=no malus, 0.8=-20%, 0.6=-40%, 0.0=exclude
): { monthlyReturns: number[]; turnover: number[]; stressMonths: number } {
  const monthlyReturns: number[] = [];
  const turnoverArr: number[] = [];
  let prevWeights = new Map<string, number>();
  let stressMonths = 0;

  for (let i = 1; i < allMonths.length; i++) {
    const prevMonth    = allMonths[i - 1];
    const currentMonth = allMonths[i];

    // Look-ahead-free: compute stress from previous month's data
    const isStress = variant !== 'baseline' && calcKiStressRegime(priceMap, currentMonth);
    if (isStress) stressMonths++;

    // Select top-N momentum stocks
    const scores: { ticker: string; momentum: number; isKi: boolean }[] = [];
    for (const [ticker, prices] of monthlyPrices) {
      const mom = calcMomentum(prices, prevMonth);
      if (mom !== null && prices.has(prevMonth) && prices.has(currentMonth)) {
        scores.push({ ticker, momentum: mom, isKi: KI_EXPOSED_TICKERS.has(ticker) });
      }
    }
    scores.sort((a, b) => b.momentum - a.momentum);
    const selected = scores.slice(0, TOP_N);
    if (selected.length === 0) continue;

    // Apply KI malus in stress regime
    const baseWeight = 1 / selected.length;
    const weights = new Map<string, number>();
    let totalWeight = 0;

    for (const { ticker, isKi } of selected) {
      const w = (isStress && isKi) ? baseWeight * malusMultiplier : baseWeight;
      weights.set(ticker, w);
      totalWeight += w;
    }

    // Normalize weights
    if (totalWeight === 0) continue;
    for (const [t, w] of weights) weights.set(t, w / totalWeight);

    // Portfolio return
    let portfolioReturn = 0;
    for (const { ticker } of selected) {
      const w = weights.get(ticker) || 0;
      if (w === 0) continue;
      const prevPrice = monthlyPrices.get(ticker)!.get(prevMonth)!;
      const currPrice = monthlyPrices.get(ticker)!.get(currentMonth)!;
      portfolioReturn += w * ((currPrice - prevPrice) / prevPrice);
    }

    // Turnover & costs
    let turnover = 0;
    const allTickers = new Set([...prevWeights.keys(), ...weights.keys()]);
    for (const t of allTickers) {
      turnover += Math.abs((weights.get(t) || 0) - (prevWeights.get(t) || 0));
    }
    turnover /= 2;
    portfolioReturn -= turnover * (TRANSACTION_COST_BPS / 10000);

    monthlyReturns.push(portfolioReturn);
    turnoverArr.push(turnover);
    prevWeights = weights;
  }

  return { monthlyReturns, turnover: turnoverArr, stressMonths };
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

    // Filter tickers with enough data in OOS period
    const validTickers = Array.from(priceMap.entries())
      .filter(([, dates]) => {
        const oosDates = Array.from(dates.keys()).filter(d => d >= "2020-01-01" && d <= "2024-12-31");
        return oosDates.length >= MIN_PRICES;
      })
      .map(([ticker]) => ticker);

    console.log(`Universe: ${validTickers.length} tickers`);

    // Check KI tickers available
    const kiAvailable = validTickers.filter(t => KI_EXPOSED_TICKERS.has(t));
    console.log(`KI-exposed tickers in universe: ${kiAvailable.join(', ')}`);

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

    // Run variants
    const variantConfigs: { name: string; variant: 'baseline' | 'B' | 'C' | 'D'; malus: number }[] = [
      { name: 'Baseline (kein Malus)', variant: 'baseline', malus: 1.0 },
      { name: 'Variante B (-20% KI in Stress)', variant: 'B', malus: 0.8 },
      { name: 'Variante C (-40% KI in Stress)', variant: 'C', malus: 0.6 },
      { name: 'Variante D (KI-Ausschluss in Stress)', variant: 'D', malus: 0.0 },
    ];

    const results = variantConfigs.map(cfg => {
      const bt = runBacktest(monthlyPrices, priceMap, allMonths, cfg.variant, cfg.malus);
      const retMonths = allMonths.slice(1);
      return {
        label: cfg.name,
        sharpe: annualizedSharpe(bt.monthlyReturns),
        sortino: annualizedSortino(bt.monthlyReturns),
        maxDD: maxDrawdown(bt.monthlyReturns),
        cagr: cagr(bt.monthlyReturns),
        turnover: bt.turnover.length > 0 ? mean(bt.turnover) : 0,
        stressMonths: bt.stressMonths,
        regimes: analyzeRegimes(bt.monthlyReturns, retMonths),
      };
    });

    const baseline = results[0];
    console.log("\n=== BACKTEST RESULTS: Issue #271 — KI-Capex Regime-Indikator ===");
    console.log(`OOS Period: 2020-01-01 to 2024-12-31 | Costs: ${TRANSACTION_COST_BPS}bps | Rebalancing: monatlich`);
    console.log(`Proxy: NVDA/SPY Volatilitäts-Ratio (Schwelle: ${VOL_STRESS_THRESHOLD}×)`);
    console.log("\n| Strategie | Sharpe | Sortino | MaxDD | CAGR | Turnover | Stress-Monate |");
    console.log("|---|---|---|---|---|---|---|");
    for (const r of results) {
      console.log(`| ${r.label} | ${r.sharpe.toFixed(3)} | ${r.sortino.toFixed(3)} | ${(r.maxDD * 100).toFixed(1)}% | ${(r.cagr * 100).toFixed(1)}% | ${(r.turnover * 100).toFixed(1)}% | ${r.stressMonths} |`);
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
    console.log(`**Stress-Monate aktiviert: ${best.stressMonths} von ${allMonths.length - 1}**`);

  } finally {
    await conn.end();
  }
}

main().catch(console.error);
