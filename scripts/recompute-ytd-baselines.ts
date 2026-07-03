/**
 * R-30: YTD-Baselines aus adjustierten Kursen neu ableiten (Holcim-Ausreisser).
 *
 * `stocks.ytdStartPrice` wurde historisch als ROHER Dez-31-Close fixiert
 * (cron/ytdUpdater.ts). Nach Corporate Actions (z. B. Holcim/Amrize-Spin-off
 * Juni 2025) ist der rohe Vorjahres-Close nicht mit dem heutigen currentPrice
 * vergleichbar — die YTD-Performance zeigt dann z. B. ≈ −45 % statt real positiv.
 *
 * Dieses Skript re-deriviert für ALLE Stocks:
 *   ytdStartPrice  = historicalPrices.adjustedClose (Fallback close) des
 *                    letzten Handelstags des Vorjahres
 *   ytdPerformance = (currentPrice − ytdStartPrice) / ytdStartPrice × 100
 *
 * Ticker-Varianten mit/ohne `.US`-Suffix werden wie in db-optimized.ts probiert.
 * Stocks ohne Vorjahres-Kurs in historicalPrices bleiben unangetastet (geloggt).
 *
 * Ausführung:
 *   Dry-Run (Default, ändert NICHTS):  npx tsx scripts/recompute-ytd-baselines.ts
 *   Wirklich schreiben:                npx tsx scripts/recompute-ytd-baselines.ts --apply
 */
import { getDb, getAllStocks, updateStock } from "../server/db";
import { historicalPrices } from "../drizzle/schema";
import { and, desc, eq, gte, lte } from "drizzle-orm";

const DRY_RUN = !process.argv.includes("--apply");

function num(v: string | null | undefined): number | null {
  if (v == null || v === "" || v === "NA" || v === "N/A") return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function tickerVariants(ticker: string): string[] {
  const variants = [ticker];
  if (ticker.endsWith(".US")) variants.push(ticker.slice(0, -3));
  else variants.push(`${ticker}.US`);
  return variants;
}

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("Database not available");
    process.exit(1);
  }

  console.log(`[recompute-ytd-baselines] Mode: ${DRY_RUN ? "DRY-RUN (keine Änderungen)" : "APPLY"}`);

  const prevYear = new Date().getFullYear() - 1;
  // Letzter Handelstag des Vorjahres: jüngste Zeile im Dezember-Fenster.
  const windowFrom = `${prevYear}-12-01`;
  const windowTo = `${prevYear}-12-31`;
  console.log(`[recompute-ytd-baselines] Baseline-Fenster: ${windowFrom} … ${windowTo} (adjustedClose ?? close)`);

  const stocks = await getAllStocks();
  console.log(`[recompute-ytd-baselines] ${stocks.length} Stocks geladen`);

  let updated = 0;
  let unchanged = 0;
  let noBaseline = 0;

  for (const stock of stocks) {
    if (!stock.ticker) continue;

    // Baseline: letzte Zeile ≤ 31.12. des Vorjahres (Ticker-Varianten probieren).
    let baselineRow: { date: string; close: string; adjustedClose: string | null } | undefined;
    for (const variant of tickerVariants(stock.ticker)) {
      const [row] = await db
        .select()
        .from(historicalPrices)
        .where(
          and(
            eq(historicalPrices.ticker, variant),
            gte(historicalPrices.date, windowFrom),
            lte(historicalPrices.date, windowTo)
          )
        )
        .orderBy(desc(historicalPrices.date))
        .limit(1);
      if (row) {
        baselineRow = row;
        break;
      }
    }

    if (!baselineRow) {
      noBaseline++;
      console.warn(`  ~ ${stock.ticker}: kein Vorjahres-Kurs in historicalPrices — unangetastet`);
      continue;
    }

    const baseline = num(baselineRow.adjustedClose) ?? num(baselineRow.close);
    if (baseline == null || baseline <= 0) {
      noBaseline++;
      console.warn(`  ~ ${stock.ticker}: Baseline-Zeile ${baselineRow.date} ohne verwertbaren Kurs — unangetastet`);
      continue;
    }

    const oldStart = num(stock.ytdStartPrice);
    const oldPerf = num(stock.ytdPerformance);
    const currentPrice = num(stock.currentPrice);

    const newStart = baseline.toFixed(2);
    const updates: { ytdStartPrice: string; ytdPerformance?: string } = { ytdStartPrice: newStart };

    let newPerfStr: string | null = null;
    if (currentPrice != null && currentPrice > 0) {
      newPerfStr = (((currentPrice - baseline) / baseline) * 100).toFixed(2);
      updates.ytdPerformance = newPerfStr;
    }

    const startChanged = oldStart == null || Math.abs(oldStart - baseline) > 0.005;
    const perfChanged = newPerfStr != null && (oldPerf == null || Math.abs(oldPerf - parseFloat(newPerfStr)) > 0.005);

    if (!startChanged && !perfChanged) {
      unchanged++;
      continue;
    }

    console.log(
      `  → ${stock.ticker}: ytdStartPrice ${oldStart ?? "—"} → ${newStart} ` +
      `(${baselineRow.adjustedClose != null ? "adjustedClose" : "close"} vom ${baselineRow.date}), ` +
      `ytdPerformance ${oldPerf ?? "—"} → ${newPerfStr ?? "— (kein currentPrice)"}`
    );

    if (!DRY_RUN) {
      await updateStock(stock.ticker, updates);
    }
    updated++;
  }

  console.log(
    `[recompute-ytd-baselines] Fertig: ${updated} ${DRY_RUN ? "würden geändert" : "geändert"}, ` +
    `${unchanged} unverändert, ${noBaseline} ohne Baseline`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("[recompute-ytd-baselines] Fehler:", err);
  process.exit(1);
});
