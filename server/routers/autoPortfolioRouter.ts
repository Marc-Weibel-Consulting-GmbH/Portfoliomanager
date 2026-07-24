import { randomUUID } from 'crypto';
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";

/**
 * F4: Automatischer Portfolio-Vorschlag (deterministisch + optimiert).
 *
 * Pipeline: Anlageprofil → DiversificationRules → Universum aus stocks
 * → Scoring (Signal 60 % / Fundamental 40 %, Momentum-Adjust) → Ranking
 * → Selektion mit Sektor-/FX-/Land+Sektor-Caps → optimizePortfolio
 * (max_sharpe | min_variance | max_dividend) → Fallback auf
 * Score-proportionale Gewichtung → Cash-Quote (liquidityNeedPct).
 *
 * Fehlerbild: bei < 2 Kandidaten klare Fehlermeldung (kein leeres Portfolio).
 */

// In-memory job store für async proposals (non-blocking, löst HTTP 524 Timeout)
interface ProposalJob {
  status: 'running' | 'enhancing' | 'done' | 'error';
  progress: string[];
  result: any | null;
  error: string | null;
  userId: number;
  startedAt: number;
}
const proposalJobs = new Map<string, ProposalJob>();

// Cleanup alter Jobs (älter als 1 Stunde)
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [id, job] of proposalJobs.entries()) {
    if (job.startedAt < oneHourAgo) proposalJobs.delete(id);
  }
}, 10 * 60 * 1000);

// Module-level imports (Markt-Hub, LLM helpers)
import { getMarktHubSignals, getSectorTilts, buildMarktHubContext, describeSectorTilts, type MarktHubSignals } from '../lib/marketHub';
import { getProposalModelConfig, invokeProposalAgent } from '../lib/llmProposal';

/** Faktor-Tilt: bevorzugt Titel des aktuell führenden MSCI-Faktors. */
function getFactorTilt(
  stock: { dividendYield: number | null; ytdPerf: number | null; signalScore: number; riskProfile: string; goal: string | null },
  factors: MarktHubSignals['factors'],
): number {
  if (!factors.leadingFactor) return 0;
  const tilt = stock.riskProfile === 'aggressiv' ? 3 : stock.riskProfile === 'konservativ' ? 1 : 2;
  switch (factors.leadingFactor) {
    case 'value':
      return (stock.dividendYield ?? 0) >= 2 ? tilt : 0;
    case 'momentum':
      return (stock.ytdPerf ?? 0) > 10 ? tilt : 0;
    case 'quality':
      return stock.signalScore >= 65 ? tilt : 0;
    case 'min_vol':
      return stock.riskProfile === 'konservativ' ? tilt : 0;
    default:
      return 0;
  }
}

/** Sektor-Tilt: +3/−3 je nach Markt-Hub-Sektor-Einschätzung. */
function getSectorTiltForStock(sector: string | null, tilts: Record<string, number>): number {
  if (!sector) return 0;
  const t = tilts[sector];
  if (t === 2) return 3;
  if (t === -2) return -3;
  return 0;
}

export const autoPortfolioRouter = router({
  buildProposal: protectedProcedure
    .input(z.object({ investmentAmount: z.number().positive().optional(), stocksOnly: z.boolean().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      const { requireFeature } = await import("../lib/entitlements");
      await requireFeature(ctx.user, "auto_portfolio");

      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new Error("Datenbank nicht verfügbar");

      const { eq, and, gte, asc } = await import("drizzle-orm");
      const { userInvestmentProfile, stocks: stocksTable, historicalPrices } = await import("../../drizzle/schema");

      // 0) Anlageprofil
      const [profile] = await db
        .select()
        .from(userInvestmentProfile)
        .where(eq(userInvestmentProfile.userId, ctx.user.id))
        .limit(1);
      if (!profile) {
        throw new Error("Kein Anlageprofil hinterlegt. Bitte legen Sie zuerst unter Einstellungen › Anlageprofil Ihr Risikoprofil und Ihre Anlageziele fest.");
      }
      const excludedSectors: string[] = (profile.excludedSectors as string[] | null) ?? [];
      const goal = profile.investmentGoal;
      const riskProfile = profile.riskProfile;
      const esgOnly = profile.esgOnly === 1;
      const liquidityNeedPct = profile.liquidityNeedPct ?? 0;
      const targetReturnPct = profile.targetReturnPct != null ? parseFloat(String(profile.targetReturnPct)) : null;
      const referenceCurrency: string = (profile.referenceCurrency as string | null) ?? "CHF";
      const maxFxExposurePct: number = profile.maxFxExposurePct != null
        ? parseFloat(String(profile.maxFxExposurePct))
        : riskProfile === "aggressiv" ? 80 : riskProfile === "konservativ" ? 40 : 60;

      // DiversificationRules (Admin-konfigurierbar)
      const { getDiversificationRules } = await import("../lib/diversificationRules");
      const rules = await getDiversificationRules();

      // Profil-abhängige Optimizer-Parameter
      const { optimizerParamsForProfile } = await import("../lib/profileOptimizerParams");
      const params = optimizerParamsForProfile(
        { riskProfile, maxDrawdownTolerancePct: profile.maxDrawdownTolerancePct, investmentHorizonYears: profile.investmentHorizonYears },
        rules,
      );

      // Markt-Hub-Signale (fehlertolerant — ohne Daten neutrale Werte)
      let marktHubSignals: MarktHubSignals;
      try {
        marktHubSignals = await getMarktHubSignals();
      } catch (mhErr: any) {
        console.warn('[buildProposal] Markt-Hub-Signale nicht verfügbar:', mhErr?.message);
        marktHubSignals = {
          macro: { yieldCurveSpread: null, coreCpi: null, fedFundsRate: null, dgs10: null, hySpread: null, chfUsd: null },
          regime: { regime: 'Neutral', overallScore: 0, equityAllocation: 60, regimeMultiplier: 1.0 },
          factors: { valueYtd: null, momentumYtd: null, qualityYtd: null, minVolYtd: null, leadingFactor: null },
          latestReportSummary: null,
          latestReportDate: null,
          hasData: false,
          fetchedAt: new Date().toISOString(),
        };
      }
      const sectorTilts = getSectorTilts(marktHubSignals);

      // Dynamischer risikofreier Zinssatz (SNB 3M SARON, Fallback UST 3M, sonst 1%)
      const { getRiskFreeRate } = await import("../lib/riskFreeRate");
      const dynamicRiskFreeRate = await getRiskFreeRate();

      // Watchlist-Empfehlungen (Ticker-Set für Bonus + Marktkap-Cap-Ausnahme)
      const watchlistRecs = await db
        .select({ ticker: stocksTable.ticker })
        .from(stocksTable)
        .where(eq(stocksTable.listType, "empfehlung"));
      const watchlistRecTickers = new Set(watchlistRecs.map((r: any) => r.ticker.toUpperCase()));

      const notes: string[] = [];
      if (esgOnly) {
        notes.push("Ihr ESG-Wunsch ist hinterlegt, kann aber noch nicht angewendet werden — für die Titel liegen keine ESG-Daten vor. Der Vorschlag ist NICHT ESG-gefiltert.");
      }

      let cachedPrices: CachedPriceEntry[] | null = null;