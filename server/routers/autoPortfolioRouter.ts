import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { invokeLLM } from "../_core/llm";

export const autoPortfolioRouter = router({
  /**
   * F4: Automatischer Portfolio-Vorschlag aus dem Anlageprofil.
   *
   * Gated auf ein gesetztes user_investment_profile. Kandidaten werden aus der
   * DB (stocks) nach Momentum/Qualität/LPPL bewertet (kein Yahoo), nach dem
   * Profil (ausgeschlossene Sektoren, Ziel) gefiltert/gerankt, unter den
   * Diversifikationsregeln (Admin) ausgewählt und via optimizePortfolio (Methode
   * aus dem Risikoprofil) gewichtet. Reines Nur-Lesen — legt nichts an; der
   * Nutzer bestätigt den Vorschlag im Builder.
   */
  buildProposal: protectedProcedure
    .input(z.object({ investmentAmount: z.number().positive().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new Error("Datenbank nicht verfügbar");

      const { eq, and, gte, asc } = await import("drizzle-orm");

      // 1) Gate: Anlageprofil muss gesetzt sein
      const { userInvestmentProfile, stocks: stocksTable, historicalPrices } = await import("../../drizzle/schema");
      const [profile] = await db
        .select()
        .from(userInvestmentProfile)
        .where(eq(userInvestmentProfile.userId, ctx.user.id))
        .limit(1);
      if (!profile) {
        throw new Error(
          "Kein Anlageprofil hinterlegt. Bitte legen Sie zuerst unter Einstellungen › Anlageprofil Ihr Risikoprofil und Ihre Anlageziele fest."
        );
      }
      const excludedSectors: string[] = (profile.excludedSectors as string[] | null) ?? [];
      const goal = profile.investmentGoal; // dividends|growth|balanced
      const riskProfile = profile.riskProfile;

      // 2) Diversifikationsregeln (Admin) + Profil-abgeleitete Optimizer-Parameter (P3)
      const { getDiversificationRules } = await import("../lib/diversificationRules");
      const rules = await getDiversificationRules();
      const { optimizerParamsForProfile } = await import("../lib/profileOptimizerParams");
      const params = optimizerParamsForProfile(
        {
          riskProfile,
          maxDrawdownTolerancePct: profile.maxDrawdownTolerancePct,
          investmentHorizonYears: profile.investmentHorizonYears,
        },
        rules,
      );

      // 3) Kandidaten-Universum aus der DB (nach Marktkapitalisierung begrenzt,
      //    ausgeschlossene Sektoren + fehlende Preise raus)
      const allStocks = await db.select().from(stocksTable);
      let universe = allStocks.filter((s: any) => {
        const price = parseFloat(s.currentPrice ?? "0");
        if (!(price > 0)) return false;
        if (s.sector && excludedSectors.includes(s.sector)) return false;
        return true;
      });
      universe.sort((a: any, b: any) => parseFloat(b.marketCap ?? "0") - parseFloat(a.marketCap ?? "0"));
      universe = universe.slice(0, 40);

      // 4) Scoring aus Kursreihen (historicalPrices)
      const { scoreFromPrices } = await import("../lib/tickerScoring");
      const priceFrom = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const scored: any[] = [];
      for (const s of universe) {
        try {
          const rows = await db
            .select({ close: historicalPrices.close, adj: historicalPrices.adjustedClose })
            .from(historicalPrices)
            .where(and(eq(historicalPrices.ticker, s.ticker.toUpperCase()), gte(historicalPrices.date, priceFrom)))
            .orderBy(asc(historicalPrices.date));
          const prices = rows
            .map((r: any) => parseFloat((r.adj ?? r.close) as any))
            .filter((v: number) => Number.isFinite(v) && v > 0);
          if (prices.length < 60) continue;
          // P3: Horizont steuert Momentum-vs-Qualität im Score.
          const sc = await scoreFromPrices(prices, { momentum: params.momentumWeight, quality: params.qualityWeight });
          scored.push({ stock: s, ...sc, dividendYield: parseFloat(s.dividendYield ?? "0") });
        } catch (e) {
          console.warn(`[autoPortfolio] Scoring ${s.ticker} fehlgeschlagen:`, (e as Error).message);
        }
      }
      if (scored.length < 2) {
        throw new Error("Zu wenige Titel mit ausreichender Kurshistorie gefunden, um einen Vorschlag zu erstellen.");
      }

      // 5) Ranking (Ziel «dividends» bevorzugt Dividendenrendite) + Kaufsignal-Filter
      const rankKey = (x: any) => x.combinedScore + (goal === "dividends" ? Math.min(x.dividendYield * 100, 5) * 2 : 0);
      let ranked = scored.filter((x) => x.combinedScore >= 55).sort((a, b) => rankKey(b) - rankKey(a));
      if (ranked.length < rules.minTitles) {
        // Zu wenige Kaufsignale — auf das gesamte bewertete Universum ausweiten
        ranked = [...scored].sort((a, b) => rankKey(b) - rankKey(a));
      }

      // 6) Auswahl unter Sektor-Cap bis maxTitles
      const target = Math.min(rules.maxTitles, ranked.length);
      const maxPerSector = Math.max(1, Math.floor((rules.maxSectorPercent / 100) * target));
      const selected: any[] = [];
      const sectorCount: Record<string, number> = {};
      for (const c of ranked) {
        if (selected.length >= rules.maxTitles) break;
        const sec = c.stock.sector || "Andere";
        if ((sectorCount[sec] || 0) >= maxPerSector) continue;
        selected.push(c);
        sectorCount[sec] = (sectorCount[sec] || 0) + 1;
      }
      if (selected.length < 2) {
        throw new Error("Zu wenige geeignete Kandidaten nach Anwendung der Diversifikationsregeln.");
      }

      // 7) Gewichtung via Optimizer (Methode + Caps aus dem Profil, P3; DB-only)
      const { optimizePortfolio } = await import("../analytics/engine");
      const method = params.method;
      const tickers = selected.map((s) => s.stock.ticker);
      let weights: Record<string, number> = {};
      try {
        const opt = await optimizePortfolio({
          tickers,
          method,
          minPositionChf: params.minPositionChf,
          minPositionWeight: params.minPositionWeight,
          maxPositionWeight: params.maxPositionWeight,
          ...(input?.investmentAmount ? { portfolioValue: input.investmentAmount } : {}),
        });
        weights = opt.weights as Record<string, number>;
      } catch (e) {
        // Fallback: score-proportional
        console.warn("[autoPortfolio] Optimizer fehlgeschlagen, Score-proportionale Gewichte:", (e as Error).message);
        const total = selected.reduce((s, c) => s + c.combinedScore, 0) || 1;
        selected.forEach((c) => { weights[c.stock.ticker] = c.combinedScore / total; });
      }

      // 8) Positionen bauen (0-Gewichte fallen weg, Rest auf 100 % normiert)
      const kept = selected
        .map((c) => ({ c, w: weights[c.stock.ticker] ?? 0 }))
        .filter((x) => x.w > 0);
      const wSum = kept.reduce((s, x) => s + x.w, 0) || 1;
      const positions = kept
        .map(({ c, w }) => {
          const s = c.stock;
          return {
            ticker: s.ticker,
            companyName: s.companyName,
            sector: s.sector || "Andere",
            currency: s.currency || "CHF",
            currentPrice: parseFloat(s.currentPrice ?? "0"),
            weightPct: parseFloat(((w / wSum) * 100).toFixed(2)),
            combinedScore: c.combinedScore,
            signal: c.signal,
            reason: `${c.signal} · Momentum ${c.momentumGrade}, Qualität ${c.qualityGrade}` +
              (c.regime === "bubble" ? " · LPPL-Warnung" : ""),
          };
        })
        .sort((a, b) => b.weightPct - a.weightPct);

      return {
        positions,
        method,
        methodLabel: method === "min_variance" ? "Min. Varianz" : "Max. Sharpe",
        profile: {
          riskProfile,
          investmentGoal: goal,
          excludedSectors,
        },
        stats: {
          universeCount: universe.length,
          scoredCount: scored.length,
          buySignals: scored.filter((x) => x.combinedScore >= 55).length,
          selectedCount: positions.length,
        },
      };
    }),

  generatePortfolio: protectedProcedure
    .input(
      z.object({
        strategy: z.enum(['growth', 'dividends', 'balanced']),
        investmentHorizon: z.enum(['short', 'medium', 'long']),
        riskTolerance: z.enum(['low', 'medium', 'high']).optional(),
        targetStockCount: z.number().min(5).max(20).default(10),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      
      if (!db) {
        throw new Error("Database not available");
      }

      // Fetch all available stocks
      const { stocks: stocksTable } = await import("../../drizzle/schema");
      const allStocks = await db.select().from(stocksTable);

      if (allStocks.length === 0) {
        throw new Error("No stocks available in database");
      }

      // Prepare stock data for LLM
      const stocksData = allStocks.map(stock => ({
        ticker: stock.ticker,
        companyName: stock.companyName,
        sector: stock.sector,
        currentPrice: stock.currentPrice,
        ytdPerformance: stock.ytdPerformance,
        dividendYield: stock.dividendYield,
        marketCap: stock.marketCap,
      }));

      // Create prompt for LLM
      const strategyDescription = {
        growth: 'high capital appreciation with focus on growth stocks',
        dividends: 'steady income through dividend-paying stocks',
        balanced: 'balanced mix of growth and dividend stocks',
      }[input.strategy];

      const horizonDescription = {
        short: 'short-term (< 3 years)',
        medium: 'medium-term (3-7 years)',
        long: 'long-term (> 7 years)',
      }[input.investmentHorizon];

      const prompt = `You are a professional portfolio manager. Create a diversified stock portfolio with the following criteria:

Strategy: ${strategyDescription}
Investment Horizon: ${horizonDescription}
Target Number of Stocks: ${input.targetStockCount}

Available stocks (JSON):
${JSON.stringify(stocksData, null, 2)}

Requirements:
1. Select exactly ${input.targetStockCount} stocks from the available list
2. Ensure good sector diversification (max 30% in any single sector)
3. Assign percentage weights that sum to exactly 100%
4. For growth strategy: prioritize stocks with high YTD performance and growth potential
5. For dividends strategy: prioritize stocks with high dividend yields (> 2%)
6. For balanced strategy: mix of both growth and dividend stocks
7. Consider market cap for stability (prefer larger caps for conservative strategies)

Return ONLY a valid JSON array with this exact structure (no additional text):
[
  {
    "ticker": "AAPL",
    "weight": 15.5,
    "reason": "Strong growth potential and market leader"
  }
]

The weights must sum to exactly 100.0. Include a brief reason for each selection.`;

      try {
        // Call LLM to generate portfolio
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: "You are a professional portfolio manager. Return only valid JSON, no markdown formatting.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "portfolio_selection",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  selections: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        ticker: { type: "string", description: "Stock ticker symbol" },
                        weight: { type: "number", description: "Percentage weight in portfolio (0-100)" },
                        reason: { type: "string", description: "Brief reason for selection" },
                      },
                      required: ["ticker", "weight", "reason"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["selections"],
                additionalProperties: false,
              },
            },
          },
        });

        const content = response.choices[0]?.message?.content;
        if (!content || typeof content !== 'string') {
          throw new Error("No valid response from LLM");
        }

        const result = JSON.parse(content);
        const selections = result.selections || [];

        // Validate and normalize weights
        const totalWeight = selections.reduce((sum: number, s: any) => sum + s.weight, 0);
        const normalizedSelections = selections.map((s: any) => ({
          ...s,
          weight: (s.weight / totalWeight) * 100, // Normalize to exactly 100%
        }));

        // Enrich with stock data
        const enrichedSelections = normalizedSelections
          .map((selection: any) => {
            const stock = allStocks.find(s => s.ticker === selection.ticker);
            if (!stock) return null;

            return {
              ticker: stock.ticker,
              companyName: stock.companyName,
              weight: parseFloat(selection.weight.toFixed(2)),
              type: 'stock' as const,
              currentPrice: stock.currentPrice,
              currency: stock.currency || 'CHF',
              exchangeRateToChf: stock.exchangeRateToChf || '1',
              ytdPerformance: stock.ytdPerformance,
              dividendYield: stock.dividendYield,
              sector: stock.sector,
              reason: selection.reason,
            };
          })
          .filter(Boolean);

        // Final weight adjustment to ensure exactly 100%
        const finalTotalWeight = enrichedSelections.reduce((sum: number, s: any) => sum + s.weight, 0);
        if (Math.abs(finalTotalWeight - 100) > 0.01) {
          const adjustment = (100 - finalTotalWeight) / enrichedSelections.length;
          enrichedSelections.forEach((s: any) => {
            s.weight = parseFloat((s.weight + adjustment).toFixed(2));
          });
        }

        return {
          success: true,
          positions: enrichedSelections,
          metadata: {
            strategy: input.strategy,
            investmentHorizon: input.investmentHorizon,
            generatedAt: new Date().toISOString(),
          },
        };
      } catch (error: any) {
        console.error("Error generating portfolio:", error);
        throw new Error(`Failed to generate portfolio: ${error.message}`);
      }
    }),
});
