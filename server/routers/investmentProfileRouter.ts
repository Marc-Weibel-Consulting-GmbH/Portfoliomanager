/**
 * Anlageprofil (Konzept «Optimierung & Empfehlungen», Stufe F1).
 * Risikoprofil + Anlageziele pro Nutzer — Grundlage für Optimizer/Empfehlungen und
 * das Gating der automatischen Portfolio-Erstellung. Ownership über ctx.user.id.
 */
import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { userInvestmentProfile, investorProfileAssessment } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import {
  evaluateProfile,
  deriveActiveProfile,
  type ProfileAnswers,
} from "../lib/investorProfileScoring";

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
});

/** user_investment_profile upsert (aktives Profil, das Optimizer/Builder lesen). */
async function upsertActiveProfile(db: any, userId: number, p: {
  riskProfile: string; investmentHorizonYears: number; maxDrawdownTolerancePct: number;
  investmentGoal: string; targetReturnPct: number | null; liquidityNeedPct: number;
  excludedSectors: string[]; esgOnly: boolean;
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
      });
      return { success: true };
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
});
