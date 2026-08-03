/**
 * Ablage der Signal-Schattenrechnung.
 *
 * Hält je Titel und Tag beide Varianten fest: den heute angezeigten Score
 * (Qualität + Momentum gemischt) und die Schattenvariante (Qualität, Bewertung
 * und Timing getrennt gewichtet). Nichts davon wird angezeigt.
 *
 * Eigene Tabelle statt neuer Spalten, und sie legt sich selbst an: Der Deploy
 * führt `drizzle-kit migrate` nicht aus. Dasselbe Muster wie
 * `regime_blend_shadow` und `proposal_outcome_detail`.
 */

let tabelleGeprueft = false;

async function stelleTabelleSicher(db: any): Promise<void> {
  if (tabelleGeprueft) return;
  const { sql } = await import("drizzle-orm");
  await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS \`signal_blend_shadow\` (
    \`id\` int NOT NULL AUTO_INCREMENT,
    \`ticker\` varchar(24) NOT NULL,
    \`datum\` varchar(10) NOT NULL,
    \`liveScore\` decimal(6,2),
    \`liveSignal\` varchar(16),
    \`schattenScore\` decimal(6,2),
    \`schattenSignal\` varchar(16),
    \`timingScore\` decimal(6,2),
    \`qualitaetNeu\` decimal(6,2),
    \`bewertungNeu\` decimal(6,2),
    \`qualitaetsAnteilLive\` decimal(5,3),
    \`regime\` varchar(32),
    \`preis\` decimal(18,6),
    \`erfasstAm\` timestamp NOT NULL DEFAULT (now()),
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`signal_blend_shadow_ticker_datum\` (\`ticker\`, \`datum\`),
    KEY \`ix_signal_blend_shadow_datum\` (\`datum\`)
  )`));
  tabelleGeprueft = true;
}

export interface SchattenSatz {
  ticker: string;
  liveScore: number;
  liveSignal: string;
  schattenScore: number | null;
  schattenSignal: string | null;
  timingScore: number;
  qualitaetNeu: number | null;
  bewertungNeu: number | null;
  qualitaetsAnteilLive: number;
  regime: string;
  preis: number | null;
}

/** Non-fatal: Scheitert das Schreiben, bleibt der echte Signallauf unberührt. */
export async function haltefestSignalSchatten(
  saetze: SchattenSatz[],
  datum: string,
): Promise<{ geschrieben: number }> {
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
        INSERT INTO signal_blend_shadow
          (ticker, datum, liveScore, liveSignal, schattenScore, schattenSignal,
           timingScore, qualitaetNeu, bewertungNeu, qualitaetsAnteilLive, regime, preis)
        VALUES
          (${s.ticker}, ${datum}, ${s.liveScore}, ${s.liveSignal}, ${s.schattenScore},
           ${s.schattenSignal}, ${s.timingScore}, ${s.qualitaetNeu}, ${s.bewertungNeu},
           ${s.qualitaetsAnteilLive}, ${s.regime}, ${s.preis})
        ON DUPLICATE KEY UPDATE
          liveScore = VALUES(liveScore), liveSignal = VALUES(liveSignal),
          schattenScore = VALUES(schattenScore), schattenSignal = VALUES(schattenSignal),
          timingScore = VALUES(timingScore), qualitaetNeu = VALUES(qualitaetNeu),
          bewertungNeu = VALUES(bewertungNeu), qualitaetsAnteilLive = VALUES(qualitaetsAnteilLive),
          regime = VALUES(regime), preis = VALUES(preis)
      `);
      geschrieben++;
    }
    return { geschrieben };
  } catch (e) {
    console.warn("[SignalSchatten] Nicht abgelegt (non-fatal):", (e as Error).message);
    return { geschrieben: 0 };
  }
}

export interface SignalSchattenBilanz {
  /** Sätze insgesamt. */
  erfasst: number;
  /** Sätze, bei denen beide Varianten einen Wert haben. */
  vergleichbar: number;
  /** Wie oft beide dieselbe Handlungsempfehlung geben. */
  gleichesSignal: number;
  /** Ø Differenz Schatten minus Live, in Punkten. */
  avgDifferenz: number | null;
  /** Grösste Abweichung nach oben und unten, mit Titel. */
  groessteAbweichung: { ticker: string; live: number; schatten: number } | null;
  /** Ø Qualitätsanteil im heutigen Live-Score — die Doppelzählung in Zahlen. */
  avgQualitaetsAnteil: number | null;
  /** Wie viele Sätze mangels neuer Scores nicht vergleichbar waren. */
  ohneNeueScores: number;
}

/**
 * Stand der Messung.
 *
 * Bewusst ohne Aussage darüber, welche Variante «besser» ist: Das entscheidet
 * die realisierte Rendite, nicht die Ähnlichkeit der Zahlen. Diese Bilanz zeigt
 * nur, wie stark sich die Zusammensetzung auswirkt — und wie oft sie die
 * Handlungsempfehlung tatsächlich dreht.
 */
export async function signalSchattenBilanz(): Promise<SignalSchattenBilanz> {
  const leer: SignalSchattenBilanz = {
    erfasst: 0, vergleichbar: 0, gleichesSignal: 0, avgDifferenz: null,
    groessteAbweichung: null, avgQualitaetsAnteil: null, ohneNeueScores: 0,
  };
  try {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) return leer;
    await stelleTabelleSicher(db);

    const { sql } = await import("drizzle-orm");
    const res: any = await db.execute(sql`
      SELECT ticker, liveScore, liveSignal, schattenScore, schattenSignal, qualitaetsAnteilLive
      FROM signal_blend_shadow
    `);
    const rows: any[] = Array.isArray(res) ? (res[0] ?? res) : (res?.rows ?? []);
    if (!rows.length) return leer;

    const zahl = (v: any) => (v == null ? null : parseFloat(String(v)));
    const paare = rows.filter((r) => zahl(r.schattenScore) !== null && zahl(r.liveScore) !== null);

    let summe = 0;
    let groesste: SignalSchattenBilanz["groessteAbweichung"] = null;
    let maxAbstand = -1;
    let gleich = 0;

    for (const r of paare) {
      const live = zahl(r.liveScore)!;
      const schatten = zahl(r.schattenScore)!;
      summe += schatten - live;
      if (r.liveSignal === r.schattenSignal) gleich++;
      const abstand = Math.abs(schatten - live);
      if (abstand > maxAbstand) {
        maxAbstand = abstand;
        groesste = { ticker: r.ticker, live, schatten };
      }
    }

    const anteile = rows.map((r) => zahl(r.qualitaetsAnteilLive)).filter((v): v is number => v !== null);

    return {
      erfasst: rows.length,
      vergleichbar: paare.length,
      gleichesSignal: gleich,
      avgDifferenz: paare.length ? parseFloat((summe / paare.length).toFixed(2)) : null,
      groessteAbweichung: groesste,
      avgQualitaetsAnteil: anteile.length
        ? parseFloat((anteile.reduce((a, b) => a + b, 0) / anteile.length).toFixed(3))
        : null,
      ohneNeueScores: rows.length - paare.length,
    };
  } catch (e) {
    console.warn("[SignalSchatten] Bilanz fehlgeschlagen (non-fatal):", (e as Error).message);
    return leer;
  }
}
