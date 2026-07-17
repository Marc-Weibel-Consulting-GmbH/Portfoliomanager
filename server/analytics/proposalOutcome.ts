/**
 * K9 (Learning-Koordination): nachträgliche Erfolgsmessung der Auto-Portfolio-
 * Vorschläge — der bislang fehlende Baustein der Lernschleife. buildProposal
 * loggt erwartete Kennzahlen (portfolioProposalLog); hier wird 30 Tage später
 * gemessen, was die vorgeschlagenen Gewichte REAL gebracht hätten:
 *
 *   realizedReturn30d  = Σ Gewicht × CHF-Return des Titels über 30 Tage
 *   benchmarkReturn30d = SMI über dasselbe Fenster (dieselbe Quelle wie die
 *                        Signal-Evaluation: getBenchmarkData("SMI"))
 *   realizedAlpha30d   = Differenz
 *
 * Ehrlichkeits-Grenzen:
 *  - CHF-Sicht: Lokal-Returns werden mit dem FX-Return der Titelwährung über
 *    dasselbe Fenster kombiniert ((1+r_lokal)·(1+r_fx)−1) — GBp zählt als GBP
 *    (skaleninvariant).
 *  - Deckt die Kursabdeckung < 70 % des Vorschlags-Gewichts, wird NICHT
 *    bewertet (kein Ergebnis aus Restbeständen hochgerechnet); die erreichte
 *    Abdeckung wird immer mitgespeichert (outcomeCoveragePct).
 *  - Reine Messung/Transparenz — es werden KEINE Parameter automatisch
 *    angepasst (bewusst: erst Track-Record aufbauen, dann ggf. rückkoppeln).
 */
import { computeWindowReturn, type DailyClose } from "../lib/signals/benchmarkAlpha";

export interface PositionReturn {
  weightPct: number;
  /** CHF-Return über das Fenster als Dezimalbruch, null = keine Kursdaten. */
  chfReturn: number | null;
}

/**
 * Gewichteter Portfolio-Return aus Positions-Returns (pure, getestet).
 * Renormalisiert auf das abgedeckte Gewicht; null, wenn die Abdeckung unter
 * minCoveragePct liegt (Ergebnis wäre eine Hochrechnung aus Restbeständen).
 */
export function aggregateProposalReturn(
  positions: PositionReturn[],
  minCoveragePct = 70
): { portfolioReturn: number; coveragePct: number } | null {
  const totalWeight = positions.reduce((s, p) => s + Math.max(0, p.weightPct), 0);
  if (totalWeight <= 0) return null;
  let coveredWeight = 0;
  let weightedReturn = 0;
  for (const p of positions) {
    if (p.chfReturn === null || !Number.isFinite(p.chfReturn) || p.weightPct <= 0) continue;
    coveredWeight += p.weightPct;
    weightedReturn += p.weightPct * p.chfReturn;
  }
  const coveragePct = (coveredWeight / totalWeight) * 100;
  if (coveragePct < minCoveragePct) return null;
  return {
    portfolioReturn: weightedReturn / coveredWeight,
    coveragePct: Math.round(coveragePct * 100) / 100,
  };
}

const EVAL_WINDOW_DAYS = 30;
/** Puffer, damit das 30-Tage-Fenster sicher mit Kursen gefüllt ist. */
const MIN_AGE_DAYS = 32;

/**
 * Wertet offene Vorschläge aus (Alter ≥ 32 Tage, noch ohne Ergebnis).
 * Non-fatal; gibt eine kompakte Bilanz zurück (für Cron-Log/Admin-Trigger).
 */
export async function evaluateProposalOutcomes(
  limit = 25
): Promise<{ evaluated: number; skipped: number; reason?: string }> {
  const { getDb } = await import("../db");
  const db = await getDb();
  if (!db) return { evaluated: 0, skipped: 0, reason: "no-db" };

  const { portfolioProposalLog, historicalPrices } = await import("../../drizzle/schema");
  const { and, isNull, lte, eq, gte, inArray, sql } = await import("drizzle-orm");
  const { tryGetFxRate } = await import("../fxHelper");
  const { getBenchmarkData } = await import("../db");

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - MIN_AGE_DAYS);

  const pending = await db
    .select({
      id: portfolioProposalLog.id,
      createdAt: portfolioProposalLog.createdAt,
      positions: portfolioProposalLog.positions,
    })
    .from(portfolioProposalLog)
    .where(and(isNull(portfolioProposalLog.outcomeEvaluatedAt), lte(portfolioProposalLog.createdAt, cutoff)))
    .limit(limit);

  if (pending.length === 0) return { evaluated: 0, skipped: 0 };

  let evaluated = 0;
  let skipped = 0;

  for (const proposal of pending) {
    try {
      const startDate = new Date(proposal.createdAt).toISOString().slice(0, 10);
      const end = new Date(proposal.createdAt);
      end.setDate(end.getDate() + EVAL_WINDOW_DAYS);
      const endDate = end.toISOString().slice(0, 10);
      // Fenster für Kursabfrage: 7 Tage Vorlauf für den Startkurs.
      const fetchStart = new Date(proposal.createdAt);
      fetchStart.setDate(fetchStart.getDate() - 7);
      const fetchStartStr = fetchStart.toISOString().slice(0, 10);

      const rawPositions = Array.isArray(proposal.positions) ? (proposal.positions as any[]) : [];
      const posInputs = rawPositions
        .filter((p) => p?.ticker && Number.isFinite(parseFloat(String(p.weightPct))))
        .map((p) => ({
          ticker: String(p.ticker),
          weightPct: parseFloat(String(p.weightPct)),
          currency: String(p.currency || "CHF") === "GBp" ? "GBP" : String(p.currency || "CHF"),
        }));
      if (posInputs.length === 0) {
        // Kein auswertbares Positions-JSON — als ausgewertet markieren (0 %-
        // Abdeckung), damit der Cron nicht ewig an derselben Zeile hängt.
        await db.update(portfolioProposalLog)
          .set({ outcomeCoveragePct: "0.00" as any, outcomeEvaluatedAt: new Date() })
          .where(eq(portfolioProposalLog.id, proposal.id));
        skipped++;
        continue;
      }

      // Kursreihen für alle Ticker des Vorschlags in einem Query.
      const tickers = [...new Set(posInputs.map((p) => p.ticker))];
      const priceRows = await db
        .select({ ticker: historicalPrices.ticker, date: historicalPrices.date, close: sql<string>`COALESCE(${historicalPrices.adjustedClose}, ${historicalPrices.close})` })
        .from(historicalPrices)
        .where(and(
          inArray(historicalPrices.ticker, tickers),
          gte(historicalPrices.date, fetchStartStr),
          lte(historicalPrices.date, endDate),
        ));
      const rowsByTicker = new Map<string, DailyClose[]>();
      for (const r of priceRows) {
        if (!rowsByTicker.has(r.ticker)) rowsByTicker.set(r.ticker, []);
        rowsByTicker.get(r.ticker)!.push({ date: r.date, close: r.close });
      }

      // FX-Return je Währung über dasselbe Fenster (Endpunkt-genau).
      const fxReturnByCurrency = new Map<string, number | null>();
      for (const cur of new Set(posInputs.map((p) => p.currency))) {
        if (cur === "CHF") { fxReturnByCurrency.set(cur, 0); continue; }
        const fxStart = await tryGetFxRate(startDate, `${cur}CHF`);
        const fxEnd = await tryGetFxRate(endDate, `${cur}CHF`);
        fxReturnByCurrency.set(
          cur,
          fxStart != null && fxEnd != null && fxStart > 0 ? fxEnd / fxStart - 1 : null
        );
      }

      const positionReturns: PositionReturn[] = posInputs.map((p) => {
        const localReturn = computeWindowReturn(rowsByTicker.get(p.ticker) ?? [], startDate, endDate);
        const fxReturn = fxReturnByCurrency.get(p.currency) ?? null;
        const chfReturn = localReturn !== null && fxReturn !== null
          ? (1 + localReturn) * (1 + fxReturn) - 1
          : null;
        return { weightPct: p.weightPct, chfReturn };
      });

      const agg = aggregateProposalReturn(positionReturns);

      // Benchmark: SMI — dieselbe Quelle wie die Signal-Evaluation.
      let benchmarkReturn: number | null = null;
      try {
        const benchRows = (await getBenchmarkData("SMI", fetchStartStr, endDate)).map((r: any) => ({
          date: r.date,
          close: r.close,
        }));
        benchmarkReturn = computeWindowReturn(benchRows, startDate, endDate);
      } catch (e: any) {
        console.warn(`[proposalOutcome] Benchmark nicht verfügbar: ${e?.message}`);
      }

      if (!agg) {
        // Zu wenig Kursabdeckung — Abdeckung speichern, Bewertung offen lassen
        // (wird beim nächsten Lauf erneut versucht, z. B. nach Preis-Backfill).
        const coverage = aggregateProposalReturn(positionReturns, 0)?.coveragePct ?? 0;
        console.log(`[proposalOutcome] Vorschlag ${proposal.id}: Abdeckung ${coverage.toFixed(0)} % < 70 % — nicht bewertet.`);
        skipped++;
        continue;
      }

      const alpha = benchmarkReturn !== null ? agg.portfolioReturn - benchmarkReturn : null;
      await db.update(portfolioProposalLog)
        .set({
          realizedReturn30dPct: (agg.portfolioReturn * 100).toFixed(2) as any,
          benchmarkReturn30dPct: benchmarkReturn !== null ? (benchmarkReturn * 100).toFixed(2) as any : null,
          realizedAlpha30dPct: alpha !== null ? (alpha * 100).toFixed(2) as any : null,
          outcomeCoveragePct: agg.coveragePct.toFixed(2) as any,
          outcomeEvaluatedAt: new Date(),
        })
        .where(eq(portfolioProposalLog.id, proposal.id));
      evaluated++;
    } catch (e: any) {
      console.error(`[proposalOutcome] Vorschlag ${proposal.id} fehlgeschlagen:`, e?.message);
      skipped++;
    }
  }

  console.log(`[proposalOutcome] ${evaluated} Vorschläge bewertet, ${skipped} übersprungen.`);
  return { evaluated, skipped };
}
