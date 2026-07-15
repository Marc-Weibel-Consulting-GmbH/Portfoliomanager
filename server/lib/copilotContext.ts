/**
 * Copilot-Kontext: Portfolio-Steckbrief + App-Handbuch für den Chat-Assistenten.
 *
 * Stufe 1 der Copilot-Datenanbindung: Vor jeder Antwort bekommt das LLM einen
 * kompakten, token-begrenzten Steckbrief der EIGENEN Portfolios des Nutzers
 * (Ownership über getSavedPortfolios(userId)) plus ein kuratiertes Handbuch
 * der App-Funktionen — damit es mit echten Zahlen antwortet statt mit
 * Allgemeinplätzen und keine Funktionen erfindet.
 *
 * Bewertungs-Methodik = dieselbe wie Portfolio-Vergleich/Detailseite (FIN-2):
 * buildHoldings-Replay, Kurse per convertToCHF (kein 1:1-Fallback, R-10),
 * Kostenbasis aus totalCostChf. Alles non-fatal — bei Fehlern fehlt der
 * Steckbrief einfach.
 */

import { buildHoldings } from "./holdings";
import { convertToCHF } from "../fxHelper";

const MAX_FOCUS_POSITIONS = 15;
const MAX_RECENT_TX = 5;

/** Kuratierte Funktionsübersicht — im Repo gepflegt, damit sie mit dem Code altert. */
export const APP_HANDBUCH = `
Funktionsübersicht des Portfolio Managers (nur diese Funktionen existieren — erfinde keine):
- Dashboard: aggregierter Überblick über alle Live-Portfolios (Wert, YTD vs. SPI/MSCI World, Performance-Chart, Markt-Regime-Ampel).
- Portfolios: Live- und Test-Portfolios, Detailseite mit Performance-Chart (Benchmark wählbar, Standard SPI), Kennzahlen (YTD, Sharpe, Volatilität), Transaktionen, Dividenden-Tab (Brutto-Beträge), Rebalancing und Snapshots. Swissquote-Depotauszug-PDF-Import im Portfolio-Builder.
- Portfolio-Builder (/portfolio-builder): manuell, per Import oder als KI-Vorschlag aus dem Anlageprofil (echte Optimierung Max. Sharpe / Min. Varianz / Max. Dividende, mit KI-Zweitmeinung durch Challenger/Synthesizer).
- Portfolio-Vergleich (/portfolio-comparison): zwei Portfolios direkt vergleichen (Kennzahlen, Sektoren, Radar).
- Aktienliste & Watchlist: kuratiertes Universum mit Signal-Scores (0-100), Kaufen/Halten/Verkaufen-Signalen und Kennzahlen; Wikifolio-Import.
- Aktien-Detailseite (/aktien/TICKER): Kurs-Chart, Qualitäts-Score, Signale, Analysten-Konsens, Finanzkennzahlen, TradingView als gekennzeichnete unabhängige Zweitmeinung, Kauf direkt ins Portfolio, Preisalarm erstellen.
- Signale (/signals): aktuelle Kaufempfehlungen aus dem kombinierten Momentum+Qualität-Score plus Empfehlungs-Historie.
- Markt-Hub (/markt): Marktregime-Ampel (Risk-On/Neutral/Defensiv/Risk-Off mit 7 Dimensionen), Heatmap, News, KI-Blase-Monitor (LPPL), tägliches Markt-Update.
- Preisalarme (/price-alerts): Alarme über/unter Preis oder Änderung in %, Benachrichtigung per E-Mail/WhatsApp, in der Währung des Titels.
- Anlageprofil (Einstellungen › Anlageprofil): Risikoprofil, Ziele, Horizont, ausgeschlossene Sektoren, FX-Limit — steuert den KI-Vorschlag. ESG-Filter ist «in Vorbereitung» (noch ohne Wirkung).
- Copilot (dieser Chat, /copilot): Fragen zu Portfolios, Titeln und App-Funktionen.
Wenn der Nutzer eine Funktion sucht: nenne den Ort in der App. Wenn etwas nicht existiert: sage es ehrlich.`.trim();

function fmtChf(v: number): string {
  return `CHF ${Math.round(v).toLocaleString("de-CH")}`;
}

interface FocusPosition {
  ticker: string;
  name: string;
  valueChf: number;
  weightPct: number;
  ytdPct: number | null;
}

/**
 * Pur & testbar: formatiert den Steckbrief aus vorberechneten Daten.
 */
export function formatPortfolioBriefing(data: {
  portfolios: Array<{ name: string; isLive: boolean; positionCount: number; isFocus: boolean }>;
  focus: {
    name: string;
    totalValueChf: number;
    totalInvestedChf: number;
    positions: FocusPosition[];
    skippedPositions: number;
    recentTransactions: Array<{ date: string; type: string; ticker: string; shares: number }>;
  } | null;
}): string {
  const lines: string[] = ["Portfolios des Nutzers:"];
  for (const p of data.portfolios) {
    lines.push(`- ${p.name} (${p.isLive ? "LIVE" : "Test"}, ${p.positionCount} Positionen)${p.isFocus ? " ← Detail unten" : ""}`);
  }

  const f = data.focus;
  if (f) {
    const perfPct = f.totalInvestedChf > 0
      ? ((f.totalValueChf - f.totalInvestedChf) / f.totalInvestedChf) * 100
      : null;
    lines.push("");
    lines.push(`Detail «${f.name}» (Bewertung in CHF, Tages-FX):`);
    lines.push(`- Wert ${fmtChf(f.totalValueChf)} · investiert ${fmtChf(f.totalInvestedChf)}${perfPct !== null ? ` · Performance ${perfPct >= 0 ? "+" : ""}${perfPct.toFixed(1)}%` : ""}`);
    if (f.positions.length > 0) {
      lines.push(`- Positionen (nach Gewicht):`);
      for (const pos of f.positions) {
        lines.push(
          `  · ${pos.ticker} ${pos.name}: ${fmtChf(pos.valueChf)} (${pos.weightPct.toFixed(1)}%)${pos.ytdPct !== null ? `, YTD ${pos.ytdPct >= 0 ? "+" : ""}${pos.ytdPct.toFixed(1)}%` : ""}`
        );
      }
      if (f.skippedPositions > 0) lines.push(`  · … und ${f.skippedPositions} weitere Positionen`);
    }
    if (f.recentTransactions.length > 0) {
      lines.push(`- Letzte Transaktionen:`);
      for (const tx of f.recentTransactions) {
        lines.push(`  · ${tx.date}: ${tx.type} ${tx.shares} × ${tx.ticker}`);
      }
    }
  }
  return lines.join("\n");
}

/**
 * Baut den Steckbrief aus der DB. `linkedPortfolioId` (Konversation) hat
 * Vorrang; sonst wird das wertgrösste Live-Portfolio detailliert. Non-fatal:
 * bei Fehlern wird null geliefert und der Chat läuft ohne Steckbrief weiter.
 */
export async function buildPortfolioBriefing(
  userId: number,
  linkedPortfolioId?: number | null
): Promise<string | null> {
  try {
    const { getSavedPortfolios, getPortfolioTransactions, getDb } = await import("../db");
    const db = await getDb();
    if (!db) return null;

    const portfolios = await getSavedPortfolios(userId);
    if (!portfolios.length) return null;

    const parsed = portfolios.map((p: any) => {
      let stocks: any[] = [];
      try {
        const raw = JSON.parse(p.portfolioData);
        stocks = Array.isArray(raw) ? raw : raw.stocks ?? [];
      } catch { /* Steckbrief zeigt dann 0 Positionen */ }
      return { row: p, stocks };
    });

    const focusEntry =
      (linkedPortfolioId ? parsed.find((p) => p.row.id === linkedPortfolioId) : undefined) ??
      parsed.filter((p) => p.row.isLive).sort((a, b) => b.stocks.length - a.stocks.length)[0] ??
      parsed[0];

    // Fokus-Portfolio live bewerten (FIN-2-Methodik).
    let focus: Parameters<typeof formatPortfolioBriefing>[0]["focus"] = null;
    try {
      const { stocks: stocksTable } = await import("../../drizzle/schema");
      const { inArray } = await import("drizzle-orm");
      const todayStr = new Date().toISOString().split("T")[0];

      const transactions = await getPortfolioTransactions(focusEntry.row.id);
      const positionsRaw: Array<{ ticker: string; shares: number; investedChf: number }> = [];
      if (transactions.length > 0) {
        for (const [ticker, h] of buildHoldings(transactions).entries()) {
          if (h.shares > 0) positionsRaw.push({ ticker, shares: h.shares, investedChf: h.totalCostChf });
        }
      } else {
        // Test-Portfolio ohne Transaktionen: gespeicherte Werte nutzen.
        for (const s of focusEntry.stocks) {
          if (!s?.ticker || s.ticker === "CASH") continue;
          positionsRaw.push({ ticker: s.ticker, shares: parseFloat(s.shares ?? "0") || 0, investedChf: parseFloat(s.totalInvested ?? "0") || 0 });
        }
      }

      const tickers = positionsRaw.map((p) => p.ticker);
      const stockRows = tickers.length
        ? await db.select().from(stocksTable).where(inArray(stocksTable.ticker, tickers))
        : [];
      const byTicker = new Map(stockRows.map((s: any) => [s.ticker, s]));

      let totalValueChf = 0;
      let totalInvestedChf = 0;
      const positions: FocusPosition[] = [];
      for (const p of positionsRaw) {
        const stock: any = byTicker.get(p.ticker);
        const price = stock?.currentPrice ? parseFloat(stock.currentPrice) : 0;
        const priceChf = price > 0 ? await convertToCHF(price, stock?.currency || "CHF", todayStr) : 0;
        const valueChf = p.shares * priceChf;
        totalValueChf += valueChf;
        totalInvestedChf += p.investedChf;
        const ytd = stock?.ytdPerformance != null ? parseFloat(stock.ytdPerformance) : NaN;
        positions.push({
          ticker: p.ticker,
          name: stock?.companyName || p.ticker,
          valueChf,
          weightPct: 0, // wird unten aus totalValueChf gesetzt
          ytdPct: Number.isFinite(ytd) ? ytd : null,
        });
      }
      positions.forEach((pos) => { pos.weightPct = totalValueChf > 0 ? (pos.valueChf / totalValueChf) * 100 : 0; });
      positions.sort((a, b) => b.valueChf - a.valueChf);

      const recentTransactions = [...transactions]
        .sort((a: any, b: any) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime())
        .slice(0, MAX_RECENT_TX)
        .filter((t: any) => t.ticker)
        .map((t: any) => ({
          date: String(t.transactionDate).slice(0, 10),
          type: t.transactionType === "buy" || t.transactionType === "entry" ? "Kauf" : t.transactionType === "sell" ? "Verkauf" : t.transactionType,
          ticker: t.ticker as string,
          shares: parseFloat(t.shares ?? "0") || 0,
        }));

      focus = {
        name: focusEntry.row.name,
        totalValueChf,
        totalInvestedChf,
        positions: positions.slice(0, MAX_FOCUS_POSITIONS),
        skippedPositions: Math.max(0, positions.length - MAX_FOCUS_POSITIONS),
        recentTransactions,
      };
    } catch (e) {
      console.warn("[copilotContext] Fokus-Bewertung fehlgeschlagen:", (e as Error).message);
    }

    return formatPortfolioBriefing({
      portfolios: parsed.map((p) => ({
        name: p.row.name,
        isLive: !!p.row.isLive,
        positionCount: p.stocks.filter((s: any) => s?.ticker && s.ticker !== "CASH").length,
        isFocus: p === focusEntry && focus !== null,
      })),
      focus,
    });
  } catch (e) {
    console.warn("[copilotContext] Steckbrief fehlgeschlagen:", (e as Error).message);
    return null;
  }
}
