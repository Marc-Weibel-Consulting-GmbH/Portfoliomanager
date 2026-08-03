/**
 * Signal Cache Cron
 * =================
 * Berechnet Signale für alle aktiven Watchlist-Aktien vorab und speichert
 * sie in der stock_signal_cache-Tabelle. Läuft stündlich.
 *
 * Die generate-Prozedur im signalsRouter liest dann aus diesem Cache
 * statt live zu berechnen → Antwortzeit < 1s statt 15–30s.
 */

import { eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { stockSignalCache, stocks } from "../../drizzle/schema";
import { activeCurated } from "../lib/stockUniverse";
import { detectAssetClass, generateAssetClassSignal, istBewertbar, ASSET_CLASS_LABEL } from "../lib/assetClassSignal";

let isRunning = false;

/**
 * Compute and cache signals for all active watchlist stocks.
 * Runs in parallel batches of 5 to avoid overwhelming the DB.
 */
export async function refreshSignalCache(): Promise<void> {
  if (isRunning) {
    console.log("[signalCacheCron] Already running, skipping...");
    return;
  }
  isRunning = true;
  const startTime = Date.now();
  console.log("[signalCacheCron] Starting signal cache refresh...");

  try {
    const db = await getDb();
    if (!db) {
      console.error("[signalCacheCron] DB not available");
      return;
    }

    // Get all active watchlist stocks
    const allStocks = await db
      .select({
        ticker: stocks.ticker,
        companyName: stocks.companyName,
        currentPrice: stocks.currentPrice,
      })
      .from(stocks)
      .where(activeCurated())
      .limit(250);

    console.log(`[signalCacheCron] Processing ${allStocks.length} stocks...`);

    // Import signal processing functions
    const { randomForestSignal } = await import("../analytics/mlEngine");
    const { signalForSeries, getActiveSignalModel } = await import("../analytics/signalService");
    const { detectBubble } = await import("../analytics/lpplsEngine");
    const { calculateQualityScore, calculateMomentumScore } = await import("../analytics/qualityMomentumEngine");
    const { getQualityMetrics } = await import("../lib/qualityMetricsService");
    const { getActiveWeights } = await import("../analytics/optimizerWorker");
    const { generateSignal } = await import("../lib/baseSignal");
    const { blendCombinedScore } = await import("../lib/signalBlend");
    const { getRegimeBlendConfig } = await import("../analytics/regimeSignalMemory");
    const { regimeMitTotband } = await import("../lib/signals/regimeMitTotband");

    const optimizedWeights = await getActiveWeights();
    const blendConfig = await getRegimeBlendConfig();

    // Schattenrechnung (siehe lib/regimeSchatten.ts): Der Marktzustand wird EINMAL
    // je Lauf geholt und dient nur der Parallelvariante. Schlägt das fehl, bleibt
    // die Schattenrechnung aus — der echte Signal-Lauf ist davon unberührt.
    const { rechneSchatten } = await import("../lib/regimeSchatten");
    const schattenSaetze: import("../lib/regimeSchattenStore").SchattenSatz[] = [];
    const { rechneSignalSchatten } = await import("../lib/signalSchatten");
    const { berechneQualitaet, berechneBewertung } = await import("../lib/dreiScores");
    const signalSchattenSaetze: import("../lib/signalSchattenStore").SchattenSatz[] = [];
    // Qualitaet und Bewertung werden hier einmal vorgerechnet und abgelegt —
    // sonst braeuchte jede Tabellenzeile einen eigenen EODHD-Abruf.
    const dreiScoreSaetze: import("../lib/dreiScoresStore").GespeicherteScores[] = [];
    let marktLage: { overallRegime: string; volatilitaet?: string | null } | null = null;
    try {
      const { computeRegime: computeMarktRegime } = await import("../routers/marketRegimeRouter");
      const m: any = await computeMarktRegime();
      marktLage = { overallRegime: m.overallRegime, volatilitaet: m.engines?.volatility?.level ?? null };
    } catch (e) {
      console.warn("[signalCacheCron] Marktregime fuer Schattenrechnung nicht verfuegbar:", (e as Error).message);
    }

    // B5: Wikifolio-Konsens-Signal vorab laden (einmal für alle Tickers)
    const wikifolioConsensusMap: Map<string, { score: number; signal: string; buyCount: number; sellCount: number }> = new Map();
    try {
      const { computeWikifolioConsensus } = await import("../lib/wikifolioConsensus");
      const { wikifolioTrades: wikifolioTradesTable, wikifolios: wikifoliosTable } = await import("../../drizzle/schema");
      const { isNotNull: isNotNullWiki } = await import("drizzle-orm");
      // Alle Trades der letzten 60 Tage aus verfolgten Wikifolios laden
      const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      const { gte: gteWiki, and: andWiki } = await import("drizzle-orm");
      const trackedWikis = await db
        .select({ id: wikifoliosTable.id, sharpeRatio: wikifoliosTable.sharpeRatio })
        .from(wikifoliosTable)
        .where(eq(wikifoliosTable.isTracked, 1));
      if (trackedWikis.length > 0) {
        const trackedIds = trackedWikis.map(w => w.id);
        const { inArray: inArrayWiki } = await import("drizzle-orm");
        const recentTrades = await db
          .select({
            wikifolioId: wikifolioTradesTable.wikifolioId,
            resolvedTicker: wikifolioTradesTable.resolvedTicker,
            side: wikifolioTradesTable.side,
            executedAt: wikifolioTradesTable.executedAt,
          })
          .from(wikifolioTradesTable)
          .where(andWiki(
            inArrayWiki(wikifolioTradesTable.wikifolioId, trackedIds),
            isNotNullWiki(wikifolioTradesTable.resolvedTicker),
            gteWiki(wikifolioTradesTable.executedAt, cutoff),
          ));
        const sharpeByWikiId = new Map(trackedWikis.map(w => [w.id, w.sharpeRatio ? parseFloat(String(w.sharpeRatio)) : null]));
        const consensusInput = recentTrades.map(t => ({
          wikifolioId: t.wikifolioId,
          resolvedTicker: t.resolvedTicker,
          side: t.side as 'buy' | 'sell' | 'other',
          executedAt: t.executedAt ? t.executedAt.toISOString() : null,
          sharpe: sharpeByWikiId.get(t.wikifolioId) ?? null,
        }));
        const results = computeWikifolioConsensus(consensusInput, { asOfMs: Date.now(), windowDays: 30, minWikifolios: 1 });
        for (const r of results) {
          if (r.netDirection === 'neutral') continue; // Nur echte Kauf/Verkauf-Signale speichern
          wikifolioConsensusMap.set(r.ticker, {
            score: r.score,
            signal: r.netDirection === 'buy' ? 'buy_consensus' : 'sell_consensus',
            buyCount: r.buyWikifolios,
            sellCount: r.sellWikifolios,
          });
        }
        console.log(`[signalCacheCron] Wikifolio-Konsens: ${results.length} Ticker mit Signal aus ${trackedWikis.length} Wikifolios`);
      }
    } catch (e) {
      console.warn('[signalCacheCron] Wikifolio-Konsens-Fehler (nicht fatal):', (e as Error).message);
    }

    let saved = 0;
    let failed = 0;
    const BATCH_SIZE = 5;

    for (let i = 0; i < allStocks.length; i += BATCH_SIZE) {
      const batch = allStocks.slice(i, i + BATCH_SIZE);

      await Promise.allSettled(
        batch.map(async (stock) => {
          try {
            const ticker = stock.ticker;

            // 1. Get fundamental data from stocks table (fast, no external API)
            const { stocks: stocksTable } = await import("../../drizzle/schema");
            const [stockRow] = await db.select().from(stocksTable).where(eq(stocksTable.ticker, ticker)).limit(1);
            // ACS-1: Detect asset class from category/assetType
            const stockCategory = stockRow?.category ?? null;
            const stockAssetType = (stockRow as any)?.assetType ?? null;
            // Name und Ticker mitgeben: 17 Obligationen, Fonds und Zertifikate
            // stehen unter der Kategorie «Wachstumsaktien» (Wikifolio-Importe mit
            // ISIN statt Ticker). Ohne den Namen bliebe die Erkennung blind.
            const assetClass = detectAssetClass(
              stockCategory, stockAssetType, stockRow?.companyName ?? null, ticker,
            );

            const num = (v: string | null | undefined): number | null => {
              if (v == null) return null;
              const n = parseFloat(v);
              return Number.isFinite(n) ? n : null;
            };

            const peRatio = num(stockRow?.peRatio);
            const pegRatio = num(stockRow?.pegRatio);
            const dividendYield = num(stockRow?.dividendYield) ?? 0;
            const companyName = stockRow?.companyName || stock.companyName || ticker;
            let currentPrice = num(stockRow?.currentPrice) ?? num(stock.currentPrice) ?? 0;

            // 2. Get historical prices from DB
            const { historicalPrices } = await import("../../drizzle/schema");
            const { gte, and, asc } = await import("drizzle-orm");
            const from = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
            const priceRows = await db
              .select({ date: historicalPrices.date, close: historicalPrices.close, adj: historicalPrices.adjustedClose })
              .from(historicalPrices)
              .where(and(eq(historicalPrices.ticker, ticker), gte(historicalPrices.date, from)))
              .orderBy(asc(historicalPrices.date));

            const series = priceRows
              .map((r: any) => ({ date: r.date as string, close: parseFloat((r.adj ?? r.close) as any) }))
              .filter((p: { date: string; close: number }) => Number.isFinite(p.close) && p.close > 0);

            const prices = series.map((p: { date: string; close: number }) => p.close);

            // Compute YTD, 52w range, RSI from historical data
            let ytdPerformance = 0;
            let fiftyTwoWeekHigh: number | null = null;
            let fiftyTwoWeekLow: number | null = null;
            let rsi14: number | null = null;

            if (series.length > 1) {
              const yearStart = `${new Date().getFullYear()}-01-01`;
              const firstYtd = series.find((p: { date: string; close: number }) => p.date >= yearStart) ?? series[0];
              const last = series[series.length - 1];
              if (firstYtd.close > 0) {
                ytdPerformance = ((last.close - firstYtd.close) / firstYtd.close) * 100;
              }
              if (currentPrice === 0) currentPrice = last.close;
              fiftyTwoWeekHigh = Math.max(...prices);
              fiftyTwoWeekLow = Math.min(...prices);
              if (prices.length >= 15) rsi14 = calcRSI(prices, 14);
            }

            // Fondsanteile und Zertifikate erhalten keine Empfehlung: Was in
            // einem Fonds steckt, wissen wir nicht, und ein Zertifikat haengt an
            // einem Auszahlungsprofil, das wir nicht kennen. Eine Kaufempfehlung
            // waere hier eine Behauptung ohne Grundlage.
            if (!istBewertbar(assetClass)) {
              await db.insert(stockSignalCache).values({
                ticker,
                companyName: stockRow?.companyName ?? ticker,
                signalType: 'hold',
                signalStrength: 'weak',
                combinedScore: null,
                overallGrade: null,
                reason: `${ASSET_CLASS_LABEL[assetClass]} — nicht nach Wertpapierkriterien bewertbar`,
                computedAt: new Date(),
              }).onDuplicateKeyUpdate({
                set: {
                  signalType: 'hold', signalStrength: 'weak',
                  combinedScore: null, overallGrade: null,
                  reason: `${ASSET_CLASS_LABEL[assetClass]} — nicht nach Wertpapierkriterien bewertbar`,
                  computedAt: new Date(),
                },
              });
              saved++;
              return;
            }

            // 3. Generate base signal
            // ACS-1: Non-equity assets use asset-class-aware signal instead of P/E-based equity signal
            let base;
            if (assetClass !== 'equity') {
              base = generateAssetClassSignal({
                ticker,
                companyName,
                assetClass,
                dividendYield,
                currentPrice,
                fiftyTwoWeekHigh,
                fiftyTwoWeekLow,
                ytdPerformance,
                rsi14,
                volatility: null,
              });
            } else {
              // SIG-4 (Audit 2026-07): dieselbe GEWICHTETE Basis-Scoring-Funktion
              base = generateSignal({
                ticker,
                companyName,
                peRatio,
                pegRatio,
                dividendYield,
                currentPrice,
                fiftyTwoWeekHigh,
                fiftyTwoWeekLow,
                ytdPerformance,
                rsi14,
              }, optimizedWeights);
            }
            let signalType: "buy" | "sell" | "hold" = base.type;
            let signalStrength: "strong" | "moderate" | "weak" = base.strength;
            let reason = base.reason;
            let targetPrice = base.targetPrice;
            const criteria: string[] = base.criteria;

            // 4. ML + Quality + Momentum (only if enough price history)
            let rfSignal: string | undefined;
            let rfScore: number | undefined;
            let qualityGrade: string | undefined;
            let qualityScore: number | undefined;
            let momentumGrade: string | undefined;
            let momentumScore: number | undefined;
            let combinedScore: number | undefined;
            let combinedSignal: string | undefined;
            let overallGrade: string | undefined;
            let bubbleScore: number | undefined;
            let bubbleRegime: string | undefined;

            if (prices.length >= 60) {
              // RF-Signal (als einer von mehreren Inputs, nicht als Override)
              try {
                const rf = await signalForSeries(getActiveSignalModel, () => randomForestSignal(prices, [], { peRatio, pegRatio, dividendYield }), 'gb_signal', prices);
                rfSignal = rf.signal;
                rfScore = rf.score;
              } catch { /* silent */ }

              try {
                const bubbleResult = detectBubble({ prices });
                bubbleScore = bubbleResult.bubbleScore;
                bubbleRegime = bubbleResult.regime;
              } catch { /* silent */ }

              // Wird für die Schattenrechnung weiterverwendet — derselbe Abruf,
              // kein zweiter Zugriff auf EODHD.
              let qmCache: Awaited<ReturnType<typeof getQualityMetrics>> | null = null;
              try {
                // Fetch real quality metrics from EODHD (ROE, Gross Margin, Net Debt/EBITDA)
                let roe: number | null = null;
                let debtToEquity: number | null = null;
                let fcfYield: number | null = null;
                let grossMargin: number | null = null;
                try {
                  const qm = await getQualityMetrics(ticker);
                  roe = qm.returnOnEquity;
                  grossMargin = qm.grossMargin;
                  // Map netDebtToEbitda → debtToEquity proxy (both measure leverage)
                  // netDebtToEbitda: <1 = low, 1-3 = moderate, >3 = high
                  // debtToEquity thresholds in scoring: <0.5 = low, 0.5-1.5 = moderate, >2 = high
                  // Approximate conversion: D/E ≈ netDebtToEbitda * 0.5 (rough proxy)
                  if (qm.netDebtToEbitda !== null) {
                    debtToEquity = Math.max(0, qm.netDebtToEbitda * 0.5);
                  }
                  // Echte FCF-Rendite (freier Cashflow ÷ Marktkapitalisierung).
                  //
                  // Hier stand dieselbe aus `qm.qualityScore` abgeleitete
                  // Stufenzahl wie in `signalsRouter` — dort in #239 behoben,
                  // diese zweite Kopie blieb stehen. Sie geht mit Gewicht 0.25
                  // in `calculateQualityScore` ein; der Qualitätsfaktor entstand
                  // damit zu einem Viertel aus sich selbst.
                  fcfYield = qm.fcfYield;
                  qmCache = qm;
                } catch { /* silent - use nulls as fallback */ }
                const qualityResult = calculateQualityScore({ roe, debtToEquity, fcfYield, grossMargin });
                qualityGrade = qualityResult.grade;
                qualityScore = qualityResult.score; // keep -1..+1 for blending
              } catch { /* silent */ }

              try {
                const momentumResult = calculateMomentumScore({ prices });
                momentumGrade = momentumResult.grade;
                momentumScore = momentumResult.score; // keep -1..+1 for blending
              } catch { /* silent */ }

              if (momentumScore !== undefined && qualityScore !== undefined) {
                try {
                  const bScore = bubbleScore ?? 0;
                  const bReg = bubbleRegime ?? 'normal';
                  const lpplPenalty = bReg === 'bubble' ? bScore * 0.5 : 0;
                  let regimeKey = 'default';
                  // Regime mit Totband — daempft das Flattern an Regimegrenzen,
                  // das sonst Umschichtungen ausloest (regimeMitTotband.ts).
                  try { regimeKey = regimeMitTotband(prices); } catch { /* silent */ }

                  // RF-Adjustment: RF-Signal leicht in den qualityScore einfliessen lassen
                  // (RF ist ein zusätzlicher Input, kein Override)
                  let adjustedQualityScore = qualityScore;
                  if (rfSignal === 'strong_sell' || rfSignal === 'sell') {
                    adjustedQualityScore = Math.max(-1, qualityScore - 0.15); // RF-Verkauf drückt Score leicht
                  } else if (rfSignal === 'strong_buy' || rfSignal === 'buy') {
                    adjustedQualityScore = Math.min(1, qualityScore + 0.1); // RF-Kauf hebt Score leicht
                  }

                  const blended = blendCombinedScore({ momentumScore, qualityScore: adjustedQualityScore, regime: regimeKey, lpplPenalty }, blendConfig);
                  combinedScore = blended.combinedScore;
                  overallGrade = blended.grade;
                  combinedSignal = blended.signalLabel;

                  // Parallelvariante mitrechnen — identische Eingangswerte, nur der
                  // Mischungsschluessel kommt aus dem Marktregime statt aus der
                  // Kursphase des Titels. Wird NICHT angezeigt und NICHT gespeichert
                  // ausser in regime_blend_shadow; entscheidet nach 30 Tagen die
                  // Messung, nicht die Vermutung.
                  if (marktLage) {
                    try {
                      const s = rechneSchatten(
                        { momentumScore, qualityScore: adjustedQualityScore, lpplPenalty,
                          titelRegime: regimeKey, markt: marktLage },
                        blendConfig,
                      );
                      schattenSaetze.push({
                        ticker: stock.ticker,
                        liveRegime: s.liveRegime, liveScore: s.liveScore, liveSignal: s.liveSignal,
                        marktRegime: marktLage.overallRegime,
                        schattenRegime: s.schattenRegime, schattenScore: s.schattenScore,
                        schattenSignal: s.schattenSignal,
                        preis: typeof currentPrice === "number" && currentPrice > 0 ? currentPrice : null,
                      });
                    } catch { /* Schattenrechnung darf den echten Lauf nie stoeren */ }
                  }

                  // Zweite Schattenrechnung: Empfehlung ohne Qualitaet im
                  // Timing-Teil. Zwischen 35 % (bull) und 75 % (crisis) des
                  // heutigen Scores sind Qualitaet — wer «Qualitaet 80 · Timing
                  // 75» liest, zaehlt sie zweimal. Ob die getrennte Fassung
                  // besser trifft, entscheidet die Messung, nicht die Vermutung.
                  if (qmCache) {
                    try {
                      const q = berechneQualitaet({
                        roic: qmCache.roic,
                        betriebsmarge: qmCache.operatingMargin,
                        bruttomarge: qmCache.grossMargin,
                        ertragsdeckung: qmCache.ertragsdeckung,
                        epsStabilitaet: qmCache.epsStabilityScore,
                        netDebtToEbitda: qmCache.netDebtToEbitda,
                      }, qmCache.piotroski);
                      const b = berechneBewertung({
                        adjustedPeg: qmCache.adjustedPeg,
                        kgv: qmCache.forwardPE ?? qmCache.trailingPE,
                        fcfRendite: qmCache.fcfYield,
                        dividendenrendite: num(stockRow?.dividendYield),
                        kursBuchwert: qmCache.priceToBook,
                        epsWachstumTTM: qmCache.epsGrowthTTM,
                        epsWachstum5j: qmCache.epsGrowth5y,
                        sektor: stockRow?.sector ?? null,
                      });
                      const s = rechneSignalSchatten(
                        { momentumScore, qualityScoreAlt: adjustedQualityScore,
                          qualitaetNeu: q.gesamt, bewertungNeu: b.score,
                          lpplPenalty, regime: regimeKey },
                        blendConfig,
                      );
                      const { qualitaetsBand, bewertungsBand } = await import("../lib/dreiScores");
                      dreiScoreSaetze.push({
                        ticker: stock.ticker,
                        qualitaet: q.gesamt,
                        qualitaetBand: qualitaetsBand(q.gesamt),
                        niveau: q.niveau.score,
                        richtung: q.richtung.score,
                        fScore: q.richtung.fScore,
                        fScoreBerechenbar: q.richtung.berechenbar,
                        bewertung: b.score,
                        bewertungBand: bewertungsBand(b.score),
                        abdeckungNiveau: q.niveau.abdeckung,
                        abdeckungBewertung: b.abdeckung,
                      });
                      signalSchattenSaetze.push({
                        ticker: stock.ticker,
                        liveScore: s.liveScore, liveSignal: s.liveSignal,
                        schattenScore: s.schattenScore, schattenSignal: s.schattenSignal,
                        timingScore: s.timingScore,
                        qualitaetNeu: q.gesamt, bewertungNeu: b.score,
                        qualitaetsAnteilLive: s.qualitaetsAnteilLive,
                        regime: regimeKey,
                        preis: typeof currentPrice === "number" && currentPrice > 0 ? currentPrice : null,
                      });
                    } catch { /* Schattenrechnung darf den echten Lauf nie stoeren */ }
                  }

                  // Signal-Typ IMMER aus dem kombinierten Score ableiten (EINZIGE Quelle der Wahrheit)
                  if (blended.signalLabel === 'STRONG BUY' || blended.signalLabel === 'BUY') {
                    signalType = 'buy';
                    signalStrength = blended.signalLabel === 'STRONG BUY' ? 'strong' : 'moderate';
                  } else if (blended.signalLabel === 'STRONG SELL' || blended.signalLabel === 'SELL') {
                    signalType = 'sell';
                    signalStrength = blended.signalLabel === 'STRONG SELL' ? 'strong' : 'moderate';
                  } else {
                    signalType = 'hold';
                    signalStrength = 'moderate';
                  }

                  // Begründungstext aus dem kombinierten Score generieren (konsistent mit Signal-Typ)
                  const scoreRound = Math.round(blended.combinedScore);
                  const momentumDir = momentumScore > 0.2 ? 'positiv' : momentumScore < -0.2 ? 'negativ' : 'neutral';
                  // RF-Note nur einblenden wenn RF-Signal mit finalem Signal-Typ übereinstimmt
                  const finalIsBuy = blended.signalLabel === 'BUY' || blended.signalLabel === 'STRONG BUY';
                  const finalIsSell = blended.signalLabel === 'SELL' || blended.signalLabel === 'STRONG SELL';
                  const rfIsBuy = rfSignal === 'buy' || rfSignal === 'strong_buy';
                  const rfIsSell = rfSignal === 'sell' || rfSignal === 'strong_sell';
                  const rfAgreesWithFinal = (finalIsBuy && rfIsBuy) || (finalIsSell && rfIsSell);
                  const rfNote = rfSignal && rfAgreesWithFinal
                    ? ` Algorithmus bestätigt: ${rfIsBuy ? 'Kauf' : 'Verkauf'} (Score ${rfScore ?? '—'}).`
                    : ''; // Bei Widerspruch: RF-Note im Begründungstext weglassen
                  const bubbleNote = bReg === 'bubble' ? ` Achtung: Blasen-Risiko erkannt (LPPL ${(bScore * 100).toFixed(0)}%).` : '';
                  const peNote = peRatio && peRatio > 30 ? ` P/E ${peRatio.toFixed(1)} erhöht.` : peRatio && peRatio < 15 ? ` P/E ${peRatio.toFixed(1)} günstig.` : '';

                  if (blended.signalLabel === 'STRONG BUY') {
                    reason = `Starkes Kaufsignal (Score ${scoreRound}/100): Momentum ${momentumDir}, mehrere positive Indikatoren.${peNote}${rfNote}${bubbleNote}`;
                    targetPrice = currentPrice * 1.15;
                  } else if (blended.signalLabel === 'BUY') {
                    reason = `Kaufsignal (Score ${scoreRound}/100): Momentum ${momentumDir}, positive Indikatoren überwiegen.${peNote}${rfNote}${bubbleNote}`;
                    targetPrice = currentPrice * 1.10;
                  } else if (blended.signalLabel === 'HOLD') {
                    reason = `Halten (Score ${scoreRound}/100): Gemischte Signale, keine klare Richtung. Momentum ${momentumDir}.${peNote}${rfNote}${bubbleNote}`;
                    targetPrice = currentPrice * 1.02;
                  } else if (blended.signalLabel === 'SELL') {
                    reason = `Verkaufssignal (Score ${scoreRound}/100): Momentum ${momentumDir}, negative Indikatoren überwiegen.${peNote}${rfNote}${bubbleNote}`;
                    targetPrice = currentPrice * 0.92;
                  } else { // STRONG SELL
                    reason = `Starkes Verkaufssignal (Score ${scoreRound}/100): Momentum ${momentumDir}, mehrere negative Indikatoren.${peNote}${rfNote}${bubbleNote}`;
                    targetPrice = currentPrice * 0.85;
                  }
                } catch { /* silent */ }
              }
            }

            // 5. Upsert into cache
            await db.insert(stockSignalCache).values({
              ticker,
              companyName,
              signalType,
              signalStrength,
              currentPrice: currentPrice > 0 ? currentPrice.toFixed(4) : null,
              targetPrice: targetPrice > 0 ? targetPrice.toFixed(4) : null,
              peRatio: peRatio !== null ? peRatio.toFixed(2) : null,
              pegRatio: pegRatio !== null ? pegRatio.toFixed(2) : null,
              dividendYield: dividendYield > 0 ? dividendYield.toFixed(2) : null,
              ytdPerformance: ytdPerformance !== 0 ? ytdPerformance.toFixed(2) : null,
              fiftyTwoWeekHigh: fiftyTwoWeekHigh !== null ? fiftyTwoWeekHigh.toFixed(4) : null,
              fiftyTwoWeekLow: fiftyTwoWeekLow !== null ? fiftyTwoWeekLow.toFixed(4) : null,
              rsi14: rsi14 !== null ? rsi14.toFixed(1) : null,
              reason,
              criteria: criteria as any,
              rfSignal: rfSignal ?? null,
              rfScore: rfScore ?? null,
              qualityGrade: qualityGrade ?? null,
              // Scale -1..+1 float to 0..100 int for DB storage
              qualityScore: qualityScore !== undefined ? Math.round((qualityScore + 1) * 50) : null,
              momentumGrade: momentumGrade ?? null,
              momentumScore: momentumScore !== undefined ? Math.round((momentumScore + 1) * 50) : null,
              combinedScore: combinedScore !== undefined ? combinedScore.toFixed(2) : null,
              combinedSignal: combinedSignal ?? null,
              overallGrade: overallGrade ?? null,
              bubbleScore: bubbleScore !== undefined ? bubbleScore.toFixed(4) : null,
              bubbleRegime: bubbleRegime ?? null,
              sentimentScore: null,
              sentimentLabel: null,
              // B5: Wikifolio-Konsens-Signal
              wikifolioScore: wikifolioConsensusMap.get(ticker)?.score ?? null,
              wikifolioSignal: wikifolioConsensusMap.get(ticker)?.signal ?? null,
              wikifolioBuyCount: wikifolioConsensusMap.get(ticker)?.buyCount ?? null,
              wikifolioSellCount: wikifolioConsensusMap.get(ticker)?.sellCount ?? null,
              computedAt: new Date(),
            }).onDuplicateKeyUpdate({
              set: {
                companyName,
                signalType,
                signalStrength,
                currentPrice: currentPrice > 0 ? currentPrice.toFixed(4) : null,
                targetPrice: targetPrice > 0 ? targetPrice.toFixed(4) : null,
                peRatio: peRatio !== null ? peRatio.toFixed(2) : null,
                pegRatio: pegRatio !== null ? pegRatio.toFixed(2) : null,
                dividendYield: dividendYield > 0 ? dividendYield.toFixed(2) : null,
                ytdPerformance: ytdPerformance !== 0 ? ytdPerformance.toFixed(2) : null,
                fiftyTwoWeekHigh: fiftyTwoWeekHigh !== null ? fiftyTwoWeekHigh.toFixed(4) : null,
                fiftyTwoWeekLow: fiftyTwoWeekLow !== null ? fiftyTwoWeekLow.toFixed(4) : null,
                rsi14: rsi14 !== null ? rsi14.toFixed(1) : null,
                reason,
                criteria: criteria as any,
                rfSignal: rfSignal ?? null,
                rfScore: rfScore ?? null,
                qualityGrade: qualityGrade ?? null,
                // Scale -1..+1 float to 0..100 int for DB storage
                qualityScore: qualityScore !== undefined ? Math.round((qualityScore + 1) * 50) : null,
                momentumGrade: momentumGrade ?? null,
                momentumScore: momentumScore !== undefined ? Math.round((momentumScore + 1) * 50) : null,
                combinedScore: combinedScore !== undefined ? combinedScore.toFixed(2) : null,
                combinedSignal: combinedSignal ?? null,
                overallGrade: overallGrade ?? null,
                bubbleScore: bubbleScore !== undefined ? bubbleScore.toFixed(4) : null,
                bubbleRegime: bubbleRegime ?? null,
                // B5: Wikifolio-Konsens-Signal
                wikifolioScore: wikifolioConsensusMap.get(ticker)?.score ?? null,
                wikifolioSignal: wikifolioConsensusMap.get(ticker)?.signal ?? null,
                wikifolioBuyCount: wikifolioConsensusMap.get(ticker)?.buyCount ?? null,
                wikifolioSellCount: wikifolioConsensusMap.get(ticker)?.sellCount ?? null,
                computedAt: new Date(),
              },
            });
            saved++;
          } catch (e) {
            console.warn(`[signalCacheCron] Error for ${stock.ticker}:`, (e as Error).message);
            failed++;
          }
        })
      );
    }

    // Schattenrechnung ablegen — nach dem echten Lauf, damit ein Fehler hier
    // nichts an den zwischengespeicherten Signalen ändern kann.
    if (schattenSaetze.length) {
      try {
        const { haltefest } = await import("../lib/regimeSchattenStore");
        const { geschrieben } = await haltefest(schattenSaetze);
        const uneinig = schattenSaetze.filter((s) => s.liveSignal !== s.schattenSignal).length;
        console.log(
          `[signalCacheCron] Schattenrechnung: ${geschrieben} Saetze, ` +
          `${uneinig} mit abweichendem Signal (Marktregime: ${marktLage?.overallRegime ?? "unbekannt"})`,
        );
      } catch (e) {
        console.warn("[signalCacheCron] Schattenrechnung nicht abgelegt (non-fatal):", (e as Error).message);
      }
    }

    // Qualitaet und Bewertung ablegen — sie sind ab jetzt die fuehrenden
    // Scores. Der alte Einzelscore bleibt in stocks.score stehen und ist damit
    // die Schattenrechnung: beide Zahlen nebeneinander, ohne eigene Mechanik.
    if (dreiScoreSaetze.length) {
      try {
        const { haltefestScores } = await import("../lib/dreiScoresStore");
        const { geschrieben } = await haltefestScores(dreiScoreSaetze);
        const ohneQualitaet = dreiScoreSaetze.filter((s) => s.qualitaet === null).length;
        console.log(
          `[signalCacheCron] Drei Scores: ${geschrieben} Titel abgelegt, ` +
          `${ohneQualitaet} ohne Qualitaetsnote (zu wenige Kennzahlen)`,
        );
      } catch (e) {
        console.warn("[signalCacheCron] Drei Scores nicht abgelegt (non-fatal):", (e as Error).message);
      }
    }

    // Zweite Schattenrechnung: Empfehlung ohne Qualitaet im Timing-Teil.
    if (signalSchattenSaetze.length) {
      try {
        const { haltefestSignalSchatten } = await import("../lib/signalSchattenStore");
        const datum = new Date().toISOString().split("T")[0];
        const { geschrieben } = await haltefestSignalSchatten(signalSchattenSaetze, datum);
        const vergleichbar = signalSchattenSaetze.filter((s) => s.schattenScore !== null);
        const uneinig = vergleichbar.filter((s) => s.liveSignal !== s.schattenSignal).length;
        console.log(
          `[signalCacheCron] Signal-Schattenrechnung: ${geschrieben} Saetze, ` +
          `${vergleichbar.length} vergleichbar, ${uneinig} mit abweichender Empfehlung`,
        );
      } catch (e) {
        console.warn("[signalCacheCron] Signal-Schattenrechnung nicht abgelegt (non-fatal):", (e as Error).message);
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[signalCacheCron] Done: ${saved} cached, ${failed} failed in ${elapsed}s`);
  } catch (err) {
    console.error("[signalCacheCron] Fatal error:", err);
  } finally {
    isRunning = false;
  }
}

/**
 * Calculate RSI from closing prices
 */
function calcRSI(prices: number[], period: number = 14): number | null {
  if (prices.length < period + 1) return null;
  const changes: number[] = [];
  for (let i = 1; i < prices.length; i++) changes.push(prices[i] - prices[i - 1]);
  const relevant = changes.slice(-period * 3);
  if (relevant.length < period) return null;
  let avgGain = 0, avgLoss = 0;
  for (let i = 0; i < period; i++) {
    if (relevant[i] > 0) avgGain += relevant[i];
    else avgLoss += Math.abs(relevant[i]);
  }
  avgGain /= period;
  avgLoss /= period;
  for (let i = period; i < relevant.length; i++) {
    const c = relevant[i];
    if (c > 0) { avgGain = (avgGain * (period - 1) + c) / period; avgLoss = (avgLoss * (period - 1)) / period; }
    else { avgGain = (avgGain * (period - 1)) / period; avgLoss = (avgLoss * (period - 1) + Math.abs(c)) / period; }
  }
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

/**
 * Initialize the signal cache cron (runs every 2 hours)
 */
export function initSignalCacheCron(): void {
  // Run immediately on startup (after 2 minute delay to let server warm up)
  setTimeout(() => {
    refreshSignalCache().catch((e) => console.error("[signalCacheCron] Initial run failed:", e));
  }, 2 * 60 * 1000);

  // Then every 2 hours
  setInterval(() => {
    refreshSignalCache().catch((e) => console.error("[signalCacheCron] Scheduled run failed:", e));
  }, 2 * 60 * 60 * 1000);

  console.log("[signalCacheCron] Initialized (runs every 2h, first run in 2min)");
}
