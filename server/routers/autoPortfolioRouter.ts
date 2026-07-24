import { router, protectedProcedure } from "../_core/trpc";
import { randomUUID } from "crypto";
import { z } from "zod";
import { invokeLLM, invokeKimi } from "../_core/llm";
import { getProposalModelConfig, invokeProposalAgent } from "../lib/proposalModels";
import {
  getMarktHubSignals,
  getSectorTilts,
  getSectorTiltForStock,
  getFactorTilt,
  buildMarktHubContext,
  describeSectorTilts,
  type MarktHubSignals,
} from "../lib/marktHubSignals";

// ── In-memory proposal job registry ──────────────────────────────────────────
// Stores running/completed proposal jobs per user. TTL: 30 minutes.
type ProposalJobStatus = 'running' | 'enhancing' | 'done' | 'error';
interface ProposalJob {
  status: ProposalJobStatus;
  progress: string[];
  result: any | null;
  error: string | null;
  userId: number;
  startedAt: number;
}
const proposalJobs = new Map<string, ProposalJob>();
const PROPOSAL_JOB_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Cleanup expired jobs every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, job] of proposalJobs.entries()) {
    if (now - job.startedAt > PROPOSAL_JOB_TTL_MS) {
      proposalJobs.delete(id);
    }
  }
}, 10 * 60 * 1000);

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
      // K-A1: KI-Auto-Portfolio ist ein Plus/Pro-Feature (No-op im Soft-Launch).
      const { requireFeature } = await import("../lib/entitlements");
      await requireFeature(ctx.user, "auto_portfolio");

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

      // 2b) Markt-Hub-Signale laden (Makro + Regime + MSCI-Faktoren + Marktbericht)
      // Fehlertolerant: bei DB-Fehler werden Neutral-Werte zurückgegeben.
      let marktHubSignals: MarktHubSignals;
      try {
        marktHubSignals = await getMarktHubSignals();
        console.log(`[buildProposal] Markt-Hub geladen: Regime=${marktHubSignals.regime.regime}, hasData=${marktHubSignals.hasData}, leadingFactor=${marktHubSignals.factors.leadingFactor ?? 'n/a'}`);
      } catch (mhErr: any) {
        console.warn('[buildProposal] Markt-Hub-Signale nicht verfügbar (non-fatal):', mhErr?.message);
        marktHubSignals = {
          macro: { yieldCurveSpread: null, coreCpi: null, fedFundsRate: null, dgs10: null, hySpread: null, chfUsd: null },
          regime: { regime: 'Neutral', overallScore: 0, equityAllocation: 60, regimeMultiplier: 1.0 },
          factors: { valueYtd: null, momentumYtd: null, qualityYtd: null, minVolYtd: null, leadingFactor: null },
          latestReportSummary: null, latestReportDate: null, hasData: false, fetchedAt: new Date().toISOString(),
        };
      }
      const sectorTilts = getSectorTilts(marktHubSignals);
      // K1 (Learning-Koordination): eine risikofreie Wahrheit — zentraler
      // FRED-DGS10-Satz (lib/riskFreeRate), identisch mit Qualitäts-Snapshot
      // und analytics.optimize (vorher rechnete jeder Pfad anders).
      const { getRiskFreeRate } = await import("../lib/riskFreeRate");
      const dynamicRiskFreeRate = await getRiskFreeRate();
      console.log(`[buildProposal] Sektor-Tilts: ${describeSectorTilts(sectorTilts)}, riskFreeRate=${(dynamicRiskFreeRate * 100).toFixed(2)}%`);

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

      // Handelbarkeits-Filter: Mindest-Marktkapitalisierung (in Mrd. USD-Äquivalent).
      // Kleine Nebenwerte (< 500 Mio.) werden ausgeschlossen — zu geringe Liquidität
      // für ein institutionell verwaltetes Portfolio. Empfehlungen sind ausgenommen.
      const MIN_MARKET_CAP_M = 500; // CHF-Millionen-Äquivalent

      // K-03 (Audit-Fix): Blacklist für nicht-investierbare Instrumente
      // (Börsenbetreiber, Index-Zertifikate, etc.)
      const TICKER_BLACKLIST = new Set([
        'GPW', 'GPW.WA',   // Warschauer Börsenbetreiber
        'DB1', 'DB1.DE',   // Deutsche Börse
        'LSE', 'LSE.L',    // London Stock Exchange
        'ICE',             // Intercontinental Exchange
        'CME',             // CME Group
        'CBOE',            // Cboe Global Markets
        'NDAQ',            // Nasdaq Inc.
      ]);

      // K-01 (Audit-Fix): Deduplizierung — wenn TICKER.EXCHANGE und TICKER beide
      // vorhanden, nur den Basisticker behalten (AAPL.US + AAPL → nur AAPL).
      // Bevorzuge den Eintrag ohne Börsen-Suffix (direkter Basisticker).
      const baseTickerSeen = new Map<string, number>(); // base → index in deduped
      const deduplicatedStocks: typeof allStocks = [];
      for (const s of allStocks as any[]) {
        const tickerStr = String(s.ticker ?? '');
        const base = tickerStr.split('.')[0].toUpperCase();
        const hasSuffix = tickerStr.includes('.');
        if (!baseTickerSeen.has(base)) {
          baseTickerSeen.set(base, deduplicatedStocks.length);
          deduplicatedStocks.push(s);
        } else if (!hasSuffix) {
          // Basisticker ohne Suffix bevorzugen — überschreibe den Suffix-Eintrag
          const existingIdx = baseTickerSeen.get(base)!;
          deduplicatedStocks[existingIdx] = s;
        }
        // Sonst: Eintrag mit Suffix ignorieren wenn Basisticker schon da
      }

      const universe = deduplicatedStocks.filter((s: any) => {
        // K-03: Blacklist-Filter
        const tickerUpper = String(s.ticker ?? '').toUpperCase();
        const baseUpper = tickerUpper.split('.')[0];
        if (TICKER_BLACKLIST.has(tickerUpper) || TICKER_BLACKLIST.has(baseUpper)) {
          console.log(`[buildProposal] Blacklist excluded ${s.ticker}: Börsenbetreiber/nicht-investierbar`);
          return false;
        }
        const price = parseFloat(s.currentPrice ?? "0");
        if (!(price > 0)) return false;
        if (s.sector && excludedSectors.includes(s.sector)) return false;

        // Handelbarkeit: Marktkapitalisierung-Filter (Empfehlungen ausgenommen)
        // WICHTIG: NULL-Werte werden als "unbekannt / zu klein" behandelt und ebenfalls ausgeschlossen.
        // Nur Watchlist-Empfehlungen sind von diesem Filter ausgenommen.
        if (!watchlistRecTickers.has(s.ticker.toUpperCase())) {
          const mcapRaw = s.marketCap ? String(s.marketCap).replace(/[^0-9.]/g, '') : '';
          const mcapM = mcapRaw ? parseFloat(mcapRaw) / 1_000_000 : null; // marketCap is stored in absolute units
          // Exclude if marketCap is NULL/unknown OR clearly below threshold
          if (mcapM === null || mcapM < MIN_MARKET_CAP_M) {
            console.log(`[buildProposal] Liquidity filter excluded ${s.ticker}: marketCap ${mcapM !== null ? mcapM.toFixed(0) + 'M' : 'NULL'} < ${MIN_MARKET_CAP_M}M`);
            return false;
          }
        }

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

      // K3 (Learning-Koordination): Ranking-Basis ist der GELERNTE Score aus dem
      // Signal-Cache (stockSignalCache.combinedScore = optimierte Gewichte +
      // ML-Nudge + Regime-Blend, alle 2 h aktualisiert) — vorher rankte der
      // Vorschlag über den statischen stocks.signalScore und ignorierte damit
      // sämtliche Lernschleifen. Fallback auf den Basis-Score nur bei fehlendem
      // oder veraltetem Cache-Eintrag (> 48 h).
      const { stockSignalCache } = await import("../../drizzle/schema");
      const cacheRows = await db
        .select({
          ticker: stockSignalCache.ticker,
          combinedScore: stockSignalCache.combinedScore,
          updatedAt: stockSignalCache.updatedAt,
        })
        .from(stockSignalCache)
        .where(inArray(stockSignalCache.ticker, universeTickers));
      const CACHE_MAX_AGE_MS = 48 * 60 * 60 * 1000;
      const cacheScoreMap = new Map<string, number>();
      for (const r of cacheRows) {
        const score = r.combinedScore != null ? parseFloat(String(r.combinedScore)) : NaN;
        const fresh = r.updatedAt instanceof Date ? Date.now() - r.updatedAt.getTime() < CACHE_MAX_AGE_MS : true;
        if (Number.isFinite(score) && fresh) cacheScoreMap.set(r.ticker.toUpperCase(), score);
      }
      let cacheFallbackCount = 0;
      console.log(`[buildProposal] signal cache scores: ${cacheScoreMap.size}/${universeTickers.length} frisch`);

      // Map universe stocks to scored candidates using watchlistStocks data
      const scored = universe
        .map((s: any) => {
          const wl = watchlistScoreMap.get(s.ticker.toUpperCase());
          const cachedCombined = cacheScoreMap.get(s.ticker.toUpperCase());
          if (cachedCombined === undefined) cacheFallbackCount++;
          const rawScore = cachedCombined ?? wl?.signalScore ?? s.signalScore ?? 50;
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

          // Goal-based adjustment. K2 (Learning-Koordination): YTD-Momentum geht
          // NUR über momentumAdj in den Score ein — die früheren zusätzlichen
          // YTD-Terme hier (growth-Bonus, Dividenden-Kursrückgang-Malus) und im
          // Profil-Adjustment zählten dieselbe Information drei- bis vierfach
          // und übersteuerten alles Richtung «was zuletzt lief».
          let goalAdj = 0;
          if (goal === "dividends") {
            // Boost dividend yield for dividends goal
            const divYield = parseFloat(wl?.dividendYield ?? s.dividendYield ?? "0");
            if (divYield >= 4) goalAdj += 5;
            else if (divYield >= 2) goalAdj += 2;
            else if (divYield < 1) goalAdj -= 5; // penalize low-yield stocks in dividend portfolio
          }

          // FX penalty: non-reference-currency stocks get penalised based on risk profile
          const stockCurrency = (s.currency || 'CHF') === 'GBp' ? 'GBP' : (s.currency || 'CHF');
          const isForeignCurrency = stockCurrency !== referenceCurrency;
          let fxAdj = 0;
          if (isForeignCurrency) {
            if (riskProfile === 'konservativ') fxAdj = -8;  // strong penalty for conservative
            else if (riskProfile === 'ausgewogen') fxAdj = -4;
            else fxAdj = -2; // mild penalty for aggressive
          }

          // === MARKT-HUB INTEGRATION: Sektor-Tilts + MSCI-Faktor-Tilts ===
          // Sektor-Tilt: basierend auf Makro-Signalen (Zinskurve, Inflation, HY-Spread, Regime)
          const sectorAdj = getSectorTiltForStock(s.sector, sectorTilts);
          // Faktor-Tilt: basierend auf MSCI-Faktor-ETF-Performance (Value/Momentum/Quality/MinVol).
          // K2: ytdPerf wird bewusst NICHT übergeben — führt der Momentum-Faktor,
          // würde der Tilt dieselbe YTD-Information wie momentumAdj erneut zählen;
          // Value-/Quality-/MinVol-Tilts nutzen andere Inputs und bleiben aktiv.
          const divYieldNum = parseFloat(wl?.dividendYield ?? s.dividendYield ?? '0');
          const factorAdj = getFactorTilt(
            { dividendYield: divYieldNum, ytdPerf: null, signalScore: rawScore, riskProfile, goal },
            marktHubSignals.factors,
          );

          const combinedScore = Math.max(0, Math.min(100, rawScore + momentumAdj + goalAdj + fxAdj + sectorAdj + factorAdj));
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

      console.log(`[buildProposal] scored=${scored.length}/${universe.length} (Basis-Score-Fallback: ${cacheFallbackCount})`);
      if (scored.length < 2) {
        throw new Error("Zu wenige bewertete Titel gefunden. Bitte aktualisieren Sie die Watchlist-Scores.");
      }
      // Ehrlichkeit: wenn der gelernte Cache-Score für einen wesentlichen Teil
      // des Universums fehlt, lief das Ranking teilweise auf dem Basis-Score.
      if (universe.length > 0 && cacheFallbackCount / universe.length > 0.3) {
        notes.push(
          `Signal-Cache unvollständig — für ${cacheFallbackCount} von ${universe.length} Titeln wurde der Basis-Score verwendet.`
        );
      }

      // === UNIVERSE EXPANSION: Lücken-Analyse + EODHD-Screening (max. 20% externe Titel) ===
      const universalCandidates: any[] = [];
      try {
        const { analyzeGaps, findExternalCandidates, storeExternalCandidates } = await import("../lib/universeExpansion");
        const existingTickers = new Set(scored.map((x: any) => x.stock.ticker.toUpperCase()));
        const gaps = analyzeGaps(
          scored.map((x: any) => ({
            ticker: x.stock.ticker,
            sector: x.stock.sector,
            dividendYield: x.dividendYield,
            sharpeRatio: null,
            ytdPerformance: x.stock.ytdPerformance?.toString() ?? null,
            peRatio: x.stock.peRatio,
          })),
          rules.maxTitles,
          excludedSectors,
          goal ?? "balanced"
        );
        if (gaps.totalGaps > 0) {
          console.log(`[buildProposal] Universe expansion: ${gaps.sectorGaps.length} Sektor-Lücken, ${gaps.factorGaps.length} Faktor-Lücken, max ${gaps.maxExternalCount} externe Titel`);
          const externalCandidates = await findExternalCandidates(gaps, existingTickers, referenceCurrency);
          if (externalCandidates.length > 0) {
            // Externe Kandidaten in DB speichern (Staging für Admin-Review) — non-fatal
            storeExternalCandidates(externalCandidates).catch((e: any) =>
              console.warn("[buildProposal] storeExternalCandidates non-fatal:", e)
            );
            // Externe Kandidaten als scored-kompatible Objekte in den Pool aufnehmen
            for (const ec of externalCandidates) {
              universalCandidates.push({
                stock: {
                  ticker: ec.ticker,
                  companyName: ec.companyName,
                  sector: ec.sector,
                  currency: ec.currency,
                  currentPrice: 0,
                  ytdPerformance: null,
                  peRatio: null,
                  dividendYield: ec.dividendYield ?? 0,
                  marketCap: null,
                  signalType: "HOLD",
                  listType: "watchlist",
                },
                combinedScore: 60,
                signal: "HOLD",
                scoreGrade: "B",
                dividendYield: ec.dividendYield ?? 0,
                regime: "normal",
                isUniverseExpansion: true,
                gapReason: ec.gapReason,
                closesGap: ec.closesGap,
              });
            }
            const gapDesc = [
              ...gaps.sectorGaps.map((g) => g.sector),
              ...gaps.factorGaps.map((g) => g.description),
            ].join(", ");
            notes.push(
              `Universum-Erweiterung: ${externalCandidates.length} neue Titel ergänzt (max. 20% des Vorschlags) um Lücken zu schließen: ${gapDesc}. Diese Titel sind als \u201eUniversum-Erweiterung\u201c gekennzeichnet und können vom Admin in die Watchlist übernommen werden.`
            );
            console.log(`[buildProposal] Universe expansion: ${externalCandidates.length} external candidates added`);
          }
        } else {
          console.log(`[buildProposal] Universe expansion: Keine Lücken gefunden`);
        }
      } catch (expansionErr: any) {
        console.warn("[buildProposal] Universe expansion non-fatal error:", expansionErr?.message);
      }
      // Externe Kandidaten in den scored-Pool aufnehmen (nach den Watchlist-Titeln)
      const allCandidates = [...scored, ...universalCandidates];

      console.log(`[buildProposal] Step 5: ranking ${allCandidates.length} scored items (${universalCandidates.length} universe expansions)`);
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
      // Stable sort: primary = rankKey desc, secondary = ticker asc (tie-breaker for determinism)
      const stableSort = (arr: any[]) =>
        arr.sort((a, b) => {
          const diff = rankKey(b) - rankKey(a);
          if (diff !== 0) return diff;
          return (a.stock.ticker as string).localeCompare(b.stock.ticker as string);
        });

      let ranked = stableSort(
        allCandidates.filter((x) => isBuyable(x) && x.combinedScore >= 55)
      );
      if (ranked.length < rules.minTitles) {
        // Zu wenige Kaufsignale — HOLD-Titel mit Score >= 45 einbeziehen, aber SELL bleibt draussen
        qualityTier = "erweitert";
        ranked = stableSort(
          allCandidates.filter((x) => x.signal !== "SELL" && x.scoreGrade !== "F" && x.combinedScore >= 45)
        );
      }
      if (ranked.length < rules.minTitles) {
        // Letzter Fallback: alle Nicht-SELL, nach Score sortiert
        qualityTier = "basis";
        ranked = stableSort(
          allCandidates.filter((x) => x.signal !== "SELL")
        );
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
      // AUTO-BACKFILL: Kurshistorie für alle ausgewählten Titel sicherstellen
      // (verhindert NaN-Kennzahlen und "unvollständige Kurshistorie"-Warnung)
      try {
        const { autoBackfillNewSymbols } = await import('../autoBackfill');
        const backfillResult = await autoBackfillNewSymbols(selected.map((c) => c.stock.ticker));
        if (backfillResult.newSymbolsDetected > 0) {
          console.log(`[buildProposal] Auto-backfill: ${backfillResult.newSymbolsDetected} Titel nachgeladen`);
        }
      } catch (backfillErr: any) {
        console.warn(`[buildProposal] Auto-backfill non-fatal: ${backfillErr?.message}`);
      }
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
      // Herkunft der Optimierer-Gewichte: "exact" = PyPortfolioOpt
      // (analytics_service), "random_search"/"analytic" = TS-Engine.
      let weightingEngine: "exact" | "random_search" | "analytic" | null = null;
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
          // Dynamischer risikofreier Zinssatz aus FRED DGS10 (statt hardcoded 2%)
          riskFreeRate: dynamicRiskFreeRate,
          // PyPortfolioOpt: harte Sektor-Caps im exakten Optimierer (sofern
          // ANALYTICS_SERVICE_URL konfiguriert) — der Zufallssuche-Fallback
          // kennt weiterhin nur die Auswahl-Caps aus Schritt 6.
          sectorByTicker: Object.fromEntries(
            selected.map((c) => [c.stock.ticker, c.stock.sector || "Andere"])
          ),
          maxSectorWeightPct: rules.maxSectorPercent,
        });
        weights = { ...opt.weights };
        weightingEngine = opt.optimizerEngine ?? "random_search";
        // K-02 (Audit-Fix): NaN-Sanitierung — wenn der Optimierer NaN zurückgibt
        // (fehlende Kurshistorie), proposalMetrics auf null setzen statt NaN anzuzeigen.
        const rawReturn = opt.optimalPortfolio.expectedReturn;
        const rawVol = opt.optimalPortfolio.volatility;
        const rawSharpe = opt.optimalPortfolio.sharpe;
        if (Number.isFinite(rawReturn) && Number.isFinite(rawVol) && Number.isFinite(rawSharpe)) {
          proposalMetrics = {
            expectedReturnPct: Math.round(rawReturn * 1000) / 10,
            volatilityPct: Math.round(rawVol * 1000) / 10,
            sharpe: rawSharpe,
          };
        } else {
          console.warn(`[buildProposal] Optimierer lieferte NaN-Kennzahlen (return=${rawReturn}, vol=${rawVol}, sharpe=${rawSharpe}) — proposalMetrics auf null gesetzt`);
          proposalMetrics = null;
          weightingNote = (weightingNote ? weightingNote + ' ' : '') + 'Kennzahlen konnten nicht berechnet werden (unvollständige Kurshistorie für einige Titel).';
        }
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
      // FX-ENFORCEMENT: Wenn nach der Optimierung das FX-Limit überschritten ist,
      // werden die Fremdwährungs-Positionen anteilig reduziert und durch CHF-Titel ersetzt.
      // Dies ist eine harte Grenze — nicht nur eine Warnung.
      if (fxWeightPct > maxFxExposurePct + 0.5) {
        console.log(`[buildProposal] FX enforcement: ${fxWeightPct.toFixed(1)}% > ${maxFxExposurePct}% limit — trimming FX positions`);
        // Berechne Ziel-FX-Gewicht und skaliere FX-Positionen proportional
        const fxPositions = positions.filter(p => (p.currency === 'GBp' ? 'GBP' : p.currency) !== referenceCurrency);
        const chfPositions = positions.filter(p => (p.currency === 'GBp' ? 'GBP' : p.currency) === referenceCurrency);
        const targetFxTotal = maxFxExposurePct;
        const currentFxTotal = fxWeightPct;
        const scaleFactor = targetFxTotal / currentFxTotal;
        // Skaliere FX-Positionen auf das erlaubte Maximum
        fxPositions.forEach(p => { p.weightPct = parseFloat((p.weightPct * scaleFactor).toFixed(2)); });
        // Verteile den freigewordenen Anteil auf CHF-Positionen (proportional)
        const freedWeight = fxWeightPct - targetFxTotal;
        const chfTotal = chfPositions.reduce((s, p) => s + p.weightPct, 0) || 1;
        chfPositions.forEach(p => { p.weightPct = parseFloat((p.weightPct + freedWeight * (p.weightPct / chfTotal)).toFixed(2)); });
        // Neuberechnung fxWeightPct nach Enforcement
        fxWeightPct = fxPositions.reduce((s, p) => s + p.weightPct, 0);
        fxWeightPct = Math.round(fxWeightPct * 10) / 10;
        notes.push(`Fremdwährungsanteil wurde von ${currentFxTotal.toFixed(1)}% auf ${fxWeightPct.toFixed(1)}% reduziert (Limit: ${maxFxExposurePct}%) — FX-Positionen wurden proportional gekürzt.`);
      }

      // Cash-Quote berücksichtigen: Positionen auf (100 - liquidityNeedPct)% skalieren
      if (liquidityNeedPct > 0 && liquidityNeedPct < 100) {
        const equityPct = 1 - liquidityNeedPct / 100;
        positions.forEach((p) => { p.weightPct = parseFloat((p.weightPct * equityPct).toFixed(2)); });
      }

      // === PREIS-ANREICHERUNG: Externe Kandidaten haben currentPrice=0 — aus DB oder EODHD laden ===
      const missingPriceTickers = positions.filter(p => !p.currentPrice || p.currentPrice === 0).map(p => p.ticker);
      if (missingPriceTickers.length > 0) {
        console.log(`[buildProposal] Enriching prices for ${missingPriceTickers.length} external candidates: ${missingPriceTickers.join(', ')}`);
        try {
          // 1) Aus DB laden (falls Ticker bereits bekannt)
          const { stocks: stocksTbl } = await import('../../drizzle/schema');
          const dbPriceRows = await db.select({ ticker: stocksTbl.ticker, currentPrice: stocksTbl.currentPrice, exchangeRateToChf: stocksTbl.exchangeRateToChf })
            .from(stocksTbl);
          const dbPrices = new Map(dbPriceRows.map((r: any) => [String(r.ticker).toUpperCase(), r]));
          for (const p of positions) {
            if (!p.currentPrice || p.currentPrice === 0) {
              const dbRow = dbPrices.get(p.ticker.toUpperCase());
              if (dbRow?.currentPrice) {
                p.currentPrice = parseFloat(String(dbRow.currentPrice));
                if (dbRow.exchangeRateToChf) p.exchangeRateToChf = parseFloat(String(dbRow.exchangeRateToChf));
              }
            }
          }
          // 2) Noch fehlende Preise via EODHD-Quote-API laden
          const { ENV: envCfg } = await import('../_core/env');
          const stillMissing = positions.filter(p => !p.currentPrice || p.currentPrice === 0);
          if (stillMissing.length > 0 && envCfg.eodhdApiKey) {
            for (const p of stillMissing) {
              try {
                const eoTicker = p.ticker.includes('.') ? p.ticker : `${p.ticker}.US`;
                const url = `https://eodhd.com/api/real-time/${eoTicker}?api_token=${envCfg.eodhdApiKey}&fmt=json`;
                const resp = await fetch(url);
                if (resp.ok) {
                  const data: any = await resp.json();
                  if (data?.close && parseFloat(data.close) > 0) {
                    p.currentPrice = parseFloat(data.close);
                    console.log(`[buildProposal] EODHD price for ${p.ticker}: ${p.currentPrice}`);
                  }
                }
              } catch (e) {
                console.warn(`[buildProposal] Could not fetch price for ${p.ticker}:`, e);
              }
            }
          }
        } catch (e) {
          console.warn('[buildProposal] Price enrichment failed (non-fatal):', e);
        }
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
      // proposalLogId muss AUSSERHALB des try-Blocks deklariert werden,
      // damit es im return-Statement (nach dem catch) zugreifbar ist.
      let proposalLogId: number | null = null;

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
        // Echte Bilanz-Fakten für die grössten US-Positionen (Financial
        // Datasets) — der Challenger prüft damit gegen Zahlen statt
        // Modellwissen. Non-fatal; ohne Konfiguration bleibt die Liste leer.
        const { getFundamentalsFactsBatch } = await import("../lib/financialDatasets");
        const usFundamentals = await getFundamentalsFactsBatch(positions.map((p) => p.ticker), 5);

        const factsSummary = [
          `Sektor-Gewichte: ${sectorWeights.map((s) => `${s.name} ${s.weightPct.toFixed(1)}%`).join(", ")} (Limit je Sektor: ${rules.maxSectorPercent}%)`,
          `Fremdwährungsanteil: ${fxWeightPct.toFixed(1)}% (Limit: ${maxFxExposurePct}%)`,
          proposalMetrics
            ? `Erwartete Kennzahlen (optimiert, historisch geschätzt): Rendite ${proposalMetrics.expectedReturnPct.toFixed(1)}% p.a., Volatilität ${proposalMetrics.volatilityPct.toFixed(1)}%, Sharpe ${proposalMetrics.sharpe.toFixed(2)}`
            : `Gewichtung: Score-Fallback (Optimierung nicht möglich)`,
          `Auswahl-Qualitätsstufe: ${qualityTier}`,
          ...(usFundamentals.length > 0
            ? [`Fundamentaldaten (Financial Datasets, nur US-Titel):\n${usFundamentals.map((f) => `  - ${f.summary}`).join("\n")}`]
            : []),
        ].join("\n");

        // Markt-Hub-Kontext für LLM-Prompts
        const marktHubContext = buildMarktHubContext(marktHubSignals);
        const sectorTiltsDescription = describeSectorTilts(sectorTilts);
        const marktHubContextBlock = marktHubContext
          ? `\n\n**Aktuelle Markt-Hub-Signale (fliessen in Sektor-Gewichtung ein):**\n${marktHubContext}\n\nAktive Sektor-Tilts: ${sectorTiltsDescription}\nMSCI Führender Faktor: ${marktHubSignals.factors.leadingFactor ?? 'unbekannt'}\n`
          : '';

        // ---- AGENT 2: CHALLENGER ----
        console.log('[buildProposal] Agent 2 (Challenger) starting...');
        const challengerResponse = await invokeKimi({
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
${JSON.stringify(candidatePool, null, 2)}${marktHubContextBlock}

Identifiziere:
1. Welche 1-3 Titel würdest du NICHT nehmen? (mit konkreter Begründung, berücksichtige auch die Markt-Hub-Signale)
2. Welche 1-3 Alternativen aus dem Kandidatenpool wären besser geeignet?
3. Gibt es Klumpenrisiken (Sektor/Währung/Korrelation)? Berücksichtige dabei die aktiven Sektor-Tilts.

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
        // Load recent adminFeedback signals to improve recommendations
        let adminFeedbackContext = '';
        try {
          const { portfolioProposalLog } = await import('../../drizzle/schema');
          const { isNotNull, desc } = await import('drizzle-orm');
          const recentFeedback = await db!.select({
            adminFeedback: portfolioProposalLog.adminFeedback,
          }).from(portfolioProposalLog)
            .where(isNotNull(portfolioProposalLog.adminFeedback))
            .orderBy(desc(portfolioProposalLog.createdAt))
            .limit(8);
          if (recentFeedback.length >= 2) {
            // Aggregate: which tickers were consistently reduced/increased/replaced by admin
            const tickerActions: Record<string, { reduce: number; increase: number; replace: number; total: number }> = {};
            for (const row of recentFeedback) {
              const fb = row.adminFeedback as any;
              if (!fb) continue;
              const changes: Array<{ ticker: string; action: string }> = [
                ...(fb.reduced ?? []).map((t: string) => ({ ticker: t, action: 'reduce' })),
                ...(fb.increased ?? []).map((t: string) => ({ ticker: t, action: 'increase' })),
                ...(fb.replaced ?? []).map((t: string) => ({ ticker: t, action: 'replace' })),
              ];
              for (const c of changes) {
                if (!tickerActions[c.ticker]) tickerActions[c.ticker] = { reduce: 0, increase: 0, replace: 0, total: 0 };
                tickerActions[c.ticker][c.action as 'reduce' | 'increase' | 'replace']++;
                tickerActions[c.ticker].total++;
              }
            }
            // Only include tickers that appear in at least 2 feedbacks
            const patterns = Object.entries(tickerActions)
              .filter(([, v]) => v.total >= 2)
              .map(([ticker, v]) => {
                // .sort() mutiert — auf readonly-Tupel nicht erlaubt; Kopie sortieren.
                const dominant = [...(['reduce', 'increase', 'replace'] as const)].sort((a, b) => v[b] - v[a])[0];
                return `${ticker}: Admin hat ${v.total}x ${dominant === 'reduce' ? 'reduziert' : dominant === 'increase' ? 'erhöht' : 'ersetzt'}`;
              });
            if (patterns.length > 0) {
              adminFeedbackContext = `\n\nHistorisches Admin-Feedback (letzte ${recentFeedback.length} genehmigte Vorschläge):\n${patterns.join('\n')}\nBerücksichtige diese Muster bei deinen Empfehlungen — wenn ein Titel regelmässig vom Admin angepasst wird, empfehle die entsprechende Aktion proaktiv.`;
              console.log(`[buildProposal] Synthesizer: injecting ${patterns.length} admin feedback patterns`);
            }
          }
        } catch (fbErr) {
          console.warn('[buildProposal] Could not load admin feedback:', fbErr);
        }

        console.log('[buildProposal] Agent 3 (Synthesizer) starting...');
        const synthesizerResponse = await invokeKimi({
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

Anlegerprofil: ${profileSummary}${adminFeedbackContext}${marktHubContextBlock}

Erstelle:
1. Dein Gesamturteil (2-3 Sätze): Ist der Vorschlag gut? Was sind die wichtigsten Stärken/Schwächen? Berücksichtige dabei das aktuelle Marktregime und die Makro-Signale.
2. Konkrete Anpassungen: Für jeden Titel: behalten/reduzieren/erhöhen/ersetzen?
3. Gesamtvertrauen in den Vorschlag — nutze DIESE OBJEKTIVEN KRITERIEN (nicht subjektiv schätzen):
   - "hoch": FX-Limit eingehalten UND kein Sektor > 30% UND alle Titel BUY-Signal UND Sharpe > 0.5 UND Challenger hat ≤ 1 berechtigten Einwand
   - "niedrig": FX-Limit überschritten ODER Sektor > 40% ODER mehrere SELL-Titel ODER Sharpe < 0.2 ODER Challenger hat ≥ 3 berechtigte Einwände
   - "mittel": alle anderen Fälle (1-2 HOLD-Titel, leichte Sektorkonzentration, Sharpe 0.2-0.5, 1-2 Challenger-Einwände)

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

        // === KENNZAHLEN-FILTER: Nur wenn Sharpe/Dividende verbessert wird ===
        // Vergleicht den Vorschlag mit dem aktuellen Portfolio des Nutzers.
        // Wenn der Nutzer kein Portfolio hat oder keine Kennzahlen berechnet werden können,
        // wird der Filter übersprungen (meetsKennzahlenFilter = 'n/a').
        let meetsKennzahlenFilter: 'ja' | 'nein' | 'n/a' = 'n/a';
        let kennzahlenFilterReason = '';
        if (proposalMetrics) {
          const proposalSharpe = proposalMetrics.sharpe;
          const proposalDivYield = positions.reduce((sum, p) => {
            const wl = watchlistScoreMap.get(p.ticker.toUpperCase());
            const div = parseFloat((wl as any)?.dividendYield ?? '0') || 0;
            return sum + div * (p.weightPct / 100);
          }, 0);
          // Mindestanforderungen für einen "guten" Vorschlag:
          // Sharpe > 0.3 (besser als reines Cash) ODER Dividendenrendite > 2% bei Dividendenziel
          const sharpeOk = proposalSharpe > 0.3;
          const divOk = goal === 'dividends' ? proposalDivYield >= 2 : true;
          meetsKennzahlenFilter = (sharpeOk && divOk) ? 'ja' : 'nein';
          if (!sharpeOk) kennzahlenFilterReason += `Sharpe ${proposalSharpe.toFixed(2)} < 0.3 (Mindestanforderung). `;
          if (!divOk) kennzahlenFilterReason += `Dividendenrendite ${proposalDivYield.toFixed(1)}% < 2% (Ziel: Dividenden). `;
          if (meetsKennzahlenFilter === 'ja') kennzahlenFilterReason = `Sharpe ${proposalSharpe.toFixed(2)}, Div-Rendite ${proposalDivYield.toFixed(1)}% — Kennzahlen erfüllt.`;
          if (meetsKennzahlenFilter === 'nein') {
            notes.push(`⚠️ Kennzahlen-Filter: ${kennzahlenFilterReason.trim()} Der Vorschlag erfüllt die Mindestanforderungen nicht — bitte Profil oder Universum anpassen.`);
          }
        }

        // === DB-LOGGING: Ergebnis intern speichern (Admin-Auswertung) ===
        try {
          const { portfolioProposalLog } = await import('../../drizzle/schema');
          const insertResult = await db.insert(portfolioProposalLog).values({
            userId: ctx.user.id,
            riskProfile,
            investmentGoal: goal,
            referenceCurrency,
            maxFxExposurePct,
            investmentAmount: input?.investmentAmount ?? null,
            positionCount: positions.length,
            method,
            qualityTier,
            sharpe: proposalMetrics?.sharpe != null ? String(proposalMetrics.sharpe) as any : null,
            expectedReturnPct: proposalMetrics?.expectedReturnPct != null ? String(proposalMetrics.expectedReturnPct) as any : null,
            volatilityPct: proposalMetrics?.volatilityPct != null ? String(proposalMetrics.volatilityPct) as any : null,
            fxWeightPct: String(fxWeightPct) as any,
            positions: positions as any,
            challengerCritique: challengerResult.critique,
            challengerRejectedCount: challengerResult.rejected.length,
            synthesizerVerdict: synthResult.verdict,
            overallConfidence: synthResult.overallConfidence as 'hoch' | 'mittel' | 'niedrig',
            finalAdjustments: synthResult.adjustments as any,
            agentDurationMs: agentDuration,
            meetsKennzahlenFilter,
            kennzahlenFilterReason,
          });
          proposalLogId = (insertResult as any)?.insertId ?? null;
          console.log(`[buildProposal] Proposal logged to DB (userId=${ctx.user.id}, confidence=${synthResult.overallConfidence}, logId=${proposalLogId})`);

          // Notify admin about new proposal awaiting review
          try {
            const { notifyOwner } = await import('../_core/notification');
            const adminUrl = `/admin/proposal-analysis?proposalId=${proposalLogId}&returnTo=/portfolio-builder`;
            await notifyOwner({
              title: `⚠️ Neuer KI-Vorschlag #${proposalLogId} wartet auf Review`,
              content: `Nutzer ${ctx.user.name ?? ctx.user.openId} hat einen neuen Portfolio-Vorschlag generiert.\n\nKonfidenz: ${synthResult.overallConfidence} | Positionen: ${positions.length} | Kennzahlen-Filter: ${meetsKennzahlenFilter}\n\nZum Review: ${adminUrl}`,
            });
          } catch (notifyErr: any) {
            console.warn(`[buildProposal] Admin notification failed (non-fatal): ${notifyErr?.message}`);
          }
        } catch (logErr: any) {
          console.warn(`[buildProposal] DB logging failed (non-fatal): ${logErr?.message}`);
        }
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
          engine: weightingEngine,
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
        // KI-Analyse: finalAdjustments und Synthesizer-Urteil an den Client zurückgeben,
        // damit der Wizard die Empfehlungen automatisch einarbeiten kann.
        proposalLogId: proposalLogId ?? null,
        finalAdjustments: challengeReport?.finalAdjustments ?? [],
        synthesizerVerdict: challengeReport?.synthesizerVerdict ?? null,
        overallConfidence: challengeReport?.overallConfidence ?? null,
        // adjustedPositions: Positionen mit automatisch eingearbeiteten KI-Empfehlungen
        // reduce → Gewicht -35%, increase → Gewicht +35%, replace → bester Kandidat
        adjustedPositions: (() => {
          if (!challengeReport?.finalAdjustments?.length) return null;
          const adj = challengeReport.finalAdjustments;
          let adjusted = positions.map(p => ({ ...p }));
          // Schritt 1: reduce / increase anwenden
          for (const a of adj) {
            const pos = adjusted.find(p => p.ticker.toUpperCase() === a.ticker.toUpperCase());
            if (!pos) continue;
            if (a.action === 'reduce') pos.weightPct = Math.max(pos.weightPct * 0.65, 3);
            if (a.action === 'increase') pos.weightPct = Math.min(pos.weightPct * 1.35, 15);
          }
          // Schritt 2: replace — Titel durch besten Kandidaten aus dem Pool ersetzen
          const replaceAdj = adj.filter((a: any) => a.action === 'replace');
          if (replaceAdj.length > 0) {
            const usedTickers = new Set(adjusted.map(p => p.ticker.toUpperCase()));
            const candidates = scored
              .filter(x => !usedTickers.has(x.stock.ticker.toUpperCase()) && isBuyable(x) && x.combinedScore >= 45)
              .sort((a, b) => b.combinedScore - a.combinedScore);
            for (const ra of replaceAdj) {
              const idx = adjusted.findIndex(p => p.ticker.toUpperCase() === ra.ticker.toUpperCase());
              if (idx < 0) continue;
              const replacement = candidates.shift();
              if (!replacement) continue;
              usedTickers.add(replacement.stock.ticker.toUpperCase());
              adjusted[idx] = {
                ...adjusted[idx],
                ticker: replacement.stock.ticker,
                companyName: replacement.stock.companyName,
                sector: replacement.stock.sector,
                currency: replacement.stock.currency,
                // Always coerce to number so the client doesn't get a raw DB string
                currentPrice: parseFloat(String(replacement.stock.currentPrice ?? '0')) || 0,
                combinedScore: replacement.combinedScore,
                signal: replacement.signal,
                reason: `Ersetzt ${ra.ticker} gemäss KI-Empfehlung`,
              };
            }
          }
          // Schritt 3: Normieren auf 100%
          const total = adjusted.reduce((s, p) => s + p.weightPct, 0);
          if (total > 0) adjusted = adjusted.map(p => ({ ...p, weightPct: Math.round((p.weightPct / total) * 1000) / 10 }));
          return adjusted;
        })(),
        // Markt-Hub-Badge: aktive Tilts und MSCI-Faktor für UI-Anzeige
        marktHubBadge: {
          hasData: marktHubSignals.hasData,
          regime: marktHubSignals.regime.regime,
          leadingFactor: marktHubSignals.factors.leadingFactor,
          activeSectorTilts: (() => {
            const tilts = getSectorTilts(marktHubSignals);
            return Object.entries(tilts)
              .filter(([, v]) => v !== 0)
              .map(([sector, tilt]) => ({ sector, tilt }));
          })(),
          dynamicRiskFreeRate: Math.round(dynamicRiskFreeRate * 10000) / 100,
          macroSignals: {
            yieldCurveInverted: (marktHubSignals.macro.yieldCurveSpread ?? 0) < 0,
            inflationHigh: (marktHubSignals.macro.coreCpi ?? 0) > 4,
            hySpreadElevated: (marktHubSignals.macro.hySpread ?? 0) > 350,
          },
        },
      };
    }),

  /**
   * F4b: Nicht-blockierender Portfolio-Vorschlag (Async-Job-Muster).
   * Gibt sofort eine jobId zurück. Polling via getProposalStatus.
   * Löst den HTTP 524 Timeout bei langen Kimi-K3-Anfragen.
   */
  startProposal: protectedProcedure
    .input(z.object({ investmentAmount: z.number().positive().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      const jobId = randomUUID();
      const job: ProposalJob = {
        status: 'running',
        progress: ['Job gestartet...'],
        result: null,
        error: null,
        userId: ctx.user.id,
        startedAt: Date.now(),
      };
      proposalJobs.set(jobId, job);

      // Launch the full buildProposal logic in background (non-blocking)
      (async () => {
        try {
          job.progress.push('Berechtigungen prüfen...');
          const { requireFeature } = await import('../lib/entitlements');
          await requireFeature(ctx.user, 'auto_portfolio');

          const { getDb } = await import('../db');
          const db = await getDb();
          if (!db) throw new Error('Datenbank nicht verfügbar');

          const { eq, and, gte, asc } = await import('drizzle-orm');
          const { userInvestmentProfile, stocks: stocksTable, historicalPrices } = await import('../../drizzle/schema');

          job.progress.push('Anlageprofil laden...');
          const [profile] = await db.select().from(userInvestmentProfile).where(eq(userInvestmentProfile.userId, ctx.user.id)).limit(1);
          if (!profile) throw new Error('Kein Anlageprofil hinterlegt. Bitte legen Sie zuerst unter Einstellungen › Anlageprofil Ihr Risikoprofil und Ihre Anlageziele fest.');

          const excludedSectors: string[] = (profile.excludedSectors as string[] | null) ?? [];
          const goal = profile.investmentGoal;
          const riskProfile = profile.riskProfile;
          const esgOnly = profile.esgOnly === 1;
          const liquidityNeedPct = profile.liquidityNeedPct ?? 0;
          const targetReturnPct = profile.targetReturnPct != null ? parseFloat(String(profile.targetReturnPct)) : null;
          const referenceCurrency: string = (profile.referenceCurrency as string | null) ?? 'CHF';
          const maxFxExposurePct: number = profile.maxFxExposurePct != null
            ? parseFloat(String(profile.maxFxExposurePct))
            : riskProfile === 'aggressiv' ? 80 : riskProfile === 'konservativ' ? 40 : 60;

          job.progress.push('Diversifikationsregeln laden...');
          const { getDiversificationRules } = await import('../lib/diversificationRules');
          const rules = await getDiversificationRules();
          const { optimizerParamsForProfile } = await import('../lib/profileOptimizerParams');
          const params = optimizerParamsForProfile({ riskProfile, maxDrawdownTolerancePct: profile.maxDrawdownTolerancePct, investmentHorizonYears: profile.investmentHorizonYears }, rules);

          job.progress.push('Markt-Hub-Signale laden...');
          let marktHubSignals: MarktHubSignals;
          try {
            marktHubSignals = await getMarktHubSignals();
          } catch (mhErr: any) {
            marktHubSignals = { macro: { yieldCurveSpread: null, coreCpi: null, fedFundsRate: null, dgs10: null, hySpread: null, chfUsd: null }, regime: { regime: 'Neutral', overallScore: 0, equityAllocation: 60, regimeMultiplier: 1.0 }, factors: { valueYtd: null, momentumYtd: null, qualityYtd: null, minVolYtd: null, leadingFactor: null }, latestReportSummary: null, latestReportDate: null, hasData: false, fetchedAt: new Date().toISOString() };
          }
          const sectorTilts = getSectorTilts(marktHubSignals);
          const { getRiskFreeRate } = await import('../lib/riskFreeRate');
          const dynamicRiskFreeRate = await getRiskFreeRate();

          job.progress.push('Kandidaten-Universum aufbauen...');
          const { eq: eqOp } = await import('drizzle-orm');
          const watchlistRecs = await db.select({ ticker: stocksTable.ticker }).from(stocksTable).where(eqOp(stocksTable.listType, 'empfehlung'));
          const watchlistRecTickers = new Set(watchlistRecs.map((r: any) => r.ticker.toUpperCase()));
          const notes: string[] = [];
          if (esgOnly) notes.push('Ihr ESG-Wunsch ist hinterlegt, kann aber noch nicht angewendet werden — für die Titel liegen keine ESG-Daten vor. Der Vorschlag ist NICHT ESG-gefiltert.');

          const allStocks = await db.select().from(stocksTable);
          const SECTOR_UNDERPERFORM_THRESHOLD = -20;
          const ytdBySector: Record<string, number[]> = {};
          for (const s of allStocks as any[]) {
            const ytd = s.ytdPerformance != null ? parseFloat(String(s.ytdPerformance)) : NaN;
            if (!Number.isFinite(ytd)) continue;
            const key = s.sector || 'Andere';
            (ytdBySector[key] ||= []).push(ytd);
          }
          const median = (arr: number[]) => { const a = [...arr].sort((x, y) => x - y); const mid = Math.floor(a.length / 2); return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2; };
          const sectorBenchmarkYtd: Record<string, number> = {};
          for (const [sec, vals] of Object.entries(ytdBySector)) sectorBenchmarkYtd[sec] = vals.length >= 3 ? median(vals) : 0;
          const MIN_MARKET_CAP_M = 500;
          const TICKER_BLACKLIST = new Set(['GPW', 'GPW.WA', 'DB1', 'DB1.DE', 'LSE', 'LSE.L', 'ICE', 'CME', 'CBOE', 'NDAQ']);
          const baseTickerSeen = new Map<string, number>();
          const deduplicatedStocks: typeof allStocks = [];
          for (const s of allStocks as any[]) {
            const tickerStr = String(s.ticker ?? '');
            const base = tickerStr.split('.')[0].toUpperCase();
            const hasSuffix = tickerStr.includes('.');
            if (!baseTickerSeen.has(base)) { baseTickerSeen.set(base, deduplicatedStocks.length); deduplicatedStocks.push(s); }
            else if (!hasSuffix) { const existingIdx = baseTickerSeen.get(base)!; deduplicatedStocks[existingIdx] = s; }
          }
          const universe = deduplicatedStocks.filter((s: any) => {
            const tickerUpper = String(s.ticker ?? '').toUpperCase();
            const baseUpper = tickerUpper.split('.')[0];
            if (TICKER_BLACKLIST.has(tickerUpper) || TICKER_BLACKLIST.has(baseUpper)) return false;
            const price = parseFloat(s.currentPrice ?? '0');
            if (!(price > 0)) return false;
            if (s.sector && excludedSectors.includes(s.sector)) return false;
            if (!watchlistRecTickers.has(s.ticker.toUpperCase())) {
              const mcapRaw = s.marketCap ? String(s.marketCap).replace(/[^0-9.]/g, '') : '';
              const mcapM = mcapRaw ? parseFloat(mcapRaw) / 1_000_000 : null;
              if (mcapM === null || mcapM < MIN_MARKET_CAP_M) return false;
            }
            const ytdPerf = parseFloat(s.ytdPerformance ?? '0') || 0;
            const sectorKey = s.sector || 'Andere';
            const sectorBenchmark = sectorBenchmarkYtd[sectorKey] ?? 0;
            if (ytdPerf - sectorBenchmark < SECTOR_UNDERPERFORM_THRESHOLD && !watchlistRecTickers.has(s.ticker.toUpperCase())) return false;
            return true;
          });

          job.progress.push(`Scoring und Ranking (${universe.length} Titel)...`);
          const universeTickers = universe.map((s: any) => s.ticker.toUpperCase());
          const { inArray } = await import('drizzle-orm');
          const watchlistScores = await db.select({ ticker: stocksTable.ticker, signalScore: stocksTable.signalScore, signalType: stocksTable.signalType, sector: stocksTable.sector, dividendYield: stocksTable.dividendYield, rsi14: stocksTable.rsi14 }).from(stocksTable).where(inArray(stocksTable.ticker, universeTickers));
          const watchlistScoreMap = new Map(watchlistScores.map((w: any) => [w.ticker.toUpperCase(), w]));
          const { stockSignalCache } = await import('../../drizzle/schema');
          const cacheRows = await db.select({ ticker: stockSignalCache.ticker, combinedScore: stockSignalCache.combinedScore, updatedAt: stockSignalCache.updatedAt }).from(stockSignalCache).where(inArray(stockSignalCache.ticker, universeTickers));
          const CACHE_MAX_AGE_MS = 48 * 60 * 60 * 1000;
          const cacheScoreMap = new Map<string, number>();
          for (const r of cacheRows) {
            const score = r.combinedScore != null ? parseFloat(String(r.combinedScore)) : NaN;
            const fresh = r.updatedAt instanceof Date ? Date.now() - r.updatedAt.getTime() < CACHE_MAX_AGE_MS : true;
            if (Number.isFinite(score) && fresh) cacheScoreMap.set(r.ticker.toUpperCase(), score);
          }
          let cacheFallbackCount = 0;
          const scored = universe.map((s: any) => {
            const wl = watchlistScoreMap.get(s.ticker.toUpperCase());
            const cachedCombined = cacheScoreMap.get(s.ticker.toUpperCase());
            if (cachedCombined === undefined) cacheFallbackCount++;
            const rawScore = cachedCombined ?? wl?.signalScore ?? s.signalScore ?? 50;
            const signalType = wl?.signalType ?? s.signalType ?? 'hold';
            const signal = signalType === 'buy' ? 'BUY' : signalType === 'sell' ? 'SELL' : 'HOLD';
            const grade = (score: number) => score >= 80 ? 'A' : score >= 65 ? 'B' : score >= 50 ? 'C' : score >= 35 ? 'D' : 'F';
            const ytdRaw = s.ytdPerformance;
            const ytdPerf = ytdRaw !== null && ytdRaw !== undefined ? parseFloat(String(ytdRaw)) || 0 : null;
            const ytdHasData = ytdPerf !== null;
            let momentumAdj = 0;
            if (!ytdHasData) momentumAdj = -5;
            else if (ytdPerf! > 20) momentumAdj = 8;
            else if (ytdPerf! > 10) momentumAdj = 5;
            else if (ytdPerf! > 5) momentumAdj = 2;
            else if (ytdPerf! < -20) momentumAdj = -15;
            else if (ytdPerf! < -15) momentumAdj = -10;
            else if (ytdPerf! < -10) momentumAdj = -5;
            let goalAdj = 0;
            if (goal === 'dividends') {
              const divYield = parseFloat(wl?.dividendYield ?? s.dividendYield ?? '0');
              if (divYield >= 4) goalAdj += 5; else if (divYield >= 2) goalAdj += 2; else if (divYield < 1) goalAdj -= 5;
            }
            const stockCurrency = (s.currency || 'CHF') === 'GBp' ? 'GBP' : (s.currency || 'CHF');
            const isForeignCurrency = stockCurrency !== referenceCurrency;
            let fxAdj = 0;
            if (isForeignCurrency) { if (riskProfile === 'konservativ') fxAdj = -8; else if (riskProfile === 'ausgewogen') fxAdj = -4; else fxAdj = -2; }
            const sectorAdj = getSectorTiltForStock(s.sector, sectorTilts);
            const divYieldNum = parseFloat(wl?.dividendYield ?? s.dividendYield ?? '0');
            // Faktor-Tilt: ytdPerf korrekt übergeben (vorher: null → Momentum-Signal griff nie)
            const factorAdj = getFactorTilt({ dividendYield: divYieldNum, ytdPerf: ytdPerf, signalScore: rawScore, riskProfile, goal }, marktHubSignals.factors);
            const combinedScore = Math.max(0, Math.min(100, rawScore + momentumAdj + goalAdj + fxAdj + sectorAdj + factorAdj));
            const scoreGrade = grade(combinedScore);
            return { stock: s, combinedScore, rawScore, ytdPerf, signal, scoreGrade, dividendYield: parseFloat(wl?.dividendYield ?? s.dividendYield ?? '0'), regime: 'normal' as const };
          }).filter((x) => x.combinedScore > 0);
          if (scored.length < 2) throw new Error('Zu wenige bewertete Titel gefunden. Bitte aktualisieren Sie die Watchlist-Scores.');
          if (universe.length > 0 && cacheFallbackCount / universe.length > 0.3) notes.push(`Signal-Cache unvollständig — für ${cacheFallbackCount} von ${universe.length} Titeln wurde der Basis-Score verwendet.`);

          // Universe expansion (non-fatal)
          const universalCandidates: any[] = [];
          try {
            const { analyzeGaps, findExternalCandidates, storeExternalCandidates } = await import('../lib/universeExpansion');
            const existingTickers = new Set(scored.map((x: any) => x.stock.ticker.toUpperCase()));
            const gaps = analyzeGaps(scored.map((x: any) => ({ ticker: x.stock.ticker, sector: x.stock.sector, dividendYield: x.dividendYield, sharpeRatio: null, ytdPerformance: x.stock.ytdPerformance?.toString() ?? null, peRatio: x.stock.peRatio })), rules.maxTitles, excludedSectors, goal ?? 'balanced');
            if (gaps.totalGaps > 0) {
              const externalCandidates = await findExternalCandidates(gaps, existingTickers, referenceCurrency);
              if (externalCandidates.length > 0) {
                storeExternalCandidates(externalCandidates).catch((e: any) => console.warn('[startProposal] storeExternalCandidates non-fatal:', e));
                for (const ec of externalCandidates) universalCandidates.push({ stock: { ticker: ec.ticker, companyName: ec.companyName, sector: ec.sector, currency: ec.currency, currentPrice: 0, ytdPerformance: null, peRatio: null, dividendYield: ec.dividendYield ?? 0, marketCap: null, signalType: 'HOLD', listType: 'watchlist' }, combinedScore: 60, signal: 'HOLD', scoreGrade: 'B', dividendYield: ec.dividendYield ?? 0, regime: 'normal', isUniverseExpansion: true, gapReason: ec.gapReason, closesGap: ec.closesGap });
                const gapDesc = [...gaps.sectorGaps.map((g: any) => g.sector), ...gaps.factorGaps.map((g: any) => g.description)].join(', ');
                notes.push(`Universum-Erweiterung: ${externalCandidates.length} neue Titel ergänzt (max. 20% des Vorschlags) um Lücken zu schließen: ${gapDesc}.`);
              }
            }
          } catch (expansionErr: any) { console.warn('[startProposal] Universe expansion non-fatal:', expansionErr?.message); }
          const allCandidates = [...scored, ...universalCandidates];

          // Ranking + selection
          const rankKey = (x: any) => { let score = x.combinedScore; if (goal === 'dividends') score += Math.min(x.dividendYield * 100, 5) * 2; if (watchlistRecTickers.has(x.stock.ticker.toUpperCase())) score += 10; return score; };
          const isBuyable = (x: any) => x.signal !== 'SELL' && x.scoreGrade !== 'F';
          let qualityTier: 'kaufkandidaten' | 'erweitert' | 'basis' = 'kaufkandidaten';
          const stableSort = (arr: any[]) => arr.sort((a, b) => { const diff = rankKey(b) - rankKey(a); if (diff !== 0) return diff; return (a.stock.ticker as string).localeCompare(b.stock.ticker as string); });
          let ranked = stableSort(allCandidates.filter((x) => isBuyable(x) && x.combinedScore >= 55));
          if (ranked.length < rules.minTitles) { qualityTier = 'erweitert'; ranked = stableSort(allCandidates.filter((x) => x.signal !== 'SELL' && x.scoreGrade !== 'F' && x.combinedScore >= 45)); }
          if (ranked.length < rules.minTitles) { qualityTier = 'basis'; ranked = stableSort(allCandidates.filter((x) => x.signal !== 'SELL')); }
          if (qualityTier !== 'kaufkandidaten') notes.push(qualityTier === 'erweitert' ? 'Zu wenige klare Kaufkandidaten (Score ≥ 55) — die Auswahl enthält auch neutrale Titel mit Score ≥ 45.' : 'Sehr wenige geeignete Kandidaten — die Auswahl umfasst alle Titel ohne Verkaufssignal, unabhängig vom Score.');
          const target = Math.min(rules.maxTitles, ranked.length);
          const maxPerSector = Math.max(1, Math.floor((rules.maxSectorPercent / 100) * target));
          // Heimatmarkt-Korrelations-Cap: max. 3 Titel aus demselben Land+Sektor
          // (verhindert z.B. 5x CH-Finanz mit hoher impliziter Korrelation)
          const MAX_SAME_COUNTRY_SECTOR = 3;
          const selected: any[] = [];
          const sectorCount: Record<string, number> = {};
          const countrySectorCount: Record<string, number> = {};
          let currentFxWeightPct = 0;
          for (const c of ranked) {
            if (selected.length >= rules.maxTitles) break;
            const estimatedWeight = 100 / Math.max(1, target);
            const stockCur = (c.stock.currency || 'CHF') === 'GBp' ? 'GBP' : (c.stock.currency || 'CHF');
            const isFx = stockCur !== referenceCurrency;
            if (isFx && currentFxWeightPct + estimatedWeight > maxFxExposurePct && selected.length >= rules.minTitles) continue;
            const sec = c.stock.sector || 'Andere';
            if ((sectorCount[sec] || 0) >= maxPerSector) continue;
            // Heimatmarkt-Cap: Land aus Exchange ableiten
            const exchange = (c.stock.exchange || '').toUpperCase();
            const country = (exchange === 'US' || exchange === 'NASDAQ' || exchange === 'NYSE' || exchange === 'AMEX') ? 'US'
              : (exchange === 'SW' || exchange === 'SWX' || exchange === 'VX') ? 'CH'
              : (exchange === 'DE' || exchange === 'XETRA' || exchange === 'F') ? 'DE'
              : (exchange === 'L' || exchange === 'LSE') ? 'GB'
              : (exchange === 'PA' || exchange === 'NX') ? 'FR'
              : exchange || 'OTHER';
            const countrySectorKey = `${country}:${sec}`;
            if ((countrySectorCount[countrySectorKey] || 0) >= MAX_SAME_COUNTRY_SECTOR) continue;
            selected.push(c);
            sectorCount[sec] = (sectorCount[sec] || 0) + 1;
            countrySectorCount[countrySectorKey] = (countrySectorCount[countrySectorKey] || 0) + 1;
            if (isFx) currentFxWeightPct += estimatedWeight;
          }
          if (selected.length < 2) throw new Error('Zu wenige geeignete Kandidaten nach Anwendung der Diversifikationsregeln.');

          // AUTO-BACKFILL: Kurshistorie für alle ausgewählten Titel sicherstellen
          // (verhindert NaN-Kennzahlen und "unvollständige Kurshistorie"-Warnung)
          job.progress.push('Kurshistorie prüfen und nachladen...');
          const selectedTickersForBackfill = selected.map((c) => c.stock.ticker);
          let backfillFailedTickers: string[] = [];
          try {
            const { autoBackfillNewSymbols } = await import('../autoBackfill');
            // C: Backfill zeitlich einboxen — verhindert die minutenlangen
            // Hänger, wenn viele neue Symbole nachgeladen werden müssen. Läuft
            // der Backfill länger, wird der Vorschlag mit den vorhandenen Daten
            // gebaut; die restlichen Kurse landen im Cache und stehen beim
            // nächsten Lauf bereit.
            const BACKFILL_TIMEOUT_MS = 15000;
            const backfillResult = await Promise.race([
              autoBackfillNewSymbols(selectedTickersForBackfill),
              new Promise<{ newSymbolsDetected: number; backfillResults: any[]; timedOut: boolean }>((resolve) =>
                setTimeout(() => resolve({ newSymbolsDetected: 0, backfillResults: [], timedOut: true }), BACKFILL_TIMEOUT_MS),
              ),
            ]);
            if ((backfillResult as any).timedOut) {
              job.progress.push('Kurshistorie wird im Hintergrund weiter geladen…');
              console.warn(`[startProposal] Backfill >${BACKFILL_TIMEOUT_MS}ms — Vorschlag mit vorhandenen Daten für Job ${jobId}`);
            } else if (backfillResult.newSymbolsDetected > 0) {
              job.progress.push(`Kurshistorie: ${backfillResult.newSymbolsDetected} Titel nachgeladen.`);
              console.log(`[startProposal] Auto-backfill: ${backfillResult.newSymbolsDetected} Titel nachgeladen für Job ${jobId}`);
            }
            // Track tickers where backfill failed (no data available at EODHD)
            backfillFailedTickers = backfillResult.backfillResults
              .filter((r) => !r.success && r.pricesInserted === 0)
              .map((r) => r.ticker);
            if (backfillFailedTickers.length > 0) {
              console.warn(`[startProposal] Backfill failed for: ${backfillFailedTickers.join(', ')} — keine Daten bei EODHD`);
            }
          } catch (backfillErr: any) {
            console.warn(`[startProposal] Auto-backfill non-fatal: ${backfillErr?.message}`);
          }

          job.progress.push('Portfolio-Optimierung läuft...');
          const method = goal === 'dividends' ? 'max_dividend' : params.method;
          const selectedTickers = selected.map((c) => c.stock.ticker);
          let weights: Record<string, number> = {};
          let weightingSource: 'optimizer' | 'score_fallback' = 'optimizer';
          let weightingNote: string | null = null;
          let weightingEngine: 'exact' | 'random_search' | 'analytic' | null = null;
          let proposalMetrics: { expectedReturnPct: number; volatilityPct: number; sharpe: number } | null = null;
          try {
            const { optimizePortfolio } = await import('../analytics/engine');
            const opt = await optimizePortfolio({ tickers: selectedTickers, method, minPositionWeight: params.minPositionWeight, maxPositionWeight: params.maxPositionWeight, riskFreeRate: dynamicRiskFreeRate, sectorByTicker: Object.fromEntries(selected.map((c) => [c.stock.ticker, c.stock.sector || 'Andere'])), maxSectorWeightPct: rules.maxSectorPercent });
            weights = { ...opt.weights };
            weightingEngine = opt.optimizerEngine ?? 'random_search';
            const rawReturn = opt.optimalPortfolio.expectedReturn;
            const rawVol = opt.optimalPortfolio.volatility;
            const rawSharpe = opt.optimalPortfolio.sharpe;
            if (Number.isFinite(rawReturn) && Number.isFinite(rawVol) && Number.isFinite(rawSharpe)) {
              proposalMetrics = { expectedReturnPct: Math.round(rawReturn * 1000) / 10, volatilityPct: Math.round(rawVol * 1000) / 10, sharpe: rawSharpe };
            } else {
              proposalMetrics = null;
              const nanTickers = backfillFailedTickers.length > 0
                ? ` Keine EODHD-Daten für: ${backfillFailedTickers.join(', ')}.`
                : '';
              weightingNote = (weightingNote ? weightingNote + ' ' : '') + `Kennzahlen konnten nicht berechnet werden (unvollständige Kurshistorie für einige Titel).${nanTickers}`;
            }
            const excluded = opt.excludedShortHistory ?? [];
            if (excluded.length > 0) {
              const noDataSuffix = backfillFailedTickers.length > 0 ? ` (keine EODHD-Daten für: ${backfillFailedTickers.join(', ')})` : '';
              weightingNote = `Ohne ${excluded.map((e: any) => e.ticker).join(', ')} — zu wenig Kurshistorie für die Optimierung.${noDataSuffix}`;
            }
          } catch (e: any) {
            weightingSource = 'score_fallback';
            weightingNote = `Optimierung nicht möglich (${e?.message ?? 'unbekannter Fehler'}) — Gewichtung score-proportional.`;
            const maxCap = Math.max(params.maxPositionWeight, 1.2 / selected.length);
            const scoringWithBonus = selected.map((c) => ({ ticker: c.stock.ticker, adjustedScore: c.combinedScore + (watchlistRecTickers.has(c.stock.ticker.toUpperCase()) ? 10 : 0) }));
            const total = scoringWithBonus.reduce((s, c) => s + c.adjustedScore, 0) || 1;
            scoringWithBonus.forEach((c) => { weights[c.ticker] = c.adjustedScore / total; });
            let changed = true;
            while (changed) {
              changed = false;
              const sum = Object.values(weights).reduce((s, v) => s + v, 0) || 1;
              const normalized: Record<string, number> = {};
              let cappedSum = 0; let uncappedSum = 0;
              for (const [t, v] of Object.entries(weights)) { const norm = v / sum; if (norm > maxCap) { normalized[t] = maxCap; cappedSum += maxCap; changed = true; } else { normalized[t] = norm; uncappedSum += norm; } }
              if (changed && uncappedSum > 0) { const scale = (1 - cappedSum) / uncappedSum; for (const t of Object.keys(normalized)) { if (normalized[t] < maxCap) normalized[t] *= scale; } }
              Object.assign(weights, normalized);
            }
          }

          job.progress.push('Positionen aufbauen...');
          const kept = selected.map((c) => ({ c, w: weights[c.stock.ticker] ?? 0 })).filter((x) => x.w > 0);
          const wSum = kept.reduce((s, x) => s + x.w, 0) || 1;
          const positions = kept.map(({ c, w }) => { const s = c.stock; return { ticker: s.ticker, companyName: s.companyName, sector: s.sector || 'Andere', currency: s.currency || 'CHF', currentPrice: parseFloat(s.currentPrice ?? '0'), exchangeRateToChf: s.exchangeRateToChf ? parseFloat(s.exchangeRateToChf) : 1, weightPct: parseFloat(((w / wSum) * 100).toFixed(2)), combinedScore: c.combinedScore, signal: c.signal, reason: `${c.signal} · Score-Note ${c.scoreGrade}` + (c.ytdPerf !== 0 && c.ytdPerf !== null ? ` · YTD ${c.ytdPerf > 0 ? '+' : ''}${c.ytdPerf.toFixed(1)}%` : '') + (watchlistRecTickers.has(s.ticker.toUpperCase()) ? ' · Watchlist-Empfehlung' : '') + (c.regime === 'bubble' ? ' · LPPL-Warnung' : '') }; }).sort((a, b) => b.weightPct - a.weightPct);

          // Post-optimization sector/FX checks
          const sectorWeightMap: Record<string, number> = {};
          let fxWeightPct = 0;
          for (const p of positions) { sectorWeightMap[p.sector] = (sectorWeightMap[p.sector] || 0) + p.weightPct; const cur = p.currency === 'GBp' ? 'GBP' : p.currency; if (cur !== referenceCurrency) fxWeightPct += p.weightPct; }
          fxWeightPct = Math.round(fxWeightPct * 10) / 10;
          const sectorWeights = Object.entries(sectorWeightMap).map(([name, weightPct]) => ({ name, weightPct: Math.round(weightPct * 10) / 10 })).sort((a, b) => b.weightPct - a.weightPct);
          for (const sw of sectorWeights) { if (sw.weightPct > rules.maxSectorPercent + 0.5) notes.push(`Sektor ${sw.name} liegt nach der Optimierung bei ${sw.weightPct.toFixed(1)}% und damit über dem Sektor-Limit von ${rules.maxSectorPercent}%.`); }
          if (fxWeightPct > maxFxExposurePct + 0.5) {
            const fxPositions = positions.filter(p => (p.currency === 'GBp' ? 'GBP' : p.currency) !== referenceCurrency);
            const chfPositions = positions.filter(p => (p.currency === 'GBp' ? 'GBP' : p.currency) === referenceCurrency);
            const targetFxTotal = maxFxExposurePct; const currentFxTotal = fxWeightPct; const scaleFactor = targetFxTotal / currentFxTotal;
            fxPositions.forEach(p => { p.weightPct = parseFloat((p.weightPct * scaleFactor).toFixed(2)); });
            const freedWeight = fxWeightPct - targetFxTotal; const chfTotal = chfPositions.reduce((s, p) => s + p.weightPct, 0) || 1;
            chfPositions.forEach(p => { p.weightPct = parseFloat((p.weightPct + freedWeight * (p.weightPct / chfTotal)).toFixed(2)); });
            fxWeightPct = Math.round(fxPositions.reduce((s, p) => s + p.weightPct, 0) * 10) / 10;
            notes.push(`Fremdwährungsanteil wurde auf ${fxWeightPct.toFixed(1)}% reduziert (Limit: ${maxFxExposurePct}%) — FX-Positionen wurden proportional gekürzt.`);
          }
          if (liquidityNeedPct > 0 && liquidityNeedPct < 100) { const equityPct = 1 - liquidityNeedPct / 100; positions.forEach((p) => { p.weightPct = parseFloat((p.weightPct * equityPct).toFixed(2)); }); }

          // Price enrichment for external candidates
          const missingPriceTickers = positions.filter(p => !p.currentPrice || p.currentPrice === 0).map(p => p.ticker);
          if (missingPriceTickers.length > 0) {
            try {
              const { stocks: stocksTbl } = await import('../../drizzle/schema');
              const dbPriceRows = await db.select({ ticker: stocksTbl.ticker, currentPrice: stocksTbl.currentPrice, exchangeRateToChf: stocksTbl.exchangeRateToChf }).from(stocksTbl);
              const dbPrices = new Map(dbPriceRows.map((r: any) => [String(r.ticker).toUpperCase(), r]));
              for (const p of positions) { if (!p.currentPrice || p.currentPrice === 0) { const dbRow = dbPrices.get(p.ticker.toUpperCase()); if (dbRow?.currentPrice) { p.currentPrice = parseFloat(String(dbRow.currentPrice)); if (dbRow.exchangeRateToChf) p.exchangeRateToChf = parseFloat(String(dbRow.exchangeRateToChf)); } } }
            } catch (e) { console.warn('[startProposal] Price enrichment failed (non-fatal):', e); }
          }

          // Multi-agent challenge layer
          let challengeReport: any = null;
          let proposalLogId: number | null = null;
          // Auto-Übernahme (Admin-Schalter): gesetzt, wenn Challenger-/Synthese-
          // Anpassungen direkt in den Vorschlag eingearbeitet wurden.
          let autoAppliedPositions: typeof positions | undefined;
          let originalPositionsSnapshot: typeof positions | undefined;

          // A (progressiv): Ergebnis-Objekt, das sowohl als deterministisches
          // Zwischenergebnis (report=null) als auch final (mit KI-Report) baubar
          // ist. So sieht der Nutzer sein Portfolio sofort; die KI-Gegenprüfung
          // läuft im Hintergrund weiter.
          // Challenger-/Synthese-Anpassungen (reduce/increase/replace) auf eine
          // Positions-Menge anwenden. Wird für die (Nutzer-wählbare) Vorschau UND
          // für die automatische Übernahme (autoApply) genutzt.
          const computeAdjustedPositions = (base: typeof positions, finalAdjustments: any[]) => {
            if (!finalAdjustments.length) return null;
            const adj = finalAdjustments;
            let adjusted = base.map(p => ({ ...p }));
            for (const a of adj) { const pos = adjusted.find(p => p.ticker.toUpperCase() === a.ticker.toUpperCase()); if (!pos) continue; if (a.action === 'reduce') pos.weightPct = Math.max(pos.weightPct * 0.65, 3); if (a.action === 'increase') pos.weightPct = Math.min(pos.weightPct * 1.35, 15); }
            const replaceAdj = adj.filter((a: any) => a.action === 'replace');
            if (replaceAdj.length > 0) {
              const usedTickers = new Set(adjusted.map(p => p.ticker.toUpperCase()));
              const candidates = scored.filter(x => !usedTickers.has(x.stock.ticker.toUpperCase()) && isBuyable(x) && x.combinedScore >= 45).sort((a, b) => b.combinedScore - a.combinedScore);
              for (const ra of replaceAdj) { const idx = adjusted.findIndex(p => p.ticker.toUpperCase() === ra.ticker.toUpperCase()); if (idx < 0) continue; const replacement = candidates.shift(); if (!replacement) continue; usedTickers.add(replacement.stock.ticker.toUpperCase()); adjusted[idx] = { ...adjusted[idx], ticker: replacement.stock.ticker, companyName: replacement.stock.companyName, sector: replacement.stock.sector, currency: replacement.stock.currency, currentPrice: parseFloat(String(replacement.stock.currentPrice ?? '0')) || 0, combinedScore: replacement.combinedScore, signal: replacement.signal, reason: `Ersetzt ${ra.ticker} gemäss KI-Empfehlung` }; (adjusted[idx] as any).aiReason = undefined; }
            }
            const total = adjusted.reduce((s, p) => s + p.weightPct, 0);
            if (total > 0) adjusted = adjusted.map(p => ({ ...p, weightPct: Math.round((p.weightPct / total) * 1000) / 10 }));
            return adjusted;
          };

          // primaryPositions gesetzt = Anpassungen bereits übernommen (autoApply):
          // dann bildet diese Menge den eigentlichen Vorschlag; die separate
          // adjustedPositions-Vorschau entfällt. originalPositions = Menge vor der
          // Übernahme (für das Admin-Protokoll).
          const buildResultObject = (report: any, opts?: { primaryPositions?: typeof positions; originalPositions?: typeof positions }) => {
            const finalAdjustments = report?.finalAdjustments ?? [];
            const primary = opts?.primaryPositions ?? positions;
            const autoApplied = !!opts?.primaryPositions;
            const adjustedPositions = autoApplied ? null : computeAdjustedPositions(positions, finalAdjustments);
            const sectorTiltsForBadge = getSectorTilts(marktHubSignals);
            return {
              positions: primary,
              method,
              methodLabel: weightingSource === 'optimizer' ? (method === 'min_variance' ? 'Min. Varianz' : method === 'max_dividend' ? 'Max. Dividende' : 'Max. Sharpe') : 'Score-gewichtet (Fallback)',
              weighting: { source: weightingSource, engine: weightingEngine, note: weightingNote, minPositionPct: Math.round(params.minPositionWeight * 1000) / 10, maxPositionPct: Math.round(params.maxPositionWeight * 1000) / 10 },
              metrics: proposalMetrics,
              allocation: { sectors: sectorWeights, fxWeightPct, sectorCapPct: rules.maxSectorPercent, fxCapPct: maxFxExposurePct },
              notes,
              profile: { riskProfile, investmentGoal: goal, excludedSectors, esgOnly, liquidityNeedPct, targetReturnPct, referenceCurrency, maxFxExposurePct },
              stats: { universeCount: universe.length, scoredCount: scored.length, buySignals: scored.filter((x) => x.combinedScore >= 55 && x.signal !== 'SELL').length, sellExcluded: scored.filter((x) => x.signal === 'SELL').length, selectedCount: primary.length, watchlistRecommendations: primary.filter((p) => watchlistRecTickers.has(p.ticker.toUpperCase())).length, maxPositionPct: Math.max(...primary.map((p) => p.weightPct)), sectorBenchmarkFiltered: allStocks.length - universe.length, qualityTier },
              proposalLogId: proposalLogId ?? null,
              finalAdjustments,
              synthesizerVerdict: report?.synthesizerVerdict ?? null,
              overallConfidence: report?.overallConfidence ?? null,
              adjustedPositions,
              autoApplied,
              originalPositions: opts?.originalPositions ?? null,
              enhancing: report == null, // true = deterministisches Zwischenergebnis, KI läuft noch
              marktHubBadge: { hasData: marktHubSignals.hasData, regime: marktHubSignals.regime.regime, leadingFactor: marktHubSignals.factors.leadingFactor, activeSectorTilts: Object.entries(sectorTiltsForBadge).filter(([, v]) => v !== 0).map(([sector, tilt]) => ({ sector, tilt })), dynamicRiskFreeRate: Math.round(dynamicRiskFreeRate * 10000) / 100, macroSignals: { yieldCurveInverted: (marktHubSignals.macro.yieldCurveSpread ?? 0) < 0, inflationHigh: (marktHubSignals.macro.coreCpi ?? 0) > 4, hySpreadElevated: (marktHubSignals.macro.hySpread ?? 0) > 350 } },
            };
          };

          // Zwischenergebnis sofort ausliefern — Portfolio ist da, KI verfeinert noch.
          job.result = buildResultObject(null);
          job.status = 'enhancing';
          job.progress.push('Vorschlag steht — die KI verfeinert ihn noch…');

          try {
            const positionSummary = positions.map(p => ({ ticker: p.ticker, name: p.companyName, sector: p.sector, currency: p.currency, weight: p.weightPct, score: p.combinedScore, signal: p.signal, ytd: (p as any).ytdPerf ?? null, reason: p.reason }));
            const candidatePool = scored.filter(x => !positions.find(p => p.ticker === x.stock.ticker)).filter(x => isBuyable(x) && x.combinedScore >= 45).sort((a, b) => b.combinedScore - a.combinedScore).slice(0, 15).map(x => ({ ticker: x.stock.ticker, name: x.stock.companyName, sector: x.stock.sector, score: x.combinedScore, signal: x.signal }));
            const profileSummary = `Risikoprofil: ${riskProfile}, Ziel: ${goal}, Referenzwährung: ${referenceCurrency}, FX-Limit: ${maxFxExposurePct}%` + (esgOnly ? ', ESG-Wunsch: ja (Filter noch NICHT verfügbar)' : '');

            job.progress.push('KI-Analyse: Fundamentaldaten laden...');
            let usFundamentals: Awaited<ReturnType<typeof import('../lib/financialDatasets')['getFundamentalsFactsBatch']>> = [];
            try {
              const { getFundamentalsFactsBatch } = await import('../lib/financialDatasets');
              usFundamentals = await getFundamentalsFactsBatch(positions.map((p) => p.ticker), 3, 5000);
            } catch (fErr: any) {
              console.warn('[startProposal] Fundamentaldaten-Batch fehlgeschlagen (nicht-fatal):', fErr?.message);
            }

            const factsSummary = [
              `Sektor-Gewichte: ${sectorWeights.map((s) => `${s.name} ${s.weightPct.toFixed(1)}%`).join(', ')} (Limit je Sektor: ${rules.maxSectorPercent}%)`,
              `Fremdwährungsanteil: ${fxWeightPct.toFixed(1)}% (Limit: ${maxFxExposurePct}%)`,
              proposalMetrics ? `Erwartete Kennzahlen: Rendite ${proposalMetrics.expectedReturnPct.toFixed(1)}% p.a., Volatilität ${proposalMetrics.volatilityPct.toFixed(1)}%, Sharpe ${proposalMetrics.sharpe.toFixed(2)}` : 'Gewichtung: Score-Fallback',
              `Auswahl-Qualitätsstufe: ${qualityTier}`,
              ...(usFundamentals.length > 0 ? [`Fundamentaldaten (Financial Datasets, nur US-Titel):\n${usFundamentals.map((f) => `  - ${f.summary}`).join('\n')}`] : []),
            ].join('\n');

            const marktHubContext = buildMarktHubContext(marktHubSignals);
            const sectorTiltsDescription = describeSectorTilts(sectorTilts);
            const marktHubContextBlock = marktHubContext ? `\n\n**Aktuelle Markt-Hub-Signale:**\n${marktHubContext}\n\nAktive Sektor-Tilts: ${sectorTiltsDescription}\nMSCI Führender Faktor: ${marktHubSignals.factors.leadingFactor ?? 'unbekannt'}\n` : '';

            const positionTickers = new Set(positions.map((p) => p.ticker.toUpperCase()));
            const poolTickers = new Set(candidatePool.map((c) => c.ticker.toUpperCase()));

            // Admin-Feedback-Kontext (fliesst in die finale Empfehlung ein)
            let adminFeedbackContext = '';
            try {
              const { portfolioProposalLog } = await import('../../drizzle/schema');
              const { isNotNull, desc } = await import('drizzle-orm');
              const recentFeedback = await db!.select({ adminFeedback: portfolioProposalLog.adminFeedback }).from(portfolioProposalLog).where(isNotNull(portfolioProposalLog.adminFeedback)).orderBy(desc(portfolioProposalLog.createdAt)).limit(8);
              if (recentFeedback.length >= 2) {
                const tickerActions: Record<string, { reduce: number; increase: number; replace: number; total: number }> = {};
                for (const row of recentFeedback) { const fb = row.adminFeedback as any; if (!fb) continue; const changes: Array<{ ticker: string; action: string }> = [...(fb.reduced ?? []).map((t: string) => ({ ticker: t, action: 'reduce' })), ...(fb.increased ?? []).map((t: string) => ({ ticker: t, action: 'increase' })), ...(fb.replaced ?? []).map((t: string) => ({ ticker: t, action: 'replace' }))]; for (const c of changes) { if (!tickerActions[c.ticker]) tickerActions[c.ticker] = { reduce: 0, increase: 0, replace: 0, total: 0 }; tickerActions[c.ticker][c.action as 'reduce' | 'increase' | 'replace']++; tickerActions[c.ticker].total++; } }
                const patterns = Object.entries(tickerActions).filter(([, v]) => v.total >= 2).map(([ticker, v]) => { const dominant = [...(['reduce', 'increase', 'replace'] as const)].sort((a, b) => v[b] - v[a])[0]; return `${ticker}: Admin hat ${v.total}x ${dominant === 'reduce' ? 'reduziert' : dominant === 'increase' ? 'erhöht' : 'ersetzt'}`; });
                if (patterns.length > 0) adminFeedbackContext = `\n\nHistorisches Admin-Feedback (letzte ${recentFeedback.length} genehmigte Vorschläge):\n${patterns.join('\n')}\nBerücksichtige diese Muster bei deinen Empfehlungen.`;
              }
            } catch (fbErr) { console.warn('[startProposal] Could not load admin feedback:', fbErr); }

            // Modellwahl pro Rolle (Admin-konfigurierbar).
            // Standard-Modus: ein Analyse-Modell prüft kritisch UND erstellt die
            // finale Empfehlung (Challenger + Synthese in einem Aufruf, Option B).
            // Qualitätsmodus (ensemble): zwei Challenger prüfen PARALLEL, ein
            // Synthesizer wägt beide Kritiken ab, dann die Titel-Texte. Das
            // Text-Modell formuliert die einfachen Begründungen. Jeder Anbieter
            // fällt bei Fehlern automatisch auf Kimi zurück.
            const models = await getProposalModelConfig();
            const agentStart = Date.now();

            const tickerReasonItem = { type: 'object', properties: { ticker: { type: 'string' }, reason: { type: 'string' } }, required: ['ticker', 'reason'], additionalProperties: false };
            const adjustmentItem = { type: 'object', properties: { ticker: { type: 'string' }, action: { type: 'string', enum: ['keep', 'replace', 'reduce', 'increase'] }, reason: { type: 'string' } }, required: ['ticker', 'action', 'reason'], additionalProperties: false };
            const posReasonsSchema = { type: 'array', items: { type: 'object', properties: { ticker: { type: 'string' }, text: { type: 'string' } }, required: ['ticker', 'text'], additionalProperties: false } };
            const posReasonsInstruction = 'für JEDE vorgeschlagene Position 2-3 Sätze, die 2-3 KONKRETE, titelspezifische Anlagegründe nennen, WARUM genau dieser Titel ins Portfolio passt. Stütze dich auf bekannte Stärken genau DIESES Unternehmens sowie die gelieferten Signale (Momentum aus YTD, Dividendenrendite, Fundamentaldaten, Qualität). Nenne konkrete Gründe wie z.B.: wirtschaftlicher Burggraben (Moat), Marktführerschaft in seinem Segment, starkes Kursmomentum, hoher/stabiler Free Cashflow, Dividenden-Aristokrat bzw. verlässlich steigende Dividende, robuste Bilanz, strukturelles Wachstum, defensives/krisenfestes Geschäftsmodell oder attraktive Bewertung — aber NUR was für dieses Unternehmen plausibel zutrifft (nicht erfinden). VERBOTEN: Schablonen, dieselben Gründe über mehrere Titel wiederholen, blosses Übersetzen von Score/Note/Gewicht/Prozentzahlen in Worte, Floskeln wie "ist ein Wert aus dem Bereich X". Zielgruppe: Privatanleger 50+ — verständlich, aber inhaltlich konkret und substanziell.';
            const confidenceRule = '"hoch" (FX-Limit eingehalten, kein Sektor > 30%, alle BUY, Sharpe > 0.5, ≤ 1 Einwand) / "niedrig" (FX überschritten, Sektor > 40%, SELL-Titel, Sharpe < 0.2, ≥ 3 Einwände) / "mittel" (sonst)';
            const verdictInstruction = 'eine AUSFÜHRLICHE Gesamtbewertung des Portfolios (4-6 Sätze, ca. 120-180 Wörter, wie eine kompakte Analystennotiz): (a) Gesamteinschätzung (günstig/teuer bewertet, defensiv/offensiv ausgerichtet), (b) 1-2 zentrale Stärken (z.B. Diversifikation, Dividendenstärke, Qualität der Titel), (c) das grösste Risiko bzw. die Hauptschwäche, (d) ein konkreter Handlungshinweis. Deutsch, für Privatanleger 50+ verständlich, aber inhaltlich fundiert — keine Wiederholung blosser Kennzahlen.';
            const contextBlock = `Anlegerprofil: ${profileSummary}\n\nBerechnete Fakten:\n${factsSummary}\n\nVorgeschlagene Positionen (mit Gewichten):\n${JSON.stringify(positionSummary, null, 2)}\n\nVerfügbare Alternativen (NUR diese Ticker dürfen als Ersatz dienen):\n${JSON.stringify(candidatePool, null, 2)}${adminFeedbackContext}${marktHubContextBlock}`;

            let agentResult: any = { critique: '', rejected: [], alternatives: [], verdict: '', adjustments: [], overallConfidence: 'mittel', positionReasons: [] };

            // Eigenes Text-Modell für die Titel-Begründungen (mutiert agentResult).
            // Batching: bei > 10 Positionen in Gruppen aufteilen, um Token-Limits zu vermeiden.
            const BATCH_SIZE = 10;
            let textFailureReason = '';
            const fillTexts = async () => {
              const allReasons: Array<{ ticker: string; text: string }> = [];
              const batches: typeof positionSummary[] = [];
              for (let i = 0; i < positionSummary.length; i += BATCH_SIZE) {
                batches.push(positionSummary.slice(i, i + BATCH_SIZE));
              }
              job.progress.push(`KI-Texte (${models.text}): ${positionSummary.length} Titel in ${batches.length} Batch(es) begründen...`);
              for (let bi = 0; bi < batches.length; bi++) {
                const batch = batches[bi];
                try {
                  const batchLabel = batches.length > 1 ? ` (Batch ${bi + 1}/${batches.length})` : '';
                  const { result: textResult, providerUsed } = await invokeProposalAgent(models.text, {
                    system: 'Du bist ein erfahrener Schweizer Anlageberater und Aktienanalyst. Du erklärst Privatanlegern 50+ verständlich, aber inhaltlich fundiert, warum ein konkreter Titel überzeugt. Du kennst die grossen Unternehmen und ihre Geschäftsmodelle. Antworte immer auf Deutsch.',
                    user: `Formuliere für JEDE dieser Positionen ${posReasonsInstruction}\n\nAnlegerprofil: ${profileSummary}\n\nBerechnete Fakten (u.a. Fundamentaldaten):\n${factsSummary}\n\nPositionen (mit Signalen)${batchLabel}:\n${JSON.stringify(batch, null, 2)}\n\nGesamturteil der Analyse: ${agentResult.verdict ?? ''}`,
                    schema: { name: 'position_reasons', strict: true, schema: { type: 'object', properties: { positionReasons: posReasonsSchema }, required: ['positionReasons'], additionalProperties: false } },
                    maxTokens: 4096,
                  });
                  console.log(`[fillTexts] batch ${bi + 1}/${batches.length} — providerUsed=${providerUsed}, keys: ${Object.keys(textResult ?? {}).join(', ')}`);
                  console.log(`[fillTexts] positionReasons isArray: ${Array.isArray(textResult?.positionReasons)}, length: ${Array.isArray(textResult?.positionReasons) ? textResult.positionReasons.length : 'N/A'}`);
                  if (Array.isArray(textResult?.positionReasons) && textResult.positionReasons.length > 0) {
                    console.log(`[fillTexts] first positionReason in batch: ${JSON.stringify(textResult.positionReasons[0])}`);
                    allReasons.push(...textResult.positionReasons);
                  } else {
                    console.warn(`[fillTexts] batch ${bi + 1} returned no positionReasons. raw (first 500): ${JSON.stringify(textResult)?.substring(0, 500)}`);
                  }
                  if (providerUsed !== models.text) job.progress.push(`KI-Texte Batch ${bi + 1}: ${models.text} nicht verfügbar — Fallback auf ${providerUsed}.`);
                } catch (batchErr: any) {
                  console.warn(`[startProposal] Text-Modell Batch ${bi + 1} (${models.text}) fehlgeschlagen: ${batchErr?.message}`);
                  textFailureReason = batchErr?.message ?? textFailureReason;
                  job.progress.push(`⚠️ KI-Texte Batch ${bi + 1} fehlgeschlagen: ${batchErr?.message ?? 'unbekannter Fehler'}`);
                }
              }
              if (allReasons.length > 0) {
                agentResult.positionReasons = allReasons;
                job.progress.push(`KI-Texte: ${allReasons.length}/${positionSummary.length} Titel individuell begründet.`);
              } else {
                job.progress.push(`⚠️ KI-Texte: keine individuellen Begründungen erhalten.`);
              }
            };

            // Individuelle Titel-Begründung an die Positionen hängen. LLMs lassen
            // das Börsen-Suffix gern weg ("PSK" statt "PSK.TO"); eindeutige
            // Basis-Ticker werden deshalb auf den vollen Ticker zurückgeführt.
            const attachPositionReasons = (reasons: any[]): number => {
              const baseTicker = (t: string) => t.split('.')[0];
              const baseToFull = new Map<string, string | null>(); // null = mehrdeutig
              for (const full of positionTickers) { const b = baseTicker(full); baseToFull.set(b, baseToFull.has(b) ? null : full); }
              const reasonMap = new Map<string, string>();
              for (const pr of (reasons ?? [])) {
                const raw = pr?.ticker ? String(pr.ticker).toUpperCase() : '';
                const text = typeof pr?.text === 'string' ? pr.text.trim() : '';
                if (!raw || !text) continue;
                const t = positionTickers.has(raw) ? raw : (baseToFull.get(baseTicker(raw)) ?? '');
                if (!t) continue;
                // Manche Modelle liefern mehrere Einträge je Ticker → zusammenführen.
                reasonMap.set(t, reasonMap.has(t) ? `${reasonMap.get(t)} ${text}` : text);
              }
              for (const p of positions) { const t = reasonMap.get(p.ticker.toUpperCase()); if (t) (p as any).aiReason = t; }
              return reasonMap.size;
            };

            // Titel-Texte ZUERST und ISOLIERT: sie müssen im ERSTEN Vorschlag
            // erscheinen (vor der Admin-Prüfung) und dürfen nicht an der
            // langsameren/fragileren Challenger-Synthese-Analyse hängen.
            await fillTexts();
            const reasonCount = attachPositionReasons(agentResult.positionReasons);
            console.log(`[startProposal] aiReason: ${reasonCount}/${positions.length} gesetzt.`);
            job.progress.push(reasonCount > 0
              ? `KI-Texte: ${reasonCount}/${positions.length} Titel individuell begründet.`
              : `⚠️ KI-Texte: keine individuellen Begründungen erhalten — Titel zeigen die Standard-Begründung.`);
            // Diagnose sichtbar machen, falls die Texte komplett fehlschlagen —
            // damit der Grund (Text-Modell/API) direkt im Vorschlag erkennbar ist.
            if (reasonCount === 0) {
              notes.push(`⚠️ KI-Titel-Begründungen konnten nicht erzeugt werden (Modell "${models.text}"${textFailureReason ? `: ${textFailureReason.slice(0, 160)}` : ''}). Es wird die Standard-Begründung angezeigt.`);
            }
            // Zwischenergebnis MIT Texten sofort ausliefern — noch VOR der Analyse.
            job.result = buildResultObject(null);

            if (models.ensemble) {
              // ── Qualitätsmodus: 2 Challenger parallel → Synthese → Text ──
              job.progress.push(`Qualitätsmodus: 2 Challenger (${models.analysis} + ${models.challengerB}) prüfen parallel...`);
              const challengerSystem = 'Du bist ein kritischer Portfolio-Analyst ("Challenger"). Du hinterfragst algorithmisch erstellte Portfolio-Vorschläge scharf und konstruktiv. Antworte immer auf Deutsch, präzise.';
              const challengerUser = `Prüfe diesen Portfolio-Vorschlag kritisch.\n\n${contextBlock}\n\nLiefere:\n1. critique: 1-3 Hauptschwachstellen (Klumpenrisiko, Widerspruch zu Markt-Hub, schlechte Diversifikation) in 2-3 Sätzen.\n2. rejected: kritisch gesehene Positionen (nur Ticker aus den Positionen).\n3. alternatives: bessere Ersatztitel (nur Ticker aus dem Kandidatenpool).\n\nAntworte im JSON-Format.`;
              const challengerSchema = { name: 'challenger', strict: true, schema: { type: 'object', properties: { critique: { type: 'string' }, rejected: { type: 'array', items: tickerReasonItem }, alternatives: { type: 'array', items: tickerReasonItem } }, required: ['critique', 'rejected', 'alternatives'], additionalProperties: false } };
              const empty = { critique: '', rejected: [], alternatives: [] };
              const [rA, rB] = await Promise.all([
                invokeProposalAgent(models.analysis, { system: challengerSystem, user: challengerUser, schema: challengerSchema, maxTokens: 3072 }).catch((e: any) => { console.warn(`[startProposal] Challenger A (${models.analysis}) fehlgeschlagen: ${e?.message}`); return { result: empty }; }),
                invokeProposalAgent(models.challengerB, { system: challengerSystem, user: challengerUser, schema: challengerSchema, maxTokens: 3072 }).catch((e: any) => { console.warn(`[startProposal] Challenger B (${models.challengerB}) fehlgeschlagen: ${e?.message}`); return { result: empty }; }),
              ]);
              const cA = rA.result ?? empty; const cB = rB.result ?? empty;

              job.progress.push(`Synthese (${models.synthesis}): beide Kritiken abwägen...`);
              const synthUser = `${contextBlock}\n\nKritik von Analyst A:\nGesamt: ${cA.critique}\nAbgelehnt: ${JSON.stringify(cA.rejected ?? [])}\nAlternativen: ${JSON.stringify(cA.alternatives ?? [])}\n\nKritik von Analyst B:\nGesamt: ${cB.critique}\nAbgelehnt: ${JSON.stringify(cB.rejected ?? [])}\nAlternativen: ${JSON.stringify(cB.alternatives ?? [])}\n\nWäge BEIDE Kritiken gegeneinander ab (gemeinsame Punkte wiegen schwerer, Widersprüche kritisch prüfen) und erstelle:\n1. verdict: ${verdictInstruction}\n2. adjustments: konkrete Anpassungen je Titel (keep/reduce/increase/replace) mit Begründung — Ersatz nur aus dem Kandidatenpool.\n3. overallConfidence: ${confidenceRule}.\n\nAntworte im JSON-Format.`;
              const synthSchema = { name: 'synthesis', strict: true, schema: { type: 'object', properties: { verdict: { type: 'string' }, adjustments: { type: 'array', items: adjustmentItem }, overallConfidence: { type: 'string', enum: ['hoch', 'mittel', 'niedrig'] } }, required: ['verdict', 'adjustments', 'overallConfidence'], additionalProperties: false } };
              const { result: synth } = await invokeProposalAgent(models.synthesis, {
                system: 'Du bist ein erfahrener Portfolio-Manager ("Synthesizer"). Du erhältst einen algorithmischen Vorschlag und ZWEI unabhängige kritische Analysen. Moderiere die Erkenntnisse zu einer finalen Empfehlung. Antworte immer auf Deutsch.',
                user: synthUser, schema: synthSchema, maxTokens: 4096,
              });

              const dedupByTicker = (arr: any[]) => { const seen = new Set<string>(); const out: any[] = []; for (const x of arr) { const t = x?.ticker ? String(x.ticker).toUpperCase() : ''; if (!t || seen.has(t)) continue; seen.add(t); out.push(x); } return out; };
              agentResult = {
                critique: [cA.critique && `A: ${cA.critique}`, cB.critique && `B: ${cB.critique}`].filter(Boolean).join('\n\n'),
                rejected: dedupByTicker([...(cA.rejected ?? []), ...(cB.rejected ?? [])]),
                alternatives: dedupByTicker([...(cA.alternatives ?? []), ...(cB.alternatives ?? [])]),
                verdict: synth?.verdict ?? '',
                adjustments: synth?.adjustments ?? [],
                overallConfidence: synth?.overallConfidence ?? 'mittel',
                positionReasons: [],
              };
            } else {
              // ── Standard: ein Analyse-Aufruf (Challenger + Synthese). ──
              // Titel-Texte laufen bereits separat & vorab (oben), daher hier NICHT.
              job.progress.push(`KI-Analyse (${models.analysis}): Vorschlag prüfen & finalisieren...`);
              const analysisProps: Record<string, any> = {
                critique: { type: 'string' },
                rejected: { type: 'array', items: tickerReasonItem },
                alternatives: { type: 'array', items: tickerReasonItem },
                verdict: { type: 'string' },
                adjustments: { type: 'array', items: adjustmentItem },
                overallConfidence: { type: 'string', enum: ['hoch', 'mittel', 'niedrig'] },
              };
              const analysisRequired = ['critique', 'rejected', 'alternatives', 'verdict', 'adjustments', 'overallConfidence'];

              const { result } = await invokeProposalAgent(models.analysis, {
                system: 'Du bist zugleich kritischer Portfolio-Analyst ("Challenger") und erfahrener Portfolio-Manager ("Synthesizer"). Prüfe den algorithmischen Vorschlag zuerst kritisch und erstelle im selben Schritt die finale Empfehlung mit konkreten Anpassungen. Antworte immer auf Deutsch, präzise und konstruktiv.',
                user: `Prüfe diesen Portfolio-Vorschlag kritisch und erstelle die finale Empfehlung.\n\n${contextBlock}\n\nLiefere:\n1. critique: 1-3 Hauptschwachstellen (Klumpenrisiko, Widerspruch zu Markt-Hub, schlechte Diversifikation) in 2-3 Sätzen.\n2. rejected: kritisch gesehene Positionen (nur Ticker aus den Positionen).\n3. alternatives: bessere Ersatztitel (nur Ticker aus dem Kandidatenpool).\n4. verdict: ${verdictInstruction}\n5. adjustments: konkrete Anpassungen je Titel (keep/reduce/increase/replace) mit Begründung — Ersatz nur aus dem Kandidatenpool.\n6. overallConfidence: ${confidenceRule}.\n\nAntworte im JSON-Format.`,
                schema: { name: 'portfolio_review', strict: true, schema: { type: 'object', properties: analysisProps, required: analysisRequired, additionalProperties: false } },
                maxTokens: 4096,
              });
              // positionReasons aus dem frühen Text-Schritt beibehalten.
              agentResult = { ...result, positionReasons: agentResult.positionReasons };
            }

            const challengerResult = {
              critique: agentResult.critique ?? '',
              rejected: (agentResult.rejected ?? []).filter((r: any) => r?.ticker && positionTickers.has(String(r.ticker).toUpperCase())),
              alternatives: (agentResult.alternatives ?? []).filter((a: any) => a?.ticker && poolTickers.has(String(a.ticker).toUpperCase())),
            };
            const synthResult = {
              verdict: agentResult.verdict ?? '',
              adjustments: (agentResult.adjustments ?? []).filter((adj: any) => { const t = adj?.ticker ? String(adj.ticker).toUpperCase() : ''; return t && (positionTickers.has(t) || poolTickers.has(t)); }),
              overallConfidence: agentResult.overallConfidence ?? 'mittel',
            };
            const agentDuration = Date.now() - agentStart;

            challengeReport = { challengerCritique: challengerResult.critique, challengerRejected: challengerResult.rejected, challengerAlternatives: challengerResult.alternatives, synthesizerVerdict: synthResult.verdict, finalAdjustments: synthResult.adjustments, overallConfidence: synthResult.overallConfidence as 'hoch' | 'mittel' | 'niedrig', agentDuration };

            // Auto-Übernahme: Anpassungen direkt einarbeiten (fertiges Portfolio
            // in einem Schritt). Der Admin sieht die Änderungen weiter im
            // Protokoll (finalAdjustments). Metriken bleiben die des Ausgangs-
            // Portfolios — die Anpassungen sind Feinschliff (Gewichte/wenige Swaps).
            if (models.autoApply && synthResult.adjustments.length > 0) {
              const applied = computeAdjustedPositions(positions, synthResult.adjustments);
              if (applied && applied.length) {
                originalPositionsSnapshot = positions.map(p => ({ ...p }));
                autoAppliedPositions = applied;
                job.progress.push('Challenger-Verbesserungen automatisch übernommen.');
                // Texte für neu eingetauschte Titel (ohne aiReason) nachziehen.
                const missing = autoAppliedPositions.filter(p => !(p as any).aiReason);
                if (missing.length > 0) {
                  try {
                    const missSummary = missing.map(p => ({ ticker: p.ticker, name: p.companyName, sector: p.sector, currency: p.currency, weight: p.weightPct, score: p.combinedScore, signal: p.signal }));
                    const { result: tr } = await invokeProposalAgent(models.text, {
                      system: 'Du bist ein erfahrener Schweizer Anlageberater und Aktienanalyst. Antworte immer auf Deutsch.',
                      user: `Formuliere für JEDE dieser Positionen ${posReasonsInstruction}\n\nAnlegerprofil: ${profileSummary}\n\nPositionen:\n${JSON.stringify(missSummary, null, 2)}`,
                      schema: { name: 'position_reasons', strict: true, schema: { type: 'object', properties: { positionReasons: posReasonsSchema }, required: ['positionReasons'], additionalProperties: false } },
                      maxTokens: 4096,
                    });
                    const map = new Map<string, string>();
                    for (const pr of (tr?.positionReasons ?? [])) { const t = pr?.ticker ? String(pr.ticker).toUpperCase() : ''; const txt = typeof pr?.text === 'string' ? pr.text.trim() : ''; if (t && txt) map.set(t, map.has(t) ? `${map.get(t)} ${txt}` : txt); }
                    for (const p of autoAppliedPositions) { if (!(p as any).aiReason) { const t = map.get(p.ticker.toUpperCase()); if (t) (p as any).aiReason = t; } }
                  } catch (e: any) { console.warn('[startProposal] Ersatz-Texte fehlgeschlagen:', e?.message); }
                }
              }
            }

            // Kennzahlen-Filter
            let meetsKennzahlenFilter: 'ja' | 'nein' | 'n/a' = 'n/a';
            let kennzahlenFilterReason = '';
            if (proposalMetrics) {
              const proposalSharpe = proposalMetrics.sharpe;
              const proposalDivYield = positions.reduce((sum, p) => { const wl = watchlistScoreMap.get(p.ticker.toUpperCase()); const div = parseFloat((wl as any)?.dividendYield ?? '0') || 0; return sum + div * (p.weightPct / 100); }, 0);
              const sharpeOk = proposalSharpe > 0.3;
              const divOk = goal === 'dividends' ? proposalDivYield >= 2 : true;
              meetsKennzahlenFilter = (sharpeOk && divOk) ? 'ja' : 'nein';
              if (!sharpeOk) kennzahlenFilterReason += `Sharpe ${proposalSharpe.toFixed(2)} < 0.3. `;
              if (!divOk) kennzahlenFilterReason += `Dividendenrendite ${proposalDivYield.toFixed(1)}% < 2%. `;
              if (meetsKennzahlenFilter === 'ja') kennzahlenFilterReason = `Sharpe ${proposalSharpe.toFixed(2)}, Div-Rendite ${proposalDivYield.toFixed(1)}% — Kennzahlen erfüllt.`;
              if (meetsKennzahlenFilter === 'nein') notes.push(`⚠️ Kennzahlen-Filter: ${kennzahlenFilterReason.trim()}`);
            }

            // DB logging
            try {
              const { portfolioProposalLog } = await import('../../drizzle/schema');
              const loggedPositions = autoAppliedPositions ?? positions;
              const insertResult = await db.insert(portfolioProposalLog).values({ userId: ctx.user.id, riskProfile, investmentGoal: goal, referenceCurrency, maxFxExposurePct, investmentAmount: input?.investmentAmount ?? null, positionCount: loggedPositions.length, method, qualityTier, sharpe: proposalMetrics?.sharpe != null ? String(proposalMetrics.sharpe) as any : null, expectedReturnPct: proposalMetrics?.expectedReturnPct != null ? String(proposalMetrics.expectedReturnPct) as any : null, volatilityPct: proposalMetrics?.volatilityPct != null ? String(proposalMetrics.volatilityPct) as any : null, fxWeightPct: String(fxWeightPct) as any, positions: loggedPositions as any, challengerCritique: challengerResult.critique, challengerRejectedCount: challengerResult.rejected.length, synthesizerVerdict: synthResult.verdict, overallConfidence: synthResult.overallConfidence as 'hoch' | 'mittel' | 'niedrig', finalAdjustments: synthResult.adjustments as any, agentDurationMs: agentDuration, meetsKennzahlenFilter, kennzahlenFilterReason });
              proposalLogId = (insertResult as any)?.insertId ?? null;
              try { const { notifyOwner } = await import('../_core/notification'); const adminUrl = `/admin/proposal-analysis?proposalId=${proposalLogId}&returnTo=/portfolio-builder`; await notifyOwner({ title: `⚠️ Neuer KI-Vorschlag #${proposalLogId} wartet auf Review`, content: `Nutzer ${ctx.user.name ?? ctx.user.openId} hat einen neuen Portfolio-Vorschlag generiert.\n\nKonfidenz: ${synthResult.overallConfidence} | Positionen: ${positions.length}\n\nZum Review: ${adminUrl}` }); } catch (notifyErr: any) { console.warn(`[startProposal] Admin notification failed:`, notifyErr?.message); }
            } catch (logErr: any) { console.warn(`[startProposal] DB logging failed:`, logErr?.message); }
          } catch (agentErr: any) {
            console.warn(`[startProposal] Multi-agent layer failed (non-fatal): ${agentErr?.message}`);
          }

          // Finales Ergebnis (mit KI-Report) — ersetzt das Zwischenergebnis.
          // Bei Auto-Übernahme ist die angepasste Menge der eigentliche Vorschlag.
          job.result = buildResultObject(challengeReport, autoAppliedPositions ? { primaryPositions: autoAppliedPositions, originalPositions: originalPositionsSnapshot } : undefined);
          job.status = 'done';
          job.progress.push('✅ Vorschlag fertig!');
          console.log(`[startProposal] Job ${jobId} completed for user ${ctx.user.id}`);
        } catch (err: any) {
          job.status = 'error';
          job.error = err.message || 'Unbekannter Fehler';
          job.progress.push(`❌ Fehler: ${err.message}`);
          console.error(`[startProposal] Job ${jobId} failed:`, err);
        }
      })();

      return { jobId };
    }),

  /**
   * Polling-Endpoint für startProposal.
   * Gibt Status, Fortschritt und (wenn fertig) das Ergebnis zurück.
   */
  getProposalStatus: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ ctx, input }) => {
      const job = proposalJobs.get(input.jobId);
      if (!job) return { status: 'not_found' as const, progress: [], result: null, error: 'Job nicht gefunden oder abgelaufen.' };
      if (job.userId !== ctx.user.id) return { status: 'error' as const, progress: [], result: null, error: 'Kein Zugriff auf diesen Job.' };
      return {
        status: job.status,
        progress: job.progress,
        result: job.result,
        error: job.error,
      };
    }),

  // Der frühere LLM-Endpoint `generatePortfolio` (gesamte Aktientabelle an ein
  // LLM, Gewichte vom Modell geraten) wurde von keiner Client-Seite aufgerufen
  // und ist entfernt — der echte Pfad ist buildProposal (deterministisch
  // + optimiert + Challenge-Layer).
});
