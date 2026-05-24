/**
 * LPPL Bubble Alert Cron Job
 * 
 * Runs daily at 20:00 UTC (22:00 CET) to check LPPL bubble scores
 * for S&P 500 and NASDAQ. If confidence exceeds the user's threshold
 * (default 80%), sends WhatsApp and Email notifications.
 * 
 * Schedule: Once daily at 20:00 UTC
 */

import { notifyOwner } from "../_core/notification";

let isRunning = false;

/**
 * Run LPPL bubble check and send alerts if threshold exceeded
 */
export async function checkLpplBubbleAlert() {
  if (isRunning) {
    console.log("[lpplBubbleAlertCron] Job already running, skipping...");
    return;
  }

  isRunning = true;
  console.log("[lpplBubbleAlertCron] Starting daily LPPL bubble check...");

  try {
    const { getDb } = await import("../db");
    const { lpplResults, userSettings } = await import("../../drizzle/schema");
    const { fitLPPLMultiScale, calculateBubbleConfidence } = await import("../analytics/lpplBacktest");
    const YahooFinanceClass = (await import("yahoo-finance2")).default;
    const yahooFinance: any = new (YahooFinanceClass as any)();

    const db = await getDb();
    if (!db) {
      console.error("[lpplBubbleAlertCron] Database not available");
      return;
    }

    const indices = [
      { ticker: '^GSPC', name: 'S&P 500' },
      { ticker: '^IXIC', name: 'NASDAQ Composite' },
    ];

    const alertResults: Array<{
      name: string;
      ticker: string;
      confidence: number;
      currentPrice: number;
      warningLevel: string;
      predictedCrashDate: string | null;
    }> = [];

    for (const idx of indices) {
      try {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 12);

        const chartResult: any = await yahooFinance.chart(idx.ticker, {
          period1: startDate.toISOString().split('T')[0],
          period2: endDate.toISOString().split('T')[0],
          interval: '1d'
        });

        if (!chartResult?.quotes || chartResult.quotes.length < 60) {
          console.warn(`[lpplBubbleAlertCron] Insufficient data for ${idx.name}`);
          continue;
        }

        const prices = chartResult.quotes
          .filter((q: any) => q.close != null && q.date != null)
          .map((q: any) => ({
            date: new Date(q.date).toISOString().split('T')[0],
            close: q.close as number
          }));

        const currentPrice = prices[prices.length - 1].close;

        // Run multi-scale LPPL fitting
        const fitResult = fitLPPLMultiScale(prices, [60, 90, 120, 180]);
        const confidence = calculateBubbleConfidence(fitResult, prices);

        // Calculate momentum
        const price30dAgo = prices.length >= 22 ? prices[prices.length - 22].close : prices[0].close;
        const price90dAgo = prices.length >= 66 ? prices[prices.length - 66].close : prices[0].close;
        const momentum30d = ((currentPrice - price30dAgo) / price30dAgo) * 100;
        const momentum90d = ((currentPrice - price90dAgo) / price90dAgo) * 100;

        // Determine warning level
        let warningLevel = 'none';
        if (confidence >= 70) warningLevel = 'high';
        else if (confidence >= 45) warningLevel = 'medium';
        else if (confidence >= 25) warningLevel = 'low';

        // Predict crash date
        let predictedCrashDate: string | null = null;
        if (fitResult.bestFit && confidence >= 40) {
          const params = fitResult.bestFit.params;
          const effectiveWindow = Math.min(prices.length, 180);
          const daysToTc = Math.round((params.tc - 1) * effectiveWindow);
          if (daysToTc > 0 && daysToTc < 365) {
            const crashDate = new Date();
            crashDate.setDate(crashDate.getDate() + daysToTc);
            predictedCrashDate = crashDate.toISOString().split('T')[0];
          }
        }

        // Persist to DB
        await db.insert(lpplResults).values({
          indexSymbol: idx.ticker,
          indexName: idx.name,
          bubbleConfidence: confidence,
          fitR2: fitResult.bestFit?.r2?.toFixed(3) ?? null,
          currentPrice: currentPrice.toFixed(2),
          predictedTurningPoint: predictedCrashDate,
          momentum30d: momentum30d.toFixed(2),
          momentum90d: momentum90d.toFixed(2),
          validFits: fitResult.validFitCount,
          totalCombinations: fitResult.totalAttempts,
          warningLevel,
        });

        alertResults.push({
          name: idx.name,
          ticker: idx.ticker,
          confidence,
          currentPrice,
          warningLevel,
          predictedCrashDate,
        });

        console.log(`[lpplBubbleAlertCron] ${idx.name}: Confidence ${confidence}%, Level: ${warningLevel}`);

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error: any) {
        console.error(`[lpplBubbleAlertCron] Error checking ${idx.name}:`, error.message);
      }
    }

    // Check if any index exceeds the alert threshold
    // Get threshold from user settings (default 80%)
    const { eq } = await import("drizzle-orm");
    const settingsRows = await db.select().from(userSettings).limit(1);
    const threshold = settingsRows.length > 0 ? settingsRows[0].lpplThreshold : 80;

    const criticalAlerts = alertResults.filter(r => r.confidence >= threshold);

    if (criticalAlerts.length > 0) {
      console.log(`[lpplBubbleAlertCron] ${criticalAlerts.length} critical alerts detected (threshold: ${threshold}%)`);

      // Build notification message
      const alertLines = criticalAlerts.map(a => {
        let line = `⚠️ ${a.name}: ${a.confidence}% Bubble-Confidence (Kurs: ${a.currentPrice.toLocaleString('de-CH', { maximumFractionDigits: 0 })})`;
        if (a.predictedCrashDate) {
          line += `\n   Prognostizierter Wendepunkt: ${new Date(a.predictedCrashDate).toLocaleDateString('de-CH')}`;
        }
        return line;
      }).join('\n\n');

      const title = `🔴 LPPL Bubble-Warnung: ${criticalAlerts.map(a => a.name).join(' + ')}`;
      const content = `Die tägliche LPPL-Analyse hat kritische Bubble-Signale erkannt:\n\n${alertLines}\n\nSchwellenwert: ${threshold}%\nDatum: ${new Date().toLocaleDateString('de-CH')}\n\nEmpfehlung: Portfolio-Absicherung prüfen (Stops, Hedging, Cash-Quote erhöhen).`;

      // Send owner notification (in-app)
      await notifyOwner({ title, content });

      // Send WhatsApp notification
      try {
        const { sendWhatsAppMessage } = await import("../_core/whatsapp");
        const adminNumber = process.env.VITE_WHATSAPP_NUMBER;
        if (adminNumber) {
          const whatsappMsg = `${title}\n\n${alertLines}\n\nSchwellenwert: ${threshold}%`;
          await sendWhatsAppMessage(adminNumber, whatsappMsg);
          console.log("[lpplBubbleAlertCron] WhatsApp notification sent");
        }
      } catch (whatsappErr) {
        console.warn("[lpplBubbleAlertCron] WhatsApp notification failed:", whatsappErr);
      }

      // Send Email notification
      try {
        const { sendEmail } = await import("../_core/email");
        const { users } = await import("../../drizzle/schema");
        // Get admin user email
        const adminUsers = await db.select().from(users).where(eq(users.role, 'admin')).limit(1);
        if (adminUsers.length > 0 && adminUsers[0].email) {
          await sendEmail({
            to: adminUsers[0].email,
            subject: title,
            html: `
              <h2 style="color: #dc2626;">LPPL Bubble-Warnung</h2>
              <p>Die tägliche LPPL-Analyse hat kritische Bubble-Signale erkannt:</p>
              <div style="background: #fef2f2; padding: 16px; border-radius: 8px; margin: 16px 0;">
                ${criticalAlerts.map(a => `
                  <div style="margin-bottom: 12px;">
                    <strong>${a.name}</strong>: ${a.confidence}% Bubble-Confidence<br/>
                    <span style="color: #666;">Kurs: ${a.currentPrice.toLocaleString('de-CH', { maximumFractionDigits: 0 })}</span>
                    ${a.predictedCrashDate ? `<br/><span style="color: #dc2626;">Wendepunkt: ${new Date(a.predictedCrashDate).toLocaleDateString('de-CH')}</span>` : ''}
                  </div>
                `).join('')}
              </div>
              <p style="color: #666; font-size: 14px;">
                Schwellenwert: ${threshold}% | Datum: ${new Date().toLocaleDateString('de-CH')}<br/>
                Empfehlung: Portfolio-Absicherung prüfen (Stops, Hedging, Cash-Quote erhöhen).
              </p>
            `,
          });
          console.log("[lpplBubbleAlertCron] Email notification sent");
        }
      } catch (emailErr) {
        console.warn("[lpplBubbleAlertCron] Email notification failed:", emailErr);
      }
    } else {
      console.log(`[lpplBubbleAlertCron] No critical alerts (all below ${threshold}% threshold)`);
    }

  } catch (error) {
    console.error("[lpplBubbleAlertCron] Unexpected error:", error);
  } finally {
    isRunning = false;
    console.log("[lpplBubbleAlertCron] Check completed");
  }
}

/**
 * Initialize the LPPL bubble alert cron job
 * Runs daily at 20:00 UTC (22:00 CET)
 */
export function initLpplBubbleAlertCron() {
  console.log("[lpplBubbleAlertCron] Initializing daily LPPL bubble alert cron job...");

  // Run initial check after 5 minutes (let other services start first)
  setTimeout(() => {
    checkLpplBubbleAlert().catch((error) => {
      console.error("[lpplBubbleAlertCron] Error during initial check:", error);
    });
  }, 5 * 60 * 1000);

  // Schedule daily at 20:00 UTC
  const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

  // Calculate time until next 20:00 UTC
  const now = new Date();
  const next20UTC = new Date(now);
  next20UTC.setUTCHours(20, 0, 0, 0);
  if (next20UTC <= now) {
    next20UTC.setDate(next20UTC.getDate() + 1);
  }
  const msUntilFirst = next20UTC.getTime() - now.getTime();

  setTimeout(() => {
    checkLpplBubbleAlert().catch(console.error);
    setInterval(() => {
      checkLpplBubbleAlert().catch(console.error);
    }, INTERVAL_MS);
  }, msUntilFirst);

  console.log(`[lpplBubbleAlertCron] Cron job initialized (daily at 20:00 UTC, next run in ${Math.round(msUntilFirst / 60000)} min)`);
}
