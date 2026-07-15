/**
 * Copilot Stufe 2: Werkzeuge, mit denen sich der Chat-Assistent Daten GEZIELT
 * selbst holt (Tool-Use über invokeLLM), statt alles vorab in den Kontext zu
 * bekommen.
 *
 * Grundsätze:
 *  - Alle Tools sind NUR-LESEN und über userId auf die eigenen Daten begrenzt.
 *  - Jedes Tool liefert eine kompakte deutsche Text-Antwort; Fehler werden als
 *    ehrliche Meldung zurückgegeben (nie werfen — der Chat darf nicht sterben).
 *  - Bewertungen nutzen dieselben Pfade wie die UI (eine Wahrheit): Steckbrief-
 *    Logik (FIN-2), Dividendenkalender (brutto, fxMissing), Financial Datasets
 *    (nur US-Titel).
 */

import type { Tool } from "../_core/llm";
import { convertToCHF } from "../fxHelper";

export const COPILOT_TOOLS: Tool[] = [
  {
    type: "function",
    function: {
      name: "get_portfolio_details",
      description:
        "Detail eines Portfolios des Nutzers: Wert/investiert/Performance in CHF, Positionen mit Gewicht und YTD, letzte Transaktionen. Ohne portfolioName wird das grösste Live-Portfolio genommen.",
      parameters: {
        type: "object",
        properties: {
          portfolioName: { type: "string", description: "Name (oder Namensteil) des Portfolios" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_upcoming_dividends",
      description:
        "Anstehende Dividenden (BRUTTO, vor Verrechnungs-/Quellensteuer) über alle Portfolios des Nutzers für die nächsten Tage.",
      parameters: {
        type: "object",
        properties: {
          daysAhead: { type: "integer", description: "Zeitraum in Tagen (Default 90, max 365)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_transactions",
      description: "Letzte Transaktionen eines Portfolios des Nutzers (Kauf/Verkauf/Dividende).",
      parameters: {
        type: "object",
        properties: {
          portfolioName: { type: "string", description: "Name (oder Namensteil) des Portfolios" },
          limit: { type: "integer", description: "Anzahl (Default 10, max 20)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_stock_info",
      description:
        "Stammdaten und Kennzahlen eines Titels aus der App-Datenbank: Kurs, Währung, KGV, PEG, Dividendenrendite, YTD, 52-Wochen-Spanne, Signal-Score und Sektor.",
      parameters: {
        type: "object",
        properties: {
          ticker: { type: "string", description: "Ticker, z. B. NESN oder AAPL" },
        },
        required: ["ticker"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_stocks",
      description: "Titel in der App-Datenbank per Firmenname oder Ticker-Fragment finden (liefert Ticker).",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Suchbegriff, z. B. «Nestlé»" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_us_fundamentals",
      description:
        "Echte Bilanz-Fakten (Umsatz-Trend, Nettomarge, Free Cash Flow) von Financial Datasets — NUR für US-gelistete Titel.",
      parameters: {
        type: "object",
        properties: {
          ticker: { type: "string", description: "US-Ticker, z. B. AAPL" },
        },
        required: ["ticker"],
      },
    },
  },
];

/** Pur & testbar: Portfolio per Namensteil finden (case-insensitiv, eindeutig bevorzugt). */
export function matchPortfolioByName<T extends { name: string }>(
  portfolios: T[],
  name: string | undefined | null
): T | null {
  if (!name?.trim()) return null;
  const q = name.trim().toLowerCase();
  const exact = portfolios.find((p) => p.name.toLowerCase() === q);
  if (exact) return exact;
  const partial = portfolios.filter((p) => p.name.toLowerCase().includes(q));
  return partial.length === 1 ? partial[0] : partial[0] ?? null;
}

const fmtChf = (v: number) => `CHF ${Math.round(v).toLocaleString("de-CH")}`;

async function resolvePortfolio(userId: number, portfolioName?: string) {
  const { getSavedPortfolios } = await import("../db");
  const portfolios = await getSavedPortfolios(userId);
  if (!portfolios.length) return { portfolio: null as any, portfolios };
  const matched = matchPortfolioByName(portfolios as any[], portfolioName);
  if (matched) return { portfolio: matched, portfolios };
  if (portfolioName?.trim()) return { portfolio: null as any, portfolios };
  // Default: grösstes Live-Portfolio (nach Positionszahl), sonst erstes.
  const withCount = (portfolios as any[]).map((p) => {
    let count = 0;
    try {
      const raw = JSON.parse(p.portfolioData);
      count = (Array.isArray(raw) ? raw : raw.stocks ?? []).length;
    } catch { /* count 0 */ }
    return { p, count };
  });
  const live = withCount.filter((x) => x.p.isLive).sort((a, b) => b.count - a.count)[0];
  return { portfolio: (live ?? withCount[0])?.p ?? null, portfolios };
}

async function toolPortfolioDetails(userId: number, args: any): Promise<string> {
  const { portfolio, portfolios } = await resolvePortfolio(userId, args?.portfolioName);
  if (!portfolio) {
    return portfolios.length
      ? `Kein Portfolio namens «${args?.portfolioName}» gefunden. Vorhanden: ${(portfolios as any[]).map((p) => p.name).join(", ")}.`
      : "Der Nutzer hat noch keine Portfolios.";
  }
  const { buildPortfolioBriefing } = await import("./copilotContext");
  const briefing = await buildPortfolioBriefing(userId, portfolio.id);
  return briefing ?? `Portfolio «${portfolio.name}» konnte nicht bewertet werden (Daten unvollständig).`;
}

async function toolUpcomingDividends(userId: number, args: any): Promise<string> {
  const daysAhead = Math.min(Math.max(parseInt(String(args?.daysAhead ?? 90), 10) || 90, 7), 365);
  const { getSavedPortfolios, getPortfolioTransactions } = await import("../db");
  const { getPortfolioDividends } = await import("../dividendCalendar");
  const { aggregateHoldingsFromTransactions, aggregateHoldingsFromPortfolioData } = await import("../routers/dividendCalendarRouter");

  const portfolios = await getSavedPortfolios(userId);
  const holdings: Record<string, number> = {};
  for (const p of portfolios as any[]) {
    const txs = await getPortfolioTransactions(p.id);
    if (txs.length > 0) {
      aggregateHoldingsFromTransactions(txs, holdings);
    } else {
      try {
        const raw = JSON.parse(p.portfolioData);
        aggregateHoldingsFromPortfolioData(Array.isArray(raw) ? raw : raw.stocks ?? [], holdings);
      } catch { /* leer */ }
    }
  }
  const tickers = Object.keys(holdings).filter((t) => holdings[t] > 0);
  if (!tickers.length) return "Keine Positionen mit Bestand — daher keine anstehenden Dividenden.";

  const todayStr = new Date().toISOString().split("T")[0];
  const horizon = new Date(Date.now() + daysAhead * 86400000);
  const dividends = (await getPortfolioDividends(tickers, daysAhead))
    .filter((d) => d.exDividendDate && new Date(d.exDividendDate) <= horizon && d.exDividendDate >= todayStr)
    .sort((a, b) => a.exDividendDate.localeCompare(b.exDividendDate))
    .slice(0, 15);
  if (!dividends.length) return `Keine anstehenden Dividenden in den nächsten ${daysAhead} Tagen gefunden.`;

  const lines: string[] = [`Anstehende Dividenden (BRUTTO, vor Verrechnungs-/Quellensteuer), nächste ${daysAhead} Tage:`];
  let totalChf = 0;
  for (const d of dividends) {
    const shares = holdings[d.ticker] ?? holdings[d.ticker.toUpperCase()] ?? 0;
    const amountChf = await convertToCHF(d.amount, d.currency || "CHF", todayStr);
    const fxMissing = d.amount > 0 && !(amountChf > 0);
    const income = fxMissing ? null : shares * amountChf;
    if (income !== null) totalChf += income;
    lines.push(
      `- ${d.exDividendDate} ${d.ticker}: ${d.amount} ${d.currency}/Aktie × ${shares}` +
      (income !== null ? ` ≈ ${fmtChf(income)}` : " (kein Wechselkurs verfügbar)") +
      (d.type === "estimated" ? " [geschätzt]" : "")
    );
  }
  lines.push(`Summe ≈ ${fmtChf(totalChf)} brutto.`);
  return lines.join("\n");
}

async function toolTransactions(userId: number, args: any): Promise<string> {
  const limit = Math.min(Math.max(parseInt(String(args?.limit ?? 10), 10) || 10, 1), 20);
  const { portfolio, portfolios } = await resolvePortfolio(userId, args?.portfolioName);
  if (!portfolio) {
    return portfolios.length
      ? `Kein Portfolio namens «${args?.portfolioName}» gefunden. Vorhanden: ${(portfolios as any[]).map((p) => p.name).join(", ")}.`
      : "Der Nutzer hat noch keine Portfolios.";
  }
  const { getPortfolioTransactions } = await import("../db");
  const txs = (await getPortfolioTransactions(portfolio.id))
    .sort((a: any, b: any) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime())
    .slice(0, limit);
  if (!txs.length) return `«${portfolio.name}» hat keine erfassten Transaktionen.`;
  const label = (t: string) =>
    t === "buy" || t === "entry" ? "Kauf" : t === "sell" ? "Verkauf" : t === "dividend" ? "Dividende" : t;
  return [
    `Letzte ${txs.length} Transaktionen in «${portfolio.name}»:`,
    ...txs.map((t: any) =>
      `- ${String(t.transactionDate).slice(0, 10)}: ${label(t.transactionType)}${t.ticker ? ` ${parseFloat(t.shares ?? "0") || ""} × ${t.ticker}` : ""}` +
      (t.totalAmountCHF ? ` (${fmtChf(parseFloat(t.totalAmountCHF))})` : "")
    ),
  ].join("\n");
}

async function toolStockInfo(_userId: number, args: any): Promise<string> {
  const ticker = String(args?.ticker ?? "").trim().toUpperCase();
  if (!ticker) return "Bitte einen Ticker angeben.";
  const { getDb } = await import("../db");
  const db = await getDb();
  if (!db) return "Datenbank nicht verfügbar.";
  const { stocks } = await import("../../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  const [s]: any[] = await db.select().from(stocks).where(eq(stocks.ticker, ticker)).limit(1);
  if (!s) return `«${ticker}» ist nicht in der App-Datenbank. Mit search_stocks nach dem Firmennamen suchen.`;
  const n = (v: any) => (v != null && Number.isFinite(parseFloat(v)) ? parseFloat(v) : null);
  const parts = [
    `${s.ticker} — ${s.companyName ?? "?"} (${s.sector ?? "Sektor unbekannt"}, ${s.currency ?? "CHF"})`,
    n(s.currentPrice) !== null ? `Kurs ${n(s.currentPrice)} ${s.currency ?? ""}` : null,
    n(s.ytdPerformance) !== null ? `YTD ${n(s.ytdPerformance)! >= 0 ? "+" : ""}${n(s.ytdPerformance)!.toFixed(1)}%` : null,
    n(s.peRatio) !== null ? `KGV ${n(s.peRatio)!.toFixed(1)}` : null,
    n(s.pegRatio) !== null ? `PEG ${n(s.pegRatio)!.toFixed(2)}` : null,
    n(s.dividendYield) !== null ? `Dividendenrendite ${n(s.dividendYield)!.toFixed(1)}%` : null,
    s.signalScore != null ? `Signal-Score ${s.signalScore}/100 (${s.signalType ?? "—"})` : null,
    n(s.fiftyTwoWeekLow) !== null && n(s.fiftyTwoWeekHigh) !== null
      ? `52W-Spanne ${n(s.fiftyTwoWeekLow)}–${n(s.fiftyTwoWeekHigh)}`
      : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

async function toolSearchStocks(_userId: number, args: any): Promise<string> {
  const query = String(args?.query ?? "").trim();
  if (query.length < 2) return "Bitte mindestens 2 Zeichen Suchbegriff angeben.";
  const { getDb } = await import("../db");
  const db = await getDb();
  if (!db) return "Datenbank nicht verfügbar.";
  const { stocks } = await import("../../drizzle/schema");
  const { or, like } = await import("drizzle-orm");
  const rows: any[] = await db
    .select({ ticker: stocks.ticker, companyName: stocks.companyName, sector: stocks.sector })
    .from(stocks)
    .where(or(like(stocks.companyName, `%${query}%`), like(stocks.ticker, `%${query}%`)))
    .limit(5);
  if (!rows.length) return `Kein Titel zu «${query}» in der App-Datenbank gefunden.`;
  return rows.map((r) => `- ${r.ticker}: ${r.companyName ?? "?"} (${r.sector ?? "—"})`).join("\n");
}

async function toolUsFundamentals(_userId: number, args: any): Promise<string> {
  const ticker = String(args?.ticker ?? "").trim();
  if (!ticker) return "Bitte einen Ticker angeben.";
  const { isFinancialDatasetsConfigured, toUsTicker, getFundamentalsFacts } = await import("./financialDatasets");
  if (!isFinancialDatasetsConfigured()) return "Financial-Datasets-Dienst ist nicht konfiguriert — keine Bilanz-Fakten verfügbar.";
  if (!toUsTicker(ticker)) return `«${ticker}» ist kein US-Titel — Financial Datasets deckt nur US-gelistete Titel ab.`;
  const facts = await getFundamentalsFacts(ticker);
  return facts?.summary ?? `Für «${ticker}» liefert Financial Datasets keine Daten.`;
}

const TOOL_IMPL: Record<string, (userId: number, args: any) => Promise<string>> = {
  get_portfolio_details: toolPortfolioDetails,
  get_upcoming_dividends: toolUpcomingDividends,
  get_transactions: toolTransactions,
  get_stock_info: toolStockInfo,
  search_stocks: toolSearchStocks,
  get_us_fundamentals: toolUsFundamentals,
};

const TOOL_TIMEOUT_MS = 12_000;

/**
 * Führt ein Copilot-Tool aus — IMMER mit String-Ergebnis (Fehler/Timeout als
 * ehrliche Meldung), damit die Tool-Schleife nie den Chat abbricht.
 */
export async function executeCopilotTool(userId: number, name: string, argsJson: string): Promise<string> {
  const impl = TOOL_IMPL[name];
  if (!impl) return `Unbekanntes Werkzeug «${name}».`;
  let args: any = {};
  try {
    args = argsJson ? JSON.parse(argsJson) : {};
  } catch {
    return "Ungültige Werkzeug-Argumente (kein JSON).";
  }
  try {
    const timeout = new Promise<string>((resolve) =>
      setTimeout(() => resolve("Zeitüberschreitung beim Datenabruf — bitte die Frage präzisieren oder erneut versuchen."), TOOL_TIMEOUT_MS)
    );
    return await Promise.race([impl(userId, args), timeout]);
  } catch (e) {
    console.warn(`[copilotTools] ${name} fehlgeschlagen:`, (e as Error).message);
    return `Der Datenabruf (${name}) ist fehlgeschlagen — bitte später erneut versuchen.`;
  }
}
