/**
 * YTD Recalculation Scheduled Handler
 *
 * Triggered daily at 06:30 UTC via Heartbeat cron (before signalScoreRefresh at 07:00).
 * Computes YTD performance for all stocks where ytdPerformance is NULL or ytdStartPrice is missing,
 * using historicalPrices table (Jan 1 close → today's close).
 *
 * Route: POST /api/scheduled/ytdRecalc
 */
import type { Request, Response } from "express";

export async function handleYtdRecalc(req: Request, res: Response) {
  const startTime = Date.now();
  let ytdUpdated = 0;
  let ytdSkipped = 0;

  try {
    const { getDb } = await import("../db");
    const { stocks: stocksTable, historicalPrices: hpTable } = await import("../../drizzle/schema");
    const { eq, sql: sqlFn, and: andFn, gte, lte } = await import("drizzle-orm");

    const db = await getDb();
    if (!db) {
      return res.status(500).json({ ok: false, error: "Database not available" });
    }

    const currentYear = new Date().getFullYear();
    const ytdStartStr = `${currentYear}-01-01`;
    const todayStr = new Date().toISOString().split("T")[0];

    // Get all stocks that need YTD update
    const stocksNeedingYTD = await db.select().from(stocksTable).where(
      sqlFn`(${stocksTable.ytdPerformance} IS NULL OR ${stocksTable.ytdStartPrice} IS NULL OR ${stocksTable.ytdStartPrice} = '0')`
    );

    console.log(`[ytdRecalc] ${stocksNeedingYTD.length} stocks need YTD update`);

    // Time-guard: 100s limit
    const TIME_LIMIT_MS = 100_000;

    for (const stock of stocksNeedingYTD) {
      if (Date.now() - startTime > TIME_LIMIT_MS) {
        console.log(`[ytdRecalc] Time limit reached after ${ytdUpdated} updates`);
        break;
      }
      try {
        // Get Jan 1 price (or first available price of the year)
        const ytdStartRows = await db.select({ close: hpTable.close, date: hpTable.date })
          .from(hpTable)
          .where(andFn(
            eq(hpTable.ticker, stock.ticker),
            gte(hpTable.date, ytdStartStr),
            lte(hpTable.date, `${currentYear}-01-15`)
          ))
          .orderBy(hpTable.date)
          .limit(1);

        // Get most recent price
        const latestRows = await db.select({ close: hpTable.close, date: hpTable.date })
          .from(hpTable)
          .where(andFn(
            eq(hpTable.ticker, stock.ticker),
            lte(hpTable.date, todayStr)
          ))
          .orderBy(sqlFn`${hpTable.date} DESC`)
          .limit(1);

        if (ytdStartRows.length > 0 && latestRows.length > 0) {
          const ytdStartPrice = parseFloat(ytdStartRows[0].close);
          const latestPrice = parseFloat(latestRows[0].close);
          if (ytdStartPrice > 0 && latestPrice > 0) {
            const ytdPerf = ((latestPrice - ytdStartPrice) / ytdStartPrice) * 100;
            await db.update(stocksTable).set({
              ytdStartPrice: ytdStartPrice.toFixed(4),
              ytdPerformance: ytdPerf.toFixed(2),
            }).where(eq(stocksTable.id, stock.id));
            ytdUpdated++;
          } else {
            ytdSkipped++;
          }
        } else {
          ytdSkipped++;
        }
      } catch {
        ytdSkipped++;
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[ytdRecalc] Done in ${elapsed}s: updated=${ytdUpdated}, skipped=${ytdSkipped}`);

    return res.json({ ok: true, updated: ytdUpdated, skipped: ytdSkipped, elapsedSeconds: parseFloat(elapsed) });
  } catch (err: any) {
    console.error("[ytdRecalc] Fatal error:", err);
    return res.status(500).json({ ok: false, error: err?.message ?? "Unknown error" });
  }
}
