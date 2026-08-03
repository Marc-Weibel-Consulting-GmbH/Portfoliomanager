/**
 * Daily Signal Score Refresh Scheduled Handler
 *
 * Triggered daily at 07:00 UTC via Heartbeat cron.
 * Recalculates signalScore, signalType, and key metrics for ALL stocks in the DB
 * using EODHD fundamentals (P/E, Dividend Yield, PEG ratio) and
 * 52W range derived from historicalPrices table.
 *
 * NOTE: Backfill and YTD recalculation run in separate Heartbeat jobs
 * (ytdRecalc at 06:30 UTC) to stay within the 2-minute handler timeout.
 *
 * Route: POST /api/scheduled/signalScoreRefresh
 */
import type { Request, Response } from "express";
import { alsProzent } from "../lib/dividendenrendite";

/**
 * Calculate signal score from fundamental and technical metrics.
 *
 * `divYield` steht in PROZENT (1.51 = 1.51 %) — dieselbe Konvention wie
 * `stocks.dividendYield` und `fetchEODHDFundamentals`. Vorher erwartete die
 * Funktion einen Bruch, bekam aber Prozent: Jeder Titel mit irgendeiner
 * Ausschüttung überschritt damit die oberste Schwelle und erhielt +15 Punkte.
 * Apple (0.31 % Rendite) wurde so als «Sehr hohe Dividende» geführt.
 */
export function calcSignalScore(params: {
  pe: number | null;
  peg: number | null;
  divYield: number | null; // Prozent (4 = 4 %)
  priceVs52wLow: number | null; // 0-1 position between 52w low and high
  ytdPerf: number | null; // percentage e.g. -20.9 or +12.0
}): { score: number; signalType: "buy" | "sell" | "hold"; reasons: string[] } {
  let score = 50;
  const reasons: string[] = [];
  const { pe, peg, divYield, priceVs52wLow, ytdPerf } = params;

  // 1) P/E scoring
  if (pe !== null) {
    if (pe < 10) { score += 15; reasons.push(`Sehr niedriges P/E (${pe.toFixed(1)})`); }
    else if (pe < 15) { score += 12; reasons.push(`Niedriges P/E (${pe.toFixed(1)})`); }
    else if (pe < 20) { score += 6; reasons.push(`Moderates P/E (${pe.toFixed(1)})`); }
    else if (pe > 60) { score -= 15; reasons.push(`Sehr hohes P/E (${pe.toFixed(1)})`); }
    else if (pe > 40) { score -= 8; reasons.push(`Hohes P/E (${pe.toFixed(1)})`); }
  }

  // 2) Dividend yield scoring — Schwellen in Prozent (6 %, 4 %, 2.5 %)
  if (divYield !== null) {
    if (divYield > 6) { score += 15; reasons.push(`Sehr hohe Dividende (${divYield.toFixed(1)}%)`); }
    else if (divYield > 4) { score += 12; reasons.push(`Hohe Dividende (${divYield.toFixed(1)}%)`); }
    else if (divYield > 2.5) { score += 6; reasons.push(`Gute Dividende (${divYield.toFixed(1)}%)`); }
    else if (divYield === 0) { score -= 2; }
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

  // 5) YTD momentum scoring
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
        let priceVs52wLow: number | null = null;
        let high52w: number | null = null;
        let low52w: number | null = null;
        if (range && range.high52 !== range.low52) {
          high52w = range.high52;
          low52w = range.low52;
          priceVs52wLow = (currentPrice - low52w) / (high52w - low52w);
          priceVs52wLow = Math.max(0, Math.min(1, priceVs52wLow));
        }

        // `fetchEODHDFundamentals` liefert bereits Prozent (eodhdApi.ts rechnet
        // den EODHD-Bruch um). Hier NICHT nochmals mit 100 multiplizieren —
        // genau das erzeugte die 151 für ABBs 1.51 %.
        const divYield = alsProzent(fundamentals.dividendYield, "signalScoreRefresh/EODHD");

        const ytdPerf = parseFloat(stock.ytdPerformance ?? "0") || null;

        const { score, signalType, reasons } = calcSignalScore({
          pe: fundamentals.peRatio,
          peg: fundamentals.pegRatio,
          divYield,
          priceVs52wLow,
          ytdPerf,
        });

        // Update stock in DB
        await db.update(stocksTable).set({
          peRatio: fundamentals.peRatio?.toString() ?? stock.peRatio,
          pegRatio: fundamentals.pegRatio?.toString() ?? stock.pegRatio,
          dividendYield: divYield != null ? divYield.toFixed(4) : stock.dividendYield,
          week52High: high52w?.toString() ?? stock.week52High,
          week52Low: low52w?.toString() ?? stock.week52Low,
          signalScore: score,
          signalType,
          aiReason: reasons.slice(0, 3).join(" · ") || null,
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
