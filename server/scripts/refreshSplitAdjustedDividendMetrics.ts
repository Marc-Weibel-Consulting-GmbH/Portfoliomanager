import { mkdir, writeFile } from "node:fs/promises";
import { asc, eq, inArray } from "drizzle-orm";
import { stocks, totalReturnHistoricalPrices } from "../../drizzle/schema";
import { getDb } from "../db";
import { fetchEODHDFundamentals } from "../_core/eodhdApi";
import { resolveDividendYieldEnrichment } from "../_core/dividendYieldEnrichment";
import { refreshTotalReturnHistoryForTickers } from "../lib/totalReturnHistoryProvider";

const AS_OF_DATE = process.env.AUDIT_AS_OF_DATE ?? "2026-10-09";
const TARGETS = ["KLAC", "NOBL", "SQN.SW"] as const;
const OUTPUT_PATH = `docs/audit/workings/SPLIT_ADJUSTED_DIVIDEND_REFRESH_${AS_OF_DATE}.json`;

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Datenbank nicht verfügbar");
  const before = await db.select().from(stocks).where(inArray(stocks.ticker, [...TARGETS])).orderBy(asc(stocks.ticker));
  if (before.length !== TARGETS.length) throw new Error("Nicht alle belegten Splitdividendenziele sind im Stammdatensatz vorhanden");

  const dividendChanges: unknown[] = [];
  for (const stock of before) {
    const fundamentals = await fetchEODHDFundamentals(stock.ticker);
    const enrichment = await resolveDividendYieldEnrichment({
      ticker: stock.ticker,
      currentPrice: stock.currentPrice,
      currency: stock.currency,
      fundamentals,
      asOfDate: AS_OF_DATE,
    });
    if (enrichment.dividendYield === null || enrichment.dividendAnnualAmount === null || enrichment.dividendYieldBasis !== "ttm_gross") {
      throw new Error(`${stock.ticker}: keine verifizierte, splitbereinigte TTM-Dividendenrendite verfügbar`);
    }
    await db.update(stocks).set({
      dividendYield: enrichment.dividendYield.toFixed(4),
      dividendYieldBasis: enrichment.dividendYieldBasis,
      dividendAnnualAmount: enrichment.dividendAnnualAmount.toFixed(6),
      dividendCurrency: enrichment.dividendCurrency,
      dividendEventCount: enrichment.dividendEventCount,
      dividendAsOfDate: enrichment.dividendAsOfDate,
      dividendYieldSource: enrichment.dividendYieldSource,
      lastMetricsUpdate: new Date(),
    }).where(eq(stocks.id, stock.id));
    dividendChanges.push({
      ticker: stock.ticker,
      before: {
        dividendYield: stock.dividendYield,
        dividendAnnualAmount: stock.dividendAnnualAmount,
        dividendYieldBasis: stock.dividendYieldBasis,
      },
      after: {
        dividendYield: enrichment.dividendYield,
        dividendAnnualAmount: enrichment.dividendAnnualAmount,
        dividendYieldBasis: enrichment.dividendYieldBasis,
        dividendCurrency: enrichment.dividendCurrency,
        dividendEventCount: enrichment.dividendEventCount,
        dividendAsOfDate: enrichment.dividendAsOfDate,
        dividendYieldSource: enrichment.dividendYieldSource,
      },
    });
  }

  const totalReturnBefore = await db.select({
    ticker: totalReturnHistoricalPrices.ticker,
    date: totalReturnHistoricalPrices.date,
    adjustedClose: totalReturnHistoricalPrices.adjustedClose,
    source: totalReturnHistoricalPrices.source,
  }).from(totalReturnHistoricalPrices).where(inArray(totalReturnHistoricalPrices.ticker, [...TARGETS])).orderBy(asc(totalReturnHistoricalPrices.ticker), asc(totalReturnHistoricalPrices.date));
  const snapshotRefresh = await refreshTotalReturnHistoryForTickers({
    tickers: [...TARGETS],
    from: "2021-09-20",
    to: AS_OF_DATE,
  });
  const totalReturnAfter = await db.select({
    ticker: totalReturnHistoricalPrices.ticker,
    date: totalReturnHistoricalPrices.date,
    adjustedClose: totalReturnHistoricalPrices.adjustedClose,
    source: totalReturnHistoricalPrices.source,
  }).from(totalReturnHistoricalPrices).where(inArray(totalReturnHistoricalPrices.ticker, [...TARGETS])).orderBy(asc(totalReturnHistoricalPrices.ticker), asc(totalReturnHistoricalPrices.date));
  const selectEndpoints = (rows: typeof totalReturnAfter) => Object.fromEntries(TARGETS.map((ticker) => {
    const values = rows.filter((row) => row.ticker === ticker);
    return [ticker, {
      source: values.at(-1)?.source ?? null,
      first: values[0] ? { date: values[0].date, adjustedClose: values[0].adjustedClose } : null,
      last: values.at(-1) ? { date: values.at(-1)!.date, adjustedClose: values.at(-1)!.adjustedClose } : null,
      rows: values.length,
    }];
  }));

  const report = {
    asOfDate: AS_OF_DATE,
    scope: {
      tickers: TARGETS,
      reason: "EODHD value (heutige splitbereinigte Aktie) ersetzt unadjustedValue (historische Pre-Split-Aktie) in TTM-Dividendenrendite und Ereignis-Gesamtrendite.",
    },
    dividendChanges,
    totalReturnSnapshot: {
      before: selectEndpoints(totalReturnBefore),
      refresh: snapshotRefresh,
      after: selectEndpoints(totalReturnAfter),
    },
    exclusions: "Keine Rohhistorie, Portfolioallokation, Cash-, Ledger-, Transaktions- oder Orderdaten geändert.",
  };
  await mkdir("docs/audit/workings", { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ outputPath: OUTPUT_PATH, dividendChanges, snapshotRefresh }, null, 2));
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
