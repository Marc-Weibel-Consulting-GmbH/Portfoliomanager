import { mkdir, writeFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { stocks } from "../../drizzle/schema";

const AS_OF_DATE = process.env.AUDIT_AS_OF_DATE ?? new Date().toISOString().slice(0, 10);
const OUTPUT = `docs/audit/workings/VERIFIED_DIVIDEND_METRIC_POST_REFRESH_AUDIT_${AS_OF_DATE}.json`;
// Yields are persisted from a point-in-time quote while currentPrice may move
// intraday.  Five basis points is a deliberate materiality threshold, not a
// tolerance for quote-unit or annual-cash errors.
const MATERIAL_YIELD_DIVERGENCE_PCT_POINTS = 0.05;

function effectivePriceForDividendYield(row: typeof stocks.$inferSelect): number | null {
  const price = Number(row.currentPrice);
  if (!Number.isFinite(price) || price <= 0) return null;

  // EODHD saves native pence-denominated LSE master records as `GBp` while
  // event cash is GBP. The mixed case is material: an uppercase `GBP` record
  // is already pound-denominated (e.g. VWRL.L).
  if (row.ticker.toUpperCase().endsWith(".L") && row.currency === "GBp" && row.dividendCurrency === "GBP") {
    return price / 100;
  }
  return price;
}

async function main(): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const rows = await db.select().from(stocks).where(eq(stocks.isActive, 1));

  const checked = rows.map((row) => {
    const price = effectivePriceForDividendYield(row);
    const annual = Number(row.dividendAnnualAmount);
    const storedYield = Number(row.dividendYield);
    const expectedYieldPct = row.dividendYieldBasis === "ttm_gross" && price !== null && Number.isFinite(annual)
      ? (annual / price) * 100
      : null;
    return {
      ticker: row.ticker,
      currentPrice: row.currentPrice,
      effectivePriceForDividendYield: price,
      currency: row.currency,
      dividendYield: row.dividendYield,
      dividendYieldBasis: row.dividendYieldBasis,
      dividendAnnualAmount: row.dividendAnnualAmount,
      dividendCurrency: row.dividendCurrency,
      dividendEventCount: row.dividendEventCount,
      dividendAsOfDate: row.dividendAsOfDate,
      dividendYieldSource: row.dividendYieldSource,
      expectedYieldPct,
      divergencePctPoints: expectedYieldPct === null || !Number.isFinite(storedYield)
        ? null
        : Math.abs(storedYield - expectedYieldPct),
    };
  });

  const ttm = checked.filter((row) => row.expectedYieldPct !== null);
  const mismatches = ttm.filter((row) => (row.divergencePctPoints ?? 0) >= MATERIAL_YIELD_DIVERGENCE_PCT_POINTS);
  const basisCounts = checked.reduce<Record<string, number>>((counts, row) => {
    const basis = row.dividendYieldBasis ?? "unverified_or_missing";
    counts[basis] = (counts[basis] ?? 0) + 1;
    return counts;
  }, {});
  const report = {
    asOfDate: AS_OF_DATE,
    method: "Recomputes TTM gross yield from the stored annual cash amount and the same listing quote unit. GBp LSE master records use price / 100 only when cash events are GBP; GBP-denominated LSE records are never rescaled.",
    materialityThresholdPctPoints: MATERIAL_YIELD_DIVERGENCE_PCT_POINTS,
    activeInstrumentCount: rows.length,
    basisCounts,
    ttmChecked: ttm.length,
    ttmConsistentWithin005PctPoints: ttm.length - mismatches.length,
    ttmMismatches: mismatches,
    references: checked.filter((row) => ["AKRBP.OL", "MNG.L", "VWRL.L", "DGE.L", "AZN.L"].includes(row.ticker)),
  };

  await mkdir("docs/audit/workings", { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({
    output: OUTPUT,
    activeInstrumentCount: report.activeInstrumentCount,
    basisCounts,
    ttmChecked: report.ttmChecked,
    ttmConsistentWithin005PctPoints: report.ttmConsistentWithin005PctPoints,
    mismatchCount: mismatches.length,
  }, null, 2));
}

void main().catch((error) => {
  console.error("[verified-dividend-audit] failed", error);
  process.exit(1);
});
