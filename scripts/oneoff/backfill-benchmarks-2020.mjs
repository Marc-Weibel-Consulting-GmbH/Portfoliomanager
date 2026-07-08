/**
 * Backfill benchmark proxy tickers (ACWI.US, CHSPI.SW, SPY.US) from 2020-01-01 to today.
 * Also updates the benchmarkData table with the full history.
 * Run: node scripts/oneoff/backfill-benchmarks-2020.mjs [--apply]
 */
import { createConnection } from "mysql2/promise";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../../.env") });

const EODHD_API_KEY = process.env.EODHD_API_KEY;
const DATABASE_URL = process.env.DATABASE_URL;
const DRY_RUN = !process.argv.includes("--apply");

if (!EODHD_API_KEY) throw new Error("EODHD_API_KEY not set");
if (!DATABASE_URL) throw new Error("DATABASE_URL not set");

const BENCHMARK_TICKERS = [
  { ticker: "ACWI.US",  benchmarkKey: "MSCI_WORLD", label: "MSCI World ETF (ACWI)" },
  { ticker: "CHSPI.SW", benchmarkKey: "SMI",         label: "Swiss Performance Index (CHSPI)" },
  { ticker: "SPY.US",   benchmarkKey: "SP500",       label: "S&P 500 ETF (SPY)" },
];

const FROM_DATE = "2020-01-01";
const TO_DATE = new Date().toISOString().split("T")[0];

async function fetchEodhdHistory(ticker) {
  const [sym, exchange] = ticker.split(".");
  const url = `https://eodhd.com/api/eod/${sym}.${exchange}?api_token=${EODHD_API_KEY}&fmt=json&from=${FROM_DATE}&to=${TO_DATE}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`EODHD error for ${ticker}: ${res.status}`);
  return res.json();
}

async function main() {
  console.log(`\n=== Benchmark Backfill 2020-${TO_DATE} ===`);
  console.log(DRY_RUN ? "DRY RUN — pass --apply to execute\n" : "APPLYING CHANGES\n");

  const conn = await createConnection(DATABASE_URL);

  try {
    for (const { ticker, benchmarkKey, label } of BENCHMARK_TICKERS) {
      console.log(`\nFetching ${label} (${ticker})...`);
      
      let rows;
      try {
        rows = await fetchEodhdHistory(ticker);
      } catch (e) {
        console.error(`  ERROR fetching ${ticker}: ${e.message}`);
        continue;
      }

      if (!rows || rows.length === 0) {
        console.log(`  No data returned for ${ticker}`);
        continue;
      }

      console.log(`  Got ${rows.length} rows from EODHD (${rows[0].date} to ${rows[rows.length - 1].date})`);

      // Check existing data in historicalPrices
      const [existing] = await conn.execute(
        "SELECT COUNT(*) as cnt, MIN(date) as minDate, MAX(date) as maxDate FROM historicalPrices WHERE ticker = ?",
        [ticker]
      );
      console.log(`  DB has ${existing[0].cnt} rows (${existing[0].minDate} to ${existing[0].maxDate})`);

      // Filter to only new rows
      const existingDates = new Set();
      if (existing[0].cnt > 0) {
        const [dateRows] = await conn.execute(
          "SELECT date FROM historicalPrices WHERE ticker = ?",
          [ticker]
        );
        dateRows.forEach(r => existingDates.add(r.date instanceof Date ? r.date.toISOString().split("T")[0] : r.date));
      }

      const newRows = rows.filter(r => !existingDates.has(r.date));
      console.log(`  ${newRows.length} new rows to insert`);

      if (newRows.length === 0) {
        console.log(`  Already up to date!`);
      } else if (!DRY_RUN) {
        // Insert in batches of 500
        const batchSize = 500;
        let inserted = 0;
        for (let i = 0; i < newRows.length; i += batchSize) {
          const batch = newRows.slice(i, i + batchSize);
          const values = batch.map(r => [ticker, r.date, parseFloat(r.open || r.close), parseFloat(r.high || r.close), parseFloat(r.low || r.close), parseFloat(r.close), parseInt(r.volume || 0)]);
          await conn.query(
            "INSERT IGNORE INTO historicalPrices (ticker, date, open, high, low, close, volume) VALUES ?",
            [values]
          );
          inserted += batch.length;
        }
        console.log(`  Inserted ${inserted} rows into historicalPrices`);
      }

      // Update benchmarkData table
      console.log(`  Updating benchmarkData for key="${benchmarkKey}"...`);
      
      // Check existing benchmarkData
      const [existingBench] = await conn.execute(
        "SELECT COUNT(*) as cnt FROM benchmarkData WHERE benchmark = ?",
        [benchmarkKey]
      );
      console.log(`  benchmarkData has ${existingBench[0].cnt} rows for ${benchmarkKey}`);

      if (!DRY_RUN) {
        // Upsert all rows into benchmarkData
        const batchSize = 500;
        let upserted = 0;
        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
          const values = batch.map(r => [benchmarkKey, r.date, parseFloat(r.close)]);
          await conn.query(
            "INSERT INTO benchmarkData (benchmark, date, close) VALUES ? ON DUPLICATE KEY UPDATE close = VALUES(close)",
            [values]
          );
          upserted += batch.length;
        }
        console.log(`  Upserted ${upserted} rows into benchmarkData`);
      }
    }

    // Summary
    if (!DRY_RUN) {
      for (const { ticker, benchmarkKey } of BENCHMARK_TICKERS) {
        const [hp] = await conn.execute(
          "SELECT COUNT(*) as cnt, MIN(date) as minDate, MAX(date) as maxDate FROM historicalPrices WHERE ticker = ?",
          [ticker]
        );
        const [bd] = await conn.execute(
          "SELECT COUNT(*) as cnt, MIN(date) as minDate, MAX(date) as maxDate FROM benchmarkData WHERE benchmark = ?",
          [benchmarkKey]
        );
        console.log(`\n${ticker} (${benchmarkKey}):`);
        console.log(`  historicalPrices: ${hp[0].cnt} rows (${hp[0].minDate} to ${hp[0].maxDate})`);
        console.log(`  benchmarkData:    ${bd[0].cnt} rows (${bd[0].minDate} to ${bd[0].maxDate})`);
      }
    }

    console.log("\nDone!");
  } finally {
    await conn.end();
  }
}

main().catch(console.error);
