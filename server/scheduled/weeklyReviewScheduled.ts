/**
 * AI Wochenrückblick Scheduled Handler
 * =====================================
 * Heartbeat-triggered endpoint that generates a weekly AI market summary
 * for the user's watchlist and portfolio positions.
 * 
 * Runs every Sunday at 18:00 UTC (20:00 CET).
 */
import { Request, Response } from "express";
import { sdk } from "../_core/sdk";
import { invokeLLM, invokeKimi } from "../_core/llm";
import { getDb } from "../db";
import { savedPortfolios, portfolioTransactions, stocks as stocksTable } from "../../drizzle/schema";
import { curated } from "../lib/stockUniverse";
import { eq, and, inArray, isNotNull } from "drizzle-orm";
import { notifyOwner } from "../_core/notification";

export async function handleWeeklyReview(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!(user as any).isCron || !(user as any).taskUid) {
      return res.status(403).json({ error: "cron-only" });
    }

    console.log("[Scheduled] Weekly AI review started");

    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Database not available" });
    }

    // Gather portfolio and watchlist data
    const watchlistTickers = await db
      .select({ ticker: stocksTable.ticker })
      .from(stocksTable)
      .where(curated());

    const portfolios = await db
      .select()
      .from(savedPortfolios);

    // Get all unique tickers from portfolios (via transactions)
    const portfolioTickers: string[] = [];
    for (const p of portfolios) {
      const positions = await db
        .select({ ticker: portfolioTransactions.ticker })
        .from(portfolioTransactions)
        .where(and(
          eq(portfolioTransactions.portfolioId, p.id),
          isNotNull(portfolioTransactions.ticker)
        ));
      portfolioTickers.push(...positions.filter(pos => pos.ticker).map(pos => pos.ticker!));
    }

    // Combine all tickers
    const allTickers = Array.from(new Set([
      ...watchlistTickers.map(w => w.ticker),
      ...portfolioTickers,
    ]));

    if (allTickers.length === 0) {
      console.log("[Scheduled] No tickers to review");
      return res.json({ ok: true, skipped: "no tickers" });
    }

    // Get stock data for all tickers
    const stockData = await db
      .select()
      .from(stocksTable)
      .where(inArray(stocksTable.ticker, allTickers));

    // Build context for LLM
    const stockSummaries = stockData.map(s => ({
      ticker: s.ticker,
      name: s.companyName,
      price: s.currentPrice,
      sector: s.sector,
      peRatio: s.peRatio,
      dividendYield: s.dividendYield,
      ytdPerformance: s.ytdPerformance,
      week52High: s.week52High,
      week52Low: s.week52Low,
      score: s.score,
    }));

    // Group by sector
    const bySector: Record<string, typeof stockSummaries> = {};
    for (const s of stockSummaries) {
      const sector = s.sector || "Sonstige";
      if (!bySector[sector]) bySector[sector] = [];
      bySector[sector].push(s);
    }

    const sectorOverview = Object.entries(bySector).map(([sector, sectorStocks]) => {
      const avgYtd = sectorStocks.reduce((sum, s) => sum + parseFloat(String(s.ytdPerformance || "0")), 0) / sectorStocks.length;
      return `${sector} (${sectorStocks.length} Titel, Ø YTD: ${avgYtd.toFixed(1)}%)`;
    }).join("\n");

    const topPerformers = [...stockSummaries]
      .sort((a, b) => parseFloat(String(b.ytdPerformance || "0")) - parseFloat(String(a.ytdPerformance || "0")))
      .slice(0, 5)
      .map(s => `${s.ticker} (${s.name}): YTD ${s.ytdPerformance}%`)
      .join("\n");

    const worstPerformers = [...stockSummaries]
      .sort((a, b) => parseFloat(String(a.ytdPerformance || "0")) - parseFloat(String(b.ytdPerformance || "0")))
      .slice(0, 5)
      .map(s => `${s.ticker} (${s.name}): YTD ${s.ytdPerformance}%`)
      .join("\n");

    const highScores = [...stockSummaries]
      .filter(s => s.score && parseInt(String(s.score)) >= 75)
      .sort((a, b) => parseInt(String(b.score || "0")) - parseInt(String(a.score || "0")))
      .slice(0, 5)
      .map(s => `${s.ticker} (${s.name}): Score ${s.score}/100`)
      .join("\n");

    // Generate AI summary
    const prompt = `Du bist ein erfahrener Schweizer Finanzanalyst. Erstelle einen prägnanten Wochenrückblick für ein Portfolio mit ${allTickers.length} Titeln.

DATEN:
- Sektoren: ${sectorOverview}
- Top 5 Performer: ${topPerformers}
- Schwächste 5: ${worstPerformers}
- Höchste Scores: ${highScores}
- Anzahl Portfolios: ${portfolios.length}
- Watchlist-Titel: ${watchlistTickers.length}

AUFGABE:
Erstelle einen Wochenrückblick mit folgender Struktur (auf Deutsch):
1. **Marktüberblick** (2-3 Sätze zur allgemeinen Lage)
2. **Portfolio-Highlights** (Top/Flop der Woche, auffällige Bewegungen)
3. **Sektoren-Analyse** (welche Sektoren stark/schwach)
4. **Handlungsempfehlungen** (1-2 konkrete Vorschläge basierend auf den Daten)
5. **Ausblick** (was nächste Woche zu beachten ist)

Halte dich kurz und prägnant (max 500 Wörter). Verwende Schweizer Kontext (CHF, SIX, etc.).`;

    const response = await invokeKimi({
      messages: [
        { role: "system", content: "Du bist ein erfahrener Schweizer Finanzanalyst und Portfolio-Berater." },
        { role: "user", content: prompt },
      ],
    });

    const rawContent = response.choices?.[0]?.message?.content;
    const summary = (typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent)) || "Kein Rückblick verfügbar.";

    // Save to DB (we'll use a simple approach - store in userSettings or notify)
    console.log("[Scheduled] Weekly review generated, length:", summary.length);

    // Notify owner with the summary
    await notifyOwner({
      title: "📊 Wochenrückblick – KI-Marktanalyse",
      content: summary,
    });

    // Also store in DB for frontend display (use generic settings table with raw SQL)
    try {
      const reviewData = JSON.stringify({
        generatedAt: new Date().toISOString(),
        summary,
        stats: {
          totalTickers: allTickers.length,
          portfolioCount: portfolios.length,
          watchlistCount: watchlistTickers.length,
        },
      });
      await (db as any).execute(
        `INSERT INTO genericSettings (settingKey, settingValue, updatedAt) 
         VALUES ('weeklyReview', '${reviewData.replace(/'/g, "''")}', NOW()) 
         ON DUPLICATE KEY UPDATE settingValue = VALUES(settingValue), updatedAt = NOW()`
      );
    } catch (dbErr) {
      console.warn("[Scheduled] Failed to save weekly review to DB:", dbErr);
    }

    return res.json({ ok: true, summaryLength: summary.length });
  } catch (error: any) {
    console.error("[Scheduled] Weekly review failed:", error);
    return res.status(500).json({
      error: error.message,
      stack: error.stack,
      context: { url: req.url, taskUid: (req as any).taskUid },
      timestamp: new Date().toISOString(),
    });
  }
}
