/**
 * Watchlist-Screener — sucht im Gesamtuniversum die Titel mit den besten
 * Scores und schlägt sie zur Aufnahme in die Watchlist vor.
 *
 * Zweistufig, damit nicht für 5'000 Titel Fundamentaldaten geholt werden
 * müssen, bevor klar ist, worum es geht:
 *
 *  1. SAMMELN — der EODHD-Screener liefert je Börse die grössten Titel
 *     (Mindest-Marktkapitalisierung als Vorfilter). Alles Gesichtete wird im
 *     Protokoll festgehalten, auch was schon in der Watchlist steht.
 *  2. RECHNEN — für die neuen Titel werden Qualität und Bewertung mit
 *     DERSELBEN Rechnung bestimmt wie auf der Titelseite (`getDreiScores`),
 *     häppchenweise wie die Punkt-in-Zeit-Rekonstruktion: kleine Läufe
 *     sterben nicht.
 *
 * Der Screener ergänzt die Watchlist, er ersetzt nichts von selbst: Die
 * Übernahme eines Kandidaten bleibt eine Admin-Entscheidung je Titel.
 */

import { ENV } from "../_core/env";
import { retryFetch } from "../_core/retryUtil";
import { tickerAusScreenerCode } from "./universeExpansion";

const EODHD_BASE_URL = "https://eodhd.com/api";

/** Börsen des Anlageuniversums (EODHD-Exchange-Codes). */
export const SCREENER_BOERSEN = ["us", "sw", "xetra", "pa", "lse", "as", "mi"] as const;

/**
 * Welche Exchange-Codes eine Antwort tragen darf, wenn nach dieser Börse
 * gefragt wurde. Doppelter Boden zum Filter in der Anfrage: Beim ersten
 * Live-Lauf ignorierte der EODHD-Screener den Börsen-Parameter und lieferte
 * eine globale Liste — sortiert nach roher Marktkapitalisierung standen dann
 * Vietnamesische-Dong- und Argentinische-Peso-Titel (numerisch riesig) zuoberst.
 * Was nicht zur angefragten Börse gehört, wird deshalb hier verworfen.
 */
export const ERLAUBTE_EXCHANGE_CODES: Record<string, string[]> = {
  us: ["US", "NYSE", "NASDAQ", "AMEX", "BATS"],
  sw: ["SW", "SWX", "VX"],
  xetra: ["XETRA", "DE", "F"],
  pa: ["PA"],
  lse: ["LSE", "L"],
  as: ["AS"],
  mi: ["MI"],
};

/** Seitengrösse des EODHD-Screeners (API-Maximum 100). */
const SEITE = 100;

export interface SammelErgebnis {
  gesichtet: number;
  neu: number;
  bereitsInWatchlist: number;
  meldungen: string[];
}

interface RohKandidat {
  ticker: string;
  name: string | null;
  boerse: string | null;
  sektor: string | null;
  waehrung: string | null;
  marktKap: number | null;
  dividendenrendite: number | null;
}

/**
 * Stufe 1: Universum je Börse einsammeln und als Kandidaten des Laufs ablegen.
 */
export async function sammleUniversum(
  laufId: number,
  parameter: { boersen: string[]; minMarktKapMrd: number; maxJeBoerse: number },
): Promise<SammelErgebnis> {
  const apiKey = ENV.eodhdApiKey;
  if (!apiKey) throw new Error("EODHD-API-Schlüssel nicht konfiguriert");

  const meldungen: string[] = [];
  const gesehen = new Map<string, RohKandidat>();

  for (const boerse of parameter.boersen) {
    const erlaubt = ERLAUBTE_EXCHANGE_CODES[boerse] ?? [boerse.toUpperCase()];
    let jeBoerse = 0;
    let fremde = 0;
    for (let offset = 0; offset < parameter.maxJeBoerse; offset += SEITE) {
      // Die Börse gehört als Filter-Tripel IN `filters` — ein eigener
      // `exchange=`-Parameter wird vom Screener-Endpunkt ignoriert (so kam
      // beim ersten Lauf die globale Liste zurück, siehe oben).
      const filters = [
        ["market_capitalization", ">=", Math.round(parameter.minMarktKapMrd * 1e9)],
        ["exchange", "=", boerse],
      ];
      const url =
        `${EODHD_BASE_URL}/screener?api_token=${apiKey}` +
        `&sort=market_capitalization.desc&limit=${SEITE}&offset=${offset}` +
        `&filters=${encodeURIComponent(JSON.stringify(filters))}`;
      let items: any[];
      try {
        const resp = await retryFetch(url, {}, { maxRetries: 2, baseDelay: 1000 });
        const data: any = await resp.json();
        items = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
      } catch (err) {
        meldungen.push(`Börse ${boerse}, Seite ${offset / SEITE + 1}: ${(err as Error).message}`);
        break;
      }
      if (items.length === 0) break;
      for (const item of items) {
        const exch = String(item.exchange || "").toUpperCase();
        if (!erlaubt.includes(exch)) { fremde++; continue; }
        // LSE-Codes mit führender «0» sind Zweitkotierungen des International
        // Order Book (z. B. 0QYI = Netflix) — dieselbe Sorte Doppellistung wie
        // die CEDEARs: Das Original gehört ins Universum, nicht das Zertifikat.
        const codeRoh = String(item.code || "").trim().toUpperCase();
        if (boerse === "lse" && codeRoh.startsWith("0")) { fremde++; continue; }
        const ticker = tickerAusScreenerCode(item.code || "", item.exchange || boerse);
        if (!ticker || gesehen.has(ticker)) continue;
        gesehen.set(ticker, {
          ticker,
          name: item.name ?? null,
          boerse: exch,
          sektor: item.sector ?? null,
          waehrung: item.currency ?? null,
          marktKap: Number.isFinite(item.market_capitalization) ? item.market_capitalization : null,
          dividendenrendite: Number.isFinite(item.dividend_yield) ? item.dividend_yield : null,
        });
        jeBoerse++;
      }
      if (items.length < SEITE) break; // letzte Seite
    }
    meldungen.push(
      `Börse ${boerse}: ${jeBoerse} Titel` +
      (fremde > 0 ? ` (${fremde} fremde Börsen-Einträge verworfen)` : ""),
    );
  }

  // Wenn ALLES verworfen wurde, stimmt die Anfrage nicht — das soll man sehen,
  // statt einen leeren Lauf für ein leeres Universum zu halten.
  if (gesehen.size === 0) {
    throw new Error(
      "Der EODHD-Screener lieferte keinen einzigen Titel der angefragten Börsen — " +
      "Filterformat prüfen. Meldungen: " + meldungen.join(" | "),
    );
  }

  // Bestehende Watchlist markieren — die wird vom Cron ohnehin gerechnet.
  const { getDb } = await import("../db");
  const db = await getDb();
  if (!db) throw new Error("Datenbank nicht verfügbar");
  const { stocks } = await import("../../drizzle/schema");
  const vorhandene = await db.select({ ticker: stocks.ticker }).from(stocks);
  const vorhandeneSet = new Set(vorhandene.map((r: any) => String(r.ticker).toUpperCase()));

  const { ergaenzeKandidaten } = await import("./screenerStore");
  const kandidaten = Array.from(gesehen.values()).map((k) => {
    const inWatchlist = vorhandeneSet.has(k.ticker.toUpperCase()) ? 1 : 0;
    return { ...k, inWatchlist, status: inWatchlist ? "vorhanden" : "wartend" };
  });
  const ablage = await ergaenzeKandidaten(laufId, kandidaten);
  if (ablage.zeilenFehler > 0) {
    meldungen.push(
      `${ablage.zeilenFehler} Kandidaten nicht ablegbar` +
      (ablage.ersterFehler ? ` — erster Fehler: ${ablage.ersterFehler}` : ""),
    );
  }
  if (ablage.eingefuegt === 0 && kandidaten.some((k) => k.status === "wartend")) {
    throw new Error(
      "Kein einziger Kandidat liess sich ablegen." +
      (ablage.ersterFehler ? ` Erster Fehler: ${ablage.ersterFehler}` : ""),
    );
  }

  const bereitsInWatchlist = kandidaten.filter((k) => k.inWatchlist).length;
  return {
    gesichtet: kandidaten.length,
    neu: kandidaten.length - bereitsInWatchlist,
    bereitsInWatchlist,
    meldungen,
  };
}

export interface RechenErgebnis {
  berechnet: number;
  fehlgeschlagen: number;
  nochOffen: number;
  meldungen: string[];
}

/** Zeitlimit je Titel — ein hängender Fundamentaldaten-Abruf darf nicht das
 *  ganze Häppchen (und damit den «aktiv»-Zustand) blockieren. */
const TITEL_TIMEOUT_MS = 25_000;
/** Zeitbudget je Häppchen — danach wird sauber beendet statt weitergerechnet. */
const HAEPPCHEN_BUDGET_MS = 150_000;

function mitTimeout<T>(p: Promise<T>, ms: number, was: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Zeitüberschreitung (${was}, ${ms / 1000}s)`)), ms)),
  ]);
}

/**
 * Stufe 2: das nächste Häppchen unberechneter Kandidaten mit den drei Scores
 * bewerten. Klein halten — lange Läufe sterben (gleiches Muster wie die
 * Rekonstruktion).
 */
export async function rechneHaeppchen(laufId: number, maxTitel: number): Promise<RechenErgebnis> {
  const { offeneKandidaten, schreibeErgebnis } = await import("./screenerStore");
  const { getDreiScores } = await import("./dreiScoresService");

  const offen = await offeneKandidaten(laufId, maxTitel);
  const meldungen: string[] = [];
  const start = Date.now();
  let berechnet = 0;
  let fehlgeschlagen = 0;

  for (const k of offen) {
    if (Date.now() - start > HAEPPCHEN_BUDGET_MS) {
      meldungen.push("Zeitbudget des Häppchens erreicht — Rest folgt im nächsten Durchgang.");
      break;
    }
    try {
      const scores = await mitTimeout(
        getDreiScores(k.ticker, {
          sektor: k.sektor,
          dividendenrendite: k.dividendenrendite,
        }),
        TITEL_TIMEOUT_MS,
        k.ticker,
      );
      await schreibeErgebnis(laufId, k.ticker, {
        status: "berechnet",
        qualitaet: scores.qualitaet.gesamt,
        bewertung: scores.bewertung.score,
        signalScore: scores.signal.score,
        signalLabel: scores.signal.label,
      });
      berechnet++;
    } catch (err) {
      await schreibeErgebnis(laufId, k.ticker, {
        status: "fehler",
        fehler: (err as Error).message,
      });
      fehlgeschlagen++;
      meldungen.push(`${k.ticker}: ${(err as Error).message}`);
    }
    // EODHD nicht fluten — die Fundamentaldaten-Abrufe laufen sequenziell.
    await new Promise((r) => setTimeout(r, 150));
  }

  const nochOffen = (await offeneKandidaten(laufId, 1)).length > 0
    ? (await zaehleOffene(laufId))
    : 0;
  return { berechnet, fehlgeschlagen, nochOffen, meldungen: meldungen.slice(0, 10) };
}

async function zaehleOffene(laufId: number): Promise<number> {
  const { getDb } = await import("../db");
  const db = await getDb();
  if (!db) return 0;
  const { sql } = await import("drizzle-orm");
  const res: any = await db.execute(sql`
    SELECT COUNT(*) AS anzahl FROM screener_kandidat
    WHERE laufId = ${laufId} AND status = 'wartend'`);
  const liste = Array.isArray(res) ? (res[0] ?? res) : (res?.rows ?? []);
  return Number((liste as any[])[0]?.anzahl ?? 0);
}

/**
 * Einen berechneten Kandidaten in die Watchlist übernehmen: Eintrag in
 * `stocks` (Quelle klar gekennzeichnet) + Kurshistorie nachladen, damit
 * Timing und Optimierung sofort eine Basis haben.
 */
export async function uebernimmKandidat(k: {
  ticker: string;
  name: string | null;
  sektor: string | null;
  waehrung: string | null;
  marktKap: number | null;
  dividendenrendite: number | null;
  laufId: number;
}): Promise<{ uebernommen: boolean; grund?: string }> {
  const { getDb } = await import("../db");
  const db = await getDb();
  if (!db) throw new Error("Datenbank nicht verfügbar");
  const { stocks } = await import("../../drizzle/schema");
  const { eq } = await import("drizzle-orm");

  const existing = await db.select({ id: stocks.id }).from(stocks)
    .where(eq(stocks.ticker, k.ticker)).limit(1);
  if (existing.length > 0) {
    return { uebernommen: false, grund: "Titel steht bereits in der Tabelle" };
  }

  // Aktueller Kurs via EODHD, damit der Titel nicht mit Kurs 0 startet.
  let kurs = "0";
  try {
    if (ENV.eodhdApiKey) {
      const eoTicker = k.ticker.includes(".") ? k.ticker : `${k.ticker}.US`;
      const resp = await fetch(`${EODHD_BASE_URL}/real-time/${eoTicker}?api_token=${ENV.eodhdApiKey}&fmt=json`);
      if (resp.ok) {
        const data: any = await resp.json();
        const p = parseFloat(data?.close ?? data?.adjusted_close ?? "0");
        if (p > 0) kurs = String(p);
      }
    }
  } catch { /* Kurs holt der nächste Refresh-Lauf nach */ }

  await db.insert(stocks).values({
    ticker: k.ticker,
    companyName: k.name ?? k.ticker,
    sector: k.sektor,
    currency: k.waehrung,
    marketCap: k.marktKap?.toString() ?? null,
    dividendYield: k.dividendenrendite?.toString() ?? null,
    listType: "watchlist",
    source: "ai_recommended",
    notes: `screener|lauf:${k.laufId}`,
    isActive: 1,
    currentPrice: kurs,
  });

  // Kurshistorie nachladen (non-fatal — der tägliche Cron holt sonst nach).
  try {
    const { autoBackfillNewSymbols } = await import("../autoBackfill");
    await autoBackfillNewSymbols([k.ticker]);
  } catch (err) {
    console.warn(`[Screener] Backfill für ${k.ticker} fehlgeschlagen:`, (err as Error).message);
  }

  return { uebernommen: true };
}
