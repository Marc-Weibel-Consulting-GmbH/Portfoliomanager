/**
 * Projektleiter-Cockpit (K11, design/KONSOLIDIERUNG_RECHENWERKE.md).
 *
 * EIN Lagebild für den Betreiber: Datenqualität des Universums (K9-Ampel je
 * Titel, hier aggregiert), offene Lern-Vorschläge der Lernwerkstatt
 * (ML-Kandidaten aus K1, Gewichts-Vorschläge des Feedback-Loops aus K1) —
 * reine Auskunft, keine Aktion. Dieselbe Funktion speist die wöchentliche
 * Cockpit-Meldung (learningCron), damit Seite und Meldung nie auseinanderlaufen.
 */
import { titelDatenstatus, type TitelDatenstatus } from "./titelDatenstatus";

export interface CockpitLage {
  titel: {
    gesamt: number;
    vollstaendig: number;
    lueckenhaft: number;
    veraltet: number;
    /** Bis zu 10 Problem-Titel mit Gründen (lückenhaft zuerst). */
    problemTitel: Array<{ ticker: string; status: string; gruende: string[] }>;
  };
  lernwerkstatt: {
    /** ML-Modelle im Kandidaten-Status (warten auf manuelle Aktivierung, K1). */
    mlKandidaten: number;
    /** Jüngste Gewichts-Vorschläge des Feedback-Loops (nur Bericht, K1). */
    tuningVorschlaege: Array<{ erstellt: string; rationale: string }>;
    /** Offene Vorschläge des Variations-Loops (K13) — warten auf den Entscheid. */
    variationsVorschlaege: number;
  };
}

/** Aggregiert die K9-Ampel über das kuratierte Universum + offene Lern-Vorschläge. */
export async function ermittleCockpitLage(): Promise<CockpitLage> {
  const { getDb } = await import("../db");
  const db = await getDb();
  const leer: CockpitLage = {
    titel: { gesamt: 0, vollstaendig: 0, lueckenhaft: 0, veraltet: 0, problemTitel: [] },
    lernwerkstatt: { mlKandidaten: 0, tuningVorschlaege: [], variationsVorschlaege: 0 },
  };
  if (!db) return leer;

  const { stocks, historicalPrices, modelArtifacts, algoTuningLog } = await import("../../drizzle/schema");
  const { activeCurated } = await import("./stockUniverse");
  const { leseScores } = await import("./dreiScoresStore");
  const { sql, inArray, eq, desc, like } = await import("drizzle-orm");

  const rows = await db
    .select({ ticker: stocks.ticker, lastMetricsUpdate: stocks.lastMetricsUpdate })
    .from(stocks)
    .where(activeCurated());
  const tickers = rows.map((r) => r.ticker).filter(Boolean) as string[];

  const statusJeTitel = new Map<string, TitelDatenstatus>();
  if (tickers.length > 0) {
    const kursZeilen = await db
      .select({
        ticker: historicalPrices.ticker,
        tage: sql<number>`COUNT(*)`,
        letzter: sql<string>`MAX(${historicalPrices.date})`,
      })
      .from(historicalPrices)
      .where(inArray(historicalPrices.ticker, tickers))
      .groupBy(historicalPrices.ticker);
    const kursMap = new Map(kursZeilen.map((k) => [k.ticker, k]));
    const scoreMap = await leseScores(tickers);
    const heute = new Date();
    for (const r of rows) {
      const kurs = kursMap.get(r.ticker);
      const score = scoreMap.get(r.ticker);
      statusJeTitel.set(
        r.ticker,
        titelDatenstatus({
          kursTage: Number(kurs?.tage ?? 0),
          letzterKursTag: kurs?.letzter ?? null,
          letzteKennzahlen: r.lastMetricsUpdate ?? null,
          hatQualitaet: score?.qualitaet != null,
          hatTiming: score?.timing != null,
          heute,
        }),
      );
    }
  }

  const zaehle = (s: string) => [...statusJeTitel.values()].filter((v) => v.status === s).length;
  const problemTitel = [...statusJeTitel.entries()]
    .filter(([, v]) => v.status !== "vollstaendig")
    .sort(([, a], [, b]) => (a.status === "lueckenhaft" ? -1 : 1) - (b.status === "lueckenhaft" ? -1 : 1))
    .slice(0, 10)
    .map(([ticker, v]) => ({ ticker, status: v.status, gruende: v.gruende }));

  let mlKandidaten = 0;
  try {
    const kand = await db
      .select({ n: sql<number>`COUNT(*)` })
      .from(modelArtifacts)
      .where(eq(modelArtifacts.status, "candidate"));
    mlKandidaten = Number(kand[0]?.n ?? 0);
  } catch { /* Tabelle evtl. leer/fehlend — Cockpit bleibt auskunftsfähig */ }

  let tuningVorschlaege: Array<{ erstellt: string; rationale: string }> = [];
  try {
    const logs = await db
      .select({ createdAt: algoTuningLog.createdAt, rationale: algoTuningLog.rationale })
      .from(algoTuningLog)
      .where(like(algoTuningLog.toVersion, "vorschlag-%"))
      .orderBy(desc(algoTuningLog.createdAt))
      .limit(5);
    tuningVorschlaege = logs.map((l) => ({
      erstellt: l.createdAt ? new Date(l.createdAt as any).toISOString() : "",
      rationale: String(l.rationale ?? ""),
    }));
  } catch { /* dito */ }

  let variationsVorschlaege = 0;
  try {
    const { zaehleOffeneVorschlaege } = await import("./variationsLedger");
    variationsVorschlaege = await zaehleOffeneVorschlaege();
  } catch { /* dito */ }

  return {
    titel: {
      gesamt: statusJeTitel.size,
      vollstaendig: zaehle("vollstaendig"),
      lueckenhaft: zaehle("lueckenhaft"),
      veraltet: zaehle("veraltet"),
      problemTitel,
    },
    lernwerkstatt: { mlKandidaten, tuningVorschlaege, variationsVorschlaege },
  };
}
