/**
 * Shared price-alerts check (D-03, OPTIMIZATION_PLAN.md).
 *
 * Extracted from the near-identical bodies of cron/priceAlertsCron.ts and
 * scheduled/priceAlertsScheduled.ts so both scheduling mechanisms run the
 * same logic. Checks all active price alerts against current stock prices
 * and sends user notifications (email/WhatsApp). The scheduled HTTP handler
 * additionally notifies the owner using the returned messages.
 */
import { getDb } from "../db";
import { priceAlerts, stocks as stocksTable, users, historicalPrices } from "../../drizzle/schema";
import { eq, and, inArray } from "drizzle-orm";

/** Shared job-lock identity for both entry points (cron + scheduled). */
export const PRICE_ALERTS_JOB_NAME = "priceAlertsCheck";
/**
 * Minimum interval between checks. The in-process cron runs hourly and the
 * Heartbeat endpoint is documented at 5-minute cadence; 30 minutes prevents
 * the double-fire while both mechanisms stay wired (D-03).
 */
export const PRICE_ALERTS_MIN_INTERVAL_MINUTES = 30;

export interface PriceAlertsCheckResult {
  triggered: number;
  total: number;
  messages: string[];
}

export async function runPriceAlertsCheck(): Promise<PriceAlertsCheckResult> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // Get all active alerts
  const alerts = await db
    .select()
    .from(priceAlerts)
    .where(eq(priceAlerts.isActive, 1));

  if (alerts.length === 0) {
    console.log("[PriceAlerts] No active price alerts found");
    return { triggered: 0, total: 0, messages: [] };
  }

  console.log(`[PriceAlerts] Checking ${alerts.length} active alerts...`);

  // Get current prices for all tickers
  const tickers = Array.from(new Set(alerts.map((a) => a.ticker)));
  const stockRows = await db
    .select()
    .from(stocksTable)
    .where(inArray(stocksTable.ticker, tickers));

  const stockPriceMap = new Map(
    stockRows.map((s) => [s.ticker, parseFloat(s.currentPrice || "0")])
  );

  let triggeredCount = 0;
  const triggeredAlerts: string[] = [];

  // Check each alert
  for (const alert of alerts) {
    const currentPrice = stockPriceMap.get(alert.ticker);
    if (!currentPrice || currentPrice === 0) {
      console.warn(`[PriceAlerts] No price data for ${alert.ticker}`);
      continue;
    }

    let shouldTrigger = false;
    let message = "";

    if (alert.alertType === "above_price" && alert.targetPrice) {
      const targetPrice = parseFloat(alert.targetPrice);
      if (currentPrice >= targetPrice) {
        shouldTrigger = true;
        message = `📈 ${alert.ticker} ist über ${targetPrice.toFixed(2)} gestiegen (aktuell: ${currentPrice.toFixed(2)})`;
      }
    } else if (alert.alertType === "below_price" && alert.targetPrice) {
      const targetPrice = parseFloat(alert.targetPrice);
      if (currentPrice <= targetPrice) {
        shouldTrigger = true;
        message = `📉 ${alert.ticker} ist unter ${targetPrice.toFixed(2)} gefallen (aktuell: ${currentPrice.toFixed(2)})`;
      }
    } else if (alert.alertType === "percent_change" && alert.percentChange) {
      const percentThreshold = parseFloat(alert.percentChange);
      const lastTriggerDate = alert.lastTriggered || alert.createdAt;
      const dateStr = new Date(lastTriggerDate).toISOString().split("T")[0];

      const [historicalPrice] = await db
        .select()
        .from(historicalPrices)
        .where(
          and(
            eq(historicalPrices.ticker, alert.ticker),
            eq(historicalPrices.date, dateStr)
          )
        )
        .limit(1);

      if (historicalPrice && historicalPrice.close) {
        const oldPrice = parseFloat(historicalPrice.close);
        const percentChange = ((currentPrice - oldPrice) / oldPrice) * 100;

        if (Math.abs(percentChange) >= percentThreshold) {
          shouldTrigger = true;
          const direction = percentChange > 0 ? "📈" : "📉";
          message = `${direction} ${alert.ticker} hat sich um ${percentChange.toFixed(2)}% verändert (von ${oldPrice.toFixed(2)} auf ${currentPrice.toFixed(2)})`;
        }
      }
    }

    if (shouldTrigger) {
      console.log(`[PriceAlerts] Alert triggered for ${alert.ticker}: ${message}`);

      // Get user information
      const [alertUser] = await db.select().from(users).where(eq(users.id, alert.userId)).limit(1);

      // Send notifications
      if (alert.notificationMethod === "email" || alert.notificationMethod === "both") {
        try {
          const { sendEmail } = await import("../_core/email");

          if (alertUser && alertUser.email) {
            await sendEmail({
              to: alertUser.email,
              subject: `Preis-Alert: ${alert.ticker}`,
              html: `<div style="font-family: sans-serif; padding: 20px;">
                <h2 style="color: #00CFC1;">Preis-Alert ausgelöst</h2>
                <p style="font-size: 16px;">${message}</p>
                <p style="color: #666; font-size: 14px;">Erstellt am: ${new Date(alert.createdAt).toLocaleDateString('de-CH')}</p>
                <hr style="border-color: #eee;" />
                <p style="color: #999; font-size: 12px;">Interaktive Aktien Portfolio Analyse</p>
              </div>`,
            });
            console.log(`[PriceAlerts] Email sent for alert ${alert.id}`);
          }
        } catch (emailError) {
          console.error(`[PriceAlerts] Email failed for alert ${alert.id}:`, emailError);
        }
      }

      if (alert.notificationMethod === "whatsapp" || alert.notificationMethod === "both") {
        try {
          const { sendWhatsAppMessage } = await import("../_core/whatsapp");

          if (alertUser && (alertUser as any).mobile && (alertUser as any).whatsappAlerts) {
            await sendWhatsAppMessage((alertUser as any).mobile, message);
            console.log(`[PriceAlerts] WhatsApp sent for alert ${alert.id}`);
          }
        } catch (whatsappError) {
          console.error(`[PriceAlerts] WhatsApp failed for alert ${alert.id}:`, whatsappError);
        }
      }

      // Update alert status to triggered
      await db
        .update(priceAlerts)
        .set({
          lastTriggered: new Date(),
          triggeredAt: new Date(),
          status: "triggered",
        })
        .where(eq(priceAlerts.id, alert.id));

      triggeredCount++;
      triggeredAlerts.push(message);
    }
  }

  console.log(`[PriceAlerts] Check completed: ${triggeredCount}/${alerts.length} triggered`);
  return { triggered: triggeredCount, total: alerts.length, messages: triggeredAlerts };
}
