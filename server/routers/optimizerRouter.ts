/**
 * Optimizer Router
 * ================
 * Admin-only endpoints for the Signal Auto-Optimizer.
 * Uses the non-blocking optimizer worker that yields to the event loop.
 */

import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  runOptimizerNonBlocking,
  saveOptimizerResult,
  getActiveWeights,
  getOptimizerHistory,
  tryAcquireOptimizerLock,
  releaseOptimizerLock,
  DEFAULT_WEIGHTS,
  STRATEGY_PRESETS,
  type OptimizerResult,
} from "../analytics/optimizerWorker";
import { getDb } from "../db";
import { signalWeights } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

// Admin guard
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

// In-memory optimizer state (since it's a long-running process)
let optimizerRunning = false;
let optimizerProgress: string[] = [];
let lastOptimizerResult: OptimizerResult | null = null;

export const optimizerRouter = router({
  /**
   * Get current active weights
   */
  getWeights: adminProcedure.query(async () => {
    const weights = await getActiveWeights();
    return { weights, isDefault: JSON.stringify(weights) === JSON.stringify(DEFAULT_WEIGHTS) };
  }),

  /**
   * Get optimizer history (all saved weight configurations)
   */
  getHistory: adminProcedure.query(async () => {
    return await getOptimizerHistory();
  }),

  /**
   * Get optimizer status (running/idle, progress messages)
   */
  getStatus: adminProcedure.query(async () => {
    return {
      isRunning: optimizerRunning,
      progress: optimizerProgress,
      lastResult: lastOptimizerResult ? {
        hitRate: lastOptimizerResult.hitRate,
        totalBacktested: lastOptimizerResult.totalBacktested,
        correctSignals: lastOptimizerResult.correctSignals,
        durationMs: lastOptimizerResult.durationMs,
        topCombinations: lastOptimizerResult.topCombinations.slice(0, 5),
        walkForward: lastOptimizerResult.walkForward || null,
        totalStocksProcessed: lastOptimizerResult.totalStocksProcessed || null,
        batchInfo: lastOptimizerResult.batchInfo || null,
      } : null,
    };
  }),

  /**
   * Start the optimizer (long-running process, non-blocking)
   * Returns immediately, check status with getStatus
   */
  startOptimizer: adminProcedure.mutation(async () => {
    // Gemeinsames Lock mit dem Wochen-Cron (learningCron) — beide Auslöser
    // dürfen nie parallel laufen.
    if (optimizerRunning || !tryAcquireOptimizerLock()) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Optimizer läuft bereits. Bitte warten Sie, bis der aktuelle Durchlauf abgeschlossen ist.",
      });
    }

    // Start optimizer in background (non-blocking)
    optimizerRunning = true;
    optimizerProgress = ["Optimizer gestartet..."];

    // Run async without awaiting - yields to event loop regularly
    (async () => {
      try {
        const { getActiveWeights } = await import("../analytics/optimizerWorker");
        const incumbent = await getActiveWeights();
        const result = await runOptimizerNonBlocking((msg) => {
          optimizerProgress.push(msg);
          if (optimizerProgress.length > 50) {
            optimizerProgress = optimizerProgress.slice(-50);
          }
        }, incumbent);

        lastOptimizerResult = result;

        // Save to DB (mit Promotion-Gate)
        const outcome = await saveOptimizerResult(result, { triggeredBy: "admin" });
        if (outcome.activated) {
          optimizerProgress.push(`✅ Aktiviert (Gate bestanden). OOS ${outcome.candidateOos?.toFixed(1) ?? "?"}% vs Incumbent ${outcome.incumbentOos?.toFixed(1) ?? "—"}%`);
        } else {
          optimizerProgress.push(`⚠️ Kandidat verworfen (OOS ${outcome.candidateOos?.toFixed(1) ?? "?"}% < Incumbent ${outcome.incumbentOos?.toFixed(1) ?? "—"}%). Aktive Gewichte unverändert.`);
        }
      } catch (err) {
        optimizerProgress.push(`❌ Fehler: ${(err as Error).message}`);
        console.error("[Optimizer] Error:", err);
      } finally {
        optimizerRunning = false;
        releaseOptimizerLock();
      }
    })();

    return { started: true, message: "Optimizer gestartet. Überprüfen Sie den Status mit getStatus." };
  }),

  /**
   * Activate a specific weight configuration by ID
   */
  activateWeights: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });

      // Deactivate all
      await db.update(signalWeights).set({ isActive: 0 });
      // Activate selected
      await db.update(signalWeights).set({ isActive: 1 }).where(eq(signalWeights.id, input.id));

      return { success: true };
    }),

  /**
   * Reset to default weights (deactivate all optimized configs)
   */
  resetToDefault: adminProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });

    await db.update(signalWeights).set({ isActive: 0 });
    return { success: true, message: "Zurückgesetzt auf Standard-Gewichtungen" };
  }),

  /**
   * Get default weights (for reference)
   */
  getDefaultWeights: adminProcedure.query(() => {
    return DEFAULT_WEIGHTS;
  }),

  /**
   * Get all strategy presets
   */
  getPresets: adminProcedure.query(() => {
    return Object.entries(STRATEGY_PRESETS).map(([key, preset]) => ({
      key,
      name: preset.name,
      description: preset.description,
      weights: preset.weights,
    }));
  }),

  /**
   * Apply a preset (saves it as active weights in DB)
   */
  applyPreset: adminProcedure
    .input(z.object({ presetKey: z.string() }))
    .mutation(async ({ input }) => {
      const preset = STRATEGY_PRESETS[input.presetKey];
      if (!preset) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Unbekanntes Preset: ${input.presetKey}` });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });
      // Deactivate all existing
      await db.update(signalWeights).set({ isActive: 0 });
      // Insert the preset as a new active weight config
      await db.insert(signalWeights).values({
        name: `Preset: ${preset.name}`,
        weights: JSON.stringify(preset.weights),
        hitRate: "0",
        totalBacktested: 0,
        correctSignals: 0,
        isActive: 1,
      });
      return { success: true, message: `Preset "${preset.name}" aktiviert.` };
    }),
});
