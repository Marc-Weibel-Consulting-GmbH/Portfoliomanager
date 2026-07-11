/**
 * Backfill KI-Boom Metrics History
 *
 * Fills ki_boom_metrics_history with historical data for the last 90 days.
 * - NVDA price: from historical_prices table
 * - Mag7 YTD: calculated from historical_prices for each day
 * - Static metrics: constant values (same as current STATIC_METRICS)
 * - overallZone: derived from signal values
 */

import { createConnection } from '/home/ubuntu/portfolio_analysis_website/node_modules/mysql2/promise.js';

const conn = await createConnection(process.env.DATABASE_URL);

// Static metrics (same as in kiBoomRouter.ts)
const STATIC_METRICS = {
  openAiVerlustquote: 58,
  hyperscalerCapexWachstum: 81,
  vcAnteilKI: 61,
  pilotProjektROIQuote: 5,
};

// Mag7 tickers
const MAG7 = ['NVDA', 'MSFT', 'GOOGL', 'AMZN', 'META', 'AAPL', 'TSLA'];

// Fetch all historical prices for Mag7 + NVDA from DB (last 400 days to cover YTD calc)
const since = new Date();
since.setDate(since.getDate() - 400);
const sinceStr = since.toISOString().split('T')[0];

console.log('Fetching historical prices since', sinceStr, '...');
const [allPrices] = await conn.execute(
  `SELECT ticker, date, close FROM historical_prices 
   WHERE ticker IN (${MAG7.map(() => '?').join(',')}) 
   AND date >= ?
   ORDER BY ticker, date`,
  [...MAG7, sinceStr]
);

// Group by ticker
const pricesByTicker = {};
for (const row of allPrices) {
  if (!pricesByTicker[row.ticker]) pricesByTicker[row.ticker] = {};
  pricesByTicker[row.ticker][row.date] = parseFloat(row.close);
}

console.log('Loaded price data for tickers:', Object.keys(pricesByTicker).join(', '));

// Helper: get the closest available price on or before a given date
function getPriceOnOrBefore(ticker, targetDate) {
  const prices = pricesByTicker[ticker];
  if (!prices) return null;
  const dates = Object.keys(prices).sort();
  // Find last date <= targetDate
  let result = null;
  for (const d of dates) {
    if (d <= targetDate) result = prices[d];
    else break;
  }
  return result;
}

// Helper: get year-start price (first trading day of the year)
function getYearStartPrice(ticker, year) {
  const prices = pricesByTicker[ticker];
  if (!prices) return null;
  const yearStr = String(year);
  const dates = Object.keys(prices).filter(d => d.startsWith(yearStr)).sort();
  return dates.length > 0 ? prices[dates[0]] : null;
}

// Determine zone (same logic as kiBoomRouter.ts)
function determineZone(value, warnThreshold, critThreshold, higherIsBetter) {
  if (higherIsBetter) {
    if (value >= warnThreshold) return 'gruen';
    if (value >= critThreshold) return 'gelb';
    return 'rot';
  } else {
    if (value <= warnThreshold) return 'gruen';
    if (value <= critThreshold) return 'gelb';
    return 'rot';
  }
}

function computeOverallZone(nvidiaPrice, mag7Ytd) {
  const zones = [];
  // NVDA: warn < 75, crit < 40 (higher is better)
  zones.push(determineZone(nvidiaPrice, 75, 40, true));
  // Mag7 YTD: warn > 5%, crit < -10% (higher is better)
  zones.push(determineZone(mag7Ytd, 5, -10, true));
  // Static: OpenAI Verlustquote: warn > 50%, crit > 70% (lower is better)
  zones.push(determineZone(STATIC_METRICS.openAiVerlustquote, 50, 70, false));
  // Hyperscaler CapEx: > 30% = gruen, 5-30% = gelb, < 5% = rot (higher is better)
  zones.push(determineZone(STATIC_METRICS.hyperscalerCapexWachstum, 30, 5, true));
  // VC Anteil: > 50% = gruen, > 40% = gelb, < 40% = rot (higher is better)
  zones.push(determineZone(STATIC_METRICS.vcAnteilKI, 50, 40, true));
  // Pilot ROI: > 30% = gruen, > 15% = gelb, < 15% = rot (higher is better)
  zones.push(determineZone(STATIC_METRICS.pilotProjektROIQuote, 30, 15, true));

  const critCount = zones.filter(z => z === 'rot').length;
  const warnCount = zones.filter(z => z === 'gelb').length;

  if (critCount >= 2) return { zone: 'rot', warnings: warnCount, critical: critCount };
  if (critCount >= 1) return { zone: 'gelb', warnings: warnCount, critical: critCount };
  if (warnCount >= 3) return { zone: 'gelb', warnings: warnCount, critical: critCount };
  return { zone: 'gruen', warnings: warnCount, critical: critCount };
}

// Generate dates for the last 90 days (skip today since cron already ran)
const today = new Date();
today.setHours(0, 0, 0, 0);

const dates = [];
for (let i = 90; i >= 1; i--) {
  const d = new Date(today);
  d.setDate(d.getDate() - i);
  // Skip weekends
  const dow = d.getDay();
  if (dow === 0 || dow === 6) continue;
  dates.push(d.toISOString().split('T')[0]);
}

console.log(`Will backfill ${dates.length} trading days from ${dates[0]} to ${dates[dates.length - 1]}`);

// Check existing dates to avoid duplicates
const [existing] = await conn.execute(
  "SELECT DATE(recordedAt) as d FROM ki_boom_metrics_history WHERE recordedAt < CURDATE()"
);
const existingDates = new Set(existing.map(r => {
  const d = new Date(r.d);
  return d.toISOString().split('T')[0];
}));
console.log(`Skipping ${existingDates.size} already existing dates`);

let inserted = 0;
let skipped = 0;

for (const dateStr of dates) {
  if (existingDates.has(dateStr)) {
    skipped++;
    continue;
  }

  const nvidiaPrice = getPriceOnOrBefore('NVDA', dateStr);
  if (!nvidiaPrice) {
    console.log(`  Skipping ${dateStr}: no NVDA price`);
    skipped++;
    continue;
  }

  // Calculate Mag7 YTD for this date
  const year = parseInt(dateStr.substring(0, 4));
  let totalYtd = 0;
  let count = 0;
  for (const ticker of MAG7) {
    const currentPrice = getPriceOnOrBefore(ticker, dateStr);
    const yearStartPrice = getYearStartPrice(ticker, year);
    if (currentPrice && yearStartPrice && yearStartPrice > 0) {
      const ytd = ((currentPrice - yearStartPrice) / yearStartPrice) * 100;
      totalYtd += ytd;
      count++;
    }
  }
  const mag7AvgYtd = count > 0 ? totalYtd / count : 0;

  const { zone, warnings, critical } = computeOverallZone(nvidiaPrice, mag7AvgYtd);

  // Use noon UTC for the timestamp of that day
  const recordedAt = new Date(`${dateStr}T12:00:00.000Z`);

  await conn.execute(
    `INSERT INTO ki_boom_metrics_history 
     (recordedAt, nvidiaPrice, mag7AvgYtd, openAiVerlustquote, hyperscalerCapexWachstum, vcAnteilKI, pilotProjektROIQuote, overallZone, activeWarnings, activeCritical, scenarioSanfte, scenarioCrash, scenarioBoom, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      recordedAt,
      nvidiaPrice.toFixed(2),
      mag7AvgYtd.toFixed(2),
      STATIC_METRICS.openAiVerlustquote.toFixed(2),
      STATIC_METRICS.hyperscalerCapexWachstum.toFixed(2),
      STATIC_METRICS.vcAnteilKI.toFixed(2),
      STATIC_METRICS.pilotProjektROIQuote.toFixed(2),
      zone,
      warnings,
      critical,
      30, // scenarioSanfte
      40, // scenarioCrash
      30, // scenarioBoom
    ]
  );

  console.log(`  ✓ ${dateStr}: NVDA=${nvidiaPrice.toFixed(0)}, Mag7YTD=${mag7AvgYtd.toFixed(1)}%, Zone=${zone}`);
  inserted++;
}

console.log(`\nDone! Inserted: ${inserted}, Skipped: ${skipped}`);
await conn.end();
