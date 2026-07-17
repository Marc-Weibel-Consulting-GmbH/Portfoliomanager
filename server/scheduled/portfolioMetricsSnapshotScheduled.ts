/**
 * Portfolio Metrics Snapshot Scheduled Handler — E0 Rewrite
 *
 * Triggered daily via Heartbeat cron (and manually via Admin).
 *
 * Architecture (post-E0):
 *   - Kursbasierte Kennzahlen (Sharpe, Sortino, Volatilität, Max Drawdown) werden
 *     aus der kanonischen Portfolio-Wertreihe (performanceService) berechnet —
 *     dieselbe Quelle wie der QuantStats-Tearsheet.
 *   - Fundamentaldaten (PEG, PE, Dividende) werden NUR für den heutigen Tag
 *     gespeichert (nie rückwirkend erfunden).
 *   - Beta = gewichteter Durchschnitt der Einzeltitel-Betas (heutiger DB-Wert),
 *     nicht als Fake-Historie.
 *   - Alle Werte in CHF (via fxHelper/performanceService).
 *   - `source` = 'live' (täglicher Cron) oder 'backfill' (Rekonstruktion aus Kursen).
 *
 * Prinzipien (aus KONZEPT_PORTFOLIO_QUALITAET.md):
 *   1. Keine erfundenen Daten.
 *   2. Eine Wahrheit pro Kennzahl (gleiche Berechnung wie überall).
 *   3. Sharpe/Sortino mit rf = 2 % (DEFAULT_RISK_FREE_RATE).
 *   4. Portfolio-Sharpe aus Wertreihe, NICHT Ø Einzeltitel-Sharpes.
 */
import type { Request, Response } from "express";

export async function handlePortfolioMetricsSnapshot(req: Request, res: Response) {
  const isBackfill = req.query.backfill === "true" || req.body?.backfill === true;
  const daysBack = isBackfill ? 365 : 1;
  // Optional: filter to a specific portfolio (for per-portfolio snapshot trigger)
  const specificPortfolioId = req.query.portfolioId ? parseInt(String(req.query.portfolioId)) : (req.body?.portfolioId ?? null);
  // Optional: recompute — bestehende Snapshots des Portfolios VOR dem Backfill
  // löschen. Nötig, wenn frühere Läufe aus lückenhaften Kursdaten unbrauchbare
  // Kennzahlen gespeichert haben (die Dedupe-Logik würde sie sonst nie ersetzen).
  // Nur zusammen mit backfill=true wirksam.
  const isRecompute = isBackfill && (req.query.recompute === "true" || req.body?.recompute === true);

  try {
    const { getDb } = await import("../db");
    const {
      savedPortfolios,
      portfolioMetricsSnapshot,
      stocks,
    } = await import("../../drizzle/schema");
    const { eq, sql, and, inArray } = await import("drizzle-orm");
    const { calculatePortfolioPerformance } = await import("../lib/performanceService");
    const {
      calcSharpe,
      calcSortino,
      calcMaxDrawdown,
      calcVolatility,
      DEFAULT_RISK_FREE_RATE,
    } = await import("../analytics/riskStats");
    const { calculatePortfolioQualityScore, calculateHHI, getScoreThresholds } = await import("../lib/portfolioQualityScore");
    const scoreConfig = await getScoreThresholds();

    const db = await getDb();
    if (!db) return res.status(500).json({ error: "Database not available" });

    // 1. Get all non-snapshot portfolios (or a specific one if portfolioId is provided)
    const portfoliosQuery = db
      .select({ id: savedPortfolios.id, portfolioData: savedPortfolios.portfolioData })
      .from(savedPortfolios);
    const portfolios = specificPortfolioId
      ? await portfoliosQuery.where(and(eq(savedPortfolios.isSnapshot, 0), eq(savedPortfolios.id, specificPortfolioId)))
      : await portfoliosQuery.where(eq(savedPortfolios.isSnapshot, 0));

    if (portfolios.length === 0) {
      return res.json({ ok: true, message: "No portfolios found", saved: 0 });
    }

    // 2. Today's date
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    // 3. Get all stocks with current fundamental data (for today's fundamentals + Beta)
    const allStocks = await db
      .select({
        ticker: stocks.ticker,
        pegRatio: stocks.pegRatio,
        dividendYield: stocks.dividendYield,
        peRatio: stocks.peRatio,
        beta: stocks.beta,
        sector: stocks.sector,
        currency: stocks.currency,
      })
      .from(stocks);
    const stockFundamentals = new Map(allStocks.map((s) => [s.ticker, s]));

    // 4. Generate list of dates to process
    const datesToProcess: string[] = [];
    for (let i = daysBack - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      // Skip weekends
      const dow = d.getDay();
      if (dow === 0 || dow === 6) continue;
      datesToProcess.push(d.toISOString().slice(0, 10));
    }

    let totalSaved = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    for (const portfolio of portfolios) {
      const portfolioId = portfolio.id;

      try {
        if (isRecompute) {
          await db
            .delete(portfolioMetricsSnapshot)
            .where(eq(portfolioMetricsSnapshot.portfolioId, portfolioId));
        }

        // Get existing snapshots for this portfolio to avoid duplicates
        const existingSnapshots = await db
          .select({ snapshotDate: portfolioMetricsSnapshot.snapshotDate })
          .from(portfolioMetricsSnapshot)
          .where(eq(portfolioMetricsSnapshot.portfolioId, portfolioId));
        const existingDates = new Set(
          existingSnapshots.map((r) => {
            const d = r.snapshotDate;
            if (d instanceof Date) return d.toISOString().slice(0, 10);
            return String(d).slice(0, 10);
          })
        );

        // Filter dates that need processing
        const pendingDates = datesToProcess.filter((d) => !existingDates.has(d));
        if (pendingDates.length === 0) {
          totalSkipped += datesToProcess.length;
          continue;
        }

        // Calculate full performance using the canonical performanceService
        // Use the earliest pending date minus 252 trading days (~1.5 years) as start
        const earliestPending = pendingDates[0];
        const perfStartDate = new Date(earliestPending);
        perfStartDate.setDate(perfStartDate.getDate() - 400); // 252 trading days ≈ 400 calendar days
        const perfStartStr = perfStartDate.toISOString().slice(0, 10);

        let perf;
        try {
          perf = await calculatePortfolioPerformance({
            portfolioId,
            startDate: perfStartStr,
            endDate: todayStr,
            includeHypothetical: true,
          });
        } catch (e: any) {
          // Portfolio has no transactions or insufficient data
          console.log(`[portfolioMetricsSnapshot] Portfolio ${portfolioId}: no performance data (${e.message})`);
          totalSkipped += pendingDates.length;
          continue;
        }

        // Build daily returns from the canonical value series
        const vals = perf.dailyValuations.filter(
          (v) => Number.isFinite(v.marketValue) && v.marketValue > 0
        );

        if (vals.length < 2) {
          totalSkipped += pendingDates.length;
          continue;
        }

        // Build returns array with dates
        const returnsWithDates: Array<{ date: string; ret: number }> = [];
        for (let i = 1; i < vals.length; i++) {
          const r = vals[i].marketValue / vals[i - 1].marketValue - 1;
          if (Number.isFinite(r)) {
            returnsWithDates.push({ date: vals[i].date, ret: r });
          }
        }

        // Get current positions from portfolioData JSON (savedPortfolios)
        let currentPositions: Array<{ ticker: string; weight: number }> = [];
        try {
          const rawData = portfolio.portfolioData;
          const pData = typeof rawData === "string" ? JSON.parse(rawData) : rawData;
          // Support both 'positions' and 'stocks' keys
          const posArray = pData?.positions || pData?.stocks;
          if (posArray && Array.isArray(posArray)) {
            // Try value-based weighting first (currentValueCHF/valueCHF)
            const totalVal = posArray.reduce(
              (sum: number, p: any) => sum + (parseFloat(p.currentValueCHF || p.valueCHF || "0")),
              0
            );
            if (totalVal > 0) {
              currentPositions = posArray
                .filter((p: any) => p.ticker)
                .map((p: any) => ({
                  ticker: p.ticker,
                  weight: parseFloat(p.currentValueCHF || p.valueCHF || "0") / totalVal,
                }));
            } else {
              // Fallback: use 'weight' field (percentage-based)
              const totalWeight = posArray.reduce(
                (sum: number, p: any) => sum + (parseFloat(p.weight || "0")),
                0
              );
              if (totalWeight > 0) {
                currentPositions = posArray
                  .filter((p: any) => p.ticker)
                  .map((p: any) => ({
                    ticker: p.ticker,
                    weight: parseFloat(p.weight || "0") / totalWeight,
                  }));
              }
            }
          }
        } catch {}

        // For each pending date, compute rolling metrics from the returns series
        for (const dateStr of pendingDates) {
          // Find all returns up to and including this date
          const returnsUpToDate = returnsWithDates.filter((r) => r.date <= dateStr);

          // Rolling 252-day window for risk metrics
          const ROLLING_WINDOW = 252;
          const windowReturns = returnsUpToDate.slice(-ROLLING_WINDOW).map((r) => r.ret);

          // Verlässlichkeits-Guard für kursbasierte Kennzahlen:
          //  (a) Mindestens 60 Renditen (wie MIN_HISTORY_RETURNS der Engine) —
          //      annualisierte Sharpe/Vol aus 20–40 Tagen ist Rauschen.
          //  (b) Steht die Wertreihe an > 50 % der Tage exakt still, fehlen fast
          //      sicher Kursdaten der Positionen (buildDailyValuations lässt
          //      unbepreiste Titel weg) — Sharpe wäre dann ≈ −rf/σ (z. B. −4),
          //      ein Datenartefakt, keine Portfolioeigenschaft.
          // Unzuverlässig → Kennzahlen ehrlich als null (heutige Fundamentaldaten
          // werden trotzdem gespeichert); reine Backfill-Tage ohne verlässliche
          // Kennzahlen werden übersprungen.
          const MIN_RETURNS_FOR_METRICS = 60;
          const zeroShare = windowReturns.length > 0
            ? windowReturns.filter((r) => Math.abs(r) < 1e-9).length / windowReturns.length
            : 1;
          const metricsReliable =
            windowReturns.length >= MIN_RETURNS_FOR_METRICS && zeroShare <= 0.5;

          if (!metricsReliable && dateStr !== todayStr) {
            totalSkipped++;
            continue;
          }

          // Compute kursbasierte Kennzahlen from the portfolio value series
          const sharpe = metricsReliable ? calcSharpe(windowReturns, DEFAULT_RISK_FREE_RATE) : NaN;
          const sortino = metricsReliable ? calcSortino(windowReturns, DEFAULT_RISK_FREE_RATE) : NaN;
          const volatility = metricsReliable ? calcVolatility(windowReturns) : NaN;
          const maxDrawdown = metricsReliable ? calcMaxDrawdown(windowReturns) : NaN;

          // Position count from valuations at this date
          // (approximate: use the valuation closest to dateStr)
          const valAtDate = vals.find((v) => v.date === dateStr) || vals[vals.length - 1];
          const totalValueCHF = valAtDate?.marketValue ?? null;
          const positionCount = currentPositions.length || null;

          // Fundamentals: ONLY for today (not backfilled)
          const isToday = dateStr === todayStr;
          let avgPEG: number | null = null;
          let avgDividendYield: number | null = null;
          let avgPE: number | null = null;
          let avgBeta: number | null = null;

          if (isToday && currentPositions.length > 0) {
            let wPEG = 0, wDiv = 0, wPE = 0, wBeta = 0;
            let wPEGSum = 0, wDivSum = 0, wPESum = 0, wBetaSum = 0;

            for (const pos of currentPositions) {
              const fund = stockFundamentals.get(pos.ticker);
              if (!fund) continue;

              if (fund.pegRatio) {
                const peg = parseFloat(fund.pegRatio);
                if (!isNaN(peg) && peg > 0 && peg < 50) {
                  wPEG += peg * pos.weight;
                  wPEGSum += pos.weight;
                }
              }
              if (fund.dividendYield) {
                const div = parseFloat(fund.dividendYield);
                if (!isNaN(div) && div >= 0 && div < 20) {
                  wDiv += div * pos.weight;
                  wDivSum += pos.weight;
                }
              }
              if (fund.peRatio) {
                const pe = parseFloat(fund.peRatio);
                if (!isNaN(pe) && pe > 0 && pe < 200) {
                  wPE += pe * pos.weight;
                  wPESum += pos.weight;
                }
              }
              // Beta: no filter b > 0 (negative betas are valid!)
              if (fund.beta) {
                const b = parseFloat(fund.beta);
                if (!isNaN(b) && isFinite(b)) {
                  wBeta += b * pos.weight;
                  wBetaSum += pos.weight;
                }
              }
            }

            avgPEG = wPEGSum > 0 ? parseFloat((wPEG / wPEGSum).toFixed(4)) : null;
            avgDividendYield = wDivSum > 0 ? parseFloat((wDiv / wDivSum).toFixed(4)) : null;
            avgPE = wPESum > 0 ? parseFloat((wPE / wPESum).toFixed(4)) : null;
            avgBeta = wBetaSum > 0 ? parseFloat((wBeta / wBetaSum).toFixed(4)) : null;
          }

          // Determine source
          const source: "live" | "backfill" = isToday ? "live" : "backfill";

          // E1: Calculate Quality Score (only for live snapshots with fundamentals)
          let qualityScore: number | null = null;
          let qualityComponents: string | null = null;
          let dataCoveragePct: number | null = null;

          if (isToday && currentPositions.length > 0) {
            // Compute HHI (position concentration)
            const posWeights = currentPositions.map((p) => p.weight);
            const hhi = calculateHHI(posWeights);

            // Compute sector HHI from stock sectors
            const sectorWeights = new Map<string, number>();
            let fxForeignWeight = 0;
            for (const pos of currentPositions) {
              const fund = stockFundamentals.get(pos.ticker);
              const sector = fund?.sector || "Unknown";
              sectorWeights.set(sector, (sectorWeights.get(sector) || 0) + pos.weight);
              // Foreign currency = not CHF
              const currency = fund?.currency || "CHF";
              if (currency !== "CHF") fxForeignWeight += pos.weight;
            }
            const sectorHHI = calculateHHI([...sectorWeights.values()]);

            // PEG distribution
            let pegBelow15 = 0, pegAbove3 = 0, pegTotal = 0;
            for (const pos of currentPositions) {
              const fund = stockFundamentals.get(pos.ticker);
              if (fund?.pegRatio) {
                const peg = parseFloat(fund.pegRatio);
                if (!isNaN(peg) && peg > 0 && peg < 50) {
                  pegTotal++;
                  if (peg < 1.5) pegBelow15++;
                  if (peg > 3) pegAbove3++;
                }
              }
            }

            const qResult = calculatePortfolioQualityScore({
              // NaN (unzuverlässige Wertreihe) → null, damit die Komponente als
              // «nicht verfügbar» renormalisiert wird statt den Score zu vergiften.
              sharpe: Number.isFinite(sharpe) ? sharpe : null,
              sortino: Number.isFinite(sortino) ? sortino : null,
              maxDrawdown: Number.isFinite(maxDrawdown) ? maxDrawdown : null,
              avgPEG,
              avgPE,
              pegDistribution: pegTotal > 0 ? { below15: pegBelow15, above3: pegAbove3, total: pegTotal } : null,
              volatility: Number.isFinite(volatility) ? volatility : null,
              avgBeta,
              hhi,
              avgDividendYield: avgDividendYield ? avgDividendYield / 100 : null, // stored as %, convert to decimal
              sectorHHI,
              foreignCurrencyPct: fxForeignWeight,
              positionCount: currentPositions.length,
            }, scoreConfig);

            qualityScore = qResult.totalScore;
            qualityComponents = JSON.stringify(qResult.components);
            dataCoveragePct = qResult.dataCoveragePct;
          }

          // Insert snapshot
          await db.insert(portfolioMetricsSnapshot).values({
            portfolioId,
            snapshotDate: new Date(dateStr + "T12:00:00Z"),
            avgSharpe: Number.isFinite(sharpe) ? sharpe.toFixed(4) : null,
            avgPEG: avgPEG?.toString() ?? null,
            avgDividendYield: avgDividendYield?.toString() ?? null,
            avgBeta: avgBeta?.toString() ?? null,
            avgPE: avgPE?.toString() ?? null,
            positionCount,
            totalValueCHF: totalValueCHF ? totalValueCHF.toFixed(2) : null,
            // New columns (E0)
            volatility: Number.isFinite(volatility) ? volatility.toFixed(4) : null,
            sortino: Number.isFinite(sortino) ? sortino.toFixed(4) : null,
            maxDrawdown: Number.isFinite(maxDrawdown) ? maxDrawdown.toFixed(4) : null,
            source,
            // E1: Quality Score
            qualityScore,
            qualityComponents,
            dataCoveragePct,
          });

          totalSaved++;
        }
      } catch (err: any) {
        console.error(`[portfolioMetricsSnapshot] Error for portfolio ${portfolioId}:`, err.message);
        totalErrors++;
      }
    }

    console.log(
      `[portfolioMetricsSnapshot] Saved ${totalSaved} snapshots, skipped ${totalSkipped}, errors ${totalErrors}`
    );
    return res.json({
      ok: true,
      saved: totalSaved,
      skipped: totalSkipped,
      errors: totalErrors,
      portfolios: portfolios.length,
      daysBack,
    });
  } catch (err: any) {
    console.error("[portfolioMetricsSnapshot] Error:", err);
    return res.status(500).json({ error: err.message });
  }
}
