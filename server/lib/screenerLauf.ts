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
import { eodhdBruchZuProzent } from "./dividendenrendite";
import { toEodhdSymbol } from "./eodhdSymbol";

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
        // US-Vorzugsaktien-Serien (MS-PF, MS-PA, …) schon am Code aussortieren —
        // sie sind Zinspapiere im Aktienkleid und erschienen im Live-Lauf als
        // fünffacher «Morgan Stanley». `General.Type` in Stufe 2 bleibt die
        // Autorität; der Mustertest spart nur den Abruf für die offensichtlichen.
        if (boerse === "us" && /-P[A-Z]?$/.test(codeRoh)) { fremde++; continue; }
        // ADRs/Zertifikate schon am Namen aussortieren — spart die
        // Hauptkotierungs-Abfrage in Stufe 2 für die offensichtlichen Fälle.
        if (ADR_NAMENSMUSTER.test(String(item.name || ""))) { fremde++; continue; }
        const ticker = tickerAusScreenerCode(item.code || "", item.exchange || boerse);
        if (!ticker || gesehen.has(ticker)) continue;
        gesehen.set(ticker, {
          ticker,
          name: item.name ?? null,
          boerse: exch,
          sektor: item.sector ?? null,
          waehrung: item.currency ?? null,
          marktKap: Number.isFinite(item.market_capitalization) ? item.market_capitalization : null,
          // Vertrag an der Anbietergrenze: EODHD liefert einen Bruch (0.03 =
          // 3 %), Ablage und Bewertungsformel führen Prozent. Der Wert wird
          // exakt hier einmalig konvertiert und später nie anhand seiner Höhe
          // geraten oder nochmals skaliert.
          dividendenrendite: eodhdBruchZuProzent(item.dividend_yield),
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
  // Watchlist-Ticker auch in ihrer EODHD-Alias-Form merken (ROG.SW steht bei
  // EODHD als RO.SW, XETRA≙DE usw.) — sonst erscheint ein Watchlist-Titel
  // unter dem Alias als «neuer» Kandidat.
  const vorhandeneSet = new Set(vorhandene.flatMap((r: any) => {
    const t = String(r.ticker).toUpperCase();
    return [t, vergleichsTicker(toEodhdSymbol(t))];
  }));

  const { ergaenzeKandidaten } = await import("./screenerStore");
  const kandidaten = Array.from(gesehen.values()).map((k) => {
    const inWatchlist =
      vorhandeneSet.has(k.ticker.toUpperCase()) || vorhandeneSet.has(vergleichsTicker(k.ticker)) ? 1 : 0;
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
  zweitkotierungen: number;
  /** Vorzugsaktien, Fonds, OTC-Notizen — kein Stammtitel an regulärer Börse. */
  ausgeschlossen: number;
  nochOffen: number;
  meldungen: string[];
}

/**
 * Ticker auf eine vergleichbare Form bringen (Suffix-Aliasse der EODHD-Welt:
 * XETRA≙DE, LSE≙L, SWX≙SW; US-Ticker tragen bei uns kein Suffix).
 */
export function vergleichsTicker(t: string): string {
  const up = (t || "").trim().toUpperCase();
  const punkt = up.lastIndexOf(".");
  const [code, suffix] = punkt > 0 ? [up.slice(0, punkt), up.slice(punkt + 1)] : [up, "US"];
  const s = suffix === "XETRA" ? "DE" : suffix === "LSE" ? "L" : suffix === "SWX" ? "SW" : suffix;
  return `${code}.${s}`;
}

/**
 * ADR-/Zertifikats-typische Namensmuster (American Depositary Receipts/Shares,
 * CEDEARs, CDRs). Billiger Vorfilter vor der teuren Hauptkotierungs-Abfrage —
 * und die einzige Handhabe für Altbestände ohne erneuten API-Abruf.
 */
export const ADR_NAMENSMUSTER = /\bADRs?\b|\bADS\b|American Depositary|\bGDRs?\b|\bGDS\b|Global Depositary|CEDEAR|\bCDR\b|\bDRC\b/i;

/**
 * Stammdaten eines Titels aus dem EODHD-`General`-Block: Hauptkotierung,
 * Instrumententyp, tatsächlicher Börsenplatz und Sitzland. Vorher wurde nur
 * `General::PrimaryTicker` geholt — damit rutschten Vorzugsaktien (Typ
 * «Preferred Stock», z. B. fünf Morgan-Stanley-Serien) und OTC-Zweitnotizen
 * (China Life als CILJF am Pink-Market) durch, weil beide formal ihre eigene
 * «Hauptkotierung» sind.
 */
interface TitelStammdaten {
  primaerTicker: string | null;
  /** z. B. "Common Stock", "Preferred Stock", "ETF". */
  typ: string | null;
  /** Tatsächlicher Handelsplatz laut EODHD, z. B. "NYSE", "PINK", "OTCQB". */
  boersenplatz: string | null;
  /** Sitzland ISO-2, z. B. "US", "CN". */
  landIso: string | null;
  /** Handelswährung als ISO-Code, z. B. "CHF", "EUR", "GBP". */
  waehrungIso: string | null;
  /**
   * ISIN als quellenunabhängiger Emittentenschlüssel (Manus-Restpunkt: 84
   * berechnete Titel ohne EODHD-Primärticker). Nur gespeichert und
   * ausgewiesen — keine automatische Löschlogik darauf.
   */
  isin: string | null;
}

async function holeStammdaten(ticker: string): Promise<TitelStammdaten | null> {
  if (!ENV.eodhdApiKey) return null;
  const intern = ticker.includes(".") ? ticker : `${ticker}.US`;
  // Stammdaten und QualityMetrics müssen dieselbe Anbieterauflösung benutzen.
  // `.DE`/`.L` sind interne Darstellungen; EODHD erwartet `.XETRA`/`.LSE`.
  const symbol = toEodhdSymbol(intern);
  const url = `${EODHD_BASE_URL}/fundamentals/${encodeURIComponent(symbol)}` +
    `?api_token=${ENV.eodhdApiKey}&filter=General&fmt=json`;
  const resp = await retryFetch(url, {}, { maxRetries: 1, baseDelay: 500 });
  const data: any = await resp.json();
  if (!data || typeof data !== "object") return null;
  const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  return {
    primaerTicker: text(data.PrimaryTicker)?.toUpperCase() ?? null,
    typ: text(data.Type),
    boersenplatz: text(data.Exchange)?.toUpperCase() ?? null,
    landIso: text(data.CountryISO)?.toUpperCase() ?? null,
    waehrungIso: text(data.CurrencyCode)?.toUpperCase() ?? null,
    isin: text(data.ISIN)?.toUpperCase() ?? null,
  };
}

/** OTC-Handelsplätze — Zweitnotizen ohne reguläre Börsenaufsicht, kein Universum. */
function istOtcPlatz(boersenplatz: string | null): boolean {
  if (!boersenplatz) return false;
  return boersenplatz.startsWith("OTC") || boersenplatz === "PINK" || boersenplatz === "NMFQS";
}

/**
 * LSE-Notiz in Dollar = International-Order-Book-GDR, kein Stammtitel.
 *
 * Reguläre Londoner Stammaktien handeln in Pence/Pfund (GBX/GBP, vereinzelt
 * EUR); die Dollarlinien am IOB sind Hinterlegungsscheine (Samsung als
 * BC94.L, Lukoil-artige GDRs). Sie tragen weder «GDR» im Namen noch die
 * führende «0» der numerischen IOB-Codes — die Handelswährung ist das
 * verlässliche Erkennungszeichen. Ihre Kennzahlen sind zudem regelmässig
 * Währungsmüll (Won-Cashflow ÷ Dollar-Marktkapitalisierung ⇒ «FCF-Rendite
 * 2605 %» beim Live-Fund).
 */
export function istLseDollarNotiz(boerse: string | null, waehrungIso: string | null): boolean {
  const b = (boerse ?? "").toUpperCase();
  return (b === "LSE" || b === "L") && (waehrungIso ?? "").toUpperCase() === "USD";
}

/**
 * Ist der Kandidat eine Zweitkotierung — also nicht selbst die Hauptkotierung?
 * Dann fliegt er raus: Zweitkotierungen im Universum (NVDA.SW), aber auch ADRs
 * mit Hauptbörse ausserhalb (SK Hynix, NetEase). Die frühere ADR-Ausnahme ist
 * auf Wunsch gestrichen — pro Firma zählt nur der Hauptbörsenplatz, und liegt
 * der ausserhalb der sieben Börsen, gehört die Firma nicht ins Universum.
 */
export function istVerzichtbareZweitkotierung(ticker: string, primaer: string | null): { ja: boolean; hauptboerse?: string } {
  if (!primaer) return { ja: false };
  const kandidat = vergleichsTicker(ticker);
  const haupt = vergleichsTicker(primaer);
  if (kandidat === haupt) return { ja: false };
  return { ja: true, hauptboerse: haupt };
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
  let zweitkotierungen = 0;
  let ausgeschlossen = 0;

  for (const k of offen) {
    if (Date.now() - start > HAEPPCHEN_BUDGET_MS) {
      meldungen.push("Zeitbudget des Häppchens erreicht — Rest folgt im nächsten Durchgang.");
      break;
    }
    try {
      // Pro Titel nur der Hauptbörsenplatz — ADRs und Zweitkotierungen werden
      // aussortiert statt bewertet. Erst der billige Namenstest (fängt auch
      // Altbestände aus Läufen vor dem Sammel-Filter), dann die
      // Hauptkotierungs-Abfrage. Scheitert die Abfrage, wird normal
      // weitergerechnet — lieber ein Duplikat zu viel als ein Titel grundlos
      // verworfen.
      if (ADR_NAMENSMUSTER.test(k.name ?? "")) {
        await schreibeErgebnis(laufId, k.ticker, {
          status: "zweitkotierung",
          fehler: "ADR/Zertifikat (Namensmuster)",
        });
        zweitkotierungen++;
        continue;
      }
      const stamm = await mitTimeout(holeStammdaten(k.ticker), TITEL_TIMEOUT_MS, `${k.ticker} Stammdaten`)
        .catch(() => null);
      const metadaten = {
        land: stamm?.landIso ?? null,
        waehrung: stamm?.waehrungIso ?? null,
        primaerTicker: stamm?.primaerTicker ?? null,
        isin: stamm?.isin ?? null,
      };
      // Nur Stammaktien: Vorzugsaktien-Serien (Preferred Stock), Fonds und
      // Notes sind Zins-/Vehikelpapiere — im Live-Lauf stand Morgan Stanley
      // fünffach in den Top 30, einmal je Vorzugsserie. Fehlt der Typ, wird
      // normal weitergerechnet (lieber ein Fremdling zu viel als ein Titel
      // grundlos verworfen — gleiche Linie wie bei der Hauptkotierung).
      if (stamm?.typ && stamm.typ !== "Common Stock") {
        await schreibeErgebnis(laufId, k.ticker, {
          status: "ausgeschlossen",
          fehler: `kein Stammtitel: ${stamm.typ}`,
          ...metadaten,
        });
        ausgeschlossen++;
        continue;
      }
      // OTC-/Pink-Market-Notizen sind Zweitnotizen ohne reguläre Börse (China
      // Life als CILJF) — der Screener-Exchange-Filter «us» lässt sie durch,
      // weil EODHD sie unter dem US-Virtual-Exchange führt.
      if (istOtcPlatz(stamm?.boersenplatz ?? null)) {
        await schreibeErgebnis(laufId, k.ticker, {
          status: "ausgeschlossen",
          fehler: `OTC-Notiz (${stamm!.boersenplatz}) — kein regulärer Börsenplatz`,
          ...metadaten,
        });
        ausgeschlossen++;
        continue;
      }
      if (istLseDollarNotiz(k.boerse, stamm?.waehrungIso ?? null)) {
        await schreibeErgebnis(laufId, k.ticker, {
          status: "ausgeschlossen",
          fehler: "LSE-Dollarnotiz (IOB-GDR) — Hinterlegungsschein, kein Stammtitel",
          ...metadaten,
        });
        ausgeschlossen++;
        continue;
      }
      const zweit = istVerzichtbareZweitkotierung(k.ticker, stamm?.primaerTicker ?? null);
      if (zweit.ja) {
        await schreibeErgebnis(laufId, k.ticker, {
          status: "zweitkotierung",
          fehler: `Hauptbörse: ${zweit.hauptboerse}`,
          ...metadaten,
        });
        zweitkotierungen++;
        continue;
      }
      const scores = await mitTimeout(
        getDreiScores(k.ticker, {
          sektor: k.sektor,
          dividendenrendite: k.dividendenrendite,
        }),
        TITEL_TIMEOUT_MS,
        k.ticker,
      );
      // Keine einzige Säule berechenbar → das ist kein Kandidat, sondern eine
      // Datenlücke. Vorher stand so ein Titel als «berechnet» mit leeren
      // Scores in der Rangliste (4 Fälle im Lauf #150001, Manus-Restpunkt und
      // KIMI Befund 1): Status «fehler» mit Grund, damit Export und Zähler
      // ihn als das ausweisen, was er ist.
      if (scores.qualitaet.gesamt === null && scores.bewertung.score === null) {
        await schreibeErgebnis(laufId, k.ticker, {
          status: "fehler",
          fehler: "keine Fundamentaldaten — keine Säule berechenbar",
          ...metadaten,
        });
        fehlgeschlagen++;
        continue;
      }
      await schreibeErgebnis(laufId, k.ticker, {
        status: "berechnet",
        ...metadaten,
        qualitaet: scores.qualitaet.gesamt,
        bewertung: scores.bewertung.score,
        signalScore: scores.signal.score,
        signalLabel: scores.signal.label,
        // Die Herleitung gehört ins Protokoll — nur mit den Faktorwerten
        // lässt sich nachprüfen, ob ein Score korrekt zustande kam. Niveau,
        // Richtung und F-Score dazu, weil die Qualitäts-Kopfzahl aus BEIDEN
        // Säulen entsteht (60/40) — die Faktortabelle allein ergäbe sie nicht.
        qualitaetFaktoren: scores.qualitaet.niveau?.faktoren ?? null,
        bewertungFaktoren: scores.bewertung.faktoren ?? null,
        qualitaetNiveau: scores.qualitaet.niveau?.score ?? null,
        qualitaetRichtung: scores.qualitaet.richtung?.score ?? null,
        fScore: scores.qualitaet.richtung?.fScore ?? null,
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
  return { berechnet, fehlgeschlagen, zweitkotierungen, ausgeschlossen, nochOffen, meldungen: meldungen.slice(0, 10) };
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

  // Duplikatprüfung inklusive Alias-Formen: exakter Ticker UND die
  // EODHD-Vergleichsform (ROG.SW ≙ RO.SW, .DE ≙ .XETRA). Ohne das liesse
  // sich ein Watchlist-Titel unter seinem Alias ein zweites Mal übernehmen.
  const alleVorhandenen = await db.select({ ticker: stocks.ticker }).from(stocks);
  const ziel = vergleichsTicker(k.ticker);
  const schonDa = alleVorhandenen.some((r: any) => {
    const t = String(r.ticker).toUpperCase();
    return t === k.ticker.toUpperCase() || vergleichsTicker(toEodhdSymbol(t)) === ziel;
  });
  if (schonDa) {
    return { uebernommen: false, grund: "Titel steht bereits in der Watchlist (ggf. unter einem Ticker-Alias)" };
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
