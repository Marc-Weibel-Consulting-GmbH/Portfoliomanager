/**
 * Sektor-Rotation als Dienst: holt die Kursreihen der US-Sektor-ETFs und des
 * Benchmarks von EODHD, rechnet die RRG-Punkte (`rrg.ts`, rein und getestet)
 * und zeichnet den Stand TÄGLICH in `rrg_verlauf` auf.
 *
 * Die Aufzeichnung ist der eigentliche Zweck: Sie baut die Vorwärtsreihe auf,
 * an der sich später messen lässt, ob die Rotation etwas vorhersagt — BEVOR
 * sie irgendwo Gewichte bewegt (STRATEGIE_DREI_SCORES.md, Regel 1). Bis dahin
 * ist die Karte im Markt-Hub reine Anzeige.
 *
 * Sektor-ETFs statt Indizes, weil ihre Kursreihen auf EODHD zuverlässig
 * vorliegen; Benchmark ist SPY (S&P 500) — derselbe Massstab wie im
 * Vorbild-Diagramm (RRG vs. SPY).
 */

import { ENV } from "../_core/env";
import { apiCache, CACHE_TTL } from "../_core/apiCache";
import { rrgReihe, quadrant, QUADRANT_LABELS, SPUR_LAENGE, type KursPunkt, type RrgPunkt, type RrgQuadrant } from "./rrg";

const EODHD_BASE_URL = "https://eodhd.com/api";

/** US-Sektor-ETFs (SPDR) gegen SPY — Sektornamen wie in der `stocks`-Tabelle. */
export const RRG_SEKTOREN: Array<{ sektor: string; etf: string }> = [
  { sektor: "Technology", etf: "XLK.US" },
  { sektor: "Financial Services", etf: "XLF.US" },
  { sektor: "Healthcare", etf: "XLV.US" },
  { sektor: "Energy", etf: "XLE.US" },
  { sektor: "Industrials", etf: "XLI.US" },
  { sektor: "Consumer Defensive", etf: "XLP.US" },
  { sektor: "Consumer Cyclical", etf: "XLY.US" },
  { sektor: "Utilities", etf: "XLU.US" },
  { sektor: "Basic Materials", etf: "XLB.US" },
  { sektor: "Real Estate", etf: "XLRE.US" },
  { sektor: "Communication Services", etf: "XLC.US" },
];

export const RRG_BENCHMARK = "SPY.US";

/** ~15 Monate Tagesdaten: 26 Wochen Fenster + 4 Wochen Momentum + Spur + Reserve. */
const ABRUF_KALENDERTAGE = 460;

export interface RrgSektorStand {
  sektor: string;
  etf: string;
  rsRatio: number;
  rsMomentum: number;
  quadrant: RrgQuadrant;
  quadrantLabel: string;
  /** Die letzten Wochenpunkte (älteste zuerst) — die Spur im Diagramm. */
  spur: RrgPunkt[];
}

export interface RrgStand {
  benchmark: string;
  stand: string; // Datum des jüngsten Punkts
  sektoren: RrgSektorStand[];
  /** Sektoren ohne ausreichende Kursreihe — ehrlich ausweisen statt weglassen. */
  fehlend: string[];
}

async function holeEodReihe(ticker: string): Promise<KursPunkt[]> {
  const apiKey = ENV.eodhdApiKey;
  if (!apiKey) return [];
  const von = new Date(Date.now() - ABRUF_KALENDERTAGE * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const bis = new Date().toISOString().slice(0, 10);
  try {
    const url = `${EODHD_BASE_URL}/eod/${ticker}?api_token=${apiKey}&from=${von}&to=${bis}&fmt=json&period=d`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json() as Array<{ date: string; close: number; adjusted_close?: number }>;
    if (!Array.isArray(data)) return [];
    return data
      .map((d) => ({ date: d.date, close: Number(d.adjusted_close ?? d.close) }))
      .filter((p) => Number.isFinite(p.close) && p.close > 0);
  } catch {
    return [];
  }
}

/**
 * Aktueller RRG-Stand über alle Sektoren, 6 h gecacht (Tagesdaten — öfter
 * rechnen ändert nichts, nur die EODHD-Abrufe würden sich vervielfachen).
 */
export async function rrgStand(): Promise<RrgStand> {
  const cacheKey = "rrg:stand";
  const imCache = apiCache.get<RrgStand>(cacheKey);
  if (imCache) return imCache;

  const benchmark = await holeEodReihe(RRG_BENCHMARK);
  const sektoren: RrgSektorStand[] = [];
  const fehlend: string[] = [];

  if (benchmark.length === 0) {
    return { benchmark: RRG_BENCHMARK, stand: "", sektoren, fehlend: RRG_SEKTOREN.map((s) => s.sektor) };
  }

  for (const s of RRG_SEKTOREN) {
    const reihe = await holeEodReihe(s.etf);
    const punkte = rrgReihe(reihe, benchmark);
    if (punkte.length === 0) {
      fehlend.push(s.sektor);
      continue;
    }
    const letzter = punkte.at(-1)!;
    sektoren.push({
      sektor: s.sektor,
      etf: s.etf,
      rsRatio: letzter.rsRatio,
      rsMomentum: letzter.rsMomentum,
      quadrant: quadrant(letzter),
      quadrantLabel: QUADRANT_LABELS[quadrant(letzter)],
      spur: punkte.slice(-SPUR_LAENGE),
    });
  }

  const stand: RrgStand = {
    benchmark: RRG_BENCHMARK,
    stand: sektoren.map((s) => s.spur.at(-1)?.datum ?? "").sort().at(-1) ?? "",
    sektoren,
    fehlend,
  };

  // Nur ein brauchbares Ergebnis cachen — ein Ausfall soll sich nicht 6 h halten.
  if (sektoren.length > 0) {
    apiCache.set(cacheKey, stand, 6 * 60 * 60 * 1000);
    // Vorwärtsreihe fortschreiben — non-fatal, die Anzeige hängt nicht daran.
    try { await zeichneAuf(stand); } catch (e) {
      console.warn("[RRG] Aufzeichnung fehlgeschlagen:", (e as Error).message);
    }
  }
  return stand;
}

let tabelleGeprueft = false;

/**
 * Tageszeile je Sektor in `rrg_verlauf` (selbstheilend angelegt — der Deploy
 * führt keine Migrationen aus). INSERT IGNORE: Der erste Aufruf des Tages
 * schreibt, weitere ändern nichts — egal ob er vom täglichen Snapshot-Lauf
 * oder von einem Seitenaufruf kommt.
 */
export async function zeichneAuf(stand: RrgStand): Promise<void> {
  const { getDb } = await import("../db");
  const db = await getDb();
  if (!db) return;
  const { sql } = await import("drizzle-orm");

  if (!tabelleGeprueft) {
    await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS \`rrg_verlauf\` (
      \`datum\` varchar(10) NOT NULL,
      \`sektor\` varchar(64) NOT NULL,
      \`rsRatio\` decimal(8,2),
      \`rsMomentum\` decimal(8,2),
      \`quadrant\` varchar(16),
      PRIMARY KEY (\`datum\`, \`sektor\`)
    )`));
    tabelleGeprueft = true;
  }

  const heute = new Date().toISOString().slice(0, 10);
  for (const s of stand.sektoren) {
    await db.execute(sql`
      INSERT IGNORE INTO rrg_verlauf (datum, sektor, rsRatio, rsMomentum, quadrant)
      VALUES (${heute}, ${s.sektor}, ${s.rsRatio}, ${s.rsMomentum}, ${s.quadrant})`);
  }
}
