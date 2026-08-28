import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { kiBoomDynamicMetrics, researchDeskEvidence, researchDeskRuns, stocks } from "../../drizzle/schema";
import { getDb } from "../db";
import { curated } from "../lib/stockUniverse";
import { buildAiCapitalCycleAssessment } from "../lib/aiCapitalCycleWatchlist";
import { runResearchDeskShadow } from "../lib/researchDeskService";
import { adminProcedure, router } from "../_core/trpc";

const checkerStatusSchema = z.enum(["pending", "reviewed", "rejected"]);

/**
 * Ausschliesslich administrativer Vertrag für den beobachtenden Research Desk.
 * Er liefert Quellen-Evidenz und erlaubt menschliche Triage, berührt jedoch
 * keine Score-, Optimierungs- oder Handelsdaten.
 */
export const researchDeskRouter = router({
  overview: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(250).default(100) }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { runs: [], evidence: [] };
      const limit = input?.limit ?? 100;
      const [runs, evidence] = await Promise.all([
        db.select().from(researchDeskRuns).orderBy(desc(researchDeskRuns.startedAt)).limit(30),
        db.select().from(researchDeskEvidence)
          .orderBy(desc(researchDeskEvidence.sourcePublishedAt), desc(researchDeskEvidence.fetchedAt))
          .limit(limit),
      ]);
      return { runs, evidence };
    }),

  /**
   * Beobachtender Abgleich der kuratierten Watchlist mit dem vorhandenen
   * AI-Capital-Cycle-Monitoring und SEC-Shadow-Evidenz. Der Endpunkt ist ein
   * Read-Model: Es gibt weder eine Score-/Signal- noch eine Handelsmutation.
   */
  capitalCycleWatchlistOverview: adminProcedure.query(async () => {
    const db = await getDb();
    const now = new Date();
    if (!db) {
      return {
        generatedAt: now,
        decisionImpact: "none" as const,
        isShadowMode: true,
        monitoring: {
          cacheStatus: "nicht_verfuegbar" as const,
          disclosure: "Keine Datenbankverbindung. Es werden keine Handlungshinweise abgeleitet.",
          metrics: [],
        },
        summary: { total: 0, relevant: 0, manualReview: 0, dataCheck: 0 },
        assessments: [],
      };
    }

    const [watchlist, metricRows, evidenceRows] = await Promise.all([
      db.select({
        id: stocks.id,
        ticker: stocks.ticker,
        companyName: stocks.companyName,
        sector: stocks.sector,
        listType: stocks.listType,
        dataQualityStatus: stocks.dataQualityStatus,
        dataQualityNotes: stocks.dataQualityNotes,
        dataQualityUpdatedAt: stocks.dataQualityUpdatedAt,
      })
        .from(stocks)
        .where(curated())
        .orderBy(desc(stocks.signalScore), stocks.ticker),
      db.select()
        .from(kiBoomDynamicMetrics)
        .orderBy(desc(kiBoomDynamicMetrics.fetchedAt))
        .limit(250),
      db.select()
        .from(researchDeskEvidence)
        .where(eq(researchDeskEvidence.isShadowMode, 1))
        .orderBy(desc(researchDeskEvidence.sourcePublishedAt), desc(researchDeskEvidence.fetchedAt))
        .limit(500),
    ]);

    // Pro Metrik nur der zuletzt gespeicherte Cachewert. Der Cache ist eine
    // globale Monitoringquelle, keine Primärquelle für eine Einzeltitelthese.
    const latestByMetric = new Map<string, typeof metricRows[number]>();
    for (const row of metricRows) {
      if (!latestByMetric.has(row.metricKey)) latestByMetric.set(row.metricKey, row);
    }
    const metrics = [...latestByMetric.values()].map((row) => ({
      metricKey: row.metricKey,
      displayValue: row.displayValue ?? "Keine Angabe",
      source: row.source ?? "Quelle nicht angegeben",
      fetchedAt: row.fetchedAt,
    }));

    const normalizedEvidence = evidenceRows.map((evidence) => ({
      ticker: evidence.ticker,
      formType: evidence.formType,
      sourceUrl: evidence.sourceUrl,
      sourcePublishedAt: evidence.sourcePublishedAt,
      completenessStatus: evidence.completenessStatus,
      checkerStatus: evidence.checkerStatus,
    }));
    const assessments = watchlist.map((stock) => {
      const assessment = buildAiCapitalCycleAssessment({
        ticker: stock.ticker,
        companyName: stock.companyName,
        sector: stock.sector,
        now,
        metrics,
        evidence: normalizedEvidence,
      });
      return {
        watchlistStockId: stock.id,
        companyName: stock.companyName,
        listType: stock.listType,
        dataQuality: {
          status: stock.dataQualityStatus ?? "unbekannt",
          notes: stock.dataQualityNotes,
          updatedAt: stock.dataQualityUpdatedAt,
        },
        ...assessment,
      };
    });

    const relevant = assessments.filter((item) => item.role !== "nicht_zugeordnet");
    return {
      generatedAt: now,
      decisionImpact: "none" as const,
      isShadowMode: true,
      monitoring: {
        cacheStatus: metrics.length > 0 ? "vorhanden" as const : "fehlt" as const,
        disclosure: "Globale AI-Capital-Cycle-Metriken stammen aus dem vorhandenen Cache mit Quellenangabe. Sie sind keine issuer-spezifischen SEC-Fakten und ersetzen keine Einzelwertprüfung.",
        metrics,
      },
      summary: {
        total: assessments.length,
        relevant: relevant.length,
        manualReview: assessments.filter((item) => item.manualAction === "manuell_pruefen").length,
        dataCheck: assessments.filter((item) => item.monitoringStatus === "daten_pruefen").length,
      },
      assessments,
    };
  }),

  runShadowNow: adminProcedure.mutation(async () => runResearchDeskShadow()),

  setCheckerStatus: adminProcedure
    .input(z.object({ evidenceId: z.number().int().positive(), status: checkerStatusSchema }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const result = await db.update(researchDeskEvidence)
        .set({ checkerStatus: input.status })
        .where(and(eq(researchDeskEvidence.id, input.evidenceId), eq(researchDeskEvidence.isShadowMode, 1)));
      const affectedRows = Number((Array.isArray(result) ? result[0] : result)?.affectedRows ?? 0);
      if (affectedRows !== 1) throw new Error("Shadow-Evidenz nicht gefunden");
      return { success: true };
    }),
});
