/**
 * Backfill script: Loads 5 years of HYG and LQD price history from EODHD
 * and inserts them into ki_boom_metrics_history table.
 *
 * Run: node server/scripts/backfillCreditSpreads.mjs
 */
import mysql from 'mysql2/promise';

const EODHD_API_KEY = process.env.EODHD_API_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

if (!EODHD_API_KEY) { console.error('EODHD_API_KEY not set'); process.exit(1); }
if (!DATABASE_URL) { console.error('DATABASE_URL not set'); process.exit(1); }

async function fetchEodhd(ticker, yearsBack = 5) {
  const to = new Date().toISOString().split('T')[0];
  const from = new Date(Date.now() - yearsBack * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const url = `https://eodhd.com/api/eod/${ticker}?api_token=${EODHD_API_KEY}&from=${from}&to=${to}&fmt=json&period=d`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`EODHD ${ticker} → HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error(`Unexpected response for ${ticker}`);
  return data.map(d => ({ date: d.date, close: d.adjusted_close ?? d.close }));
}

async function main() {
  console.log('[Backfill] Fetching HYG.US and LQD.US (5 years)...');
  const [hygData, lqdData] = await Promise.all([
    fetchEodhd('HYG.US', 5),
    fetchEodhd('LQD.US', 5),
  ]);
  console.log(`[Backfill] HYG: ${hygData.length} rows, LQD: ${lqdData.length} rows`);

  const lqdMap = new Map(lqdData.map(d => [d.date, d.close]));

  // Connect to DB
  const conn = await mysql.createConnection(DATABASE_URL);
  console.log('[Backfill] Connected to DB');

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const hyg of hygData) {
    const lqdClose = lqdMap.get(hyg.date);
    if (!lqdClose) { skipped++; continue; }

    const recordedAt = hyg.date + ' 12:00:00';

    // Check if row exists for this date
    const [rows] = await conn.execute(
      'SELECT id, creditSpreadHY FROM ki_boom_metrics_history WHERE DATE(recordedAt) = ? LIMIT 1',
      [hyg.date]
    );

    if (rows.length > 0) {
      const row = rows[0];
      if (row.creditSpreadHY === null || row.creditSpreadHY === undefined) {
        // Update existing row with credit spread data
        await conn.execute(
          'UPDATE ki_boom_metrics_history SET creditSpreadHY = ?, creditSpreadIG = ? WHERE id = ?',
          [hyg.close.toFixed(4), lqdClose.toFixed(4), row.id]
        );
        updated++;
      } else {
        skipped++;
      }
    } else {
      // Insert new row with only credit spread data
      await conn.execute(
        'INSERT INTO ki_boom_metrics_history (recordedAt, creditSpreadHY, creditSpreadIG, activeWarnings, activeCritical) VALUES (?, ?, ?, 0, 0)',
        [recordedAt, hyg.close.toFixed(4), lqdClose.toFixed(4)]
      );
      inserted++;
    }

    if ((inserted + updated) % 100 === 0 && (inserted + updated) > 0) {
      console.log(`[Backfill] Progress: ${inserted} inserted, ${updated} updated, ${skipped} skipped`);
    }
  }

  await conn.end();

  console.log(`[Backfill] Done!`);
  console.log(`  Inserted: ${inserted} new rows`);
  console.log(`  Updated:  ${updated} existing rows`);
  console.log(`  Skipped:  ${skipped} rows (already had data or no LQD match)`);
  console.log(`  Date range: ${hygData[0]?.date} – ${hygData[hygData.length - 1]?.date}`);
}

main().catch(err => {
  console.error('[Backfill] Error:', err);
  process.exit(1);
});
