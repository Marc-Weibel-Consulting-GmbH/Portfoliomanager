import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";
import { importHistoricalPrices } from "../jobs/importHistoricalPrices";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),

  importHistoricalData: adminProcedure
    .input(
      z.object({
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
        forceRefresh: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const result = await importHistoricalPrices(
        input.fromDate,
        input.toDate,
        input.forceRefresh ?? false
      );
      return result;
    }),
});
