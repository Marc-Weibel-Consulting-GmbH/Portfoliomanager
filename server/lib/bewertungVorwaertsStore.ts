/**
 * Tägliche Aufzeichnung des geschätzten Bewertungsteils.
 *
 * Das PEG bleibt in der Live-Bewertung (so entschieden), lässt sich aber nicht
 * rückwirkend rekonstruieren: Was 2022 für 2023 an Wachstum erwartet wurde,
 * steht in keiner heutigen EODHD-Antwort. Der Backtest rechnet deshalb auf
 * `scoreGemessen`, also ohne Schätzfaktoren.
 *
 * Diese Lücke schliesst sich nur in eine Richtung: nach vorn — und auch das
 * nicht von selbst. Wer heute nicht aufschreibt, welches PEG gerechnet wurde,
 * steht in zwei Jahren wieder vor derselben Frage. Genau das tut diese Tabelle.
 *
 * ABGRENZUNG ZU `stock_scores_history`: Dort steht die REKONSTRUIERTE
 * Vergangenheit, rückwärtsgerichtet und ohne Schätzfaktoren. Hier steht die
 * AUFGEZEICHNETE Gegenwart, mit ihnen. Zwei Tabellen, weil die Herkunft
 * verschieden ist — sie zu vermischen hiesse, später nicht mehr unterscheiden
 * zu können, welche Zeile gemessen und welche nachgerechnet wurde. Genau diese
 * Unterscheidung entscheidet, ob ein Backtest trägt.
 */

let tabelleGeprueft = false;

async function stelleTabelleSicher(db: any): Promise<void> {
  if (tabelleGeprueft) return;
  const { sql } = await import("drizzle-orm");
  await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS \`bewertung_vorwaerts\` (
    \`ticker\` varchar(24) NOT NULL,
    \`datum\` varchar(10) NOT NULL,
    \`bewertung\` decimal(6,2),
    \`bewertungGemessen\` decimal(6,2),
    \`anteilGeschaetzt\` decimal(5,3),
    \`adjustedPeg\` decimal(10,4),
    \`kgv\` decimal(10,4),
    \`kurs\` decimal(18,6),
    \`erfasstAm\` timestamp NOT NULL DEFAULT (now()),
    PRIMARY KEY (\`ticker\`, \`datum\`),
    KEY \`ix_bewertung_vorwaerts_datum\` (\`datum\`)
  )`));
  tabelleGeprueft = true;
}

export interface VorwaertsSatz {
  ticker: string;
  datum: string;
  bewertung: number | null;
  bewertungGemessen: number | null;
  anteilGeschaetzt: number;
  adjustedPeg: number | null;
  kgv: number | null;
  kurs: number | null;
}

/** Non-fatal: Scheitert das Schreiben, bleibt der Signallauf unberührt. */
export async function haltefestVorwaerts(saetze: VorwaertsSatz[]): Promise<number> {
  if (!saetze.length) return 0;
  try {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) return 0;
    await stelleTabelleSicher(db);
    const { sql } = await import("drizzle-orm");

    let geschrieben = 0;
    const BLOCK = 200;
    for (let i = 0; i < saetze.length; i += BLOCK) {
      const teil = saetze.slice(i, i + BLOCK);
      const werte = teil.map((s) =>
        sql`(${s.ticker}, ${s.datum}, ${s.bewertung}, ${s.bewertungGemessen},
             ${s.anteilGeschaetzt}, ${s.adjustedPeg}, ${s.kgv}, ${s.kurs})`);
      await db.execute(sql`
        INSERT INTO bewertung_vorwaerts
          (ticker, datum, bewertung, bewertungGemessen, anteilGeschaetzt, adjustedPeg, kgv, kurs)
        VALUES ${sql.join(werte, sql`, `)}
        ON DUPLICATE KEY UPDATE
          bewertung = VALUES(bewertung), bewertungGemessen = VALUES(bewertungGemessen),
          anteilGeschaetzt = VALUES(anteilGeschaetzt), adjustedPeg = VALUES(adjustedPeg),
          kgv = VALUES(kgv), kurs = VALUES(kurs), erfasstAm = now()`);
      geschrieben += teil.length;
    }
    return geschrieben;
  } catch (e) {
    console.warn("[BewertungVorwaerts] Schreiben fehlgeschlagen (non-fatal):", (e as Error).message);
    return 0;
  }
}

/**
 * Umfang der Aufzeichnung — für die Admin-Anzeige.
 *
 * `tageMitPeg` ist die Zahl, auf die es ankommt: Erst wenn sie gross genug
 * ist, lässt sich der geschätzte Bewertungsteil überhaupt backtesten.
 */
export async function vorwaertsUmfang(): Promise<{
  zeilen: number; titel: number; von: string | null; bis: string | null; tageMitPeg: number;
}> {
  const leer = { zeilen: 0, titel: 0, von: null, bis: null, tageMitPeg: 0 };
  try {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) return leer;
    await stelleTabelleSicher(db);
    const { sql } = await import("drizzle-orm");
    const rows: any = await db.execute(sql`
      SELECT COUNT(*) AS zeilen, COUNT(DISTINCT ticker) AS titel,
             MIN(datum) AS von, MAX(datum) AS bis,
             COUNT(DISTINCT CASE WHEN adjustedPeg IS NOT NULL THEN datum END) AS tageMitPeg
      FROM bewertung_vorwaerts`);
    const liste = Array.isArray(rows) ? (rows[0] ?? rows) : (rows?.rows ?? []);
    const r = (liste as any[])[0];
    if (!r) return leer;
    return {
      zeilen: Number(r.zeilen ?? 0),
      titel: Number(r.titel ?? 0),
      von: r.von ? String(r.von) : null,
      bis: r.bis ? String(r.bis) : null,
      tageMitPeg: Number(r.tageMitPeg ?? 0),
    };
  } catch {
    return leer;
  }
}
