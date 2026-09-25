import { and, gte, inArray, lte } from "drizzle-orm";
import { historicalPrices } from "../drizzle/schema";
import { getDb } from "../server/db";
import { getEodhdApiKey } from "../server/_core/env";
import { toEodhdSymbol } from "../server/lib/eodhdSymbol";

const TICKERS = ["GOOGL", "ISRG", "JNJ", "NVDA", "PLTR", "TSLA", "TSM"];
const FROM = "2021-09-18";
const TO = "2026-09-25";
const BATCH_SIZE = 300;

type EodhdRow = {
  date?: string;
  close?: number;
  adjusted_close?: number;
};

type Result = {
  ticker: string;
  eodhdTicker: string;
  fetched: number;
  alreadyPresent: number;
  inserted: number;
  error?: string;
};

async function fetchEodHistory(ticker: string, apiKey: string): Promise<EodhdRow[]> {
  const response = await fetch(
    `https://eodhd.com/api/eod/${toEodhdSymbol(ticker)}?api_token=${apiKey}&fmt=json&from=${FROM}&to=${TO}`,
    { signal: AbortSignal.timeout(60_000) },
  );
  if (!response.ok) throw new Error(`EODHD HTTP ${response.status}`);
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new Error("EODHD returned no price array");
  return payload as EodhdRow[];
}

async function main(): Promise<void> {
  const db = await getDb();
  const apiKey = await getEodhdApiKey();
  if (!db) throw new Error("Database unavailable");
  if (!apiKey) throw new Error("EODHD API key unavailable");

  const results: Result[] = [];
  for (const ticker of TICKERS) {
    const eodhdTicker = toEodhdSymbol(ticker);
    try {
      const [rows, existing] = await Promise.all([
        fetchEodHistory(ticker, apiKey),
        db.select({ date: historicalPrices.date })
          .from(historicalPrices)
          .where(and(
            inArray(historicalPrices.ticker, [ticker]),
            gte(historicalPrices.date, FROM),
            lte(historicalPrices.date, TO),
          )),
      ]);
      const existingDates = new Set(existing.map((row) => row.date));
      const missing = rows
        .filter((row) => typeof row.date === "string" && Number.isFinite(row.close) && (row.close ?? 0) > 0 && !existingDates.has(row.date))
        .map((row) => ({
          ticker,
          date: row.date!,
          close: String(row.close),
          adjustedClose: Number.isFinite(row.adjusted_close) ? String(row.adjusted_close) : null,
          source: "eodhd",
        }));

      for (let index = 0; index < missing.length; index += BATCH_SIZE) {
        // The rows are prefiltered against the unique (ticker, date) key.
        // Deliberately no upsert: this run inserts missing history only.
        await db.insert(historicalPrices).values(missing.slice(index, index + BATCH_SIZE));
      }
      results.push({ ticker, eodhdTicker, fetched: rows.length, alreadyPresent: existingDates.size, inserted: missing.length });
    } catch (error) {
      results.push({
        ticker,
        eodhdTicker,
        fetched: 0,
        alreadyPresent: 0,
        inserted: 0,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 350));
  }

  console.log(JSON.stringify({ from: FROM, to: TO, mode: "insert_missing_only", results }, null, 2));
  if (results.some((result) => result.error)) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => process.exit());
