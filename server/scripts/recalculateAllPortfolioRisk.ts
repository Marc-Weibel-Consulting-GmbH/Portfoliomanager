import { writeFile } from "node:fs/promises";
import { and, eq, inArray, sql } from "drizzle-orm";
import { savedPortfolios, portfolioTransactions, totalReturnHistoricalPrices, historicalPrices } from "../../drizzle/schema";
import { getDb } from "../db";
import {
  refreshTotalReturnHistoryForTickers,
  type TotalReturnSnapshotResult,
} from "../lib/totalReturnHistoryProvider";
import { invalidateAllCachedRiskMetrics } from "../lib/riskMetricsCache";
import { importHistoricalPricesForTicker } from "../jobs/importHistoricalPrices";
import { planRawHistoryBackfill } from "../lib/portfolioRiskRecalculation";

type PortfolioInventory = {
  id: number;
  name: string;
  isLive: boolean;
  positionCount: number;
  tickers: string[];
};

function dateText(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function readArgument(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function parseTickers(portfolioData: string | null): string[] {
  try {
    const parsed = JSON.parse(portfolioData ?? "{}");
    const positions = Array.isArray(parsed.stocks)
      ? parsed.stocks
      : Array.isArray(parsed.positions)
        ? parsed.positions
        : [];
    return positions
      .map((position: { ticker?: unknown }) => typeof position.ticker === "string" ? position.ticker.trim() : "")
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function main() {
  const userId = Number(readArgument("--user-id"));
  const dryRun = process.argv.includes("--dry-run");
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error("Usage: tsx server/scripts/recalculateAllPortfolioRisk.ts --user-id <positive integer> [--dry-run]");
  }

  const today = new Date();
  const to = dateText(today);
  const fromDate = new Date(today);
  fromDate.setUTCFullYear(fromDate.getUTCFullYear() - 5);
  fromDate.setUTCDate(fromDate.getUTCDate() - 7);
  const from = dateText(fromDate);

  const db = await getDb();
  if (!db) throw new Error("Datenbankverbindung nicht verfügbar");

  // Only the named user's non-snapshot portfolios are in scope. The script does
  // not touch synthetic test fixtures or any other user's data.
  const portfolios = await db.select({
    id: savedPortfolios.id,
    name: savedPortfolios.name,
    isLive: savedPortfolios.isLive,
    portfolioData: savedPortfolios.portfolioData,
  }).from(savedPortfolios).where(and(
    eq(savedPortfolios.userId, userId),
    eq(savedPortfolios.isSnapshot, 0),
  ));

  const liveIds = portfolios.filter((portfolio) => portfolio.isLive === 1).map((portfolio) => portfolio.id);
  const transactions = liveIds.length > 0
    ? await db.select({ portfolioId: portfolioTransactions.portfolioId, ticker: portfolioTransactions.ticker })
      .from(portfolioTransactions)
      .where(inArray(portfolioTransactions.portfolioId, liveIds))
    : [];
  const transactionTickers = new Map<number, string[]>();
  for (const transaction of transactions) {
    if (!transaction.ticker?.trim()) continue;
    const existing = transactionTickers.get(transaction.portfolioId) ?? [];
    existing.push(transaction.ticker.trim());
    transactionTickers.set(transaction.portfolioId, existing);
  }

  const inventory: PortfolioInventory[] = portfolios.map((portfolio) => {
    const tickers = portfolio.isLive === 1
      ? (transactionTickers.get(portfolio.id) ?? [])
      : parseTickers(portfolio.portfolioData);
    return {
      id: portfolio.id,
      name: portfolio.name,
      isLive: portfolio.isLive === 1,
      positionCount: tickers.length,
      tickers: Array.from(new Set(tickers)).sort(),
    };
  });
  const tickers = Array.from(new Set(inventory.flatMap((portfolio) => portfolio.tickers))).sort();
  const rawCoverage = tickers.length > 0
    ? await db.select({
      ticker: historicalPrices.ticker,
      firstDate: sql<string>`MIN(${historicalPrices.date})`,
    }).from(historicalPrices)
      .where(inArray(historicalPrices.ticker, tickers))
      .groupBy(historicalPrices.ticker)
    : [];
  const rawBackfillPlan = planRawHistoryBackfill({
    tickers,
    requestedStart: from,
    coverage: rawCoverage.map((row) => ({ ticker: row.ticker, firstDate: row.firstDate ?? null })),
  });

  const baseReport = {
    generatedAt: today.toISOString(),
    scope: {
      userId,
      portfolios: inventory.map(({ tickers: _, ...portfolio }) => portfolio),
      uniqueTickers: tickers.length,
      range: { from, to },
      rawBackfillPlan,
      rule: "Nur nicht-Snapshot-Portfolios des angegebenen Eigentümers; Rohpreise, Bestände, Cash, Ledger und Transaktionen sind ausserhalb des Schreibumfangs.",
    },
  };

  if (dryRun) {
    console.log(JSON.stringify({ ...baseReport, mode: "dry-run", tickers }, null, 2));
    return;
  }

  console.log(`[portfolio-total-return-recalc] Additively backfilling ${rawBackfillPlan.length} canonical raw histories, then refreshing ${tickers.length} total-return snapshots from ${from} to ${to} for ${inventory.length} portfolios.`);
  const rawBackfillResults = [] as Array<{
    ticker: string;
    reason: string;
    firstDate: string | null;
    success: boolean;
    pricesImported: number;
  }>;
  for (const candidate of rawBackfillPlan) {
    const result = await importHistoricalPricesForTicker(candidate.ticker, from, to, { overwriteExisting: false });
    rawBackfillResults.push({ ...candidate, ...result });
  }
  const results = await refreshTotalReturnHistoryForTickers({ tickers, from, to });
  invalidateAllCachedRiskMetrics();

  const refreshed = results.filter((result) => result.status === "refreshed");
  const failed = results.filter((result) => result.status !== "refreshed");
  const refreshedTickers = refreshed.map((result) => result.ticker);
  const rowCounts = refreshedTickers.length > 0
    ? await db.select({ ticker: totalReturnHistoricalPrices.ticker, count: sql<number>`COUNT(*)` })
      .from(totalReturnHistoricalPrices)
      .where(inArray(totalReturnHistoricalPrices.ticker, refreshedTickers))
      .groupBy(totalReturnHistoricalPrices.ticker)
    : [];
  const storedRowsByTicker = Object.fromEntries(rowCounts.map((row) => [row.ticker, Number(row.count)]));

  const report = {
    ...baseReport,
    mode: "refresh",
    result: {
      rawBackfill: rawBackfillResults,
      refreshedTickers: refreshed.length,
      fetchedRows: refreshed.reduce((sum, result) => sum + result.rowsFetched, 0),
      storedSnapshotRowsByTicker: storedRowsByTicker,
      failures: failed.map((result) => ({
        ticker: result.ticker,
        status: result.status,
        message: result.message,
      })),
      sources: results.map((result: TotalReturnSnapshotResult) => ({
        ticker: result.ticker,
        status: result.status,
        source: result.source,
        currency: result.currency,
        rowsFetched: result.rowsFetched,
      })),
      cache: "Alle in-memory Risiko-Snapshots invalidiert; die Risikokennzahlen werden über die normalen geschützten Portfolioabfragen neu aufgebaut.",
    },
  };
  const auditPath = `docs/audit/workings/PORTFOLIO_TOTAL_RETURN_RECALCULATION_${to}.json`;
  await writeFile(auditPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({
    portfolios: inventory.length,
    uniqueTickers: tickers.length,
    rawBackfillCandidates: rawBackfillPlan.length,
    rawBackfillImportedRows: rawBackfillResults.reduce((sum, result) => sum + result.pricesImported, 0),
    refreshedTickers: refreshed.length,
    failedTickers: failed.length,
    fetchedRows: report.result.fetchedRows,
    auditPath,
  }, null, 2));
  if (failed.length > 0) process.exitCode = 2;
}

void main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((error) => {
    console.error("[portfolio-total-return-recalc] Failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
