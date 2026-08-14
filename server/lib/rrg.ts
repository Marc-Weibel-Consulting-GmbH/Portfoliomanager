/**
 * Relative Rotation — Sektorstärke gegen den Gesamtmarkt.
 *
 * Zwei Grössen je Sektor, beide um 100 zentriert:
 *
 *  - RS-RATIO: relative Stärke des Sektors zum Benchmark über ~6 Monate.
 *    RS_t = Sektor ÷ Benchmark (wöchentlich); RS-Ratio = 100 × RS_t ÷
 *    Mittel(RS über 26 Wochen). Über 100 heisst: stärker als der Markt.
 *  - RS-MOMENTUM: Veränderung der RS-Ratio über ~1 Monat.
 *    RS-Momentum = 100 × RS-Ratio_t ÷ RS-Ratio_{vor 4 Wochen}. Über 100
 *    heisst: die relative Stärke nimmt zu.
 *
 * Daraus die vier Quadranten des Relative-Rotation-Bilds: führend (stark und
 * stärker werdend), nachlassend (stark, aber abnehmend), zurückliegend
 * (schwach und schwächer), aufholend (schwach, aber zunehmend).
 *
 * Bewusst eine TRANSPARENTE Näherung statt der proprietären JdK-Formeln:
 * Jede Zahl ist aus den zwei Kursreihen von Hand nachrechenbar. Die Rotation
 * fliesst NICHT ins Titel-Signal ein — sie wird angezeigt und täglich
 * aufgezeichnet (`rrg_verlauf`), damit eine Vorwärtsreihe entsteht, BEVOR
 * irgendetwas davon Gewichte bewegt (STRATEGIE_DREI_SCORES.md, Regel 1).
 */

/** Fenster der relativen Stärke: ~6 Monate in Wochen. */
export const RS_FENSTER_WOCHEN = 26;
/** Fenster des Momentums: ~1 Monat in Wochen. */
export const MOMENTUM_FENSTER_WOCHEN = 4;
/** Wie viele Wochenpunkte die Spur im Diagramm zeigt. */
export const SPUR_LAENGE = 8;

export interface KursPunkt {
  /** ISO-Datum YYYY-MM-DD. */
  date: string;
  close: number;
}

export interface RrgPunkt {
  datum: string;
  rsRatio: number;
  rsMomentum: number;
}

export type RrgQuadrant = "fuehrend" | "nachlassend" | "zurueckliegend" | "aufholend";

export function quadrant(p: { rsRatio: number; rsMomentum: number }): RrgQuadrant {
  if (p.rsRatio >= 100) return p.rsMomentum >= 100 ? "fuehrend" : "nachlassend";
  return p.rsMomentum >= 100 ? "aufholend" : "zurueckliegend";
}

export const QUADRANT_LABELS: Record<RrgQuadrant, string> = {
  fuehrend: "Führend",
  nachlassend: "Nachlassend",
  zurueckliegend: "Zurückliegend",
  aufholend: "Aufholend",
};

/**
 * Letzter Handelstag je ISO-Woche — Tagesrauschen raus, Kalender-Aligning
 * zwischen Reihen verschiedener Börsen rein.
 */
export function wochenSchluss(reihe: KursPunkt[]): KursPunkt[] {
  const jeWoche = new Map<string, KursPunkt>();
  for (const p of reihe) {
    if (!Number.isFinite(p.close) || p.close <= 0) continue;
    const schluessel = isoWoche(p.date);
    const bisher = jeWoche.get(schluessel);
    if (!bisher || p.date > bisher.date) jeWoche.set(schluessel, p);
  }
  return Array.from(jeWoche.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/** ISO-Wochenschlüssel JJJJ-Www (Wochen wechseln montags). */
function isoWoche(datum: string): string {
  const d = new Date(`${datum}T00:00:00Z`);
  // Donnerstag derselben Woche bestimmt das ISO-Jahr.
  const tag = (d.getUTCDay() + 6) % 7; // Mo=0 … So=6
  d.setUTCDate(d.getUTCDate() - tag + 3);
  const jahr = d.getUTCFullYear();
  const ersterDonnerstag = new Date(Date.UTC(jahr, 0, 4));
  const ersterTag = (ersterDonnerstag.getUTCDay() + 6) % 7;
  ersterDonnerstag.setUTCDate(ersterDonnerstag.getUTCDate() - ersterTag + 3);
  const woche = 1 + Math.round((d.getTime() - ersterDonnerstag.getTime()) / (7 * 24 * 3600 * 1000));
  return `${jahr}-W${String(woche).padStart(2, "0")}`;
}

/**
 * RRG-Punktreihe eines Sektors gegen den Benchmark.
 *
 * Beide Reihen werden auf gemeinsame Wochen ausgerichtet; Wochen, in denen
 * eine Seite fehlt, fallen weg (kein Verhältnis über eine Lücke). Zu kurze
 * Reihen ergeben eine leere Liste — lieber kein Punkt als einer aus zu
 * wenigen Wochen.
 */
export function rrgReihe(sektor: KursPunkt[], benchmark: KursPunkt[]): RrgPunkt[] {
  const sWochen = wochenSchluss(sektor);
  const bWochen = wochenSchluss(benchmark);
  const bJeWoche = new Map(bWochen.map((p) => [isoWoche(p.date), p.close]));

  const rs: Array<{ datum: string; wert: number }> = [];
  for (const p of sWochen) {
    const b = bJeWoche.get(isoWoche(p.date));
    if (b === undefined || b <= 0) continue;
    rs.push({ datum: p.date, wert: p.close / b });
  }

  const ratios: Array<{ datum: string; rsRatio: number }> = [];
  for (let i = RS_FENSTER_WOCHEN - 1; i < rs.length; i++) {
    const fenster = rs.slice(i - RS_FENSTER_WOCHEN + 1, i + 1);
    const mittel = fenster.reduce((a, b) => a + b.wert, 0) / fenster.length;
    if (mittel <= 0) continue;
    ratios.push({ datum: rs[i].datum, rsRatio: (rs[i].wert / mittel) * 100 });
  }

  const punkte: RrgPunkt[] = [];
  for (let i = MOMENTUM_FENSTER_WOCHEN; i < ratios.length; i++) {
    const vorher = ratios[i - MOMENTUM_FENSTER_WOCHEN].rsRatio;
    if (vorher <= 0) continue;
    punkte.push({
      datum: ratios[i].datum,
      rsRatio: parseFloat(ratios[i].rsRatio.toFixed(2)),
      rsMomentum: parseFloat(((ratios[i].rsRatio / vorher) * 100).toFixed(2)),
    });
  }
  return punkte;
}
