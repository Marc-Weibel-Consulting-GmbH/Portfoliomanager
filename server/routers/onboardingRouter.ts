import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { userPreferences, users, savedPortfolios } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Onboarding Router
 * Handles user onboarding flow: preferences storage, completion tracking
 */
export const onboardingRouter = router({
  /**
   * Get user preferences (investment goal, risk tolerance, horizon)
   */
  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const prefs = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, ctx.user.id))
      .limit(1);

    return prefs.length > 0 ? prefs[0] : null;
  }),

  /**
   * Save user preferences from onboarding wizard
   */
  savePreferences: protectedProcedure
    .input(
      z.object({
        investmentGoal: z.enum(["dividends", "growth", "balanced"]).optional(),
        riskTolerance: z.enum(["low", "medium", "high"]).optional(),
        investmentHorizon: z.enum(["short", "medium", "long"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Check if preferences already exist
      const existing = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, ctx.user.id))
        .limit(1);

      if (existing.length > 0) {
        // Update existing preferences
        await db
          .update(userPreferences)
          .set({
            ...input,
            updatedAt: new Date(),
          })
          .where(eq(userPreferences.userId, ctx.user.id));
      } else {
        // Insert new preferences
        await db.insert(userPreferences).values({
          userId: ctx.user.id,
          ...input,
        });
      }

      return { success: true };
    }),

  /**
   * Mark onboarding as completed
   */
  completeOnboarding: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    await db
      .update(users)
      .set({
        hasSeenOnboarding: 1,
        hasCompletedOnboarding: 1,
        updatedAt: new Date(),
      })
      .where(eq(users.id, ctx.user.id));

    return { success: true };
  }),

  /**
   * Check if user has completed onboarding
   */
  hasCompletedOnboarding: protectedProcedure.query(async ({ ctx }) => {
    return {
      hasSeenOnboarding: ctx.user.hasSeenOnboarding === 1,
      hasCompletedOnboarding: ctx.user.hasCompletedOnboarding === 1,
      hasDemoPortfolio: ctx.user.hasDemoPortfolio === 1,
    };
  }),

  /**
   * Create demo portfolio with realistic Swiss stocks
   */
  createDemoPortfolio: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Check if user already has demo portfolio
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);

    if (user?.hasDemoPortfolio) {
      throw new Error("Demo-Portfolio wurde bereits erstellt");
    }

    // Demo portfolio with realistic Swiss stocks
    const demoStocks = [
      { ticker: "NESN.SW", name: "Nestlé", weight: 20, shares: 5, price: 85.5, currency: "CHF" },
      { ticker: "NOVN.SW", name: "Novartis", weight: 20, shares: 12, price: 82.3, currency: "CHF" },
      { ticker: "ROG.SW", name: "Roche", weight: 15, shares: 6, price: 245.0, currency: "CHF" },
      { ticker: "UBSG.SW", name: "UBS Group", weight: 15, shares: 50, price: 29.5, currency: "CHF" },
      { ticker: "ZURN.SW", name: "Zurich Insurance", weight: 15, shares: 3, price: 520.0, currency: "CHF" },
      { ticker: "ABBN.SW", name: "ABB", weight: 15, shares: 30, price: 52.0, currency: "CHF" },
    ];

    const portfolioData = {
      stocks: demoStocks,
      metrics: {
        expectedReturn: 8.5,
        volatility: 12.3,
        sharpeRatio: 0.69,
        avgDividendYield: 3.2,
        avgPE: 18.5,
        avgPEG: 1.8,
      },
      strategy: "Max. Sharpe Ratio",
      timeFrame: "3Y",
    };

    // Create demo portfolio
    const [portfolio] = await db.insert(savedPortfolios).values({
      userId: ctx.user.id,
      name: "Demo Portfolio - Schweizer Blue Chips",
      description: "Beispiel-Portfolio mit Schweizer Unternehmen zum Kennenlernen!",
      portfolioData: JSON.stringify(portfolioData),
      isLive: 0,
      liveStartDate: null,
    });

    // Mark user as having demo portfolio
    await db
      .update(users)
      .set({ hasDemoPortfolio: 1 })
      .where(eq(users.id, ctx.user.id));

    return {
      success: true,
      message: "Demo-Portfolio erfolgreich erstellt!",
      portfolioId: portfolio.insertId,
    };
  }),
});
