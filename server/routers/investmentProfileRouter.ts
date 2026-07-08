/**
 * Anlageprofil (Konzept «Optimierung & Empfehlungen», Stufe F1).
 * Risikoprofil + Anlageziele pro Nutzer — Grundlage für Optimizer/Empfehlungen und
 * das Gating der automatischen Portfolio-Erstellung. Ownership über ctx.user.id.
 */
import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { userInvestmentProfile } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

const RISK = z.enum(["konservativ", "ausgewogen", "wachstum", "aggressiv"]);
const GOAL = z.enum(["dividends", "growth", "balanced"]);

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

      const common = {
        riskProfile: input.riskProfile,
        investmentHorizonYears: input.investmentHorizonYears,
        maxDrawdownTolerancePct: input.maxDrawdownTolerancePct,
        investmentGoal: input.investmentGoal,
        targetReturnPct: input.targetReturnPct != null ? input.targetReturnPct.toFixed(2) : null,
        liquidityNeedPct: input.liquidityNeedPct,
        excludedSectors: (input.excludedSectors ?? []) as any,
        esgOnly: input.esgOnly ? 1 : 0,
      };

      const existing = await db
        .select()
        .from(userInvestmentProfile)
        .where(eq(userInvestmentProfile.userId, ctx.user.id))
        .limit(1);

      if (existing.length > 0) {
        await db.update(userInvestmentProfile).set(common).where(eq(userInvestmentProfile.userId, ctx.user.id));
      } else {
        await db.insert(userInvestmentProfile).values({ userId: ctx.user.id, ...common });
      }
      return { success: true };
    }),
});
