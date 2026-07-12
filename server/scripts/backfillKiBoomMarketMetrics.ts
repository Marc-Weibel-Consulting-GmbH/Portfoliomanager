/**
 * Backfill script: Computes historical SOX, ARKK, NVDA P/E, VIX values
 * for the last 90 trading days and upserts them into ki_boom_metrics_history.
 *
 * Run: npx tsx server/scripts/backfillKiBoomMarketMetrics.ts
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import { eq, and } from "drizzle-orm";
import { kiBoomMetricsHistory } from "../../drizzle/schema";
import { fetchHistoricalPrices } from "../_core/stockDataApi";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL not set");

const db = drizzle(DATABASE_URL);

// NVDA EPS TTM (approximate, 2026)
const NVDA_EPS_TTM = 2.94;

/** Get trading days for the last N calendar days */
function getTradingDays(daysBack: number): string[] {
  const days: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = daysBack; i >= 1; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) {
      days.push(d.toISOString().split("T")[0]);
    }
  }
  return days;
}

/** Find the closest available price on or before a given date */
function closestPrice(prices: any[], targetDate: string): number | null {
  const target = new Date(targetDate).getTime();
  const sorted = [...prices]
    .filter((p) => new Date(p.date).getTime() <= target)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return sorted[0]?.close ?? null;
}

async function main() {
  console.log("[BackfillKiBoom] Fetching price history for NVDA, SOXX, ARKK, VIX...");

  const [nvdaPrices, soxPrices, arkkPrices, vixPrices, mag7Prices] = await Promise.all([
    fetchHistoricalPrices("NVDA", 1),
    fetchHistoricalPrices("SOXX.US", 1),
    fetchHistoricalPrices("ARKK.US", 1),
    fetchHistoricalPrices("VIX.INDX", 1),
    // Fetch all Mag7 tickers for avg YTD calculation
    Promise.all(["NVDA", "MSFT", "GOOGL", "AMZN", "META", "AAPL", "TSLA"].map((t) =>
      fetchHistoricalPrices(t, 1).catch(() => [])
    )),
  ]);

  console.log(`[BackfillKiBoom] NVDA: ${nvdaPrices?.length ?? 0} pts, SOXX: ${soxPrices?.length ?? 0} pts, ARKK: ${arkkPrices?.length ?? 0} pts, VIX: ${vixPrices?.length ?? 0} pts`);

  const tradingDays = getTradingDays(130); // ~90 trading days in 130 calendar days
  const targetDays = tradingDays.slice(-90);

  console.log(`[BackfillKiBoom] Processing ${targetDays.length} trading days from ${targetDays[0]} to ${targetDays[targetDays.length - 1]}`);

  // Find year-start prices for YTD calculation
  const currentYear = new Date().getFullYear();
  const yearStartDate = `${currentYear}-01-01`;

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const dateStr of targetDays) {
    const nvdaClose = closestPrice(nvdaPrices ?? [], dateStr);
    const soxClose = closestPrice(soxPrices ?? [], dateStr);
    const arkkClose = closestPrice(arkkPrices ?? [], dateStr);
    const vixClose = closestPrice(vixPrices ?? [], dateStr);

    // Calculate Mag7 avg YTD for this date
    let mag7AvgYtd: number | null = null;
    const mag7Ytds: number[] = [];
    for (const tickerPrices of mag7Prices) {
      const priceOnDate = closestPrice(tickerPrices, dateStr);
      const priceYearStart = closestPrice(tickerPrices, yearStartDate);
      if (priceOnDate && priceYearStart && priceYearStart > 0) {
        mag7Ytds.push(((priceOnDate - priceYearStart) / priceYearStart) * 100);
      }
    }
    if (mag7Ytds.length > 0) {
      mag7AvgYtd = mag7Ytds.reduce((a, b) => a + b, 0) / mag7Ytds.length;
    }

    // NVDA P/E
    const nvdaPE = nvdaClose != null ? nvdaClose / NVDA_EPS_TTM : null;

    // Check if a row already exists for this date
    const dateStart = new Date(dateStr + "T00:00:00.000Z");
    const dateEnd = new Date(dateStr + "T23:59:59.999Z");

    const existing = await db
      .select({ id: kiBoomMetricsHistory.id })
      .from(kiBoomMetricsHistory)
      .where(
        and(
          // recordedAt >= dateStart AND recordedAt <= dateEnd
          // Using raw SQL for date range since drizzle between needs both
        )
      )
      .limit(1);

    // Simpler: use raw query approach
    const rows = await db.execute(
      `SELECT id FROM ki_boom_metrics_history WHERE DATE(recordedAt) = '${dateStr}' LIMIT 1`
    ) as any;
    const existingRow = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    const existingId = existingRow ? (Array.isArray(existingRow) ? existingRow[0]?.id : existingRow?.id) : null;

    if (existingId) {
      // Update existing row with new market metrics
      await db.execute(
        `UPDATE ki_boom_metrics_history SET 
          soxPrice = ${soxClose != null ? soxClose : "NULL"},
          arkkPrice = ${arkkClose != null ? arkkClose : "NULL"},
          nvdaPE = ${nvdaPE != null ? nvdaPE.toFixed(2) : "NULL"},
          vixLevel = ${vixClose != null ? vixClose : "NULL"},
          nvidiaPrice = COALESCE(nvidiaPrice, ${nvdaClose != null ? nvdaClose : "NULL"}),
          mag7AvgYtd = COALESCE(mag7AvgYtd, ${mag7AvgYtd != null ? mag7AvgYtd.toFixed(2) : "NULL"})
        WHERE id = ${existingId}`
      );
      updated++;
    } else {
      // Insert new row
      if (!nvdaClose && !soxClose && !arkkClose && !vixClose) {
        skipped++;
        continue;
      }
      await db.execute(
        `INSERT INTO ki_boom_metrics_history 
          (recordedAt, nvidiaPrice, mag7AvgYtd, soxPrice, arkkPrice, nvdaPE, vixLevel,
           openAiVerlustquote, hyperscalerCapexWachstum, vcAnteilKI, pilotProjektROIQuote,
           overallZone, activeWarnings, activeCritical, createdAt)
        VALUES (
          '${dateStr} 23:30:00',
          ${nvdaClose != null ? nvdaClose : "NULL"},
          ${mag7AvgYtd != null ? mag7AvgYtd.toFixed(2) : "NULL"},
          ${soxClose != null ? soxClose : "NULL"},
          ${arkkClose != null ? arkkClose : "NULL"},
          ${nvdaPE != null ? nvdaPE.toFixed(2) : "NULL"},
          ${vixClose != null ? vixClose : "NULL"},
          58, 81, 61, 5,
          'gruen', 0, 0,
          NOW()
        )`
      );
      inserted++;
    }

    if ((inserted + updated) % 10 === 0) {
      console.log(`[BackfillKiBoom] Progress: ${inserted} inserted, ${updated} updated, ${skipped} skipped (${dateStr})`);
    }
  }

  console.log(`[BackfillKiBoom] Done! ${inserted} inserted, ${updated} updated, ${skipped} skipped.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[BackfillKiBoom] Error:", err);
  process.exit(1);
});
