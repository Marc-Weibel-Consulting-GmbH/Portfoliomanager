/**
 * Einmaliger Backfill der Qualitäts-Scores nach Einführung der Mindestabdeckung.
 *
 * `calculateStockScore` normalisierte bisher auf die belegte Gewichtung, ohne
 * Untergrenze. Eine einzelne vorhandene Kennzahl bestimmte damit den ganzen
 * Score:
 *
 *  - GLD.US (Gold-ETF): 87.5 «ausgezeichnet» — allein aus Beta 0.41, also aus
 *    20 % der Gewichtung.
 *  - VBTC.SW (Bitcoin-ETN): 0 «schwach» — aus gar keiner Kennzahl.
 *
 * Messung über das Universum (289 Titel, 2026-08-03): 63 Titel (21.8 %) waren
 * zu weniger als 70 % belegt, 34 (11.8 %) zu weniger als 60 %.
 *
 * Der Backfill rechnet alle gespeicherten Scores mit der neuen Regel neu.
 * Titel unter der Mindestabdeckung erhalten `null` — die Oberfläche zeigt dafür
 * «—» statt einer Note.
 *
 * Selbstheilend statt Migration: Der Deploy führt `drizzle-kit migrate` nicht
 * aus. Idempotent: Die Neuberechnung ist deterministisch, und geschrieben wird
 * nur, wo sich der Wert tatsächlich ändert.
 *
 * Rein lokal: Alle Eingangsgrössen stehen in der `stocks`-Tabelle. Kein
 * externer Abruf, keine API-Kosten.
 */

import { calculateStockScore } from "../scoring";

let bereitsGelaufen = false;

export interface BackfillErgebnis {
  geprueft: number;
  geaendert: number;
  aufNullGesetzt: number;
  uebersprungen: boolean;
}

/** @param erneutErlauben Setzt die Einmal-Sperre zurück (Tests, bewusster Zweitlauf). */
export async function backfillScoreAbdeckung(erneutErlauben = false): Promise<BackfillErgebnis> {
  const leer: BackfillErgebnis = { geprueft: 0, geaendert: 0, aufNullGesetzt: 0, uebersprungen: true };
  if (bereitsGelaufen && !erneutErlauben) return leer;

  try {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) return leer;

    const { stocks } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");

    const rows = await db
      .select({
        ticker: stocks.ticker,
        score: stocks.score,
        category: stocks.category,
        companyName: stocks.companyName,
        dividendYield: stocks.dividendYield,
        peRatio: stocks.peRatio,
        pegRatio: stocks.pegRatio,
        beta: stocks.beta,
        volatility: stocks.volatility,
        sharpeRatio: stocks.sharpeRatio,
        ytdPerformance: stocks.ytdPerformance,
      })
      .from(stocks);

    const zahl = (v: unknown): number | undefined => {
      if (v == null) return undefined;
      const n = parseFloat(String(v));
      return Number.isFinite(n) ? n : undefined;
    };

    // Bonitätsnäherung für Obligationen: Qualitäts-Score der Aktie desselben
    // Emittenten. Einmal je Lauf aufgebaut, nicht je Zeile.
    const { findeEmittent } = await import("./emittentenQualitaet");
    const { detectAssetClass } = await import("./assetClassSignal");
    const { leseScores } = await import("./dreiScoresStore");
    const scores = await leseScores(rows.map((r) => r.ticker));
    const aktienFuerZuordnung = rows.map((r) => ({
      ticker: r.ticker,
      name: r.companyName,
      qualitaet: scores.get(r.ticker)?.qualitaet ?? null,
    }));

    let geaendert = 0;
    let aufNullGesetzt = 0;

    for (const row of rows) {
      const berechnet = calculateStockScore(
        row.ticker,
        {
          dividendYield: zahl(row.dividendYield),
          peRatio: zahl(row.peRatio),
          pegRatio: zahl(row.pegRatio),
          beta: zahl(row.beta),
          volatility: zahl(row.volatility),
          sharpeRatio: zahl(row.sharpeRatio),
          ytdPerformance: zahl(row.ytdPerformance),
          // Nur für Obligationen. Bei einer Aktie fände die Zuordnung sie
          // selbst — der Wert bliebe zwar folgenlos (nur `scoreBond` liest
          // ihn), die Rechnerei wäre aber unnötig und irreführend.
          emittentenQualitaet:
            detectAssetClass(row.category, null, row.companyName, row.ticker) === "bond"
              ? findeEmittent(row.companyName, aktienFuerZuordnung)?.qualitaet ?? null
              : null,
        },
        undefined,
        row.category ?? undefined,
        // Ohne den Namen erkennt `detectAssetClass` die Wikifolio-Importe nicht
        // als Obligationen — deren Ticker ist die ISIN, die Kategorie sagt
        // «Wachstumsaktien». Dieser Pfad wertete sie deshalb weiter wie Aktien.
        row.companyName,
      );

      // `stocks.score` ist ein Ganzzahlfeld; auf dieselbe Genauigkeit runden,
      // sonst meldet der Vergleich bei jedem Lauf eine Änderung.
      const neu = berechnet.totalScore === null ? null : Math.round(berechnet.totalScore);
      const alt = row.score ?? null;
      if (neu === alt) continue;

      await db.update(stocks).set({ score: neu }).where(eq(stocks.ticker, row.ticker));
      geaendert++;
      if (neu === null) aufNullGesetzt++;
    }

    bereitsGelaufen = true;
    console.log(
      `[ScoreAbdeckung] Backfill: ${rows.length} Titel geprüft, ${geaendert} geändert, ` +
      `davon ${aufNullGesetzt} mangels Datengrundlage auf «nicht beurteilbar» gesetzt.`,
    );
    return { geprueft: rows.length, geaendert, aufNullGesetzt, uebersprungen: false };
  } catch (e) {
    console.warn("[ScoreAbdeckung] Backfill fehlgeschlagen (non-fatal):", (e as Error).message);
    return leer;
  }
}

/** Nur für Tests. */
export function _sperreZuruecksetzen(): void {
  bereitsGelaufen = false;
}
