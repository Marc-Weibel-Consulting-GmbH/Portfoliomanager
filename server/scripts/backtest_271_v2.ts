/**
 * backtest_271_v2.ts
 *
 * Research Issue #271 — Re-Evaluation mit echten Capex-Daten
 * Quelle: BIS Working Paper No. 1367 (Rungcharoenkitkul, Juli 2026)
 *
 * Verbesserung gegenüber v1:
 * - Echter kumulativer Hyperscaler-Capex aus DB (MSFT, GOOGL, META, AMZN)
 * - Schwellenwert $200 Mrd. kumulativer Capex ab Q1 2023 (statt $2.5 Bio.)
 *   → Begründung: $2.5 Bio. wird erst ~2027 erreicht; $200 Mrd. entspricht
 *     dem Punkt, an dem das Wachstum klar exponentiell wurde (Ende 2023)
 * - Regime-Trigger: Quartal, in dem kumulativer Capex > Schwellenwert
 *
 * Varianten:
 * A) Baseline (kein Malus)
 * B) Malus -20% für KI-Titel ab Capex-Schwelle $150 Mrd.
 * C) Malus -40% für KI-Titel ab Capex-Schwelle $150 Mrd.
 * D) Malus -20% für KI-Titel ab Capex-Schwelle $200 Mrd.
 *
 * OOS: 2020-01-01 bis 2024-12-31 | Kosten: 10 bps | Rebalancing: monatlich
 * Schwelle: ΔSharpe_netto ≥ +0.05 (Issue-Schwelle)
 *
 * Look-Ahead-Bias-Ausschluss:
 * - Capex-Daten sind quartalsweise verfügbar; Regime-Trigger wird erst nach
 *   Veröffentlichung des Quartalsberichts (ca. 4-6 Wochen nach Quartalsende)
 *   aktiviert → wir verwenden den Folge-Monat nach Quartalsende
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

// ── Capex-Daten laden ────────────────────────────────────────────────────────
async function loadCapexData(conn: mysql.Connection): Promise<Map<string, number>> {
  // Load cumulative capex per quarter (sum of all companies)
  const [rows] = await conn.execute(
    `SELECT quarter, periodEndDate, SUM(capexBillionUsd) as total_bn
     FROM hyperscaler_capex
     WHERE quarter >= '2023-Q1'
     GROUP BY quarter, periodEndDate
     ORDER BY quarter`
  ) as any;

  // Build cumulative capex map: month → cumulative capex (Mrd. USD)
  // Key: 'YYYY-MM' (month after quarter end = when earnings are published)
  const capexByMonth = new Map<string, number>();
  let cumulative = 0;

  for (const row of rows) {
    cumulative += parseFloat(row.total_bn);
    // Earnings published ~6 weeks after quarter end; use month+2 for look-ahead safety
    const periodEnd = row.periodEndDate as string;
    const [year, month] = periodEnd.split('-').map(Number);
    // Add 2 months for earnings release delay
    const releaseDate = new Date(year, month + 1, 1); // month is 0-indexed, +1 = +2 months
    const releaseMonth = `${releaseDate.getFullYear()}-${String(releaseDate.getMonth() + 1).padStart(2, '0')}`;
    capexByMonth.set(releaseMonth, cumulative);
  }

  // Forward-fill: for months without new data, use last known value
  const allMonths: string[] = [];
  for (let y = 2023; y <= 2025; y++) {
    for (let m = 1; m <= 12; m++) {
      allMonths.push(`${y}-${String(m).padStart(2, '0')}`);
    }
  }

  let lastKnown = 0;
  const result = new Map<string, number>();
  for (const month of allMonths) {
    if (capexByMonth.has(month)) lastKnown = capexByMonth.get(month)!;
    result.set(month, lastKnown);
  }

  return result;
}

// ── Preis-Daten laden ────────────────────────────────────────────────────────
async function loadPrices(conn: mysql.Connection): Promise<Map<string, Map<string, number>>> {
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
  capexByMonth: Map<string, number>,
  allMonths: string[],
  capexThreshold: number,  // Mrd. USD kumulativer Capex ab Q1 2023
  malusMultiplier: number  // 1.0=no malus, 0.8=-20%, 0.6=-40%
): { monthlyReturns: number[]; turnover: number[]; stressMonths: number } {
  const monthlyReturns: number[] = [];
  const turnoverArr: number[] = [];
  let prevWeights = new Map<string, number>();
  let stressMonths = 0;

  for (let i = 1; i < allMonths.length; i++) {
    const prevMonth    = allMonths[i - 1];
    const currentMonth = allMonths[i];

    // Look-ahead-free: use capex known at start of current month
    const cumulCapex = capexByMonth.get(currentMonth) || 0;
    const isStress = malusMultiplier < 1.0 && cumulCapex >= capexThreshold;
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
    console.log("Loading capex data from DB...");
    const capexByMonth = await loadCapexData(conn);

    // Show capex timeline
    console.log("\nCapex timeline (cumulative from Q1 2023, Mrd. USD):");
    for (const [month, val] of Array.from(capexByMonth.entries()).filter(([m]) => m.endsWith('-03') || m.endsWith('-06') || m.endsWith('-09') || m.endsWith('-12'))) {
      const marker = val >= 200 ? ' ← $200 Mrd. Schwelle überschritten' : val >= 150 ? ' ← $150 Mrd. Schwelle überschritten' : '';
      console.log(`  ${month}: $${val.toFixed(1)} Mrd.${marker}`);
    }

    console.log("\nLoading price data...");
    const priceMap = await loadPrices(conn);

    const validTickers = Array.from(priceMap.entries())
      .filter(([, dates]) => {
        const oosDates = Array.from(dates.keys()).filter(d => d >= "2020-01-01" && d <= "2024-12-31");
        return oosDates.length >= MIN_PRICES;
      })
      .map(([ticker]) => ticker);

    console.log(`Universe: ${validTickers.length} tickers`);
    const kiAvailable = validTickers.filter(t => KI_EXPOSED_TICKERS.has(t));
    console.log(`KI-exposed tickers in universe: ${kiAvailable.join(', ')}`);

    const filteredPrices = new Map(validTickers.map(t => [t, priceMap.get(t)!]));
    const monthlyPrices = getMonthlyEndPrices(filteredPrices);

    const allMonthsSet = new Set<string>();
    for (const [, prices] of monthlyPrices) {
      for (const month of prices.keys()) allMonthsSet.add(month);
    }
    const allMonths = Array.from(allMonthsSet).sort()
      .filter(m => m >= "2020-01" && m <= "2024-12");

    console.log(`OOS months: ${allMonths[0]} to ${allMonths[allMonths.length - 1]} (${allMonths.length} months)`);

    // Run variants
    const variantConfigs = [
      { name: 'Baseline (kein Malus)', threshold: 9999, malus: 1.0 },
      { name: 'Variante B (-20% KI ab $150 Mrd.)', threshold: 150, malus: 0.8 },
      { name: 'Variante C (-40% KI ab $150 Mrd.)', threshold: 150, malus: 0.6 },
      { name: 'Variante D (-20% KI ab $200 Mrd.)', threshold: 200, malus: 0.8 },
    ];

    const results = variantConfigs.map(cfg => {
      const bt = runBacktest(monthlyPrices, capexByMonth, allMonths, cfg.threshold, cfg.malus);
      const retMonths = allMonths.slice(1);
      return {
        label: cfg.name,
        threshold: cfg.threshold,
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
    console.log("\n=== BACKTEST RESULTS v2: Issue #271 — KI-Capex Regime-Indikator (echte Capex-Daten) ===");
    console.log(`OOS Period: 2020-01-01 to 2024-12-31 | Costs: ${TRANSACTION_COST_BPS}bps | Rebalancing: monatlich`);
    console.log(`Indikator: Kumulativer Hyperscaler-Capex ab Q1 2023 (MSFT+GOOGL+META+AMZN)`);
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
