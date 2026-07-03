import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

export const userSettingsRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const { getDb } = await import("../db");
    const { userSettings } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) return null;
    const rows = await db.select().from(userSettings).where(eq(userSettings.userId, ctx.user.id)).limit(1);
    return rows.length > 0 ? rows[0] : null;
  }),

  updateBrokerFees: protectedProcedure
    .input(z.object({
      brokerName: z.string().optional(),
      feePerTrade: z.string().optional(),
      feePercent: z.string().optional(),
      minFeePerTrade: z.string().optional(),
      maxFeePerTrade: z.string().optional(),
      stampDutyPercent: z.string().optional(),
      currencyConversionFee: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user || !ctx.user.id || ctx.user.id === 1) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Authentication required" });
      }
      const { getDb } = await import("../db");
      const { userSettings } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const updateData: Record<string, any> = {};
      if (input.brokerName !== undefined) updateData.brokerName = input.brokerName || null;
      if (input.feePerTrade !== undefined) updateData.feePerTrade = input.feePerTrade || null;
      if (input.feePercent !== undefined) updateData.feePercent = input.feePercent || null;
      if (input.minFeePerTrade !== undefined) updateData.minFeePerTrade = input.minFeePerTrade || null;
      if (input.maxFeePerTrade !== undefined) updateData.maxFeePerTrade = input.maxFeePerTrade || null;
      if (input.stampDutyPercent !== undefined) updateData.stampDutyPercent = input.stampDutyPercent || null;
      if (input.currencyConversionFee !== undefined) updateData.currencyConversionFee = input.currencyConversionFee || null;

      await db.insert(userSettings).values({
        userId: ctx.user.id,
        ...updateData,
      }).onDuplicateKeyUpdate({ set: updateData });

      return { success: true };
    }),
});
