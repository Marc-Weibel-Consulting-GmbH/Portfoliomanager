import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import { getLogs, clearLogs, getLogStats } from "../_core/logMonitor";

/**
 * Logs router for admin error monitoring
 * Provides access to captured server logs
 */
export const logsRouter = router({
  /**
   * Get logs with optional filtering
   */
  list: adminProcedure
    .input(
      z.object({
        level: z.enum(["error", "warn", "info"]).optional(),
        limit: z.number().min(1).max(500).optional(),
        since: z.date().optional(),
      }).optional()
    )
    .query(({ input }) => {
      return getLogs(input);
    }),

  /**
   * Get log statistics
   */
  stats: adminProcedure.query(() => {
    return getLogStats();
  }),

  /**
   * Clear all logs
   */
  clear: adminProcedure.mutation(() => {
    clearLogs();
    return { success: true, message: "Alle Logs gelöscht" };
  }),
});
