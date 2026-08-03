/**
 * Bonität einer Obligation aus der Qualität ihres Emittenten.
 *
 * Seit #244 werden Obligationen nicht mehr nach Aktienkriterien beurteilt —
 * richtig, aber die Beurteilung besteht seither nur aus Kupon, Momentum und
 * Schwankung. Alle drei sagen nichts darüber, ob der Schuldner zahlen kann.
 * Genau das ist bei einer Anleihe die Hauptfrage.
 *
 * Öffentliche Ratings (I-CV, S&P, Fitch) sind nicht frei abrufbar. Was die
 * Anwendung aber hat: Bei einem grossen Teil der gehaltenen Anleihen ist der
 * Emittent — oder dessen Mutter — als Aktie im eigenen Universum, mitsamt
 * gerechnetem Qualitäts-Score. Diesen Score als Bonitätsnäherung zu verwenden,
 * ist keine Ratingagentur, aber es ist eine belastbare Aussage aus eigenen
 * Daten statt gar keiner.
 *
 * WAS DAS NICHT IST: Ein Rating. Der Qualitäts-Score misst das operative
 * Geschäft, nicht die Kapitalstruktur, die Besicherung oder den Rang der
 * Anleihe. Eine nachrangige Anleihe eines guten Unternehmens ist riskanter als
 * eine erstrangige — das sieht dieser Weg nicht. Er beantwortet nur: «Wie gut
 * steht das Unternehmen dahinter da?»
 *
 * Die Zuordnung läuft über den Namen, weil Anleihen im Bestand keine
 * verwertbare Emittentenkennung tragen (der Ticker ist die ISIN).
 */

import { issuerKey } from "./issuerIdentity";

/**
 * Wörter, die den Instrumententyp bezeichnen und nicht zum Emittenten gehören.
 *
 * «NTS» = Notes, «EMTN» = Euro Medium Term Note, «Reg S» = Platzierungsregime,
 * «Guaranteed» = Garantie der Mutter. Alles Beschreibung des Papiers, nicht
 * des Schuldners.
 */
const INSTRUMENT_WOERTER = new Set([
  "nts", "notes", "note", "emtn", "mtn", "frn", "bond", "bonds", "anleihe",
  "obligation", "obligationen", "zert", "zertifikat", "ant", "akt",
  "guaranteed", "guarante", "guar", "reg", "s", "sub", "subord", "senior",
]);

/**
 * Wertschriftenname → normalisierter Emittentenschlüssel.
 *
 * «0.35% NTS Lonza Swiss Finanz AGGuaranteed» ergibt `lonza swiss finanz`.
 * Leerer String, wenn nichts übrig bleibt.
 */
export function emittentAusWertschrift(name: string | null | undefined): string {
  if (!name) return "";
  let s = String(name);

  // Kupon am Anfang: «0.35% », «3/8% ».
  s = s.replace(/^\s*\d+(?:[./]\d+)?\s*%\s*/, " ");
  // Laufzeitangaben: «2020-», «2020-2027».
  s = s.replace(/\b(?:19|20)\d{2}\s*-\s*(?:(?:19|20)\d{2})?/g, " ");
  // Zusammengeschriebene Wortgrenzen trennen: «AGGuaranteed» → «AG Guaranteed»,
  // «CHKantonalbanken» → «CH Kantonalbanken». Import-Artefakt abgeschnittener
  // Namensfelder; ohne Trennung bleibt das Instrumentenwort am Emittenten kleben.
  s = s.replace(/([A-Z]{2,})([A-Z][a-z])/g, "$1 $2");

  const ohneInstrument = s
    .split(/\s+/)
    .filter((w) => w && !INSTRUMENT_WOERTER.has(w.toLowerCase().replace(/[^a-z]/g, "")))
    .join(" ");

  return issuerKey(ohneInstrument);
}

export interface EmittentenTreffer {
  /** Ticker der Aktie, aus der die Bonitätsnäherung stammt. */
  ticker: string;
  /** Deren Qualitäts-Score, 0–100. */
  qualitaet: number;
  /** Der normalisierte Name, über den zugeordnet wurde — für die Anzeige. */
  emittent: string;
}

export interface AktieFuerZuordnung {
  ticker: string;
  /** Firmenname der Aktie. */
  name: string | null | undefined;
  /** Qualitäts-Score der Aktie; null = kein Score, dann keine Zuordnung. */
  qualitaet: number | null;
}

/** Zerlegt einen Schlüssel in Wörter. */
function woerter(key: string): string[] {
  return key.split(" ").filter(Boolean);
}

/**
 * Ordnet einer Obligation die Aktie ihres Emittenten zu.
 *
 * Die Zuordnung verlangt, dass der Aktienname am ANFANG des Emittentennamens
 * steht, und zwar wortweise. Das ist der Regelfall bei Finanzierungstöchtern:
 * «Lonza Swiss Finanz» beginnt mit «Lonza», «Holcim Helvetia Finance» mit
 * «Holcim». Die Prefixbedingung ist wichtig — ohne sie würde die
 * Holcim-Anleihe auch auf Helvetia passen, weil deren Name mittendrin steht.
 *
 * Passen mehrere Aktien, gewinnt die längste (spezifischste) Übereinstimmung.
 * Sind zwei gleich lang, wird NICHT zugeordnet: Eine falsche Bonität ist
 * schlechter als keine.
 */
export function findeEmittent(
  wertschriftName: string | null | undefined,
  aktien: AktieFuerZuordnung[],
): EmittentenTreffer | null {
  const bondKey = emittentAusWertschrift(wertschriftName);
  if (!bondKey) return null;
  const bondWoerter = woerter(bondKey);
  if (bondWoerter.length === 0) return null;

  let beste: EmittentenTreffer | null = null;
  let besteLaenge = 0;
  let mehrdeutig = false;

  for (const aktie of aktien) {
    if (aktie.qualitaet === null) continue;
    const aktieKey = issuerKey(aktie.name);
    // Sehr kurze Schlüssel liefern zu leicht zufällige Treffer.
    if (aktieKey.length < 3) continue;

    const aktieWoerter = woerter(aktieKey);
    if (aktieWoerter.length > bondWoerter.length) continue;
    const passt = aktieWoerter.every((w, i) => w === bondWoerter[i]);
    if (!passt) continue;

    if (aktieWoerter.length > besteLaenge) {
      besteLaenge = aktieWoerter.length;
      beste = { ticker: aktie.ticker, qualitaet: aktie.qualitaet, emittent: aktieKey };
      mehrdeutig = false;
    } else if (aktieWoerter.length === besteLaenge && beste && aktie.ticker !== beste.ticker) {
      mehrdeutig = true;
    }
  }

  return mehrdeutig ? null : beste;
}
