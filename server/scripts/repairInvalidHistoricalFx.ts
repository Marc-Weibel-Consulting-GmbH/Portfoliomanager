import { and, eq } from "drizzle-orm";
import { writeFile } from "node:fs/promises";
import { exchangeRates } from "../../drizzle/schema";
import { getDb } from "../db";
import { getEodhdApiKey } from "../_core/env";
import { isPlausibleChfFxRate } from "../lib/fxRateValidity";

type Target = {
  pair: "NOKCHF" | "JPYCHF" | "DKKCHF";
  date: string;
  action: "replace_from_eodhd" | "remove_non_trading_day";
};

const TARGETS: Target[] = [
  { pair: "NOKCHF", date: "2022-11-04", action: "replace_from_eodhd" },
  // Sunday records cannot be official EOD closes. The regular lookup correctly
  // carries forward the last prior verified trading-day rate after removal.
  { pair: "JPYCHF", date: "2026-07-12", action: "remove_non_trading_day" },
  { pair: "DKKCHF", date: "2026-07-12", action: "remove_non_trading_day" },
];

async function fetchVerifiedEodhdRate(pair: string, date: string): Promise<number> {
  const apiKey = await getEodhdApiKey();
  const url = new URL(`https://eodhd.com/api/eod/${pair}.FOREX`);
  url.searchParams.set("from", date);
  url.searchParams.set("to", date);
  url.searchParams.set("fmt", "json");
  url.searchParams.set("api_token", apiKey);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`EODHD FX ${pair}/${date}: HTTP ${response.status}`);
  const rows = await response.json() as Array<{ date?: string; close?: number | string }>;
  const close = Number(rows.find((row) => row.date === date)?.close);
  if (!Number.isFinite(close) || !isPlausibleChfFxRate(pair, close)) {
    throw new Error(`EODHD FX ${pair}/${date}: kein plausibler Tageswert`);
  }
  return close;
}

async function main(): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Datenbank nicht verfügbar");
  const dryRun = process.argv.includes("--dry-run");
  const evidence: Array<Record<string, unknown>> = [];

  for (const target of TARGETS) {
    const [existing] = await db.select().from(exchangeRates).where(and(
      eq(exchangeRates.currencyPair, target.pair),
      eq(exchangeRates.date, target.date),
    )).limit(1);
    if (!existing) continue;

    if (target.action === "remove_non_trading_day") {
      evidence.push({
        pair: target.pair,
        date: target.date,
        previousRate: existing.rate,
        action: "delete_non_trading_day_factor_outlier",
      });
      if (!dryRun) await db.delete(exchangeRates).where(eq(exchangeRates.id, existing.id));
      continue;
    }

    const verifiedRate = await fetchVerifiedEodhdRate(target.pair, target.date);
    evidence.push({
      pair: target.pair,
      date: target.date,
      previousRate: existing.rate,
      verifiedRate,
      action: "replace_with_eodhd_exact_day_close",
    });
    if (!dryRun) {
      await db.update(exchangeRates).set({ rate: verifiedRate.toFixed(6) })
        .where(eq(exchangeRates.id, existing.id));
    }
  }

  const result = {
    runAt: new Date().toISOString(),
    dryRun,
    rows: evidence,
    portfolioMutations: 0,
    transactionMutations: 0,
  };
  await writeFile(
    "/home/ubuntu/portfolio_analysis_website/audit_runs/watchlist_historical_2026-09-27/fx_outlier_repair_2026-09-28.json",
    `${JSON.stringify(result, null, 2)}\n`,
  );
  console.log(JSON.stringify(result, null, 2));
}

main().then(() => process.exit(0)).catch((error) => {
  console.error("[repairInvalidHistoricalFx]", error);
  process.exit(1);
});
