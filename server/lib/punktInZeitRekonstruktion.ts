/**
 * Rekonstruiert die Score-Reihe je Titel über die Vergangenheit.
 *
 * Holt je Titel EINMAL die Fundamentaldaten und die Kurshistorie und schneidet
 * beides für jeden Monatsstichtag auf den damaligen Stand zurück. Die Scores
 * entstehen danach mit denselben Funktionen, die live laufen — `berechneQualitaet`
 * und `berechneBewertung`. Nur die Eingangsdaten sind die von damals.
 *
 * Der Lauf dauert lange (ein EODHD-Abruf je Titel plus Kurse) und ist deshalb
 * als Hintergrundlauf mit Fortschrittsmeldung gebaut, nicht als Anfrage.
 */

import { beschneideFundamentals, monatsStichtage, MELDEFRIST_TAGE } from "./punktInZeit";
import { kennzahlenPerStichtag } from "./punktInZeitKennzahlen";
import { berechneQualitaet, berechneBewertung } from "./dreiScores";
import { haltefestHistorie, type HistorienSatz } from "./punktInZeitStore";

/** Pause vor jedem Titel, in Millisekunden. */
const PAUSE_JE_TITEL_MS = 150;
/** Nach so vielen Titeln eine längere Pause (zwei Anfragen je Titel). */
const TITEL_JE_BLOCK = 10;
/** Länge dieser Pause. */
const PAUSE_JE_BLOCK_MS = 2000;

export interface RekonstruktionsErgebnis {
  titel: number;
  zeilen: number;
  uebersprungen: string[];
  meldungen: string[];
  /** Titel, die bereits eine Reihe hatten und nicht erneut geholt wurden. */
  bereitsVorhanden: number;
  /** Noch offen nach diesem Lauf — grösser 0, wenn das Häppchen voll war. */
  nochOffen: number;
  /** Zuletzt begonnener Titel. Stirbt der Prozess, steht hier die Spur. */
  zuletzt: string | null;
  /** Titel, die geprüft wurden und keine Reihe liefern können (ETF, Fonds, …). */
  ohneReihe: string[];
}

/** Kurs am oder unmittelbar vor einem Stichtag. */
export function kursAm(
  reihe: { date: string; close: number }[],
  stichtag: string,
): number | null {
  // Rückwärts suchen: An einem Monatsletzten, der auf ein Wochenende fällt,
  // gilt der letzte Handelstag davor. Ein Kurs von NACH dem Stichtag wäre
  // Rückschau — deshalb ausschliesslich rückwärts.
  for (let i = reihe.length - 1; i >= 0; i--) {
    if (reihe[i].date <= stichtag && reihe[i].close > 0) return reihe[i].close;
  }
  return null;
}

/**
 * Eine Titelreihe rekonstruieren (rein, ohne Netz und ohne Datenbank).
 *
 * Getrennt vom Abruf, damit sie ohne EODHD-Zugang prüfbar ist.
 */
export function reiheFuerTitel(
  ticker: string,
  fundamentals: any,
  kurse: { date: string; close: number }[],
  stichtage: string[],
  sektor: string | null = null,
  meldefristTage: number = MELDEFRIST_TAGE,
): HistorienSatz[] {
  const saetze: HistorienSatz[] = [];
  for (const datum of stichtage) {
    const beschnitten = beschneideFundamentals(fundamentals, datum, meldefristTage);
    const kurs = kursAm(kurse, datum);
    const k = kennzahlenPerStichtag({ beschnitten, kurs, sektor });

    // Ohne jede Kennzahl entstünde eine Zeile, die nichts aussagt — die
    // Reihe soll Lücken zeigen, nicht sie mit Nullen füllen.
    if (k.belegt === 0) continue;

    const q = berechneQualitaet(k.qualitaet, k.piotroski);
    const b = berechneBewertung(k.bewertung);
    saetze.push({
      ticker,
      datum,
      qualitaet: q.gesamt,
      bewertung: b.score,
      fScore: k.piotroski.score,
      fScoreBerechenbar: k.piotroski.berechenbar,
      kurs,
      belegt: k.belegt,
      meldefristTage,
    });
  }
  return saetze;
}

/**
 * Vollständiger Lauf über das Universum.
 *
 * `holeFundamentals` und `holeKurse` werden übergeben, damit der Lauf ohne
 * Netzzugriff getestet werden kann und der Abrufweg an einer Stelle steht.
 */
export async function rekonstruiere(
  tickers: { ticker: string; sektor: string | null; kategorie?: string | null; name?: string | null }[],
  von: string,
  bis: string,
  holeFundamentals: (ticker: string) => Promise<any | null>,
  holeKurse: (ticker: string) => Promise<{ date: string; close: number }[]>,
  melde: (text: string) => void = () => {},
  meldefristTage: number = MELDEFRIST_TAGE,
  /**
   * Titel, die bereits eine Reihe haben und übersprungen werden dürfen.
   *
   * Damit setzt ein erneuter Start dort fort, wo der abgebrochene Lauf stand,
   * statt alles noch einmal von EODHD zu holen.
   */
  bereitsErfasst: Set<string> = new Set(),
  /**
   * Höchstens so viele Titel je Lauf.
   *
   * Ein Lauf über 128 Titel dauert Minuten und stirbt in dieser Umgebung
   * reproduzierbar, bevor er fertig wird — ohne dass der Grund von aussen
   * erkennbar wäre. Ein Häppchen von 25 Titeln ist in unter zwei Minuten
   * durch und hinterlässt sein Ergebnis in der Datenbank. Mehrere Läufe
   * hintereinander kommen damit ans Ziel, wo ein langer scheitert.
   */
  maxTitel: number = 25,
): Promise<RekonstruktionsErgebnis> {
  const stichtage = monatsStichtage(von, bis);
  const alleOffen = tickers.filter((t) => !bereitsErfasst.has(t.ticker));
  const offen = alleOffen.slice(0, Math.max(1, maxTitel));
  melde(`${tickers.length} Titel, ${stichtage.length} Stichtage (${von} bis ${bis}).`
    + (bereitsErfasst.size ? ` ${tickers.length - alleOffen.length} erledigt, ${alleOffen.length} offen.` : "")
    + (alleOffen.length > offen.length ? ` Dieser Lauf nimmt ${offen.length}.` : ""));

  let zeilen = 0;
  let zuletzt: string | null = null;
  // Titel, die nachweislich keine Reihe liefern koennen. Der Aufrufer merkt
  // sie sich, damit sie nicht bei jedem Lauf erneut vorn in der Schlange
  // stehen — genau daran drehte sich der Lauf zuvor im Kreis.
  const ohneReihe: string[] = [];
  const uebersprungen: string[] = [];
  const meldungen: string[] = [];

  for (let i = 0; i < offen.length; i++) {
    const { ticker, sektor } = offen[i];
    zuletzt = ticker;

    // Drosselung wie im Optimizer: EODHD verträgt rund 20 Anfragen am Stück.
    // Je Titel gehen ZWEI raus (Fundamentaldaten und Kurse), deshalb die halbe
    // Blockgrösse. Ohne diese Pausen läuft jede Anfrage in den Timeout statt
    // eine Antwort zu bekommen — der Lauf dauert dann Stunden und liefert
    // fast nur übersprungene Titel.
    await new Promise((r) => setTimeout(r, PAUSE_JE_TITEL_MS));
    if (i > 0 && i % TITEL_JE_BLOCK === 0) {
      await new Promise((r) => setTimeout(r, PAUSE_JE_BLOCK_MS));
    }

    try {
      const fundamentals = await holeFundamentals(ticker);
      if (!fundamentals) { uebersprungen.push(`${ticker} (keine Fundamentaldaten)`); continue; }
      const kurse = await holeKurse(ticker);
      if (!kurse.length) { uebersprungen.push(`${ticker} (keine Kurse)`); continue; }

      const saetze = reiheFuerTitel(ticker, fundamentals, kurse, stichtage, sektor, meldefristTage);
      if (!saetze.length) {
        uebersprungen.push(`${ticker} (keine belegte Zeile)`);
        ohneReihe.push(ticker);
        continue;
      }

      zeilen += await haltefestHistorie(saetze);
    } catch (e) {
      uebersprungen.push(`${ticker} (${(e as Error).message})`);
    } finally {
      // `finally`, nicht danach: Die `continue`-Zweige oben springen sonst an
      // der Meldung vorbei — ausgerechnet bei den übersprungenen Titeln, über
      // die berichtet werden soll. Ein Lauf, der reihenweise scheitert, blieb
      // damit vollständig stumm.
      //
      // Und die Zahl der Übersprungenen gehört IN die laufende Meldung, nicht
      // erst ans Ende: Sonst sieht ein scheiternder Lauf zwei Stunden lang aus
      // wie einer, der arbeitet.
      if ((i + 1) % 5 === 0 || i === offen.length - 1) {
        melde(`Fortschritt: ${i + 1}/${offen.length} Titel, ${zeilen} Zeilen, ` +
              `${uebersprungen.length} übersprungen.`);
      }
    }
  }

  if (uebersprungen.length) {
    // Ausdrücklich melden, was fehlt: Eine Rekonstruktion, die stillschweigend
    // ein Drittel des Universums auslässt, sieht vollständig aus und ist es nicht.
    meldungen.push(`${uebersprungen.length} Titel ohne Reihe: ${uebersprungen.slice(0, 20).join(", ")}` +
      (uebersprungen.length > 20 ? " …" : ""));
  }
  const bereitsVorhanden = tickers.length - alleOffen.length;
  const nochOffen = alleOffen.length - offen.length;
  melde(`Fertig: ${zeilen} Zeilen aus ${offen.length - uebersprungen.length} neu geholten Titeln.`
    + (nochOffen > 0 ? ` NOCH ${nochOffen} OFFEN — erneut starten.` : " Alle Titel erfasst."));

  return {
    titel: offen.length - uebersprungen.length,
    zeilen, uebersprungen, meldungen, bereitsVorhanden, nochOffen, zuletzt,
    ohneReihe,
  };
}
