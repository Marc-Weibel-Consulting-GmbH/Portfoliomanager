import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";

export const debugRouter = router({
  testPortfolioCreate: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        portfolioData: z.string(),
        investmentAmount: z.string(),
        portfolioType: z.enum(["demo", "live"]).default("demo"),
        userId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const logs: string[] = [];
      const debugId = crypto.randomUUID();

      try {
        logs.push(`[${debugId}] Starting test portfolio create...`);
        logs.push(`[${debugId}] Input: ${JSON.stringify(input, null, 2)}`);

        const { getDb } = await import("../db");
        const { savedPortfolios } = await import("../../drizzle/schema");
        const { sql, eq } = await import("drizzle-orm");

        const db = await getDb();

        if (!db) {
          logs.push(`[${debugId}] ERROR: Database connection not available`);
          return { success: false, logs, error: "Database connection not available" };
        }

        logs.push(`[${debugId}] DB connection OK`);

        // 1) DB Ping Test
        logs.push(`[${debugId}] DB Ping...`);
        await db.execute(sql`SELECT 1`);
        logs.push(`[${debugId}] DB Ping OK`);

        // 2) Insert portfolio
        const portfolioData = {
          userId: input.userId,
          name: input.name,
          description: input.description || null,
          portfolioData: input.portfolioData,
          investmentAmount: input.investmentAmount,
          portfolioType: input.portfolioType,
          isLive: input.portfolioType === "live" ? 1 : 0,
          liveStartDate: input.portfolioType === "live" ? new Date() : null,
        };

        logs.push(`[${debugId}] Portfolio data prepared: ${JSON.stringify(portfolioData, null, 2)}`);
        logs.push(`[${debugId}] Inserting portfolio...`);

        await db.insert(savedPortfolios).values(portfolioData);
        logs.push(`[${debugId}] Insert OK`);

        // 3) Get the last inserted ID using MySQL's LAST_INSERT_ID()
        logs.push(`[${debugId}] Getting LAST_INSERT_ID...`);
        const lastIdResult = await db.execute(sql`SELECT LAST_INSERT_ID() as id`);
        logs.push(`[${debugId}] LAST_INSERT_ID raw result: ${JSON.stringify(lastIdResult, null, 2)}`);

        const lastId = (lastIdResult as any)[0]?.[0]?.id;
        logs.push(`[${debugId}] Extracted lastId: ${lastId}`);

        if (!lastId) {
          logs.push(`[${debugId}] ERROR: Failed to get LAST_INSERT_ID`);
          return { success: false, logs, error: "Failed to get LAST_INSERT_ID" };
        }

        // 4) Fetch the inserted portfolio using the ID
        logs.push(`[${debugId}] Fetching inserted portfolio with ID ${lastId}...`);
        const inserted = await db
          .select()
          .from(savedPortfolios)
          .where(eq(savedPortfolios.id, Number(lastId)))
          .limit(1);

        logs.push(`[${debugId}] Fetch result: ${JSON.stringify(inserted, null, 2)}`);

        if (!inserted || inserted.length === 0) {
          logs.push(`[${debugId}] ERROR: Failed to fetch inserted portfolio`);
          return { success: false, logs, error: "Failed to fetch inserted portfolio" };
        }

        logs.push(`[${debugId}] SUCCESS! Portfolio created with ID: ${inserted[0].id}`);

        return {
          success: true,
          logs,
          portfolio: inserted[0],
        };
      } catch (err: any) {
        logs.push(`[${debugId}] EXCEPTION: ${err?.message ?? String(err)}`);
        logs.push(`[${debugId}] Stack: ${err?.stack ?? "No stack trace"}`);

        return {
          success: false,
          logs,
          error: err?.message ?? String(err),
          stack: err?.stack,
        };
      }
    }),
});
