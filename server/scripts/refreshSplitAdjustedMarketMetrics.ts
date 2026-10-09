import { mkdir, readFile, writeFile } from "node:fs/promises";
import { refreshSplitAdjustedMarketMetrics } from "../lib/refreshSplitAdjustedMarketMetrics";
import { refreshTotalReturnHistoryForTickers } from "../lib/totalReturnHistoryProvider";

const AS_OF_DATE = process.env.AUDIT_AS_OF_DATE ?? "2026-10-09";
const INVENTORY_PATH = `docs/audit/workings/ACTIVE_UNIVERSE_SPLIT_METRIC_INVENTORY_${AS_OF_DATE}.json`;
const OUT_DIR = "docs/audit/workings";
const OUT_PATH = `${OUT_DIR}/SPLIT_METRIC_REFRESH_${AS_OF_DATE}.json`;

type InventoryAsset = {
  ticker: string;
  active: boolean;
  corporateActions?: Array<{ date: string; split: string; kind: string }>;
};

type Inventory = { assets?: InventoryAsset[] };

async function main() {
  const inventory: Inventory = JSON.parse(await readFile(INVENTORY_PATH, "utf8"));
  const corporateActionTickers = (inventory.assets ?? [])
    .filter((asset) => asset.active && (asset.corporateActions?.length ?? 0) > 0)
    .map((asset) => asset.ticker)
    .sort();

  // First refresh only the independently evidenced corporate-action candidates.
  // The provider writes solely the two derived snapshot tables; raw historical
  // prices, portfolios, cash, ledger and transaction records are not mutated.
  const snapshotResults = process.env.SKIP_SNAPSHOT_REFRESH === "1"
    ? []
    : await refreshTotalReturnHistoryForTickers({
      tickers: corporateActionTickers,
      from: "2021-09-20",
      to: AS_OF_DATE,
    });

  // Then recalculate every instrument master on one homogeneous direct basis.
  // Unverified proxy lines and unresolved mechanical jumps receive a transparent
  // price-basis gate rather than a guessed adjustment.
  const metrics = await refreshSplitAdjustedMarketMetrics({
    asOf: new Date(`${AS_OF_DATE}T20:54:17.235Z`),
    preserveExistingCurrentPrice: process.env.PRESERVE_CURRENT_PRICE === "1",
  });
  const changed = metrics.rows.filter((row) => row.status === "updated" && JSON.stringify(row.before) !== JSON.stringify(row.after));

  const report = {
    generatedAt: new Date().toISOString(),
    asOfDate: AS_OF_DATE,
    scope: {
      corporateActionTickers,
      snapshotRefreshCount: snapshotResults.length,
      snapshotRefreshSkipped: process.env.SKIP_SNAPSHOT_REFRESH === "1",
      masterInstrumentRows: metrics.rows.length,
    },
    snapshotRefresh: snapshotResults,
    masterMetricRefresh: {
      updated: metrics.updated,
      blocked: metrics.blocked,
      skipped: metrics.skipped,
      materiallyChanged: changed.length,
      changed,
      blockedRows: metrics.rows.filter((row) => row.status === "blocked"),
      skippedRows: metrics.rows.filter((row) => row.status === "skipped"),
    },
    invariants: {
      rawHistoricalPricesMutated: false,
      portfolioMutated: false,
      cashMutated: false,
      ledgerMutated: false,
      transactionsMutated: false,
      ordersPlaced: false,
    },
  };

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    outPath: OUT_PATH,
    snapshotRefresh: snapshotResults.map((result) => ({
      ticker: result.ticker,
      status: result.status,
      source: result.source,
      priceRowsStored: result.priceRowsStored,
    })),
    masterMetricRefresh: {
      updated: metrics.updated,
      blocked: metrics.blocked,
      skipped: metrics.skipped,
      materiallyChanged: changed.length,
    },
  }, null, 2));
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
