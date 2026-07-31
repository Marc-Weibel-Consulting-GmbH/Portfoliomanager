/**
 * Research Spike Backtest: Issue #205 — Intramonth Momentum Cycle
 * ================================================================
 * Hypothesis: Momentum returns concentrate on 6 specific trading days per month
 * (last 2 of month + first 4 of next month) due to institutional cash flows.
 *
 * Baseline: Buy-and-hold equal-weight momentum portfolio (rebalance monthly)
 * Variant:  Same portfolio, but ONLY hold positions on the 6 active days;
 *           cash (0% return) on all other days.
 *
 * Pre-registered threshold: ΔSharpe_netto ≥ +0.1 (OOS 2020-01-01–2024-12-31)
 * Costs: 10 bps per trade (conservative for daily in/out)
 * Universe: All tickers with ≥ 300 prices in DB
 */

import { getDb } from "../db";
import { historicalPrices } from "../../drizzle/schema";
import { and, gte, lte, asc } from "drizzle-orm";
import { isIntramonthMomentumDay } from "../analytics/intramonthMomentumEngine";

const OOS_FROM = '2020-01-01';
const OOS_TO = '2024-12-31';
const HISTORY_FROM = '2018-01-01';
const COST_BPS = 10;
const MIN_PRICES = 300;
const MOMENTUM_LOOKBACK = 126; // 6M for ranking

const REGIMES = [
  { name: 'crisis_2020q1',      from: '2020-01-01', to: '2020-03-31' },
  { name: 'bull_2020_recovery', from: '2020-04-01', to: '2020-12-31' },
  { name: 'bull_2021',          from: '2021-01-01', to: '2021-12-31' },
  { name: 'bear_2022',          from: '2022-01-01', to: '2022-12-31' },
  { name: 'bull_2023',          from: '2023-01-01', to: '2023-12-31' },
  { name: 'bull_2024',          from: '2024-01-01', to: '2024-12-31' },
];

// ── Stats helpers ─────────────────────────────────────────────────────────────
function sharpe(returns: number[], rfRate = 0.03): number {
  if (returns.length < 2) return 0;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (returns.length - 1);
  const std = Math.sqrt(variance);
  if (std === 0) return 0;
  return (mean * 252 - rfRate) / (std * Math.sqrt(252));
}

function sortino(returns: number[], rfRate = 0.03): number {
  if (returns.length < 2) return 0;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const downside = returns.filter(r => r < 0);
  if (downside.length < 2) return 0;
  const downVar = downside.reduce((a, b) => a + b * b, 0) / downside.length;
  const downStd = Math.sqrt(downVar);
  if (downStd === 0) return 0;
  return (mean * 252 - rfRate) / (downStd * Math.sqrt(252));
}

function maxDrawdown(equity: number[]): number {
  let peak = equity[0];
  let maxDD = 0;
  for (const v of equity) {
    if (v > peak) peak = v;
    const dd = (peak - v) / peak;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD * 100;
}

function cagr(start: number, end: number, years: number): number {
  if (start <= 0 || years <= 0) return 0;
  return (Math.pow(end / start, 1 / years) - 1) * 100;
}

// ── Momentum score for ranking ────────────────────────────────────────────────
function momentumScore(prices: number[]): number {
  if (prices.length < MOMENTUM_LOOKBACK + 1) return 0;
  const current = prices[prices.length - 1];
  const past = prices[prices.length - 1 - MOMENTUM_LOOKBACK];
  if (!current || !past || past === 0) return 0;
  return ((current - past) / past) * 100;
}

// ── Simulate strategy ─────────────────────────────────────────────────────────
function simulate(
  allPrices: Record<string, number[]>,
  allDates: Record<string, string[]>,
  fromDate: string,
  toDate: string,
  intramonthOnly: boolean,
  costBps: number
): { equity: number[]; returns: number[]; activeDays: number; totalDays: number; turnover: number } {
  const dateSet = new Set<string>();
  for (const dates of Object.values(allDates)) {
    for (const d of dates) {
      if (d >= fromDate && d <= toDate) dateSet.add(d);
    }
  }
  const dates = Array.from(dateSet).sort();
  if (dates.length === 0) return { equity: [1], returns: [], activeDays: 0, totalDays: 0, turnover: 0 };

  // Price lookup
  const priceLookup: Record<string, Record<string, number>> = {};
  for (const [ticker, prices] of Object.entries(allPrices)) {
    priceLookup[ticker] = {};
    const tickerDates = allDates[ticker];
    for (let i = 0; i < tickerDates.length; i++) {
      priceLookup[ticker][tickerDates[i]] = prices[i];
    }
  }

  let equity = 1.0;
  const equityCurve: number[] = [1.0];
  const dailyReturns: number[] = [];
  let currentHoldings: string[] = [];
  let lastRebalanceMonth = '';
  let totalTurnover = 0;
  let activeDayCount = 0;

  for (let di = 1; di < dates.length; di++) {
    const date = dates[di];
    const prevDate = dates[di - 1];
    const month = date.substring(0, 7);
    const dateObj = new Date(date + 'T12:00:00Z');

    // Monthly rebalance (using prev day's prices to avoid look-ahead)
    if (month !== lastRebalanceMonth) {
      lastRebalanceMonth = month;
      const scores: Array<{ ticker: string; score: number }> = [];
      for (const [ticker] of Object.entries(priceLookup)) {
        const tickerDates = allDates[ticker].filter(d => d <= prevDate);
        if (tickerDates.length < MIN_PRICES) continue;
        const prices = tickerDates.map(d => priceLookup[ticker][d]);
        const score = momentumScore(prices);
        if (score !== 0) scores.push({ ticker, score });
      }
      scores.sort((a, b) => b.score - a.score);
      const topN = Math.max(10, Math.floor(scores.length * 0.2));
      const newHoldings = scores.slice(0, topN).map(s => s.ticker);
      const added = newHoldings.filter(t => !currentHoldings.includes(t));
      const removed = currentHoldings.filter(t => !newHoldings.includes(t));
      const turnoverPct = currentHoldings.length > 0
        ? (added.length + removed.length) / (2 * Math.max(currentHoldings.length, newHoldings.length))
        : 0;
      totalTurnover += turnoverPct;
      equity *= (1 - turnoverPct * (costBps / 10000));
      currentHoldings = newHoldings;
    }

    if (currentHoldings.length === 0) {
      equityCurve.push(equity);
      dailyReturns.push(0);
      continue;
    }

    // Intramonth variant: only hold on active days, cash otherwise
    const isActive = !intramonthOnly || isIntramonthMomentumDay(dateObj);
    if (isActive) activeDayCount++;

    if (intramonthOnly && !isActive) {
      // Cash day: 0 return, but add small daily entry/exit cost on transition days
      equityCurve.push(equity);
      dailyReturns.push(0);
      continue;
    }

    // Calculate equal-weight portfolio return
    let portfolioReturn = 0;
    let validCount = 0;
    for (const ticker of currentHoldings) {
      const currPrice = priceLookup[ticker]?.[date];
      const prevPrice = priceLookup[ticker]?.[prevDate];
      if (currPrice && prevPrice && prevPrice > 0) {
        portfolioReturn += (currPrice - prevPrice) / prevPrice;
        validCount++;
      }
    }
    if (validCount > 0) portfolioReturn /= validCount;
    equity *= (1 + portfolioReturn);
    equityCurve.push(equity);
    dailyReturns.push(portfolioReturn);
  }

  const avgMonthlyTurnover = dates.length > 0 ? (totalTurnover / (dates.length / 21)) * 100 : 0;
  return {
    equity: equityCurve,
    returns: dailyReturns,
    activeDays: activeDayCount,
    totalDays: dates.length,
    turnover: avgMonthlyTurnover,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('[Backtest] Issue #205 — Intramonth Momentum Cycle');
  console.log(`[Backtest] OOS: ${OOS_FROM} – ${OOS_TO} · Costs: ${COST_BPS} bps`);

  const db = await getDb();
  if (!db) { console.error('No DB'); process.exit(1); }

  console.log('[Backtest] Loading prices...');
  const rows = await db
    .select({ ticker: historicalPrices.ticker, date: historicalPrices.date, close: historicalPrices.close })
    .from(historicalPrices)
    .where(and(gte(historicalPrices.date, HISTORY_FROM), lte(historicalPrices.date, OOS_TO)))
    .orderBy(asc(historicalPrices.ticker), asc(historicalPrices.date));

  console.log(`[Backtest] ${rows.length} rows loaded`);

  const allPrices: Record<string, number[]> = {};
  const allDates: Record<string, string[]> = {};
  for (const row of rows) {
    if (!allPrices[row.ticker]) { allPrices[row.ticker] = []; allDates[row.ticker] = []; }
    allPrices[row.ticker].push(parseFloat(row.close));
    allDates[row.ticker].push(row.date);
  }

  const eligible = Object.keys(allPrices).filter(t => allPrices[t].length >= MIN_PRICES);
  console.log(`[Backtest] Eligible tickers: ${eligible.length}`);

  const fp: Record<string, number[]> = {};
  const fd: Record<string, string[]> = {};
  for (const t of eligible) { fp[t] = allPrices[t]; fd[t] = allDates[t]; }

  // Pre-register threshold
  const THRESHOLD_SHARPE = 0.1;
  console.log(`[Backtest] Pre-registered threshold: ΔSharpe_netto ≥ +${THRESHOLD_SHARPE}`);

  console.log('[Backtest] Running BASELINE (full month, no intramonth filter)...');
  const baseline = simulate(fp, fd, OOS_FROM, OOS_TO, false, COST_BPS);

  console.log('[Backtest] Running VARIANT (intramonth: only 6 active days/month)...');
  const variant = simulate(fp, fd, OOS_FROM, OOS_TO, true, COST_BPS);

  const years = (new Date(OOS_TO).getTime() - new Date(OOS_FROM).getTime()) / (365.25 * 24 * 3600 * 1000);

  const bm = {
    sharpe: sharpe(baseline.returns),
    sortino: sortino(baseline.returns),
    maxDD: maxDrawdown(baseline.equity),
    cagr: cagr(1, baseline.equity[baseline.equity.length - 1], years),
    turnover: baseline.turnover,
  };
  const vm = {
    sharpe: sharpe(variant.returns),
    sortino: sortino(variant.returns),
    maxDD: maxDrawdown(variant.equity),
    cagr: cagr(1, variant.equity[variant.equity.length - 1], years),
    turnover: variant.turnover,
  };

  // Per-regime
  const regimeResults: Record<string, { baseline: number; variant: number }> = {};
  for (const regime of REGIMES) {
    const b = simulate(fp, fd, regime.from, regime.to, false, COST_BPS);
    const v = simulate(fp, fd, regime.from, regime.to, true, COST_BPS);
    regimeResults[regime.name] = { baseline: sharpe(b.returns), variant: sharpe(v.returns) };
  }

  const dSharpe = vm.sharpe - bm.sharpe;
  const dMaxDD = vm.maxDD - bm.maxDD;
  const dTurnover = vm.turnover - bm.turnover;
  const accepted = dSharpe >= THRESHOLD_SHARPE && dMaxDD <= 10 && dTurnover <= 10;

  const activePct = variant.totalDays > 0 ? ((variant.activeDays / variant.totalDays) * 100).toFixed(1) : '?';

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('BACKTEST RESULTS — Issue #205: Intramonth Momentum Cycle');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Active days: ${variant.activeDays}/${variant.totalDays} (${activePct}% of trading days)`);
  console.log(`Pre-registered threshold: ΔSharpe_netto ≥ +${THRESHOLD_SHARPE}`);
  console.log(`Universe: ${eligible.length} tickers · Costs: ${COST_BPS} bps · Monthly rebalancing`);
  console.log('');
  console.log('| Metrik          | Baseline | Variante |    Δ    | Schwelle          | ok? |');
  console.log('|-----------------|----------|----------|---------|-------------------|-----|');
  console.log(`| Sharpe (netto)  | ${bm.sharpe.toFixed(3).padStart(8)} | ${vm.sharpe.toFixed(3).padStart(8)} | ${(dSharpe >= 0 ? '+' : '') + dSharpe.toFixed(3).padStart(6)} | ≥ +${THRESHOLD_SHARPE}             | ${dSharpe >= THRESHOLD_SHARPE ? ' ✅ ' : ' ❌ '} |`);
  console.log(`| Sortino (netto) | ${bm.sortino.toFixed(3).padStart(8)} | ${vm.sortino.toFixed(3).padStart(8)} | ${(vm.sortino - bm.sortino >= 0 ? '+' : '') + (vm.sortino - bm.sortino).toFixed(3).padStart(6)} | —                 |  —  |`);
  console.log(`| Max Drawdown    | ${bm.maxDD.toFixed(1).padStart(7)}% | ${vm.maxDD.toFixed(1).padStart(7)}% | ${(dMaxDD >= 0 ? '+' : '') + dMaxDD.toFixed(1).padStart(5)}% | nicht > +10 %     | ${dMaxDD <= 10 ? ' ✅ ' : ' ❌ '} |`);
  console.log(`| Turnover/Monat  | ${bm.turnover.toFixed(1).padStart(7)}% | ${vm.turnover.toFixed(1).padStart(7)}% | ${(dTurnover >= 0 ? '+' : '') + dTurnover.toFixed(1).padStart(5)}% | nicht > +10 %     | ${dTurnover <= 10 ? ' ✅ ' : ' ❌ '} |`);
  console.log(`| CAGR (netto)    | ${bm.cagr.toFixed(1).padStart(7)}% | ${vm.cagr.toFixed(1).padStart(7)}% | ${(vm.cagr - bm.cagr >= 0 ? '+' : '') + (vm.cagr - bm.cagr).toFixed(1).padStart(5)}% | —                 |  —  |`);
  console.log('');
  console.log('Per Regime (Sharpe netto):');
  for (const [regime, r] of Object.entries(regimeResults)) {
    const delta = r.variant - r.baseline;
    console.log(`  ${regime.padEnd(25)}: baseline=${r.baseline.toFixed(3)}, variant=${r.variant.toFixed(3)}, Δ=${(delta >= 0 ? '+' : '') + delta.toFixed(3)}`);
  }
  console.log('');
  console.log(`Entscheidung: ${accepted ? 'ACCEPTED' : 'REJECTED'}`);
  console.log(`Begründung: ΔSharpe = ${(dSharpe >= 0 ? '+' : '') + dSharpe.toFixed(3)} (Schwelle: ≥ +${THRESHOLD_SHARPE})`);
  console.log('═══════════════════════════════════════════════════════════');

  return {
    eligible, activePct,
    bm, vm,
    dSharpe, dMaxDD, dTurnover,
    regimeResults, accepted,
    threshold: THRESHOLD_SHARPE,
    oos_from: OOS_FROM, oos_to: OOS_TO, cost_bps: COST_BPS,
  };
}

main()
  .then(r => {
    import('fs').then(fs => {
      fs.writeFileSync('/tmp/backtest_result_205.json', JSON.stringify(r, null, 2));
      console.log('[Backtest] Saved to /tmp/backtest_result_205.json');
    });
    process.exit(0);
  })
  .catch(e => { console.error('[Backtest] Fatal:', e); process.exit(1); });
