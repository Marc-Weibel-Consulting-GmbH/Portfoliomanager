/**
 * Report-Router: QuantStats-Tearsheet für ein Portfolio.
 * Baut die Tagesrenditen aus der historisch korrekten Wertreihe (performanceService)
 * und lässt den Python-analytics_service (ANALYTICS_SERVICE_URL) daraus einen
 * self-contained HTML-Report erzeugen. Ownership über getSavedPortfolioById.
 */
import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

export const reportRouter = router({
  tearsheet: protectedProcedure
    .input(z.object({ portfolioId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const serviceUrl = process.env.ANALYTICS_SERVICE_URL;
      if (!serviceUrl) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Report-Dienst ist nicht konfiguriert (ANALYTICS_SERVICE_URL fehlt).",
        });
      }

      const { getSavedPortfolioById, getPortfolioTransactions } = await import("../db");
      const portfolio = await getSavedPortfolioById(input.portfolioId, ctx.user.id);
      if (!portfolio) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Portfolio nicht gefunden." });
      }

      const transactions = await getPortfolioTransactions(input.portfolioId);
      const txDates = transactions.map((t: any) => t.date).filter(Boolean).sort();
      const startDate = txDates[0] ?? new Date(Date.now() - 3 * 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);
      const endDate = new Date().toISOString().slice(0, 10);

      const { calculatePortfolioPerformance } = await import("../lib/performanceService");
      const perf = await calculatePortfolioPerformance({ portfolioId: input.portfolioId, startDate, endDate });

      const vals = perf.dailyValuations.filter((v) => Number.isFinite(v.marketValue) && v.marketValue > 0);
      if (vals.length < 31) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Zu wenig Wertverlauf für einen Report — nur für Live-Portfolios mit Transaktionshistorie verfügbar.",
        });
      }

      // Tagesrenditen aus der Wertreihe
      const returns: number[] = [];
      const dates: string[] = [];
      for (let i = 1; i < vals.length; i++) {
        const r = vals[i].marketValue / vals[i - 1].marketValue - 1;
        if (Number.isFinite(r)) {
          returns.push(r);
          dates.push(vals[i].date);
        }
      }

      let res: Response;
      try {
        res = await fetch(`${serviceUrl.replace(/\/$/, "")}/analytics/tearsheet`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ returns, dates, title: portfolio.name ?? "Portfolio", rf: 0 }),
          signal: AbortSignal.timeout(30000),
        });
      } catch (e) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Report-Dienst nicht erreichbar: ${(e as Error).message}`,
        });
      }
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Report fehlgeschlagen (${res.status}): ${detail.slice(0, 200)}`,
        });
      }
      const html = await res.text();
      return { html };
    }),
});
