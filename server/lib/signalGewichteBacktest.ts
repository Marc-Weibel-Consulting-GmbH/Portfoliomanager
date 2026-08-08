/**
 * Schritt 3b: die Gewichte der drei Scores auf der rekonstruierten Reihe messen.
 *
 * Bisher sind die Gewichte in `DEFAULT_SIGNAL_GEWICHTE` von Hand gesetzt und im
 * Kopf jener Datei ausdrücklich als Annahme gekennzeichnet. Hier steht die
 * Rechnung, die aus der Annahme ein Messergebnis machen kann — oder zeigt, dass
 * die Daten dafür nicht reichen. Beides ist ein Ergebnis.
 *
 * DREI ENTSCHEIDUNGEN, DIE DAS ERGEBNIS PRÄGEN, ALLE BEWUSST:
 *
 *  1. **Nur Kaufsignale.** Das Depot ist «long only» — ein Privatanleger, der
 *     einen fallenden Titel richtig erkennt, verdient daran nichts, er vermeidet
 *     nur einen Verlust. Ein Verkaufssignal als Treffer zu zählen würde eine
 *     Rendite unterstellen, die es nicht gibt.
 *
 *  2. **Nach Kosten.** Jedes Signal trägt einen vollen Rundlauf (`rundlaufKostenPct`,
 *     rund 1.125 %). Bei einem Monatshorizont ist das viel — genau deshalb steht
 *     es drin: Gewichte, die nur brutto gewinnen, sind für dieses Depot wertlos.
 *
 *  3. **Der Vergleich ist «alles kaufen», nicht «nichts tun».** Eine Trefferquote
 *     von 60 % klingt gut und ist nichts wert, wenn der Markt in 60 % aller
 *     Monate steigt. `basis` misst deshalb dieselben Kennzahlen über ALLE
 *     Beobachtungen. Was zählt, ist der Abstand.
 *
 * Die Aufteilung in Trainings- und Prüfzeitraum erfolgt nach ZEIT, nicht
 * zufällig: Zufällig geteilt lernte der Optimizer aus der Zukunft desselben
 * Titels. Derselbe 80/20-Schnitt wie in `optimizerWorker` (#246).
 */

import { rechneSignal, type SignalGewichte } from "./dreiScoreSignal";
import { kennzahlen, rundlaufKostenPct, type Kennzahlen } from "./backtestKennzahlen";

/** Anteil der Stichtage, aus denen gelernt werden darf. Wie `optimizerWorker`. */
export const IN_SAMPLE_ANTEIL = 0.8;

/** Handelstage je Monatsschritt — nur für die Annualisierung der Streuung. */
export const HANDELSTAGE_JE_MONAT = 21;

/**
 * Ab diesem Score gilt ein Titel als Kaufsignal.
 *
 * 60 ist die Grenze des Bandes «Gut — kaufenswert» aus `SCORE_BAENDER`. Eine
 * eigene Schwelle für den Backtest zu wählen hiesse, etwas anderes zu messen
 * als das, was in der Oberfläche steht.
 */
export const KAUF_SCHWELLE = 60;

/**
 * So viele Kaufsignale müssen im Trainingszeitraum zusammenkommen.
 *
 * Ohne Untergrenze gewinnt der Gewichtssatz, der fünfmal feuert und zufällig
 * fünfmal richtig lag. Das ist kein Modell, das ist eine Anekdote.
 */
export const MIN_SIGNALE = 100;

/**
 * Ab hier gilt ein Ergebnis als an den Trainingszeitraum angepasst.
 *
 * Derselbe Wert wie die `overfitRatio`-Schwelle in `optimizerWorker` (#246).
 */
export const MAX_UEBERANPASSUNG = 1.3;

/**
 * Darunter ist der Prüfzeitraum auffällig freundlicher als das Training.
 *
 * Kein Ausschlussgrund, aber ein Vorbehalt: Ein Fund, der ausserhalb seines
 * Trainings doppelt so gut abschneidet, hat kaum ein besonders robustes Muster
 * gefunden — die beiden Zeiträume sind schlicht verschieden.
 */
export const MIN_UEBERANPASSUNG = 0.7;

export interface Beobachtung {
  ticker: string;
  datum: string;
  qualitaet: number | null;
  bewertung: number | null;
  timing: number | null;
  regime: string | null;
  /** Bruttorendite bis zum Ende des Horizonts, in Prozent. */
  vorwaertsRendite: number;
}

/** Eine Zeile der rekonstruierten Reihe, soweit hier gebraucht. */
export interface ReihenZeile {
  ticker: string;
  datum: string;
  qualitaet: number | null;
  bewertung: number | null;
  timing: number | null;
  regime: string | null;
  kurs: number | null;
}

/** Tage zwischen zwei `YYYY-MM-DD`. */
function tageZwischen(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/**
 * Beobachtungen mit Vorwärtsrendite aus der Reihe EINES Titels.
 *
 * `horizontMonate` Stichtage weiter. Der Abstand wird geprüft, statt blind
 * `i + h` zu nehmen: Fehlt in der Reihe ein Monat — weil der Titel damals keine
 * belegte Kennzahl hatte —, läge zwischen den beiden Zeilen mehr Zeit als
 * gedacht, und die Rendite wäre stillschweigend über einen längeren Zeitraum
 * gemessen. Solche Paare werden ausgelassen, nicht zurechtgebogen.
 */
export function beobachtungenAusReihe(
  reihe: ReihenZeile[],
  horizontMonate = 1,
): Beobachtung[] {
  const sortiert = [...(reihe ?? [])]
    .filter((z) => z && z.kurs !== null && Number.isFinite(z.kurs) && (z.kurs as number) > 0)
    .sort((a, b) => a.datum.localeCompare(b.datum));

  const h = Math.max(1, horizontMonate);
  const minTage = h * 25;
  const maxTage = h * 38;

  const aus: Beobachtung[] = [];
  for (let i = 0; i + h < sortiert.length; i++) {
    const jetzt = sortiert[i];
    const spaeter = sortiert[i + h];
    const abstand = tageZwischen(jetzt.datum, spaeter.datum);
    if (abstand < minTage || abstand > maxTage) continue;

    const k0 = jetzt.kurs as number;
    const k1 = spaeter.kurs as number;
    aus.push({
      ticker: jetzt.ticker,
      datum: jetzt.datum,
      qualitaet: jetzt.qualitaet,
      bewertung: jetzt.bewertung,
      timing: jetzt.timing,
      regime: jetzt.regime,
      vorwaertsRendite: ((k1 - k0) / k0) * 100,
    });
  }
  return aus;
}

export interface Auswertung {
  /** Kennzahlen der Kaufsignale, nach Kosten. */
  signal: Kennzahlen;
  /**
   * Dieselben Kennzahlen über ALLE Beobachtungen — «alles kaufen».
   *
   * Der einzige ehrliche Vergleichsmassstab: Ein Signal, das schlechter
   * abschneidet als der Verzicht auf jede Auswahl, ist keine Verbesserung,
   * egal wie gut seine Trefferquote aussieht.
   */
  basis: Kennzahlen;
  /** Anteil der Beobachtungen, die ein Kaufsignal auslösten. */
  signalAnteil: number;
}

/**
 * Einen Gewichtssatz auswerten.
 *
 * `regimeGewichte` statt eines einzelnen Satzes erlaubt später (3c) dieselbe
 * Funktion für regimeeigene Gewichte — dann steht je Regime eine Zeile in der
 * Tabelle statt nur `default`.
 */
export function bewerteGewichte(
  beobachtungen: Beobachtung[],
  regimeGewichte: Record<string, SignalGewichte>,
  horizontMonate = 1,
): Auswertung {
  const kosten = rundlaufKostenPct();
  const haltedauer = Math.max(1, horizontMonate) * HANDELSTAGE_JE_MONAT;

  const signalRenditen: number[] = [];
  let signalKorrekt = 0;
  const alleRenditen: number[] = [];
  let alleKorrekt = 0;

  for (const b of beobachtungen) {
    // Die Kosten fallen an, sobald gehandelt wird — auch beim Vergleichsmass
    // «alles kaufen», sonst gewänne der Vergleich durch einen Vorteil, den es
    // in der Wirklichkeit nicht gibt.
    const netto = b.vorwaertsRendite - kosten;
    alleRenditen.push(netto);
    if (netto > 0) alleKorrekt++;

    const sig = rechneSignal(
      { qualitaet: b.qualitaet, bewertung: b.bewertung, timing: b.timing, regime: b.regime },
      regimeGewichte,
    );
    if (sig.score === null || sig.score < KAUF_SCHWELLE) continue;

    signalRenditen.push(netto);
    if (netto > 0) signalKorrekt++;
  }

  return {
    signal: kennzahlen(signalRenditen, signalKorrekt, signalRenditen.length, haltedauer),
    basis: kennzahlen(alleRenditen, alleKorrekt, alleRenditen.length, haltedauer),
    signalAnteil: alleRenditen.length > 0 ? signalRenditen.length / alleRenditen.length : 0,
  };
}

/**
 * Gewichtsraster über das Dreieck q + b + t = 1.
 *
 * `schritt` von 0.05 ergibt 171 Kandidaten — genug Auflösung, um eine Richtung
 * zu erkennen, und wenig genug, dass nicht allein die Zahl der Versuche einen
 * Gewinner erzeugt. Jedes Gewicht mindestens `min`: Ein Score mit Gewicht 0
 * wäre nicht «optimiert weggelassen», sondern ein anderes Modell.
 */
export function gewichtsRaster(schritt = 0.05, min = 0.05): SignalGewichte[] {
  const aus: SignalGewichte[] = [];
  const stufen = Math.round(1 / schritt);
  const minStufen = Math.round(min / schritt);
  for (let q = minStufen; q <= stufen - 2 * minStufen; q++) {
    for (let b = minStufen; b <= stufen - q - minStufen; b++) {
      const t = stufen - q - b;
      if (t < minStufen) continue;
      aus.push({
        qualitaet: Number((q * schritt).toFixed(4)),
        bewertung: Number((b * schritt).toFixed(4)),
        timing: Number((t * schritt).toFixed(4)),
      });
    }
  }
  return aus;
}

/** Der Zeitschnitt: Stichtage aufsteigend, die ersten 80 Prozent zum Lernen. */
export function zeitSchnitt(beobachtungen: Beobachtung[]): {
  trennDatum: string | null;
  training: Beobachtung[];
  pruefung: Beobachtung[];
} {
  const daten = [...new Set(beobachtungen.map((b) => b.datum))].sort();
  if (daten.length < 2) {
    return { trennDatum: null, training: beobachtungen, pruefung: [] };
  }
  const idx = Math.max(1, Math.floor(daten.length * IN_SAMPLE_ANTEIL) - 1);
  const trennDatum = daten[idx];
  return {
    trennDatum,
    training: beobachtungen.filter((b) => b.datum <= trennDatum),
    pruefung: beobachtungen.filter((b) => b.datum > trennDatum),
  };
}

export interface Suchergebnis {
  /** Der beste Satz aus dem Trainingszeitraum. */
  gewichte: SignalGewichte;
  /** Wie er im Trainingszeitraum abschnitt. */
  training: Auswertung;
  /** Wie derselbe Satz im ungesehenen Prüfzeitraum abschneidet. */
  pruefung: Auswertung;
  /** Zum Vergleich: die heute im Betrieb verwendeten Gewichte, gleich gemessen. */
  heute: { gewichte: SignalGewichte; training: Auswertung; pruefung: Auswertung } | null;
  /**
   * Training geteilt durch Prüfung (Sharpe). Nahe 1 = übertragbar, deutlich
   * über 1 = am Trainingszeitraum angepasst. Wie `overfitRatio` in
   * `optimizerWorker`.
   */
  ueberanpassung: number;
  trennDatum: string | null;
  kandidaten: number;
  /**
   * Taugt der gefundene Satz zur Übernahme?
   *
   * Eine Rastersuche liefert IMMER einen Gewinner — auch auf reinem Rauschen.
   * Der Beleg dafür steht im Test: Auf einer Kursreihe ohne jeden Zusammenhang
   * findet dieselbe Suche denselben Satz, nur mit negativem Sharpe und
   * schlechter als «alles kaufen». Ohne dieses Feld läse sich das Ergebnis wie
   * ein Fund.
   */
  taugt: boolean;
  /** Warum kein Ergebnis vorliegt oder warum es nicht taugt. Leer, wenn alles passt. */
  hinweis: string | null;
}

/**
 * Die Prüfung, ob ein gefundener Satz mehr ist als der Gewinner einer Lotterie.
 *
 * Vier Bedingungen, alle im PRÜFZEITRAUM: genug Signale, positive Zielgrösse,
 * besser als «alles kaufen», und nicht bloss am Trainingszeitraum angepasst.
 */
function pruefeTauglichkeit(
  pruefung: Auswertung,
  ueberanpassung: number,
  trainingSharpe: number,
): { taugt: boolean; hinweis: string | null } {
  const maengel: string[] = [];
  if (pruefung.signal.n < MIN_SIGNALE) {
    maengel.push(`nur ${pruefung.signal.n} Kaufsignale im Prüfzeitraum`);
  }
  if (pruefung.signal.sharpe <= 0) {
    maengel.push(`Zielgrösse im Prüfzeitraum nicht positiv (${pruefung.signal.sharpe.toFixed(2)})`);
  }
  if (pruefung.signal.mittlereRendite <= pruefung.basis.mittlereRendite) {
    maengel.push(
      `schlechter als «alles kaufen» (${pruefung.signal.mittlereRendite.toFixed(2)} % gegen `
      + `${pruefung.basis.mittlereRendite.toFixed(2)} %)`);
  }
  // Das Verhältnis ist nur aussagekräftig, wenn beide Seiten positiv sind.
  if (trainingSharpe > 0 && pruefung.signal.sharpe > 0 && ueberanpassung > MAX_UEBERANPASSUNG) {
    maengel.push(`am Trainingszeitraum angepasst (Verhältnis ${ueberanpassung.toFixed(2)})`);
  }

  if (maengel.length) {
    return { taugt: false, hinweis: `Nicht übernehmen: ${maengel.join("; ")}.` };
  }

  /**
   * Ein Verhältnis WEIT UNTER 1 ist ebenfalls ein Warnzeichen — die Prüfung
   * hatte diese Schwelle zuerst nicht.
   *
   * Sie fragte nur, ob der Fund im Prüfzeitraum schlechter abschneidet als im
   * Training. Fällt er dort deutlich BESSER aus, heisst das nicht «besonders
   * gut», sondern: Die beiden Zeiträume sind sehr verschieden. Der Vorsprung
   * kann dann dem Fenster gehören und nicht den Gewichten. In der Praxis kam
   * genau das vor — Verhältnis 0.53 bei einem als übernehmbar gemeldeten Satz.
   *
   * Kein Ausschluss: Der Satz besteht die vier Bedingungen. Aber wer ihn
   * übernimmt, soll wissen, worauf er sich verlässt.
   */
  if (pruefung.signal.sharpe > 0
      && (trainingSharpe <= 0 || ueberanpassung < MIN_UEBERANPASSUNG)) {
    const grund = trainingSharpe <= 0
      ? `im Trainingszeitraum verlor auch der beste Kandidat (Sharpe ${trainingSharpe.toFixed(2)})`
      : `im Prüfzeitraum lief es deutlich besser als im Training `
        + `(Verhältnis ${ueberanpassung.toFixed(2)})`;
    return {
      taugt: true,
      hinweis: `Mit Vorbehalt: ${grund}. Die beiden Zeiträume sind sehr verschieden — `
        + `der Vorsprung kann am Fenster liegen und nicht an den Gewichten.`,
    };
  }

  return { taugt: true, hinweis: null };
}

/**
 * Den besten globalen Gewichtssatz suchen.
 *
 * Gesucht wird ausschliesslich im Trainingszeitraum. Der Prüfzeitraum wird
 * EINMAL angefasst, nämlich um den Gewinner zu messen — würde man ihn zur
 * Auswahl heranziehen, wäre er kein Prüfzeitraum mehr, sondern ein zweiter
 * Trainingszeitraum mit besserem Namen.
 *
 * `heuteGewichte` wird derselben Rechnung unterzogen. Ohne diesen Vergleich
 * liesse sich nicht sagen, ob der gefundene Satz besser ist oder nur anders.
 */
export function sucheGewichte(
  beobachtungen: Beobachtung[],
  heuteGewichte: SignalGewichte | null = null,
  horizontMonate = 1,
  schritt = 0.05,
): Suchergebnis {
  const { trennDatum, training, pruefung } = zeitSchnitt(beobachtungen);
  const raster = gewichtsRaster(schritt);

  // Gleichgewichtet als Platzhalter, nicht `{}`: Eine Gewichtstabelle ohne
  // `default` liesse `rechneSignal` bei der ersten Beobachtung auflaufen. Dass
  // die Schleife hier nie läuft, ist kein Schutz, sondern ein Zufall.
  const gleich: SignalGewichte = { qualitaet: 1 / 3, bewertung: 1 / 3, timing: 1 / 3 };
  const leer: Suchergebnis = {
    gewichte: gleich,
    training: bewerteGewichte([], { default: gleich }, horizontMonate),
    pruefung: bewerteGewichte([], { default: gleich }, horizontMonate),
    heute: null,
    ueberanpassung: 0,
    trennDatum,
    kandidaten: raster.length,
    taugt: false,
    hinweis: null,
  };

  if (!training.length || !pruefung.length) {
    return { ...leer, hinweis: "Zu wenige Stichtage für einen Zeitschnitt." };
  }

  let bester: { w: SignalGewichte; a: Auswertung } | null = null;
  for (const w of raster) {
    const a = bewerteGewichte(training, { default: w }, horizontMonate);
    // Die Untergrenze schützt vor Gewinnern, die kaum je feuern.
    if (a.signal.n < MIN_SIGNALE) continue;
    if (!bester || a.signal.sharpe > bester.a.signal.sharpe) bester = { w, a };
  }

  if (!bester) {
    return {
      ...leer,
      hinweis: `Kein Gewichtssatz erreicht ${MIN_SIGNALE} Kaufsignale im Trainingszeitraum `
        + `(${training.length} Beobachtungen). Die Reihe ist zu kurz oder zu dünn belegt.`,
    };
  }

  const pruefErgebnis = bewerteGewichte(pruefung, { default: bester.w }, horizontMonate);
  const heute = heuteGewichte
    ? {
        gewichte: heuteGewichte,
        training: bewerteGewichte(training, { default: heuteGewichte }, horizontMonate),
        pruefung: bewerteGewichte(pruefung, { default: heuteGewichte }, horizontMonate),
      }
    : null;

  const ueberanpassung = pruefErgebnis.signal.sharpe !== 0
    ? bester.a.signal.sharpe / pruefErgebnis.signal.sharpe
    : 0;
  const urteil = pruefeTauglichkeit(pruefErgebnis, ueberanpassung, bester.a.signal.sharpe);

  return {
    gewichte: bester.w,
    training: bester.a,
    pruefung: pruefErgebnis,
    heute,
    ueberanpassung,
    trennDatum,
    kandidaten: raster.length,
    taugt: urteil.taugt,
    hinweis: urteil.hinweis,
  };
}
