/**
 * Signal Alerts Scheduled Handler
 *
 * Triggered daily via Heartbeat cron (e.g. 07:30 UTC = 09:30 CET).
 * Checks all portfolio positions for strong buy/sell signals in stock_signal_cache
 * and sends Email + WhatsApp notifications to the admin.
 *
 * Deduplication: uses alertHistory table to avoid re-sending the same signal
 * within 24 hours for the same ticker + signalType.
 */
import type { Request, Response } from "express";

interface SignalAlert {
  ticker: string;
  companyName: string;
  signalType: "buy" | "sell" | "hold";
  signalStrength: "strong" | "moderate" | "weak";
  qualityScore: number | null;
  combinedScore: number | null;
  overallGrade: string | null;
  currentPrice: string | null;
  reason: string | null;
}

export async function handleSignalAlerts(req: Request, res: Response) {
  try {
    const { getDb } = await import("../db");
    const { stockSignalCache, alertHistory, savedPortfolios } = await import("../../drizzle/schema");
    const { eq, and, gte, or, inArray } = await import("drizzle-orm");
    const { sendEmail } = await import("../_core/email");
    const { sendWhatsAppMessage } = await import("../_core/whatsapp");
    const { ENV } = await import("../_core/env");

    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Database not available" });
    }

    // Collect all unique tickers from all active portfolios
    const portfolios = await db.select().from(savedPortfolios);
    const allTickers = new Set<string>();
    for (const p of portfolios) {
      try {
        const data = JSON.parse(p.portfolioData);
        for (const s of data.stocks ?? []) {
          if (s.ticker) allTickers.add(s.ticker);
        }
      } catch {}
    }

    if (allTickers.size === 0) {
      return res.json({ ok: true, alerts: 0, message: "No portfolio tickers found" });
    }

    const tickerList = Array.from(allTickers);

    // Get signal cache for all portfolio tickers
    const signals = await db
      .select()
      .from(stockSignalCache)
      .where(inArray(stockSignalCache.ticker, tickerList));

    // Filter for strong buy or strong sell signals
    const strongSignals = signals.filter(
      (s) =>
        (s.signalType === "buy" || s.signalType === "sell") &&
        s.signalStrength === "strong"
    );

    if (strongSignals.length === 0) {
      console.log("[signalAlertsCron] No strong buy/sell signals found today");
      return res.json({ ok: true, alerts: 0, message: "No strong signals" });
    }

    // Deduplication: check alertHistory for signals sent in last 24h
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentAlerts = await db
      .select({ ticker: alertHistory.ticker, metricName: alertHistory.metricName })
      .from(alertHistory)
      .where(gte(alertHistory.triggeredAt, since24h));

    const recentSet = new Set(recentAlerts.map((a) => `${a.ticker}:${a.metricName}`));

    const newAlerts: SignalAlert[] = [];
    for (const s of strongSignals) {
      const key = `${s.ticker}:signal_${s.signalType}`;
      if (!recentSet.has(key)) {
        newAlerts.push({
          ticker: s.ticker,
          companyName: s.companyName,
          signalType: s.signalType as "buy" | "sell" | "hold",
          signalStrength: s.signalStrength as "strong" | "moderate" | "weak",
          qualityScore: s.qualityScore ?? null,
          combinedScore: s.combinedScore ? parseInt(s.combinedScore, 10) : null,
          overallGrade: s.overallGrade ?? null,
          currentPrice: s.currentPrice ?? null,
          reason: s.reason ?? null,
        });
      }
    }

    if (newAlerts.length === 0) {
      console.log("[signalAlertsCron] All strong signals already notified in last 24h");
      return res.json({ ok: true, alerts: 0, message: "Already notified" });
    }

    // Build notification content
    const buyAlerts = newAlerts.filter((a) => a.signalType === "buy");
    const sellAlerts = newAlerts.filter((a) => a.signalType === "sell");

    const formatAlert = (a: SignalAlert) =>
      `• ${a.ticker} (${a.companyName}) — Qualität: ${a.qualityScore ?? "–"}/100, Score: ${a.combinedScore ?? "–"}/100, Grade: ${a.overallGrade ?? "–"}, Preis: ${a.currentPrice ?? "–"}`;

    const emailHtml = `
      <h2>📊 Tägliche Signal-Alerts — Portfolio Manager</h2>
      ${buyAlerts.length > 0 ? `
        <h3 style="color:#22c55e">🟢 Starke Kauf-Signale (${buyAlerts.length})</h3>
        <ul>${buyAlerts.map((a) => `<li><strong>${a.ticker}</strong> — ${a.companyName}<br>
          Qualität: ${a.qualityScore ?? "–"}/100 | Score: ${a.combinedScore ?? "–"}/100 | Grade: ${a.overallGrade ?? "–"} | Preis: ${a.currentPrice ?? "–"}<br>
          <em>${a.reason?.slice(0, 200) ?? ""}</em></li>`).join("")}
        </ul>` : ""}
      ${sellAlerts.length > 0 ? `
        <h3 style="color:#ef4444">🔴 Starke Verkauf-Signale (${sellAlerts.length})</h3>
        <ul>${sellAlerts.map((a) => `<li><strong>${a.ticker}</strong> — ${a.companyName}<br>
          Qualität: ${a.qualityScore ?? "–"}/100 | Score: ${a.combinedScore ?? "–"}/100 | Grade: ${a.overallGrade ?? "–"} | Preis: ${a.currentPrice ?? "–"}<br>
          <em>${a.reason?.slice(0, 200) ?? ""}</em></li>`).join("")}
        </ul>` : ""}
      <p style="color:#6b7280;font-size:12px">Generiert: ${new Date().toLocaleString("de-CH")}</p>
    `;

    const whatsappMsg = [
      `📊 *Portfolio Signal-Alerts*`,
      buyAlerts.length > 0 ? `\n🟢 *Kauf-Signale (${buyAlerts.length}):*\n${buyAlerts.map(formatAlert).join("\n")}` : "",
      sellAlerts.length > 0 ? `\n🔴 *Verkauf-Signale (${sellAlerts.length}):*\n${sellAlerts.map(formatAlert).join("\n")}` : "",
    ].filter(Boolean).join("\n");

    // Send notifications
    let emailSent = false;
    let whatsappSent = false;

    const adminEmail = ENV.emailFrom || process.env.EMAIL_FROM;
    if (adminEmail) {
      emailSent = await sendEmail({
        to: adminEmail,
        subject: `📊 Portfolio Alerts: ${buyAlerts.length} Kauf, ${sellAlerts.length} Verkauf`,
        html: emailHtml,
      });
    }

    const adminWhatsApp = process.env.VITE_WHATSAPP_NUMBER || process.env.TWILIO_WHATSAPP_NUMBER;
    if (adminWhatsApp) {
      whatsappSent = await sendWhatsAppMessage(adminWhatsApp, whatsappMsg);
    }

    // Record in alertHistory to prevent duplicates
    for (const a of newAlerts) {
      await db.insert(alertHistory).values({
        alertRuleId: 0, // system-generated
        ticker: a.ticker,
        metricName: `signal_${a.signalType}`,
        oldValue: null,
        newValue: `${a.signalStrength}_${a.signalType}`,
        message: `Starkes ${a.signalType === "buy" ? "Kauf" : "Verkauf"}-Signal für ${a.ticker} (${a.companyName})`,
        notificationSent: emailSent || whatsappSent ? 1 : 0,
        triggeredAt: new Date(),
      });
    }

    console.log(`[signalAlertsCron] Sent ${newAlerts.length} alerts (email: ${emailSent}, whatsapp: ${whatsappSent})`);
    return res.json({
      ok: true,
      alerts: newAlerts.length,
      buyAlerts: buyAlerts.length,
      sellAlerts: sellAlerts.length,
      emailSent,
      whatsappSent,
    });
  } catch (err: any) {
    console.error("[signalAlertsCron] Error:", err);
    return res.status(500).json({ error: err?.message ?? "Unknown error", stack: err?.stack });
  }
}
