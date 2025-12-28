import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { eq } from "drizzle-orm";
import { users } from "../../drizzle/schema";

/**
 * Notification settings router
 * Allows users to manage their notification preferences
 */
export const notificationSettingsRouter = router({
  /**
   * Get current user's notification settings
   */
  getSettings: protectedProcedure.query(async ({ ctx }) => {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);

    if (!user) throw new Error("User not found");

    return {
      whatsappAlerts: user.whatsappAlerts === 1,
      mobile: user.mobile,
    };
  }),

  /**
   * Update notification settings
   */
  updateSettings: protectedProcedure
    .input(
      z.object({
        whatsappAlerts: z.boolean(),
        mobile: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .update(users)
        .set({
          whatsappAlerts: input.whatsappAlerts ? 1 : 0,
          ...(input.mobile !== undefined && { mobile: input.mobile }),
        })
        .where(eq(users.id, ctx.user.id));

      return { success: true };
    }),
});
