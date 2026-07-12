/**
 * Daily Signal Score Refresh Scheduled Handler
 *
 * Triggered daily at 07:00 UTC via Heartbeat cron.
 * Recalculates signalScore, signalType, and key metrics for ALL stocks in the DB
 * using Yahoo Finance data (P/E, Dividend Yield, 52W position, PEG ratio, YTD performance).
 *
 * This ensures the KI Portfolio algorithm always works with fresh scores,
 * not stale data from weeks ago.
 *
 * Route: POST /api/scheduled/signalScoreRefresh
 */
import type { Request, Response } from "express";

/**
 * Calculate signal score from fundamental and technical metrics.
 * Mirrors the logic in watchlistAlertsCron but adds YTD momentum factor.
 */
function calcSignalScore(params: {
  pe: number | null;
  peg: number | null;
  divYield: number | null; // decimal (0.04 = 4%)
  priceVs52wLow: number | null; // 0-1 position between 52w low and high
  ytdPerf: number | null; // percentage e.g. -20.9 or +12.0
}): { score: number; signalType: "buy" | "sell" | "hold"; reasons: string[] } {
  let score = 50;
  const reasons: string[] = [];

  // 1) P/E scoring
  const { pe, peg, divYield, priceVs52wLow, ytdPerf } = params;
  if (pe !== null) {
    if (pe < 10) { score += 15; reasons.push(`Sehr niedriges P/E (${pe.toFixed(1)})`); }
    else if (pe < 15) { score += 12; reasons.push(`Niedriges P/E (${pe.toFixed(1)})`); }
    else if (pe < 20) { score += 6; reasons.push(`Moderates P/E (${pe.toFixed(1)})`); }
    else if (pe > 60) { score -= 15; reasons.push(`Sehr hohes P/E (${pe.toFixed(1)})`); }
    else if (pe > 40) { score -= 8; reasons.push(`Hohes P/E (${pe.toFixed(1)})`); }
  }

  // 2) Dividend yield scoring
  if (divYield !== null) {
    if (divYield > 0.06) { score += 15; reasons.push(`Sehr hohe Dividende (${(divYield * 100).toFixed(1)}%)`); }
    else if (divYield > 0.04) { score += 12; reasons.push(`Hohe Dividende (${(divYield * 100).toFixed(1)}%)`); }
    else if (divYield > 0.025) { score += 6; reasons.push(`Gute Dividende (${(divYield * 100).toFixed(1)}%)`); }
    else if (divYield === 0) { score -= 2; } // No dividend (slight penalty for value stocks)
  }

  // 3) 52W position scoring (contrarian: near lows = potential value)
  if (priceVs52wLow !== null) {
    if (priceVs52wLow < 0.15) { score += 15; reasons.push(`Nahe 52W-Tief (${(priceVs52wLow * 100).toFixed(0)}%)`); }
    else if (priceVs52wLow < 0.30) { score += 8; reasons.push(`Unter 52W-Mitte (${(priceVs52wLow * 100).toFixed(0)}%)`); }
    else if (priceVs52wLow > 0.95) { score -= 10; reasons.push(`Am 52W-Hoch (${(priceVs52wLow * 100).toFixed(0)}%)`); }
    else if (priceVs52wLow > 0.85) { score -= 5; reasons.push(`Nahe 52W-Hoch (${(priceVs52wLow * 100).toFixed(0)}%)`); }
  }

  // 4) PEG scoring
  if (peg !== null) {
    if (peg < 0.8) { score += 12; reasons.push(`PEG sehr niedrig (${peg.toFixed(2)})`); }
    else if (peg < 1.2) { score += 5; reasons.push(`PEG moderat (${peg.toFixed(2)})`); }
    else if (peg > 3) { score -= 8; reasons.push(`PEG hoch (${peg.toFixed(2)})`); }
  }

  // 5) YTD momentum scoring (NEW: prevents selecting stocks in downtrends)
  if (ytdPerf !== null) {
    if (ytdPerf > 25) { score += 10; reasons.push(`Starkes YTD-Momentum (+${ytdPerf.toFixed(1)}%)`); }
    else if (ytdPerf > 10) { score += 6; reasons.push(`Gutes YTD-Momentum (+${ytdPerf.toFixed(1)}%)`); }
    else if (ytdPerf > 0) { score += 2; reasons.push(`Positives YTD (${ytdPerf.toFixed(1)}%)`); }
    else if (ytdPerf < -25) { score -= 15; reasons.push(`Starker YTD-Rückgang (${ytdPerf.toFixed(1)}%)`); }
    else if (ytdPerf < -15) { score -= 10; reasons.push(`YTD-Rückgang (${ytdPerf.toFixed(1)}%)`); }
    else if (ytdPerf < -8) { score -= 5; reasons.push(`Leichter YTD-Rückgang (${ytdPerf.toFixed(1)}%)`); }
  }

  score = Math.max(0, Math.min(100, score));
  const signalType: "buy" | "sell" | "hold" =
    score >= 70 ? "buy" : score <= 30 ? "sell" : "hold";

  return { score, signalType, reasons };
}

export async function handleSignalScoreRefresh(req: Request, res: Response) {
  const startTime = Date.now();
  try {
    const { getDb } = await import("../db");
    const { stocks: stocksTable } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");

    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Database not available" });
    }

    const YahooFinanceClass = (await import("yahoo-finance2")).default;
    const yahooFinance: any = new (YahooFinanceClass as any)();

    function normalizeTicker(ticker: string): string {
      if (ticker.endsWith(".US")) return ticker.slice(0, -3);
      return ticker;
    }

    // Get ALL stocks with a valid price (not just watchlist)
    const allStocks = await db.select().from(stocksTable);
    const checkable = allStocks.filter((s: any) => {
      const price = parseFloat(s.currentPrice ?? "0");
      return price > 0 && s.ticker && !s.ticker.match(/^[A-Z]{12}$/); // skip ISINs
    });

    console.log(`[signalScoreRefresh] Starting refresh for ${checkable.length} stocks...`);

    let updated = 0;
    let failed = 0;
    let skipped = 0;

    // Calculate YTD start price (Jan 1 of current year)
    const now = new Date();
    const ytdStartDate = new Date(now.getFullYear(), 0, 1); // Jan 1

    for (const stock of checkable) {
      try {
        const yahooTicker = normalizeTicker(stock.ticker);

        const quote: any = await yahooFinance.quoteSummary(yahooTicker, {
          modules: ["price", "summaryDetail", "defaultKeyStatistics"] as any,
        });

        const price = quote?.price;
        const summary = quote?.summaryDetail;
        const keyStats = quote?.defaultKeyStatistics;

        if (!price?.regularMarketPrice) {
          skipped++;
          continue;
        }

        const currentPrice = price.regularMarketPrice as number;
        const pe = summary?.trailingPE ?? null;
        const peg = keyStats?.pegRatio ?? null;
        const divYield = summary?.dividendYield ?? null; // decimal
        const high52w = summary?.fiftyTwoWeekHigh ?? null;
        const low52w = summary?.fiftyTwoWeekLow ?? null;

        // 52W position (0 = at low, 1 = at high)
        let priceVs52wLow: number | null = null;
        if (high52w && low52w && high52w !== low52w) {
          priceVs52wLow = (currentPrice - low52w) / (high52w - low52w);
        }

        // YTD performance from stored ytdPerformance field (updated by price cron)
        // or compute from Yahoo's regularMarketChangePercent YTD if available
        const ytdPerf = parseFloat(stock.ytdPerformance ?? "0") || null;

        const { score, signalType, reasons } = calcSignalScore({
          pe: pe ? parseFloat(pe.toString()) : null,
          peg: peg ? parseFloat(peg.toString()) : null,
          divYield: divYield ? parseFloat(divYield.toString()) : null,
          priceVs52wLow,
          ytdPerf,
        });

        // Update stock in DB
        await db.update(stocksTable).set({
          currentPrice: currentPrice.toString(),
          peRatio: pe?.toString() ?? stock.peRatio,
          pegRatio: peg?.toString() ?? stock.pegRatio,
          dividendYield: divYield ? (divYield * 100).toFixed(4) : stock.dividendYield,
          week52High: high52w?.toString() ?? stock.week52High,
          week52Low: low52w?.toString() ?? stock.week52Low,
          signalScore: score,
          signalType,
          aiReason: reasons.slice(0, 3).join(" · ") || null,
          lastMetricsUpdate: new Date(),
        }).where(eq(stocksTable.id, stock.id));

        updated++;

        // Rate limiting: 300ms between requests to avoid Yahoo Finance throttling
        await new Promise((r) => setTimeout(r, 300));
      } catch (err: any) {
        const msg = err?.message ?? String(err);
        if (msg.includes("not found") || msg.includes("No fundamentals") || msg.includes("404")) {
          skipped++;
        } else {
          console.warn(`[signalScoreRefresh] Error for ${stock.ticker}: ${msg}`);
          failed++;
        }
        // Still rate limit on errors
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[signalScoreRefresh] Done in ${elapsed}s: updated=${updated}, skipped=${skipped}, failed=${failed}`
    );

    // === BACKFILL: Load historical prices for all stocks missing data ===
    // This runs after signalScore update so YTD values are fresh.
    // Uses the existing importHistoricalPrices job which now includes all stocks table tickers.
    let backfillResult: any = null;
    try {
      console.log("[signalScoreRefresh] Starting historical price backfill for all stocks...");
      const { importHistoricalPrices } = await import("../jobs/importHistoricalPrices");
      // Backfill 2 years of history (for YTD + performance charts)
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      const fromDate = twoYearsAgo.toISOString().split("T")[0];
      const toDate = new Date().toISOString().split("T")[0];
      backfillResult = await importHistoricalPrices(fromDate, toDate, false);
      console.log(
        `[signalScoreRefresh] Backfill done: ${backfillResult.tickersProcessed} tickers, ${backfillResult.pricesImported} prices`
      );
    } catch (backfillErr: any) {
      console.error("[signalScoreRefresh] Backfill error (non-fatal):", backfillErr?.message);
      backfillResult = { error: backfillErr?.message };
    }

    // === YTD RECALCULATION from historicalPrices ===
    // For all stocks where ytdPerformance is NULL or ytdStartPrice is missing,
    // compute YTD directly from historicalPrices (Jan 1 close → today's close).
    // This is more accurate than the ytdStartPrice approach and handles new stocks.
    let ytdUpdated = 0;
    let ytdSkipped = 0;
    try {
      const { historicalPrices: hpTable } = await import("../../drizzle/schema");
      const { sql: sqlFn, and: andFn, gte, lte } = await import("drizzle-orm");

      const currentYear = new Date().getFullYear();
      const ytdStartStr = `${currentYear}-01-01`;
      const todayStr = new Date().toISOString().split("T")[0];

      // Get all stocks that need YTD update
      const stocksNeedingYTD = await db.select().from(stocksTable).where(
        sqlFn`(${stocksTable.ytdPerformance} IS NULL OR ${stocksTable.ytdStartPrice} IS NULL OR ${stocksTable.ytdStartPrice} = '0')`
      );
      console.log(`[signalScoreRefresh] YTD recalc: ${stocksNeedingYTD.length} stocks need update`);

      for (const stock of stocksNeedingYTD) {
        try {
          // Get Jan 1 price (or first available price of the year)
          const ytdStartRows = await db.select({ close: hpTable.close, date: hpTable.date })
            .from(hpTable)
            .where(andFn(
              eq(hpTable.ticker, stock.ticker),
              gte(hpTable.date, ytdStartStr),
              lte(hpTable.date, `${currentYear}-01-15`) // first 2 weeks of Jan
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
        } catch (ytdErr: any) {
          ytdSkipped++;
        }
      }
      console.log(`[signalScoreRefresh] YTD recalc done: updated=${ytdUpdated}, skipped=${ytdSkipped}`);
    } catch (ytdMainErr: any) {
      console.error("[signalScoreRefresh] YTD recalc error (non-fatal):", ytdMainErr?.message);
    }

    return res.json({
      ok: true,
      updated,
      skipped,
      failed,
      total: checkable.length,
      elapsedSeconds: parseFloat(elapsed),
      backfill: backfillResult,
      ytdRecalc: { updated: ytdUpdated, skipped: ytdSkipped },
    });
  } catch (err: any) {
    console.error("[signalScoreRefresh] Fatal error:", err);
    return res.status(500).json({ error: err?.message ?? "Unknown error" });
  }
}
