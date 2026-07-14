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
      const referenceCurrency: string = (profile.referenceCurrency as string | null) ?? 'CHF';
      // maxFxExposurePct: max. allowed foreign-currency weight (0-100). Default: 80% for aggressive, 50% for balanced/conservative
      const maxFxExposurePct: number = profile.maxFxExposurePct != null
        ? parseFloat(String(profile.maxFxExposurePct))
        : riskProfile === 'aggressiv' ? 80 : riskProfile === 'konservativ' ? 40 : 60;

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

      // Ehrliche Hinweise an den Kunden (Response-Feld `notes`).
      const notes: string[] = [];

      // ESG: Es gibt (noch) keine ESG-Daten im Bestand — der frühere Filter
      // (`s.esgCertified !== undefined`) war ein Placebo, der NIE griff. Statt
      // still nicht zu filtern, sagen wir es offen (und den Agenten, s. unten).
      if (esgOnly) {
        notes.push(
          "Ihr ESG-Wunsch ist hinterlegt, kann aber noch nicht angewendet werden — für die Titel liegen keine ESG-Daten vor. Der Vorschlag ist NICHT ESG-gefiltert."
        );
      }

      const allStocks = await db.select().from(stocksTable);

      // === SECTOR BENCHMARK FILTER ===
      // Hürde je Sektor = Median-YTD der Titel dieses Sektors im Bestand —
      // selbstaktualisierend aus der DB (vorher: hartkodierte 2025er-Schätzwerte,
      // die 2026 als Fantasie-Hürden weiterliefen). Titel, die ihren Sektor um
      // mehr als 20 Prozentpunkte unterlaufen, fliegen raus (ausser Empfehlungen).
      const SECTOR_UNDERPERFORM_THRESHOLD = -20;
      const ytdBySector: Record<string, number[]> = {};
      for (const s of allStocks as any[]) {
        const ytd = s.ytdPerformance != null ? parseFloat(String(s.ytdPerformance)) : NaN;
        if (!Number.isFinite(ytd)) continue;
        const key = s.sector || "Andere";
        (ytdBySector[key] ||= []).push(ytd);
      }
      const median = (arr: number[]) => {
        const a = [...arr].sort((x, y) => x - y);
        const mid = Math.floor(a.length / 2);
        return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
      };
      const sectorBenchmarkYtd: Record<string, number> = {};
      for (const [sec, vals] of Object.entries(ytdBySector)) {
        // Unter 3 Titeln ist ein Median keine Hürde — dann neutral 0.
        sectorBenchmarkYtd[sec] = vals.length >= 3 ? median(vals) : 0;
      }

      const universe = allStocks.filter((s: any) => {
        const price = parseFloat(s.currentPrice ?? "0");
        if (!(price > 0)) return false;
        if (s.sector && excludedSectors.includes(s.sector)) return false;

        // Sektor-Underperformer raus (Empfehlungen sind ausgenommen)
        const ytdPerf = parseFloat(s.ytdPerformance ?? "0") || 0;
        const sectorKey = s.sector || "Andere";
        const sectorBenchmark = sectorBenchmarkYtd[sectorKey] ?? 0;
        const relativePerf = ytdPerf - sectorBenchmark;
        if (relativePerf < SECTOR_UNDERPERFORM_THRESHOLD && !watchlistRecTickers.has(s.ticker.toUpperCase())) {
          console.log(`[buildProposal] Sector filter excluded ${s.ticker}: YTD ${ytdPerf.toFixed(1)}% vs sector ${sectorKey} median ${sectorBenchmark.toFixed(1)}% = ${relativePerf.toFixed(1)}pp`);
          return false;
        }

        return true;
      });
      // Kein Top-40-Marktkap-Schnitt mehr VOR dem Scoring: alle Daten sind
      // bereits geladen, das Scoring ist eine billige Map — ein hoch bewerteter
      // Titel auf «Rang 41» wurde vorher nie betrachtet. Die Begrenzung passiert
      // ehrlich NACH dem Ranking (Auswahl bis rules.maxTitles).

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

          // === ALGORITHM IMPROVEMENT v2: Momentum-adjusted score with NULL penalty ===
          // YTD performance from DB (already stored as percentage, e.g. -20.9 or +12.0)
          const ytdRaw = s.ytdPerformance;
          const ytdPerf = ytdRaw !== null && ytdRaw !== undefined ? parseFloat(String(ytdRaw)) || 0 : null;
          const ytdHasData = ytdPerf !== null;

          // Momentum bonus/penalty: +5 pts for YTD > +10%, -10 pts for YTD < -15%
          // NULL YTD = uncertainty penalty (-5 pts) — we don't know if it's performing
          let momentumAdj = 0;
          if (!ytdHasData) {
            momentumAdj = -5; // Uncertainty penalty for missing YTD data
          } else if (ytdPerf! > 20) momentumAdj = 8;
          else if (ytdPerf! > 10) momentumAdj = 5;
          else if (ytdPerf! > 5) momentumAdj = 2;
          else if (ytdPerf! < -20) momentumAdj = -15;
          else if (ytdPerf! < -15) momentumAdj = -10;
          else if (ytdPerf! < -10) momentumAdj = -5;

          // Goal-based adjustment: growth goal boosts momentum stocks, penalizes unknowns
          let goalAdj = 0;
          const ytdValue = ytdPerf ?? 0;
          if (goal === "growth") {
            if (ytdValue > 5) goalAdj = 5;
            if (!ytdHasData) goalAdj = -5; // growth needs known momentum
          }
          if (goal === "dividends") {
            if (ytdValue < -5) goalAdj = -3; // dividend stocks with falling prices are risky
            // Boost dividend yield for dividends goal
            const divYield = parseFloat(wl?.dividendYield ?? s.dividendYield ?? "0");
            if (divYield >= 4) goalAdj += 5;
            else if (divYield >= 2) goalAdj += 2;
            else if (divYield < 1) goalAdj -= 5; // penalize low-yield stocks in dividend portfolio
          }

          // Profile-based adjustment: konservativ prefers known, stable stocks
          let profileAdj = 0;
          if (riskProfile === "konservativ" && !ytdHasData) profileAdj = -3;
          if (riskProfile === "aggressiv" && ytdHasData && ytdValue > 10) profileAdj = 3;

          // FX penalty: non-reference-currency stocks get penalised based on risk profile
          const stockCurrency = (s.currency || 'CHF') === 'GBp' ? 'GBP' : (s.currency || 'CHF');
          const isForeignCurrency = stockCurrency !== referenceCurrency;
          let fxAdj = 0;
          if (isForeignCurrency) {
            if (riskProfile === 'konservativ') fxAdj = -8;  // strong penalty for conservative
            else if (riskProfile === 'ausgewogen') fxAdj = -4;
            else fxAdj = -2; // mild penalty for aggressive
          }

          const combinedScore = Math.max(0, Math.min(100, rawScore + momentumAdj + goalAdj + profileAdj + fxAdj));
          // OPT-2: EINE Note aus dem Score — die frühere separate «Qualitäts»-Note
          // war nur Score−5 (kosmetisch) und gaukelte eine zweite Dimension vor.
          const scoreGrade = grade(combinedScore);
          return {
            stock: s,
            combinedScore,
            rawScore,
            ytdPerf,
            signal,
            scoreGrade,
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
        // KEIN zusätzlicher YTD-Boost mehr: YTD-Momentum steckt bereits im
        // combinedScore (momentumAdj) und indirekt im signalScore (52W/RSI) —
        // die frühere dritte Zählung übersteuerte alles Richtung «was zuletzt lief».
        // Watchlist recommendation bonus
        if (watchlistRecTickers.has(x.stock.ticker.toUpperCase())) score += 10;
        return score;
      };

      // SELL-Signale und schlechteste Note (F) grundsätzlich ausschliessen
      const isBuyable = (x: any) =>
        x.signal !== "SELL" &&
        x.scoreGrade !== "F";

      // Score-Schwelle: 55 für echte Kaufkandidaten (vorher 45 war zu niedrig).
      // Die verwendete Qualitäts-Stufe wird ausgewiesen (stats.qualityTier) —
      // vorher wurde die Schwelle STILL gesenkt, ohne dass der Kunde es erfuhr.
      let qualityTier: "kaufkandidaten" | "erweitert" | "basis" = "kaufkandidaten";
      let ranked = scored
        .filter((x) => isBuyable(x) && x.combinedScore >= 55)
        .sort((a, b) => rankKey(b) - rankKey(a));
      if (ranked.length < rules.minTitles) {
        // Zu wenige Kaufsignale — HOLD-Titel mit Score >= 45 einbeziehen, aber SELL bleibt draussen
        qualityTier = "erweitert";
        ranked = scored
          .filter((x) => x.signal !== "SELL" && x.scoreGrade !== "F" && x.combinedScore >= 45)
          .sort((a, b) => rankKey(b) - rankKey(a));
      }
      if (ranked.length < rules.minTitles) {
        // Letzter Fallback: alle Nicht-SELL, nach Score sortiert
        qualityTier = "basis";
        ranked = scored
          .filter((x) => x.signal !== "SELL")
          .sort((a, b) => rankKey(b) - rankKey(a));
      }
      if (qualityTier !== "kaufkandidaten") {
        notes.push(
          qualityTier === "erweitert"
            ? "Zu wenige klare Kaufkandidaten (Score ≥ 55) — die Auswahl enthält auch neutrale Titel mit Score ≥ 45."
            : "Sehr wenige geeignete Kandidaten — die Auswahl umfasst alle Titel ohne Verkaufssignal, unabhängig vom Score."
        );
      }

      console.log(`[buildProposal] Step 6: ranked=${ranked.length}, selecting under sector cap`);
      // 6) Auswahl unter Sektor-Cap bis maxTitles + FX-Cap
      const target = Math.min(rules.maxTitles, ranked.length);
      const maxPerSector = Math.max(1, Math.floor((rules.maxSectorPercent / 100) * target));
      const selected: any[] = [];
      const sectorCount: Record<string, number> = {};
      let currentFxWeightPct = 0; // track accumulated foreign-currency weight estimate
      for (const c of ranked) {
        if (selected.length >= rules.maxTitles) break;
        // FX cap: estimate weight as 1/selected.length and check if adding this stock exceeds limit
        const estimatedWeight = 100 / Math.max(1, target);
        const stockCur = (c.stock.currency || 'CHF') === 'GBp' ? 'GBP' : (c.stock.currency || 'CHF');
        const isFx = stockCur !== referenceCurrency;
        if (isFx && currentFxWeightPct + estimatedWeight > maxFxExposurePct && selected.length >= rules.minTitles) {
          continue; // skip this foreign-currency stock if FX cap would be exceeded
        }
        const sec = c.stock.sector || "Andere";
        if ((sectorCount[sec] || 0) >= maxPerSector) continue;
        selected.push(c);
        sectorCount[sec] = (sectorCount[sec] || 0) + 1;
        if (isFx) currentFxWeightPct += estimatedWeight;
      }
      if (selected.length < 2) {
        throw new Error("Zu wenige geeignete Kandidaten nach Anwendung der Diversifikationsregeln.");
      }

      console.log(`[buildProposal] Step 7: weighting ${selected.length} selected positions`);
      // 7) Gewichtung (OPT-2, Audit 2026-07): ECHTE Optimierung über die
      // Analytics-Engine mit der Methode aus dem Risikoprofil und den
      // Profil-Caps aus optimizerParamsForProfile — vorher war die Gewichtung
      // score-proportional mit hartem 10%-Cap, aber als «Max. Sharpe/Min.
      // Varianz» etikettiert. Schlägt die Optimierung fehl (z. B. zu wenig
      // Kurshistorie), fällt sie auf die Score-Gewichtung zurück — dann aber
      // mit EHRLICHEM Label.
      // Das Anlageziel steuert jetzt auch das OPTIMIERUNGSZIEL: «Dividenden &
      // Ertrag» optimiert die Dividendenrendite (vol-bereinigt, max_dividend)
      // statt Max-Sharpe — vorher beeinflusste das Ziel nur die Titel-Auswahl.
      const method = goal === "dividends" ? "max_dividend" : params.method;
      const selectedTickers = selected.map((c) => c.stock.ticker);
      let weights: Record<string, number> = {};
      let weightingSource: "optimizer" | "score_fallback" = "optimizer";
      let weightingNote: string | null = null;
      // Erwartete Kennzahlen des optimierten Vorschlags (vorher weggeworfen —
      // der Kunde sah einen Vorschlag ohne «was darf ich erwarten?»).
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
        proposalMetrics = {
          expectedReturnPct: Math.round(opt.optimalPortfolio.expectedReturn * 1000) / 10,
          volatilityPct: Math.round(opt.optimalPortfolio.volatility * 1000) / 10,
          sharpe: opt.optimalPortfolio.sharpe,
        };
        const excluded = opt.excludedShortHistory ?? [];
        if (excluded.length > 0) {
          weightingNote =
            `Ohne ${excluded.map((e) => e.ticker).join(", ")} — zu wenig Kurshistorie für die Optimierung.`;
        }
      } catch (e: any) {
        weightingSource = "score_fallback";
        weightingNote = `Optimierung nicht möglich (${e?.message ?? "unbekannter Fehler"}) — Gewichtung score-proportional.`;
        console.warn(`[buildProposal] optimizePortfolio failed, score fallback: ${e?.message}`);
        // Score-proportionale Gewichtung mit Profil-Cap (nicht mehr hart 10%),
        // für kleine n auf ein erfüllbares Cap aufgeweitet (R-34-Logik).
        const maxCap = Math.max(params.maxPositionWeight, 1.2 / selected.length);
        const scoringWithBonus = selected.map((c) => ({
          ticker: c.stock.ticker,
          adjustedScore: c.combinedScore + (watchlistRecTickers.has(c.stock.ticker.toUpperCase()) ? 10 : 0),
        }));
        const total = scoringWithBonus.reduce((s, c) => s + c.adjustedScore, 0) || 1;
        scoringWithBonus.forEach((c) => { weights[c.ticker] = c.adjustedScore / total; });
        let changed = true;
        while (changed) {
          changed = false;
          const sum = Object.values(weights).reduce((s, v) => s + v, 0) || 1;
          const normalized: Record<string, number> = {};
          let cappedSum = 0;
          let uncappedSum = 0;
          for (const [t, v] of Object.entries(weights)) {
            const norm = v / sum;
            if (norm > maxCap) {
              normalized[t] = maxCap;
              cappedSum += maxCap;
              changed = true;
            } else {
              normalized[t] = norm;
              uncappedSum += norm;
            }
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
            exchangeRateToChf: s.exchangeRateToChf ? parseFloat(s.exchangeRateToChf) : 1,
            weightPct: parseFloat(((w / wSum) * 100).toFixed(2)),
            combinedScore: c.combinedScore,
            signal: c.signal,
            reason: `${c.signal} · Score-Note ${c.scoreGrade}` +
              (c.ytdPerf !== 0 && c.ytdPerf !== null ? ` · YTD ${c.ytdPerf > 0 ? '+' : ''}${c.ytdPerf.toFixed(1)}%` : '') +
              (watchlistRecTickers.has(s.ticker.toUpperCase()) ? " · Watchlist-Empfehlung" : "") +
              (c.regime === "bubble" ? " · LPPL-Warnung" : ""),
          };
        })
        .sort((a, b) => b.weightPct - a.weightPct);

      // Post-Optimierungs-Check: Sektor- und FX-GEWICHTE nachrechnen. Die Caps
      // in Schritt 6 zählen Titel bzw. schätzen Gleichgewichte — die echte
      // Optimierung kann beide verletzen. Statt still: berechnen, ausweisen, flaggen.
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
      if (fxWeightPct > maxFxExposurePct + 0.5) {
        notes.push(`Fremdwährungsanteil liegt nach der Optimierung bei ${fxWeightPct.toFixed(1)}% und damit über Ihrem FX-Limit von ${maxFxExposurePct}%.`);
      }

      // Cash-Quote berücksichtigen: Positionen auf (100 - liquidityNeedPct)% skalieren
      if (liquidityNeedPct > 0 && liquidityNeedPct < 100) {
        const equityPct = 1 - liquidityNeedPct / 100;
        positions.forEach((p) => { p.weightPct = parseFloat((p.weightPct * equityPct).toFixed(2)); });
      }

      console.log(`[buildProposal] Done: ${positions.length} positions built, returning result`);

      // ===================================================================
      // MULTI-AGENT CHALLENGE LAYER (3 Agenten: Selektor → Challenger → Synthesizer)
      // ===================================================================
      // Agent 2: Challenger — hinterfragt den deterministischen Vorschlag kritisch
      // Agent 3: Synthesizer — moderiert und erstellt finalen Vorschlag mit Begründung
      // Beide Agenten laufen parallel-sequenziell nach dem deterministischen Selektor.
      // Das Ergebnis wird als `challengeReport` im Return-Objekt mitgeliefert.
      let challengeReport: {
        challengerCritique: string;
        challengerRejected: Array<{ ticker: string; reason: string }>;
        challengerAlternatives: Array<{ ticker: string; reason: string }>;
        synthesizerVerdict: string;
        finalAdjustments: Array<{ ticker: string; action: 'keep' | 'replace' | 'reduce' | 'increase'; reason: string }>;
        overallConfidence: 'hoch' | 'mittel' | 'niedrig';
        agentDuration: number;
      } | null = null;

      try {
        const agentStart = Date.now();

        // Prepare compact position summary for agents
        const positionSummary = positions.map(p => ({
          ticker: p.ticker,
          name: p.companyName,
          sector: p.sector,
          currency: p.currency,
          weight: p.weightPct,
          score: p.combinedScore,
          signal: p.signal,
          ytd: (p as any).ytdPerf ?? null,
          reason: p.reason,
        }));

        // Alternativen-Pool für den Challenger: nur KAUFBARE Kandidaten (kein
        // SELL, Note ≥ E, Score ≥ 45), nach Score sortiert. Vorher: die ersten
        // 15 nicht gewählten Titel in Marktkap-Reihenfolge — inklusive
        // Verkaufskandidaten, die der Challenger dann als «bessere Alternative»
        // vorschlagen konnte.
        const candidatePool = scored
          .filter(x => !positions.find(p => p.ticker === x.stock.ticker))
          .filter(x => isBuyable(x) && x.combinedScore >= 45)
          .sort((a, b) => b.combinedScore - a.combinedScore)
          .slice(0, 15)
          .map(x => ({ ticker: x.stock.ticker, name: x.stock.companyName, sector: x.stock.sector, score: x.combinedScore, signal: x.signal }));

        // Ehrliches Profil (ESG-Wunsch ist NICHT angewendet — s. notes) +
        // BERECHNETE Fakten, damit die Agenten Klumpenrisiken nicht aus der
        // Positionsliste raten müssen.
        const profileSummary =
          `Risikoprofil: ${riskProfile}, Ziel: ${goal}, Referenzwährung: ${referenceCurrency}, FX-Limit: ${maxFxExposurePct}%` +
          (esgOnly ? ", ESG-Wunsch: ja (Filter noch NICHT verfügbar — Vorschlag ist nicht ESG-gefiltert)" : "");
        const factsSummary = [
          `Sektor-Gewichte: ${sectorWeights.map((s) => `${s.name} ${s.weightPct.toFixed(1)}%`).join(", ")} (Limit je Sektor: ${rules.maxSectorPercent}%)`,
          `Fremdwährungsanteil: ${fxWeightPct.toFixed(1)}% (Limit: ${maxFxExposurePct}%)`,
          proposalMetrics
            ? `Erwartete Kennzahlen (optimiert, historisch geschätzt): Rendite ${proposalMetrics.expectedReturnPct.toFixed(1)}% p.a., Volatilität ${proposalMetrics.volatilityPct.toFixed(1)}%, Sharpe ${proposalMetrics.sharpe.toFixed(2)}`
            : `Gewichtung: Score-Fallback (Optimierung nicht möglich)`,
          `Auswahl-Qualitätsstufe: ${qualityTier}`,
        ].join("\n");

        // ---- AGENT 2: CHALLENGER ----
        console.log('[buildProposal] Agent 2 (Challenger) starting...');
        const challengerResponse = await invokeLLM({
          messages: [
            {
              role: 'system',
              content: `Du bist ein kritischer Portfolio-Analyst ("Challenger"). Deine Aufgabe ist es, einen algorithmisch erstellten Portfolio-Vorschlag zu hinterfragen und Schwachstellen zu identifizieren. Antworte immer auf Deutsch. Sei präzise und konstruktiv kritisch — nicht destruktiv. Fokussiere auf: Klumpenrisiken, fehlende Diversifikation, fragwürdige Einzeltitel, Widersprüche zum Anlegerprofil.`,
            },
            {
              role: 'user',
              content: `Analysiere diesen Portfolio-Vorschlag kritisch:

Anlegerprofil: ${profileSummary}

Berechnete Fakten (nutze diese Zahlen — nicht schätzen):
${factsSummary}

Vorgeschlagene Positionen:
${JSON.stringify(positionSummary, null, 2)}

Verfügbare Alternativen (nicht ausgewählt; NUR diese Ticker dürfen als Alternativen vorgeschlagen werden):
${JSON.stringify(candidatePool, null, 2)}

Identifiziere:
1. Welche 1-3 Titel würdest du NICHT nehmen? (mit konkreter Begründung)
2. Welche 1-3 Alternativen aus dem Kandidatenpool wären besser geeignet?
3. Gibt es Klumpenrisiken (Sektor/Währung/Korrelation)?

Antworte im JSON-Format.`,
            },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'challenger_analysis',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  critique: { type: 'string', description: 'Gesamteinschätzung in 2-3 Sätzen' },
                  rejected: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        ticker: { type: 'string' },
                        reason: { type: 'string' },
                      },
                      required: ['ticker', 'reason'],
                      additionalProperties: false,
                    },
                  },
                  alternatives: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        ticker: { type: 'string' },
                        reason: { type: 'string' },
                      },
                      required: ['ticker', 'reason'],
                      additionalProperties: false,
                    },
                  },
                },
                required: ['critique', 'rejected', 'alternatives'],
                additionalProperties: false,
              },
            },
          },
        });

        const challengerContent = challengerResponse.choices[0]?.message?.content as string | undefined;
        const challengerResult = challengerContent ? JSON.parse(challengerContent) : { critique: '', rejected: [], alternatives: [] };
        // Ticker-Validierung: abgelehnte Titel müssen im Vorschlag existieren,
        // Alternativen im Kandidaten-Pool — halluzinierte Ticker fliegen raus.
        const positionTickers = new Set(positions.map((p) => p.ticker.toUpperCase()));
        const poolTickers = new Set(candidatePool.map((c) => c.ticker.toUpperCase()));
        challengerResult.rejected = (challengerResult.rejected ?? []).filter(
          (r: any) => r?.ticker && positionTickers.has(String(r.ticker).toUpperCase())
        );
        challengerResult.alternatives = (challengerResult.alternatives ?? []).filter(
          (a: any) => a?.ticker && poolTickers.has(String(a.ticker).toUpperCase())
        );
        console.log(`[buildProposal] Agent 2 done: rejected=${challengerResult.rejected.length}, alternatives=${challengerResult.alternatives.length}`);

        // ---- AGENT 3: SYNTHESIZER ----
        console.log('[buildProposal] Agent 3 (Synthesizer) starting...');
        const synthesizerResponse = await invokeLLM({
          messages: [
            {
              role: 'system',
              content: `Du bist ein erfahrener Portfolio-Manager ("Synthesizer"). Du erhältst einen algorithmischen Portfolio-Vorschlag und eine kritische Analyse eines Challengers. Deine Aufgabe: Moderiere die Erkenntnisse, entscheide welche Kritikpunkte berechtigt sind, und erstelle eine finale Empfehlung mit konkreten Anpassungsvorschlägen. Antworte immer auf Deutsch. Sei ausgewogen — nicht jede Kritik des Challengers ist berechtigt.`,
            },
            {
              role: 'user',
              content: `Algorithmischer Vorschlag:
${JSON.stringify(positionSummary, null, 2)}

Berechnete Fakten (nutze diese Zahlen — nicht schätzen):
${factsSummary}

Challenger-Kritik:
Gesamteinschätzung: ${challengerResult.critique}
Abgelehnte Titel: ${JSON.stringify(challengerResult.rejected)}
Alternativen: ${JSON.stringify(challengerResult.alternatives)}

Anlegerprofil: ${profileSummary}

Erstelle:
1. Dein Gesamturteil (2-3 Sätze): Ist der Vorschlag gut? Was sind die wichtigsten Stärken/Schwächen?
2. Konkrete Anpassungen: Für jeden Titel: behalten/reduzieren/erhöhen/ersetzen?
3. Gesamtvertrauen in den Vorschlag: hoch/mittel/niedrig

Antworte im JSON-Format.`,
            },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'synthesizer_verdict',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  verdict: { type: 'string', description: 'Gesamturteil in 2-3 Sätzen' },
                  adjustments: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        ticker: { type: 'string' },
                        action: { type: 'string', enum: ['keep', 'replace', 'reduce', 'increase'] },
                        reason: { type: 'string' },
                      },
                      required: ['ticker', 'action', 'reason'],
                      additionalProperties: false,
                    },
                  },
                  overallConfidence: { type: 'string', enum: ['hoch', 'mittel', 'niedrig'] },
                },
                required: ['verdict', 'adjustments', 'overallConfidence'],
                additionalProperties: false,
              },
            },
          },
        });

        const synthContent = synthesizerResponse.choices[0]?.message?.content as string | undefined;
        const synthResult = synthContent ? JSON.parse(synthContent) : { verdict: '', adjustments: [], overallConfidence: 'mittel' };
        // Ticker-Validierung: Anpassungen nur für Titel aus Vorschlag oder Pool.
        synthResult.adjustments = (synthResult.adjustments ?? []).filter((adj: any) => {
          const t = adj?.ticker ? String(adj.ticker).toUpperCase() : "";
          return t && (positionTickers.has(t) || poolTickers.has(t));
        });
        const agentDuration = Date.now() - agentStart;
        console.log(`[buildProposal] Agent 3 done: confidence=${synthResult.overallConfidence}, duration=${agentDuration}ms`);

        challengeReport = {
          challengerCritique: challengerResult.critique,
          challengerRejected: challengerResult.rejected,
          challengerAlternatives: challengerResult.alternatives,
          synthesizerVerdict: synthResult.verdict,
          finalAdjustments: synthResult.adjustments,
          overallConfidence: synthResult.overallConfidence as 'hoch' | 'mittel' | 'niedrig',
          agentDuration,
        };
      } catch (agentErr: any) {
        console.warn(`[buildProposal] Multi-agent layer failed (non-fatal): ${agentErr?.message}`);
        // challengeReport bleibt null — deterministischer Vorschlag wird ohne Challenge zurückgegeben
      }

      return {
        positions,
        method,
        // OPT-2: Das Label sagt jetzt die Wahrheit — «Max. Sharpe/Min. Varianz/
        // Max. Dividende» nur, wenn wirklich optimiert wurde; sonst «Score-gewichtet».
        methodLabel: weightingSource === "optimizer"
          ? (method === "min_variance" ? "Min. Varianz" : method === "max_dividend" ? "Max. Dividende" : "Max. Sharpe")
          : "Score-gewichtet (Fallback)",
        weighting: {
          source: weightingSource,
          note: weightingNote,
          minPositionPct: Math.round(params.minPositionWeight * 1000) / 10,
          maxPositionPct: Math.round(params.maxPositionWeight * 1000) / 10,
        },
        // Erwartete Kennzahlen des optimierten Vorschlags (null bei Score-Fallback).
        metrics: proposalMetrics,
        // Nachgerechnete Allokation (Basis: Aktienanteil = 100 %, vor Cash-Quote).
        allocation: {
          sectors: sectorWeights,
          fxWeightPct,
          sectorCapPct: rules.maxSectorPercent,
          fxCapPct: maxFxExposurePct,
        },
        // Ehrliche Hinweise (ESG nicht verfügbar, Qualitätsstufe gesenkt,
        // Cap-Überschreitungen nach Optimierung, ...).
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
          buySignals: scored.filter((x) => x.combinedScore >= 55 && x.signal !== "SELL").length,
          sellExcluded: scored.filter((x) => x.signal === "SELL").length,
          selectedCount: positions.length,
          watchlistRecommendations: positions.filter((p) => watchlistRecTickers.has(p.ticker.toUpperCase())).length,
          maxPositionPct: Math.max(...positions.map((p) => p.weightPct)),
          sectorBenchmarkFiltered: allStocks.length - universe.length - (excludedSectors.length > 0 ? 0 : 0),
          qualityTier,
        },
        challengeReport,
      };
    }),

  // Der frühere LLM-Endpoint `generatePortfolio` (gesamte Aktientabelle an ein
  // LLM, Gewichte vom Modell geraten) wurde von keiner Client-Seite aufgerufen
  // und ist entfernt — der echte Pfad ist buildProposal (deterministisch
  // + optimiert + Challenge-Layer).
});
