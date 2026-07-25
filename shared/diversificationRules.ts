/**
 * Diversifikationsregeln — Typ und Standardwerte.
 *
 * Liegt in `shared/`, weil sowohl der Server (Optimizer, Vorschlags-Job) als
 * auch der Admin-Bereich diesen Satz braucht. Vorher existierten zwei getrennte
 * Default-Objekte mit ABWEICHENDEN Werten: der Admin-Bereich zeigte
 * max. 10 % / min. 1 % / 15–20 Titel, während die Engine tatsächlich mit
 * max. 15 % / min. 3 % / 10–30 Titel rechnete, solange nichts gespeichert war.
 * Der Admin sah also Regeln, nach denen gar nicht optimiert wurde.
 */

export interface DiversificationRules {
  /** Einzelposition-Untergrenze in % des Portfolios (Kleinstpositionen vermeiden). */
  minPositionPercent: number;
  /** Einzelposition-Obergrenze in % des Portfolios (Klumpenrisiko). */
  maxPositionPercent: number;
  /** Mindest-Positionsgrösse in CHF (Transaktionskosten-Effizienz). */
  minPositionAmountCHF: number;
  /** Mindestanzahl verschiedener Titel. */
  minTitles: number;
  /** Höchstanzahl verschiedener Titel. */
  maxTitles: number;
  /** Sektor-Untergrenze in % des Portfolios (Mindestdiversifikation je Sektor). */
  minSectorPercent: number;
  /** Sektor-Obergrenze in % des Portfolios (Klumpenrisiko je Sektor). */
  maxSectorPercent: number;
  /**
   * Währungs-Obergrenze in % des Portfolios (Klumpenrisiko je Währung).
   * Default 100 = Regel inaktiv, bis ein Admin sie verschärft.
   */
  maxCurrencyPercent: number;
  /**
   * Score-Schwelle für Upgrade-Vorschläge: Positionen mit Qualitäts-Score
   * unterhalb dieses Wertes werden als Upgrade-Kandidaten markiert.
   */
  upgradeScoreThreshold: number;
}

export const DEFAULT_DIVERSIFICATION_RULES: DiversificationRules = {
  minPositionPercent: 3,
  maxPositionPercent: 15,
  minPositionAmountCHF: 3000,
  minTitles: 10,
  maxTitles: 30,
  minSectorPercent: 0,
  maxSectorPercent: 30,
  maxCurrencyPercent: 100,
  upgradeScoreThreshold: 55,
};
