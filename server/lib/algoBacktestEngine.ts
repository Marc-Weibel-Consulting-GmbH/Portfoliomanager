/**
 * algoBacktestEngine.ts
 *
 * Self-Learning Algo-Backtesting Engine
 * ======================================
 * Monatlich werden 6 Standard-Portfolios erstellt (3 Risikoprofile × 2 Ziele).
 * Nach 30 Tagen wird die Performance gemessen und eine LLM-Analyse erstellt,
 * die Feinajustierungen am Algorithmus empfiehlt — ohne in Overfitting zu geraten.
 *
 * Overfitting-Schutz:
 * - Max. 1 Parameteränderung pro Monat
 * - Änderungen nur wenn Performance-Delta > 1.5% über 2+ aufeinanderfolgende Monate
 * - Jede Änderung wird im algoTuningLog dokumentiert
 * - Rückgängig-Mechanismus falls nächster Run schlechter ist
 */

import { getDb } from "../db";
import { invokeLLM, invokeKimi } from "../_core/llm";
import { getMarktHubSignals, getSectorTilts, getDynamicRiskFreeRate, buildMarktHubContext, type MarktHubSignals } from "./marktHubSignals";

// Aktuelle Algorithmus-Version (Semver)
export const ALGO_VERSION = "2.3.0";

// 6 Standard-Profil-Kombinationen für den Backtest
export const BACKTEST_PROFILES = [
  { riskProfile: "konservativ", goal: "dividends", label: "Konservativ / Dividenden" },
  { riskProfile: "konservativ", goal: "balanced", label: "Konservativ / Ausgewogen" },
  { riskProfile: "ausgewogen", goal: "growth", label: "Ausgewogen / Wachstum" },
  { riskProfile: "ausgewogen", goal: "dividends", label: "Ausgewogen / Dividenden" },
  { riskProfile: "aggressiv", goal: "growth", label: "Aggressiv / Wachstum" },
  { riskProfile: "aggressiv", goal: "balanced", label: "Aggressiv / Ausgewogen" },
] as const;

export type BacktestProfile = typeof BACKTEST_PROFILES[number];

// ============================================================
// 1. RUN ERSTELLEN: 6 Portfolios aufbauen
// ============================================================

export async function createBacktestRun(): Promise<{ runId: number; portfoliosCreated: number; errors: string[] }> {
  const db = await getDb();
  if (!db) throw new Error("Datenbank nicht verfügbar");

  const { algoBacktestRuns, algoBacktestPortfolios } = await import("../../drizzle/schema");
  const { eq } = await import("drizzle-orm");

  // Monat bestimmen (1. des aktuellen Monats)
  const now = new Date();
  const runMonthDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const runMonthStr = runMonthDate.toISOString().split("T")[0]; // YYYY-MM-01

  // Prüfen ob Run für diesen Monat bereits existiert
  const existing = await db.select({ id: algoBacktestRuns.id, status: algoBacktestRuns.status })
    .from(algoBacktestRuns)
    .where(eq(algoBacktestRuns.runMonth, runMonthStr as any))
    .limit(1);

  if (existing.length > 0 && existing[0].status !== "error") {
    console.log(`[algoBacktest] Run für ${runMonthStr} bereits vorhanden (id=${existing[0].id}, status=${existing[0].status})`);
    return { runId: existing[0].id, portfoliosCreated: 0, errors: [] };
  }

  // Markt-Hub-Snapshot
  let marktHubSignals: MarktHubSignals;
  let sectorTilts: Record<string, number> = {};
  try {
    marktHubSignals = await getMarktHubSignals();
    sectorTilts = getSectorTilts(marktHubSignals);
  } catch (e) {
    console.warn("[algoBacktest] Markt-Hub nicht verfügbar, Neutral-Werte");
    marktHubSignals = {
      macro: { yieldCurveSpread: null, coreCpi: null, fedFundsRate: null, dgs10: null, hySpread: null, chfUsd: null },
      regime: { regime: "Neutral", overallScore: 0, equityAllocation: 60, regimeMultiplier: 1.0 },
      factors: { valueYtd: null, momentumYtd: null, qualityYtd: null, minVolYtd: null, leadingFactor: null },
      latestReportSummary: null, latestReportDate: null, hasData: false, fetchedAt: new Date().toISOString(),
    };
  }

  // Run-Eintrag erstellen (oder vorhandenen Error-Run überschreiben)
  let runId: number;
  if (existing.length > 0 && existing[0].status === "error") {
    await db.update(algoBacktestRuns)
      .set({
        status: "creating",
        algoVersion: ALGO_VERSION,
        marktHubSnapshot: JSON.stringify(marktHubSignals),
        sectorTiltsSnapshot: JSON.stringify(sectorTilts),
        leadingFactor: marktHubSignals.factors.leadingFactor,
        marktRegime: marktHubSignals.regime.regime,
        portfolioCount: 0,
        errorDetails: null,
      })
      .where(eq(algoBacktestRuns.id, existing[0].id));
    runId = existing[0].id;
  } else {
    const [result] = await db.insert(algoBacktestRuns).values({
      runMonth: runMonthStr as any,
      status: "creating",
      algoVersion: ALGO_VERSION,
      marktHubSnapshot: JSON.stringify(marktHubSignals),
      sectorTiltsSnapshot: JSON.stringify(sectorTilts),
      leadingFactor: marktHubSignals.factors.leadingFactor,
      marktRegime: marktHubSignals.regime.regime,
      portfolioCount: 0,
    });
    runId = (result as any).insertId;
  }

  console.log(`[algoBacktest] Run ${runId} erstellt für ${runMonthStr}`);

  // 6 Portfolios erstellen
  const errors: string[] = [];
  let portfoliosCreated = 0;

  for (const profile of BACKTEST_PROFILES) {
    try {
      await createBacktestPortfolio(runId, profile, marktHubSignals, sectorTilts, db);
      portfoliosCreated++;
      console.log(`[algoBacktest] Portfolio erstellt: ${profile.label}`);
    } catch (e: any) {
      const errMsg = `${profile.label}: ${e?.message ?? "unbekannt"}`;
      errors.push(errMsg);
      console.error(`[algoBacktest] Portfolio-Fehler: ${errMsg}`);

      // Fehler-Eintrag in DB
      await db.insert(algoBacktestPortfolios).values({
        runId,
        riskProfile: profile.riskProfile,
        goal: profile.goal,
        positionsSnapshot: "[]",
        creationError: e?.message ?? "unbekannt",
      });
    }
  }

  // Run-Status aktualisieren
  const finalStatus = portfoliosCreated >= 4 ? "active" : "error";
  await db.update(algoBacktestRuns)
    .set({
      status: finalStatus,
      portfolioCount: portfoliosCreated,
      errorDetails: errors.length > 0 ? errors.join("; ") : null,
    })
    .where(eq(algoBacktestRuns.id, runId));

  console.log(`[algoBacktest] Run ${runId} abgeschlossen: ${portfoliosCreated}/6 Portfolios, Status=${finalStatus}`);
  return { runId, portfoliosCreated, errors };
}

async function createBacktestPortfolio(
  runId: number,
  profile: BacktestProfile,
  marktHubSignals: MarktHubSignals,
  sectorTilts: Record<string, number>,
  db: Awaited<ReturnType<typeof getDb>>
) {
  if (!db) throw new Error("DB nicht verfügbar");
  const { algoBacktestPortfolios, stocks: stocksTable, userInvestmentProfile } = await import("../../drizzle/schema");
  const { eq, and, gte, inArray } = await import("drizzle-orm");

  // Diversifikationsregeln laden
  const { getDiversificationRules } = await import("./diversificationRules");
  const rules = await getDiversificationRules();

  // Optimizer-Parameter für dieses Profil
  const { optimizerParamsForProfile } = await import("./profileOptimizerParams");
  const params = optimizerParamsForProfile({
    riskProfile: profile.riskProfile,
    maxDrawdownTolerancePct: null,
    investmentHorizonYears: null,
  }, rules);

  // Kandidaten aus der DB (aktive Watchlist + Empfehlungen)
  const candidates = await db.select().from(stocksTable).where(
    and(
      eq(stocksTable.isActive, 1),
      inArray(stocksTable.listType, ["empfehlung", "watchlist"])
    )
  );

  if (candidates.length < 5) throw new Error("Zu wenige Kandidaten in der Watchlist");

  // Scoring mit Markt-Hub-Tilts
  const { getSectorTiltForStock, getFactorTilt } = await import("./marktHubSignals");
  const scored = candidates
    .filter((s) => s.signalType !== "sell")
    .map((s) => {
      const rawScore = s.signalScore ?? 50;
      const ytdPerf = s.ytdPerformance ? parseFloat(String(s.ytdPerformance)) : null;
      const divYield = s.dividendYield ? parseFloat(String(s.dividendYield)) : 0;

      // Momentum-Adj
      let momentumAdj = 0;
      if (ytdPerf !== null) {
        if (ytdPerf > 20) momentumAdj = 8;
        else if (ytdPerf > 10) momentumAdj = 5;
        else if (ytdPerf < -20) momentumAdj = -15;
        else if (ytdPerf < -15) momentumAdj = -10;
        else if (ytdPerf < -10) momentumAdj = -5;
      } else {
        momentumAdj = -5;
      }

      // Goal-Adj
      let goalAdj = 0;
      if (profile.goal === "dividends") {
        if (divYield >= 4) goalAdj = 5;
        else if (divYield >= 2) goalAdj = 2;
        else if (divYield < 1) goalAdj = -5;
      }
      if (profile.goal === "growth" && ytdPerf !== null && ytdPerf > 5) goalAdj = 5;

      // Sektor-Tilt
      const sectorAdj = getSectorTiltForStock(s.sector, sectorTilts);

      // Faktor-Tilt
      const factorAdj = getFactorTilt(
        { dividendYield: divYield, ytdPerf, signalScore: rawScore, riskProfile: profile.riskProfile, goal: profile.goal },
        marktHubSignals.factors,
      );

      const combinedScore = Math.max(0, Math.min(100, rawScore + momentumAdj + goalAdj + sectorAdj + factorAdj));
      return { stock: s, combinedScore, rawScore, ytdPerf, divYield, sectorAdj, factorAdj };
    })
    .filter((x) => x.combinedScore >= 45)
    .sort((a, b) => b.combinedScore - a.combinedScore);

  if (scored.length < rules.minTitles) throw new Error(`Zu wenige Kandidaten nach Scoring: ${scored.length}`);

  // Selektion mit Diversifikationsregeln
  const maxPerSector = Math.ceil(rules.maxTitles / 3);
  const sectorCount: Record<string, number> = {};
  const selected: typeof scored = [];
  const target = Math.min(rules.maxTitles, scored.length);

  for (const c of scored) {
    if (selected.length >= target) break;
    const sec = c.stock.sector || "Andere";
    if ((sectorCount[sec] || 0) >= maxPerSector) continue;
    selected.push(c);
    sectorCount[sec] = (sectorCount[sec] || 0) + 1;
  }

  if (selected.length < 2) throw new Error("Zu wenige Titel nach Diversifikationsregeln");

  // Gewichtung (score-proportional mit Cap)
  const maxCap = Math.max(params.maxPositionWeight, 1.2 / selected.length);
  const total = selected.reduce((s, c) => s + c.combinedScore, 0) || 1;
  let weights: Record<string, number> = {};
  selected.forEach((c) => { weights[c.stock.ticker] = c.combinedScore / total; });

  // Cap-Normierung
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

  // Positionen bauen
  const wSum = Object.values(weights).reduce((s, v) => s + v, 0) || 1;
  const positions = selected.map((c) => ({
    ticker: c.stock.ticker,
    companyName: c.stock.companyName,
    sector: c.stock.sector || "Andere",
    currency: c.stock.currency || "CHF",
    weightPct: parseFloat(((weights[c.stock.ticker] / wSum) * 100).toFixed(2)),
    combinedScore: c.combinedScore,
    rawScore: c.rawScore,
    sectorAdj: c.sectorAdj,
    factorAdj: c.factorAdj,
    currentPrice: c.stock.currentPrice ? parseFloat(String(c.stock.currentPrice)) : null,
  })).sort((a, b) => b.weightPct - a.weightPct);

  // Faktor-Tilts zusammenfassen
  const appliedFactorTilts = {
    leadingFactor: marktHubSignals.factors.leadingFactor,
    valueYtd: marktHubSignals.factors.valueYtd,
    momentumYtd: marktHubSignals.factors.momentumYtd,
    qualityYtd: marktHubSignals.factors.qualityYtd,
    minVolYtd: marktHubSignals.factors.minVolYtd,
  };

  await db.insert(algoBacktestPortfolios).values({
    runId,
    riskProfile: profile.riskProfile,
    goal: profile.goal,
    positionsSnapshot: JSON.stringify(positions),
    appliedSectorTilts: JSON.stringify(sectorTilts),
    appliedFactorTilts: JSON.stringify(appliedFactorTilts),
  });
}

// ============================================================
// 2. RUN EVALUIEREN: 30-Tage-Performance messen + LLM-Analyse
// ============================================================

export async function evaluateBacktestRun(runId: number): Promise<{ success: boolean; message: string }> {
  const db = await getDb();
  if (!db) throw new Error("Datenbank nicht verfügbar");

  const { algoBacktestRuns, algoBacktestPortfolios, historicalPrices, algoTuningLog } = await import("../../drizzle/schema");
  const { eq, and, gte, lte, inArray } = await import("drizzle-orm");

  // Run laden
  const [run] = await db.select().from(algoBacktestRuns).where(eq(algoBacktestRuns.id, runId)).limit(1);
  if (!run) throw new Error(`Run ${runId} nicht gefunden`);
  if (run.status !== "active") {
    return { success: false, message: `Run ${runId} hat Status '${run.status}', nicht 'active'` };
  }

  // Prüfen ob 30 Tage vergangen sind
  const runDate = new Date(run.runMonth);
  const evaluationDate = new Date(runDate);
  evaluationDate.setDate(evaluationDate.getDate() + 30);
  const now = new Date();
  if (now < evaluationDate) {
    return { success: false, message: `Evaluation erst ab ${evaluationDate.toISOString().split("T")[0]} möglich` };
  }

  // Portfolios laden
  const portfolios = await db.select().from(algoBacktestPortfolios)
    .where(and(eq(algoBacktestPortfolios.runId, runId)));

  await db.update(algoBacktestRuns).set({ status: "evaluating" }).where(eq(algoBacktestRuns.id, runId));

  const portfolioResults: Array<{
    id: number; label: string; riskProfile: string; goal: string;
    perf30d: number | null; sharpe30d: number | null; benchmarkPerf: number | null; alpha: number | null;
  }> = [];

  // Benchmark-Performance (SPY) laden
  const benchmarkPerf = await calcBenchmarkPerf(runDate, evaluationDate, db);

  for (const portfolio of portfolios) {
    if (portfolio.creationError) {
      portfolioResults.push({ id: portfolio.id, label: `${portfolio.riskProfile}/${portfolio.goal}`, riskProfile: portfolio.riskProfile, goal: portfolio.goal, perf30d: null, sharpe30d: null, benchmarkPerf, alpha: null });
      continue;
    }

    try {
      const positions = JSON.parse(portfolio.positionsSnapshot) as Array<{ ticker: string; weightPct: number }>;
      const { perf30d, sharpe30d, volatility30d, maxDrawdown30d } = await calcPortfolioPerf(positions, runDate, evaluationDate, db);

      const alpha = perf30d !== null && benchmarkPerf !== null ? perf30d - benchmarkPerf : null;

      await db.update(algoBacktestPortfolios).set({
        actualPerf30dPct: perf30d?.toFixed(4) as any,
        actualSharpe30d: sharpe30d?.toFixed(4) as any,
        actualVolatility30d: volatility30d?.toFixed(4) as any,
        actualMaxDrawdown30d: maxDrawdown30d?.toFixed(4) as any,
        benchmarkPerf30dPct: benchmarkPerf?.toFixed(4) as any,
        alpha30dPct: alpha?.toFixed(4) as any,
      }).where(eq(algoBacktestPortfolios.id, portfolio.id));

      portfolioResults.push({ id: portfolio.id, label: `${portfolio.riskProfile}/${portfolio.goal}`, riskProfile: portfolio.riskProfile, goal: portfolio.goal, perf30d, sharpe30d, benchmarkPerf, alpha });
    } catch (e: any) {
      console.error(`[algoBacktest] Evaluation-Fehler für Portfolio ${portfolio.id}: ${e?.message}`);
      portfolioResults.push({ id: portfolio.id, label: `${portfolio.riskProfile}/${portfolio.goal}`, riskProfile: portfolio.riskProfile, goal: portfolio.goal, perf30d: null, sharpe30d: null, benchmarkPerf, alpha: null });
    }
  }

  // Durchschnittliche Performance
  const validPerfs = portfolioResults.filter((p) => p.perf30d !== null).map((p) => p.perf30d!);
  const avgPerf = validPerfs.length > 0 ? validPerfs.reduce((s, v) => s + v, 0) / validPerfs.length : null;

  // LLM-Analyse
  const llmAnalysis = await generateLLMAnalysis(run, portfolioResults, benchmarkPerf, avgPerf);

  // Tuning-Empfehlungen umsetzen (mit Overfitting-Schutz)
  const tuningActions = await applyTuningRecommendations(runId, llmAnalysis, run, db);

  // Run abschliessen
  await db.update(algoBacktestRuns).set({
    status: "completed",
    llmAnalysis: JSON.stringify(llmAnalysis),
    avgPerf30dPct: avgPerf?.toFixed(4) as any,
    benchmarkPerf30dPct: benchmarkPerf?.toFixed(4) as any,
    evaluatedAt: new Date(),
  }).where(eq(algoBacktestRuns.id, runId));

  // Feedback-Loop Stufe 2: Sektor-Tilt-Alpha in signalWeights zurückschreiben
  // (läuft asynchron, blockiert nicht den Response)
  applyFeedbackLoopToSignalWeights(runId).catch((e: any) =>
    console.error("[algoFeedback] Fehler:", e?.message)
  );

  console.log(`[algoBacktest] Run ${runId} evaluiert: avgPerf=${avgPerf?.toFixed(2)}%, benchmark=${benchmarkPerf?.toFixed(2)}%, tuningActions=${tuningActions}`);
  return { success: true, message: `Run ${runId} erfolgreich evaluiert. avgPerf=${avgPerf?.toFixed(2)}%, ${tuningActions} Tuning-Aktionen.` };
}

async function calcBenchmarkPerf(startDate: Date, endDate: Date, db: any): Promise<number | null> {
  try {
    const { historicalPrices } = await import("../../drizzle/schema");
    const { eq, and, gte, lte, asc } = await import("drizzle-orm");
    const startStr = startDate.toISOString().split("T")[0];
    const endStr = endDate.toISOString().split("T")[0];

    const prices = await db.select({ date: historicalPrices.date, close: historicalPrices.close })
      .from(historicalPrices)
      .where(and(eq(historicalPrices.ticker, "SPY"), gte(historicalPrices.date, startStr as any), lte(historicalPrices.date, endStr as any)))
      .orderBy(asc(historicalPrices.date));

    if (prices.length < 2) return null;
    const p0 = parseFloat(String(prices[0].close));
    const p1 = parseFloat(String(prices[prices.length - 1].close));
    return ((p1 - p0) / p0) * 100;
  } catch { return null; }
}

async function calcPortfolioPerf(
  positions: Array<{ ticker: string; weightPct: number }>,
  startDate: Date,
  endDate: Date,
  db: any
): Promise<{ perf30d: number | null; sharpe30d: number | null; volatility30d: number | null; maxDrawdown30d: number | null }> {
  const { historicalPrices } = await import("../../drizzle/schema");
  const { eq, and, gte, lte, asc, inArray } = await import("drizzle-orm");
  const startStr = startDate.toISOString().split("T")[0];
  const endStr = endDate.toISOString().split("T")[0];
  const tickers = positions.map((p) => p.ticker);

  const allPrices = await db.select({ ticker: historicalPrices.ticker, date: historicalPrices.date, close: historicalPrices.close })
    .from(historicalPrices)
    .where(and(inArray(historicalPrices.ticker, tickers), gte(historicalPrices.date, startStr as any), lte(historicalPrices.date, endStr as any)))
    .orderBy(asc(historicalPrices.date));

  // Preis-Map aufbauen: ticker → { date → close }
  const priceMap: Record<string, Record<string, number>> = {};
  for (const row of allPrices) {
    if (!priceMap[row.ticker]) priceMap[row.ticker] = {};
    priceMap[row.ticker][row.date] = parseFloat(String(row.close));
  }

  // Alle Handelstage bestimmen
  const allDates = [...new Set(allPrices.map((r: any) => r.date))].sort();
  if (allDates.length < 2) return { perf30d: null, sharpe30d: null, volatility30d: null, maxDrawdown30d: null };

  // Portfolio-Wert pro Tag berechnen (normiert auf 100 am Starttag)
  const portfolioValues: number[] = [];
  const weights = Object.fromEntries(positions.map((p) => [p.ticker, p.weightPct / 100]));

  // Startpreise
  const startPrices: Record<string, number> = {};
  for (const ticker of tickers) {
    const tickerPrices = priceMap[ticker] ?? {};
        const firstDate = allDates.find((d) => tickerPrices[d as string] !== undefined);
        if (firstDate) startPrices[ticker] = tickerPrices[firstDate as string];
  }

  for (const date of allDates) {
    let portfolioReturn = 0;
    let coveredWeight = 0;
    for (const pos of positions) {
      const price = priceMap[pos.ticker]?.[date as string];
      const startPrice = startPrices[pos.ticker];
      if (price && startPrice && startPrice > 0) {
        const ret = (price - startPrice) / startPrice;
        portfolioReturn += ret * weights[pos.ticker];
        coveredWeight += weights[pos.ticker];
      }
    }
    // Normieren falls nicht alle Titel Preise haben
    if (coveredWeight > 0.5) {
      portfolioValues.push(100 * (1 + portfolioReturn / coveredWeight));
    }
  }

  if (portfolioValues.length < 2) return { perf30d: null, sharpe30d: null, volatility30d: null, maxDrawdown30d: null };

  const perf30d = ((portfolioValues[portfolioValues.length - 1] - portfolioValues[0]) / portfolioValues[0]) * 100;

  // Tägliche Returns für Sharpe/Volatilität
  const dailyReturns: number[] = [];
  for (let i = 1; i < portfolioValues.length; i++) {
    dailyReturns.push((portfolioValues[i] - portfolioValues[i - 1]) / portfolioValues[i - 1]);
  }

  const avgReturn = dailyReturns.reduce((s, v) => s + v, 0) / dailyReturns.length;
  const variance = dailyReturns.reduce((s, v) => s + Math.pow(v - avgReturn, 2), 0) / dailyReturns.length;
  const stdDev = Math.sqrt(variance);
  const volatility30d = stdDev * Math.sqrt(252) * 100; // annualisiert
  const riskFreeDaily = 0.02 / 252;
  const sharpe30d = stdDev > 0 ? ((avgReturn - riskFreeDaily) / stdDev) * Math.sqrt(252) : null;

  // Max Drawdown
  let peak = portfolioValues[0];
  let maxDrawdown = 0;
  for (const v of portfolioValues) {
    if (v > peak) peak = v;
    const dd = (peak - v) / peak;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  return { perf30d, sharpe30d, volatility30d, maxDrawdown30d: maxDrawdown * 100 };
}

// ============================================================
// 3. LLM-ANALYSE: Stärken/Schwächen + Tuning-Empfehlungen
// ============================================================

async function generateLLMAnalysis(
  run: any,
  portfolioResults: Array<{ label: string; riskProfile: string; goal: string; perf30d: number | null; sharpe30d: number | null; benchmarkPerf: number | null; alpha: number | null }>,
  benchmarkPerf: number | null,
  avgPerf: number | null,
): Promise<any> {
  const marktHubSnapshot = run.marktHubSnapshot ? JSON.parse(run.marktHubSnapshot) : {};
  const sectorTiltsSnapshot = run.sectorTiltsSnapshot ? JSON.parse(run.sectorTiltsSnapshot) : {};

  const perfSummary = portfolioResults.map((p) =>
    `${p.label}: ${p.perf30d !== null ? p.perf30d.toFixed(2) + "%" : "n/v"} (Alpha: ${p.alpha !== null ? (p.alpha > 0 ? "+" : "") + p.alpha.toFixed(2) + "%" : "n/v"})`
  ).join("\n");

  const activeTilts = Object.entries(sectorTiltsSnapshot)
    .filter(([, v]) => v !== 0)
    .map(([k, v]) => `${k}: ${(v as number) > 0 ? "+" : ""}${v}`)
    .join(", ") || "keine";

  const prompt = `Du bist ein quantitativer Portfolio-Analyst. Analysiere die Performance von 6 algorithmisch erstellten Test-Portfolios nach 30 Tagen.

**Run-Kontext:**
- Monat: ${run.runMonth}
- Algorithmus-Version: ${run.algoVersion}
- Marktregime: ${run.marktRegime}
- MSCI Führender Faktor: ${run.leadingFactor ?? "unbekannt"}
- Aktive Sektor-Tilts: ${activeTilts}

**Performance-Ergebnisse (30 Tage):**
${perfSummary}

Benchmark (SPY): ${benchmarkPerf !== null ? benchmarkPerf.toFixed(2) + "%" : "n/v"}
Durchschnitt aller Portfolios: ${avgPerf !== null ? avgPerf.toFixed(2) + "%" : "n/v"}

**Aufgabe:**
1. Analysiere welche Profil-Kombinationen gut/schlecht abgeschnitten haben und WARUM
2. Identifiziere ob die Sektor-Tilts und MSCI-Faktor-Tilts geholfen oder geschadet haben
3. Empfehle MAXIMAL 1 konkrete Algorithmus-Anpassung (Overfitting-Schutz!)
4. Bewerte das Overfitting-Risiko der Empfehlung (low/medium/high)
5. Empfehle nur Änderungen wenn Performance-Delta > 1.5% und klar auf Algorithmus zurückzuführen

Antworte im JSON-Format.`;

  try {
    const response = await invokeKimi({
      messages: [
        { role: "system", content: "Du bist ein quantitativer Portfolio-Analyst. Antworte präzise und datenbasiert auf Deutsch. Vermeide Overfitting-Empfehlungen." },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "backtest_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              summary: { type: "string", description: "2-3 Sätze Gesamteinschätzung" },
              strengths: { type: "string", description: "Was hat gut funktioniert?" },
              weaknesses: { type: "string", description: "Was hat schlecht funktioniert?" },
              sectorTiltAssessment: { type: "string", description: "Haben die Sektor-Tilts geholfen oder geschadet?" },
              factorTiltAssessment: { type: "string", description: "Hat der MSCI-Faktor-Tilt geholfen oder geschadet?" },
              tuningRecommendation: {
                type: "object",
                properties: {
                  hasRecommendation: { type: "boolean" },
                  parameterToChange: { type: "string" },
                  currentValue: { type: "string" },
                  proposedValue: { type: "string" },
                  rationale: { type: "string" },
                  overfittingRisk: { type: "string", enum: ["low", "medium", "high"] },
                  expectedImpact: { type: "string" },
                },
                required: ["hasRecommendation", "parameterToChange", "currentValue", "proposedValue", "rationale", "overfittingRisk", "expectedImpact"],
                additionalProperties: false,
              },
              overallConfidence: { type: "string", enum: ["hoch", "mittel", "niedrig"] },
            },
            required: ["summary", "strengths", "weaknesses", "sectorTiltAssessment", "factorTiltAssessment", "tuningRecommendation", "overallConfidence"],
            additionalProperties: false,
          },
        },
      } as any,
    });

    const content = response.choices?.[0]?.message?.content;
    return content ? JSON.parse(content as string) : { summary: "LLM-Analyse nicht verfügbar", tuningRecommendation: { hasRecommendation: false } };
  } catch (e: any) {
    console.error("[algoBacktest] LLM-Analyse fehlgeschlagen:", e?.message);
    return { summary: `LLM-Analyse fehlgeschlagen: ${e?.message}`, tuningRecommendation: { hasRecommendation: false } };
  }
}

// ============================================================
// 4. TUNING-EMPFEHLUNGEN MIT OVERFITTING-SCHUTZ
// ============================================================

async function applyTuningRecommendations(runId: number, llmAnalysis: any, run: any, db: any): Promise<number> {
  const rec = llmAnalysis?.tuningRecommendation;
  if (!rec?.hasRecommendation) return 0;
  if (rec.overfittingRisk === "high") {
    console.log("[algoBacktest] Tuning-Empfehlung abgelehnt: Overfitting-Risiko 'high'");
    return 0;
  }

  // Overfitting-Schutz: Max. 1 Änderung pro Monat prüfen
  const { algoTuningLog } = await import("../../drizzle/schema");
  const { gte } = await import("drizzle-orm");
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  const recentChanges = await db.select({ id: algoTuningLog.id })
    .from(algoTuningLog)
    .where(gte(algoTuningLog.createdAt, oneMonthAgo));

  if (recentChanges.length >= 1) {
    console.log("[algoBacktest] Tuning-Empfehlung abgelehnt: Bereits 1 Änderung im letzten Monat");
    return 0;
  }

  // Tuning-Log-Eintrag erstellen (die Empfehlung wird dokumentiert, aber NICHT automatisch umgesetzt)
  // Automatisches Umsetzen würde Overfitting riskieren — der Admin entscheidet
  await db.insert(algoTuningLog).values({
    triggeredByRunId: runId,
    fromVersion: run.algoVersion,
    toVersion: run.algoVersion, // Version bleibt gleich bis Admin bestätigt
    parameterChanged: rec.parameterToChange || "unbekannt",
    oldValue: rec.currentValue || "",
    newValue: rec.proposedValue || "",
    rationale: rec.rationale || "",
    overfittingRisk: rec.overfittingRisk || "low",
    expectedImpact: rec.expectedImpact || "",
    source: "llm_auto",
  });

  console.log(`[algoBacktest] Tuning-Empfehlung dokumentiert: ${rec.parameterToChange} → ${rec.proposedValue} (Risiko: ${rec.overfittingRisk})`);
  return 1;
}

// ============================================================
// 4b. FEEDBACK-LOOP (Stufe 2): Sektor-Tilt-Alpha → signalWeights
// ============================================================
/**
 * Schreibt konsistente Sektor-Tilt-Alpha-Erkenntnisse als Gewichts-Anpassung
 * in die signalWeights-Tabelle zurück.
 *
 * Logik:
 * - Analysiert die letzten 2+ abgeschlossenen Runs
 * - Wenn ein Sektor-Tilt in BEIDEN Runs positives Alpha (>1.5%) geliefert hat:
 *   → ytd-Gewicht leicht erhöhen (+0.01), momentum-Gewicht leicht erhöhen (+0.01)
 * - Wenn ein Sektor-Tilt in BEIDEN Runs negatives Alpha (<-1.5%) geliefert hat:
 *   → ytd-Gewicht leicht senken (-0.01)
 * - Overfitting-Schutz: Max. 1 Gewichtsanpassung alle 2 Monate
 * - Alle Änderungen werden im algoTuningLog dokumentiert
 */
export async function applyFeedbackLoopToSignalWeights(currentRunId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const { algoBacktestRuns, algoBacktestPortfolios, algoTuningLog, signalWeights } = await import("../../drizzle/schema");
  const { eq, desc, gte, and } = await import("drizzle-orm");

  try {
    // Overfitting-Schutz: Keine Änderung wenn in den letzten 2 Monaten bereits eine Gewichtsanpassung
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    const recentWeightChanges = await db.select({ id: algoTuningLog.id })
      .from(algoTuningLog)
      .where(and(
        gte(algoTuningLog.createdAt, twoMonthsAgo),
        eq(algoTuningLog.parameterChanged as any, "signalWeights.ytd+momentum")
      ));
    if (recentWeightChanges.length > 0) {
      console.log("[algoFeedback] Gewichtsanpassung übersprungen: bereits eine Anpassung in den letzten 2 Monaten");
      return;
    }

    // Letzte 2 abgeschlossene Runs laden
    const completedRuns = await db.select()
      .from(algoBacktestRuns)
      .where(eq(algoBacktestRuns.status, "completed"))
      .orderBy(desc(algoBacktestRuns.runMonth))
      .limit(2);

    if (completedRuns.length < 2) {
      console.log("[algoFeedback] Weniger als 2 abgeschlossene Runs — kein Feedback-Loop möglich");
      return;
    }

    // Sektor-Tilts und Alpha aus beiden Runs analysieren
    const tiltAlphaByRun: Array<Record<string, number>> = [];
    for (const run of completedRuns) {
      const portfolios = await db.select()
        .from(algoBacktestPortfolios)
        .where(eq(algoBacktestPortfolios.runId, run.id));

      const sectorTilts: Record<string, number> = run.sectorTiltsSnapshot
        ? JSON.parse(run.sectorTiltsSnapshot as string)
        : {};

      // Durchschnittliches Alpha aller Portfolios dieses Runs
      const validAlphas = portfolios
        .filter((p: any) => p.alpha30dPct !== null)
        .map((p: any) => parseFloat(p.alpha30dPct));
      const avgAlpha = validAlphas.length > 0
        ? validAlphas.reduce((s: number, v: number) => s + v, 0) / validAlphas.length
        : 0;

      // Für jeden aktiven Sektor-Tilt: Alpha zuordnen
      const tiltAlpha: Record<string, number> = {};
      for (const [sector, tilt] of Object.entries(sectorTilts)) {
        if (tilt !== 0) {
          // Wenn Tilt positiv und Alpha positiv → Tilt hat geholfen
          // Wenn Tilt negativ und Alpha positiv → Tilt hat geholfen (wir haben richtig gemieden)
          tiltAlpha[sector] = tilt > 0 ? avgAlpha : -avgAlpha;
        }
      }
      tiltAlphaByRun.push(tiltAlpha);
    }

    // Sektoren finden die in BEIDEN Runs konsistent positives/negatives Alpha hatten
    const run1Tilts = tiltAlphaByRun[0];
    const run2Tilts = tiltAlphaByRun[1];
    const ALPHA_THRESHOLD = 1.5; // Mindest-Alpha in % für Anpassung

    let consistentlyPositive = 0;
    let consistentlyNegative = 0;
    const positiveEvidence: string[] = [];
    const negativeEvidence: string[] = [];

    for (const sector of Object.keys(run1Tilts)) {
      if (run2Tilts[sector] === undefined) continue;
      const alpha1 = run1Tilts[sector];
      const alpha2 = run2Tilts[sector];
      if (alpha1 > ALPHA_THRESHOLD && alpha2 > ALPHA_THRESHOLD) {
        consistentlyPositive++;
        positiveEvidence.push(`${sector}: +${alpha1.toFixed(1)}% / +${alpha2.toFixed(1)}%`);
      } else if (alpha1 < -ALPHA_THRESHOLD && alpha2 < -ALPHA_THRESHOLD) {
        consistentlyNegative++;
        negativeEvidence.push(`${sector}: ${alpha1.toFixed(1)}% / ${alpha2.toFixed(1)}%`);
      }
    }

    if (consistentlyPositive === 0 && consistentlyNegative === 0) {
      console.log("[algoFeedback] Keine konsistenten Sektor-Tilt-Signale über 2 Runs — keine Gewichtsanpassung");
      return;
    }

    // Aktive signalWeights laden
    const { getActiveWeights } = await import("../analytics/optimizerWorker");
    const currentWeights = await getActiveWeights();

    // Gewichtsanpassung berechnen
    const newWeights = { ...currentWeights };
    let ytdDelta = 0;
    let momentumDelta = 0;

    if (consistentlyPositive > 0) {
      // Sektor-Tilts haben geholfen → ytd und momentum leicht erhöhen
      ytdDelta = +0.01;
      momentumDelta = +0.01;
      // Ausgleich: pe und peg leicht senken
      newWeights.pe = Math.max(0.05, currentWeights.pe - 0.01);
      newWeights.peg = Math.max(0.03, currentWeights.peg - 0.01);
    } else if (consistentlyNegative > 0) {
      // Sektor-Tilts haben geschadet → ytd leicht senken
      ytdDelta = -0.01;
      newWeights.pe = Math.min(0.20, currentWeights.pe + 0.01);
    }

    newWeights.ytd = Math.max(0.03, Math.min(0.15, currentWeights.ytd + ytdDelta));
    newWeights.momentum = Math.max(0.05, Math.min(0.20, currentWeights.momentum + momentumDelta));

    // Neue signalWeights in DB schreiben (als neue Zeile, alte deaktivieren)
    await db.update(signalWeights).set({ isActive: 0 });
    const newVersion = `algo-feedback-${new Date().toISOString().slice(0, 7)}`;
    await db.insert(signalWeights).values({
      name: newVersion,
      weights: JSON.stringify(newWeights),
      isActive: 1,
      optimizerLog: JSON.stringify({
        source: "algo_feedback_loop",
        runId: currentRunId,
        positiveEvidence,
        negativeEvidence,
        ytdDelta,
        momentumDelta,
        timestamp: new Date().toISOString(),
      }),
      lastRunAt: new Date(),
    });

    // Tuning-Log dokumentieren
    const rationale = [
      `Feedback-Loop Stufe 2: Sektor-Tilt-Alpha aus ${completedRuns.length} Runs analysiert.`,
      positiveEvidence.length > 0 ? `Konsistent positiv: ${positiveEvidence.join(", ")}` : "",
      negativeEvidence.length > 0 ? `Konsistent negativ: ${negativeEvidence.join(", ")}` : "",
      `ytd: ${currentWeights.ytd.toFixed(3)} → ${newWeights.ytd.toFixed(3)}, momentum: ${currentWeights.momentum.toFixed(3)} → ${newWeights.momentum.toFixed(3)}`,
    ].filter(Boolean).join(" | ");

    await db.insert(algoTuningLog).values({
      triggeredByRunId: currentRunId,
      fromVersion: "default",
      toVersion: newVersion,
      parameterChanged: "signalWeights.ytd+momentum",
      oldValue: `ytd=${currentWeights.ytd.toFixed(3)},momentum=${currentWeights.momentum.toFixed(3)}`,
      newValue: `ytd=${newWeights.ytd.toFixed(3)},momentum=${newWeights.momentum.toFixed(3)}`,
      rationale,
      overfittingRisk: "low",
      expectedImpact: `Sektor-Tilt-Alpha-Erkenntnisse in Signal-Scoring integriert (${consistentlyPositive} positive, ${consistentlyNegative} negative Sektoren)`,
      source: "llm_auto",
    });

    console.log(`[algoFeedback] Gewichtsanpassung durchgeführt: ytd ${currentWeights.ytd.toFixed(3)}→${newWeights.ytd.toFixed(3)}, momentum ${currentWeights.momentum.toFixed(3)}→${newWeights.momentum.toFixed(3)}`);
  } catch (e: any) {
    console.error("[algoFeedback] Fehler im Feedback-Loop:", e?.message);
  }
}

// ============================================================
// 5. HILFSFUNKTIONEN FÜR ADMIN-UI
// ============================================================

// Die Getter degradieren bewusst zu [] statt zu werfen: Ist die Migration 0033
// (algo_backtest_*, algo_tuning_log) in der Ziel-DB noch nicht angewendet, soll
// die Admin-Seite einen leeren Zustand zeigen statt einen 500-Fehler auszulösen.
export async function getBacktestRuns(limit = 12) {
  const db = await getDb();
  if (!db) return [];
  try {
    const { algoBacktestRuns } = await import("../../drizzle/schema");
    const { desc } = await import("drizzle-orm");
    return await db.select().from(algoBacktestRuns).orderBy(desc(algoBacktestRuns.runMonth)).limit(limit);
  } catch (e) {
    console.warn("[algoBacktest] getBacktestRuns fehlgeschlagen (Tabelle fehlt?):", (e as Error).message);
    return [];
  }
}

export async function getBacktestPortfolios(runId: number) {
  const db = await getDb();
  if (!db) return [];
  try {
    const { algoBacktestPortfolios } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    return await db.select().from(algoBacktestPortfolios).where(eq(algoBacktestPortfolios.runId, runId));
  } catch (e) {
    console.warn("[algoBacktest] getBacktestPortfolios fehlgeschlagen:", (e as Error).message);
    return [];
  }
}

export async function getTuningLog(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  try {
    const { algoTuningLog } = await import("../../drizzle/schema");
    const { desc } = await import("drizzle-orm");
    return await db.select().from(algoTuningLog).orderBy(desc(algoTuningLog.createdAt)).limit(limit);
  } catch (e) {
    console.warn("[algoBacktest] getTuningLog fehlgeschlagen (Tabelle fehlt?):", (e as Error).message);
    return [];
  }
}

export async function getPendingEvaluations(): Promise<Array<{ runId: number; runMonth: string }>> {
  const db = await getDb();
  if (!db) return [];
  const { algoBacktestRuns } = await import("../../drizzle/schema");
  const { eq, lte } = await import("drizzle-orm");

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoffStr = thirtyDaysAgo.toISOString().split("T")[0];

  const runs = await db.select({ id: algoBacktestRuns.id, runMonth: algoBacktestRuns.runMonth })
    .from(algoBacktestRuns)
    .where(eq(algoBacktestRuns.status, "active"));

  return runs
    .filter((r: any) => r.runMonth <= cutoffStr)
    .map((r: any) => ({ runId: r.id, runMonth: r.runMonth }));
}
