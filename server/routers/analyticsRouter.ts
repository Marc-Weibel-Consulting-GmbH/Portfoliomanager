/**
 * Analytics Router
 * ================
 * Uses the built-in Node.js analytics engine (server/analytics/engine.ts).
 * No external Python microservice required – works in Cloud deployment.
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { calcRiskMetrics, calcDCF, optimizePortfolio, calcTechnicalAnalysis, calcRiskScoreHistory } from "../analytics/engine";
import { getQualityMetrics } from "../lib/qualityMetricsService";
import { invokeLLM } from "../_core/llm";

const HoldingSchema = z.object({
  ticker: z.string(),
  weight: z.number().min(0).max(1),
  currency: z.string().default("USD"),
});

export const analyticsRouter = router({
  /**
   * Health check – analytics engine is always available in Node.js
   */
  health: protectedProcedure.query(async () => {
    return { status: "online" };
  }),

  /**
   * Risk Metrics: VaR, Sharpe, Sortino, Beta, Max Drawdown, Volatility
   */
  riskMetrics: protectedProcedure
    .input(
      z.object({
        holdings: z.array(HoldingSchema).min(1),
        benchmark: z.string().default("SPY"),
        riskFreeRate: z.number().default(0.02),
        confidenceLevel: z.number().default(0.95),
        lookbackDays: z.number().default(252),
      })
    )
    .query(async ({ input }) => {
      try {
        return await calcRiskMetrics({
          holdings: input.holdings,
          benchmark: input.benchmark,
          riskFreeRate: input.riskFreeRate,
          confidenceLevel: input.confidenceLevel,
          lookbackDays: input.lookbackDays,
        });
      } catch (err: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err.message ?? "Risk metrics calculation failed",
        });
      }
    }),

  /**
   * DCF Valuation: Intrinsic value per share with upside/downside
   */
  dcfValuation: protectedProcedure
    .input(
      z.object({
        ticker: z.string(),
        riskFreeRate: z.number().default(0.02),
        marketRiskPremium: z.number().default(0.055),
        terminalGrowthRate: z.number().default(0.025),
        projectionYears: z.number().default(5),
      })
    )
    .query(async ({ input }) => {
      try {
        return await calcDCF({
          ticker: input.ticker,
          riskFreeRate: input.riskFreeRate,
          marketRiskPremium: input.marketRiskPremium,
          terminalGrowthRate: input.terminalGrowthRate,
          projectionYears: input.projectionYears,
        });
      } catch (err: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err.message ?? "DCF valuation failed",
        });
      }
    }),

  /**
   * Portfolio Optimization: Efficient Frontier, Max Sharpe, Min Variance
   */
  optimize: protectedProcedure
    .input(
      z.object({
        tickers: z.array(z.string()).min(2),
        lookbackDays: z.number().default(252),
        riskFreeRate: z.number().default(0.02),
        method: z.enum(["max_sharpe", "min_variance", "equal_weight", "max_dividend"]).default("max_sharpe"),
      })
    )
    .query(async ({ input }) => {
      try {
        return await optimizePortfolio({
          tickers: input.tickers,
          lookbackDays: input.lookbackDays,
          riskFreeRate: input.riskFreeRate,
          method: input.method,
        });
      } catch (err: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err.message ?? "Portfolio optimization failed",
        });
      }
    }),

  /**
   * Historical Risk Score Timeline: Weekly risk scores over the past year
   */
  riskScoreHistory: protectedProcedure
    .input(
      z.object({
        holdings: z.array(HoldingSchema).min(1),
        benchmark: z.string().default("SPY"),
        riskFreeRate: z.number().default(0.02),
        confidenceLevel: z.number().default(0.95),
        weeks: z.number().default(52),
        windowDays: z.number().default(63),
      })
    )
    .query(async ({ input }) => {
      try {
        return await calcRiskScoreHistory({
          holdings: input.holdings,
          benchmark: input.benchmark,
          riskFreeRate: input.riskFreeRate,
          confidenceLevel: input.confidenceLevel,
          weeks: input.weeks,
          windowDays: input.windowDays,
        });
      } catch (err: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err.message ?? "Risk score history calculation failed",
        });
      }
    }),

  /**
   * Technical Analysis: RSI, MACD, Bollinger Bands for a single ticker
   */
  technicalAnalysis: protectedProcedure
    .input(
      z.object({
        ticker: z.string(),
        lookbackDays: z.number().default(180),
      })
    )
    .query(async ({ input }) => {
      try {
        return await calcTechnicalAnalysis({
          ticker: input.ticker,
          lookbackDays: input.lookbackDays,
        });
      } catch (err: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err.message ?? "Technical analysis failed",
        });
      }
    }),

  /**
   * Quality Metrics: ROIC, EPS-CV, Adjusted PEG, Surprise-Rate via EODHD
   */
  qualityMetrics: protectedProcedure
    .input(z.object({ ticker: z.string() }))
    .query(async ({ input }) => {
      try {
        return await getQualityMetrics(input.ticker);
      } catch (err: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err.message ?? "Quality metrics calculation failed",
        });
      }
    }),

  /**
   * KI-Interpretation der Qualitätskennzahlen
   */
  interpretQualityMetrics: protectedProcedure
    .input(z.object({
      ticker: z.string(),
      companyName: z.string().optional(),
      sector: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        const metrics = await getQualityMetrics(input.ticker);
        const fmt = (v: number | null, suffix = "", decimals = 1) =>
          v !== null ? `${v.toFixed(decimals)}${suffix}` : "n/v";
        const prompt = `Analysiere folgende Kennzahlen für ${input.companyName || input.ticker} (${input.ticker}${input.sector ? `, Sektor: ${input.sector}` : ""}):

BEWERTUNG:
- Trailing PEG: ${fmt(metrics.trailingPeg, "", 2)}
- Forward PEG: ${fmt(metrics.forwardPeg, "", 2)}
- Adjusted PEG (volatilitätskorrigiert): ${fmt(metrics.adjustedPeg, "", 2)}
- KGV (trailing): ${fmt(metrics.trailingPE, "x")}
- Forward KGV: ${fmt(metrics.forwardPE, "x")}
- PEG-Quadrant: ${metrics.pegQuadrantLabel}

QUALITÄT:
- ROIC: ${fmt(metrics.roic, "%")}
- ROE: ${fmt(metrics.returnOnEquity, "%")}
- Bruttomarge: ${fmt(metrics.grossMargin, "%")}
- Betriebsmarge: ${fmt(metrics.operatingMargin, "%")}
- Quality-Score: ${metrics.qualityScore}/100

WACHSTUM:
- EPS-Wachstum TTM: ${fmt(metrics.epsGrowthTTM, "%")}
- EPS-CAGR 5J: ${fmt(metrics.epsGrowth5y, "% p.a.")}
- Umsatzwachstum TTM: ${fmt(metrics.revenueGrowthTTM, "%")}

RISIKO:
- EPS-Volatilität (CV): ${metrics.epsVolatility !== null ? metrics.epsVolatility.toFixed(2) : "n/v"}
- EPS-Stabilitäts-Score: ${metrics.epsStabilityScore}/100
- EPS Surprise-Rate: ${fmt(metrics.surpriseRate, "% der letzten 8Q")}
- Net Debt/EBITDA: ${fmt(metrics.netDebtToEbitda, "x", 2)}

Gib eine strukturierte Analyse zurück.`;

        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: "Du bist ein erfahrener Finanzanalyst. Analysiere die Kennzahlen präzise und strukturiert auf Deutsch. Sei konkret, vermeide Floskeln. Maximal 250 Wörter.",
            },
            { role: "user", content: prompt as string },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "quality_interpretation",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  bewertung: { type: "string", description: "2-3 Sätze zur Bewertung (PEG, KGV, Adjusted PEG)" },
                  qualitaet: { type: "string", description: "2-3 Sätze zur Unternehmensqualität (ROIC, Margen, ROE)" },
                  risiko: { type: "string", description: "2-3 Sätze zum Risiko (EPS-Volatilität, Verschuldung, Stabilität)" },
                  fazit: { type: "string", description: "1 Satz Gesamtfazit mit klarer Einschätzung" },
                  ampel: { type: "string", enum: ["gruen", "gelb", "rot"], description: "Gesamteinschätzung" },
                },
                required: ["bewertung", "qualitaet", "risiko", "fazit", "ampel"],
                additionalProperties: false,
              },
            },
          } as any,
        });
        const rawContent = response.choices?.[0]?.message?.content;
        const content = typeof rawContent === "string" ? rawContent : null;
        if (!content) throw new Error("Keine Antwort vom LLM");
        return JSON.parse(content) as {
          bewertung: string;
          qualitaet: string;
          risiko: string;
          fazit: string;
          ampel: "gruen" | "gelb" | "rot";
        };
      } catch (err: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err.message ?? "KI-Interpretation fehlgeschlagen",
        });
      }
    }),
});
