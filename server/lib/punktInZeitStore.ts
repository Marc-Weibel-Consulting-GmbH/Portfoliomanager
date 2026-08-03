/**
 * Ablage der rekonstruierten Scores je Titel und Stichtag.
 *
 * `stock_scores` hält einen Wert je Titel und überschreibt ihn — für einen
 * Backtest braucht es die Reihe. Eigene Tabelle statt neuer Spalten, und
 * selbstheilend angelegt: Der Deploy führt `drizzle-kit migrate` nicht aus.
 *
 * Die Zeilen sind ausdrücklich als REKONSTRUKTION gekennzeichnet, nicht als
 * Messung: `meldefristTage` hält fest, mit welcher Annahme über die
 * Veröffentlichung gerechnet wurde, `belegt`, auf wie vielen Kennzahlen der
 * Wert beruht. Ohne diese beiden Angaben liesse sich später nicht mehr sagen,
 * ob eine Zahl belastbar war oder aus zwei Kennzahlen hochgerechnet.
 */

let tabelleGeprueft = false;

async function stelleTabelleSicher(db: any): Promise<void> {
  if (tabelleGeprueft) return;
  const { sql } = await import("drizzle-orm");
  await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS \`stock_scores_history\` (
    \`ticker\` varchar(24) NOT NULL,
    \`datum\` varchar(10) NOT NULL,
    \`qualitaet\` decimal(6,2),
    \`bewertung\` decimal(6,2),
    \`fScore\` tinyint,
    \`fScoreBerechenbar\` tinyint,
    \`kurs\` decimal(18,6),
    \`belegt\` tinyint NOT NULL DEFAULT 0,
    \`meldefristTage\` smallint NOT NULL DEFAULT 90,
    \`erfasstAm\` timestamp NOT NULL DEFAULT (now()),
    PRIMARY KEY (\`ticker\`, \`datum\`),
    KEY \`ix_stock_scores_history_datum\` (\`datum\`)
  )`));
  tabelleGeprueft = true;
}

export interface HistorienSatz {
  ticker: string;
  datum: string;
  qualitaet: number | null;
  bewertung: number | null;
  fScore: number;
  fScoreBerechenbar: number;
  kurs: number | null;
  belegt: number;
  meldefristTage: number;
}

/** Schreibt Sätze; vorhandene Ticker/Datum-Paare werden überschrieben. */
export async function haltefestHistorie(saetze: HistorienSatz[]): Promise<number> {
  if (!saetze.length) return 0;
  try {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) return 0;
    await stelleTabelleSicher(db);
    const { sql } = await import("drizzle-orm");

    let geschrieben = 0;
    // In Blöcken, damit eine lange Reihe nicht in einer Riesenanweisung landet.
    const BLOCK = 200;
    for (let i = 0; i < saetze.length; i += BLOCK) {
      const teil = saetze.slice(i, i + BLOCK);
      const werte = teil.map((s) =>
        sql`(${s.ticker}, ${s.datum}, ${s.qualitaet}, ${s.bewertung}, ${s.fScore},
             ${s.fScoreBerechenbar}, ${s.kurs}, ${s.belegt}, ${s.meldefristTage})`);
      await db.execute(sql`
        INSERT INTO stock_scores_history
          (ticker, datum, qualitaet, bewertung, fScore, fScoreBerechenbar, kurs, belegt, meldefristTage)
        VALUES ${sql.join(werte, sql`, `)}
        ON DUPLICATE KEY UPDATE
          qualitaet = VALUES(qualitaet), bewertung = VALUES(bewertung),
          fScore = VALUES(fScore), fScoreBerechenbar = VALUES(fScoreBerechenbar),
          kurs = VALUES(kurs), belegt = VALUES(belegt),
          meldefristTage = VALUES(meldefristTage), erfasstAm = now()`);
      geschrieben += teil.length;
    }
    return geschrieben;
  } catch (e) {
    console.warn("[PunktInZeit] Schreiben fehlgeschlagen (non-fatal):", (e as Error).message);
    return 0;
  }
}

/** Liest die Reihe eines Titels, aufsteigend nach Datum. */
export async function leseHistorie(ticker: string): Promise<HistorienSatz[]> {
  try {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) return [];
    await stelleTabelleSicher(db);
    const { sql } = await import("drizzle-orm");
    const rows: any = await db.execute(sql`
      SELECT ticker, datum, qualitaet, bewertung, fScore, fScoreBerechenbar, kurs, belegt, meldefristTage
      FROM stock_scores_history WHERE ticker = ${ticker} ORDER BY datum ASC`);
    const liste = Array.isArray(rows) ? (rows[0] ?? rows) : (rows?.rows ?? []);
    const num = (v: unknown) => (v === null || v === undefined ? null : parseFloat(String(v)));
    return (liste as any[]).map((r) => ({
      ticker: String(r.ticker),
      datum: String(r.datum),
      qualitaet: num(r.qualitaet),
      bewertung: num(r.bewertung),
      fScore: Number(r.fScore ?? 0),
      fScoreBerechenbar: Number(r.fScoreBerechenbar ?? 0),
      kurs: num(r.kurs),
      belegt: Number(r.belegt ?? 0),
      meldefristTage: Number(r.meldefristTage ?? 90),
    }));
  } catch (e) {
    console.warn("[PunktInZeit] Lesen fehlgeschlagen (non-fatal):", (e as Error).message);
    return [];
  }
}

/** Wie viele Zeilen liegen vor und über welchen Zeitraum — für die Admin-Anzeige. */
export async function historienUmfang(): Promise<{
  zeilen: number; titel: number; von: string | null; bis: string | null;
}> {
  const leer = { zeilen: 0, titel: 0, von: null, bis: null };
  try {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) return leer;
    await stelleTabelleSicher(db);
    const { sql } = await import("drizzle-orm");
    const rows: any = await db.execute(sql`
      SELECT COUNT(*) AS zeilen, COUNT(DISTINCT ticker) AS titel,
             MIN(datum) AS von, MAX(datum) AS bis
      FROM stock_scores_history`);
    const liste = Array.isArray(rows) ? (rows[0] ?? rows) : (rows?.rows ?? []);
    const r = (liste as any[])[0];
    if (!r) return leer;
    return {
      zeilen: Number(r.zeilen ?? 0),
      titel: Number(r.titel ?? 0),
      von: r.von ? String(r.von) : null,
      bis: r.bis ? String(r.bis) : null,
    };
  } catch {
    return leer;
  }
}
