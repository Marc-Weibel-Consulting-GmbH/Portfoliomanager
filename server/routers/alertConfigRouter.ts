/**
 * Alert Configuration Router
 * Allows admin users to configure watchlist alert scoring criteria.
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";

const alertConfigSchema = z.object({
  // P/E thresholds
  peLow: z.number().min(1).max(100),
  peMedium: z.number().min(1).max(200),
  peHigh: z.number().min(1).max(500),
  peVeryHigh: z.number().min(1).max(1000),
  peLowPoints: z.number().min(-50).max(50),
  peMediumPoints: z.number().min(-50).max(50),
  peHighPoints: z.number().min(-50).max(50),
  peVeryHighPoints: z.number().min(-50).max(50),
  // Dividend thresholds (as decimal, e.g. 0.04 = 4%)
  divHigh: z.number().min(0).max(1),
  divMedium: z.number().min(0).max(1),
  divHighPoints: z.number().min(-50).max(50),
  divMediumPoints: z.number().min(-50).max(50),
  // 52W position thresholds (0–1)
  week52NearLow: z.number().min(0).max(1),
  week52BelowMid: z.number().min(0).max(1),
  week52NearHigh: z.number().min(0).max(1),
  week52NearLowPoints: z.number().min(-50).max(50),
  week52BelowMidPoints: z.number().min(-50).max(50),
  week52NearHighPoints: z.number().min(-50).max(50),
  // PEG thresholds
  pegVeryLow: z.number().min(0).max(10),
  pegModerate: z.number().min(0).max(10),
  pegHigh: z.number().min(0).max(20),
  pegVeryLowPoints: z.number().min(-50).max(50),
  pegModeratePoints: z.number().min(-50).max(50),
  pegHighPoints: z.number().min(-50).max(50),
  // Alert trigger thresholds
  buyTriggerScore: z.number().min(50).max(100),
  sellTriggerScore: z.number().min(0).max(50),
  buyPreviousScoreThreshold: z.number().min(0).max(100),
  sellPreviousScoreThreshold: z.number().min(0).max(100),
  scoreChangeTrigger: z.number().min(1).max(50),
});

export const alertConfigRouter = router({
  /**
   * Get the current alert configuration (admin only)
   */
  get: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
    }
    const { getDb } = await import("../db");
    const { alertConfig } = await import("../../drizzle/schema");
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const rows = await db.select().from(alertConfig).limit(1);
    if (rows.length === 0) {
      // Return defaults
      return {
        peLow: 15, peMedium: 20, peHigh: 40, peVeryHigh: 60,
        peLowPoints: 12, peMediumPoints: 6, peHighPoints: -8, peVeryHighPoints: -15,
        divHigh: 0.04, divMedium: 0.025, divHighPoints: 12, divMediumPoints: 6,
        week52NearLow: 0.20, week52BelowMid: 0.35, week52NearHigh: 0.95,
        week52NearLowPoints: 15, week52BelowMidPoints: 8, week52NearHighPoints: -10,
        pegVeryLow: 0.80, pegModerate: 1.20, pegHigh: 3.00,
        pegVeryLowPoints: 12, pegModeratePoints: 5, pegHighPoints: -8,
        buyTriggerScore: 75, sellTriggerScore: 25,
        buyPreviousScoreThreshold: 70, sellPreviousScoreThreshold: 35,
        scoreChangeTrigger: 10,
        updatedAt: null as Date | null,
        updatedBy: null as string | null,
      };
    }

    const row = rows[0];
    return {
      peLow: parseFloat(row.peLow as string),
      peMedium: parseFloat(row.peMedium as string),
      peHigh: parseFloat(row.peHigh as string),
      peVeryHigh: parseFloat(row.peVeryHigh as string),
      peLowPoints: row.peLowPoints,
      peMediumPoints: row.peMediumPoints,
      peHighPoints: row.peHighPoints,
      peVeryHighPoints: row.peVeryHighPoints,
      divHigh: parseFloat(row.divHigh as string),
      divMedium: parseFloat(row.divMedium as string),
      divHighPoints: row.divHighPoints,
      divMediumPoints: row.divMediumPoints,
      week52NearLow: parseFloat(row.week52NearLow as string),
      week52BelowMid: parseFloat(row.week52BelowMid as string),
      week52NearHigh: parseFloat(row.week52NearHigh as string),
      week52NearLowPoints: row.week52NearLowPoints,
      week52BelowMidPoints: row.week52BelowMidPoints,
      week52NearHighPoints: row.week52NearHighPoints,
      pegVeryLow: parseFloat(row.pegVeryLow as string),
      pegModerate: parseFloat(row.pegModerate as string),
      pegHigh: parseFloat(row.pegHigh as string),
      pegVeryLowPoints: row.pegVeryLowPoints,
      pegModeratePoints: row.pegModeratePoints,
      pegHighPoints: row.pegHighPoints,
      buyTriggerScore: row.buyTriggerScore,
      sellTriggerScore: row.sellTriggerScore,
      buyPreviousScoreThreshold: row.buyPreviousScoreThreshold,
      sellPreviousScoreThreshold: row.sellPreviousScoreThreshold,
      scoreChangeTrigger: row.scoreChangeTrigger,
      updatedAt: row.updatedAt,
      updatedBy: row.updatedBy,
    };
  }),

  /**
   * Update the alert configuration (admin only)
   */
  update: protectedProcedure
    .input(alertConfigSchema)
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
      }
      const { getDb } = await import("../db");
      const { alertConfig } = await import("../../drizzle/schema");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db.insert(alertConfig).values({
        id: 1,
        peLow: input.peLow.toString(),
        peMedium: input.peMedium.toString(),
        peHigh: input.peHigh.toString(),
        peVeryHigh: input.peVeryHigh.toString(),
        peLowPoints: input.peLowPoints,
        peMediumPoints: input.peMediumPoints,
        peHighPoints: input.peHighPoints,
        peVeryHighPoints: input.peVeryHighPoints,
        divHigh: input.divHigh.toString(),
        divMedium: input.divMedium.toString(),
        divHighPoints: input.divHighPoints,
        divMediumPoints: input.divMediumPoints,
        week52NearLow: input.week52NearLow.toString(),
        week52BelowMid: input.week52BelowMid.toString(),
        week52NearHigh: input.week52NearHigh.toString(),
        week52NearLowPoints: input.week52NearLowPoints,
        week52BelowMidPoints: input.week52BelowMidPoints,
        week52NearHighPoints: input.week52NearHighPoints,
        pegVeryLow: input.pegVeryLow.toString(),
        pegModerate: input.pegModerate.toString(),
        pegHigh: input.pegHigh.toString(),
        pegVeryLowPoints: input.pegVeryLowPoints,
        pegModeratePoints: input.pegModeratePoints,
        pegHighPoints: input.pegHighPoints,
        buyTriggerScore: input.buyTriggerScore,
        sellTriggerScore: input.sellTriggerScore,
        buyPreviousScoreThreshold: input.buyPreviousScoreThreshold,
        sellPreviousScoreThreshold: input.sellPreviousScoreThreshold,
        scoreChangeTrigger: input.scoreChangeTrigger,
        updatedBy: ctx.user.name || ctx.user.email || "admin",
      }).onDuplicateKeyUpdate({
        set: {
          peLow: input.peLow.toString(),
          peMedium: input.peMedium.toString(),
          peHigh: input.peHigh.toString(),
          peVeryHigh: input.peVeryHigh.toString(),
          peLowPoints: input.peLowPoints,
          peMediumPoints: input.peMediumPoints,
          peHighPoints: input.peHighPoints,
          peVeryHighPoints: input.peVeryHighPoints,
          divHigh: input.divHigh.toString(),
          divMedium: input.divMedium.toString(),
          divHighPoints: input.divHighPoints,
          divMediumPoints: input.divMediumPoints,
          week52NearLow: input.week52NearLow.toString(),
          week52BelowMid: input.week52BelowMid.toString(),
          week52NearHigh: input.week52NearHigh.toString(),
          week52NearLowPoints: input.week52NearLowPoints,
          week52BelowMidPoints: input.week52BelowMidPoints,
          week52NearHighPoints: input.week52NearHighPoints,
          pegVeryLow: input.pegVeryLow.toString(),
          pegModerate: input.pegModerate.toString(),
          pegHigh: input.pegHigh.toString(),
          pegVeryLowPoints: input.pegVeryLowPoints,
          pegModeratePoints: input.pegModeratePoints,
          pegHighPoints: input.pegHighPoints,
          buyTriggerScore: input.buyTriggerScore,
          sellTriggerScore: input.sellTriggerScore,
          buyPreviousScoreThreshold: input.buyPreviousScoreThreshold,
          sellPreviousScoreThreshold: input.sellPreviousScoreThreshold,
          scoreChangeTrigger: input.scoreChangeTrigger,
          updatedBy: ctx.user.name || ctx.user.email || "admin",
        },
      });

      console.log(`[alertConfig] Updated by ${ctx.user.name || ctx.user.email}`);
      return { success: true };
    }),
});
