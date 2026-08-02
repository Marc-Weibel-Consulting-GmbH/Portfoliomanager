/**
 * Titelrendite über ein Messfenster — auf derselben Basis wie der Benchmark.
 *
 * Die Erfolgsmessung bildete ihre Renditen bisher aus zwei rohen Tageskursen:
 * dem beim Signal gespeicherten Kurs und `stocks.currentPrice`. Das verfehlt
 * zweierlei:
 *
 *  - AUSSCHÜTTUNGEN. Der Benchmark steht auf Gesamtrendite. Ein Titel, der
 *    im Fenster 2 % ausschüttet, sah damit um 2 Punkte schlechter aus, als er
 *    war — und zwar systematisch, nie zufällig.
 *  - SPLITS. Ein Verhältnis 2:1 im Fenster erscheint als Kurssturz von 50 %.
 *    Selten, aber wenn, dann ruinös für die betroffene Messung: Ein einziger
 *    solcher Fall verschiebt den Durchschnitt einer kleinen Stichprobe massiv.
 *
 * Beides löst die bereinigte Reihe. `historical_prices.adjustedClose` stammt
 * aus EODHDs `adjusted_close` und rechnet Splits UND Ausschüttungen ein — es
 * ist dieselbe Grösse, auf der auch die Benchmark-Reihe steht.
 *
 * KEIN Rückfall auf rohe Kurse. Fehlt die Reihe, gibt es keine Rendite. Eine
 * Zahl auf anderer Basis stillschweigend danebenzustellen, wäre genau der
 * Fehler, den dieses Modul behebt.
 */

import { computeWindowReturn, type DailyClose } from "./signals/benchmarkAlpha";

export interface RenditeErgebnis {
  /** Rendite über das Fenster als Dezimalbruch (0.05 = +5 %). */
  rendite: number;
  /** Anzahl Kurszeilen, aus denen sie stammt — für Diagnose im Log. */
  kurspunkte: number;
}

/**
 * Bereinigte Kursreihen mehrerer Titel — EIN Query.
 *
 * Wer je Zeile ein eigenes Messfenster braucht (die Snapshots liegen an
 * verschiedenen Tagen), holt die Reihen einmal über das weiteste Fenster und
 * rechnet die einzelnen Fenster danach im Speicher. Sonst entsteht eine
 * Abfrage je Zeile.
 */
export async function kursreihenAusHistorie(
  tickers: string[],
  vonDatum: string,
  bisDatum: string,
): Promise<Map<string, DailyClose[]>> {
  const reihen = new Map<string, DailyClose[]>();
  const eindeutig = [...new Set(tickers.filter(Boolean))];
  if (!eindeutig.length) return reihen;

  try {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) return reihen;

    const { historicalPrices } = await import("../../drizzle/schema");
    const { and, inArray, gte, lte, sql } = await import("drizzle-orm");

    // Sieben Tage Vorlauf, damit auch bei einem Feiertag am Fensterbeginn ein
    // Startkurs gefunden wird (computeWindowReturn toleriert genau diese Lücke).
    const vorlauf = new Date(vonDatum);
    vorlauf.setDate(vorlauf.getDate() - 7);
    const abStr = vorlauf.toISOString().slice(0, 10);

    const rows = await db
      .select({
        ticker: historicalPrices.ticker,
        date: historicalPrices.date,
        close: sql<string>`COALESCE(${historicalPrices.adjustedClose}, ${historicalPrices.close})`,
      })
      .from(historicalPrices)
      .where(and(
        inArray(historicalPrices.ticker, eindeutig),
        gte(historicalPrices.date, abStr),
        lte(historicalPrices.date, bisDatum),
      ));

    for (const r of rows) {
      if (!reihen.has(r.ticker)) reihen.set(r.ticker, []);
      reihen.get(r.ticker)!.push({ date: r.date, close: r.close });
    }
  } catch (e) {
    console.warn("[titelRendite] Kurshistorie nicht lesbar (non-fatal):", (e as Error).message);
  }

  return reihen;
}

/**
 * Rendite eines Titels über ein Fenster aus einer bereits geladenen Reihe.
 *
 * `null`, wenn kein belastbares Fenster gebildet werden kann — nie 0.
 */
export function renditeAusReihe(
  reihe: DailyClose[] | undefined,
  startDate: string,
  endDate: string,
): RenditeErgebnis | null {
  if (!reihe || !reihe.length) return null;
  const r = computeWindowReturn(reihe, startDate, endDate);
  if (r === null || !Number.isFinite(r)) return null;
  return { rendite: r, kurspunkte: reihe.length };
}

/** Bequemlichkeit für den Fall EIN Fenster für alle Titel. */
export async function renditenAusKurshistorie(
  tickers: string[],
  startDate: string,
  endDate: string,
): Promise<Map<string, RenditeErgebnis>> {
  const reihen = await kursreihenAusHistorie(tickers, startDate, endDate);
  const ergebnis = new Map<string, RenditeErgebnis>();
  for (const [ticker, reihe] of reihen) {
    const r = renditeAusReihe(reihe, startDate, endDate);
    if (r) ergebnis.set(ticker, r);
  }
  return ergebnis;
}
