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
import { getDiversificationRules as _getDiversificationRules } from "../lib/diversificationRules";
import { getDb } from "../db";
import { watchlistStocks } from "../../drizzle/schema";
import { and, eq, inArray } from "drizzle-orm";

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
        // Optional: wenn nicht gesetzt, verwendet calcDCF den währungs-
        // spezifischen risikofreien Zins (R-32).
        riskFreeRate: z.number().optional(),
        marketRiskPremium: z.number().default(0.055),
        terminalGrowthRate: z.number().default(0.025),
        projectionYears: z.number().default(10),
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
        method: z.enum(["max_sharpe", "min_variance", "equal_weight", "max_dividend", "hrp"]).default("max_sharpe"),
        // R-34c (additiv): Portfoliowert in CHF für die Mindest-Positionsgrösse CHF 3'000
        portfolioValue: z.number().positive().optional(),
        // Current portfolio weights {ticker: weight 0..1} to plot actual portfolio on frontier
        currentWeights: z.record(z.string(), z.number()).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        // F2: Diversifikationsregeln (Admin) fliessen als Constraints in den Optimizer.
        const { getDiversificationRules } = await import("../lib/diversificationRules");
        const rules = await getDiversificationRules();

        // P3: Wenn ein Anlageprofil existiert, steuern Risikoprofil + Drawdown-Toleranz
        // Methode und Positions-Cap-Schärfe. Ohne Profil greifen Admin-Regeln + input.method.
        let method = input.method;
        let minPositionWeight = rules.minPositionPercent / 100;
        let maxPositionWeight = rules.maxPositionPercent / 100;
        try {
          const { getDb } = await import("../db");
          const { userInvestmentProfile } = await import("../../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          const db = await getDb();
          if (db) {
            const [profile] = await db.select().from(userInvestmentProfile)
              .where(eq(userInvestmentProfile.userId, ctx.user.id)).limit(1);
            if (profile) {
              const { optimizerParamsForProfile } = await import("../lib/profileOptimizerParams");
              const params = optimizerParamsForProfile(
                { riskProfile: profile.riskProfile, maxDrawdownTolerancePct: profile.maxDrawdownTolerancePct, investmentHorizonYears: profile.investmentHorizonYears },
                rules,
              );
              // equal_weight / max_dividend / hrp bleiben respektiert; sonst profilbasierte Methode.
              method = (input.method === "equal_weight" || input.method === "max_dividend" || input.method === "hrp") ? input.method : params.method;
              minPositionWeight = params.minPositionWeight;
              maxPositionWeight = params.maxPositionWeight;
            }
          }
        } catch (e) {
          console.warn("[analytics.optimize] Profil-Parameter nicht anwendbar:", (e as Error).message);
        }

        return await optimizePortfolio({
          tickers: input.tickers,
          lookbackDays: input.lookbackDays,
          riskFreeRate: input.riskFreeRate,
          method,
          portfolioValue: input.portfolioValue,
          minPositionChf: rules.minPositionAmountCHF,
          minPositionWeight,
          maxPositionWeight,
          currentWeights: input.currentWeights,
        });
      } catch (err: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err.message ?? "Portfolio optimization failed",
        });
      }
    }),

  /**
   * F2: Aktive Diversifikationsregeln (Admin-konfigurierbar) für die Nutzer-Ansicht.
   * Nur-Lesen; die Pflege erfolgt im Admin-Bereich «App-Einstellungen».
   */
  getDiversificationRules: protectedProcedure.query(async () => {
    const { getDiversificationRules } = await import("../lib/diversificationRules");
    return getDiversificationRules();
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

  /**
   * Upgrade-Vorschläge: Schwache Positionen ersetzen, starke Kandidaten hinzufügen.
   * Liest Kandidaten aus Watchlist + Aktien-Empfehlungen und vergleicht mit
   * bestehenden Portfolio-Positionen nach Sektor und Score.
   */
  upgradeProposals: protectedProcedure
    .input(
      z.object({
        portfolioId: z.string(),
        holdings: z.array(
          z.object({
            ticker: z.string(),
            weight: z.number().min(0).max(1),
            sector: z.string().optional().nullable(),
            signalScore: z.number().optional().nullable(),
            companyName: z.string().optional().nullable(),
          })
        ),
        portfolioValue: z.number().optional().default(0),
      })
    )
    .query(async ({ input }) => {
      try {
        const rules = await _getDiversificationRules();
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB nicht verfügbar" });

        // Alle aktiven Kandidaten aus Watchlist + Empfehlungen laden
        const candidates = await db
          .select()
          .from(watchlistStocks)
          .where(
            and(
              eq(watchlistStocks.isActive, 1),
              inArray(watchlistStocks.listType, ["empfehlung", "watchlist"])
            )
          );

        const portfolioTickers = new Set(input.holdings.map((h) => h.ticker.toUpperCase()));

        // Durchschnitts-Score der aktuellen Positionen
        const holdingsWithScore = input.holdings.filter((h) => h.signalScore != null && (h.signalScore ?? 0) > 0);
        const avgScoreCurrent =
          holdingsWithScore.length > 0
            ? Math.round(holdingsWithScore.reduce((s, h) => s + (h.signalScore ?? 0), 0) / holdingsWithScore.length)
            : 0;

        // Schwache Positionen (Score < Schwelle)
        const weakPositions = input.holdings
          .filter((h) => (h.signalScore ?? 0) < rules.upgradeScoreThreshold)
          .sort((a, b) => (a.signalScore ?? 0) - (b.signalScore ?? 0));

        // Ersatz-Vorschläge: für jede schwache Position Top-3 Kandidaten aus gleichem Sektor
        const replacementSuggestions: Array<{
          weakTicker: string;
          weakCompanyName: string;
          weakScore: number;
          weakWeight: number;
          suggestions: Array<{
            ticker: string;
            companyName: string;
            sector: string | null;
            signalScore: number;
            signalType: string | null;
            dividendYield: string | null;
            category: string | null;
            scoreDelta: number;
          }>;
        }> = [];

        for (const weak of weakPositions) {
          const sector = weak.sector ?? null;
          const sectorCandidates = candidates
            .filter((c) => {
              if (portfolioTickers.has(c.ticker.toUpperCase())) return false;
              if ((c.signalScore ?? 0) <= (weak.signalScore ?? 0)) return false;
              if (sector && c.sector && c.sector.toLowerCase() !== sector.toLowerCase()) return false;
              return true;
            })
            .sort((a, b) => (b.signalScore ?? 0) - (a.signalScore ?? 0))
            .slice(0, 3)
            .map((c) => ({
              ticker: c.ticker,
              companyName: c.companyName,
              sector: c.sector ?? null,
              signalScore: c.signalScore ?? 0,
              signalType: c.signalType ?? null,
              dividendYield: c.dividendYield ?? null,
              category: c.category ?? null,
              scoreDelta: (c.signalScore ?? 0) - (weak.signalScore ?? 0),
            }));

          replacementSuggestions.push({
            weakTicker: weak.ticker,
            weakCompanyName: weak.companyName ?? weak.ticker,
            weakScore: weak.signalScore ?? 0,
            weakWeight: weak.weight,
            suggestions: sectorCandidates,
          });
        }

        // Ergänzungs-Vorschläge: Kandidaten mit hohem Score, die noch nicht im Portfolio sind
        const additionThreshold = 65;
        const additionSuggestions = candidates
          .filter((c) => {
            if (portfolioTickers.has(c.ticker.toUpperCase())) return false;
            if ((c.signalScore ?? 0) < additionThreshold) return false;
            return true;
          })
          .sort((a, b) => (b.signalScore ?? 0) - (a.signalScore ?? 0))
          .map((c) => ({
            ticker: c.ticker,
            companyName: c.companyName,
            sector: c.sector ?? null,
            signalScore: c.signalScore ?? 0,
            signalType: c.signalType ?? null,
            dividendYield: c.dividendYield ?? null,
            category: c.category ?? null,
            listType: c.listType,
            estimatedWeight: parseFloat((1 / (input.holdings.length + 1)).toFixed(4)),
          }));

        // Durchschnitts-Score nach Upgrade (beste Ersatz-Vorschläge eingerechnet)
        let simulatedScoreSum = 0;
        let simulatedCount = 0;
        for (const h of input.holdings) {
          const replacement = replacementSuggestions.find((r) => r.weakTicker === h.ticker);
          if (replacement && replacement.suggestions.length > 0) {
            simulatedScoreSum += replacement.suggestions[0].signalScore;
          } else {
            simulatedScoreSum += h.signalScore ?? avgScoreCurrent;
          }
          simulatedCount++;
        }
        const avgScoreAfterUpgrade = simulatedCount > 0 ? Math.round(simulatedScoreSum / simulatedCount) : avgScoreCurrent;

        return {
          weakPositions: weakPositions.map((h) => ({
            ticker: h.ticker,
            companyName: h.companyName ?? h.ticker,
            score: h.signalScore ?? 0,
            weight: h.weight,
            sector: h.sector ?? null,
          })),
          replacementSuggestions,
          additionSuggestions,
          avgScoreCurrent,
          avgScoreAfterUpgrade,
          upgradeScoreThreshold: rules.upgradeScoreThreshold,
          totalCandidates: candidates.length,
        };
      } catch (err: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err.message ?? "Upgrade-Vorschläge konnten nicht berechnet werden",
        });
      }
    }),
});
