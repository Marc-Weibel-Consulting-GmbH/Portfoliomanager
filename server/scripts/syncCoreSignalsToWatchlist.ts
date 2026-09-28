import { eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { stockSignalCache, stocks } from "../../drizzle/schema";
import { activeCurated } from "../lib/stockUniverse";
import { signalFelderAusCache } from "../lib/kernsignalUebernahme";
import { projectCoreSignalDataQuality } from "../lib/coreSignalDataQuality";

/**
 * Synchronises the already-computed core signal cache to the visible watchlist
 * fields. No external request, alert, portfolio, ledger or transaction action
 * is performed. Cache rows without a released combined score become
 * `signalScore = NULL` / `signalType = NULL`, i.e. an explicit data gap.
 */
async function main(): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Datenbank nicht verfügbar");

  const universe = await db
    .select({
      id: stocks.id,
      ticker: stocks.ticker,
      dataQualityStatus: stocks.dataQualityStatus,
      dataQualityNotes: stocks.dataQualityNotes,
    })
    .from(stocks)
    .where(activeCurated());
  const tickers = universe.map((row) => row.ticker);
  const cacheRows = tickers.length
    ? await db
      .select({
        ticker: stockSignalCache.ticker,
        combinedScore: stockSignalCache.combinedScore,
        signalType: stockSignalCache.signalType,
        signalStrength: stockSignalCache.signalStrength,
        reason: stockSignalCache.reason,
      })
      .from(stockSignalCache)
      .where(inArray(stockSignalCache.ticker, tickers))
    : [];
  const cacheByTicker = new Map(cacheRows.map((row) => [row.ticker, row]));

  let released = 0;
  let blocked = 0;
  for (const stock of universe) {
    const cache = cacheByTicker.get(stock.ticker);
    const fields = signalFelderAusCache(cache);
    if (fields.signalScore === null) blocked++;
    else released++;

    const dataQuality = projectCoreSignalDataQuality({
      signalScore: fields.signalScore,
      reason: cache?.reason,
      dataQualityStatus: stock.dataQualityStatus,
      dataQualityNotes: stock.dataQualityNotes,
    });
    await db.update(stocks).set({ ...fields, ...dataQuality }).where(eq(stocks.id, stock.id));
  }

  console.log(JSON.stringify({
    operation: "sync-core-signals-to-watchlist",
    total: universe.length,
    released,
    blocked,
    alertsSent: 0,
    portfolioMutations: 0,
    transactionMutations: 0,
  }, null, 2));
}

main().then(() => process.exit(0)).catch((error) => {
  console.error("[syncCoreSignalsToWatchlist]", error);
  process.exit(1);
});
