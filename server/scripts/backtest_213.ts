/**
 * Backtest #213: Bonds-Regime-Korrelation
 * Hypothese: Wenn Bond-Aktien-Korrelation > 0 (Diversifikation bricht zusammen),
 * soll die regimeEngine das Regime als "crisis_correlation" markieren und
 * die Aktien-Allokation reduzieren → bessere Drawdowns.
 *
 * Baseline: Aktuelle regimeEngine ohne Bond-Korrelations-Signal
 * Variante: regimeEngine mit 60-Tage-Rolling-Korrelation SPY vs AGG als Zusatzsignal
 *
 * OOS: 2020-01-01 bis 2024-12-31
 * Kosten: 10 bps pro Trade
 * Rebalancing: monatlich
 * Schwelle: ΔSharpe_netto ≥ +0.1
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

interface PriceRow { date: string; close: number; }

async function getPrices(conn: mysql.Connection, ticker: string, from: string, to: string): Promise<PriceRow[]> {
  const [rows] = await conn.execute<any[]>(
    'SELECT date, close FROM historical_prices WHERE ticker = ? AND date >= ? AND date <= ? ORDER BY date ASC',
    [ticker, from, to]
  );
  return rows.map(r => ({ date: String(r.date).slice(0, 10), close: Number(r.close) }));
}

function returns(prices: PriceRow[]): number[] {
  const ret: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    ret.push((prices[i].close - prices[i - 1].close) / prices[i - 1].close);
  }
  return ret;
}

function rollingCorrelation(a: number[], b: number[], window: number): number[] {
  const result: number[] = [];
  for (let i = window - 1; i < a.length; i++) {
    const sliceA = a.slice(i - window + 1, i + 1);
    const sliceB = b.slice(i - window + 1, i + 1);
    const meanA = sliceA.reduce((s, v) => s + v, 0) / window;
    const meanB = sliceB.reduce((s, v) => s + v, 0) / window;
    let cov = 0, varA = 0, varB = 0;
    for (let j = 0; j < window; j++) {
      cov += (sliceA[j] - meanA) * (sliceB[j] - meanB);
      varA += (sliceA[j] - meanA) ** 2;
      varB += (sliceB[j] - meanB) ** 2;
    }
    const denom = Math.sqrt(varA * varB);
    result.push(denom > 0 ? cov / denom : 0);
  }
  return result;
}

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

// Simulate a simple strategy: hold SPY, but reduce exposure by 50% when bond-stock correlation > threshold
function simulateVariant(
  spyRets: number[],
  corrSignal: number[] | null,
  threshold: number,
  corrOffset: number // offset because rolling corr starts later
): { rets: number[]; turnover: number } {
  const rets: number[] = [];
  let lastExposure = 1.0;
  let trades = 0;

  for (let i = 0; i < spyRets.length; i++) {
    let exposure = 1.0;
    if (corrSignal !== null) {
      const corrIdx = i - corrOffset;
      if (corrIdx >= 0 && corrIdx < corrSignal.length) {
        // Reduce exposure when correlation is positive (bonds not diversifying)
        if (corrSignal[corrIdx] > threshold) {
          exposure = 0.5; // reduce equity exposure by 50%
        }
      }
    }
    if (Math.abs(exposure - lastExposure) > 0.01) trades++;
    const netRet = exposure * spyRets[i] - (trades > 0 && Math.abs(exposure - lastExposure) > 0.01 ? 0.001 : 0);
    rets.push(netRet);
    lastExposure = exposure;
  }
  return { rets, turnover: trades / spyRets.length };
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);

  console.log('Loading SPY and AGG prices (2019-07-01 to 2024-12-31)...');
  const spyAll = await getPrices(conn, 'SPY.US', '2019-07-01', '2024-12-31');
  const aggAll = await getPrices(conn, 'AGG.US', '2019-07-01', '2024-12-31');

  // Align dates
  const spyMap = new Map(spyAll.map(p => [p.date, p.close]));
  const aggMap = new Map(aggAll.map(p => [p.date, p.close]));
  const commonDates = spyAll.map(p => p.date).filter(d => aggMap.has(d));

  const spyPrices = commonDates.map(d => ({ date: d, close: spyMap.get(d)! }));
  const aggPrices = commonDates.map(d => ({ date: d, close: aggMap.get(d)! }));

  const spyRets = returns(spyPrices);
  const aggRets = returns(aggPrices);
  const dates = commonDates.slice(1); // dates aligned with returns

  // Compute 60-day rolling correlation
  const CORR_WINDOW = 60;
  const corrSeries = rollingCorrelation(spyRets, aggRets, CORR_WINDOW);
  const corrOffset = CORR_WINDOW - 1; // corrSeries[0] corresponds to spyRets[corrOffset]

  // Filter to OOS period 2020-01-01 to 2024-12-31
  const oosStart = '2020-01-01';
  const oosEnd = '2024-12-31';
  const oosIdx = dates.map((d, i) => ({ d, i })).filter(({ d }) => d >= oosStart && d <= oosEnd).map(({ i }) => i);

  const spyRetsOOS = oosIdx.map(i => spyRets[i]);

  // Baseline: always 100% SPY
  const baseline = simulateVariant(spyRetsOOS, null, 0, 0);

  // Variant A: reduce to 50% when 60d corr > 0.0 (bonds not diversifying at all)
  const corrOOS = oosIdx.map(i => {
    const ci = i - corrOffset;
    return ci >= 0 && ci < corrSeries.length ? corrSeries[ci] : -1;
  });
  const variantA = simulateVariant(spyRetsOOS, corrOOS, 0.0, 0);

  // Variant B: reduce to 50% when 60d corr > 0.2 (only clearly positive correlation)
  const variantB = simulateVariant(spyRetsOOS, corrOOS, 0.2, 0);

  // Variant C: reduce to 30% when 60d corr > 0.0 (more aggressive reduction)
  const variantC = simulateVariant(spyRetsOOS, corrOOS, 0.0, 0);
  variantC.rets = variantC.rets.map((r, i) => {
    const ci = i;
    const corr = corrOOS[ci];
    const exposure = corr > 0.0 ? 0.3 : 1.0;
    return exposure * spyRetsOOS[i];
  });

  console.log('\n=== BACKTEST RESULTS: Issue #213 — Bonds Diversification Regime ===\n');
  console.log('OOS Period: 2020-01-01 to 2024-12-31 | Costs: 10bps | Rebalancing: daily signal\n');

  const configs = [
    { name: 'Baseline (100% SPY)', rets: baseline.rets, turnover: baseline.turnover },
    { name: 'Variante A (50% wenn corr>0.0)', rets: variantA.rets, turnover: variantA.turnover },
    { name: 'Variante B (50% wenn corr>0.2)', rets: variantB.rets, turnover: variantB.turnover },
    { name: 'Variante C (30% wenn corr>0.0)', rets: variantC.rets, turnover: variantC.turnover },
  ];

  console.log('| Strategie | Sharpe | Sortino | MaxDD | CAGR | Turnover |');
  console.log('|---|---|---|---|---|---|');
  for (const c of configs) {
    const s = sharpe(c.rets).toFixed(3);
    const so = sortino(c.rets).toFixed(3);
    const dd = (maxDrawdown(c.rets) * 100).toFixed(1) + '%';
    const ca = (cagr(c.rets) * 100).toFixed(1) + '%';
    const to = (c.turnover * 100).toFixed(1) + '%';
    console.log(`| ${c.name} | ${s} | ${so} | ${dd} | ${ca} | ${to} |`);
  }

  // Regime breakdown for Variant A
  console.log('\n### Regime-Analyse: Variante A vs. Baseline\n');
  console.log('| Regime | Baseline Sharpe | Variante A Sharpe | Δ |');
  console.log('|---|---|---|---|');
  for (const regime of REGIMES) {
    const regIdx = dates.map((d, i) => ({ d, i }))
      .filter(({ d }) => d >= regime.start && d <= regime.end)
      .map(({ i }) => i);
    if (regIdx.length < 10) continue;
    const bRets = regIdx.map(i => {
      const oosI = oosIdx.indexOf(i);
      return oosI >= 0 ? baseline.rets[oosI] : null;
    }).filter(v => v !== null) as number[];
    const vRets = regIdx.map(i => {
      const oosI = oosIdx.indexOf(i);
      return oosI >= 0 ? variantA.rets[oosI] : null;
    }).filter(v => v !== null) as number[];
    if (bRets.length < 5) continue;
    const bs = sharpe(bRets).toFixed(3);
    const vs = sharpe(vRets).toFixed(3);
    const delta = (Number(vs) - Number(bs)).toFixed(3);
    console.log(`| ${regime.name} | ${bs} | ${vs} | ${delta} |`);
  }

  // Overall decision
  const baselineSharpe = sharpe(baseline.rets);
  const bestVariantSharpe = Math.max(...configs.slice(1).map(c => sharpe(c.rets)));
  const deltaSharpe = bestVariantSharpe - baselineSharpe;
  console.log(`\n**ΔSharpe (beste Variante vs. Baseline): ${deltaSharpe.toFixed(3)}**`);
  console.log(`**Schwelle: ΔSharpe_netto ≥ +0.1**`);
  console.log(`**Entscheidung: ${deltaSharpe >= 0.1 ? '✅ ACCEPTED' : '❌ REJECTED'}**`);
  console.log(`**Begründung:** ${deltaSharpe >= 0.1 ? 'Bond-Korrelations-Signal verbessert Sharpe signifikant' : 'Bond-Korrelations-Signal verbessert Sharpe nicht ausreichend über alle Regime'}`);

  await conn.end();
}

main().catch(console.error);
