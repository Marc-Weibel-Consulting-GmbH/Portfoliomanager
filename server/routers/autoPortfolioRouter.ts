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
      const esgOnly = profile.esgOnly === 1;
      const liquidityNeedPct = profile.liquidityNeedPct ?? 0;
      const targetReturnPct = profile.targetReturnPct != null ? parseFloat(String(profile.targetReturnPct)) : null;

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
      //    PLUS: Watchlist-Empfehlungen (listType='empfehlung') werden bevorzugt einbezogen
      const { eq: eqOp } = await import("drizzle-orm");

      // Fetch watchlist recommendation tickers (vereinte stocks-Tabelle, listType='empfehlung')
      const watchlistRecs = await db
        .select({ ticker: stocksTable.ticker })
        .from(stocksTable)
        .where(eqOp(stocksTable.listType, "empfehlung"));
      const watchlistRecTickers = new Set(watchlistRecs.map((r: any) => r.ticker.toUpperCase()));

      // === SECTOR BENCHMARK FILTER ===
      // YTD performance of major sector ETFs (updated periodically, used to detect sector underperformers)
      // Source: approximate YTD returns for 2025 as of mid-year (updated manually or via cron)
      // These represent the "sector hurdle rate" — stocks must not lag their sector by >20%
      const SECTOR_BENCHMARK_YTD: Record<string, number> = {
        // Sector name (as stored in DB) → approximate YTD % of representative ETF
        "Technologie": 12.0,          // XLK / QQQ proxy
        "Technology": 12.0,
        "Informationstechnologie": 12.0,
        "Gesundheit": 4.0,            // XLV proxy
        "Healthcare": 4.0,
        "Gesundheitswesen": 4.0,
        "Finanzen": 8.0,              // XLF proxy
        "Financials": 8.0,
        "Finanzdienstleistungen": 8.0,
        "Industrie": 2.0,             // XLI proxy
        "Industrials": 2.0,
        "Konsumgüter": -2.0,          // XLP proxy (defensive consumer)
        "Consumer Staples": -2.0,
        "Nicht-zyklische Konsumgüter": -2.0,
        "Zyklische Konsumgüter": 0.0, // XLY proxy
        "Consumer Discretionary": 0.0,
        "Energie": -5.0,              // XLE proxy
        "Energy": -5.0,
        "Rohstoffe": -3.0,            // XLB proxy
        "Materials": -3.0,
        "Immobilien": 3.0,            // XLRE proxy
        "Real Estate": 3.0,
        "Versorger": 6.0,             // XLU proxy
        "Utilities": 6.0,
        "Kommunikation": 5.0,         // XLC proxy
        "Communication Services": 5.0,
        "Telekommunikation": 5.0,
        "Andere": 0.0,
      };
      const SECTOR_UNDERPERFORM_THRESHOLD = -20; // exclude if YTD < sectorBenchmark - 20pp

      const allStocks = await db.select().from(stocksTable);
      let universe = allStocks.filter((s: any) => {
        const price = parseFloat(s.currentPrice ?? "0");
        if (!(price > 0)) return false;
        if (s.sector && excludedSectors.includes(s.sector)) return false;
        // ESG-Filter: wenn esgOnly aktiviert, nur ESG-zertifizierte Titel
        if (esgOnly && !s.esgCertified) return false;

        // === SECTOR BENCHMARK FILTER ===
        // Exclude stocks that underperform their sector benchmark by more than 20 percentage points
        // Exception: watchlist recommendations are never excluded by this filter
        const ytdPerf = parseFloat(s.ytdPerformance ?? "0") || 0;
        const sectorKey = s.sector || "Andere";
        const sectorBenchmark = SECTOR_BENCHMARK_YTD[sectorKey] ?? 0;
        const relativePerf = ytdPerf - sectorBenchmark;
        if (relativePerf < SECTOR_UNDERPERFORM_THRESHOLD && !watchlistRecTickers.has(s.ticker.toUpperCase())) {
          // Log for debugging
          console.log(`[buildProposal] Sector filter excluded ${s.ticker}: YTD ${ytdPerf.toFixed(1)}% vs sector ${sectorKey} benchmark ${sectorBenchmark}% = ${relativePerf.toFixed(1)}pp`);
          return false;
        }

        return true;
      });
      // Sort: watchlist recommendations first, then by market cap
      universe.sort((a: any, b: any) => {
        const aRec = watchlistRecTickers.has(a.ticker.toUpperCase()) ? 1 : 0;
        const bRec = watchlistRecTickers.has(b.ticker.toUpperCase()) ? 1 : 0;
        if (bRec !== aRec) return bRec - aRec; // recommendations first
        return parseFloat(b.marketCap ?? "0") - parseFloat(a.marketCap ?? "0");
      });
      // Take top 40, but ensure all watchlist recommendations are included (up to 20 extra)
      const recStocks = universe.filter((s: any) => watchlistRecTickers.has(s.ticker.toUpperCase()));
      const nonRecStocks = universe.filter((s: any) => !watchlistRecTickers.has(s.ticker.toUpperCase()));
      universe = [...recStocks, ...nonRecStocks.slice(0, Math.max(0, 40 - recStocks.length))];

      // 4) Scoring aus watchlistStocks (signalScore + signalType) — kein Yahoo Finance, kein Preishistorie-Scoring
      //    Alle Watchlist-Titel haben bereits berechnete Scores (0-100) und Signale (buy/sell/hold)
      console.log(`[buildProposal] Step 4 start: loading scores for ${universe.length} tickers from watchlistStocks`);
      const t4 = Date.now();
      const universeTickers = universe.map((s: any) => s.ticker.toUpperCase());
      const { inArray } = await import("drizzle-orm");
      const watchlistScores = await db
        .select({
          ticker: stocksTable.ticker,
          signalScore: stocksTable.signalScore,
          signalType: stocksTable.signalType,
          sector: stocksTable.sector,
          dividendYield: stocksTable.dividendYield,
          rsi14: stocksTable.rsi14,
        })
        .from(stocksTable)
        .where(inArray(stocksTable.ticker, universeTickers));
      const watchlistScoreMap = new Map(watchlistScores.map((w: any) => [w.ticker.toUpperCase(), w]));
      console.log(`[buildProposal] scores loaded in ${Date.now()-t4}ms for ${watchlistScoreMap.size}/${universe.length} tickers`);

      // Map universe stocks to scored candidates using watchlistStocks data
      const scored = universe
        .map((s: any) => {
          const wl = watchlistScoreMap.get(s.ticker.toUpperCase());
          const rawScore = wl?.signalScore ?? s.signalScore ?? 50;
          const signalType = wl?.signalType ?? s.signalType ?? "hold";
          // Normalize signal to uppercase for consistency
          const signal = signalType === "buy" ? "BUY" : signalType === "sell" ? "SELL" : "HOLD";
          // Derive momentum/quality grades from score ranges
          const grade = (score: number) =>
            score >= 80 ? "A" : score >= 65 ? "B" : score >= 50 ? "C" : score >= 35 ? "D" : "F";

          // === ALGORITHM IMPROVEMENT: Momentum-adjusted score ===
          // YTD performance from DB (already stored as percentage, e.g. -20.9 or +12.0)
          const ytdPerf = parseFloat(s.ytdPerformance ?? "0") || 0;
          // Momentum bonus/penalty: +5 pts for YTD > +10%, -10 pts for YTD < -15%
          // This prevents selecting stocks with strong negative momentum
          let momentumAdj = 0;
          if (ytdPerf > 20) momentumAdj = 8;
          else if (ytdPerf > 10) momentumAdj = 5;
          else if (ytdPerf > 5) momentumAdj = 2;
          else if (ytdPerf < -20) momentumAdj = -15;
          else if (ytdPerf < -15) momentumAdj = -10;
          else if (ytdPerf < -10) momentumAdj = -5;

          // Goal-based adjustment: growth goal boosts momentum stocks
          let goalAdj = 0;
          if (goal === "growth" && ytdPerf > 5) goalAdj = 5;
          if (goal === "dividends" && ytdPerf < -5) goalAdj = -3; // dividend stocks with falling prices are risky

          const combinedScore = Math.max(0, Math.min(100, rawScore + momentumAdj + goalAdj));
          const momentumGrade = grade(combinedScore);
          const qualityGrade = grade(combinedScore - 5); // slight offset for quality
          return {
            stock: s,
            combinedScore,
            rawScore,
            ytdPerf,
            signal,
            momentumGrade,
            qualityGrade,
            dividendYield: parseFloat(wl?.dividendYield ?? s.dividendYield ?? "0"),
            regime: "normal" as const,
          };
        })
        .filter((x) => x.combinedScore > 0); // exclude unscored

      console.log(`[buildProposal] scored=${scored.length}/${universe.length}`);
      if (scored.length < 2) {
        throw new Error("Zu wenige bewertete Titel gefunden. Bitte aktualisieren Sie die Watchlist-Scores.");
      }

      console.log(`[buildProposal] Step 5: ranking ${scored.length} scored items`);
      // 5) Ranking (Ziel «dividends» bevorzugt Dividendenrendite) + Kaufsignal-Filter
      // Watchlist-Empfehlungen erhalten +10 Punkte Bonus im Ranking
      // IMPROVEMENT: YTD momentum factor in ranking (growth/balanced goals)
      const rankKey = (x: any) => {
        let score = x.combinedScore;
        // Dividend goal: boost high-yield stocks
        if (goal === "dividends") score += Math.min(x.dividendYield * 100, 5) * 2;
        // Growth/balanced goal: boost positive YTD momentum stocks
        if (goal !== "dividends" && x.ytdPerf > 0) score += Math.min(x.ytdPerf * 0.2, 5);
        // Watchlist recommendation bonus
        if (watchlistRecTickers.has(x.stock.ticker.toUpperCase())) score += 10;
        return score;
      };

      // SELL-Signale und schlechteste Qualität (F) grundsätzlich ausschliessen
      const isBuyable = (x: any) =>
        x.signal !== "SELL" &&
        x.qualityGrade !== "F" &&
        x.momentumGrade !== "F";

      // Score-Schwelle: 55 für echte Kaufkandidaten (vorher 45 war zu niedrig)
      let ranked = scored
        .filter((x) => isBuyable(x) && x.combinedScore >= 55)
        .sort((a, b) => rankKey(b) - rankKey(a));
      if (ranked.length < rules.minTitles) {
        // Zu wenige Kaufsignale — HOLD-Titel mit Score >= 45 einbeziehen, aber SELL bleibt draussen
        ranked = scored
          .filter((x) => x.signal !== "SELL" && x.qualityGrade !== "F" && x.combinedScore >= 45)
          .sort((a, b) => rankKey(b) - rankKey(a));
      }
      if (ranked.length < rules.minTitles) {
        // Letzter Fallback: alle Nicht-SELL, nach Score sortiert
        ranked = scored
          .filter((x) => x.signal !== "SELL")
          .sort((a, b) => rankKey(b) - rankKey(a));
      }

      console.log(`[buildProposal] Step 6: ranked=${ranked.length}, selecting under sector cap`);
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

      console.log(`[buildProposal] Step 7: weighting ${selected.length} selected positions`);
      // 7) Gewichtung: Score-proportional mit hartem 10%-Cap (DB-only, kein Yahoo Finance)
      // Diversifikationsregel: Max. 10% pro Position (unabhängig vom Admin-Default von 25%)
      const MAX_POSITION_WEIGHT = 0.10;
      const method = params.method;
      let weights: Record<string, number> = {};
      // Score-proportionale Gewichtung: höherer Score = höheres Gewicht
      // Zusätzlicher Bonus für Watchlist-Empfehlungen (+10 Punkte)
      const scoringWithBonus = selected.map((c) => ({
        ticker: c.stock.ticker,
        adjustedScore: c.combinedScore + (watchlistRecTickers.has(c.stock.ticker.toUpperCase()) ? 10 : 0),
      }));
      const total = scoringWithBonus.reduce((s, c) => s + c.adjustedScore, 0) || 1;
      scoringWithBonus.forEach((c) => { weights[c.ticker] = c.adjustedScore / total; });

      // Hartes Cap: Kein Titel darf mehr als 10% erhalten (auch nach Optimizer)
      const capAndRenormalize = (w: Record<string, number>) => {
        let changed = true;
        while (changed) {
          changed = false;
          const total = Object.values(w).reduce((s, v) => s + v, 0) || 1;
          const normalized: Record<string, number> = {};
          let cappedSum = 0;
          let uncappedSum = 0;
          for (const [t, v] of Object.entries(w)) {
            const norm = v / total;
            if (norm > MAX_POSITION_WEIGHT) {
              normalized[t] = MAX_POSITION_WEIGHT;
              cappedSum += MAX_POSITION_WEIGHT;
              changed = true;
            } else {
              normalized[t] = norm;
              uncappedSum += norm;
            }
          }
          if (changed && uncappedSum > 0) {
            const scale = (1 - cappedSum) / uncappedSum;
            for (const t of Object.keys(normalized)) {
              if (normalized[t] < MAX_POSITION_WEIGHT) normalized[t] *= scale;
            }
          }
          Object.assign(w, normalized);
          if (!changed) break;
        }
        return w;
      };
      weights = capAndRenormalize(weights);

      console.log(`[buildProposal] Step 8: building positions`);
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
              (c.ytdPerf !== 0 ? ` · YTD ${c.ytdPerf > 0 ? '+' : ''}${c.ytdPerf.toFixed(1)}%` : '') +
              (watchlistRecTickers.has(s.ticker.toUpperCase()) ? " · Watchlist-Empfehlung" : "") +
              (c.regime === "bubble" ? " · LPPL-Warnung" : ""),
          };
        })
        .sort((a, b) => b.weightPct - a.weightPct);

      // Cash-Quote berücksichtigen: Positionen auf (100 - liquidityNeedPct)% skalieren
      if (liquidityNeedPct > 0 && liquidityNeedPct < 100) {
        const equityPct = 1 - liquidityNeedPct / 100;
        positions.forEach((p) => { p.weightPct = parseFloat((p.weightPct * equityPct).toFixed(2)); });
      }

      console.log(`[buildProposal] Done: ${positions.length} positions built, returning result`);
      return {
        positions,
        method,
        methodLabel: method === "min_variance" ? "Min. Varianz" : "Max. Sharpe",
        profile: {
          riskProfile,
          investmentGoal: goal,
          excludedSectors,
          esgOnly,
          liquidityNeedPct,
          targetReturnPct,
        },
        stats: {
          universeCount: universe.length,
          scoredCount: scored.length,
          buySignals: scored.filter((x) => x.combinedScore >= 55 && x.signal !== "SELL").length,
          sellExcluded: scored.filter((x) => x.signal === "SELL").length,
          selectedCount: positions.length,
          watchlistRecommendations: positions.filter((p) => watchlistRecTickers.has(p.ticker.toUpperCase())).length,
          maxPositionPct: Math.max(...positions.map((p) => p.weightPct)),
          sectorBenchmarkFiltered: allStocks.length - universe.length - (excludedSectors.length > 0 ? 0 : 0),
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
