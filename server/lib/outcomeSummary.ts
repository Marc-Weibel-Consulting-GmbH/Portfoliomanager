/**
 * Einheitlicher Outcome-Überblick (KIMI-Audit 3.6, Variante a).
 *
 * Statt die vier Erfolgsmess-Tabellen (jede mit eigenem Schema und
 * Lebenszyklus) physisch zu einer zusammenzuführen, liefert dieser Helfer eine
 * gemeinsame *Sicht*: pro Quelle dieselben Kennzahlen (bewertet, Trefferquote,
 * Ø Alpha). Die «Treffer»-Definition und die Alpha-Einheit unterscheiden sich
 * je Quelle — hier zentral, dokumentiert und vergleichbar aufbereitet.
 *
 * Alpha-Einheit: signal_history & combined_score_history speichern alphaPct als
 * Bruch (→ ×100); portfolioProposalLog.realizedAlpha30dPct ist bereits Prozent.
 * copilotHistory trackt kein Alpha/Benchmark → avgAlphaPct = null.
 */

export interface OutcomeSummary {
  key: string;
  label: string;
  evaluated: number;          // Anzahl bewerteter Einträge
  hitRatePct: number | null;  // Trefferquote in %
  avgAlphaPct: number | null;  // Ø Alpha in %-Punkten (null wenn nicht getrackt)
  hitDefinition: string;      // wie «Treffer» je Quelle definiert ist
}

export async function summarizeOutcomes(): Promise<OutcomeSummary[]> {
  const { getDb } = await import("../db");
  const { signalHistory, combinedScoreHistory, copilotHistory, portfolioProposalLog } = await import("../../drizzle/schema");
  const { sql, isNotNull } = await import("drizzle-orm");
  const db = await getDb();
  if (!db) return [];

  const pct = (correct: number, total: number): number | null => (total > 0 ? (correct / total) * 100 : null);
  const out: OutcomeSummary[] = [];

  // 1. Stack B — signal_history (directionCorrect; alphaPct als Bruch)
  try {
    const r = (await db.select({
      evaluated: sql<number>`SUM(CASE WHEN ${signalHistory.evaluatedAt} IS NOT NULL THEN 1 ELSE 0 END)`,
      dirN: sql<number>`SUM(CASE WHEN ${signalHistory.directionCorrect} IS NOT NULL THEN 1 ELSE 0 END)`,
      dirCorrect: sql<number>`SUM(CASE WHEN ${signalHistory.directionCorrect} = 1 THEN 1 ELSE 0 END)`,
      avgAlpha: sql<number>`AVG(${signalHistory.alphaPct})`,
    }).from(signalHistory))[0] ?? ({} as any);
    out.push({
      key: "signal_history", label: "Signal-Engines (Stack B)",
      evaluated: Number(r.evaluated ?? 0),
      hitRatePct: pct(Number(r.dirCorrect ?? 0), Number(r.dirN ?? 0)),
      avgAlphaPct: r.avgAlpha != null && Number.isFinite(Number(r.avgAlpha)) ? Number(r.avgAlpha) * 100 : null,
      hitDefinition: "Richtung korrekt (Kauf→Return>0, Verkauf→Return<0) vs. SMI",
    });
  } catch { /* Tabelle fehlt → auslassen */ }

  // 2. Stack A — combined_score_history (directionCorrect; alphaPct als Bruch)
  try {
    const r = (await db.select({
      evaluated: sql<number>`SUM(CASE WHEN ${combinedScoreHistory.evaluatedAt} IS NOT NULL THEN 1 ELSE 0 END)`,
      dirN: sql<number>`SUM(CASE WHEN ${combinedScoreHistory.directionCorrect} IS NOT NULL THEN 1 ELSE 0 END)`,
      dirCorrect: sql<number>`SUM(CASE WHEN ${combinedScoreHistory.directionCorrect} = 1 THEN 1 ELSE 0 END)`,
      avgAlpha: sql<number>`AVG(${combinedScoreHistory.alphaPct})`,
    }).from(combinedScoreHistory))[0] ?? ({} as any);
    out.push({
      key: "combined_score_history", label: "Combined Score (Stack A, nutzersichtbar)",
      evaluated: Number(r.evaluated ?? 0),
      hitRatePct: pct(Number(r.dirCorrect ?? 0), Number(r.dirN ?? 0)),
      avgAlphaPct: r.avgAlpha != null && Number.isFinite(Number(r.avgAlpha)) ? Number(r.avgAlpha) * 100 : null,
      hitDefinition: "Richtung korrekt (buy→Return>0, sell→Return<0) vs. SMI",
    });
  } catch { /* Tabelle evtl. noch nicht angelegt */ }

  // 3. Copilot — copilotHistory (wasCorrect30d; kein Alpha)
  try {
    const r = (await db.select({
      n: sql<number>`SUM(CASE WHEN ${copilotHistory.wasCorrect30d} IS NOT NULL THEN 1 ELSE 0 END)`,
      correct: sql<number>`SUM(CASE WHEN ${copilotHistory.wasCorrect30d} = 1 THEN 1 ELSE 0 END)`,
    }).from(copilotHistory))[0] ?? ({} as any);
    out.push({
      key: "copilot_history", label: "Copilot-Empfehlungen",
      evaluated: Number(r.n ?? 0),
      hitRatePct: pct(Number(r.correct ?? 0), Number(r.n ?? 0)),
      avgAlphaPct: null,
      hitDefinition: "wasCorrect30d (kein Benchmark/Alpha getrackt)",
    });
  } catch { /* auslassen */ }

  // 4. KI-Portfolio-Vorschläge — portfolioProposalLog (Alpha>0 = Treffer; Prozent)
  try {
    const r = (await db.select({
      evaluated: sql<number>`SUM(CASE WHEN ${portfolioProposalLog.outcomeEvaluatedAt} IS NOT NULL THEN 1 ELSE 0 END)`,
      alphaN: sql<number>`SUM(CASE WHEN ${portfolioProposalLog.realizedAlpha30dPct} IS NOT NULL THEN 1 ELSE 0 END)`,
      alphaPos: sql<number>`SUM(CASE WHEN ${portfolioProposalLog.realizedAlpha30dPct} > 0 THEN 1 ELSE 0 END)`,
      avgAlpha: sql<number>`AVG(${portfolioProposalLog.realizedAlpha30dPct})`,
    }).from(portfolioProposalLog).where(isNotNull(portfolioProposalLog.outcomeEvaluatedAt)))[0] ?? ({} as any);
    out.push({
      key: "portfolio_proposal_log", label: "KI-Portfolio-Vorschläge",
      evaluated: Number(r.evaluated ?? 0),
      hitRatePct: pct(Number(r.alphaPos ?? 0), Number(r.alphaN ?? 0)),
      avgAlphaPct: r.avgAlpha != null && Number.isFinite(Number(r.avgAlpha)) ? Number(r.avgAlpha) : null,
      hitDefinition: "realisiertes 30-Tage-Alpha > 0 (SMI geschlagen)",
    });
  } catch { /* auslassen */ }

  return out;
}
