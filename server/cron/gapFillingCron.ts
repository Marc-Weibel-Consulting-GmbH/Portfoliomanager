/**
 * EODHD Gap-Filling Cron Job
 *
 * Analyses the current watchlist universe for underrepresented sectors,
 * regions, and dividend buckets. For each gap it queries the EODHD
 * fundamentals API to find high-quality candidates and auto-adds them
 * to the watchlist (listType='watchlist').
 *
 * Schedule: Once per week (Sunday 03:00 UTC) + manual trigger via Admin UI.
 */

import { getDb, getStockByTicker, insertStock } from "../db";
import { gapFillLog, stocks as stocksTable } from "../../drizzle/schema";
import { fetchCompleteStockData } from "../_core/multiApiDataMerger";
import { notifyOwner } from "../_core/notification";

const isRunning = false;

// ─── Configuration ────────────────────────────────────────────────────────────

/** Minimum number of watchlist stocks required per sector before a gap is declared */
const MIN_STOCKS_PER_SECTOR = 3;

/** Minimum number of dividend stocks (yield > 2%) before a dividend gap is declared */
const MIN_DIVIDEND_STOCKS = 5;

/** Maximum candidates to fetch per gap (to limit API calls) */
const MAX_CANDIDATES_PER_GAP = 3;

/** Sectors that should be represented in a well-diversified universe */
const TARGET_SECTORS = [
  "Technology",
  "Healthcare",
  "Financial Services",
  "Consumer Cyclical",
  "Consumer Defensive",
  "Industrials",
  "Energy",
  "Utilities",
  "Real Estate",
  "Basic Materials",
  "Communication Services",
];

/**
 * Curated EODHD tickers per sector gap — used as fallback candidates
 * when the EODHD screener API is not available on the current plan.
 * Each list contains well-known, liquid large-caps for the sector.
 */
const SECTOR_FALLBACK_CANDIDATES: Record<string, string[]> = {
  Technology: ["AAPL.US", "MSFT.US", "GOOGL.US", "META.US", "AVGO.US"],
  Healthcare: ["JNJ.US", "UNH.US", "LLY.US", "ABBV.US", "MRK.US"],
  "Financial Services": ["JPM.US", "BAC.US", "WFC.US", "GS.US", "MS.US"],
  "Consumer Cyclical": ["AMZN.US", "BKNG.US", "HD.US", "MCD.US", "NKE.US"],
  "Consumer Defensive": ["PG.US", "KO.US", "PEP.US", "WMT.US", "COST.US"],
  Industrials: ["CAT.US", "HON.US", "UPS.US", "BA.US", "GE.US"],
  Energy: ["XOM.US", "CVX.US", "COP.US", "SLB.US", "EOG.US"],
  Utilities: ["NEE.US", "DUK.US", "SO.US", "D.US", "AEP.US"],
  "Real Estate": ["AMT.US", "PLD.US", "EQIX.US", "SPG.US", "O.US"],
  "Basic Materials": ["LIN.US", "APD.US", "SHW.US", "FCX.US", "NEM.US"],
  "Communication Services": ["GOOGL.US", "META.US", "NFLX.US", "DIS.US", "T.US"],
};

/** High-yield dividend candidates for dividend gap filling */
const DIVIDEND_FALLBACK_CANDIDATES = [
  "O.US",    // Realty Income
  "T.US",    // AT&T
  "VZ.US",   // Verizon
  "MO.US",   // Altria
  "KMB.US",  // Kimberly-Clark
  "PFE.US",  // Pfizer
  "IBM.US",  // IBM
  "MMM.US",  // 3M
];

// ─── Gap Analysis ─────────────────────────────────────────────────────────────

interface GapInfo {
  type: "sector" | "dividend";
  label: string;
  count: number;
  needed: number;
  candidates: string[]; // EODHD tickers to try
}

async function analyseGaps(db: NonNullable<Awaited<ReturnType<typeof getDb>>>): Promise<GapInfo[]> {
  const allWatchlistStocks = await db
    .select({
      ticker: stocksTable.ticker,
      sector: stocksTable.sector,
      dividendYield: stocksTable.dividendYield,
    })
    .from(stocksTable)
    .execute();

  const watchlist = allWatchlistStocks.filter((s) => s.ticker);

  // Count by sector
  const sectorCounts: Record<string, number> = {};
  for (const s of watchlist) {
    const sec = s.sector ?? "Unknown";
    sectorCounts[sec] = (sectorCounts[sec] ?? 0) + 1;
  }

  // Count dividend stocks (yield > 2%)
  const dividendCount = watchlist.filter((s) => {
    const y = parseFloat(s.dividendYield ?? "0");
    return y >= 2;
  }).length;

  const gaps: GapInfo[] = [];

  // Sector gaps
  for (const sector of TARGET_SECTORS) {
    const count = sectorCounts[sector] ?? 0;
    if (count < MIN_STOCKS_PER_SECTOR) {
      gaps.push({
        type: "sector",
        label: sector,
        count,
        needed: MIN_STOCKS_PER_SECTOR - count,
        candidates: (SECTOR_FALLBACK_CANDIDATES[sector] ?? []).slice(0, MAX_CANDIDATES_PER_GAP),
      });
    }
  }

  // Dividend gap
  if (dividendCount < MIN_DIVIDEND_STOCKS) {
    gaps.push({
      type: "dividend",
      label: "Dividenden (≥2%)",
      count: dividendCount,
      needed: MIN_DIVIDEND_STOCKS - dividendCount,
      candidates: DIVIDEND_FALLBACK_CANDIDATES.slice(0, MAX_CANDIDATES_PER_GAP),
    });
  }

  return gaps;
}

// ─── Main Job ─────────────────────────────────────────────────────────────────

export async function runGapFilling(triggeredBy: "cron" | "manual" = "cron"): Promise<{
  gapsFound: GapInfo[];
  stocksAdded: Array<{ ticker: string; name: string; sector: string; gapType: string }>;
  stocksSkipped: number;
  durationMs: number;
}> {
  const startTime = Date.now();
  console.log(`[gapFillingCron] Starting gap-filling run (triggeredBy=${triggeredBy})...`);

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const gapsFound = await analyseGaps(db);
  console.log(`[gapFillingCron] Found ${gapsFound.length} gaps: ${gapsFound.map((g) => g.label).join(", ")}`);

  const stocksAdded: Array<{ ticker: string; name: string; sector: string; gapType: string }> = [];
  let stocksSkipped = 0;

  if (gapsFound.length === 0) {
    console.log("[gapFillingCron] No gaps found — universe is well-diversified.");
  } else {
    // Process each gap
    for (const gap of gapsFound) {
      let addedForGap = 0;
      for (const eodhdTicker of gap.candidates) {
        if (addedForGap >= gap.needed) break;

        // Convert EODHD ticker (e.g. "XOM.US") to Yahoo ticker (e.g. "XOM")
        const yahooTicker = eodhdTicker.replace(/\.(US|SW|DE|PA|L|TO|AX)$/i, "");

        // Skip if already in DB
        const existing = await getStockByTicker(yahooTicker);
        if (existing) {
          console.log(`[gapFillingCron] ${yahooTicker} already in DB, skipping`);
          stocksSkipped++;
          continue;
        }

        try {
          console.log(`[gapFillingCron] Fetching data for ${yahooTicker} (gap: ${gap.label})...`);
          const data = await fetchCompleteStockData(yahooTicker);

          if (!data.ticker || !data.companyName) {
            console.warn(`[gapFillingCron] Incomplete data for ${yahooTicker}, skipping`);
            stocksSkipped++;
            continue;
          }

          await insertStock({
            ticker: data.ticker,
            companyName: data.companyName ?? undefined,
            currency: data.currency ?? "USD",
            currentPrice: data.currentPrice?.toString() ?? null,
            dividendYield: data.dividendYield?.toString() ?? null,
            peRatio: data.pe?.toString() ?? null,
            pegRatio: data.peg?.toString() ?? null,
            marketCap: data.marketCap?.toString() ?? null,
            beta: data.beta?.toString() ?? null,
            listType: "watchlist",
          });

          stocksAdded.push({
            ticker: data.ticker,
            name: data.companyName ?? data.ticker,
            sector: gap.label,
            gapType: gap.label,
          });
          addedForGap++;
          console.log(`[gapFillingCron] ✅ Added ${data.ticker} (${data.companyName}) for gap: ${gap.label}`);
        } catch (err: any) {
          console.warn(`[gapFillingCron] Failed to fetch/insert ${yahooTicker}: ${err?.message}`);
          stocksSkipped++;
        }
      }
    }
  }

  const durationMs = Date.now() - startTime;

  // Persist log entry
  try {
    await db.insert(gapFillLog).values({
      triggeredBy,
      gapsFound: gapsFound.map((g) => ({ type: g.type, label: g.label, count: g.count, needed: g.needed })),
      stocksAdded,
      stocksSkipped,
      durationMs,
    });
  } catch (logErr: any) {
    console.warn(`[gapFillingCron] Failed to write log entry: ${logErr?.message}`);
  }

  // Notify admin if stocks were added
  if (stocksAdded.length > 0) {
    const addedList = stocksAdded.map((s) => `• ${s.ticker} (${s.name}) → ${s.gapType}`).join("\n");
    await notifyOwner({
      title: `Gap-Filling: ${stocksAdded.length} neue Titel zur Watchlist hinzugefügt`,
      content: `${stocksAdded.length} Titel wurden automatisch hinzugefügt:\n\n${addedList}\n\nLücken geschlossen: ${gapsFound.map((g) => g.label).join(", ")}`,
    }).catch(() => {});
  }

  console.log(`[gapFillingCron] Done in ${durationMs}ms: ${stocksAdded.length} added, ${stocksSkipped} skipped`);
  return { gapsFound, stocksAdded, stocksSkipped, durationMs };
}

// ─── Init ─────────────────────────────────────────────────────────────────────

export function initGapFillingCron() {
  console.log("[gapFillingCron] Initializing gap-filling cron job (weekly on Sunday 03:00 UTC)...");

  // Run initial check after 5 minutes (let other services start first)
  setTimeout(() => {
    runGapFilling("cron").catch((err) => {
      console.error("[gapFillingCron] Error during initial run:", err);
    });
  }, 5 * 60 * 1000);

  // Schedule weekly on Sunday at 03:00 UTC
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  setInterval(() => {
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0 = Sunday
    const hour = now.getUTCHours();
    if (dayOfWeek === 0 && hour === 3) {
      runGapFilling("cron").catch((err) => {
        console.error("[gapFillingCron] Error during scheduled run:", err);
      });
    }
  }, WEEK_MS);
}
