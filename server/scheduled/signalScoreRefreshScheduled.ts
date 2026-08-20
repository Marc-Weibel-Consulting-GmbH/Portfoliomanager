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
import { alsProzent } from "../lib/dividendenrendite";

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
    const { stocks: stocksTable, historicalPrices: hpTable } = await import("../../drizzle/schema");
    const { eq, gte, sql: sqlFn } = await import("drizzle-orm");
    const { fetchEODHDFundamentals } = await import("../_core/eodhdApi");

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

    // Pre-compute 52W range from historicalPrices for all tickers in one query
    // (avoids N+1 queries — much faster than per-stock queries)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const oneYearAgoStr = oneYearAgo.toISOString().split("T")[0];

    const priceRanges = await db
      .select({
        ticker: hpTable.ticker,
        high52: sqlFn<string>`MAX(${hpTable.close})`,
        low52: sqlFn<string>`MIN(${hpTable.close})`,
      })
      .from(hpTable)
      .where(gte(hpTable.date, oneYearAgoStr))
      .groupBy(hpTable.ticker);

    const rangeMap = new Map<string, { high52: number; low52: number }>();
    for (const r of priceRanges) {
      const h = parseFloat(r.high52 as any);
      const l = parseFloat(r.low52 as any);
      if (Number.isFinite(h) && Number.isFinite(l) && h > 0) {
        rangeMap.set(r.ticker, { high52: h, low52: l });
      }
    }

    console.log(`[signalScoreRefresh] 52W ranges loaded for ${rangeMap.size} tickers`);

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

        // 52W range from pre-computed map
        const range = rangeMap.get(stock.ticker);
        let high52w: number | null = null;
        let low52w: number | null = null;
        if (range && range.high52 !== range.low52) {
          high52w = range.high52;
          low52w = range.low52;
        }

        // `fetchEODHDFundamentals` liefert bereits Prozent (eodhdApi.ts rechnet
        // den EODHD-Bruch um). Hier NICHT nochmals mit 100 multiplizieren —
        // genau das erzeugte die 151 für ABBs 1.51 %.
        const divYield = alsProzent(fundamentals.dividendYield, "signalScoreRefresh/EODHD");

        // K2: reine Kennzahlen-Auffrischung — signalScore/signalType/aiReason
        // gehören dem Drei-Score-Signal und werden hier nicht mehr geschrieben.
        await db.update(stocksTable).set({
          peRatio: fundamentals.peRatio?.toString() ?? stock.peRatio,
          pegRatio: fundamentals.pegRatio?.toString() ?? stock.pegRatio,
          dividendYield: divYield != null ? divYield.toFixed(4) : stock.dividendYield,
          week52High: high52w?.toString() ?? stock.week52High,
          week52Low: low52w?.toString() ?? stock.week52Low,
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
