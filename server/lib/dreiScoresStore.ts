/**
 * Ablage der drei Scores je Titel.
 *
 * Qualität und Bewertung entstehen aus EODHD-Fundamentaldaten. Sie bei jedem
 * Seitenaufruf zu berechnen hiesse, für jede Tabellenzeile einen Abruf zu
 * machen — deshalb rechnet der stündliche Signal-Cron sie einmal vor und legt
 * sie hier ab.
 *
 * **Der alte Einzelscore bleibt unberührt in `stocks.score`.** Damit ist die
 * Schattenrechnung ohne eigene Mechanik gegeben: Beide Zahlen stehen
 * nebeneinander, und ein späteres Backtesting kann fragen, welche die bessere
 * Vorhersage war. Umgekehrt zur bisherigen Praxis — führend ist jetzt die neue
 * Zahl, im Schatten läuft die alte.
 *
 * Der Grund für die Umkehrung: Beim Signal-Score ist offen, welche
 * Zusammensetzung besser trifft — dort wird gemessen (#241). Beim
 * Qualitäts-Score ist es nicht offen. Er misst nachweislich etwas anderes, als
 * sein Name sagt: ABB erhält 31 «schwach», getragen zu 70 % von
 * Dividendenrendite und KGV, die beide dasselbe aussagen — teuer. Piotroski
 * führt dieselbe Aktie mit 7 von 9 unter den besten Schweizer Titeln. Monate
 * zu messen, ob eine falsch beschriftete Zahl falsch ist, wäre verlorene Zeit.
 *
 * Eigene Tabelle statt neuer Spalten, selbstheilend angelegt: Der Deploy führt
 * `drizzle-kit migrate` nicht aus.
 */

let tabelleGeprueft = false;

async function stelleTabelleSicher(db: any): Promise<void> {
  if (tabelleGeprueft) return;
  const { sql } = await import("drizzle-orm");
  await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS \`stock_scores\` (
    \`ticker\` varchar(24) NOT NULL,
    \`qualitaet\` decimal(6,2),
    \`qualitaetBand\` varchar(24),
    \`niveau\` decimal(6,2),
    \`richtung\` decimal(6,2),
    \`fScore\` tinyint,
    \`fScoreBerechenbar\` tinyint,
    \`bewertung\` decimal(6,2),
    \`bewertungBand\` varchar(24),
    \`abdeckungNiveau\` decimal(5,3),
    \`abdeckungBewertung\` decimal(5,3),
    \`berechnetAm\` timestamp NOT NULL DEFAULT (now()),
    PRIMARY KEY (\`ticker\`)
  )`));
  tabelleGeprueft = true;
}

export interface GespeicherteScores {
  ticker: string;
  qualitaet: number | null;
  qualitaetBand: string;
  niveau: number | null;
  richtung: number | null;
  fScore: number;
  fScoreBerechenbar: number;
  bewertung: number | null;
  bewertungBand: string;
  abdeckungNiveau: number;
  abdeckungBewertung: number;
}

/** Non-fatal: Scheitert das Schreiben, bleibt der Signallauf unberührt. */
export async function haltefestScores(saetze: GespeicherteScores[]): Promise<{ geschrieben: number }> {
  if (!saetze.length) return { geschrieben: 0 };
  try {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) return { geschrieben: 0 };
    await stelleTabelleSicher(db);

    const { sql } = await import("drizzle-orm");
    let geschrieben = 0;
    for (const s of saetze) {
      await db.execute(sql`
        INSERT INTO stock_scores
          (ticker, qualitaet, qualitaetBand, niveau, richtung, fScore, fScoreBerechenbar,
           bewertung, bewertungBand, abdeckungNiveau, abdeckungBewertung, berechnetAm)
        VALUES
          (${s.ticker}, ${s.qualitaet}, ${s.qualitaetBand}, ${s.niveau}, ${s.richtung},
           ${s.fScore}, ${s.fScoreBerechenbar}, ${s.bewertung}, ${s.bewertungBand},
           ${s.abdeckungNiveau}, ${s.abdeckungBewertung}, NOW())
        ON DUPLICATE KEY UPDATE
          qualitaet = VALUES(qualitaet), qualitaetBand = VALUES(qualitaetBand),
          niveau = VALUES(niveau), richtung = VALUES(richtung),
          fScore = VALUES(fScore), fScoreBerechenbar = VALUES(fScoreBerechenbar),
          bewertung = VALUES(bewertung), bewertungBand = VALUES(bewertungBand),
          abdeckungNiveau = VALUES(abdeckungNiveau), abdeckungBewertung = VALUES(abdeckungBewertung),
          berechnetAm = NOW()
      `);
      geschrieben++;
    }
    return { geschrieben };
  } catch (e) {
    console.warn("[DreiScores] Nicht abgelegt (non-fatal):", (e as Error).message);
    return { geschrieben: 0 };
  }
}

const zahl = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};

/** Vorberechnete Scores für viele Titel — eine Abfrage statt N Abrufe. */
export async function leseScores(tickers: string[]): Promise<Map<string, GespeicherteScores>> {
  const leer = new Map<string, GespeicherteScores>();
  if (!tickers.length) return leer;
  try {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) return leer;
    await stelleTabelleSicher(db);

    const { sql } = await import("drizzle-orm");
    const res: any = await db.execute(sql`
      SELECT * FROM stock_scores WHERE ticker IN (${sql.join(tickers.map((t) => sql`${t}`), sql`, `)})
    `);
    const rows: any[] = Array.isArray(res) ? (res[0] ?? res) : (res?.rows ?? []);
    for (const r of rows) {
      leer.set(r.ticker, {
        ticker: r.ticker,
        qualitaet: zahl(r.qualitaet),
        qualitaetBand: r.qualitaetBand ?? "nicht beurteilbar",
        niveau: zahl(r.niveau),
        richtung: zahl(r.richtung),
        fScore: Number(r.fScore ?? 0),
        fScoreBerechenbar: Number(r.fScoreBerechenbar ?? 0),
        bewertung: zahl(r.bewertung),
        bewertungBand: r.bewertungBand ?? "nicht beurteilbar",
        abdeckungNiveau: zahl(r.abdeckungNiveau) ?? 0,
        abdeckungBewertung: zahl(r.abdeckungBewertung) ?? 0,
      });
    }
    return leer;
  } catch (e) {
    console.warn("[DreiScores] Lesen fehlgeschlagen (non-fatal):", (e as Error).message);
    return leer;
  }
}
