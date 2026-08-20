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
import { titelKategorie } from "./titelKategorie";
import { validateDividendYield } from "./dividendValidation";

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
  parameter: {
    boersen: string[];
    minMarktKapMrd: number;
    maxJeBoerse: number;
    /**
     * Abweichungen je Börse (Marcs Vorgabe: mehr USA, mehr Schweiz).
     * Das globale 700er-Limit schnitt die USA ab (dort liegen 1'800+ Titel
     * über 1 Mrd.), während die SIX mit ~120 Titeln über 1 Mrd. mehr Tiefe
     * nur über eine tiefere Schwelle bekommt — Home Bias ist gewollt.
     */
    jeBoerse?: Record<string, { minMarktKapMrd?: number; maxJeBoerse?: number }>;
  },
): Promise<SammelErgebnis> {
  const apiKey = ENV.eodhdApiKey;
  if (!apiKey) throw new Error("EODHD-API-Schlüssel nicht konfiguriert");

  const meldungen: string[] = [];
  const gesehen = new Map<string, RohKandidat>();

  for (const boerse of parameter.boersen) {
    const erlaubt = ERLAUBTE_EXCHANGE_CODES[boerse] ?? [boerse.toUpperCase()];
    const minKapMrd = parameter.jeBoerse?.[boerse]?.minMarktKapMrd ?? parameter.minMarktKapMrd;
    const maxDieseBoerse = parameter.jeBoerse?.[boerse]?.maxJeBoerse ?? parameter.maxJeBoerse;
    let jeBoerse = 0;
    let fremde = 0;
    for (let offset = 0; offset < maxDieseBoerse; offset += SEITE) {
      // Die Börse gehört als Filter-Tripel IN `filters` — ein eigener
      // `exchange=`-Parameter wird vom Screener-Endpunkt ignoriert (so kam
      // beim ersten Lauf die globale Liste zurück, siehe oben).
      const filters = [
        ["market_capitalization", ">=", Math.round(minKapMrd * 1e9)],
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
/** Ein Titel darf bei einem transienten Gesamtzeitlimit höchstens zweimal erneut laufen. */
export const MAX_TITEL_WIEDERANLAEUFE = 2;

/**
 * Beim Wiederanlauf mehr Zeit: EXO.AS fiel in zwei Läufen in Folge am selben
 * 25-s-Limit aus — ein Retry mit identischem Limit scheitert an derselben
 * Stelle erneut. Timeout heisst «zu langsam», nicht «kaputt».
 */
export function titelZeitlimitMs(retryCount: number): number {
  return retryCount > 0 ? 40_000 : TITEL_TIMEOUT_MS;
}

/**
 * Fehlertext für «keine Säule berechenbar» aus der Datenquellen-Kennung der
 * Kennzahlen (E5): Am 17.08. liefen 429 Titel in «keine Fundamentaldaten»,
 * tatsächlich war das EODHD-Tageslimit erschöpft — Quota-Erschöpfung muss im
 * Protokoll als solche dastehen, sonst sieht sie aus wie eine Datenlücke und
 * niemand weiss, dass ein simpler Neustart nach Mitternacht genügt.
 */
export function fehlerGrundAusDatenquelle(dataSource: string | null): string {
  const basis = "keine Fundamentaldaten — keine Säule berechenbar";
  const m = dataSource?.match(/^Fallback \((.+)\)$/);
  if (!m) return basis;
  const grund = m[1];
  const http = grund.match(/HTTP (402|429)/);
  if (http) return `EODHD-Limit erschöpft (HTTP ${http[1]}) — nach Mitternacht UTC «Alle neu rechnen»`;
  return `${basis} (${grund})`;
}

export function titelFehlerBehandlung(
  fehler: string,
  retryCount: number,
): { status: "wartend" | "fehler"; retryCount: number; fehler: string } {
  const istTimeout = fehler.startsWith("Zeitüberschreitung (");
  if (!istTimeout || retryCount >= MAX_TITEL_WIEDERANLAEUFE) {
    return { status: "fehler", retryCount, fehler };
  }
  const naechsterRetry = retryCount + 1;
  return {
    status: "wartend",
    retryCount: naechsterRetry,
    fehler: `Wiederanlauf ${naechsterRetry}/${MAX_TITEL_WIEDERANLAEUFE}: ${fehler}`,
  };
}

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
      const zeitlimit = titelZeitlimitMs(k.retryCount);
      const stamm = await mitTimeout(holeStammdaten(k.ticker), zeitlimit, `${k.ticker} Stammdaten`)
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
      // Die Gegenprobe VOR der Score-Rechnung: Ein widerlegter Quellenwert
      // (LISP.SW: EODHD 18.98 %, Yahoo 1.93 %) darf die Bewertung nicht
      // tragen — der Wächter blendet den Faktor aus statt still zu kappen.
      // Unter der 8-%-Schwelle kommt die Prüfung ohne Netzwerkabruf zurück.
      const dividendenCheck = await validateDividendYield(k.ticker, stamm?.isin ?? null, k.dividendenrendite);
      const dividendenWiderlegtHinweis =
        dividendenCheck.status === "zu_pruefen" && k.dividendenrendite !== null
          ? `${k.dividendenrendite.toFixed(2)} % durch unabhängige Gegenprobe widerlegt` +
            (dividendenCheck.externalYield !== null ? ` (Yahoo ${dividendenCheck.externalYield.toFixed(2)} %)` : "") +
            " — Faktor ausgeblendet"
          : null;
      const scores = await mitTimeout(
        getDreiScores(k.ticker, {
          sektor: k.sektor,
          dividendenrendite: k.dividendenrendite,
          dividendenWiderlegtHinweis,
        }),
        zeitlimit,
        k.ticker,
      );
      // Keine einzige Säule berechenbar → das ist kein Kandidat, sondern eine
      // Datenlücke. Vorher stand so ein Titel als «berechnet» mit leeren
      // Scores in der Rangliste (4 Fälle im Lauf #150001, Manus-Restpunkt und
      // KIMI Befund 1): Status «fehler» mit Grund, damit Export und Zähler
      // ihn als das ausweisen, was er ist.
      if (scores.qualitaet.gesamt === null && scores.bewertung.score === null) {
        // E5: Der wahre Grund steht in der Datenquellen-Kennung der Kennzahlen
        // (Cache-Treffer, kein zusätzlicher Abruf) — Quota-Erschöpfung wird
        // benannt statt als Datenlücke getarnt.
        const { getQualityMetrics } = await import("./qualityMetricsService");
        const qmFehler = await getQualityMetrics(k.ticker).catch(() => null);
        await schreibeErgebnis(laufId, k.ticker, {
          status: "fehler",
          fehler: fehlerGrundAusDatenquelle(qmFehler?.dataSource ?? null),
          ...metadaten,
        });
        fehlgeschlagen++;
        continue;
      }
      // KGV-Schattenwerte (KIMI-PEG-Audit R2, Schattenphase): Vendor-Felder
      // und Selbstrechnung nebeneinander persistieren — der Cache macht den
      // Zweitaufruf kostenlos. Kein Score-Eingang; Grundlage für den
      // Umstellungs-Entscheid nach dem Beleg-Lauf.
      const { getQualityMetrics } = await import("./qualityMetricsService");
      const qm = await getQualityMetrics(k.ticker).catch(() => null);
      await schreibeErgebnis(laufId, k.ticker, {
        status: "berechnet",
        ...metadaten,
        kgvTrailing: qm?.trailingPE ?? null,
        kgvForward: qm?.forwardPE ?? null,
        kgvSelbst: qm?.kgvSelbst ?? null,
        kgvSelbstHinweis: qm?.kgvSelbstHinweis ?? null,
        pegRoh: qm?.adjustedPegRoh ?? null,
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
        retryCount: 0,
        dividendenValidierung: dividendenCheck.status,
        externeDividendenrendite: dividendenCheck.externalYield,
        dividendenPruefgrund: dividendenCheck.reason,
      });
      berechnet++;
    } catch (err) {
      const behandlung = titelFehlerBehandlung((err as Error).message, k.retryCount);
      await schreibeErgebnis(laufId, k.ticker, {
        status: behandlung.status,
        retryCount: behandlung.retryCount,
        fehler: behandlung.fehler,
      });
      if (behandlung.status === "fehler") fehlgeschlagen++;
      meldungen.push(`${k.ticker}: ${behandlung.fehler}`);
    }
    // EODHD nicht fluten — die Fundamentaldaten-Abrufe laufen sequenziell.
    await new Promise((r) => setTimeout(r, 150));
  }

  const nochOffen = (await offeneKandidaten(laufId, 1)).length > 0
    ? (await zaehleOffene(laufId))
    : 0;
  // Namensabgleich erst am Laufende: Die Partnerzeile einer Kreuznotierung
  // kann in einem späteren Häppchen liegen — vorher fehlt der Anker.
  if (nochOffen === 0) {
    const namensbereinigt = await bereinigeNamensDuplikate(laufId);
    if (namensbereinigt > 0) {
      zweitkotierungen += namensbereinigt;
      meldungen.push(`${namensbereinigt} namensgleiche Zweitnotizen ohne Anbieteridentität aussortiert.`);
    }
  }
  return { berechnet, fehlgeschlagen, zweitkotierungen, ausgeschlossen, nochOffen, meldungen: meldungen.slice(0, 10) };
}

/**
 * Letzte Dedup-Stufe (KIMI Punkt 4): namensgleiche Zeilen ohne ISIN und
 * Primärticker als Zweitkotierung aussortieren, wenn eine identifizierte
 * Partnerzeile an anderer Börse existiert. Idempotent — aussortierte Zeilen
 * verlassen den Status «berechnet» und tauchen im nächsten Aufruf nicht mehr auf.
 */
async function bereinigeNamensDuplikate(laufId: number): Promise<number> {
  const { alleKandidaten, schreibeErgebnis } = await import("./screenerStore");
  const { namensDuplikate } = await import("./namensDedup");
  const alle = await alleKandidaten(laufId);
  const duplikate = namensDuplikate(
    alle
      .filter((k) => k.status === "berechnet")
      .map((k) => ({
        ticker: k.ticker,
        name: k.name ?? null,
        boerse: k.boerse ?? null,
        sektor: k.sektor ?? null,
        isin: k.isin ?? null,
        primaerTicker: k.primaerTicker ?? null,
      })),
  );
  for (const d of duplikate) {
    await schreibeErgebnis(laufId, d.ticker, { status: "zweitkotierung", fehler: d.grund });
  }
  return duplikate.length;
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
  /**
   * Die im Lauf bereits fertig gerechneten Scores samt Faktor-Herleitung —
   * werden bei der Übernahme sofort als vorberechnete Zeile abgelegt
   * (Burkhalter-Befund: Die Titelseite zeigte bis zum nächsten Stundenlauf
   * «nicht beurteilbar», obwohl der Screener alles gerechnet hatte).
   */
  scores?: {
    qualitaet: number | null;
    qualitaetNiveau: number | null;
    qualitaetRichtung: number | null;
    fScore: number | null;
    bewertung: number | null;
    signalScore: number | null;
    signalLabel: string | null;
    qualitaetFaktoren: unknown[] | null;
    bewertungFaktoren: unknown[] | null;
  };
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
    // Kategorie automatisch aus Sektor + Dividendenrendite (Marc-Befund
    // 19.08.: übernommene Titel standen ohne Kategorie im Universum).
    category: titelKategorie(k.sektor, k.dividendenrendite),
    listType: "watchlist",
    // Kein eigener Enum-Wert im Schema — die Notes-Kennung "screener|lauf:N"
    // unterscheidet Screener-Übernahmen von KI-Empfehlungen (Quelle-Badge,
    // Filter und Statistik lesen sie im watchlistRouter/AdminWatchlist).
    source: "ai_recommended",
    notes: `screener|lauf:${k.laufId}`,
    isActive: 1,
    currentPrice: kurs,
  });

  // Die Screener-Scores sofort als vorberechnete Zeile ablegen: Die Titelseite
  // liest zuerst `stock_scores` und zeigte für frisch übernommene Titel bis zum
  // nächsten Stundenlauf «nicht beurteilbar» — obwohl Qualität, Bewertung und
  // Signal samt Herleitung längst gerechnet waren. Timing (braucht die
  // Kursreihe) trägt der Stundenlauf nach und überschreibt die Zeile komplett.
  if (k.scores && (k.scores.qualitaet !== null || k.scores.bewertung !== null)) {
    try {
      const { haltefestScores } = await import("./dreiScoresStore");
      const { qualitaetsBand, bewertungsBand } = await import("./dreiScores");
      await haltefestScores([{
        ticker: k.ticker,
        qualitaet: k.scores.qualitaet,
        qualitaetBand: qualitaetsBand(k.scores.qualitaet),
        niveau: k.scores.qualitaetNiveau,
        richtung: k.scores.qualitaetRichtung,
        fScore: k.scores.fScore ?? 0,
        fScoreBerechenbar: k.scores.fScore !== null ? 1 : 0,
        bewertung: k.scores.bewertung,
        bewertungBand: bewertungsBand(k.scores.bewertung),
        abdeckungNiveau: abdeckungAusFaktoren(k.scores.qualitaetFaktoren),
        abdeckungBewertung: abdeckungAusFaktoren(k.scores.bewertungFaktoren),
        timing: null,
        timingAbdeckung: null,
        regime: null,
        signalScore: k.scores.signalScore,
        signalLabel: k.scores.signalLabel,
        qualitaetFaktoren: k.scores.qualitaetFaktoren,
        bewertungFaktoren: k.scores.bewertungFaktoren,
        timingFaktoren: null,
      }]);
    } catch (err) {
      console.warn(`[Screener] Score-Ablage für ${k.ticker} fehlgeschlagen (non-fatal):`, (err as Error).message);
    }
  }

  // Kurshistorie nachladen (non-fatal — der tägliche Cron holt sonst nach).
  try {
    const { autoBackfillNewSymbols } = await import("../autoBackfill");
    await autoBackfillNewSymbols([k.ticker]);
  } catch (err) {
    console.warn(`[Screener] Backfill für ${k.ticker} fehlgeschlagen:`, (err as Error).message);
  }

  return { uebernommen: true };
}

/**
 * Belegtes Gewicht 0–1 aus einer abgelegten Faktor-Herleitung — dieselbe
 * Rechnung wie `baueTeilScore`, nur rückwärts aus dem JSON: Faktoren mit
 * `punkte: null` sind ausgeblendet und zählen nicht als belegt.
 */
export function abdeckungAusFaktoren(faktoren: unknown[] | null): number {
  let gesamt = 0;
  let belegt = 0;
  for (const f of (faktoren ?? []) as Array<{ gewicht?: unknown; punkte?: unknown }>) {
    const gewicht = typeof f?.gewicht === "number" ? f.gewicht : 0;
    gesamt += gewicht;
    if (f?.punkte !== null && f?.punkte !== undefined) belegt += gewicht;
  }
  return gesamt > 0 ? Math.round((belegt / gesamt) * 1000) / 1000 : 0;
}
