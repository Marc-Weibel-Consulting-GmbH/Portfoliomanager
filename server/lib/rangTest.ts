/**
 * Die Messung, die zur Anwendung passt: die besten N Titel halten.
 *
 * Bisher wurde zweimal am Problem vorbeigemessen. Die Gewichtssuche (#266)
 * fragte «kaufe alles über 60 gegen kaufe alles» — beides tut kein Depot. Die
 * Diagnose (#268) fragte «ordnet der Score richtig» — richtig, aber sie sagt
 * nicht, was dabei herauskommt. Ein Depot hält zwanzig bis dreissig Titel, wird
 * in Abständen umgeschichtet und zahlt für jede Umschichtung.
 *
 * Genau das steht hier: Nach Rang die besten N nehmen, den Horizont halten,
 * gegen das gleichgewichtete Universum vergleichen, und die tatsächliche
 * Wechselquote mit Kosten belasten.
 *
 * ÜBERLAPPENDE FENSTER SIND DAS KERNPROBLEM DIESER MESSUNG, und sie werden hier
 * nicht weggerechnet, sondern offen behandelt: Bei zwölf Monaten Haltedauer und
 * zehn Jahren Historie gibt es nur ZEHN unabhängige Perioden. Wer stattdessen
 * jeden Monatsstichtag auswertet, hat 121 Zahlen, aber nicht mehr Information —
 * er hat dieselben zehn Jahre zwölfmal gezählt.
 *
 * Deshalb laufen `horizont` getrennte Spuren nebeneinander, jede mit eigenem
 * Startmonat und ohne Überlappung in sich. Der Mittelwert über die Spuren ist
 * stabiler als eine einzelne, und ihre STREUUNG zeigt, wie sehr das Ergebnis
 * davon abhängt, in welchem Monat man angefangen hätte. Diese Streuung ist die
 * ehrlichste Zahl des ganzen Moduls.
 */

import type { Beobachtung } from "./signalGewichteBacktest";
import { rundlaufKostenPct } from "./backtestKennzahlen";

/** Positionen im Musterdepot. Entspricht der Grössenordnung eines Privatdepots. */
export const STANDARD_POSITIONEN = 25;

export interface SpurErgebnis {
  /** Startversatz in Monaten, 0 … horizont−1. */
  versatz: number;
  perioden: number;
  /** Ø Überschuss gegenüber dem gleichgewichteten Universum, in Prozentpunkten. */
  ueberschuss: number;
  /** Ø Anteil der Positionen, die je Umschichtung wechseln, 0–1. */
  umschlag: number;
  /**
   * Überschuss dieser Spur nach ihren eigenen Umschlagskosten.
   *
   * Die Streuung wird auf DIESER Grösse gerechnet, nicht auf dem Bruttowert:
   * Sonst hielte die Robustheitsprüfung einen Nettowert gegen die Streuung
   * einer anderen Grösse. Bei hohem Umschlag sind die Kosten der grösste und
   * zugleich der am wenigsten zufällige Teil des Ergebnisses.
   */
  ueberschussNachKosten: number;
}

export interface RangErgebnis {
  bezeichnung: string;
  positionen: number;
  horizontMonate: number;
  /** Auswertungen insgesamt (über alle Spuren). */
  perioden: number;
  /** Unabhängige Perioden je Spur — die Zahl, die zählt. */
  periodenJeSpur: number;
  /** Ø Rendite der Auswahl je Periode, brutto. */
  auswahl: number;
  /** Ø Rendite des gleichgewichteten Universums je Periode. */
  universum: number;
  /** Differenz, brutto. */
  ueberschuss: number;
  /** Ø Wechselquote je Umschichtung, 0–1. */
  umschlag: number;
  /** Überschuss abzüglich der Kosten des Umschlags. */
  ueberschussNachKosten: number;
  /** Anteil der Perioden, in denen die Auswahl vorn lag. */
  anteilVorn: number;
  /** Streuung des Überschusses über die Startmonate — die Abhängigkeit vom Zufall des Starts. */
  spurStreuung: number;
  spuren: SpurErgebnis[];
  jahre: { jahr: number; ueberschuss: number; auswahl: number; universum: number; perioden: number }[];
  hinweis: string | null;
}

/** Wie ein Titel für die Rangfolge bewertet wird. `null` = kommt nicht in Frage. */
export type Bewerter = (b: Beobachtung) => number | null;

const LEER = (bezeichnung: string, positionen: number, horizontMonate: number, hinweis: string): RangErgebnis => ({
  bezeichnung, positionen, horizontMonate,
  perioden: 0, periodenJeSpur: 0, auswahl: 0, universum: 0, ueberschuss: 0,
  umschlag: 0, ueberschussNachKosten: 0, anteilVorn: 0, spurStreuung: 0,
  spuren: [], jahre: [], hinweis,
});

interface Auswertung {
  datum: string;
  auswahl: number;
  universum: number;
  umschlag: number | null;
}

/**
 * Die besten N halten, gegen das Universum, mit echtem Umschlag.
 *
 * `beobachtungen` müssen mit demselben `horizontMonate` gebaut sein — sonst
 * wird eine Zwölfmonatsrendite als Monatsergebnis verbucht.
 */
export function rangTest(
  beobachtungen: Beobachtung[],
  bewerter: Bewerter,
  bezeichnung: string,
  positionen = STANDARD_POSITIONEN,
  horizontMonate = 1,
): RangErgebnis {
  const h = Math.max(1, horizontMonate);

  const jeDatum = new Map<string, Beobachtung[]>();
  for (const b of beobachtungen ?? []) {
    const wert = bewerter(b);
    if (wert === null || !Number.isFinite(wert)) continue;
    if (!Number.isFinite(b.vorwaertsRendite)) continue;
    if (!jeDatum.has(b.datum)) jeDatum.set(b.datum, []);
    jeDatum.get(b.datum)!.push(b);
  }

  const daten = [...jeDatum.keys()].sort()
    .filter((d) => jeDatum.get(d)!.length >= positionen * 2);
  if (daten.length < h + 1) {
    return LEER(bezeichnung, positionen, h,
      `Zu wenige Stichtage mit mindestens ${positionen * 2} Titeln (${daten.length}).`);
  }

  const spuren: SpurErgebnis[] = [];
  const alleAuswertungen: Auswertung[] = [];

  // Eine Spur je möglichem Startmonat. In sich überlappungsfrei.
  for (let versatz = 0; versatz < h; versatz++) {
    const spurDaten: string[] = [];
    for (let i = versatz; i < daten.length; i += h) spurDaten.push(daten[i]);
    if (spurDaten.length < 2) continue;

    const auswertungen: Auswertung[] = [];
    let vorige: Set<string> | null = null;

    for (const datum of spurDaten) {
      const liste = jeDatum.get(datum)!;
      const sortiert = [...liste].sort((a, b) => (bewerter(b) as number) - (bewerter(a) as number));
      const gewaehlt = sortiert.slice(0, positionen);

      const auswahl = gewaehlt.reduce((s, b) => s + b.vorwaertsRendite, 0) / gewaehlt.length;
      const universum = liste.reduce((s, b) => s + b.vorwaertsRendite, 0) / liste.length;

      const jetzt = new Set(gewaehlt.map((b) => b.ticker));
      // Wechselquote: Anteil der Positionen, die gegenüber der vorigen
      // Umschichtung neu sind. Beim ersten Mal gibt es keinen Vergleich —
      // der Aufbau des Depots ist kein Umschlag.
      const umschlag = vorige === null
        ? null
        : [...jetzt].filter((t) => !vorige!.has(t)).length / positionen;
      vorige = jetzt;

      auswertungen.push({ datum, auswahl, universum, umschlag });
    }

    const ueberschuesse = auswertungen.map((a) => a.auswahl - a.universum);
    const umschlaege = auswertungen.map((a) => a.umschlag).filter((u): u is number => u !== null);
    const spurUeberschuss = ueberschuesse.reduce((s, v) => s + v, 0) / ueberschuesse.length;
    const spurUmschlag = umschlaege.length
      ? umschlaege.reduce((s, v) => s + v, 0) / umschlaege.length : 0;
    spuren.push({
      versatz,
      perioden: auswertungen.length,
      ueberschuss: spurUeberschuss,
      umschlag: spurUmschlag,
      ueberschussNachKosten: spurUeberschuss - spurUmschlag * rundlaufKostenPct(),
    });
    alleAuswertungen.push(...auswertungen);
  }

  if (!spuren.length) return LEER(bezeichnung, positionen, h, "Keine auswertbare Spur.");

  const mittel = (xs: number[]) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : 0);
  const auswahl = mittel(alleAuswertungen.map((a) => a.auswahl));
  const universum = mittel(alleAuswertungen.map((a) => a.universum));
  const ueberschuss = auswahl - universum;
  const umschlag = mittel(spuren.map((s) => s.umschlag));

  // Auf dem NETTO-Wert, damit die Robustheitsprüfung dieselbe Grösse
  // vergleicht, die sie beurteilt.
  const spurWerte = spuren.map((s) => s.ueberschussNachKosten);
  const spurMittel = mittel(spurWerte);
  const spurStreuung = spurWerte.length > 1
    ? Math.sqrt(spurWerte.reduce((s, v) => s + (v - spurMittel) ** 2, 0) / (spurWerte.length - 1))
    : 0;

  // Nur der gewechselte Teil kostet. Wer eine Position hält, zahlt nichts.
  const kosten = umschlag * rundlaufKostenPct();

  const jahresGruppen = new Map<number, Auswertung[]>();
  for (const a of alleAuswertungen) {
    const jahr = Number(a.datum.slice(0, 4));
    if (!jahresGruppen.has(jahr)) jahresGruppen.set(jahr, []);
    jahresGruppen.get(jahr)!.push(a);
  }

  return {
    bezeichnung,
    positionen,
    horizontMonate: h,
    perioden: alleAuswertungen.length,
    periodenJeSpur: Math.round(mittel(spuren.map((s) => s.perioden))),
    auswahl,
    universum,
    ueberschuss,
    umschlag,
    ueberschussNachKosten: ueberschuss - kosten,
    anteilVorn: alleAuswertungen.filter((a) => a.auswahl > a.universum).length / alleAuswertungen.length,
    spurStreuung,
    spuren,
    jahre: [...jahresGruppen.entries()].sort((a, b) => a[0] - b[0]).map(([jahr, liste]) => ({
      jahr,
      auswahl: mittel(liste.map((a) => a.auswahl)),
      universum: mittel(liste.map((a) => a.universum)),
      ueberschuss: mittel(liste.map((a) => a.auswahl - a.universum)),
      perioden: liste.length,
    })),
    hinweis: null,
  };
}

/**
 * Ein Satz Klartext — mit der Zurückhaltung, die die Datenlage verlangt.
 *
 * Der Vorsprung wird gegen die Streuung ÜBER DIE STARTMONATE gehalten, nicht
 * gegen die Streuung über alle Perioden. Der Unterschied ist entscheidend:
 * Wenn dasselbe Verfahren je nach Startmonat zwischen +4 und −2 Punkten
 * liefert, ist ein Mittelwert von +1 keine Aussage, sondern ein Zufallsprodukt.
 */
export function rangKlartext(r: RangErgebnis): string {
  if (r.hinweis) return r.hinweis;

  const richtung = r.ueberschussNachKosten >= 0 ? "vorn" : "hinten";
  const betrag = Math.abs(r.ueberschussNachKosten).toFixed(2);

  if (r.periodenJeSpur < 5) {
    return `Nur ${r.periodenJeSpur} unabhängige Perioden je Spur — zu wenig für eine Aussage. `
      + `Die ${r.positionen} besten lagen nach Kosten um ${betrag} Punkte ${richtung}.`;
  }

  const robust = Math.abs(r.ueberschussNachKosten) > r.spurStreuung;
  if (!robust) {
    return `Die ${r.positionen} besten lagen nach Kosten um ${betrag} Punkte ${richtung} — `
      + `aber die Streuung über die Startmonate ist mit ${r.spurStreuung.toFixed(2)} Punkten grösser. `
      + `Das Ergebnis hängt davon ab, in welchem Monat man begonnen hätte, nicht vom Verfahren.`;
  }

  return `Die ${r.positionen} besten lagen nach Kosten um ${betrag} Punkte ${richtung}, `
    + `in ${Math.round(r.anteilVorn * 100)} % der Perioden vor dem Universum. `
    + `Streuung über die Startmonate ${r.spurStreuung.toFixed(2)} Punkte, `
    + `Umschlag ${Math.round(r.umschlag * 100)} % je Umschichtung.`;
}
