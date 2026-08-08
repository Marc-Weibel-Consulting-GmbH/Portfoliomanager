/**
 * Steckt in Qualität, Bewertung oder Timing überhaupt Auswahlinformation?
 *
 * Die Gewichtssuche (#266) hat die Frage falsch gestellt. «Kaufe, wenn der
 * Score über 60 liegt» mischt zwei Dinge: WANN gekauft wird und WAS gekauft
 * wird. Gegen «alles kaufen» verliert das fast zwangsläufig — in einem
 * Prüfzeitraum, der eine einzige Hausse ist, und in einem Universum, das nur
 * die heute noch vorhandenen Titel kennt.
 *
 * Für ein Depot mit zwanzig bis dreissig Positionen zählt aber nur die zweite
 * Frage. Und die misst man QUER JE STICHTAG: Alle Titel desselben Monats
 * nebeneinander, jede Rendite gegen den Durchschnitt dieses Monats. Damit
 * fällt der Markteffekt heraus — ein guter Monat hebt alle, das ist keine
 * Auswahlleistung — und übrig bleibt die Frage, ob der Score die Titel
 * innerhalb des Monats richtig ordnet.
 *
 * KEINE HANDELSKOSTEN in dieser Rechnung, und das ist kein Versehen: Der
 * Überschuss wird gegen den Querschnitt desselben Stichtags gemessen, und
 * beide Seiten tragen denselben Rundlauf. Er kürzt sich weg. Kosten gehören in
 * die Frage «lohnt sich der Handel», nicht in die Frage «ordnet der Score».
 *
 * Zwei Masse, weil eines allein täuscht:
 *  - die DEZILSPANNE sagt, wie gross der Unterschied ist,
 *  - der ANTEIL POSITIVER STICHTAGE sagt, wie verlässlich er ist.
 * Ein Score, der in einem einzigen Monat gewaltig recht hatte und sonst nie,
 * sieht im Durchschnitt gut aus und ist wertlos.
 */

import type { Beobachtung } from "./signalGewichteBacktest";

export type ScoreFeld = "qualitaet" | "bewertung" | "timing";

/**
 * Mindestzahl Titel je Stichtag.
 *
 * Aus fünf Titeln zehn Dezile zu bilden ergibt Dezile mit einem halben Titel.
 * Stichtage darunter werden ausgelassen — sie stehen am Anfang der Reihe, als
 * das Universum noch dünn belegt war.
 */
export const MIN_TITEL_JE_STICHTAG = 20;

export interface DezilZeile {
  /** 1 = niedrigster Score, 10 = höchster. */
  dezil: number;
  n: number;
  mittlererScore: number;
  /** Ø Rendite gegenüber dem Querschnitt DESSELBEN Stichtags, in Prozentpunkten. */
  ueberschuss: number;
  /** Anteil der Beobachtungen mit positivem Überschuss. */
  trefferquote: number;
}

export interface Diagnose {
  feld: ScoreFeld;
  dezile: DezilZeile[];
  /**
   * Ø Rangkorrelation zwischen Score und Folgerendite je Stichtag (−1..1).
   *
   * In der Literatur «Information Coefficient». Werte um 0.03–0.05 gelten für
   * einen einzelnen Faktor bereits als brauchbar; 0 heisst kein Zusammenhang.
   */
  ic: number | null;
  /** Streuung des IC über die Stichtage — die Verlässlichkeit. */
  icStreuung: number;
  /** Anteil der Stichtage mit positivem IC. 0.5 heisst Münzwurf. */
  icPositivAnteil: number;
  /** Oberstes minus unterstes Dezil, in Prozentpunkten. */
  spanne: number | null;
  stichtage: number;
  beobachtungen: number;
  /** Warum keine Aussage möglich ist — leer, wenn eine vorliegt. */
  hinweis: string | null;
}

/** Ränge mit Mittelwert bei Bindungen (1-basiert). */
function raenge(werte: number[]): number[] {
  const idx = werte.map((w, i) => ({ w, i })).sort((a, b) => a.w - b.w);
  const aus = new Array<number>(werte.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1].w === idx[i].w) j++;
    const mittel = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) aus[idx[k].i] = mittel;
    i = j + 1;
  }
  return aus;
}

/** Pearson auf Rängen = Spearman. `null`, wenn eine Seite keine Streuung hat. */
function spearman(a: number[], b: number[]): number | null {
  if (a.length !== b.length || a.length < 3) return null;
  const ra = raenge(a);
  const rb = raenge(b);
  const n = ra.length;
  const ma = ra.reduce((s, v) => s + v, 0) / n;
  const mb = rb.reduce((s, v) => s + v, 0) / n;
  let zaehler = 0, qa = 0, qb = 0;
  for (let i = 0; i < n; i++) {
    const da = ra[i] - ma;
    const db = rb[i] - mb;
    zaehler += da * db;
    qa += da * da;
    qb += db * db;
  }
  if (qa === 0 || qb === 0) return null;
  return zaehler / Math.sqrt(qa * qb);
}

/** Beobachtungen nach Stichtag bündeln, nur die mit belegtem Score. */
function jeStichtag(beobachtungen: Beobachtung[], feld: ScoreFeld): Map<string, Beobachtung[]> {
  const aus = new Map<string, Beobachtung[]>();
  for (const b of beobachtungen ?? []) {
    const wert = b?.[feld];
    if (wert === null || wert === undefined || !Number.isFinite(wert)) continue;
    if (!Number.isFinite(b.vorwaertsRendite)) continue;
    if (!aus.has(b.datum)) aus.set(b.datum, []);
    aus.get(b.datum)!.push(b);
  }
  return aus;
}

/**
 * Die Diagnose eines Scores.
 *
 * `dezilZahl` bewusst als Parameter: Bei einem Universum von rund 200 Titeln
 * je Stichtag sind Dezile mit je 20 Titeln sinnvoll; für eine gröbere Sicht
 * taugen auch Quintile.
 */
export function diagnostiziere(
  beobachtungen: Beobachtung[],
  feld: ScoreFeld,
  dezilZahl = 10,
): Diagnose {
  const gruppen = [...jeStichtag(beobachtungen, feld).entries()]
    .filter(([, liste]) => liste.length >= MIN_TITEL_JE_STICHTAG)
    .sort((a, b) => a[0].localeCompare(b[0]));

  const leer: Diagnose = {
    feld, dezile: [], ic: null, icStreuung: 0, icPositivAnteil: 0,
    spanne: null, stichtage: 0, beobachtungen: 0, hinweis: null,
  };

  if (!gruppen.length) {
    return { ...leer, hinweis: `Kein Stichtag mit mindestens ${MIN_TITEL_JE_STICHTAG} belegten Titeln.` };
  }

  // Sammelbecken je Dezil. Der Überschuss wird IMMER gegen den Querschnitt
  // desselben Stichtags gerechnet — sonst mässe man, welche Monate gut waren.
  const eimer = Array.from({ length: dezilZahl }, () => ({
    scores: [] as number[], ueberschuesse: [] as number[],
  }));
  const ics: number[] = [];
  let beobachtungenGesamt = 0;

  for (const [, liste] of gruppen) {
    const renditen = liste.map((b) => b.vorwaertsRendite);
    const querschnitt = renditen.reduce((s, v) => s + v, 0) / renditen.length;

    const ic = spearman(liste.map((b) => b[feld] as number), renditen);
    if (ic !== null) ics.push(ic);

    // Nach Score aufsteigend, dann in gleich grosse Bänder schneiden.
    const sortiert = [...liste].sort((a, b) => (a[feld] as number) - (b[feld] as number));
    for (let i = 0; i < sortiert.length; i++) {
      const dezil = Math.min(dezilZahl - 1, Math.floor((i * dezilZahl) / sortiert.length));
      eimer[dezil].scores.push(sortiert[i][feld] as number);
      eimer[dezil].ueberschuesse.push(sortiert[i].vorwaertsRendite - querschnitt);
    }
    beobachtungenGesamt += liste.length;
  }

  const dezile: DezilZeile[] = eimer.map((e, i) => {
    const n = e.ueberschuesse.length;
    const mittel = n ? e.ueberschuesse.reduce((s, v) => s + v, 0) / n : 0;
    const treffer = n ? e.ueberschuesse.filter((v) => v > 0).length / n : 0;
    return {
      dezil: i + 1,
      n,
      mittlererScore: e.scores.length
        ? e.scores.reduce((s, v) => s + v, 0) / e.scores.length : 0,
      ueberschuss: mittel,
      trefferquote: treffer,
    };
  });

  const icMittel = ics.length ? ics.reduce((s, v) => s + v, 0) / ics.length : null;
  const icStreuung = ics.length > 1
    ? Math.sqrt(ics.reduce((s, v) => s + (v - (icMittel as number)) ** 2, 0) / (ics.length - 1))
    : 0;

  const oben = dezile[dezile.length - 1];
  const unten = dezile[0];

  return {
    feld,
    dezile,
    ic: icMittel,
    icStreuung,
    icPositivAnteil: ics.length ? ics.filter((v) => v > 0).length / ics.length : 0,
    spanne: oben && unten && oben.n && unten.n ? oben.ueberschuss - unten.ueberschuss : null,
    stichtage: gruppen.length,
    beobachtungen: beobachtungenGesamt,
    hinweis: null,
  };
}

export interface JahresZeile {
  jahr: number;
  ic: number | null;
  spanne: number | null;
  /** Ø Rendite ALLER Titel des Jahres — zeigt, wie aussergewöhnlich es war. */
  basis: number;
  stichtage: number;
  beobachtungen: number;
}

/**
 * Dieselbe Diagnose, aufgeteilt nach Jahren.
 *
 * Der entscheidende Zusatz: Ein Score, der 2016–2020 funktionierte und seither
 * nicht mehr, sieht über die ganze Reihe gemittelt aus wie einer, der nie
 * funktionierte — und umgekehrt. Ein einzelner Durchschnitt über zehn Jahre
 * kann beides verbergen.
 */
export function jeJahr(beobachtungen: Beobachtung[], feld: ScoreFeld): JahresZeile[] {
  const jahre = new Map<number, Beobachtung[]>();
  for (const b of beobachtungen ?? []) {
    const jahr = Number(b.datum.slice(0, 4));
    if (!Number.isFinite(jahr)) continue;
    if (!jahre.has(jahr)) jahre.set(jahr, []);
    jahre.get(jahr)!.push(b);
  }

  return [...jahre.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([jahr, liste]) => {
      const d = diagnostiziere(liste, feld);
      const renditen = liste.map((b) => b.vorwaertsRendite).filter(Number.isFinite);
      return {
        jahr,
        ic: d.ic,
        spanne: d.spanne,
        basis: renditen.length ? renditen.reduce((s, v) => s + v, 0) / renditen.length : 0,
        stichtage: d.stichtage,
        beobachtungen: d.beobachtungen,
      };
    });
}

/**
 * Ein Satz Klartext zum Ergebnis.
 *
 * Die Schwellen sind bewusst streng. Ein IC von 0.02 ist statistisch vielleicht
 * von null verschieden und praktisch trotzdem nichts, worauf man ein Depot
 * baut — schon gar nicht nach Handelskosten von über einem Prozent je Rundlauf.
 */
export function klartext(d: Diagnose): string {
  if (d.hinweis) return d.hinweis;
  if (d.ic === null) return "Keine Rangkorrelation berechenbar.";

  const richtung = d.ic > 0 ? "höhere" : "niedrigere";
  const bestaendig = d.icPositivAnteil >= 0.55 || d.icPositivAnteil <= 0.45;

  if (Math.abs(d.ic) < 0.02) {
    return `Kein erkennbarer Zusammenhang (IC ${d.ic.toFixed(3)}, `
      + `${Math.round(d.icPositivAnteil * 100)} % der Stichtage positiv). `
      + `Der Score ordnet die Titel innerhalb eines Monats nicht besser als der Zufall.`;
  }
  if (!bestaendig) {
    return `Im Mittel ein Zusammenhang (IC ${d.ic.toFixed(3)}), aber unbeständig — `
      + `nur ${Math.round(d.icPositivAnteil * 100)} % der Stichtage zeigen dieselbe Richtung. `
      + `Das ist eher ein paar starke Monate als eine tragfähige Regel.`;
  }
  return `${richtung} Werte gingen mit besseren Folgerenditen einher `
    + `(IC ${d.ic.toFixed(3)}, ${Math.round(d.icPositivAnteil * 100)} % der Stichtage in dieser Richtung, `
    + `Dezilspanne ${d.spanne !== null ? d.spanne.toFixed(1) : "—"} Punkte).`;
}
