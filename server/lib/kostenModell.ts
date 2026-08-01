/**
 * Kostenmodell für die Wirkungsmessung.
 *
 * Bisher wurde die Wirkung eines Vorschlags brutto gemessen: Kursrendite gegen
 * Benchmark, ohne Courtage, Stempelabgabe, Geld-Brief-Spanne und ohne die
 * laufenden Gebühren der ETF-Bausteine. Genau diese Grössen fressen bei
 * regimegetriebenen Umschichtungen das Alpha auf — sie wegzulassen macht jede
 * Messung systematisch zu freundlich.
 *
 * WAS HIER STEHT, IST EIN MODELL, KEINE ABRECHNUNG. Die Sätze sind dokumentierte
 * Annahmen, keine Kontoauszüge: Die Anwendung kennt weder die Konditionen der
 * Depotbank noch die tatsächlich bezahlten Spannen. Deshalb wird die
 * Nettogrösse IMMER neben der Bruttogrösse ausgewiesen und nie an deren Stelle
 * — wer die Annahmen nicht teilt, kann die Bruttozahl weiterverwenden.
 *
 * Nicht modelliert:
 *  - Verrechnungssteuer (35 %): für Ansässige in der Schweiz rückforderbar,
 *    also kein Kostenblock, sondern eine Zwischenfinanzierung.
 *  - Einkommenssteuer auf Erträge: hängt am Wohnsitz und am Gesamteinkommen,
 *    nicht am Portfolio. Eine Pauschale wäre hier geraten, nicht gerechnet.
 *  - Depotgebühren: pro Depot, nicht pro Vorschlag — gehören in eine
 *    Gesamtkostenrechnung, nicht in die Wirkungsmessung eines Vorschlags.
 */

export interface Kostensaetze {
  /** Courtage in Basispunkten des Handelsvolumens, je Transaktion. */
  courtageBps: number;
  /** Mindestcourtage je Transaktion, in CHF. */
  mindestcourtageCHF: number;
  /** Eidg. Umsatzabgabe auf inländische Titel, in Basispunkten, je Seite. */
  stempelInlandBps: number;
  /** Eidg. Umsatzabgabe auf ausländische Titel, in Basispunkten, je Seite. */
  stempelAuslandBps: number;
  /** Angenommene halbe Geld-Brief-Spanne in Basispunkten. */
  halbeSpanneBps: number;
  /** Laufende Gebühr (TER) der ETF-Bausteine, in Basispunkten pro Jahr. */
  terBps: number;
}

/**
 * Voreinstellungen für ein Schweizer Privatdepot mittlerer Grösse.
 *
 * Stempelabgabe nach Bundesgesetz über die Stempelabgaben: 0.75 ‱ inländisch,
 * 1.5 ‱ ausländisch, je Seite. Courtage und Spanne sind Schätzungen einer
 * Online-Bank; TER ein Mittel über die verwendeten Sleeve-ETFs.
 */
export const STANDARD_KOSTEN: Kostensaetze = {
  courtageBps: 40,
  mindestcourtageCHF: 20,
  stempelInlandBps: 7.5,
  stempelAuslandBps: 15,
  halbeSpanneBps: 5,
  terBps: 25,
};

export interface PositionsKosten {
  /** Anteil am investierten Vermögen, in Prozent. */
  gewichtPct: number;
  /** Ist der Titel in der Schweiz kotiert? Bestimmt die Stempelabgabe. */
  inlaendisch: boolean;
  /** Ist es ein ETF/ETP mit laufender Gebühr? */
  istFonds: boolean;
}

export interface KostenErgebnis {
  /** Einmalige Kosten des Aufbaus, in Prozent des investierten Vermögens. */
  einmaligPct: number;
  /** Laufende Kosten über das Fenster, in Prozent. */
  laufendPct: number;
  /** Summe — das, was von der Bruttorendite abzuziehen ist. */
  gesamtPct: number;
}

/**
 * Kosten eines Portfolioaufbaus über ein Messfenster (rein, getestet).
 *
 * `anlagesummeCHF` wird nur für die Mindestcourtage gebraucht: Bei kleinen
 * Positionen schlägt sie stärker durch als der prozentuale Satz, und genau das
 * soll sichtbar werden — ein Vorschlag mit 30 Kleinpositionen ist teurer als
 * einer mit 12, auch wenn beide dieselben Titel enthalten.
 */
export function berechneKosten(
  positionen: PositionsKosten[],
  anlagesummeCHF: number,
  fensterTage: number,
  saetze: Kostensaetze = STANDARD_KOSTEN,
): KostenErgebnis {
  if (!positionen.length || !(anlagesummeCHF > 0)) {
    return { einmaligPct: 0, laufendPct: 0, gesamtPct: 0 };
  }

  let einmaligCHF = 0;
  let terGewichtet = 0;

  for (const p of positionen) {
    const gewicht = Math.max(0, p.gewichtPct) / 100;
    if (gewicht <= 0) continue;
    const volumenCHF = anlagesummeCHF * gewicht;

    // Courtage: prozentual, aber mindestens der Sockelbetrag.
    const courtage = Math.max(volumenCHF * (saetze.courtageBps / 10_000), saetze.mindestcourtageCHF);
    // Stempelabgabe: einmal beim Kauf.
    const stempelBps = p.inlaendisch ? saetze.stempelInlandBps : saetze.stempelAuslandBps;
    const stempel = volumenCHF * (stempelBps / 10_000);
    // Halbe Spanne — beim Kauf zahlt man den Briefkurs.
    const spanne = volumenCHF * (saetze.halbeSpanneBps / 10_000);

    einmaligCHF += courtage + stempel + spanne;
    if (p.istFonds) terGewichtet += gewicht * (saetze.terBps / 10_000);
  }

  const einmaligPct = (einmaligCHF / anlagesummeCHF) * 100;
  // TER anteilig über das Fenster, nicht für ein volles Jahr.
  const laufendPct = terGewichtet * (Math.max(0, fensterTage) / 365) * 100;

  const r2 = (v: number) => parseFloat(v.toFixed(4));
  return {
    einmaligPct: r2(einmaligPct),
    laufendPct: r2(laufendPct),
    gesamtPct: r2(einmaligPct + laufendPct),
  };
}

/**
 * Nettorendite aus Bruttorendite und Kosten.
 *
 * Beide in Prozent. Rein subtraktiv: Die Kosten fallen auf das eingesetzte
 * Kapital an, nicht auf den Ertrag.
 */
export function nettoRendite(bruttoPct: number, kosten: KostenErgebnis): number {
  return parseFloat((bruttoPct - kosten.gesamtPct).toFixed(4));
}

/**
 * Totband für Regimewechsel.
 *
 * Die Mischung springt zwischen «Seitwärts ruhig» und «Seitwärts unruhig» um
 * 10 Prozentpunkte. Ohne Totband flattert sie an der Grenze hin und her, und
 * jedes Flattern kostet — nicht im Modell, sondern im Depot.
 *
 * Deshalb: Ein Regimewechsel gilt erst, wenn das neue Regime an
 * `mindestTage` aufeinanderfolgenden Tagen erkannt wurde. Reine Funktion; der
 * Aufrufer hält die Historie.
 */
export function regimeWechselBestaetigt(
  letzteRegime: string[],
  neuesRegime: string,
  mindestTage = 3,
): boolean {
  if (!neuesRegime) return false;
  if (letzteRegime.length < mindestTage) return false;
  const jüngste = letzteRegime.slice(-mindestTage);
  return jüngste.every((r) => r === neuesRegime);
}

/** Voreinstellung: drei aufeinanderfolgende Tage bestätigen einen Wechsel. */
export const REGIME_TOTBAND_TAGE = 3;

/**
 * Wirksames Regime aus einer Folge von Tageserkennungen (ältestes zuerst).
 *
 * Läuft die Folge einmal durch und wechselt das wirksame Regime erst, wenn ein
 * neues an `mindestTage` aufeinanderfolgenden Tagen erkannt wurde. Ein
 * einzelner Ausreisser ändert damit nichts — genau das ist der Zweck.
 *
 * Braucht KEINE gespeicherte Historie: Die Tageserkennungen lassen sich aus
 * derselben Kursreihe rekonstruieren, indem man sie schrittweise kürzt. Damit
 * bleibt das Ergebnis reproduzierbar und der Aufrufer zustandsfrei.
 *
 * Ist die Folge kürzer als `mindestTage`, gibt es nichts zu glätten — dann gilt
 * die jüngste Erkennung.
 */
export function stabilesRegime(verlauf: string[], mindestTage = REGIME_TOTBAND_TAGE): string {
  const gefiltert = (verlauf ?? []).filter(Boolean);
  if (!gefiltert.length) return "";
  if (gefiltert.length < mindestTage) return gefiltert[gefiltert.length - 1];

  let wirksam = gefiltert[0];
  let kandidat = gefiltert[0];
  let inFolge = 1;

  for (let i = 1; i < gefiltert.length; i++) {
    const heute = gefiltert[i];
    if (heute === kandidat) inFolge++;
    else { kandidat = heute; inFolge = 1; }
    // Erst wenn der Kandidat lange genug durchhält, wird er wirksam.
    if (kandidat !== wirksam && inFolge >= mindestTage) wirksam = kandidat;
  }
  return wirksam;
}
