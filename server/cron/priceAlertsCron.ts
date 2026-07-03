/**
 * Price Alerts Cron Job
 * 
 * Automatically checks all active price alerts and sends notifications
 * when alert conditions are met.
 * 
 * Schedule: Every hour (configurable)
 */

let isRunning = false;

/**
 * Check all active price alerts and trigger notifications
 */
export async function checkPriceAlerts() {
  if (isRunning) {
    console.log("[priceAlertsCron] Job already running, skipping...");
    return;
  }

  isRunning = true;
  console.log("[priceAlertsCron] Starting price alerts check...");

  try {
    const { getDb } = await import("../db");
    const { priceAlerts, stocks: stocksTable, users } = await import("../../drizzle/schema");
    const { eq, and, inArray } = await import("drizzle-orm");

    const db = await getDb();
    if (!db) {
      console.error("[priceAlertsCron] Database not available");
      return;
    }

    // Get all active alerts
    const alerts = await db
      .select()
      .from(priceAlerts)
      .where(eq(priceAlerts.isActive, 1));

    if (alerts.length === 0) {
      console.log("[priceAlertsCron] No active alerts to check");
      return;
    }

    console.log(`[priceAlertsCron] Checking ${alerts.length} active alerts...`);

    // Get current prices for all tickers
    const tickers = Array.from(new Set(alerts.map((a) => a.ticker)));
    const stocks = await db
      .select()
      .from(stocksTable)
      .where(inArray(stocksTable.ticker, tickers));

    const stockPriceMap = new Map(
      stocks.map((s) => [s.ticker, parseFloat(s.currentPrice || "0")])
    );

    let triggeredCount = 0;

    // Check each alert
    for (const alert of alerts) {
      const currentPrice = stockPriceMap.get(alert.ticker);
      if (!currentPrice) {
        console.warn(`[priceAlertsCron] No price data for ${alert.ticker}`);
        continue;
      }

      let shouldTrigger = false;
      let message = "";

      // Check alert conditions
      if (alert.alertType === "above_price" && alert.targetPrice) {
        const targetPrice = parseFloat(alert.targetPrice);
        if (currentPrice >= targetPrice) {
          shouldTrigger = true;
          message = `${alert.ticker} ist über ${targetPrice} gestiegen (aktuell: ${currentPrice.toFixed(2)})`;
        }
      } else if (alert.alertType === "below_price" && alert.targetPrice) {
        const targetPrice = parseFloat(alert.targetPrice);
        if (currentPrice <= targetPrice) {
          shouldTrigger = true;
          message = `${alert.ticker} ist unter ${targetPrice} gefallen (aktuell: ${currentPrice.toFixed(2)})`;
        }
      } else if (alert.alertType === "percent_change" && alert.percentChange) {
        // For percent change, we need historical data
        const percentThreshold = parseFloat(alert.percentChange);
        const lastTriggerDate = alert.lastTriggered || alert.createdAt;
        
        // Get historical price from last trigger date
        const { historicalPrices } = await import("../../drizzle/schema");
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
            message = `${alert.ticker} hat sich um ${percentChange.toFixed(2)}% verändert (von ${oldPrice.toFixed(2)} auf ${currentPrice.toFixed(2)})`;
          }
        }
      }

      if (shouldTrigger) {
        console.log(`[priceAlertsCron] Alert triggered for ${alert.ticker}: ${message}`);
        
        // Get user information
        const [user] = await db.select().from(users).where(eq(users.id, alert.userId)).limit(1);
        
        // Send notification based on notification method
        if (alert.notificationMethod === "email" || alert.notificationMethod === "both") {
          try {
            const { sendEmail } = await import("../_core/email");
            
            if (user && user.email) {
              await sendEmail({
                to: user.email,
                subject: "🔔 Preis-Alert ausgelöst",
                html: `
                  <h2>Preis-Alert ausgelöst</h2>
                  <p>${message}</p>
                  <p><a href="${process.env.VITE_APP_URL}/price-alerts">Alerts verwalten</a></p>
                `,
              });
              console.log(`[priceAlertsCron] Email sent for alert ${alert.id}`);
            }
          } catch (emailError) {
            console.error("[priceAlertsCron] Failed to send email notification:", emailError);
          }
        }
        
        if (alert.notificationMethod === "whatsapp" || alert.notificationMethod === "both") {
          try {
            const { sendWhatsAppMessage } = await import("../_core/whatsapp");
            
            if (user && user.mobile && user.whatsappAlerts) {
              await sendWhatsAppMessage(user.mobile, `🔔 ${message}`);
              console.log(`[priceAlertsCron] WhatsApp sent for alert ${alert.id}`);
            }
          } catch (whatsappError) {
            console.error("[priceAlertsCron] Failed to send WhatsApp notification:", whatsappError);
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
      }
    }

    console.log(`[priceAlertsCron] Check completed: ${triggeredCount} alerts triggered`);
  } catch (error) {
    console.error("[priceAlertsCron] Fatal error during price alerts check:", error);
  } finally {
    isRunning = false;
  }
}

/**
 * Initialize the price alerts cron job
 * This function should be called once when the server starts
 */
export function initPriceAlertsCron() {
  console.log("[priceAlertsCron] Initializing price alerts cron job...");

  // Run immediately on startup
  console.log("[priceAlertsCron] Running initial check...");
  checkPriceAlerts().catch((error) => {
    console.error("[priceAlertsCron] Error during initial check:", error);
  });

  // Schedule checks every hour (3600000 ms)
  const INTERVAL_MS = 60 * 60 * 1000; // 1 hour
  
  setInterval(() => {
    checkPriceAlerts().catch((error) => {
      console.error("[priceAlertsCron] Error during scheduled check:", error);
    });
  }, INTERVAL_MS);

  console.log("[priceAlertsCron] Cron job initialized successfully (running every hour)");
}

/**
 * Manual trigger for testing or admin operations
 */
export async function manualPriceAlertsCheck() {
  console.log("[priceAlertsCron] Manual check triggered");
  return await checkPriceAlerts();
}
