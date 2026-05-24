/**
 * Price Alerts Scheduled Handler
 * ==============================
 * Heartbeat-triggered endpoint that checks all active price alerts
 * against current stock prices and sends notifications (email/WhatsApp).
 * 
 * Runs every 5 minutes during market hours (Mon-Fri, 08:00-22:00 UTC).
 */
import { Request, Response } from "express";
import { sdk } from "../_core/sdk";
import { getDb } from "../db";
import { priceAlerts, stocks as stocksTable, users, historicalPrices } from "../../drizzle/schema";
import { eq, and, inArray } from "drizzle-orm";

export async function handlePriceAlertsCheck(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!(user as any).isCron || !(user as any).taskUid) {
      return res.status(403).json({ error: "cron-only" });
    }

    console.log("[Scheduled] Price alerts check started");

    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Database not available" });
    }

    // Get all active alerts
    const alerts = await db
      .select()
      .from(priceAlerts)
      .where(eq(priceAlerts.isActive, 1));

    if (alerts.length === 0) {
      console.log("[Scheduled] No active price alerts found");
      return res.json({ ok: true, triggered: 0, total: 0 });
    }

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
      if (!currentPrice || currentPrice === 0) continue;

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
        // Send notifications
        if (alert.notificationMethod === "email" || alert.notificationMethod === "both") {
          try {
            const { sendEmail } = await import("../_core/email");
            const [alertUser] = await db.select().from(users).where(eq(users.id, alert.userId)).limit(1);

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
            }
          } catch (emailError) {
            console.error(`[PriceAlerts] Email failed for alert ${alert.id}:`, emailError);
          }
        }

        if (alert.notificationMethod === "whatsapp" || alert.notificationMethod === "both") {
          try {
            const { sendWhatsAppMessage } = await import("../_core/whatsapp");
            const [alertUser] = await db.select().from(users).where(eq(users.id, alert.userId)).limit(1);

            if (alertUser && (alertUser as any).mobile && (alertUser as any).whatsappAlerts) {
              await sendWhatsAppMessage((alertUser as any).mobile, message);
            }
          } catch (whatsappError) {
            console.error(`[PriceAlerts] WhatsApp failed for alert ${alert.id}:`, whatsappError);
          }
        }

        // Update alert status
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

    console.log(`[Scheduled] Price alerts check complete: ${triggeredCount}/${alerts.length} triggered`);

    // Notify owner if any alerts triggered
    if (triggeredCount > 0) {
      try {
        const { notifyOwner } = await import("../_core/notification");
        await notifyOwner({
          title: `🔔 ${triggeredCount} Preis-Alert${triggeredCount > 1 ? 's' : ''} ausgelöst`,
          content: triggeredAlerts.join('\n'),
        });
      } catch (e) {
        console.error("[PriceAlerts] Owner notification failed:", e);
      }
    }

    return res.json({ ok: true, triggered: triggeredCount, total: alerts.length });
  } catch (error: any) {
    console.error("[Scheduled] Price alerts check failed:", error);
    return res.status(500).json({
      error: error.message,
      stack: error.stack,
      context: { url: req.url, taskUid: (req as any).taskUid },
      timestamp: new Date().toISOString(),
    });
  }
}
