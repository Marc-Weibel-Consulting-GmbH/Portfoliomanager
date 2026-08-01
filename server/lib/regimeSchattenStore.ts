/**
 * Persistenz der Schattenrechnung (siehe regimeSchatten.ts).
 *
 * Eine eigene Tabelle, kein Anbau an `stock_signal_cache`: Dort hängt der heisse
 * Pfad dran, und der manus-Deploy führt `drizzle-kit migrate` nicht aus. Die
 * Tabelle legt sich darum selbst an — dasselbe Muster wie `combined_score_history`.
 *
 * Ein Eintrag je Ticker und Tag. Nach `HORIZON_DAYS` wird derselbe realisierte
 * Return gegen BEIDE Signale gehalten; ausgewertet wird also ein Paar, keine
 * zwei unabhängigen Stichproben.
 */

import { HORIZON_DAYS, bilanziere, type SchattenBilanz, type SchattenZeile } from "./regimeSchatten";

let tabelleGeprueft = false;

async function stelleTabelleSicher(db: any): Promise<void> {
  if (tabelleGeprueft) return;
  const { sql } = await import("drizzle-orm");
  await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS \`regime_blend_shadow\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`ticker\` varchar(50) NOT NULL,
    \`snapshotDate\` varchar(10) NOT NULL,
    \`liveRegime\` varchar(32),
    \`liveScore\` decimal(6,2),
    \`liveSignal\` varchar(16),
    \`marktRegime\` varchar(32),
    \`schattenRegime\` varchar(32),
    \`schattenScore\` decimal(6,2),
    \`schattenSignal\` varchar(16),
    \`priceAtSnapshot\` decimal(12,4),
    \`horizonDays\` int NOT NULL DEFAULT ${HORIZON_DAYS},
    \`computedAt\` timestamp NOT NULL DEFAULT (now()),
    \`evaluatedAt\` timestamp NULL,
    \`actualReturnPct\` decimal(9,4),
    \`benchmarkReturnPct\` decimal(9,4),
    CONSTRAINT \`regime_blend_shadow_id\` PRIMARY KEY(\`id\`),
    CONSTRAINT \`uq_regime_blend_shadow_ticker_date\` UNIQUE(\`ticker\`,\`snapshotDate\`)
  )`));
  tabelleGeprueft = true;
}

export interface SchattenSatz {
  ticker: string;
  liveRegime: string;
  liveScore: number;
  liveSignal: string;
  marktRegime: string;
  schattenRegime: string;
  schattenScore: number;
  schattenSignal: string;
  preis: number | null;
}

/**
 * Einen Tagessatz festhalten. Non-fatal: Schlägt es fehl, läuft der Signal-Lauf
 * unverändert weiter — die Schattenrechnung darf den echten Pfad nie gefährden.
 */
export async function haltefest(saetze: SchattenSatz[]): Promise<{ geschrieben: number }> {
  if (!saetze.length) return { geschrieben: 0 };
  try {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) return { geschrieben: 0 };
    await stelleTabelleSicher(db);

    const { sql } = await import("drizzle-orm");
    const snapshotDate = new Date().toISOString().split("T")[0];
    let geschrieben = 0;

    for (const s of saetze) {
      try {
        await db.execute(sql`
          INSERT INTO regime_blend_shadow
            (ticker, snapshotDate, liveRegime, liveScore, liveSignal,
             marktRegime, schattenRegime, schattenScore, schattenSignal,
             priceAtSnapshot, horizonDays)
          VALUES
            (${s.ticker}, ${snapshotDate}, ${s.liveRegime}, ${s.liveScore}, ${s.liveSignal},
             ${s.marktRegime}, ${s.schattenRegime}, ${s.schattenScore}, ${s.schattenSignal},
             ${s.preis}, ${HORIZON_DAYS})
          ON DUPLICATE KEY UPDATE
            liveRegime = VALUES(liveRegime), liveScore = VALUES(liveScore),
            liveSignal = VALUES(liveSignal), marktRegime = VALUES(marktRegime),
            schattenRegime = VALUES(schattenRegime), schattenScore = VALUES(schattenScore),
            schattenSignal = VALUES(schattenSignal), priceAtSnapshot = VALUES(priceAtSnapshot)
        `);
        geschrieben++;
      } catch { /* einzelne Zeile überspringen */ }
    }
    return { geschrieben };
  } catch (e) {
    console.warn("[regimeSchatten] Festhalten fehlgeschlagen (non-fatal):", (e as Error).message);
    return { geschrieben: 0 };
  }
}

/**
 * Reife Sätze auswerten: realisierter Return seit Snapshot und Benchmark-Return
 * über dasselbe Fenster. Die Trefferbeurteilung selbst passiert erst beim
 * Bilanzieren — hier werden nur Messwerte abgelegt, keine Urteile.
 */
export async function werteAus(): Promise<{ bewertet: number }> {
  try {
    const { getDb, getBenchmarkData } = await import("../db");
    const db = await getDb();
    if (!db) return { bewertet: 0 };
    await stelleTabelleSicher(db);

    const { sql } = await import("drizzle-orm");
    const faellig: any = await db.execute(sql`
      SELECT id, ticker, snapshotDate, priceAtSnapshot, computedAt
      FROM regime_blend_shadow
      WHERE evaluatedAt IS NULL
        AND DATE_ADD(computedAt, INTERVAL horizonDays DAY) <= NOW()
      LIMIT 300
    `);
    const zeilen: any[] = Array.isArray(faellig) ? (faellig[0] ?? faellig) : (faellig?.rows ?? []);
    if (!zeilen.length) return { bewertet: 0 };

    const { stocks } = await import("../../drizzle/schema");
    const tickers = [...new Set(zeilen.map((z) => z.ticker))];
    const kurse = await db
      .select({ ticker: stocks.ticker, currentPrice: stocks.currentPrice })
      .from(stocks)
      .where(sql`${stocks.ticker} IN (${sql.join(tickers.map((t) => sql`${t}`), sql`, `)})`);
    const preisMap = new Map<string, number>();
    for (const k of kurse) if (k.currentPrice) preisMap.set(k.ticker, parseFloat(k.currentPrice));

    const heute = new Date().toISOString().split("T")[0];
    const { computeWindowReturn } = await import("./signals/benchmarkAlpha");
    let benchmark: { date: string; close: number }[] = [];
    try {
      benchmark = (await getBenchmarkData("SMI")) as any;
    } catch { /* ohne Benchmark bleibt benchmarkReturnPct null */ }

    let bewertet = 0;
    for (const z of zeilen) {
      const start = z.priceAtSnapshot != null ? parseFloat(String(z.priceAtSnapshot)) : NaN;
      const jetzt = preisMap.get(z.ticker);
      // Ohne belastbaren Start- oder Endkurs wird NICHT bewertet — eine Zeile
      // ohne Messwert ist kein Ergebnis von null Prozent.
      if (!Number.isFinite(start) || start <= 0 || jetzt === undefined || !(jetzt > 0)) continue;

      const actual = ((jetzt - start) / start) * 100;
      let bench: number | null = null;
      if (benchmark.length) {
        const b = computeWindowReturn(benchmark as any, String(z.snapshotDate), heute);
        if (b !== null) bench = b * 100;
      }

      try {
        await db.execute(sql`
          UPDATE regime_blend_shadow
             SET actualReturnPct = ${parseFloat(actual.toFixed(4))},
                 benchmarkReturnPct = ${bench === null ? null : parseFloat(bench.toFixed(4))},
                 evaluatedAt = NOW()
           WHERE id = ${z.id}
        `);
        bewertet++;
      } catch { /* einzelne Zeile überspringen */ }
    }
    return { bewertet };
  } catch (e) {
    console.warn("[regimeSchatten] Auswertung fehlgeschlagen (non-fatal):", (e as Error).message);
    return { bewertet: 0 };
  }
}

/** Stand der Messung — die Zahl, an der die Umstellungsentscheidung hängt. */
export async function bilanz(): Promise<SchattenBilanz & { offen: number }> {
  const leer = {
    bewertet: 0, liveTrefferPct: null, schattenTrefferPct: null,
    liveAlphaPct: null, schattenAlphaPct: null, uneinig: 0, offen: 0,
  };
  try {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) return leer;
    await stelleTabelleSicher(db);

    const { sql } = await import("drizzle-orm");
    const res: any = await db.execute(sql`
      SELECT liveSignal, schattenSignal, actualReturnPct, benchmarkReturnPct, evaluatedAt
      FROM regime_blend_shadow
    `);
    const rows: any[] = Array.isArray(res) ? (res[0] ?? res) : (res?.rows ?? []);

    const ausgewertet: SchattenZeile[] = rows
      .filter((r) => r.evaluatedAt != null)
      .map((r) => ({
        liveSignal: String(r.liveSignal ?? ""),
        schattenSignal: String(r.schattenSignal ?? ""),
        actualReturnPct: r.actualReturnPct == null ? null : parseFloat(String(r.actualReturnPct)),
        benchmarkReturnPct: r.benchmarkReturnPct == null ? null : parseFloat(String(r.benchmarkReturnPct)),
      }));

    return { ...bilanziere(ausgewertet), offen: rows.length - ausgewertet.length };
  } catch (e) {
    console.warn("[regimeSchatten] Bilanz fehlgeschlagen (non-fatal):", (e as Error).message);
    return leer;
  }
}
