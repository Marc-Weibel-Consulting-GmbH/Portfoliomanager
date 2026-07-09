/**
 * Signal Cache Cron
 * =================
 * Berechnet Signale für alle aktiven Watchlist-Aktien vorab und speichert
 * sie in der stock_signal_cache-Tabelle. Läuft stündlich.
 *
 * Die generate-Prozedur im signalsRouter liest dann aus diesem Cache
 * statt live zu berechnen → Antwortzeit < 1s statt 15–30s.
 */

import { eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { stockSignalCache, watchlistStocks } from "../../drizzle/schema";

let isRunning = false;

/**
 * Compute and cache signals for all active watchlist stocks.
 * Runs in parallel batches of 5 to avoid overwhelming the DB.
 */
export async function refreshSignalCache(): Promise<void> {
  if (isRunning) {
    console.log("[signalCacheCron] Already running, skipping...");
    return;
  }
  isRunning = true;
  const startTime = Date.now();
  console.log("[signalCacheCron] Starting signal cache refresh...");

  try {
    const db = await getDb();
    if (!db) {
      console.error("[signalCacheCron] DB not available");
      return;
    }

    // Get all active watchlist stocks
    const allStocks = await db
      .select({
        ticker: watchlistStocks.ticker,
        companyName: watchlistStocks.companyName,
        currentPrice: watchlistStocks.currentPrice,
      })
      .from(watchlistStocks)
      .where(eq(watchlistStocks.isActive, 1))
      .limit(250);

    console.log(`[signalCacheCron] Processing ${allStocks.length} stocks...`);

    // Import signal processing functions
    const { randomForestSignal } = await import("../analytics/mlEngine");
    const { signalForSeries, getActiveSignalModel } = await import("../analytics/signalService");
    const { detectBubble } = await import("../analytics/lpplsEngine");
    const { calculateQualityScore, calculateMomentumScore } = await import("../analytics/qualityMomentumEngine");
    const { getActiveWeights } = await import("../analytics/optimizerWorker");
    const { blendCombinedScore } = await import("../lib/signalBlend");
    const { getRegimeBlendConfig } = await import("../analytics/regimeSignalMemory");
    const { computeRegime } = await import("../lib/signals/regimeEngine");

    const optimizedWeights = await getActiveWeights();
    const blendConfig = await getRegimeBlendConfig();

    let saved = 0;
    let failed = 0;
    const BATCH_SIZE = 5;

    for (let i = 0; i < allStocks.length; i += BATCH_SIZE) {
      const batch = allStocks.slice(i, i + BATCH_SIZE);

      await Promise.allSettled(
        batch.map(async (stock) => {
          try {
            const ticker = stock.ticker;

            // 1. Get fundamental data from stocks table (fast, no external API)
            const { stocks: stocksTable } = await import("../../drizzle/schema");
            const [stockRow] = await db.select().from(stocksTable).where(eq(stocksTable.ticker, ticker)).limit(1);

            const num = (v: string | null | undefined): number | null => {
              if (v == null) return null;
              const n = parseFloat(v);
              return Number.isFinite(n) ? n : null;
            };

            const peRatio = num(stockRow?.peRatio);
            const pegRatio = num(stockRow?.pegRatio);
            const dividendYield = num(stockRow?.dividendYield) ?? 0;
            const companyName = stockRow?.companyName || stock.companyName || ticker;
            let currentPrice = num(stockRow?.currentPrice) ?? num(stock.currentPrice) ?? 0;

            // 2. Get historical prices from DB
            const { historicalPrices } = await import("../../drizzle/schema");
            const { gte, and, asc } = await import("drizzle-orm");
            const from = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
            const priceRows = await db
              .select({ date: historicalPrices.date, close: historicalPrices.close, adj: historicalPrices.adjustedClose })
              .from(historicalPrices)
              .where(and(eq(historicalPrices.ticker, ticker), gte(historicalPrices.date, from)))
              .orderBy(asc(historicalPrices.date));

            const series = priceRows
              .map((r: any) => ({ date: r.date as string, close: parseFloat((r.adj ?? r.close) as any) }))
              .filter((p: { date: string; close: number }) => Number.isFinite(p.close) && p.close > 0);

            const prices = series.map((p: { date: string; close: number }) => p.close);

            // Compute YTD, 52w range, RSI from historical data
            let ytdPerformance = 0;
            let fiftyTwoWeekHigh: number | null = null;
            let fiftyTwoWeekLow: number | null = null;
            let rsi14: number | null = null;

            if (series.length > 1) {
              const yearStart = `${new Date().getFullYear()}-01-01`;
              const firstYtd = series.find((p: { date: string; close: number }) => p.date >= yearStart) ?? series[0];
              const last = series[series.length - 1];
              if (firstYtd.close > 0) {
                ytdPerformance = ((last.close - firstYtd.close) / firstYtd.close) * 100;
              }
              if (currentPrice === 0) currentPrice = last.close;
              fiftyTwoWeekHigh = Math.max(...prices);
              fiftyTwoWeekLow = Math.min(...prices);
              if (prices.length >= 15) rsi14 = calcRSI(prices, 14);
            }

            // 3. Generate base signal
            let signalType: "buy" | "sell" | "hold" = "hold";
            let signalStrength: "strong" | "moderate" | "weak" = "weak";
            let reason = "Neutrale Bewertung: Aktuelle Position beibehalten und Entwicklung beobachten.";
            let targetPrice = currentPrice;
            const criteria: string[] = [];

            // Simple scoring
            let score = 0;
            if (peRatio !== null && peRatio > 0) {
              if (peRatio < 12) { score += 3; criteria.push(`Sehr niedriges P/E (${peRatio.toFixed(1)})`); }
              else if (peRatio < 18) { score += 1; criteria.push(`Moderates P/E (${peRatio.toFixed(1)})`); }
              else if (peRatio > 35) { score -= 2; criteria.push(`Hohes P/E (${peRatio.toFixed(1)})`); }
              else if (peRatio > 25) { score -= 1; criteria.push(`Erhöhtes P/E (${peRatio.toFixed(1)})`); }
            }
            if (pegRatio !== null && pegRatio > 0) {
              if (pegRatio < 0.8) { score += 2; criteria.push(`Sehr attraktives PEG (${pegRatio.toFixed(2)})`); }
              else if (pegRatio < 1.2) { score += 1; criteria.push(`Faires PEG (${pegRatio.toFixed(2)})`); }
              else if (pegRatio > 2.5) { score -= 2; criteria.push(`Teures PEG (${pegRatio.toFixed(2)})`); }
            }
            if (dividendYield > 5) { score += 2; criteria.push(`Hohe Dividende (${dividendYield.toFixed(1)}%)`); }
            else if (dividendYield > 3) { score += 1; criteria.push(`Gute Dividende (${dividendYield.toFixed(1)}%)`); }
            if (rsi14 !== null) {
              if (rsi14 < 30) { score += 2; criteria.push(`RSI überverkauft (${rsi14.toFixed(0)})`); }
              else if (rsi14 < 40) { score += 1; criteria.push(`RSI niedrig (${rsi14.toFixed(0)})`); }
              else if (rsi14 > 75) { score -= 2; criteria.push(`RSI überkauft (${rsi14.toFixed(0)})`); }
              else if (rsi14 > 65) { score -= 1; criteria.push(`RSI hoch (${rsi14.toFixed(0)})`); }
            }

            if (score >= 5) { signalType = "buy"; signalStrength = "strong"; reason = "Starkes Kaufsignal: Mehrere positive Indikatoren."; targetPrice = currentPrice * 1.15; }
            else if (score >= 3) { signalType = "buy"; signalStrength = "moderate"; reason = "Kaufsignal: Positive Indikatoren überwiegen."; targetPrice = currentPrice * 1.10; }
            else if (score >= 1) { signalType = "buy"; signalStrength = "weak"; reason = "Leichte Kauftendenz: Einige positive Signale."; targetPrice = currentPrice * 1.05; }
            else if (score <= -5) { signalType = "sell"; signalStrength = "strong"; reason = "Starkes Verkaufssignal: Mehrere negative Indikatoren."; targetPrice = currentPrice * 0.85; }
            else if (score <= -3) { signalType = "sell"; signalStrength = "moderate"; reason = "Verkaufssignal: Negative Indikatoren überwiegen."; targetPrice = currentPrice * 0.90; }
            else if (score <= -1) { signalType = "sell"; signalStrength = "weak"; reason = "Leichte Verkaufstendenz."; targetPrice = currentPrice * 0.96; }

            // 4. ML + Quality + Momentum (only if enough price history)
            let rfSignal: string | undefined;
            let rfScore: number | undefined;
            let qualityGrade: string | undefined;
            let qualityScore: number | undefined;
            let momentumGrade: string | undefined;
            let momentumScore: number | undefined;
            let combinedScore: number | undefined;
            let combinedSignal: string | undefined;
            let overallGrade: string | undefined;
            let bubbleScore: number | undefined;
            let bubbleRegime: string | undefined;

            if (prices.length >= 60) {
              try {
                const rf = await signalForSeries(getActiveSignalModel, () => randomForestSignal(prices, [], { peRatio, pegRatio, dividendYield }), 'gb_signal', prices);
                rfSignal = rf.signal;
                rfScore = rf.score;
              } catch { /* silent */ }

              try {
                const bubbleResult = detectBubble({ prices });
                bubbleScore = bubbleResult.bubbleScore;
                bubbleRegime = bubbleResult.regime;
              } catch { /* silent */ }

              try {
                const qualityResult = calculateQualityScore({ roe: null, debtToEquity: null, fcfYield: null, grossMargin: null });
                qualityGrade = qualityResult.grade;
                qualityScore = qualityResult.score;
              } catch { /* silent */ }

              try {
                const momentumResult = calculateMomentumScore({ prices });
                momentumGrade = momentumResult.grade;
                momentumScore = momentumResult.score;
              } catch { /* silent */ }

              if (momentumScore !== undefined && qualityScore !== undefined) {
                try {
                  const bScore = bubbleScore ?? 0;
                  const bReg = bubbleRegime ?? 'normal';
                  const lpplPenalty = bReg === 'bubble' ? bScore * 0.5 : 0;
                  let regimeKey = 'default';
                  try { regimeKey = computeRegime(prices).regime; } catch { /* silent */ }
                  const blended = blendCombinedScore({ momentumScore, qualityScore, regime: regimeKey, lpplPenalty }, blendConfig);
                  combinedScore = blended.combinedScore;
                  overallGrade = blended.grade;
                  combinedSignal = blended.signalLabel;
                  // Override signal with combined model
                  if (blended.signalLabel === 'STRONG BUY' || blended.signalLabel === 'BUY') {
                    signalType = 'buy';
                    signalStrength = blended.signalLabel === 'STRONG BUY' ? 'strong' : 'moderate';
                  } else if (blended.signalLabel === 'STRONG SELL' || blended.signalLabel === 'SELL') {
                    signalType = 'sell';
                    signalStrength = blended.signalLabel === 'STRONG SELL' ? 'strong' : 'moderate';
                  } else {
                    signalType = 'hold';
                    signalStrength = 'moderate';
                  }
                } catch { /* silent */ }
              }
            }

            // 5. Upsert into cache
            await db.insert(stockSignalCache).values({
              ticker,
              companyName,
              signalType,
              signalStrength,
              currentPrice: currentPrice > 0 ? currentPrice.toFixed(4) : null,
              targetPrice: targetPrice > 0 ? targetPrice.toFixed(4) : null,
              peRatio: peRatio !== null ? peRatio.toFixed(2) : null,
              pegRatio: pegRatio !== null ? pegRatio.toFixed(2) : null,
              dividendYield: dividendYield > 0 ? dividendYield.toFixed(2) : null,
              ytdPerformance: ytdPerformance !== 0 ? ytdPerformance.toFixed(2) : null,
              fiftyTwoWeekHigh: fiftyTwoWeekHigh !== null ? fiftyTwoWeekHigh.toFixed(4) : null,
              fiftyTwoWeekLow: fiftyTwoWeekLow !== null ? fiftyTwoWeekLow.toFixed(4) : null,
              rsi14: rsi14 !== null ? rsi14.toFixed(1) : null,
              reason,
              criteria: criteria as any,
              rfSignal: rfSignal ?? null,
              rfScore: rfScore ?? null,
              qualityGrade: qualityGrade ?? null,
              qualityScore: qualityScore ?? null,
              momentumGrade: momentumGrade ?? null,
              momentumScore: momentumScore ?? null,
              combinedScore: combinedScore !== undefined ? combinedScore.toFixed(2) : null,
              combinedSignal: combinedSignal ?? null,
              overallGrade: overallGrade ?? null,
              bubbleScore: bubbleScore !== undefined ? bubbleScore.toFixed(4) : null,
              bubbleRegime: bubbleRegime ?? null,
              sentimentScore: null,
              sentimentLabel: null,
              computedAt: new Date(),
            }).onDuplicateKeyUpdate({
              set: {
                companyName,
                signalType,
                signalStrength,
                currentPrice: currentPrice > 0 ? currentPrice.toFixed(4) : null,
                targetPrice: targetPrice > 0 ? targetPrice.toFixed(4) : null,
                peRatio: peRatio !== null ? peRatio.toFixed(2) : null,
                pegRatio: pegRatio !== null ? pegRatio.toFixed(2) : null,
                dividendYield: dividendYield > 0 ? dividendYield.toFixed(2) : null,
                ytdPerformance: ytdPerformance !== 0 ? ytdPerformance.toFixed(2) : null,
                fiftyTwoWeekHigh: fiftyTwoWeekHigh !== null ? fiftyTwoWeekHigh.toFixed(4) : null,
                fiftyTwoWeekLow: fiftyTwoWeekLow !== null ? fiftyTwoWeekLow.toFixed(4) : null,
                rsi14: rsi14 !== null ? rsi14.toFixed(1) : null,
                reason,
                criteria: criteria as any,
                rfSignal: rfSignal ?? null,
                rfScore: rfScore ?? null,
                qualityGrade: qualityGrade ?? null,
                qualityScore: qualityScore ?? null,
                momentumGrade: momentumGrade ?? null,
                momentumScore: momentumScore ?? null,
                combinedScore: combinedScore !== undefined ? combinedScore.toFixed(2) : null,
                combinedSignal: combinedSignal ?? null,
                overallGrade: overallGrade ?? null,
                bubbleScore: bubbleScore !== undefined ? bubbleScore.toFixed(4) : null,
                bubbleRegime: bubbleRegime ?? null,
                computedAt: new Date(),
              },
            });
            saved++;
          } catch (e) {
            console.warn(`[signalCacheCron] Error for ${stock.ticker}:`, (e as Error).message);
            failed++;
          }
        })
      );
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[signalCacheCron] Done: ${saved} cached, ${failed} failed in ${elapsed}s`);
  } catch (err) {
    console.error("[signalCacheCron] Fatal error:", err);
  } finally {
    isRunning = false;
  }
}

/**
 * Calculate RSI from closing prices
 */
function calcRSI(prices: number[], period: number = 14): number | null {
  if (prices.length < period + 1) return null;
  const changes: number[] = [];
  for (let i = 1; i < prices.length; i++) changes.push(prices[i] - prices[i - 1]);
  const relevant = changes.slice(-period * 3);
  if (relevant.length < period) return null;
  let avgGain = 0, avgLoss = 0;
  for (let i = 0; i < period; i++) {
    if (relevant[i] > 0) avgGain += relevant[i];
    else avgLoss += Math.abs(relevant[i]);
  }
  avgGain /= period;
  avgLoss /= period;
  for (let i = period; i < relevant.length; i++) {
    const c = relevant[i];
    if (c > 0) { avgGain = (avgGain * (period - 1) + c) / period; avgLoss = (avgLoss * (period - 1)) / period; }
    else { avgGain = (avgGain * (period - 1)) / period; avgLoss = (avgLoss * (period - 1) + Math.abs(c)) / period; }
  }
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

/**
 * Initialize the signal cache cron (runs every 2 hours)
 */
export function initSignalCacheCron(): void {
  // Run immediately on startup (after 2 minute delay to let server warm up)
  setTimeout(() => {
    refreshSignalCache().catch((e) => console.error("[signalCacheCron] Initial run failed:", e));
  }, 2 * 60 * 1000);

  // Then every 2 hours
  setInterval(() => {
    refreshSignalCache().catch((e) => console.error("[signalCacheCron] Scheduled run failed:", e));
  }, 2 * 60 * 60 * 1000);

  console.log("[signalCacheCron] Initialized (runs every 2h, first run in 2min)");
}
