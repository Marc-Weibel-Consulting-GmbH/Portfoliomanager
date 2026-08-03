/**
 * Einmalige Reparatur der hundertfach zu hohen Dividendenrenditen.
 *
 * `signalScoreRefreshScheduled` multiplizierte den bereits in Prozent
 * vorliegenden EODHD-Wert erneut mit 100 und schrieb ihn so in `stocks`.
 * Der Schreibpfad ist korrigiert; die Altwerte stehen weiterhin in der
 * Datenbank.
 *
 * Selbstheilend statt Migration: Der manus-Deploy führt `drizzle-kit migrate`
 * nicht aus — dasselbe Muster wie bei `combined_score_history` und
 * `regime_blend_shadow`.
 *
 * Idempotent: Repariert werden ausschliesslich Zeilen über der
 * Plausibilitätsschranke. Ein zweiter Lauf findet nichts mehr und ändert
 * nichts. Ein bereits korrekter Wert von 1.51 wird nie angefasst.
 *
 * Nicht mitrepariert werden `signalScore` und `aiReason` — beide werden vom
 * täglichen Refresh (07:00 UTC) ohnehin neu berechnet, sobald die Renditen
 * stimmen. Sie hier nachzurechnen hiesse, alle Titel erneut bei EODHD
 * abzufragen; das ist genau die Aufgabe jenes Jobs.
 */

import { PLAUSIBEL_MAX_PROZENT } from "./dividendenrendite";

let bereitsGelaufen = false;

export interface ReparaturErgebnis {
  geprueft: number;
  repariert: number;
  verworfen: number;
  uebersprungen: boolean;
}

/**
 * @param erneutErlauben Setzt die Einmal-Sperre zurück (für Tests und für einen
 *                       bewussten zweiten Lauf über eine Admin-Aktion).
 */
export async function repariereDividendenrenditen(erneutErlauben = false): Promise<ReparaturErgebnis> {
  const leer: ReparaturErgebnis = { geprueft: 0, repariert: 0, verworfen: 0, uebersprungen: true };
  if (bereitsGelaufen && !erneutErlauben) return leer;

  try {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) return leer;

    const { stocks } = await import("../../drizzle/schema");
    const { sql } = await import("drizzle-orm");

    // Nur die unplausiblen Zeilen holen — die grosse Mehrheit bleibt unberührt.
    const res: any = await db.execute(sql`
      SELECT ticker, dividendYield
      FROM stocks
      WHERE dividendYield IS NOT NULL
        AND CAST(dividendYield AS DECIMAL(12,4)) > ${PLAUSIBEL_MAX_PROZENT}
    `);
    const rows: any[] = Array.isArray(res) ? (res[0] ?? res) : (res?.rows ?? []);

    let repariert = 0;
    let verworfen = 0;

    for (const row of rows) {
      const roh = parseFloat(String(row.dividendYield));
      if (!Number.isFinite(roh)) continue;
      const geteilt = roh / 100;

      // Bleibt der Wert auch geteilt unplausibel, war er nie eine Rendite.
      // Dann lieber leeren als eine geratene Zahl stehen lassen.
      const neu = geteilt >= 0 && geteilt <= PLAUSIBEL_MAX_PROZENT ? geteilt.toFixed(4) : null;

      const { eq } = await import("drizzle-orm");
      await db.update(stocks).set({ dividendYield: neu }).where(eq(stocks.ticker, row.ticker));

      if (neu === null) verworfen++;
      else repariert++;
    }

    bereitsGelaufen = true;

    if (rows.length > 0) {
      console.log(
        `[Dividendenrendite] Reparatur: ${rows.length} unplausible Werte gefunden, ` +
        `${repariert} durch 100 geteilt, ${verworfen} geleert.`,
      );
    }

    return { geprueft: rows.length, repariert, verworfen, uebersprungen: false };
  } catch (e) {
    // Non-fatal: Schlägt die Reparatur fehl, läuft die Anwendung weiter. Die
    // Werte bleiben falsch, aber nichts stürzt ab.
    console.warn("[Dividendenrendite] Reparatur fehlgeschlagen (non-fatal):", (e as Error).message);
    return leer;
  }
}

/** Nur für Tests. */
export function _sperreZuruecksetzen(): void {
  bereitsGelaufen = false;
}
