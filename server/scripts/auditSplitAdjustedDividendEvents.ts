import { readFile, writeFile, mkdir } from "node:fs/promises";
import { asc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { getEodhdApiKey } from "../_core/env";
import { stocks } from "../../drizzle/schema";
import { eodhdDividendResponseSchema } from "../_core/externalSchemas";
import { toEodhdSymbol } from "../lib/eodhdSymbol";
import { calculateTrailingTwelveMonthDividendYield } from "../lib/dividendYieldAnnualization";

const AS_OF_DATE = process.env.AUDIT_AS_OF_DATE ?? "2026-10-09";
const INVENTORY_PATH = `docs/audit/workings/ACTIVE_UNIVERSE_SPLIT_METRIC_INVENTORY_${AS_OF_DATE}.json`;
const OUTPUT_PATH = `docs/audit/workings/SPLIT_ADJUSTED_DIVIDEND_EVENT_AUDIT_${AS_OF_DATE}.json`;
const REQUEST_DELAY_MS = 180;

type InventoryAsset = {
  ticker: string;
  active: boolean;
  eodhdSymbol: string;
  corporateActions: Array<{ date: string; split: string; factor: number | null; kind: string }>;
};

function eventAmount(event: { value?: unknown; unadjustedValue?: unknown }, basis: "value" | "unadjustedValue"): number | null {
  const selected = Number(basis === "value" ? event.value : event.unadjustedValue);
  return Number.isFinite(selected) && selected > 0 ? selected : null;
}

async function main() {
  const [db, token, inventoryText] = await Promise.all([getDb(), getEodhdApiKey(), readFile(INVENTORY_PATH, "utf8")]);
  if (!db) throw new Error("Datenbank nicht verfügbar");
  if (!token) throw new Error("EODHD-Schlüssel nicht verfügbar");
  const inventory = JSON.parse(inventoryText) as { assets: InventoryAsset[] };
  const stockRows = await db.select({
    ticker: stocks.ticker,
    currentPrice: stocks.currentPrice,
    currency: stocks.currency,
    dividendYield: stocks.dividendYield,
    dividendAnnualAmount: stocks.dividendAnnualAmount,
    dividendYieldBasis: stocks.dividendYieldBasis,
  }).from(stocks).where(eq(stocks.isActive, 1)).orderBy(asc(stocks.ticker));
  const stockByTicker = new Map(stockRows.map((row) => [row.ticker, row]));
  const candidates = inventory.assets.filter((asset) => asset.active && asset.corporateActions.length > 0 && stockByTicker.has(asset.ticker));
  const from = new Date(`${AS_OF_DATE}T12:00:00.000Z`);
  from.setUTCDate(from.getUTCDate() - 365);
  const fromDate = from.toISOString().slice(0, 10);
  const rows: unknown[] = [];

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    const stock = stockByTicker.get(candidate.ticker)!;
    const symbol = candidate.eodhdSymbol || toEodhdSymbol(candidate.ticker);
    const response = await fetch(`https://eodhd.com/api/div/${encodeURIComponent(symbol)}?api_token=${encodeURIComponent(token)}&fmt=json&from=${fromDate}&to=${AS_OF_DATE}`);
    if (!response.ok) {
      rows.push({ ticker: candidate.ticker, eodhdSymbol: symbol, corporateActions: candidate.corporateActions, status: `HTTP ${response.status}` });
    } else {
      const payload: unknown = await response.json();
      const parsed = eodhdDividendResponseSchema.safeParse(payload);
      if (!parsed.success) {
        rows.push({ ticker: candidate.ticker, eodhdSymbol: symbol, corporateActions: candidate.corporateActions, status: "invalid dividend payload" });
      } else {
        const asEvents = (basis: "value" | "unadjustedValue") => parsed.data.map((event) => ({
          exDate: event.date,
          amount: eventAmount(event, basis),
          currency: event.currency,
          period: event.period,
        }));
        const input = {
          asOfDate: AS_OF_DATE,
          currentPrice: stock.currentPrice,
          tradingCurrency: stock.currency,
        };
        const splitAdjusted = calculateTrailingTwelveMonthDividendYield({ ...input, events: asEvents("value") });
        const declared = calculateTrailingTwelveMonthDividendYield({ ...input, events: asEvents("unadjustedValue") });
        const mismatchedEvents = parsed.data
          .map((event) => ({
            date: event.date,
            value: eventAmount(event, "value"),
            unadjustedValue: eventAmount(event, "unadjustedValue"),
            currency: event.currency,
            period: event.period,
          }))
          .filter((event) => event.value !== null && event.unadjustedValue !== null && Math.abs(event.value - event.unadjustedValue) > 1e-10);
        rows.push({
          ticker: candidate.ticker,
          eodhdSymbol: symbol,
          corporateActions: candidate.corporateActions,
          status: "ok",
          stored: {
            currentPrice: stock.currentPrice,
            dividendYield: stock.dividendYield,
            dividendAnnualAmount: stock.dividendAnnualAmount,
            dividendYieldBasis: stock.dividendYieldBasis,
          },
          eventCount: parsed.data.length,
          mismatchedEvents,
          splitAdjustedTtm: splitAdjusted,
          legacyUnadjustedTtm: declared,
          materiallyAffected: mismatchedEvents.length > 0 && splitAdjusted.dividendYieldPct !== null && declared.dividendYieldPct !== null && Math.abs(splitAdjusted.dividendYieldPct - declared.dividendYieldPct) >= 0.01,
        });
      }
    }
    if (index < candidates.length - 1) await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
  }

  const affected = rows.filter((row: any) => row.materiallyAffected);
  const report = {
    asOfDate: AS_OF_DATE,
    scope: { activeWithVerifiedCapitalAction: candidates.length, eodhdDividendRequests: candidates.length },
    summary: {
      requestFailures: rows.filter((row: any) => row.status !== "ok").length,
      withDifferentValueAndUnadjustedValue: rows.filter((row: any) => (row.mismatchedEvents?.length ?? 0) > 0).length,
      materiallyAffected: affected.length,
      materiallyAffectedTickers: affected.map((row: any) => row.ticker),
    },
    assets: rows,
  };
  await mkdir("docs/audit/workings", { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ outputPath: OUTPUT_PATH, scope: report.scope, summary: report.summary }, null, 2));
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
