import { adminProcedure, router } from "../_core/trpc";
import { getStripeSecretKey } from "../_core/env";
import { getTimingResults, getCurrentSecretStatus } from "../_core/secretsTimingTest";

/**
 * Test router to verify database-backed secrets functionality
 * Admin-only endpoints for testing secret loading
 */
export const testSecretsRouter = router({
  /**
   * Test Stripe secret key loading
   * Shows where the key is loaded from (env vs database)
   */
  testStripeKey: adminProcedure.query(async () => {
    const key = await getStripeSecretKey();
    
    return {
      hasKey: !!key,
      keyLength: key ? key.length : 0,
      keyPrefix: key ? key.substring(0, 7) + "..." : "NOT_FOUND",
      source: process.env.STRIPE_SECRET_KEY ? "environment" : (key ? "database" : "none"),
    };
  }),

  /**
   * Get timing test results
   * Shows secret availability at different points in time
   */
  getTimingResults: adminProcedure.query(() => {
    return getTimingResults();
  }),

  /**
   * Get current secret status (on-demand check)
   */
  getCurrentStatus: adminProcedure.query(() => {
    return getCurrentSecretStatus();
  }),
});
