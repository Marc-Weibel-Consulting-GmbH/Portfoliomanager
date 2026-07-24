import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";

/**
 * F4: Automatischer Portfolio-Vorschlag (deterministisch + optimiert).
 *
 * Pipeline: Anlageprofil → DiversificationRules → Universum aus stocks
 * → Scoring (Signal 60 % / Fundamental 40 %, Momentum-Adjust) → Ranking
 * → Selektion mit Sektor-/FX-Caps → optimizePortfolio (max_sharpe |
 * min_variance | max_dividend) → Fallback auf Score-proportionale Gewichtung
 * → Cash-Quote (liquidityNeedPct).
 *
 * Fehlerbild: bei < 2 Kandidaten klare Fehlermeldung (kein leeres Portfolio).
 */
export const autoPortfolioRouter = router({
  buildProposal: protectedProcedure
    .input(z.object({ investmentAmount: z.number().positive().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      const { requireFeature } = await import("../lib/entitlements");
      await requireFeature(ctx.user, "auto_portfolio");

      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new Error("Datenbank nicht verfügbar");

      const { eq, and, gte, asc } = await import("drizzle-orm");
      const { userInvestmentProfile, stocks: stocksTable, historicalPrices } = await import("../../drizzle/schema");

      // 0) Anlageprofil
      const [profile] = await db
        .select()
        .from(userInvestmentProfile)
        .where(eq(userInvestmentProfile.userId, ctx.user.id))
        .limit(1);
      if (!profile) {
        throw new Error("Kein Anlageprofil hinterlegt. Bitte legen Sie zuerst unter Einstellungen › Anlageprofil Ihr Risikoprofil und Ihre Anlageziele fest.");
      }
      const excludedSectors: string[] = (profile.excludedSectors as string[] | null) ?? [];
      const goal = profile.investmentGoal;
      const riskProfile = profile.riskProfile;
      const esgOnly = profile.esgOnly === 1;
      const liquidityNeedPct = profile.liquidityNeedPct ?? 0;
      const targetReturnPct = profile.targetReturnPct != null ? parseFloat(String(profile.targetReturnPct)) : null;
      const referenceCurrency: string = (profile.referenceCurrency as string | null) ?? "CHF";
      const maxFxExposurePct: number = profile.maxFxExposurePct != null
        ? parseFloat(String(profile.maxFxExposurePct))
        : riskProfile === "aggressiv" ? 80 : riskProfile === "konservativ" ? 40 : 60;

      // DiversificationRules (Admin-konfigurierbar)
      const { getDiversificationRules } = await import("../lib/diversificationRules");
      const rules = await getDiversificationRules();

      // Profil-abhängige Optimizer-Parameter
      const { optimizerParamsForProfile } = await import("../lib/profileOptimizerParams");
      const params = optimizerParamsForProfile(
        { riskProfile, maxDrawdownTolerancePct: profile.maxDrawdownTolerancePct, investmentHorizonYears: profile.investmentHorizonYears },
        rules,
      );

      const notes: string[] = [];
      if (esgOnly) {
        notes.push("Ihr ESG-Wunsch ist hinterlegt, kann aber noch nicht angewendet werden — für die Titel liegen keine ESG-Daten vor. Der Vorschlag ist NICHT ESG-gefiltert.");
      }

      // 1) Universum aus DB (Sektor-Ausschlüsse + Preis vorhanden)
      const allStocks = await db.select().from(stocksTable);
      const universe = allStocks.filter((s: any) => {
        const price = parseFloat(s.currentPrice ?? "0");
        if (!(price > 0)) return false;
        if (s.sector && excludedSectors.includes(s.sector)) return false;
        return true;
      });
      if (universe.length < 2) {
        throw new Error("Zu wenige Titel im Universum (nach Filtern). Bitte Watchlist/Universum erweitern.");
      }

      // 2) Scoring: Signal 60 % + Fundamental 40 %, Momentum-Adjust über YTD
      const scored = universe
        .map((s: any) => {
          const signalScore = s.signalScore ?? 50;
          const fundamentalScore = s.fundamentalScore ?? 50;
          const rawScore = 0.6 * signalScore + 0.4 * fundamentalScore;
          const ytdPerf = s.ytdPerformance != null ? parseFloat(String(s.ytdPerformance)) : null;
          let momentumAdj = 0;
          if (ytdPerf === null) momentumAdj = -5;
          else if (ytdPerf > 20) momentumAdj = 8;
          else if (ytdPerf > 10) momentumAdj = 5;
          else if (ytdPerf > 5) momentumAdj = 2;
          else if (ytdPerf < -20) momentumAdj = -15;
          else if (ytdPerf < -15) momentumAdj = -10;
          else if (ytdPerf < -10) momentumAdj = -5;
          let goalAdj = 0;
          const dividendYield = s.dividendYield != null ? parseFloat(String(s.dividendYield)) : 0;
          if (goal === "dividends") {
            if (dividendYield >= 4) goalAdj += 5;
            else if (dividendYield >= 2) goalAdj += 2;
            else if (dividendYield < 1) goalAdj -= 5;
          }
          const stockCurrency = (s.currency || "CHF") === "GBp" ? "GBP" : (s.currency || "CHF");
          const isForeignCurrency = stockCurrency !== referenceCurrency;
          let fxAdj = 0;
          if (isForeignCurrency) {
            if (riskProfile === "konservativ") fxAdj = -8;
            else if (riskProfile === "ausgewogen") fxAdj = -4;
            else fxAdj = -2;
          }
          const combinedScore = Math.max(0, Math.min(100, rawScore + momentumAdj + goalAdj + fxAdj));
          const grade = (score: number) => score >= 80 ? "A" : score >= 65 ? "B" : score >= 50 ? "C" : score >= 35 ? "D" : "F";
          const signalType = s.signalType ?? "hold";
          const signal = signalType === "buy" ? "BUY" : signalType === "sell" ? "SELL" : "HOLD";
          return {
            stock: s,
            combinedScore,
            ytdPerf,
            signal,
            scoreGrade: grade(combinedScore),
            dividendYield,
          };
        })
        .filter((x) => x.combinedScore > 0);
      if (scored.length < 2) {
        throw new Error("Zu wenige bewertete Titel gefunden. Bitte Scores aktualisieren.");
      }

      // 3) Ranking + Selektion unter Sektor-Cap
      const rankKey = (x: any) => {
        let score = x.combinedScore;
        if (goal === "dividends") score += Math.min(x.dividendYield * 100, 5) * 2;
        return score;
      };
      const isBuyable = (x: any) => x.signal !== "SELL" && x.scoreGrade !== "F";
      const stableSort = (arr: any[]) =>
        arr.sort((a, b) => {
          const diff = rankKey(b) - rankKey(a);
          if (diff !== 0) return diff;
          return (a.stock.ticker as string).localeCompare(b.stock.ticker as string);
        });
      let qualityTier: "kaufkandidaten" | "erweitert" | "basis" = "kaufkandidaten";
      let ranked = stableSort(scored.filter((x) => isBuyable(x) && x.combinedScore >= 55));
      if (ranked.length < rules.minTitles) {
        qualityTier = "erweitert";
        ranked = stableSort(scored.filter((x) => x.signal !== "SELL" && x.scoreGrade !== "F" && x.combinedScore >= 45));
      }
      if (ranked.length < rules.minTitles) {
        qualityTier = "basis";
        ranked = stableSort(scored.filter((x) => x.signal !== "SELL"));
      }
      if (qualityTier !== "kaufkandidaten") {
        notes.push(
          qualityTier === "erweitert"
            ? "Zu wenige klare Kaufkandidaten (Score ≥ 55) — die Auswahl enthält auch neutrale Titel mit Score ≥ 45."
            : "Sehr wenige geeignete Kandidaten — die Auswahl umfasst alle Titel ohne Verkaufssignal, unabhängig vom Score."
        );
      }

      const target = Math.min(rules.maxTitles, ranked.length);
      const maxPerSector = Math.max(1, Math.floor((rules.maxSectorPercent / 100) * target));
      const selected: any[] = [];
      const sectorCount: Record<string, number> = {};
      let currentFxWeightPct = 0;
      for (const c of ranked) {
        if (selected.length >= rules.maxTitles) break;
        const estimatedWeight = 100 / Math.max(1, target);
        const stockCur = (c.stock.currency || "CHF") === "GBp" ? "GBP" : (c.stock.currency || "CHF");
        const isFx = stockCur !== referenceCurrency;
        if (isFx && currentFxWeightPct + estimatedWeight > maxFxExposurePct && selected.length >= rules.minTitles) continue;
        const sec = c.stock.sector || "Andere";
        if ((sectorCount[sec] || 0) >= maxPerSector) continue;
        selected.push(c);
        sectorCount[sec] = (sectorCount[sec] || 0) + 1;
        if (isFx) currentFxWeightPct += estimatedWeight;
      }
      if (selected.length < 2) {
        throw new Error("Zu wenige geeignete Kandidaten nach Anwendung der Diversifikationsregeln.");
      }

      // 4) Gewichtung via optimizePortfolio (Fallback: Score-proportional)
      const method = goal === "dividends" ? "max_dividend" : params.method;
      const selectedTickers = selected.map((c) => c.stock.ticker);
      let weights: Record<string, number> = {};
      let weightingSource: "optimizer" | "score_fallback" = "optimizer";
      let weightingNote: string | null = null;
      let proposalMetrics: { expectedReturnPct: number; volatilityPct: number; sharpe: number } | null = null;
      try {
        const { optimizePortfolio } = await import("../analytics/engine");
        const opt = await optimizePortfolio({
          tickers: selectedTickers,
          method,
          minPositionWeight: params.minPositionWeight,
          maxPositionWeight: params.maxPositionWeight,
        });
        weights = { ...opt.weights };
        const rawReturn = opt.optimalPortfolio.expectedReturn;
        const rawVol = opt.optimalPortfolio.volatility;
        const rawSharpe = opt.optimalPortfolio.sharpe;
        if (Number.isFinite(rawReturn) && Number.isFinite(rawVol) && Number.isFinite(rawSharpe)) {
          proposalMetrics = {
            expectedReturnPct: Math.round(rawReturn * 1000) / 10,
            volatilityPct: Math.round(rawVol * 1000) / 10,
            sharpe: rawSharpe,
          };
        }
      } catch (e: any) {
        weightingSource = "score_fallback";
        weightingNote = `Optimierung nicht möglich (${e?.message ?? "unbekannter Fehler"}) — Gewichtung score-proportional.`;
        const maxCap = Math.max(params.maxPositionWeight, 1.2 / selected.length);
        const total = selected.reduce((s, c) => s + c.combinedScore, 0) || 1;
        selected.forEach((c) => { weights[c.stock.ticker] = c.combinedScore / total; });
        let changed = true;
        while (changed) {
          changed = false;
          const sum = Object.values(weights).reduce((s, v) => s + v, 0) || 1;
          const normalized: Record<string, number> = {};
          let cappedSum = 0;
          let uncappedSum = 0;
          for (const [t, v] of Object.entries(weights)) {
            const norm = v / sum;
            if (norm > maxCap) { normalized[t] = maxCap; cappedSum += maxCap; changed = true; }
            else { normalized[t] = norm; uncappedSum += norm; }
          }
          if (changed && uncappedSum > 0) {
            const scale = (1 - cappedSum) / uncappedSum;
            for (const t of Object.keys(normalized)) {
              if (normalized[t] < maxCap) normalized[t] *= scale;
            }
          }
          Object.assign(weights, normalized);
        }
      }

      // 5) Positionen
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
            exchangeRateToChf: s.exchangeRateToChf ? parseFloat(s.exchangeRateToChf) : 1,
            weightPct: parseFloat(((w / wSum) * 100).toFixed(2)),
            combinedScore: c.combinedScore,
            signal: c.signal,
            reason: `${c.signal} · Score-Note ${c.scoreGrade}` +
              (c.ytdPerf !== 0 && c.ytdPerf !== null ? ` · YTD ${c.ytdPerf > 0 ? "+" : ""}${c.ytdPerf.toFixed(1)}%` : ""),
          };
        })
        .sort((a, b) => b.weightPct - a.weightPct);

      // Sektor-/FX-Gewichte nachrechnen
      const sectorWeightMap: Record<string, number> = {};
      let fxWeightPct = 0;
      for (const p of positions) {
        sectorWeightMap[p.sector] = (sectorWeightMap[p.sector] || 0) + p.weightPct;
        const cur = p.currency === "GBp" ? "GBP" : p.currency;
        if (cur !== referenceCurrency) fxWeightPct += p.weightPct;
      }
      fxWeightPct = Math.round(fxWeightPct * 10) / 10;
      const sectorWeights = Object.entries(sectorWeightMap)
        .map(([name, weightPct]) => ({ name, weightPct: Math.round(weightPct * 10) / 10 }))
        .sort((a, b) => b.weightPct - a.weightPct);
      for (const sw of sectorWeights) {
        if (sw.weightPct > rules.maxSectorPercent + 0.5) {
          notes.push(`Sektor ${sw.name} liegt nach der Optimierung bei ${sw.weightPct.toFixed(1)}% und damit über dem Sektor-Limit von ${rules.maxSectorPercent}%.`);
        }
      }

      // Cash-Quote
      if (liquidityNeedPct > 0 && liquidityNeedPct < 100) {
        const equityPct = 1 - liquidityNeedPct / 100;
        positions.forEach((p) => { p.weightPct = parseFloat((p.weightPct * equityPct).toFixed(2)); });
      }

      return {
        positions,
        method,
        methodLabel: weightingSource === "optimizer"
          ? (method === "min_variance" ? "Min. Varianz" : method === "max_dividend" ? "Max. Dividende" : "Max. Sharpe")
          : "Score-gewichtet (Fallback)",
        weighting: {
          source: weightingSource,
          note: weightingNote,
          minPositionPct: Math.round(params.minPositionWeight * 1000) / 10,
          maxPositionPct: Math.round(params.maxPositionWeight * 1000) / 10,
        },
        metrics: proposalMetrics,
        allocation: {
          sectors: sectorWeights,
          fxWeightPct,
          sectorCapPct: rules.maxSectorPercent,
          fxCapPct: maxFxExposurePct,
        },
        notes,
        profile: {
          riskProfile,
          investmentGoal: goal,
          excludedSectors,
          esgOnly,
          liquidityNeedPct,
          targetReturnPct,
          referenceCurrency,
          maxFxExposurePct,
        },
        stats: {
          universeCount: universe.length,
          scoredCount: scored.length,
          selectedCount: positions.length,
          qualityTier,
        },
      };
    }),
});
