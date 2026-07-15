/**
 * Diversifikationsregeln (Konzept «Optimierung & Empfehlungen», Stufe F2).
 *
 * Globaler, admin-konfigurierbarer Regelsatz. Persistiert im bestehenden
 * Key-Value-Store `appSettings` unter dem Schlüssel `diversification_rules`
 * (gepflegt über den Admin-Bereich «App-Einstellungen»). Dieser Helfer ist die
 * *eine* Quelle der Wahrheit: sowohl die Nutzer-Ansicht (`OptimierenTab`) als
 * auch der Optimizer (`optimizePortfolio`) lesen denselben Satz.
 *
 * Fehlertolerant: fehlt die Tabelle/der Eintrag oder ist die DB nicht
 * verfügbar, greifen die Defaults (identisch mit den bisher hartkodierten
 * Werten — Standardverhalten bleibt unverändert).
 *
 * Bandbreiten-Konzept (neu):
 * - minPositionPercent / maxPositionPercent definieren die erlaubte Bandbreite
 *   pro Einzeltitel. Der Optimizer bestimmt die genaue Gewichtung frei innerhalb
 *   dieser Grenzen — keine Gleichgewichtung erzwungen.
 * - minSectorPercent / maxSectorPercent analog für Sektoren.
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
  minPositionPercent: 3,    // Erhöht von 1% → 3%: Kleinstpositionen (< 3%) vermeiden
  maxPositionPercent: 15,   // Reduziert von 25% → 15%: Klumpenrisiko begrenzen
  minPositionAmountCHF: 3000,
  minTitles: 10,            // Gelockert von 15 → 10
  maxTitles: 30,            // Erhöht von 20 → 30
  minSectorPercent: 0,      // Neu: keine Mindestquote je Sektor
  maxSectorPercent: 40,     // Leicht erhöht von 30% → 40%
  maxCurrencyPercent: 100,
  upgradeScoreThreshold: 55, // Positionen mit Score < 55 werden als Upgrade-Kandidaten vorgeschlagen
};

/** Aktiven Regelsatz lesen (Defaults + gespeicherte Überschreibungen). */
export async function getDiversificationRules(): Promise<DiversificationRules> {
  try {
    const { getDb } = await import("../db");
    const { appSettings } = await import("../../drizzle/schema");
    const db = await getDb();
    if (!db) return DEFAULT_DIVERSIFICATION_RULES;
    const rows = await db.select().from(appSettings);
    const row = rows.find((r: any) => r.key === "diversification_rules");
    if (!row?.value) return DEFAULT_DIVERSIFICATION_RULES;
    return { ...DEFAULT_DIVERSIFICATION_RULES, ...(row.value as Partial<DiversificationRules>) };
  } catch (e) {
    console.warn("[diversificationRules] Laden fehlgeschlagen:", (e as Error).message);
    return DEFAULT_DIVERSIFICATION_RULES;
  }
}
