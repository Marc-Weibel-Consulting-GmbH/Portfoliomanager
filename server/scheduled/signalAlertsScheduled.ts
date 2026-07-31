/**
 * Signal Alerts Scheduled Handler
 *
 * Triggered daily via Heartbeat cron (16:00 UTC = 18:00 CET).
 *
 * STATE-CHANGE FILTER: Only sends a notification when a ticker's signalType
 * has changed since the last notification (e.g. buy→sell, hold→buy).
 * A ticker that has been "buy" for 2 months will NOT trigger a daily alert.
 *
 * Includes portfolio assignment in the WhatsApp message so you know
 * which portfolio holds the ticker.
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
  previousSignalType: string | null; // what it was before
  portfolios: string[]; // which portfolios hold this ticker
}

export async function handleSignalAlerts(req: Request, res: Response) {
  try {
    const { getDb } = await import("../db");
    const { stockSignalCache, alertHistory, savedPortfolios } = await import("../../drizzle/schema");
    const { eq, and, gte, inArray, desc } = await import("drizzle-orm");
    const { sendEmail } = await import("../_core/email");
    const { sendWhatsAppMessage } = await import("../_core/whatsapp");
    const { ENV } = await import("../_core/env");

    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Database not available" });
    }

    // ─── 1. Collect all unique tickers from all active portfolios ───────────
    const portfolios = await db.select().from(savedPortfolios);

    // Map: ticker → list of portfolio names that hold it
    const tickerToPortfolios = new Map<string, string[]>();
    for (const p of portfolios) {
      try {
        const data = JSON.parse(p.portfolioData);
        for (const s of data.stocks ?? []) {
          if (s.ticker) {
            const existing = tickerToPortfolios.get(s.ticker) ?? [];
            existing.push(p.name ?? "Portfolio");
            tickerToPortfolios.set(s.ticker, existing);
          }
        }
      } catch {
        // Skip portfolios with unparseable data
      }
    }

    if (tickerToPortfolios.size === 0) {
      return res.json({ ok: true, alerts: 0, message: "No portfolio tickers found" });
    }

    const tickerList = Array.from(tickerToPortfolios.keys());

    // ─── 2. Get current signals for all portfolio tickers ───────────────────
    const signals = await db
      .select()
      .from(stockSignalCache)
      .where(inArray(stockSignalCache.ticker, tickerList));

    // Only care about strong buy or strong sell
    const strongSignals = signals.filter(
      (s) =>
        (s.signalType === "buy" || s.signalType === "sell") &&
        s.signalStrength === "strong"
    );

    if (strongSignals.length === 0) {
      console.log("[signalAlertsCron] No strong buy/sell signals found today");
      return res.json({ ok: true, alerts: 0, message: "No strong signals" });
    }

    // ─── 3. STATE-CHANGE FILTER ─────────────────────────────────────────────
    // For each ticker, look up the last notification we sent (most recent
    // alertHistory row with metricName LIKE 'signal_%').
    // Only alert if the current signalType differs from the last sent one.

    // Fetch last sent signal per ticker from alertHistory
    // We query all relevant rows and pick the latest per ticker in JS.
    const lastAlerts = await db
      .select({
        ticker: alertHistory.ticker,
        newValue: alertHistory.newValue,
        triggeredAt: alertHistory.triggeredAt,
      })
      .from(alertHistory)
      .where(inArray(alertHistory.ticker, tickerList))
      .orderBy(desc(alertHistory.triggeredAt));

    // Build map: ticker → last sent signalType (extracted from newValue like "strong_buy")
    const lastSignalMap = new Map<string, string>();
    for (const row of lastAlerts) {
      if (!lastSignalMap.has(row.ticker) && row.newValue) {
        // newValue format: "strong_buy" | "moderate_sell" | etc.
        const parts = row.newValue.split("_");
        const signalType = parts[parts.length - 1]; // last part is the signal type
        lastSignalMap.set(row.ticker, signalType);
      }
    }

    const changedAlerts: SignalAlert[] = [];
    for (const s of strongSignals) {
      const lastSignalType = lastSignalMap.get(s.ticker) ?? null;
      const currentSignalType = s.signalType;

      // Only alert if signal type has CHANGED (or never been sent before)
      if (lastSignalType === currentSignalType) {
        console.log(`[signalAlertsCron] ${s.ticker}: signal unchanged (${currentSignalType}), skipping`);
        continue;
      }

      changedAlerts.push({
        ticker: s.ticker,
        companyName: s.companyName,
        signalType: s.signalType as "buy" | "sell" | "hold",
        signalStrength: s.signalStrength as "strong" | "moderate" | "weak",
        qualityScore: s.qualityScore ?? null,
        combinedScore: s.combinedScore ? parseInt(s.combinedScore, 10) : null,
        overallGrade: s.overallGrade ?? null,
        currentPrice: s.currentPrice ?? null,
        reason: s.reason ?? null,
        previousSignalType: lastSignalType,
        portfolios: tickerToPortfolios.get(s.ticker) ?? [],
      });
    }

    if (changedAlerts.length === 0) {
      console.log("[signalAlertsCron] All strong signals unchanged since last notification");
      return res.json({ ok: true, alerts: 0, message: "No signal changes" });
    }

    // ─── 4. Build notification content ──────────────────────────────────────
    const buyAlerts = changedAlerts.filter((a) => a.signalType === "buy");
    const sellAlerts = changedAlerts.filter((a) => a.signalType === "sell");

    const prevLabel = (prev: string | null) =>
      prev ? ` _(war: ${prev})_` : " _(neu)_";

    const formatAlertWA = (a: SignalAlert) => {
      const portfolioStr = a.portfolios.length > 0 ? ` [${a.portfolios.join(", ")}]` : "";
      return `• ${a.ticker}${portfolioStr} — Score: ${a.combinedScore ?? "–"}/100, Grade: ${a.overallGrade ?? "–"}, Preis: ${a.currentPrice ?? "–"}${prevLabel(a.previousSignalType)}`;
    };

    const formatAlertEmail = (a: SignalAlert) => {
      const portfolioStr = a.portfolios.length > 0 ? ` <em>(${a.portfolios.join(", ")})</em>` : "";
      const changeStr = a.previousSignalType
        ? `<span style="color:#6b7280"> ← war: ${a.previousSignalType}</span>`
        : `<span style="color:#6b7280"> (neu)</span>`;
      return `<li><strong>${a.ticker}</strong>${portfolioStr} — ${a.companyName}${changeStr}<br>
          Qualität: ${a.qualityScore ?? "–"}/100 | Score: ${a.combinedScore ?? "–"}/100 | Grade: ${a.overallGrade ?? "–"} | Preis: ${a.currentPrice ?? "–"}<br>
          <em>${a.reason?.slice(0, 200) ?? ""}</em></li>`;
    };

    const emailHtml = `
      <h2>📊 Signal-Wechsel — Portfolio Manager</h2>
      <p style="color:#6b7280">Nur Ticker mit geändertem Signal werden gemeldet.</p>
      ${buyAlerts.length > 0 ? `
        <h3 style="color:#22c55e">🟢 Neu: Starke Kauf-Signale (${buyAlerts.length})</h3>
        <ul>${buyAlerts.map(formatAlertEmail).join("")}</ul>` : ""}
      ${sellAlerts.length > 0 ? `
        <h3 style="color:#ef4444">🔴 Neu: Starke Verkauf-Signale (${sellAlerts.length})</h3>
        <ul>${sellAlerts.map(formatAlertEmail).join("")}</ul>` : ""}
      <p style="color:#6b7280;font-size:12px">Generiert: ${new Date().toLocaleString("de-CH")}</p>
    `;

    const whatsappMsg = [
      `📊 *Signal-Wechsel* — ${new Date().toLocaleDateString("de-CH")}`,
      buyAlerts.length > 0
        ? `\n🟢 *Neu Kauf (${buyAlerts.length}):*\n${buyAlerts.map(formatAlertWA).join("\n")}`
        : "",
      sellAlerts.length > 0
        ? `\n🔴 *Neu Verkauf (${sellAlerts.length}):*\n${sellAlerts.map(formatAlertWA).join("\n")}`
        : "",
    ].filter(Boolean).join("\n");

    // ─── 5. Send notifications ───────────────────────────────────────────────
    let emailSent = false;
    let whatsappSent = false;

    const adminEmail = ENV.emailFrom || process.env.EMAIL_FROM;
    if (adminEmail) {
      emailSent = await sendEmail({
        to: adminEmail,
        subject: `📊 Signal-Wechsel: ${buyAlerts.length} Kauf, ${sellAlerts.length} Verkauf`,
        html: emailHtml,
      });
    }

    const adminWhatsApp = process.env.VITE_WHATSAPP_NUMBER || process.env.TWILIO_WHATSAPP_NUMBER;
    if (adminWhatsApp) {
      whatsappSent = await sendWhatsAppMessage(adminWhatsApp, whatsappMsg);
    }

    // ─── 6. Record in alertHistory ───────────────────────────────────────────
    for (const a of changedAlerts) {
      await db.insert(alertHistory).values({
        alertRuleId: 0,
        ticker: a.ticker,
        metricName: `signal_${a.signalType}`,
        oldValue: a.previousSignalType ?? null,
        newValue: `${a.signalStrength}_${a.signalType}`,
        message: `Signal-Wechsel für ${a.ticker} (${a.companyName}): ${a.previousSignalType ?? "–"} → ${a.signalType}`,
        notificationSent: emailSent || whatsappSent ? 1 : 0,
        triggeredAt: new Date(),
      });
    }

    console.log(`[signalAlertsCron] Sent ${changedAlerts.length} state-change alerts (email: ${emailSent}, whatsapp: ${whatsappSent})`);
    return res.json({
      ok: true,
      alerts: changedAlerts.length,
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
