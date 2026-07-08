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
 */

export interface DiversificationRules {
  /** Einzelposition-Obergrenze in % des Portfolios. */
  maxPositionPercent: number;
  /** Einzelposition-Untergrenze in % (Kleinstpositionen vermeiden). */
  minPositionPercent: number;
  /** Mindest-Positionsgrösse in CHF (Transaktionskosten-Effizienz). */
  minPositionAmountCHF: number;
  /** Mindestanzahl verschiedener Titel. */
  minTitles: number;
  /** Höchstanzahl verschiedener Titel. */
  maxTitles: number;
  /** Sektor-Obergrenze in % des Portfolios. */
  maxSectorPercent: number;
  /**
   * Währungs-Obergrenze in % des Portfolios (Klumpenrisiko je Währung).
   * Default 100 = Regel inaktiv, bis ein Admin sie verschärft.
   */
  maxCurrencyPercent: number;
}

export const DEFAULT_DIVERSIFICATION_RULES: DiversificationRules = {
  maxPositionPercent: 10,
  minPositionPercent: 1,
  minPositionAmountCHF: 3000,
  minTitles: 15,
  maxTitles: 20,
  maxSectorPercent: 30,
  maxCurrencyPercent: 100,
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
