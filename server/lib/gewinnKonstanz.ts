/**
 * Gewinn-Konstanz und Verlust-Ratio — beschreibende Kennzahlen über rollierende
 * Halteperioden, gerechnet auf Monatsschlusskursen (dividendenbereinigt, also
 * Gesamtrendite).
 *
 * Idee (angelehnt an die «Performance-Analyse» von boerse.de, aber transparent
 * nachgebaut): Statt EINER Punkt-zu-Punkt-Rendite werden ALLE Kauf/Verkauf-
 * Paare der letzten zehn Jahre durchgespielt — bei 120 Monatskursen sind das
 * 120·119/2 = 7140 Szenarien. Daraus:
 *
 *  - GEWINN-KONSTANZ: Anteil der Szenarien mit Gewinn. «Wie oft hätte man mit
 *    diesem Titel Geld verdient, egal wann man ein- und ausstieg?»
 *  - VERLUST-RATIO: Verlustwahrscheinlichkeit × zeitgewichteter mittlerer
 *    Verlust (in %). Asymmetrisches Risikomass: Nur Verluste zählen als
 *    Risiko, Aufwärtsschwankung nicht (dieselbe Kritik an der Standard-
 *    abweichung, aus der wir Sharpe/Sortino aus dem Titel-Score halten).
 *
 * Zeitgewichtet heisst: Jeder Verlust wird mit der Länge seiner Halteperiode
 * gewichtet. Ein −5 % über fünf Jahre wiegt mehr Haltezeit als ein −5 % über
 * zwei Monate — und kurze Ausreisser dominieren den Schnitt nicht, wie es
 * beim Annualisieren kurzer Perioden passieren würde.
 *
 * Bewusst REIN BESCHREIBEND: fliesst weder in Scores noch ins Signal ein
 * (STRATEGIE_DREI_SCORES.md, Regel 1 — erst Vorwärtsbeleg, dann Gewichte).
 * Anders als das Vorbild rechnen wir auf adjusted_close, also inklusive
 * Dividenden — sonst würden Ausschütter systematisch unterschätzt.
 */

/** Fenster: 10 Jahre in Monaten (ergibt die 7140 Szenarien des Vorbilds). */
export const MAX_MONATE = 120;
/** Unter 3 Jahren Historie sagt die Szenarien-Statistik nichts Belastbares. */
export const MIN_MONATE = 36;

export interface MonatsPunkt {
  /** ISO-Datum YYYY-MM-DD (beliebiger Tag — je Kalendermonat zählt der letzte). */
  date: string;
  close: number;
}

export interface HalteperiodenErgebnis {
  /** Anteil der Szenarien mit Gewinn, in % (0–100). */
  gewinnKonstanz: number | null;
  /** Anteil der Szenarien mit Verlust, in % (0–100). */
  verlustWahrscheinlichkeit: number | null;
  /** Zeitgewichteter mittlerer Verlust der Verlust-Szenarien, in % (positiv). */
  mittlererVerlust: number | null;
  /** Verlustwahrscheinlichkeit × mittlerer Verlust, in %. Tiefer ist besser. */
  verlustRatio: number | null;
  /** Anzahl durchgespielter Kauf/Verkauf-Paare. */
  szenarien: number;
  /** Verwendete Monatskurse (nach Fenster-Kappung). */
  monate: number;
  von: string | null;
  bis: string | null;
  /** Datenbasis in Worten — nachvollziehbar statt nackter Zahl. */
  hinweis: string;
}

export function halteperiodenKennzahlen(reihe: MonatsPunkt[]): HalteperiodenErgebnis {
  // Je Kalendermonat der letzte gültige Kurs; Monatsindex = Jahr·12 + Monat,
  // damit Haltefristen auch über Datenlücken hinweg in echten Monaten zählen.
  const jeMonat = new Map<number, MonatsPunkt>();
  for (const p of reihe) {
    if (!Number.isFinite(p.close) || p.close <= 0) continue;
    const jahr = parseInt(p.date.slice(0, 4), 10);
    const monat = parseInt(p.date.slice(5, 7), 10);
    if (!Number.isFinite(jahr) || !Number.isFinite(monat) || monat < 1 || monat > 12) continue;
    const idx = jahr * 12 + (monat - 1);
    const bisher = jeMonat.get(idx);
    if (!bisher || p.date > bisher.date) jeMonat.set(idx, p);
  }
  const punkte = Array.from(jeMonat.entries())
    .sort((a, b) => a[0] - b[0])
    .slice(-MAX_MONATE);

  if (punkte.length < MIN_MONATE) {
    return {
      gewinnKonstanz: null,
      verlustWahrscheinlichkeit: null,
      mittlererVerlust: null,
      verlustRatio: null,
      szenarien: 0,
      monate: punkte.length,
      von: null,
      bis: null,
      hinweis: `zu wenig Kurshistorie (${punkte.length} Monatskurse, benötigt ${MIN_MONATE})`,
    };
  }

  let szenarien = 0;
  let gewinne = 0;
  let verluste = 0;
  let verlustMalZeit = 0; // Σ |Verlust| · Haltemonate
  let verlustZeit = 0; // Σ Haltemonate der Verlust-Szenarien

  for (let i = 0; i < punkte.length; i++) {
    for (let j = i + 1; j < punkte.length; j++) {
      const rendite = punkte[j][1].close / punkte[i][1].close - 1;
      const haltemonate = punkte[j][0] - punkte[i][0];
      szenarien++;
      if (rendite > 0) {
        gewinne++;
      } else if (rendite < 0) {
        verluste++;
        verlustMalZeit += -rendite * haltemonate;
        verlustZeit += haltemonate;
      }
    }
  }

  const mittlererVerlust = verluste > 0 ? (verlustMalZeit / verlustZeit) * 100 : 0;
  const verlustWahrscheinlichkeit = (verluste / szenarien) * 100;
  const von = punkte[0][1].date;
  const bis = punkte[punkte.length - 1][1].date;

  const rund = (v: number, stellen: number) => parseFloat(v.toFixed(stellen));
  return {
    gewinnKonstanz: rund((gewinne / szenarien) * 100, 1),
    verlustWahrscheinlichkeit: rund(verlustWahrscheinlichkeit, 1),
    mittlererVerlust: rund(mittlererVerlust, 2),
    verlustRatio: rund((verluste / szenarien) * mittlererVerlust, 2),
    szenarien,
    monate: punkte.length,
    von,
    bis,
    hinweis: `${szenarien} Kauf/Verkauf-Szenarien aus ${punkte.length} Monatskursen (${von.slice(0, 7)} bis ${bis.slice(0, 7)}), Gesamtrendite inkl. Dividenden`,
  };
}
