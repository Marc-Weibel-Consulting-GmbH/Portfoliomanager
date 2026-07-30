/**
 * Research Observatory Router
 * ===========================
 * Liefert die gecachten n8n-Research-Signale sortiert an den Client.
 * Reine Research-FILTERUNG (keine Anlageberatung) — read-only, öffentlich.
 * Refresh-/Cache-Logik liegt im Service (_core/researchSignals.ts), analog
 * zum stockBriefingCache.
 */

import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";

export const researchObservatoryRouter = router({
  // Gecachte Signale, sortiert (relevanceScore desc, dann classifiedAt desc).
  // Löst on-demand einen 24h-Cache-Refresh gegen die n8n-URL aus.
  list: publicProcedure.query(async () => {
    const { getResearchSignals } = await import("../_core/researchSignals");
    const signals = await getResearchSignals();
    return signals.map((s) => ({
      signalId: s.signalId,
      title: s.title,
      url: s.url,
      sourceName: s.sourceName,
      sourceCategory: s.sourceCategory,
      contentType: s.contentType,
      evidenceType: s.evidenceType,
      relevanceScore: s.relevanceScore,
      topics: Array.isArray(s.topics) ? (s.topics as string[]) : [],
      followUpRequired: Boolean(s.followUpRequired),
      publishedAt: s.publishedAt,
      classifiedAt: s.classifiedAt,
    }));
  }),

  // Manueller Refresh (z.B. Admin-Button) — erzwingt einen n8n-Fetch.
  refresh: publicProcedure
    .input(z.object({ force: z.boolean().optional() }).optional())
    .mutation(async ({ input }) => {
      const { refreshResearchSignals } = await import("../_core/researchSignals");
      const upserted = await refreshResearchSignals({ force: input?.force ?? true });
      return { upserted };
    }),
});
