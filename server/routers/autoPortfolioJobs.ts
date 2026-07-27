/**
 * Async-Job-Procedures des Auto-Portfolio-Routers: startProposal (startet den
 * Vorschlags-Job, gibt sofort eine jobId zurück) und getProposalStatus
 * (Polling-Endpoint). Aus autoPortfolioRouter.ts ausgelagert (reine
 * Dateigrössen-Aufteilung, keine Verhaltensänderung).
 */
import { protectedProcedure } from "../_core/trpc";
import { randomUUID } from "crypto";
import { z } from "zod";
import { fxRateForStock } from "../lib/fxRateGuard";
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
import { applyMultiAssetSleeve, createDbPriceResolver } from "../lib/multiAssetSleeve";
import { proposalJobs, SLEEVE_CLASS_LABELS, formatSleeveAllocation, type ProposalJob } from "./autoPortfolioShared";

  /**
   * F4b: Nicht-blockierender Portfolio-Vorschlag (Async-Job-Muster).
   * Gibt sofort eine jobId zurück. Polling via getProposalStatus.
   * Löst den HTTP 524 Timeout bei langen Kimi-K3-Anfragen.
   */
export const startProposalProcedure = protectedProcedure
    .input(z.object({ investmentAmount: z.number().positive().optional(), stocksOnly: z.boolean().optional() }).optional())
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

          const stocksOnly = input?.stocksOnly ?? false;
          const notes: string[] = [];

          // Die Positionsgrenzen gelten fuer das GESAMTPORTFOLIO, nicht nur fuer
          // den Aktienteil. Der Optimizer sieht aber nur die Aktien, deren
          // Gewichte sich auf 100 summieren; danach werden sie zweimal
          // herunterskaliert — auf die Aktienquote des Profils und um die
          // Liquiditaetsquote. Eine im Optimizer eingehaltene Untergrenze von
          // 3 % landete so bei 55 % Aktienquote real bei 1.65 %.
          // Deshalb werden die Grenzen VOR der Optimierung hochgerechnet.
          const { getMultiAssetAllocation } = await import('../lib/multiAssetSleeve');
          const allocMatrix = await getMultiAssetAllocation();
          const equitySharePct = stocksOnly ? 100 : (allocMatrix[riskProfile]?.equity ?? 100);
          const cashFactor = liquidityNeedPct > 0 && liquidityNeedPct < 100 ? 1 - liquidityNeedPct / 100 : 1;
          const equityScale = (equitySharePct / 100) * cashFactor;

          const scaledRules = equityScale > 0 ? {
            ...rules,
            minPositionPercent: Math.min(rules.minPositionPercent / equityScale, 100),
            maxPositionPercent: Math.min(rules.maxPositionPercent / equityScale, 100),
          } : rules;

          // Aus der hochgerechneten Untergrenze folgt zwingend eine Obergrenze
          // fuer die Titelzahl: mehr Titel liessen sich nicht mehr ueber der
          // Grenze gewichten. Ohne diesen Deckel wuerde effectiveBounds() die
          // Untergrenze still auf 1/n absenken und die Regel wieder aushebeln.
          const maxTitlesByFloor = Math.max(1, Math.floor(100 / scaledRules.minPositionPercent));
          const effectiveMaxTitles = Math.min(rules.maxTitles, maxTitlesByFloor);
          if (effectiveMaxTitles < rules.maxTitles) {
            notes.push(
              `Titelzahl auf ${effectiveMaxTitles} begrenzt: Bei einer Aktienquote von ${equitySharePct}%` +
              (cashFactor < 1 ? ` und ${liquidityNeedPct}% Liquiditaet` : '') +
              ` lassen sich mehr Titel nicht mehr mit mindestens ${rules.minPositionPercent}% des Gesamtportfolios gewichten.`
            );
          }
          if (rules.minTitles > effectiveMaxTitles) {
            notes.push(
              `Regelkonflikt: Die geforderten mindestens ${rules.minTitles} Titel lassen sich bei ${rules.minPositionPercent}% Mindestgewicht ` +
              `und ${equitySharePct}% Aktienquote nicht einhalten — es wurden ${effectiveMaxTitles} Titel gewaehlt.`
            );
          }

          const { optimizerParamsForProfile } = await import('../lib/profileOptimizerParams');
          const params = optimizerParamsForProfile({ riskProfile, maxDrawdownTolerancePct: profile.maxDrawdownTolerancePct, investmentHorizonYears: profile.investmentHorizonYears }, scaledRules);

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

          // Zweitnotierungen desselben Emittenten zusammenführen. Der
          // Basis-Ticker-Abgleich oben greift nur bei gleichem Symbol
          // («NESN» / «NESN.SW»); zwei Notierungen unter verschiedenen
          // Symbolen — «BATS.L» und «BTI» für British American Tobacco —
          // rutschten beide ins Universum und damit in denselben Vorschlag.
          // Behalten wird die Notierung mit der grösseren Marktkapitalisierung
          // (in aller Regel die Hauptnotierung), bei Gleichstand der
          // alphabetisch erste Ticker — damit ist die Auswahl deterministisch
          // und nicht von der DB-Reihenfolge abhängig.
          const { issuerKey } = await import('../lib/issuerIdentity');
          const mcapOf = (s: any) => {
            const raw = s.marketCap ? String(s.marketCap).replace(/[^0-9.]/g, '') : '';
            const v = raw ? parseFloat(raw) : NaN;
            return Number.isFinite(v) ? v : 0;
          };
          const byIssuer = new Map<string, any>();
          const issuerDuplicates: string[] = [];
          for (const s of deduplicatedStocks as any[]) {
            const key = issuerKey(s.companyName);
            if (!key) { byIssuer.set(`__ticker__${String(s.ticker)}`, s); continue; }
            const prev = byIssuer.get(key);
            if (!prev) { byIssuer.set(key, s); continue; }
            const prevWins = mcapOf(prev) > mcapOf(s)
              || (mcapOf(prev) === mcapOf(s) && String(prev.ticker) <= String(s.ticker));
            const loser = prevWins ? s : prev;
            if (!prevWins) byIssuer.set(key, s);
            issuerDuplicates.push(`${loser.ticker} (zugunsten von ${(prevWins ? prev : s).ticker})`);
          }
          const issuerDeduplicated = Array.from(byIssuer.values());
          if (issuerDuplicates.length > 0) {
            console.log(`[startProposal] Zweitnotierungen entfernt: ${issuerDuplicates.join(', ')}`);
          }
          const universe = issuerDeduplicated.filter((s: any) => {
            const tickerUpper = String(s.ticker ?? '').toUpperCase();
            const baseUpper = tickerUpper.split('.')[0];
            if (TICKER_BLACKLIST.has(tickerUpper) || TICKER_BLACKLIST.has(baseUpper)) return false;
            // Multi-Asset-Sleeve-ETFs gehören nicht ins Aktien-Universum (werden separat zugemischt)
            if (typeof s.notes === 'string' && s.notes.startsWith('multi_asset_sleeve|')) return false;
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
            const gaps = analyzeGaps(scored.map((x: any) => ({ ticker: x.stock.ticker, sector: x.stock.sector, dividendYield: x.dividendYield, sharpeRatio: null, ytdPerformance: x.stock.ytdPerformance?.toString() ?? null, peRatio: x.stock.peRatio })), effectiveMaxTitles, excludedSectors, goal ?? 'balanced');
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
          const target = Math.min(effectiveMaxTitles, ranked.length);
          const maxPerSector = Math.max(1, Math.floor((rules.maxSectorPercent / 100) * target));
          // Heimatmarkt-Korrelations-Cap: max. 3 Titel aus demselben Land+Sektor
          // (verhindert z.B. 5x CH-Finanz mit hoher impliziter Korrelation)
          const MAX_SAME_COUNTRY_SECTOR = 3;
          const selected: any[] = [];
          const sectorCount: Record<string, number> = {};
          const countrySectorCount: Record<string, number> = {};
          let currentFxWeightPct = 0;
          for (const c of ranked) {
            if (selected.length >= effectiveMaxTitles) break;
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
            // 10 Jahre statt des Default-Jahres: Aus zwoelf guten Monaten annualisiert
            // ergaben sich ~28 % p.a. — eine Zahl, die eine Zukunftserwartung
            // suggeriert, aber nur einen Ausschnitt beschreibt. Wie viel davon
            // wirklich genutzt wird, begrenzt der juengste Titel: die Engine
            // schneidet die gemeinsame Datums-Schnittmenge aller Titel. Der
            // tatsaechliche Zeitraum wird deshalb unten ausgewiesen.
            // Zurueck auf fuenf Jahre. Mit 2520 Tagen blieb die Erstellung
            // haengen: die Datenmenge, die durch Alignment, Kovarianz und
            // Effizienzgrenze laeuft, waechst linear mit dem Zeitraum.
            // Fuenf Jahre umfassen einen vollen Zyklus und sind damit weit
            // aussagekraeftiger als die frueheren zwoelf Monate, ohne die
            // Optimierung zu ueberlasten. Zusammen mit dem jetzt in SQL
            // gefilterten Kursabruf ist das schneller als der alte Zustand.
            const LOOKBACK_5J = 1260;
            const opt = await optimizePortfolio({ tickers: selectedTickers, method, lookbackDays: LOOKBACK_5J, minPositionWeight: params.minPositionWeight, maxPositionWeight: params.maxPositionWeight, riskFreeRate: dynamicRiskFreeRate, sectorByTicker: Object.fromEntries(selected.map((c) => [c.stock.ticker, c.stock.sector || 'Andere'])), maxSectorWeightPct: rules.maxSectorPercent });
            weights = { ...opt.weights };
            weightingEngine = opt.optimizerEngine ?? 'random_search';
            const rawReturn = opt.optimalPortfolio.expectedReturn;
            const rawVol = opt.optimalPortfolio.volatility;
            const rawSharpe = opt.optimalPortfolio.sharpe;
            if (Number.isFinite(rawReturn) && Number.isFinite(rawVol) && Number.isFinite(rawSharpe)) {
              proposalMetrics = { expectedReturnPct: Math.round(rawReturn * 1000) / 10, volatilityPct: Math.round(rawVol * 1000) / 10, sharpe: rawSharpe };
              // Effektiven Zeitraum ausweisen — er ist regelmaessig kuerzer als
              // die angeforderten 10 Jahre, sobald ein junger Titel dabei ist.
              const beobachteteTage = (opt as any).observedDays;
              if (Number.isFinite(beobachteteTage)) {
                const jahre = beobachteteTage / 252;
                const zeitraum = jahre >= 1 ? `${jahre.toFixed(1)} Jahre` : `${Math.round(beobachteteTage)} Handelstage`;
                weightingNote = (weightingNote ? weightingNote + ' ' : '')
                  + `Rendite und Schwankung sind ueber ${zeitraum} gemeinsamer Kurshistorie gerechnet`
                  + (jahre < 4.5 ? ' — kuerzer als die angestrebten 5 Jahre, weil der juengste Titel den gemeinsamen Zeitraum begrenzt.' : '.');
              }
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
          let positions = kept.map(({ c, w }) => { const s = c.stock; return { ticker: s.ticker, companyName: s.companyName, sector: s.sector || 'Andere', currency: s.currency || 'CHF', currentPrice: parseFloat(s.currentPrice ?? '0'), exchangeRateToChf: fxRateForStock(s.currency, s.exchangeRateToChf, referenceCurrency), weightPct: parseFloat(((w / wSum) * 100).toFixed(2)), combinedScore: c.combinedScore, signal: c.signal, assetType: 'stock' as string | undefined, assetClass: undefined as string | undefined, reason: `${c.signal} · Score-Note ${c.scoreGrade}` + (c.ytdPerf !== 0 && c.ytdPerf !== null ? ` · YTD ${c.ytdPerf > 0 ? '+' : ''}${c.ytdPerf.toFixed(1)}%` : '') + (watchlistRecTickers.has(s.ticker.toUpperCase()) ? ' · Watchlist-Empfehlung' : '') + (c.regime === 'bubble' ? ' · LPPL-Warnung' : '') }; }).sort((a, b) => b.weightPct - a.weightPct);

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
          // === MULTI-ASSET-SLEEVE: je nach Anlegerprofil ETF-Bausteine zumischen ===
          // Läuft NACH dem FX-Enforcement (Aktien-Sleeve ist final) und VOR der
          // Cash-Quote (die Cash-Reserve skaliert danach alle Positionen proportional).
          let assetAllocation: Record<string, number> | null = null;
          let deviationFromProfile: string | null = null;
          try {
            const sleeveResult = await applyMultiAssetSleeve({
              equityPositions: positions.map((sp) => ({ ...sp, weight: sp.weightPct })),
              riskProfile,
              stocksOnly,
              resolvePrice: createDbPriceResolver(),
              maxFxPct: maxFxExposurePct,
              referenceCurrency,
              assetClassTolerancePct: rules.assetClassTolerancePct,
            });
            assetAllocation = sleeveResult.allocation;
            deviationFromProfile = sleeveResult.deviationNote;
            if (sleeveResult.deviationNote) notes.push(sleeveResult.deviationNote);
            notes.push(...sleeveResult.notes);
            positions = sleeveResult.positions.map((sp) => {
              if (sp.assetClass === 'equity') {
                return {
                  ticker: sp.ticker,
                  companyName: String(sp.companyName ?? sp.ticker),
                  sector: String(sp.sector ?? 'Andere'),
                  currency: String(sp.currency ?? 'CHF'),
                  currentPrice: Number(sp.currentPrice ?? 0),
                  exchangeRateToChf: Number(sp.exchangeRateToChf ?? 1),
                  weightPct: sp.weight,
                  combinedScore: (sp.combinedScore ?? null) as number | null,
                  signal: String(sp.signal ?? ''),
                  reason: String(sp.reason ?? ''),
                };
              }
              return {
                ticker: sp.ticker,
                companyName: String(sp.name ?? sp.ticker),
                sector: SLEEVE_CLASS_LABELS[sp.assetClass] ?? String(sp.assetClass),
                currency: String(sp.currency ?? 'CHF'),
                currentPrice: Number(sp.price ?? 0),
                exchangeRateToChf: 1,
                weightPct: sp.weight,
                combinedScore: null as number | null,
                signal: 'ETF',
                reason: `Multi-Asset-Sleeve: ${SLEEVE_CLASS_LABELS[sp.assetClass] ?? sp.assetClass}-Baustein gemäss Anlegerprofil '${riskProfile}'`,
                assetType: 'etf',
                assetClass: sp.assetClass,
              };
            }) as unknown as typeof positions;
          } catch (e: any) {
            console.warn(`[startProposal] Multi-Asset-Sleeve fehlgeschlagen (non-fatal): ${e?.message}`);
            notes.push('Multi-Asset-Bausteine konnten nicht aufgelöst werden — Vorschlag bleibt rein aktienbasiert.');
          }
          if (liquidityNeedPct > 0 && liquidityNeedPct < 100) { const equityPct = 1 - liquidityNeedPct / 100; positions.forEach((p) => { p.weightPct = parseFloat((p.weightPct * equityPct).toFixed(2)); }); }

          // Price enrichment for external candidates
          const missingPriceTickers = positions.filter(p => !p.currentPrice || p.currentPrice === 0).map(p => p.ticker);
          if (missingPriceTickers.length > 0) {
            try {
              const { stocks: stocksTbl } = await import('../../drizzle/schema');
              const dbPriceRows = await db.select({ ticker: stocksTbl.ticker, currentPrice: stocksTbl.currentPrice, exchangeRateToChf: stocksTbl.exchangeRateToChf }).from(stocksTbl);
              const dbPrices = new Map(dbPriceRows.map((r: any) => [String(r.ticker).toUpperCase(), r]));
              for (const p of positions) { if (!p.currentPrice || p.currentPrice === 0) { const dbRow = dbPrices.get(p.ticker.toUpperCase()); if (dbRow?.currentPrice) { p.currentPrice = parseFloat(String(dbRow.currentPrice)); p.exchangeRateToChf = fxRateForStock(p.currency, dbRow.exchangeRateToChf, referenceCurrency); } } }
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
            // Multi-Asset-Sleeve-Positionen (assetClass != 'equity') sind fixe,
            // profilbedingte Bausteine — KI-Anpassungen (reduce/increase/replace)
            // dürfen sie NICHT verändern und schon gar nicht gegen Aktien tauschen.
            const isSleevePos = (p: any) => !!(p?.assetClass && p.assetClass !== 'equity');
            let adjusted = base.map(p => ({ ...p }));
            for (const a of adj) { const pos = adjusted.find(p => p.ticker.toUpperCase() === a.ticker.toUpperCase()); if (!pos || isSleevePos(pos)) continue; if (a.action === 'reduce') pos.weightPct = Math.max(pos.weightPct * 0.65, 3); if (a.action === 'increase') pos.weightPct = Math.min(pos.weightPct * 1.35, 15); }
            const replaceAdj = adj.filter((a: any) => a.action === 'replace');
            if (replaceAdj.length > 0) {
              const usedTickers = new Set(adjusted.map(p => p.ticker.toUpperCase()));
              const candidates = scored.filter(x => !usedTickers.has(x.stock.ticker.toUpperCase()) && isBuyable(x) && x.combinedScore >= 45).sort((a, b) => b.combinedScore - a.combinedScore);
              for (const ra of replaceAdj) { const idx = adjusted.findIndex(p => p.ticker.toUpperCase() === ra.ticker.toUpperCase()); if (idx < 0 || isSleevePos(adjusted[idx])) continue; const replacement = candidates.shift(); if (!replacement) continue; usedTickers.add(replacement.stock.ticker.toUpperCase()); adjusted[idx] = { ...adjusted[idx], ticker: replacement.stock.ticker, companyName: replacement.stock.companyName, sector: replacement.stock.sector, currency: replacement.stock.currency, currentPrice: parseFloat(String(replacement.stock.currentPrice ?? '0')) || 0, exchangeRateToChf: fxRateForStock(replacement.stock.currency, replacement.stock.exchangeRateToChf, referenceCurrency), combinedScore: replacement.combinedScore, signal: replacement.signal, reason: `Ersetzt ${ra.ticker} gemäss KI-Empfehlung`, assetType: 'stock' as const, assetClass: undefined }; (adjusted[idx] as any).aiReason = undefined; }
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
              // Multi-Asset-Sleeve: effektive Anlageklassen-Allokation (in %,
              // vor Cash-Quote), gewählter Modus, Abweichungs-Hinweis.
              assetAllocation,
              stocksOnly,
              deviationFromProfile,
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
            const profileSummary = `Risikoprofil: ${riskProfile}, Ziel: ${goal}, Referenzwährung: ${referenceCurrency}, FX-Limit: ${maxFxExposurePct}%` + (esgOnly ? ', ESG-Wunsch: ja (Filter noch NICHT verfügbar)' : '') + `\nZiel-Allokation (Anlegerprofil): ${formatSleeveAllocation(assetAllocation)}`;

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
            const posReasonsInstruction = 'für JEDE vorgeschlagene Position 2-3 Sätze, die 2-3 KONKRETE, titelspezifische Anlagegründe nennen, WARUM genau dieser Titel ins Portfolio passt. Stütze dich auf bekannte Stärken genau DIESES Unternehmens sowie die gelieferten Signale (Momentum aus YTD, Dividendenrendite, Fundamentaldaten, Qualität). Nenne konkrete Gründe wie z.B.: wirtschaftlicher Burggraben (Moat), Marktführerschaft in seinem Segment, starkes Kursmomentum, hoher/stabiler Free Cashflow, Dividenden-Aristokrat bzw. verlässlich steigende Dividende, robuste Bilanz, strukturelles Wachstum, defensives/krisenfestes Geschäftsmodell oder attraktive Bewertung — aber NUR was für dieses Unternehmen plausibel zutrifft (nicht erfinden). VERBOTEN: Schablonen, dieselben Gründe über mehrere Titel wiederholen, blosses Übersetzen von Score/Note/Gewicht/Prozentzahlen in Worte, Floskeln wie "ist ein Wert aus dem Bereich X". Zielgruppe: Privatanleger 50+ — verständlich, aber inhaltlich konkret und substanziell. ETF-/ETP-Positionen (Obligationen, Rohstoffe, Gold, Immobilien, Krypto) begründest du kurz mit ihrer Portfoliorolle (z.B. Stabilisierung, Diversifikation, Inflationsschutz, Krypto-Beimischung) statt mit Moat oder Dividende.';
            const confidenceRule = '"hoch" (FX-Limit eingehalten, kein Sektor > 30%, alle BUY, Sharpe > 0.5, ≤ 1 Einwand) / "niedrig" (FX überschritten, Sektor > 40%, SELL-Titel, Sharpe < 0.2, ≥ 3 Einwände) / "mittel" (sonst)';
            const verdictInstruction = 'eine AUSFÜHRLICHE Gesamtbewertung des Portfolios (4-6 Sätze, ca. 120-180 Wörter, wie eine kompakte Analystennotiz): (a) Gesamteinschätzung (günstig/teuer bewertet, defensiv/offensiv ausgerichtet), (b) 1-2 zentrale Stärken (z.B. Diversifikation, Dividendenstärke, Qualität der Titel), (c) das grösste Risiko bzw. die Hauptschwäche, (d) ein konkreter Handlungshinweis. Deutsch, für Privatanleger 50+ verständlich, aber inhaltlich fundiert — keine Wiederholung blosser Kennzahlen.';
            // Multi-Asset-Sleeve-Positionen sind fixe Bausteine der Strategie —
            // die Agenten sollen sie weder kritisieren noch austauschen.
            const sleevePosList = positions.filter((p: any) => p.assetClass && p.assetClass !== 'equity');
            const sleeveNotice = sleevePosList.length > 0
              ? `\n\nWICHTIG — Multi-Asset-Bausteine: Die Positionen ${sleevePosList.map((p: any) => `${p.ticker} (${SLEEVE_CLASS_LABELS[(p as any).assetClass] ?? (p as any).assetClass})`).join(', ')} sind ETF-/ETP-Bausteine der strategischen Anlageklassen-Allokation gemäss Anlegerprofil. Sie sind FIXER Bestandteil der Strategie: bewerte sie nicht nach Moat/Dividende, empfehle für sie KEINE Anpassungen (keep) und tausche sie NIEMALS gegen Aktien aus. Die Gesamt-Allokation über Anlageklassen ist: ${formatSleeveAllocation(assetAllocation)}.`
              : '';
            const contextBlock = `Anlegerprofil: ${profileSummary}\n\nBerechnete Fakten:\n${factsSummary}\n\nVorgeschlagene Positionen (mit Gewichten):\n${JSON.stringify(positionSummary, null, 2)}\n\nVerfügbare Alternativen (NUR diese Ticker dürfen als Ersatz dienen):\n${JSON.stringify(candidatePool, null, 2)}${adminFeedbackContext}${marktHubContextBlock}${sleeveNotice}`;

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
              // Batches PARALLEL: sie sind voneinander unabhängig (jeder erhält
              // seine eigenen Positionen, das Ergebnis wird später per Ticker
              // zugeordnet). Vorher liefen sie nacheinander, sodass die Wartezeit
              // mit der Titelzahl linear wuchs — bei 30 Titeln drei volle
              // Modell-Aufrufe hintereinander. Fehler bleiben pro Batch isoliert.
              await Promise.all(batches.map(async (batch, bi) => {
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
              }));
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
              // Zwei Nachkommastellen: mit einer las sich 1.995 % als «2.0% < 2%»
              // und die Meldung widersprach sich selbst.
              if (!divOk) kennzahlenFilterReason += `Dividendenrendite ${proposalDivYield.toFixed(2)}% < 2%. `;
              if (meetsKennzahlenFilter === 'ja') kennzahlenFilterReason = `Sharpe ${proposalSharpe.toFixed(2)}, Div-Rendite ${proposalDivYield.toFixed(1)}% — Kennzahlen erfüllt.`;
              if (meetsKennzahlenFilter === 'nein') notes.push(`⚠️ Kennzahlen-Filter: ${kennzahlenFilterReason.trim()}`);
            }

            // DB logging
            try {
              const { portfolioProposalLog } = await import('../../drizzle/schema');
              const loggedPositions = autoAppliedPositions ?? positions;
              const insertResult = await db.insert(portfolioProposalLog).values({ userId: ctx.user.id, riskProfile, investmentGoal: goal, referenceCurrency, maxFxExposurePct, investmentAmount: input?.investmentAmount ?? null, positionCount: loggedPositions.length, method, qualityTier, sharpe: proposalMetrics?.sharpe != null ? String(proposalMetrics.sharpe) as any : null, expectedReturnPct: proposalMetrics?.expectedReturnPct != null ? String(proposalMetrics.expectedReturnPct) as any : null, volatilityPct: proposalMetrics?.volatilityPct != null ? String(proposalMetrics.volatilityPct) as any : null, fxWeightPct: String(fxWeightPct) as any, positions: loggedPositions as any, challengerCritique: challengerResult.critique, challengerRejectedCount: challengerResult.rejected.length, synthesizerVerdict: synthResult.verdict, overallConfidence: synthResult.overallConfidence as 'hoch' | 'mittel' | 'niedrig', finalAdjustments: { autoApplied: !!autoAppliedPositions, items: synthResult.adjustments } as any, agentDurationMs: agentDuration, meetsKennzahlenFilter, kennzahlenFilterReason });
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
    });

  /**
   * Polling-Endpoint für startProposal.
   * Gibt Status, Fortschritt und (wenn fertig) das Ergebnis zurück.
   */
export const getProposalStatusProcedure = protectedProcedure
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
    });
