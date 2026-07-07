/**
 * Wiederkehrende Transaktions-Empfehlungen — Kadenz-Konfiguration (Track D / P3).
 * Die eigentliche Generierung/Umsetzung nutzt die bestehende Copilot-Analyse
 * (copilot.analyze / copilot.applyRebalancing). Hier wird nur die Kadenz je Portfolio
 * persistiert und der nächste Fälligkeitszeitpunkt berechnet.
 */
import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { getDb, getSavedPortfolioById } from "../db";
import { portfolioRecommendationConfig } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { nextDueMs, type Cadence } from "../lib/recommendationCadence";

const CADENCE = z.enum(["off", "weekly", "monthly", "quarterly"]);

export const recommendationsRouter = router({
  /** Kadenz-Konfiguration eines Portfolios (mit nächstem Fälligkeitsdatum). */
  getConfig: protectedProcedure
    .input(z.object({ portfolioId: z.number() }))
    .query(async ({ ctx, input }) => {
      const portfolio = await getSavedPortfolioById(input.portfolioId, ctx.user.id);
      if (!portfolio) throw new Error("Portfolio nicht gefunden");

      const db = await getDb();
      const defaults = { cadence: "off" as Cadence, autoExecute: false, lastGeneratedAt: null as string | null };
      let row = defaults;
      if (db) {
        const rows = await db
          .select()
          .from(portfolioRecommendationConfig)
          .where(eq(portfolioRecommendationConfig.portfolioId, input.portfolioId))
          .limit(1);
        if (rows.length > 0) {
          row = {
            cadence: rows[0].cadence as Cadence,
            autoExecute: rows[0].autoExecute === 1,
            lastGeneratedAt: rows[0].lastGeneratedAt ? new Date(rows[0].lastGeneratedAt).toISOString() : null,
          };
        }
      }
      const lastMs = row.lastGeneratedAt ? new Date(row.lastGeneratedAt).getTime() : null;
      const due = nextDueMs(row.cadence, lastMs);
      return { ...row, nextDueAt: due != null ? new Date(due).toISOString() : null };
    }),

  /** Kadenz + Auto-Ausführung setzen. Auto-Ausführung ist bewusst opt-in. */
  setConfig: protectedProcedure
    .input(z.object({
      portfolioId: z.number(),
      cadence: CADENCE,
      autoExecute: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const portfolio = await getSavedPortfolioById(input.portfolioId, ctx.user.id);
      if (!portfolio) throw new Error("Portfolio nicht gefunden");
      const db = await getDb();
      if (!db) throw new Error("Keine Datenbankverbindung");

      const existing = await db
        .select()
        .from(portfolioRecommendationConfig)
        .where(eq(portfolioRecommendationConfig.portfolioId, input.portfolioId))
        .limit(1);

      const autoExec = input.autoExecute ? 1 : 0;
      if (existing.length > 0) {
        await db
          .update(portfolioRecommendationConfig)
          .set({ cadence: input.cadence, autoExecute: autoExec })
          .where(eq(portfolioRecommendationConfig.portfolioId, input.portfolioId));
      } else {
        await db.insert(portfolioRecommendationConfig).values({
          portfolioId: input.portfolioId,
          cadence: input.cadence,
          autoExecute: autoExec,
        });
      }
      return { success: true };
    }),
});
