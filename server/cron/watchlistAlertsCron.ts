/**
 * Watchlist Alerts Cron Job
 *
 * K2 (EIN Signal für Badges & Alerts): Aktualisiert alle 4 h die Markt-
 * Kennzahlen (EODHD-Quote) und übernimmt `stocks.signalScore`/`signalType` aus dem
 * Drei-Score-Signal (stock_signal_cache) — dieselbe Rechnung, die der Kunde
 * auf der Titelseite sieht. Hinweise (Push/WhatsApp) feuern nur am starken
 * Rand des Kernsignals, beim Zustands-Übergang, mit Cooldown.
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
    const { stocks: stocksTable, stockSignalCache } = await import("../../drizzle/schema");
    const { activeCurated } = await import("../lib/stockUniverse");
    const { signalFelderAusCache, alertEntscheid } = await import("../lib/kernsignalUebernahme");
    const { projectCoreSignalDataQuality } = await import("../lib/coreSignalDataQuality");
    const { eq, inArray } = await import("drizzle-orm");
    const { fetchEODHDRealTime } = await import("../_core/eodhdApi");

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

    console.log(`[watchlistAlertsCron] Checking ${checkableStocks.length} watchlist stocks...`);

    // K2: Kernsignal-Zeilen (Drei-Score-Signal) für alle Titel in EINEM Query —
    // die einzige Quelle für signalScore/signalType und die Alert-Entscheide.
    const ALERT_COOLDOWN_TAGE = 7;
    const tickers = checkableStocks.map((s: any) => s.ticker).filter(Boolean);
    const cacheRows = tickers.length
      ? await db
          .select({
            ticker: stockSignalCache.ticker,
            combinedScore: stockSignalCache.combinedScore,
            signalType: stockSignalCache.signalType,
            signalStrength: stockSignalCache.signalStrength,
            reason: stockSignalCache.reason,
          })
          .from(stockSignalCache)
          .where(inArray(stockSignalCache.ticker, tickers))
      : [];
    const cacheMap = new Map(cacheRows.map((c: any) => [c.ticker, c]));

    const starkeZustaende: Array<{
      ticker: string;
      companyName: string;
      score: number;
      currentPrice: string;
      previousScore: number | null;
    }> = [];

    const schwacheZustaende: Array<{
      ticker: string;
      companyName: string;
      score: number;
      currentPrice: string;
      previousScore: number | null;
    }> = [];
    let refreshedQuotes = 0;

    for (const stock of checkableStocks) {
      // 1) Aktuellen Quote nur von EODHD auffrischen. Ein Yahoo-Quote darf
      // nie neben einer EODHD-Splitreihe gespeichert werden: Diese Mischung
      // verursachte nach SQN.SW 1:10 und KLAC 1:10 Phantom-YTD-Werte.
      let currentPriceStr: string | null = stock.currentPrice ?? null;
      try {
        const quote = await fetchEODHDRealTime(stock.ticker);
        if (quote.close != null && quote.close > 0) {
          currentPriceStr = quote.close.toString();
          await db.update(stocksTable).set({
            currentPrice: currentPriceStr,
          }).where(eq(stocksTable.id, stock.id));
          refreshedQuotes += 1;
        }
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        console.warn(`[watchlistAlertsCron] EODHD-Quote fehlgeschlagen für ${stock.ticker}: ${errMsg}`);
      }

      // 2) Signalspalten IMMER aus dem Kernsignal übernehmen (auch wenn der
      //    Yahoo-Abruf scheiterte — das Signal hängt nicht an Yahoo).
      try {
        const cache = cacheMap.get(stock.ticker);
        const felder = signalFelderAusCache(cache);
        const dataQuality = projectCoreSignalDataQuality({
          signalScore: felder.signalScore,
          reason: cache?.reason,
          dataQualityStatus: stock.dataQualityStatus,
          dataQualityNotes: stock.dataQualityNotes,
        });
        const previousScore = stock.signalScore ?? null;
        const previousType = stock.signalType ?? null;
        await db.update(stocksTable).set({
          signalScore: felder.signalScore,
          signalType: felder.signalType,
          ...dataQuality,
        }).where(eq(stocksTable.id, stock.id));

        // 3) Hinweis-Entscheid: nur starker Rand, nur beim Übergang, mit Cooldown.
        const lastAlert = stock.lastAlertSentAt ? new Date(stock.lastAlertSentAt) : null;
        const tageSeitLetztemAlert = lastAlert
          ? (Date.now() - lastAlert.getTime()) / (1000 * 60 * 60 * 24)
          : Infinity;
        const entscheid = alertEntscheid({
          typ: cache?.signalType ?? null,
          staerke: cache?.signalStrength ?? null,
          score: felder.signalScore,
          vorherTyp: previousType,
          vorherScore: previousScore,
          tageSeitLetztemAlert,
          cooldownTage: ALERT_COOLDOWN_TAGE,
        });
        if (entscheid) {
          const eintrag = {
            ticker: stock.ticker,
            companyName: stock.companyName || stock.ticker,
            score: felder.signalScore as number,
            currentPrice: currentPriceStr || "—",
            previousScore,
          };
          if (entscheid === "stark") starkeZustaende.push(eintrag);
          else schwacheZustaende.push(eintrag);
        }
      } catch (err: any) {
        console.warn(`[watchlistAlertsCron] Signal-Übernahme fehlgeschlagen für ${stock.ticker}:`, err?.message || err);
      }

      // Rate limiting
      await new Promise(r => setTimeout(r, 400));
    }

    // Re-anchor derived performance fields after EODHD updates the point quote.
    // This keeps the live close and the YTD numerator on one proven split basis
    // and avoids reintroducing the old SQN/KLAC-style quote-versus-baseline gap.
    if (refreshedQuotes > 0) {
      const { refreshSplitAdjustedMarketMetrics } = await import("../lib/refreshSplitAdjustedMarketMetrics");
      const result = await refreshSplitAdjustedMarketMetrics({
        tickers,
        asOf: new Date(),
        preserveExistingCurrentPrice: true,
      });
      console.log(
        `[watchlistAlertsCron] Splitbasis nach ${refreshedQuotes} Quotes synchronisiert: ` +
        `${result.updated} aktualisiert, ${result.blocked} gesperrt, ${result.skipped} übersprungen.`,
      );
    }

    // Hinweis senden, wenn Titel neu am starken Rand des Kernsignals stehen.
    if (starkeZustaende.length > 0 || schwacheZustaende.length > 0) {
      let content = "";
      const zeile = (s: { ticker: string; companyName: string; score: number; currentPrice: string; previousScore: number | null }) =>
        `• ${s.ticker} (${s.companyName})\n  Signal: ${s.score}/100 (vorher: ${s.previousScore ?? "—"})\n  Kurs: ${s.currentPrice}\n\n`;

      if (starkeZustaende.length > 0) {
        content += "🟢 SEHR GUTER ZUSTAND (Qualität + Timing):\n\n";
        for (const s of starkeZustaende) content += zeile(s);
      }

      if (schwacheZustaende.length > 0) {
        content += "🔴 SCHWACHER ZUSTAND:\n\n";
        for (const s of schwacheZustaende) content += zeile(s);
      }

      const title = `Watchlist-Hinweis: ${starkeZustaende.length} Titel im sehr guten, ${schwacheZustaende.length} im schwachen Zustand`;

      try {
        await notifyOwner({ title, content });
        console.log(`[watchlistAlertsCron] Notification sent: ${title}`);

        // Update lastAlertSentAt for all alerted stocks (for cooldown tracking)
        const alertedTickers = [
          ...starkeZustaende.map(s => s.ticker),
          ...schwacheZustaende.map(s => s.ticker),
        ];
        if (alertedTickers.length > 0) {
          await db.update(stocksTable)
            .set({ lastAlertSentAt: new Date() })
            .where(inArray(stocksTable.ticker, alertedTickers));
          console.log(`[watchlistAlertsCron] lastAlertSentAt updated for: ${alertedTickers.join(", ")}`);
        }
      } catch (notifyErr) {
        console.error("[watchlistAlertsCron] Failed to send notification:", notifyErr);
      }

      // Also try WhatsApp notification
      try {
        const { sendWhatsAppMessage } = await import("../_core/whatsapp");
        const whatsappMsg = `📊 Watchlist-Hinweis:\n${starkeZustaende.map(s => `🟢 ${s.ticker} (Signal: ${s.score})`).join("\n")}${schwacheZustaende.length > 0 ? "\n" + schwacheZustaende.map(s => `🔴 ${s.ticker} (Signal: ${s.score})`).join("\n") : ""}`;

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
      console.log("[watchlistAlertsCron] No strong-state transitions detected");
    }

    console.log(`[watchlistAlertsCron] Check completed. Stark: ${starkeZustaende.length}, Schwach: ${schwacheZustaende.length}`);
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
