/**
 * Watchlist Alerts Cron Job
 * 
 * Checks all active watchlist stocks for strong buy/sell signals
 * and sends notifications to the admin when triggered.
 * 
 * Schedule: Every 4 hours during market hours
 */

import { notifyOwner } from "../_core/notification";
import { isLikelyIsin } from "../lib/isinResolver";

let isRunning = false;

/**
 * Check watchlist stocks for strong signals and notify admin
 */
export async function checkWatchlistAlerts() {
  if (isRunning) {
    console.log("[watchlistAlertsCron] Job already running, skipping...");
    return;
  }

  isRunning = true;
  console.log("[watchlistAlertsCron] Starting watchlist alerts check...");

  try {
    const { getDb } = await import("../db");
    const { stocks: stocksTable, alertConfig: alertConfigTable } = await import("../../drizzle/schema");
    const { activeCurated } = await import("../lib/stockUniverse");
    const { eq, and } = await import("drizzle-orm");
    const YahooFinanceClass = (await import("yahoo-finance2")).default;
    const yahooFinance: any = new (YahooFinanceClass as any)();
    // Normalize ticker for Yahoo Finance (remove .US suffix, keep .SW etc.)
    function normalizeTicker(ticker: string): string {
      if (ticker.endsWith('.US')) return ticker.slice(0, -3);
      if (ticker.endsWith('.SW')) return ticker.slice(0, -3) + '.SW';
      return ticker;
    }

    const db = await getDb();
    if (!db) {
      console.error("[watchlistAlertsCron] Database not available");
      return;
    }

    // Get all active watchlist stocks
    const stocks = await db
      .select()
      .from(stocksTable)
      .where(activeCurated());

    if (stocks.length === 0) {
      console.log("[watchlistAlertsCron] No active watchlist stocks to check");
      return;
    }

    // L-20: Alt-Einträge, die eine ISIN statt eines Yahoo-Tickers tragen (Wikifolio-Importe
    // vor dem F-15-ISIN-Fix), liefern bei Yahoo garantiert «Quote not found» und fluteten die
    // Logs mit einer Warnung pro Zeile. Solche Zeilen einmal aggregiert melden und überspringen.
    const isinRows = stocks.filter((s: any) => isLikelyIsin(s.ticker));
    const checkableStocks = stocks.filter((s: any) => !isLikelyIsin(s.ticker));
    if (isinRows.length > 0) {
      console.warn(
        `[watchlistAlertsCron] ${isinRows.length} Watchlist-Einträge mit ISIN statt Ticker übersprungen ` +
        `(Alt-Importe — bitte ISIN→Ticker bereinigen).`
      );
    }

    // Load alert configuration from DB (with fallback to defaults)
    const configRows = await db.select().from(alertConfigTable).limit(1);
    const cfg = configRows.length > 0 ? configRows[0] : null;
    const C = {
      peLow: cfg ? parseFloat(cfg.peLow as string) : 15,
      peMedium: cfg ? parseFloat(cfg.peMedium as string) : 20,
      peHigh: cfg ? parseFloat(cfg.peHigh as string) : 40,
      peVeryHigh: cfg ? parseFloat(cfg.peVeryHigh as string) : 60,
      peLowPoints: cfg?.peLowPoints ?? 12,
      peMediumPoints: cfg?.peMediumPoints ?? 6,
      peHighPoints: cfg?.peHighPoints ?? -8,
      peVeryHighPoints: cfg?.peVeryHighPoints ?? -15,
      divHigh: cfg ? parseFloat(cfg.divHigh as string) : 0.04,
      divMedium: cfg ? parseFloat(cfg.divMedium as string) : 0.025,
      divHighPoints: cfg?.divHighPoints ?? 12,
      divMediumPoints: cfg?.divMediumPoints ?? 6,
      week52NearLow: cfg ? parseFloat(cfg.week52NearLow as string) : 0.20,
      week52BelowMid: cfg ? parseFloat(cfg.week52BelowMid as string) : 0.35,
      week52NearHigh: cfg ? parseFloat(cfg.week52NearHigh as string) : 0.95,
      week52NearLowPoints: cfg?.week52NearLowPoints ?? 15,
      week52BelowMidPoints: cfg?.week52BelowMidPoints ?? 8,
      week52NearHighPoints: cfg?.week52NearHighPoints ?? -10,
      pegVeryLow: cfg ? parseFloat(cfg.pegVeryLow as string) : 0.80,
      pegModerate: cfg ? parseFloat(cfg.pegModerate as string) : 1.20,
      pegHigh: cfg ? parseFloat(cfg.pegHigh as string) : 3.00,
      pegVeryLowPoints: cfg?.pegVeryLowPoints ?? 12,
      pegModeratePoints: cfg?.pegModeratePoints ?? 5,
      pegHighPoints: cfg?.pegHighPoints ?? -8,
      buyTriggerScore: cfg?.buyTriggerScore ?? 75,
      sellTriggerScore: cfg?.sellTriggerScore ?? 25,
      buyPreviousScoreThreshold: cfg?.buyPreviousScoreThreshold ?? 70,
      sellPreviousScoreThreshold: cfg?.sellPreviousScoreThreshold ?? 35,
      scoreChangeTrigger: cfg?.scoreChangeTrigger ?? 10,
    };
    console.log(`[watchlistAlertsCron] Using config: buyTrigger=${C.buyTriggerScore}, sellTrigger=${C.sellTriggerScore}`);

    console.log(`[watchlistAlertsCron] Checking ${checkableStocks.length} watchlist stocks...`);

    const strongBuySignals: Array<{
      ticker: string;
      companyName: string;
      score: number;
      reasons: string[];
      currentPrice: string;
      previousScore: number;
    }> = [];

    const strongSellSignals: Array<{
      ticker: string;
      companyName: string;
      score: number;
      reasons: string[];
      currentPrice: string;
      previousScore: number;
    }> = [];

    for (const stock of checkableStocks) {
      try {
        const yahooTicker = normalizeTicker(stock.ticker);
        const quote: any = await yahooFinance.quoteSummary(yahooTicker, {
          modules: ["price", "summaryDetail", "defaultKeyStatistics"] as any,
        });

        const price = quote?.price;
        const summary = quote?.summaryDetail;
        const keyStats = quote?.defaultKeyStatistics;

        if (!price) continue;

        // Calculate signal score
        let signalScore = 50;
        const reasons: string[] = [];

        // P/E scoring (using DB config)
        const pe = summary?.trailingPE;
        if (pe && pe < C.peLow) { signalScore += C.peLowPoints; reasons.push(`Niedriges P/E (${pe.toFixed(1)})`); }
        else if (pe && pe < C.peMedium) { signalScore += C.peMediumPoints; reasons.push(`Moderates P/E (${pe.toFixed(1)})`); }
        else if (pe && pe > C.peVeryHigh) { signalScore += C.peVeryHighPoints; reasons.push(`Sehr hohes P/E (${pe.toFixed(1)})`); }
        else if (pe && pe > C.peHigh) { signalScore += C.peHighPoints; reasons.push(`Hohes P/E (${pe.toFixed(1)})`); }

        // Dividend scoring (using DB config)
        const divYield = summary?.dividendYield;
        if (divYield && divYield > C.divHigh) { signalScore += C.divHighPoints; reasons.push(`Hohe Dividende (${(divYield * 100).toFixed(1)}%)`); }
        else if (divYield && divYield > C.divMedium) { signalScore += C.divMediumPoints; reasons.push(`Gute Dividende (${(divYield * 100).toFixed(1)}%)`); }

        // 52W position scoring (using DB config)
        const high = summary?.fiftyTwoWeekHigh;
        const low = summary?.fiftyTwoWeekLow;
        const current = price?.regularMarketPrice;
        if (high && low && current && high !== low) {
          const position = (current - low) / (high - low);
          if (position < C.week52NearLow) { signalScore += C.week52NearLowPoints; reasons.push(`Nahe 52W-Tief (${(position * 100).toFixed(0)}%)`); }
          else if (position < C.week52BelowMid) { signalScore += C.week52BelowMidPoints; reasons.push(`Unter 52W-Mitte (${(position * 100).toFixed(0)}%)`); }
          else if (position > C.week52NearHigh) { signalScore += C.week52NearHighPoints; reasons.push(`Am 52W-Hoch (${(position * 100).toFixed(0)}%)`); }
        }

        // PEG scoring (using DB config)
        const peg = keyStats?.pegRatio;
        if (peg && peg < C.pegVeryLow) { signalScore += C.pegVeryLowPoints; reasons.push(`PEG sehr niedrig (${peg.toFixed(2)})`); }
        else if (peg && peg < C.pegModerate) { signalScore += C.pegModeratePoints; reasons.push(`PEG moderat (${peg.toFixed(2)})`); }
        else if (peg && peg > C.pegHigh) { signalScore += C.pegHighPoints; reasons.push(`PEG hoch (${peg.toFixed(2)})`); }

        signalScore = Math.max(0, Math.min(100, signalScore));
        const signalType = signalScore >= 70 ? "buy" : signalScore <= 30 ? "sell" : "hold";
        const previousScore = stock.signalScore || 50;

        // Update the stock in DB with new metrics
        await db.update(stocksTable).set({
          currentPrice: current?.toString() || stock.currentPrice,
          peRatio: pe?.toString() || stock.peRatio,
          pegRatio: peg?.toString() || stock.pegRatio,
          dividendYield: divYield ? (divYield * 100).toString() : stock.dividendYield,
          week52High: high?.toString() || stock.week52High,
          week52Low: low?.toString() || stock.week52Low,
          signalScore,
          signalType: signalType as "buy" | "sell" | "hold",
          lastMetricsUpdate: new Date(),
        }).where(eq(stocksTable.id, stock.id));

        // Check for strong signals (using DB config thresholds)
        if (signalScore >= C.buyTriggerScore && (previousScore < C.buyPreviousScoreThreshold || signalScore - previousScore >= C.scoreChangeTrigger)) {
          strongBuySignals.push({
            ticker: stock.ticker,
            companyName: stock.companyName || stock.ticker,
            score: signalScore,
            reasons,
            currentPrice: current?.toString() || "—",
            previousScore,
          });
        } else if (signalScore <= C.sellTriggerScore && (previousScore > C.sellPreviousScoreThreshold || previousScore - signalScore >= C.scoreChangeTrigger)) {
          strongSellSignals.push({
            ticker: stock.ticker,
            companyName: stock.companyName || stock.ticker,
            score: signalScore,
            reasons,
            currentPrice: current?.toString() || "—",
            previousScore,
          });
        }
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        // Only log once for known delisted/not-found symbols
        if (errMsg.includes('not found') || errMsg.includes('No fundamentals') || errMsg.includes('404')) {
          console.warn(`[watchlistAlertsCron] Error checking ${stock.ticker}: ${errMsg}`);
          // Mark as inactive if consistently failing
          try {
            await db.update(stocksTable).set({
              signalType: 'hold' as const,
              lastMetricsUpdate: new Date(),
            }).where(eq(stocksTable.id, stock.id));
          } catch {}
        } else {
          console.warn(`[watchlistAlertsCron] Error checking ${stock.ticker}:`, err);
        }
      }

      // Rate limiting
      await new Promise(r => setTimeout(r, 400));
    }

    // Send notification if there are strong signals
    if (strongBuySignals.length > 0 || strongSellSignals.length > 0) {
      let content = "";

      if (strongBuySignals.length > 0) {
        content += "🟢 STARKE KAUFSIGNALE:\n\n";
        for (const signal of strongBuySignals) {
          content += `• ${signal.ticker} (${signal.companyName})\n`;
          content += `  Score: ${signal.score}/100 (vorher: ${signal.previousScore})\n`;
          content += `  Kurs: ${signal.currentPrice}\n`;
          content += `  Gründe: ${signal.reasons.join(", ")}\n\n`;
        }
      }

      if (strongSellSignals.length > 0) {
        content += "🔴 STARKE VERKAUFSSIGNALE:\n\n";
        for (const signal of strongSellSignals) {
          content += `• ${signal.ticker} (${signal.companyName})\n`;
          content += `  Score: ${signal.score}/100 (vorher: ${signal.previousScore})\n`;
          content += `  Kurs: ${signal.currentPrice}\n`;
          content += `  Gründe: ${signal.reasons.join(", ")}\n\n`;
        }
      }

      const title = `Watchlist-Alert: ${strongBuySignals.length} Kaufsignal${strongBuySignals.length !== 1 ? "e" : ""}, ${strongSellSignals.length} Verkaufssignal${strongSellSignals.length !== 1 ? "e" : ""}`;

      try {
        await notifyOwner({ title, content });
        console.log(`[watchlistAlertsCron] Notification sent: ${title}`);
      } catch (notifyErr) {
        console.error("[watchlistAlertsCron] Failed to send notification:", notifyErr);
      }

      // Also try WhatsApp notification
      try {
        const { sendWhatsAppMessage } = await import("../_core/whatsapp");
        const whatsappMsg = `📊 Watchlist-Alert:\n${strongBuySignals.map(s => `🟢 ${s.ticker} (Score: ${s.score})`).join("\n")}${strongSellSignals.length > 0 ? "\n" + strongSellSignals.map(s => `🔴 ${s.ticker} (Score: ${s.score})`).join("\n") : ""}`;
        
        // Send to configured admin number
        const adminNumber = process.env.VITE_WHATSAPP_NUMBER;
        if (adminNumber) {
          await sendWhatsAppMessage(adminNumber, whatsappMsg);
          console.log("[watchlistAlertsCron] WhatsApp notification sent");
        }
      } catch (whatsappErr) {
        console.warn("[watchlistAlertsCron] WhatsApp notification failed:", whatsappErr);
      }
    } else {
      console.log("[watchlistAlertsCron] No strong signals detected");
    }

    console.log(`[watchlistAlertsCron] Check completed. Buy signals: ${strongBuySignals.length}, Sell signals: ${strongSellSignals.length}`);
  } catch (error) {
    console.error("[watchlistAlertsCron] Fatal error:", error);
  } finally {
    isRunning = false;
  }
}

/**
 * Initialize the watchlist alerts cron job
 * Runs every 4 hours during market hours (6:00-22:00 UTC)
 */
export function initWatchlistAlertsCron() {
  console.log("[watchlistAlertsCron] Initializing watchlist alerts cron job...");

  // Run initial check after 2 minutes (let other services start first)
  setTimeout(() => {
    checkWatchlistAlerts().catch((error) => {
      console.error("[watchlistAlertsCron] Error during initial check:", error);
    });
  }, 2 * 60 * 1000);

  // Schedule checks every 4 hours
  const INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours

  setInterval(() => {
    // Only run during market hours (6:00-22:00 UTC)
    const hour = new Date().getUTCHours();
    if (hour >= 6 && hour <= 22) {
      checkWatchlistAlerts().catch((error) => {
        console.error("[watchlistAlertsCron] Error during scheduled check:", error);
      });
    } else {
      console.log("[watchlistAlertsCron] Outside market hours, skipping...");
    }
  }, INTERVAL_MS);

  console.log("[watchlistAlertsCron] Cron job initialized (every 4h, 06:00-22:00 UTC)");
}
