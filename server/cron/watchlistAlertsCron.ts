/**
 * Watchlist Alerts Cron Job
 * 
 * Checks all active watchlist stocks for strong buy/sell signals
 * and sends notifications to the admin when triggered.
 * 
 * Schedule: Every 4 hours during market hours
 */

import { notifyOwner } from "../_core/notification";

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
    const { watchlistStocks } = await import("../../drizzle/schema");
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
      .from(watchlistStocks)
      .where(eq(watchlistStocks.isActive, 1));

    if (stocks.length === 0) {
      console.log("[watchlistAlertsCron] No active watchlist stocks to check");
      return;
    }

    console.log(`[watchlistAlertsCron] Checking ${stocks.length} watchlist stocks...`);

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

    for (const stock of stocks) {
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

        // P/E scoring
        const pe = summary?.trailingPE;
        if (pe && pe < 15) { signalScore += 12; reasons.push(`Niedriges P/E (${pe.toFixed(1)})`); }
        else if (pe && pe < 20) { signalScore += 6; reasons.push(`Moderates P/E (${pe.toFixed(1)})`); }
        else if (pe && pe > 40) { signalScore -= 8; reasons.push(`Hohes P/E (${pe.toFixed(1)})`); }
        else if (pe && pe > 60) { signalScore -= 15; reasons.push(`Sehr hohes P/E (${pe.toFixed(1)})`); }

        // Dividend scoring
        const divYield = summary?.dividendYield;
        if (divYield && divYield > 0.04) { signalScore += 12; reasons.push(`Hohe Dividende (${(divYield * 100).toFixed(1)}%)`); }
        else if (divYield && divYield > 0.025) { signalScore += 6; reasons.push(`Gute Dividende (${(divYield * 100).toFixed(1)}%)`); }

        // 52W position scoring
        const high = summary?.fiftyTwoWeekHigh;
        const low = summary?.fiftyTwoWeekLow;
        const current = price?.regularMarketPrice;
        if (high && low && current && high !== low) {
          const position = (current - low) / (high - low);
          if (position < 0.2) { signalScore += 15; reasons.push(`Nahe 52W-Tief (${(position * 100).toFixed(0)}%)`); }
          else if (position < 0.35) { signalScore += 8; reasons.push(`Unter 52W-Mitte (${(position * 100).toFixed(0)}%)`); }
          else if (position > 0.95) { signalScore -= 10; reasons.push(`Am 52W-Hoch (${(position * 100).toFixed(0)}%)`); }
        }

        // PEG scoring
        const peg = keyStats?.pegRatio;
        if (peg && peg < 0.8) { signalScore += 12; reasons.push(`PEG sehr niedrig (${peg.toFixed(2)})`); }
        else if (peg && peg < 1.2) { signalScore += 5; reasons.push(`PEG moderat (${peg.toFixed(2)})`); }
        else if (peg && peg > 3) { signalScore -= 8; reasons.push(`PEG hoch (${peg.toFixed(2)})`); }

        signalScore = Math.max(0, Math.min(100, signalScore));
        const signalType = signalScore >= 70 ? "buy" : signalScore <= 30 ? "sell" : "hold";
        const previousScore = stock.signalScore || 50;

        // Update the stock in DB with new metrics
        await db.update(watchlistStocks).set({
          currentPrice: current?.toString() || stock.currentPrice,
          peRatio: pe?.toString() || stock.peRatio,
          pegRatio: peg?.toString() || stock.pegRatio,
          dividendYield: divYield ? (divYield * 100).toString() : stock.dividendYield,
          week52High: high?.toString() || stock.week52High,
          week52Low: low?.toString() || stock.week52Low,
          signalScore,
          signalType: signalType as "buy" | "sell" | "hold",
          lastMetricsUpdate: new Date(),
        }).where(eq(watchlistStocks.id, stock.id));

        // Check for strong signals (score change of 15+ or absolute strong signal)
        if (signalScore >= 75 && (previousScore < 70 || signalScore - previousScore >= 10)) {
          strongBuySignals.push({
            ticker: stock.ticker,
            companyName: stock.companyName || stock.ticker,
            score: signalScore,
            reasons,
            currentPrice: current?.toString() || "—",
            previousScore,
          });
        } else if (signalScore <= 25 && (previousScore > 35 || previousScore - signalScore >= 10)) {
          strongSellSignals.push({
            ticker: stock.ticker,
            companyName: stock.companyName || stock.ticker,
            score: signalScore,
            reasons,
            currentPrice: current?.toString() || "—",
            previousScore,
          });
        }
      } catch (err) {
        console.warn(`[watchlistAlertsCron] Error checking ${stock.ticker}:`, err);
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
