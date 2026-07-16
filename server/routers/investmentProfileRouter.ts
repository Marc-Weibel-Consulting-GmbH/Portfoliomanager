/**
 * Anlageprofil (Konzept «Optimierung & Empfehlungen», Stufe F1).
 * Risikoprofil + Anlageziele pro Nutzer — Grundlage für Optimizer/Empfehlungen und
 * das Gating der automatischen Portfolio-Erstellung. Ownership über ctx.user.id.
 */
import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { userInvestmentProfile, investorProfileAssessment, savedPortfolios, stocks as stocksTable } from "../../drizzle/schema";
import { eq, inArray } from "drizzle-orm";
import {
  evaluateProfile,
  deriveActiveProfile,
  type ProfileAnswers,
} from "../lib/investorProfileScoring";
import { invokeLLM } from "../_core/llm";

// ── Profil-Mismatch-Erkennung ─────────────────────────────────────────────────

type RiskProfile = "konservativ" | "ausgewogen" | "wachstum" | "aggressiv";

const RISK_RANK: Record<RiskProfile, number> = {
  konservativ: 0,
  ausgewogen: 1,
  wachstum: 2,
  aggressiv: 3,
};

interface PortfolioMismatch {
  portfolioId: number;
  portfolioName: string;
  reasons: string[];
  severity: "low" | "medium" | "high";
  aiSuggestion: string | null;
}

async function detectProfileMismatch(
  userId: number,
  newRiskProfile: RiskProfile,
  newMaxDrawdown: number,
  newGoal: string
): Promise<PortfolioMismatch[]> {
  const db = await getDb();
  if (!db) return [];

  const portfolios = await db
    .select()
    .from(savedPortfolios)
    .where(eq(savedPortfolios.userId, userId));

  const mismatches: PortfolioMismatch[] = [];

  for (const portfolio of portfolios) {
    if (portfolio.isSnapshot) continue; // Snapshots ignorieren
    const reasons: string[] = [];
    let severity: "low" | "medium" | "high" = "low";

    let portfolioData: any = null;
    try {
      portfolioData = portfolio.portfolioData ? JSON.parse(portfolio.portfolioData) : null;
    } catch { /* ignore */ }

    const stocks: any[] = portfolioData?.stocks ?? [];

    // Enrich stocks with live data from the stocks table (dividendYield, beta)
    let enrichedStockData: Map<string, { dividendYield: string | null; beta: string | null }> = new Map();
    if (stocks.length > 0) {
      try {
        const tickers = stocks
          .map((s: any) => s.ticker)
          .filter((t: any) => typeof t === 'string' && t.length > 0 && t !== 'CASH');
        if (tickers.length > 0) {
          const dbStocks = await db
            .select({ ticker: stocksTable.ticker, dividendYield: stocksTable.dividendYield, beta: stocksTable.beta })
            .from(stocksTable)
            .where(inArray(stocksTable.ticker, tickers));
          dbStocks.forEach(s => enrichedStockData.set(s.ticker, { dividendYield: s.dividendYield, beta: s.beta }));
        }
      } catch (e) {
        console.warn('[detectProfileMismatch] Could not enrich stocks from DB:', (e as Error).message);
      }
    }

    if (stocks.length > 0) {
      // Beta-Analyse — prefer live DB value over stored portfolioData value
      const betas = stocks
        .map((s: any) => {
          const dbBeta = enrichedStockData.get(s.ticker)?.beta;
          return parseFloat(dbBeta ?? s.beta ?? s.metrics?.beta ?? "0");
        })
        .filter((b: number) => b > 0 && b < 5);
      const avgBeta = betas.length > 0 ? betas.reduce((a: number, b: number) => a + b, 0) / betas.length : null;

      if (avgBeta !== null) {
        const betaThresholds: Record<RiskProfile, number> = {
          konservativ: 0.9,
          ausgewogen: 1.2,
          wachstum: 1.5,
          aggressiv: 2.0,
        };
        if (avgBeta > betaThresholds[newRiskProfile]) {
          reasons.push(`Durchschnittliches Beta ${avgBeta.toFixed(2)} überschreitet Schwelle für ${newRiskProfile} (max. ${betaThresholds[newRiskProfile]})`);
          severity = avgBeta > betaThresholds[newRiskProfile] * 1.3 ? "high" : "medium";
        }
      }

      // Dividendenrendite für Dividenden-Ziel — use live DB value, fall back to stored value
      if (newGoal === "dividends") {
        const divYields = stocks
          .filter((s: any) => s.ticker !== 'CASH')
          .map((s: any) => {
            const dbDiv = enrichedStockData.get(s.ticker)?.dividendYield;
            return parseFloat(dbDiv ?? s.dividendYield ?? s.metrics?.dividendYield ?? "0");
          })
          .filter((d: number) => isFinite(d) && d >= 0);
        const avgDiv = divYields.length > 0 ? divYields.reduce((a: number, b: number) => a + b, 0) / divYields.length : 0;
        if (avgDiv < 2.0) {
          reasons.push(`Durchschnittliche Dividendenrendite ${avgDiv.toFixed(1)}% zu niedrig für Dividenden-Ziel (min. 2%)`);
          if (severity === "low") severity = "medium";
        }
      }

      // Anzahl Positionen für konservatives Profil (Diversifikation)
      if (newRiskProfile === "konservativ" && stocks.length < 10) {
        reasons.push(`Nur ${stocks.length} Positionen — konservative Portfolios benötigen mindestens 10 Positionen für ausreichende Diversifikation`);
        if (severity === "low") severity = "medium";
      }
    }

    if (reasons.length > 0) {
      // KI-Anpassungsvorschlag generieren
      let aiSuggestion: string | null = null;
      try {
        const llmResponse = await invokeLLM({
          messages: [
            {
              role: "system",
              content: "Du bist ein erfahrener Schweizer Vermögensberater. Gib kurze, konkrete Handlungsempfehlungen auf Deutsch.",
            },
            {
              role: "user",
              content: `Das Portfolio "${portfolio.name}" entspricht nicht mehr dem neuen Anlegerprofil (${newRiskProfile}, Ziel: ${newGoal}, max. Drawdown: ${newMaxDrawdown}%).

Probleme: ${reasons.join("; ")}

Gib 2-3 konkrete Anpassungsvorschläge in maximal 3 Sätzen. Sei spezifisch und praxisnah.`,
            },
          ],
        });
        const rawContent = llmResponse?.choices?.[0]?.message?.content;
        aiSuggestion = typeof rawContent === "string" ? rawContent : null;
      } catch (e) {
        console.error("[profileMismatch] LLM failed:", (e as Error).message);
      }

      mismatches.push({
        portfolioId: portfolio.id,
        portfolioName: portfolio.name,
        reasons,
        severity,
        aiSuggestion,
      });
    }
  }

  return mismatches;
}

const RISK = z.enum(["konservativ", "ausgewogen", "wachstum", "aggressiv"]);
const GOAL = z.enum(["dividends", "growth", "balanced"]);

// Fragebogen-Antworten (Anlegerprofil 2.0, P1)
const ANSWERS = z.object({
  goal: GOAL,
  horizonYears: z.number().int().min(1).max(50),
  purpose: z.enum(["aufbau", "entnahme", "vorsorge"]),
  wealthBand: z.enum(["u50", "b50_250", "b250_1m", "o1m"]),
  savingsRateBand: z.enum(["keine", "niedrig", "mittel", "hoch"]),
  liquidityReserveBand: z.enum(["u3m", "b3_6m", "b6_12m", "o12m"]),
  incomeStability: z.enum(["niedrig", "mittel", "hoch"]),
  drawdownReaction: z.enum(["nachkaufen", "halten", "teilverkauf", "verkauf"]),
  lossComfortPct: z.number().min(5).max(80),
  experienceWithLosses: z.enum(["ja_ok", "ja_unruhig", "nein"]),
  knowledgeLevel: z.enum(["einsteiger", "fortgeschritten", "erfahren"]),
  excludedSectors: z.array(z.string()).default([]),
  esgOnly: z.boolean().default(false),
  targetReturnPct: z.number().min(0).max(100).nullable().default(null),
  liquidityNeedPct: z.number().int().min(0).max(100).default(0),
  referenceCurrency: z.enum(['CHF', 'EUR', 'USD']).default('CHF'),
  maxFxExposurePct: z.number().int().min(0).max(100).default(50),
});

/** user_investment_profile upsert (aktives Profil, das Optimizer/Builder lesen). */
async function upsertActiveProfile(db: any, userId: number, p: {
  riskProfile: string; investmentHorizonYears: number; maxDrawdownTolerancePct: number;
  investmentGoal: string; targetReturnPct: number | null; liquidityNeedPct: number;
  excludedSectors: string[]; esgOnly: boolean;
  referenceCurrency?: string; maxFxExposurePct?: number;
}) {
  const common = {
    riskProfile: p.riskProfile as any,
    investmentHorizonYears: p.investmentHorizonYears,
    maxDrawdownTolerancePct: p.maxDrawdownTolerancePct,
    investmentGoal: p.investmentGoal as any,
    targetReturnPct: p.targetReturnPct != null ? p.targetReturnPct.toFixed(2) : null,
    liquidityNeedPct: p.liquidityNeedPct,
    excludedSectors: (p.excludedSectors ?? []) as any,
    esgOnly: p.esgOnly ? 1 : 0,
    referenceCurrency: p.referenceCurrency ?? 'CHF',
    maxFxExposurePct: p.maxFxExposurePct ?? 50,
  };
  const existing = await db.select().from(userInvestmentProfile)
    .where(eq(userInvestmentProfile.userId, userId)).limit(1);
  if (existing.length > 0) {
    await db.update(userInvestmentProfile).set(common).where(eq(userInvestmentProfile.userId, userId));
  } else {
    await db.insert(userInvestmentProfile).values({ userId, ...common });
  }
}

const DEFAULTS = {
  riskProfile: "ausgewogen" as const,
  investmentHorizonYears: 10,
  maxDrawdownTolerancePct: 20,
  investmentGoal: "balanced" as const,
  targetReturnPct: null as number | null,
  liquidityNeedPct: 0,
  excludedSectors: [] as string[],
  esgOnly: false,
  referenceCurrency: "CHF",
  maxFxExposurePct: 50,
  isSet: false,
};

export const investmentProfileRouter = router({
  /** Anlageprofil des Nutzers (Defaults + isSet=false, wenn noch nichts gespeichert). */
  get: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return DEFAULTS;
    try {
      const [row] = await db
        .select()
        .from(userInvestmentProfile)
        .where(eq(userInvestmentProfile.userId, ctx.user.id))
        .limit(1);
      if (!row) return DEFAULTS;
      return {
        riskProfile: row.riskProfile,
        investmentHorizonYears: row.investmentHorizonYears,
        maxDrawdownTolerancePct: row.maxDrawdownTolerancePct,
        investmentGoal: row.investmentGoal,
        targetReturnPct: row.targetReturnPct != null ? parseFloat(String(row.targetReturnPct)) : null,
        liquidityNeedPct: row.liquidityNeedPct,
        excludedSectors: (row.excludedSectors as string[] | null) ?? [],
        esgOnly: row.esgOnly === 1,
        referenceCurrency: row.referenceCurrency ?? 'CHF',
        maxFxExposurePct: row.maxFxExposurePct ?? 50,
        isSet: true,
      };
    } catch (e) {
      console.error("[investmentProfile] Lesen fehlgeschlagen:", (e as Error).message);
      return DEFAULTS;
    }
  }),

  /** Anlageprofil setzen/aktualisieren (Upsert je Nutzer). */
  set: protectedProcedure
    .input(
      z.object({
        riskProfile: RISK,
        investmentHorizonYears: z.number().int().min(1).max(50),
        maxDrawdownTolerancePct: z.number().int().min(5).max(80),
        investmentGoal: GOAL,
        targetReturnPct: z.number().min(0).max(100).nullable().optional(),
        liquidityNeedPct: z.number().int().min(0).max(100),
        excludedSectors: z.array(z.string()).optional(),
        esgOnly: z.boolean().optional(),
        referenceCurrency: z.enum(['CHF', 'EUR', 'USD']).optional(),
        maxFxExposurePct: z.number().int().min(0).max(100).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Keine Datenbankverbindung");
      await upsertActiveProfile(db, ctx.user.id, {
        riskProfile: input.riskProfile,
        investmentHorizonYears: input.investmentHorizonYears,
        maxDrawdownTolerancePct: input.maxDrawdownTolerancePct,
        investmentGoal: input.investmentGoal,
        targetReturnPct: input.targetReturnPct ?? null,
        liquidityNeedPct: input.liquidityNeedPct,
        excludedSectors: input.excludedSectors ?? [],
        esgOnly: !!input.esgOnly,
        referenceCurrency: input.referenceCurrency ?? 'CHF',
        maxFxExposurePct: input.maxFxExposurePct ?? 50,
      });
      // Mismatch-Check nach Profiländerung (asynchron, nicht blockierend)
      detectProfileMismatch(
        ctx.user.id,
        input.riskProfile as RiskProfile,
        input.maxDrawdownTolerancePct,
        input.investmentGoal
      ).catch((e) => console.error("[profileMismatch] Check failed:", (e as Error).message));

      return { success: true };
    }),

  /**
   * Profil-Mismatch-Check: Prüft alle Portfolios des Nutzers gegen das aktuelle Profil.
   * Gibt eine Liste von Portfolios zurück, die nicht mehr dem Profil entsprechen,
   * inkl. KI-generierter Anpassungsvorschläge.
   */
  checkMismatch: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { mismatches: [] };
    try {
      const [profileRow] = await db
        .select()
        .from(userInvestmentProfile)
        .where(eq(userInvestmentProfile.userId, ctx.user.id))
        .limit(1);
      if (!profileRow) return { mismatches: [] };

      const mismatches = await detectProfileMismatch(
        ctx.user.id,
        profileRow.riskProfile as RiskProfile,
        profileRow.maxDrawdownTolerancePct,
        profileRow.investmentGoal
      );
      return { mismatches };
    } catch (e) {
      console.error("[profileMismatch] checkMismatch failed:", (e as Error).message);
      return { mismatches: [] };
    }
  }),

  /**
   * Anlegerprofil-Bewertung (P1): gespeicherte Auswertung inkl. Scores und
   * Musterallokation. isAssessed=false, wenn (noch) keine Bewertung vorliegt.
   * Fehlertolerant — fehlt die Tabelle, gilt «nicht bewertet».
   */
  getAssessment: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { isAssessed: false as const };
    try {
      const [row] = await db
        .select()
        .from(investorProfileAssessment)
        .where(eq(investorProfileAssessment.userId, ctx.user.id))
        .limit(1);
      if (!row) return { isAssessed: false as const };
      return {
        isAssessed: true as const,
        capacityScore: row.capacityScore,
        toleranceScore: row.toleranceScore,
        needScore: row.needScore,
        bindingProfile: row.bindingProfile,
        knowledgeLevel: row.knowledgeLevel,
        financialSituation: row.financialSituation,
        answers: row.answers,
        strategicAllocation: row.strategicAllocation,
        version: row.version,
        completedAt: row.completedAt,
        lastReviewedAt: row.lastReviewedAt,
        nextReviewDueAt: row.nextReviewDueAt,
      };
    } catch (e) {
      console.error("[investmentProfile] Bewertung lesen fehlgeschlagen:", (e as Error).message);
      return { isAssessed: false as const };
    }
  }),

  /**
   * Fragebogen abschliessen (P1): wertet die Antworten aus, schreibt das aktive
   * user_investment_profile (Optimizer/Builder) und legt die Bewertung ab.
   */
  saveAssessment: protectedProcedure
    .input(ANSWERS)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Keine Datenbankverbindung");

      const answers = input as ProfileAnswers;
      const result = evaluateProfile(answers);
      const active = deriveActiveProfile(answers, result);

      // 1) Aktives Profil schreiben (immer — die Kernwirkung).
      await upsertActiveProfile(db, ctx.user.id, active);

      // 2) Bewertung ablegen (fehlertolerant — fehlt die Tabelle, bleibt das aktive Profil bestehen).
      let assessmentSaved = true;
      try {
        const now = new Date();
        const nextReview = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
        const row = {
          capacityScore: result.capacityScore,
          toleranceScore: result.toleranceScore,
          needScore: result.needScore,
          bindingProfile: result.bindingProfile as any,
          knowledgeLevel: answers.knowledgeLevel as any,
          financialSituation: {
            wealthBand: answers.wealthBand,
            savingsRateBand: answers.savingsRateBand,
            liquidityReserveBand: answers.liquidityReserveBand,
            incomeStability: answers.incomeStability,
          } as any,
          answers: answers as any,
          strategicAllocation: result.strategicAllocation as any,
          completedAt: now,
          lastReviewedAt: now,
          nextReviewDueAt: nextReview,
        };
        const existing = await db.select().from(investorProfileAssessment)
          .where(eq(investorProfileAssessment.userId, ctx.user.id)).limit(1);
        if (existing.length > 0) {
          await db.update(investorProfileAssessment)
            .set({ ...row, version: (existing[0].version ?? 1) + 1 })
            .where(eq(investorProfileAssessment.userId, ctx.user.id));
        } else {
          await db.insert(investorProfileAssessment).values({ userId: ctx.user.id, version: 1, ...row });
        }
      } catch (e) {
        assessmentSaved = false;
        console.error("[investmentProfile] Bewertung speichern fehlgeschlagen:", (e as Error).message);
      }

      return { success: true, assessmentSaved, result };
    }),

  /**
   * Profil bestätigen (P4): manueller Auslöser der jährlichen Überprüfung ohne
   * erneuten Fragebogen — setzt lastReviewedAt = jetzt und nextReviewDueAt = +1 Jahr.
   */
  confirmReview: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Keine Datenbankverbindung");
    try {
      const now = new Date();
      const nextReview = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
      const [existing] = await db.select().from(investorProfileAssessment)
        .where(eq(investorProfileAssessment.userId, ctx.user.id)).limit(1);
      if (!existing) return { success: false, message: "Noch keine Bewertung vorhanden." };
      await db.update(investorProfileAssessment)
        .set({ lastReviewedAt: now, nextReviewDueAt: nextReview })
        .where(eq(investorProfileAssessment.userId, ctx.user.id));
      return { success: true };
    } catch (e) {
      console.error("[investmentProfile] Überprüfung bestätigen fehlgeschlagen:", (e as Error).message);
      throw new Error("Überprüfung konnte nicht gespeichert werden.");
    }
  }),
});
