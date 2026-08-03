/**
 * Zielgrössen der Lernschleife.
 *
 * Bisher wurde der Optimizer allein auf die Trefferquote getunt: «Wie oft zeigt
 * das Signal in die richtige Richtung?» Das ist die falsche Frage. Eine
 * Strategie mit 60 % Treffern kann Geld verlieren, wenn die 40 % Fehltreffer
 * grösser ausfallen als die Gewinne — und sie verliert erst recht, wenn jeder
 * Rundlauf Courtage, Stempelabgabe und die halbe Geld-Brief-Spanne kostet.
 *
 * Deshalb rechnet die Schleife jetzt mit den realisierten, richtungsbereinigten
 * Vorwärtsrenditen NACH Kosten und misst sie als Verhältnis von Ertrag zu
 * Streuung. Die Trefferquote bleibt erhalten — aber als Berichtsgrösse, nicht
 * mehr als Zielgrösse.
 *
 * ACHTUNG BEIM VERGLEICH MIT ÄLTEREN LÄUFEN: Die hier berechneten Zahlen sind
 * nicht dieselbe Grösse wie die zuvor gespeicherten Trefferquoten. Läufe vor
 * dieser Umstellung sind mit späteren nur über `hitRate` vergleichbar.
 */

import { STANDARD_KOSTEN, type Kostensaetze } from "./kostenModell";

/** Handelstage pro Jahr — für die Annualisierung der Streuungsgrösse. */
export const HANDELSTAGE_PRO_JAHR = 252;

/**
 * Kosten eines vollständigen Rundlaufs (Kauf + Verkauf), in Prozent.
 *
 * Je Seite: Courtage + halbe Geld-Brief-Spanne + Stempelabgabe. Für die
 * Stempelabgabe wird das Mittel aus inländischem und ausländischem Satz
 * genommen — das Backtest-Universum enthält beides, und die Herkunft eines
 * einzelnen Titels ist an dieser Stelle nicht bekannt.
 *
 * NICHT enthalten ist die Mindestcourtage: Sie hängt an der Positionsgrösse,
 * und der Backtest kennt keine. Die tatsächlichen Kosten kleiner Positionen
 * liegen also ÜBER diesem Wert, nie darunter.
 */
export function rundlaufKostenPct(saetze: Kostensaetze = STANDARD_KOSTEN): number {
  const stempelMittelBps = (saetze.stempelInlandBps + saetze.stempelAuslandBps) / 2;
  const jeSeiteBps = saetze.courtageBps + saetze.halbeSpanneBps + stempelMittelBps;
  return (2 * jeSeiteBps) / 100; // Basispunkte → Prozent
}

export interface Kennzahlen {
  /** Anzahl ausgewerteter Signale (Renditen mit endlichem Wert). */
  n: number;
  /** Signale, die in die richtige Richtung zeigten. */
  correct: number;
  /** Gezählte Signale insgesamt. */
  total: number;
  /** Anteil richtungsrichtiger Signale in Prozent — Berichtsgrösse. */
  hitRate: number;
  /** Mittlere Nettorendite je Signal, in Prozent. */
  mittlereRendite: number;
  /** Standardabweichung der Nettorenditen je Signal, in Prozent. */
  streuung: number;
  /**
   * Ertrag je Einheit Streuung, auf ein Jahr hochgerechnet — die Zielgrösse.
   *
   * `mittel / streuung * sqrt(252 / haltedauer)`. Die Hochrechnung ist nötig,
   * weil sonst ein längerer Vorwärtshorizont allein durch die grösseren
   * Beträge gewinnen würde. 0, wenn die Streuung 0 ist oder zu wenige Signale
   * vorliegen.
   */
  sharpe: number;
}

const LEER: Kennzahlen = {
  n: 0, correct: 0, total: 0, hitRate: 0, mittlereRendite: 0, streuung: 0, sharpe: 0,
};

/**
 * Kennzahlen aus einer Reihe von Nettorenditen (rein, ohne Seiteneffekte).
 *
 * `haltedauerTage` ist der Vorwärtshorizont, über den jede einzelne Rendite
 * gemessen wurde — er geht ausschliesslich in die Annualisierung ein.
 */
export function kennzahlen(
  nettoRenditen: number[],
  correct: number,
  total: number,
  haltedauerTage: number,
): Kennzahlen {
  const werte = (nettoRenditen ?? []).filter((v) => Number.isFinite(v));
  const hitRate = total > 0 ? (correct / total) * 100 : 0;
  if (werte.length === 0) return { ...LEER, correct, total, hitRate };

  const mittel = werte.reduce((s, v) => s + v, 0) / werte.length;
  // Stichprobenstreuung (n-1): Bei einem einzelnen Signal gibt es keine
  // Streuungsschätzung — dann bleibt die Zielgrösse 0, statt durch 0 zu teilen.
  const streuung =
    werte.length > 1
      ? Math.sqrt(werte.reduce((s, v) => s + (v - mittel) ** 2, 0) / (werte.length - 1))
      : 0;

  const skala = haltedauerTage > 0 ? Math.sqrt(HANDELSTAGE_PRO_JAHR / haltedauerTage) : 1;
  const sharpe = streuung > 0 ? (mittel / streuung) * skala : 0;

  return { n: werte.length, correct, total, hitRate, mittlereRendite: mittel, streuung, sharpe };
}
