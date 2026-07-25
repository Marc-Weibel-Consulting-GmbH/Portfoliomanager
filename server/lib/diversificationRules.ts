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

// Typ und Defaults liegen in shared/, damit der Admin-Bereich exakt dieselben
// Standardwerte anzeigt, mit denen die Engine rechnet.
export type { DiversificationRules } from "../../shared/diversificationRules";
export { DEFAULT_DIVERSIFICATION_RULES } from "../../shared/diversificationRules";

import { DEFAULT_DIVERSIFICATION_RULES } from "../../shared/diversificationRules";
import type { DiversificationRules } from "../../shared/diversificationRules";

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
