/**
 * Daily Metrics Refresh Scheduled Handler
 *
 * Triggered daily at 07:00 UTC via Heartbeat cron.
 * Refreshes key metrics (P/E, PEG, Dividend Yield, 52W range) for ALL stocks
 * using EODHD fundamentals and the historicalPrices table.
 *
 * K2 (EIN Signal für Badges & Alerts): Die frühere vierte Signalformel
 * `calcSignalScore` ist entfernt — `stocks.signalScore`/`signalType` werden
 * ausschliesslich aus dem Drei-Score-Signal übernommen (watchlistAlertsCron →
 * stock_signal_cache). Dieser Handler fasst die Signalspalten nicht mehr an.
 *
 * NOTE: Backfill and YTD recalculation run in separate Heartbeat jobs
 * (ytdRecalc at 06:30 UTC) to stay within the 2-minute handler timeout.
 *
 * Route: POST /api/scheduled/signalScoreRefresh
 */
import type { Request, Response } from "express";
import { toVerifiedDividendYieldUpdate } from "../lib/dividendYieldPersistence";

export interface SignalScoreRefreshResult {
  ok: boolean;
  updated: number;
  skipped: number;
  failed: number;
  total: number;
  elapsedSeconds: number;
  error?: string;
}

export async function runSignalScoreRefresh(): Promise<SignalScoreRefreshResult> {
  const startTime = Date.now();
  try {
    const { getDb } = await import("../db");
    const { stocks: stocksTable } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const { fetchEODHDFundamentals } = await import("../_core/eodhdApi");
    const { resolveDividendYieldEnrichment } = await import("../_core/dividendYieldEnrichment");

    const db = await getDb();
    if (!db) {
      return { ok: false, updated: 0, skipped: 0, failed: 0, total: 0, elapsedSeconds: 0, error: "Database not available" };
    }

    // Get ALL stocks with a valid price (not just watchlist)
    const allStocks = await db.select().from(stocksTable);
    const checkable = allStocks.filter((s: any) => {
      const price = parseFloat(s.currentPrice ?? "0");
      return price > 0 && s.ticker && !s.ticker.match(/^[A-Z]{12}$/); // skip ISINs
    });

    console.log(`[signalScoreRefresh] Starting EODHD refresh for ${checkable.length} stocks...`);

    let updated = 0;
    let failed = 0;
    let skipped = 0;

    // Time-guard: stop processing after 100s to stay within the 2-minute Heartbeat limit
    const TIME_LIMIT_MS = 100_000;

    for (const stock of checkable) {
      // Stop if we're approaching the time limit
      if (Date.now() - startTime > TIME_LIMIT_MS) {
        console.log(`[signalScoreRefresh] Time limit reached after ${updated} updates, stopping early.`);
        break;
      }

      try {
        // Fetch fundamentals from EODHD (cached 1h in apiCache)
        const fundamentals = await fetchEODHDFundamentals(stock.ticker);

        const currentPrice = parseFloat(stock.currentPrice ?? "0");
        if (currentPrice <= 0) {
          skipped++;
          continue;
        }

        // TTM-Brutto aus datierten, währungsgleichen Ausschüttungen hat Vorrang.
        // Nur bei einer Datenlücke fällt der Resolver explizit auf EODHDs
        // Forward-/Anbieterfeld zurück. Die Rendite bleibt ein Prozentwert und
        // wird daher nie ein zweites Mal mit 100 skaliert.
        const dividend = await resolveDividendYieldEnrichment({
          ticker: stock.ticker,
          currentPrice,
          currency: stock.currency,
          fundamentals,
        });
        const dividendUpdate = toVerifiedDividendYieldUpdate(dividend);

        // K2: reine Kennzahlen-Auffrischung — signalScore/signalType/aiReason
        // gehören dem Drei-Score-Signal und werden hier nicht mehr geschrieben.
        await db.update(stocksTable).set({
          peRatio: fundamentals.peRatio?.toString() ?? stock.peRatio,
          pegRatio: fundamentals.pegRatio?.toString() ?? stock.pegRatio,
          ...dividendUpdate,
          // YTD/52W are maintained solely by refreshSplitAdjustedMarketMetrics.
          // Updating them from raw close here would silently undo a confirmed
          // split correction (e.g. SQN/KLAC/CRWD) at the next daily refresh.
          lastMetricsUpdate: new Date(),
        }).where(eq(stocksTable.id, stock.id));

        updated++;

        // Rate limiting: 200ms between EODHD requests (cached, so usually instant)
        await new Promise((r) => setTimeout(r, 200));
      } catch (err: any) {
        const msg = err?.message ?? String(err);
        if (msg.includes("not found") || msg.includes("No fundamentals") || msg.includes("404")) {
          skipped++;
        } else {
          console.warn(`[signalScoreRefresh] Error for ${stock.ticker}: ${msg}`);
          failed++;
        }
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[signalScoreRefresh] Done in ${elapsed}s: updated=${updated}, skipped=${skipped}, failed=${failed}`
    );

    return {
      ok: true,
      updated,
      skipped,
      failed,
      total: checkable.length,
      elapsedSeconds: parseFloat(elapsed),
    };
  } catch (err: any) {
    console.error("[signalScoreRefresh] Fatal error:", err);
    return { ok: false, updated: 0, skipped: 0, failed: 0, total: 0, elapsedSeconds: 0, error: err?.message ?? "Unknown error" };
  }
}

export async function handleSignalScoreRefresh(req: Request, res: Response) {
  const result = await runSignalScoreRefresh();
  if (!result.ok) {
    return res.status(500).json({ error: result.error ?? "Unknown error" });
  }
  return res.json(result);
}
