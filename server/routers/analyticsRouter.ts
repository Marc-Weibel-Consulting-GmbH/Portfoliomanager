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
import { watchlistStocks, portfolioTransactions, savedPortfolios } from "../../drizzle/schema";
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
        // Manuelle Optimierungsziele (Soft-Constraints)
        userConstraints: z.object({
          minDividendYield: z.number().min(0).max(1).optional(),
          maxVolatility: z.number().min(0).max(2).optional(),
          minSharpe: z.number().min(-5).max(10).optional(),
        }).optional(),
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
          userConstraints: input.userConstraints,
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
        cashBalance: z.number().optional().default(0),
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

        // Ersatz-Vorschläge: für jede schwache Position genau 1 besten Kandidaten (kein Duplikat)
        // Bereits zugewiesene Kandidaten werden aus dem Pool entfernt → keine Wiederholungen.
        const replacementSuggestions: Array<{
          weakTicker: string;
          weakCompanyName: string;
          weakScore: number;
          weakWeight: number;
          cashRequired: number;
          hasSufficientCash: boolean;
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

        // Pool der noch nicht zugewiesenen Kandidaten (verhindert Duplikate)
        const assignedCandidateTickers = new Set<string>();
        // Kumulierter Kauf-Betrag (für Liquiditätsprüfung)
        let cumulativeBuyCHF = 0;
        const cashAvailable = input.cashBalance ?? 0;

        for (const weak of weakPositions) {
          const sector = weak.sector ?? null;
          // Kauf-Betrag für diese Position (Gewicht × Portfolio-Wert)
          const buyAmountCHF = weak.weight * (input.portfolioValue ?? 0);
          cumulativeBuyCHF += buyAmountCHF;
          const hasSufficientCash = cashAvailable >= cumulativeBuyCHF;

          const sectorCandidates = candidates
            .filter((c) => {
              if (portfolioTickers.has(c.ticker.toUpperCase())) return false;
              if (assignedCandidateTickers.has(c.ticker.toUpperCase())) return false; // kein Duplikat
              if ((c.signalScore ?? 0) <= (weak.signalScore ?? 0)) return false;
              // Sektor-Filter: nur wenn BEIDE Sektor-Felder gesetzt sind
              if (sector && c.sector && c.sector.toLowerCase() !== sector.toLowerCase()) return false;
              return true;
            })
            .sort((a, b) => (b.signalScore ?? 0) - (a.signalScore ?? 0))
            .slice(0, 1) // Genau 1 bester Ersatz pro schwacher Position
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

          // Zugewiesenen Kandidaten aus dem Pool entfernen
          sectorCandidates.forEach((c) => assignedCandidateTickers.add(c.ticker.toUpperCase()));

          replacementSuggestions.push({
            weakTicker: weak.ticker,
            weakCompanyName: weak.companyName ?? weak.ticker,
            weakScore: weak.signalScore ?? 0,
            weakWeight: weak.weight,
            cashRequired: buyAmountCHF,
            hasSufficientCash,
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

  /**
   * Optimierungsempfehlungen als Transaktionen umsetzen.
   * Erwartet eine Liste von Tickers mit Zielgewicht + aktuellem Gewicht,
   * berechnet den CHF-Betrag und erstellt Kauf- oder Verkauf-Transaktionen.
   */
  applyOptimization: protectedProcedure
    .input(z.object({
      portfolioId: z.number(),
      totalValueCHF: z.number().positive(),
      items: z.array(z.object({
        ticker: z.string(),
        currentWeight: z.number().min(0).max(1),
        targetWeight: z.number().min(0).max(1),
        currentPriceCHF: z.number().optional(), // optional: Kurs in CHF für Stückzahl-Berechnung
      })).min(1).max(50),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // HARD AUTH GUARD
      if (!ctx.user || !ctx.user.id || ctx.user.id === 1) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Authentication required" });
      }
      console.log("[applyOptimization] ctx.user:", ctx.user);

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Verify portfolio ownership
      const portfolio = await db
        .select({ id: savedPortfolios.id, userId: savedPortfolios.userId })
        .from(savedPortfolios)
        .where(and(eq(savedPortfolios.id, input.portfolioId), eq(savedPortfolios.userId, ctx.user.id)))
        .limit(1);
      if (portfolio.length === 0) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Portfolio nicht gefunden oder keine Berechtigung" });
      }

      const now = new Date();
      const notes = input.notes ?? `Automatisch umgesetzt via Optimierungs-Tab am ${now.toLocaleDateString('de-CH')}`;
      const created: { ticker: string; type: string; amountCHF: number }[] = [];

      for (const item of input.items) {
        const delta = item.targetWeight - item.currentWeight;
        if (Math.abs(delta) < 0.001) continue; // ignore tiny diffs

        const amountCHF = Math.abs(delta) * input.totalValueCHF;
        if (amountCHF < 10) continue; // skip negligible amounts < CHF 10

        const transactionType = delta > 0 ? "buy" : "sell";

        // Compute shares if price is known
        let shares: string | null = null;
        if (item.currentPriceCHF && item.currentPriceCHF > 0) {
          shares = (amountCHF / item.currentPriceCHF).toFixed(4);
        }

        await db.insert(portfolioTransactions).values({
          portfolioId: input.portfolioId,
          transactionType,
          ticker: item.ticker,
          shares,
          pricePerShare: item.currentPriceCHF ? item.currentPriceCHF.toFixed(4) : null,
          currency: "CHF",
          totalAmount: amountCHF.toFixed(2),
          fxRate: "1",
          totalAmountCHF: amountCHF.toFixed(2),
          fees: "0",
          notes,
          transactionDate: now,
        });

        created.push({ ticker: item.ticker, type: transactionType, amountCHF: Math.round(amountCHF) });
      }

      // Update cashBalance: sells increase cash, buys decrease cash
      const netCashChange = created.reduce((acc, t) => {
        return t.type === 'sell' ? acc + t.amountCHF : acc - t.amountCHF;
      }, 0);
      if (Math.abs(netCashChange) > 0.01) {
        const portfolioRow = await db.select({ cashBalance: savedPortfolios.cashBalance })
          .from(savedPortfolios)
          .where(eq(savedPortfolios.id, input.portfolioId))
          .limit(1);
        const currentCash = parseFloat(portfolioRow[0]?.cashBalance ?? '0') || 0;
        const newCash = Math.max(0, currentCash + netCashChange);
        await db.update(savedPortfolios)
          .set({ cashBalance: newCash.toFixed(2) })
          .where(eq(savedPortfolios.id, input.portfolioId));
      }

      return { success: true, transactionsCreated: created.length, transactions: created, netCashChange: Math.round(netCashChange) };
    }),

  /** Clone a portfolio as a snapshot before applying optimization */
  clonePortfolio: protectedProcedure
    .input(z.object({
      portfolioId: z.number().int().positive(),
      cloneName: z.string().min(1).max(200),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.id || ctx.user.id === 1) throw new TRPCError({ code: 'UNAUTHORIZED' });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB not available' });
      const { eq } = await import('drizzle-orm');

      // Load original portfolio
      const originals = await db.select().from(savedPortfolios)
        .where(eq(savedPortfolios.id, input.portfolioId)).limit(1);
      if (!originals.length) throw new TRPCError({ code: 'NOT_FOUND' });
      const orig = originals[0];
      if (orig.userId !== ctx.user.id) throw new TRPCError({ code: 'FORBIDDEN' });

      // Insert clone
      const now = new Date();
      const [result] = await db.insert(savedPortfolios).values({
        userId: ctx.user.id,
        name: input.cloneName,
        description: `Snapshot von \u00ab${orig.name}\u00bb vor Optimierung (${now.toLocaleDateString('de-CH')})`,
        portfolioData: orig.portfolioData,
        portfolioType: orig.portfolioType,
        status: orig.status,
        investmentAmount: orig.investmentAmount,
        ...(orig.benchmark ? { benchmark: orig.benchmark } : {}),
        isLive: 0,
        cashBalance: orig.cashBalance ?? '0',
        ...(orig.inceptionDate ? { inceptionDate: orig.inceptionDate } : {}),
        isSnapshot: 1,
        snapshotOfPortfolioId: input.portfolioId,
        snapshotNote: `Snapshot vor Optimierung am ${now.toLocaleDateString('de-CH')}`,
      });
      const newId = (result as any).insertId as number;

      // Copy transactions
      const txs = await db.select().from(portfolioTransactions)
        .where(eq(portfolioTransactions.portfolioId, input.portfolioId));
      if (txs.length > 0) {
        await db.insert(portfolioTransactions).values(
          txs.map(t => ({
            portfolioId: newId,
            transactionType: t.transactionType,
            ticker: t.ticker,
            shares: t.shares,
            pricePerShare: t.pricePerShare,
            currency: t.currency,
            totalAmount: t.totalAmount,
            fxRate: t.fxRate,
            totalAmountCHF: t.totalAmountCHF,
            fees: t.fees,
            notes: t.notes ? `[Kopie] ${t.notes}` : '[Kopie]',
            transactionDate: t.transactionDate,
          }))
        );
      }

      return { success: true, cloneId: newId, cloneName: input.cloneName };
    }),

  /** Get optimization subscription status for a portfolio */
  getOptimizationSubscription: protectedProcedure
    .input(z.object({ portfolioId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      if (!ctx.user?.id) return null;
      const db = await getDb();
      if (!db) return null;
      const { optimizationSubscriptions } = await import('../../drizzle/schema');
      const { eq: eqOp, and: andOp } = await import('drizzle-orm');
      const subs = await db.select().from(optimizationSubscriptions)
        .where(andOp(
          eqOp(optimizationSubscriptions.userId, ctx.user.id),
          eqOp(optimizationSubscriptions.portfolioId, input.portfolioId)
        )).limit(1);
      return subs.length > 0 ? subs[0] : null;
    }),

  /** Subscribe to weekly optimization drift alerts for a portfolio */
  subscribeOptimizationAlert: protectedProcedure
    .input(z.object({
      portfolioId: z.number().int().positive(),
      driftThresholdPp: z.number().int().min(1).max(30).default(5),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.id || ctx.user.id === 1) throw new TRPCError({ code: 'UNAUTHORIZED' });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB not available' });
      const { optimizationSubscriptions } = await import('../../drizzle/schema');
      const { eq: eqOp, and: andOp } = await import('drizzle-orm');
      const { parse: parseCookie } = await import('cookie');
      const { COOKIE_NAME } = await import('@shared/const');
      const { createHeartbeatJob } = await import('../_core/heartbeat');

      // Verify portfolio ownership
      const portfolioRows = await db.select().from(savedPortfolios)
        .where(eqOp(savedPortfolios.id, input.portfolioId)).limit(1);
      if (!portfolioRows.length) throw new TRPCError({ code: 'NOT_FOUND' });
      if (portfolioRows[0].userId !== ctx.user.id) throw new TRPCError({ code: 'FORBIDDEN' });

      // Check if subscription already exists
      const existing = await db.select().from(optimizationSubscriptions)
        .where(andOp(
          eqOp(optimizationSubscriptions.userId, ctx.user.id),
          eqOp(optimizationSubscriptions.portfolioId, input.portfolioId)
        )).limit(1);

      if (existing.length > 0) {
        await db.update(optimizationSubscriptions)
          .set({ driftThresholdPp: input.driftThresholdPp, isActive: 1 })
          .where(eqOp(optimizationSubscriptions.id, existing[0].id));
        return { success: true, subscriptionId: existing[0].id, isNew: false, heartbeatActive: !!existing[0].scheduleCronTaskUid };
      }

      // Create Heartbeat job (only works in production after deployment)
      let taskUid: string | null = null;
      try {
        const sessionToken = parseCookie(ctx.req.headers.cookie ?? '')[COOKIE_NAME] ?? '';
        const job = await createHeartbeatJob({
          name: `optim-alert-${input.portfolioId}-${ctx.user.id}`,
          cron: '0 0 8 * * 1',
          path: '/api/scheduled/optimizationAlert',
          payload: { portfolioId: input.portfolioId },
          description: `W\u00f6chentlicher Optimierungs-Check f\u00fcr Portfolio ${portfolioRows[0].name}`,
        }, sessionToken);
        taskUid = job.taskUid;
      } catch (e) {
        console.warn('[subscribeOptimizationAlert] Heartbeat job creation failed (dev mode?):', e);
      }

      const [insertResult] = await db.insert(optimizationSubscriptions).values({
        userId: ctx.user.id,
        portfolioId: input.portfolioId,
        cronExpression: '0 0 8 * * 1',
        driftThresholdPp: input.driftThresholdPp,
        scheduleCronTaskUid: taskUid,
        isActive: 1,
      });
      const newId = (insertResult as any).insertId as number;
      return { success: true, subscriptionId: newId, isNew: true, heartbeatActive: !!taskUid };
    }),

  /** Compare two portfolios side-by-side: metrics, sector allocation, holdings */
  comparePortfolios: protectedProcedure
    .input(z.object({
      portfolioIdA: z.number().int().positive(),
      portfolioIdB: z.number().int().positive(),
    }))
    .query(async ({ input, ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: 'UNAUTHORIZED' });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      const { eq: eqOp } = await import('drizzle-orm');

      const loadPortfolio = async (id: number) => {
        const rows = await db.select().from(savedPortfolios).where(eqOp(savedPortfolios.id, id)).limit(1);
        if (!rows.length) throw new TRPCError({ code: 'NOT_FOUND', message: `Portfolio ${id} not found` });
        const p = rows[0];
        if (p.userId !== ctx.user!.id) throw new TRPCError({ code: 'FORBIDDEN' });
        const data = JSON.parse(p.portfolioData || '{}');
        const stocks: Array<{ ticker: string; weight: number; name?: string; sector?: string }> =
          (data.stocks || data.positions || []).map((s: any) => ({
            ticker: s.ticker,
            weight: parseFloat(s.weight || '0'),
            name: s.name || s.ticker,
            sector: s.sector || 'Unbekannt',
          }));
        // Sector allocation
        const sectorMap: Record<string, number> = {};
        for (const s of stocks) {
          sectorMap[s.sector!] = (sectorMap[s.sector!] || 0) + s.weight;
        }
        const sectors = Object.entries(sectorMap).map(([name, weight]) => ({ name, weight })).sort((a, b) => b.weight - a.weight);
        // Metrics from portfolioData
        return {
          id: p.id,
          name: p.name,
          isSnapshot: p.isSnapshot,
          snapshotNote: p.snapshotNote,
          createdAt: p.createdAt,
          investmentAmount: parseFloat(p.investmentAmount || '0'),
          numberOfPositions: stocks.length,
          avgDividendYield: parseFloat(data.avgDividendYield || '0'),
          avgYtdPerformance: parseFloat(data.avgYtdPerformance || '0'),
          expectedReturn: parseFloat(data.expectedReturn || data.annualReturn || '0'),
          volatility: parseFloat(data.volatility || data.annualVolatility || '0'),
          sharpeRatio: parseFloat(data.sharpeRatio || '0'),
          stocks,
          sectors,
        };
      };

      const [a, b] = await Promise.all([
        loadPortfolio(input.portfolioIdA),
        loadPortfolio(input.portfolioIdB),
      ]);
      return { a, b };
    }),

  /** Unsubscribe from optimization alerts */
  unsubscribeOptimizationAlert: protectedProcedure
    .input(z.object({ portfolioId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.id) throw new TRPCError({ code: 'UNAUTHORIZED' });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      const { optimizationSubscriptions } = await import('../../drizzle/schema');
      const { eq: eqOp, and: andOp } = await import('drizzle-orm');
      await db.update(optimizationSubscriptions)
        .set({ isActive: 0 })
        .where(andOp(
          eqOp(optimizationSubscriptions.userId, ctx.user.id),
          eqOp(optimizationSubscriptions.portfolioId, input.portfolioId)
        ));
      return { success: true };
    }),
});
