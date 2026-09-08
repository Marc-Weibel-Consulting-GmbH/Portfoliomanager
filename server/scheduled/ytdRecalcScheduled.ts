/**
 * YTD Recalculation Scheduled Handler
 *
 * Triggered daily at 06:30 UTC via Heartbeat cron (before signalScoreRefresh at 07:00).
 * Computes YTD performance from a consistent adjusted-close series. The daily
 * recalculation deliberately includes already-filled fields so in-year stock
 * splits and comparable corporate actions cannot preserve a stale raw-price
 * baseline.
 *
 * Route: POST /api/scheduled/ytdRecalc
 */
import type { Request, Response } from "express";
import { calculateAdjustedYtdPerformance } from "../lib/ytdAdjustedPerformance";

export async function handleYtdRecalc(req: Request, res: Response) {
  const startTime = Date.now();
  let ytdUpdated = 0;
  let ytdSkipped = 0;

  try {
    const { getDb } = await import("../db");
    const { stocks: stocksTable, historicalPrices: hpTable } = await import("../../drizzle/schema");
    const { eq, inArray, and: andFn, gte, lte } = await import("drizzle-orm");

    const db = await getDb();
    if (!db) {
      return res.status(500).json({ ok: false, error: "Database not available" });
    }

    const currentYear = new Date().getFullYear();
    const ytdStartStr = `${currentYear}-01-01`;
    const todayStr = new Date().toISOString().split("T")[0];

    // Die gesamte YTD-Reihe muss aus derselben (bereinigten) Preisbasis kommen.
    // Ein NULL-Backfill allein beließe bei Splits bereits gespeicherte falsche
    // Baselines und erzöge beim nächsten Kursupdate erneut Phantomrenditen.
    const allStocks = await db.select().from(stocksTable);
    console.log(`[ytdRecalc] Recalculate YTD from adjusted closes for ${allStocks.length} stocks`);

    // Time-guard: 100s limit
    const TIME_LIMIT_MS = 100_000;

    const tickers = allStocks.map((stock) => stock.ticker).filter(Boolean);
    const yearRows = tickers.length === 0
      ? []
      : await db.select({
        ticker: hpTable.ticker,
        date: hpTable.date,
        close: hpTable.close,
        adjustedClose: hpTable.adjustedClose,
      }).from(hpTable).where(andFn(
        inArray(hpTable.ticker, tickers),
        gte(hpTable.date, ytdStartStr),
        lte(hpTable.date, todayStr),
      ));
    const rowsByTicker = new Map<string, typeof yearRows>();
    for (const row of yearRows) {
      const rows = rowsByTicker.get(row.ticker) ?? [];
      rows.push(row);
      rowsByTicker.set(row.ticker, rows);
    }

    for (const stock of allStocks) {
      if (Date.now() - startTime > TIME_LIMIT_MS) {
        console.log(`[ytdRecalc] Time limit reached after ${ytdUpdated} updates`);
        break;
      }
      try {
        const calculated = calculateAdjustedYtdPerformance(rowsByTicker.get(stock.ticker) ?? [], currentYear);
        if (!calculated) {
          ytdSkipped++;
          continue;
        }
        await db.update(stocksTable).set({
          ytdStartPrice: calculated.startPrice.toFixed(4),
          ytdPerformance: calculated.performancePct.toFixed(2),
        }).where(eq(stocksTable.id, stock.id));
        ytdUpdated++;
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
