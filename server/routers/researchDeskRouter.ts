import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { researchDeskEvidence, researchDeskRuns } from "../../drizzle/schema";
import { getDb } from "../db";
import { runResearchDeskShadow } from "../lib/researchDeskService";
import { adminProcedure, router } from "../_core/trpc";

const checkerStatusSchema = z.enum(["pending", "reviewed", "rejected"]);

/**
 * Ausschliesslich administrativer Vertrag für den beobachtenden Research Desk.
 * Er liefert Quellen-Evidenz und erlaubt menschliche Triage, berührt jedoch
 * keine Score-, Optimierungs- oder Handelsdaten.
 */
export const researchDeskRouter = router({
  overview: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(250).default(100) }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { runs: [], evidence: [] };
      const limit = input?.limit ?? 100;
      const [runs, evidence] = await Promise.all([
        db.select().from(researchDeskRuns).orderBy(desc(researchDeskRuns.startedAt)).limit(30),
        db.select().from(researchDeskEvidence)
          .orderBy(desc(researchDeskEvidence.sourcePublishedAt), desc(researchDeskEvidence.fetchedAt))
          .limit(limit),
      ]);
      return { runs, evidence };
    }),

  runShadowNow: adminProcedure.mutation(async () => runResearchDeskShadow()),

  setCheckerStatus: adminProcedure
    .input(z.object({ evidenceId: z.number().int().positive(), status: checkerStatusSchema }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const result = await db.update(researchDeskEvidence)
        .set({ checkerStatus: input.status })
        .where(and(eq(researchDeskEvidence.id, input.evidenceId), eq(researchDeskEvidence.isShadowMode, 1)));
      const affectedRows = Number((Array.isArray(result) ? result[0] : result)?.affectedRows ?? 0);
      if (affectedRows !== 1) throw new Error("Shadow-Evidenz nicht gefunden");
      return { success: true };
    }),
});
