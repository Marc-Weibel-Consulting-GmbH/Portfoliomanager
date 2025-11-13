import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import {
  deleteSecret,
  listSecretKeys,
  setSecret,
} from "../_core/secretsManager";

/**
 * Secrets management router (admin only)
 * Allows admins to manage API keys and other secrets in the database
 */
export const secretsRouter = router({
  /**
   * List all secret keys (without values)
   */
  list: adminProcedure.query(async () => {
    return await listSecretKeys();
  }),

  /**
   * Set a secret (create or update)
   */
  set: adminProcedure
    .input(
      z.object({
        key: z.string().min(1).max(255),
        value: z.string().min(1),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        await setSecret(input.key, input.value, input.description);
        return { success: true };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to save secret",
        });
      }
    }),

  /**
   * Delete a secret
   */
  delete: adminProcedure
    .input(z.object({ key: z.string() }))
    .mutation(async ({ input }) => {
      try {
        await deleteSecret(input.key);
        return { success: true };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete secret",
        });
      }
    }),
});
