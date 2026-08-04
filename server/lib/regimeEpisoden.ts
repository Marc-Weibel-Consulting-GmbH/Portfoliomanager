/**
 * Wie viele UNABHÄNGIGE Beobachtungen trägt ein Marktregime?
 *
 * Diese Frage entscheidet, ob sich je Regime eigene Score-Gewichte bestimmen
 * lassen — und die Antwort ist fast immer ernüchternder, als die Zahl der Tage
 * vermuten lässt.
 *
 * Ein Bullenmarkt über 200 Handelstage ist nicht 200 Beobachtungen, sondern
 * EINE Episode. Innerhalb davon liefert ein Entscheidungshorizont von
 * 20 Tagen zehn nicht überlappende Fenster — und selbst die sind untereinander
 * verwandt, weil sie dieselbe Marktphase abbilden.
 *
 * Wer drei Gewichte auf zehn Beobachtungen anpasst, fittet Rauschen. Deshalb
 * zählt dieses Modul beides und macht es sichtbar, statt es zu verschweigen:
 * Episoden (wie oft kam das Regime überhaupt vor) und Fenster (wie viele
 * unabhängige Messpunkte liegen darin).
 */

export interface RegimeTag {
  /** `YYYY-MM-DD`. */
  datum: string;
  regime: string;
}

export interface RegimeUmfang {
  regime: string;
  /** Handelstage in diesem Regime — die schmeichelhafte Zahl. */
  tage: number;
  /** Zusammenhängende Vorkommen — die ehrliche Zahl. */
  episoden: number;
  /** Nicht überlappende Vorwärtsfenster innerhalb aller Episoden. */
  fenster: number;
  /** Längste Episode in Handelstagen. */
  laengsteEpisode: number;
  /** Reicht die Grundlage für eigene Gewichte? */
  tragfaehig: boolean;
}

/**
 * Mindestanforderungen für regimeeigene Gewichte.
 *
 * Drei Episoden, weil zwei keine Streuung erkennen lassen: Waren beide gut,
 * weiss man nicht, ob das am Regime lag oder an den zwei Gelegenheiten. Und
 * acht Fenster, weil darunter jede Kennzahl von einem einzelnen Monat
 * dominiert wird.
 *
 * Die Zahlen sind bewusst niedrig angesetzt — sie sind eine UNTERGRENZE, kein
 * Gütesiegel. Ein Regime, das sie gerade erreicht, verdient eine stark
 * gedämpfte Abweichung, keine eigenen freien Gewichte.
 */
export const MIN_EPISODEN = 3;
export const MIN_FENSTER = 8;

/** Voreinstellung des Entscheidungshorizonts in Handelstagen. */
export const HORIZONT_TAGE = 20;

/**
 * Umfang je Regime aus einer nach Datum sortierten Tagesreihe.
 *
 * Erwartet Handelstage, keine Kalendertage — Lücken über Wochenenden brechen
 * eine Episode also nicht auf. Eine Episode endet, wenn sich das Regime
 * ändert, nicht wenn ein Tag fehlt.
 */
export function regimeUmfang(
  verlauf: RegimeTag[],
  horizontTage: number = HORIZONT_TAGE,
): RegimeUmfang[] {
  const sortiert = [...(verlauf ?? [])]
    .filter((t) => t && t.regime && t.datum)
    .sort((a, b) => a.datum.localeCompare(b.datum));
  if (!sortiert.length) return [];

  // Episoden aufsammeln: Länge jedes zusammenhängenden Laufs je Regime.
  const laeufe = new Map<string, number[]>();
  let aktuell = sortiert[0].regime;
  let laenge = 1;
  for (let i = 1; i < sortiert.length; i++) {
    if (sortiert[i].regime === aktuell) {
      laenge++;
    } else {
      if (!laeufe.has(aktuell)) laeufe.set(aktuell, []);
      laeufe.get(aktuell)!.push(laenge);
      aktuell = sortiert[i].regime;
      laenge = 1;
    }
  }
  if (!laeufe.has(aktuell)) laeufe.set(aktuell, []);
  laeufe.get(aktuell)!.push(laenge);

  const aus: RegimeUmfang[] = [];
  for (const [regime, laengen] of laeufe) {
    const tage = laengen.reduce((a, b) => a + b, 0);
    // Fenster je Episode einzeln, nicht über die Summe: Zwei Episoden à
    // 15 Tage ergeben bei 20 Tagen Horizont KEIN Fenster, obwohl 30 Tage
    // zusammenkommen. Über die Summe zu rechnen wäre genau die Schönfärberei,
    // die dieses Modul verhindern soll.
    const fenster = laengen.reduce((s, l) => s + Math.floor(l / horizontTage), 0);
    const episoden = laengen.length;
    aus.push({
      regime,
      tage,
      episoden,
      fenster,
      laengsteEpisode: Math.max(...laengen),
      tragfaehig: episoden >= MIN_EPISODEN && fenster >= MIN_FENSTER,
    });
  }

  return aus.sort((a, b) => b.tage - a.tage);
}

/**
 * Klartext für die Admin-Anzeige.
 *
 * Der Satz nennt die Zahl, die zählt, und sagt, was daraus folgt — ohne dass
 * jemand die Schwellen im Kopf haben muss.
 */
export function umfangKlartext(u: RegimeUmfang): string {
  if (u.tragfaehig) {
    return `${u.episoden} Episoden, ${u.fenster} unabhängige Fenster — reicht für eine gedämpfte eigene Gewichtung.`;
  }
  if (u.episoden < MIN_EPISODEN) {
    return `nur ${u.episoden} ${u.episoden === 1 ? "Episode" : "Episoden"} — zu selten vorgekommen, erbt die globalen Gewichte.`;
  }
  return `${u.episoden} Episoden, aber nur ${u.fenster} unabhängige Fenster — zu kurze Phasen, erbt die globalen Gewichte.`;
}
