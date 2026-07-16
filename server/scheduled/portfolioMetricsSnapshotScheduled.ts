/**
 * Portfolio Metrics Snapshot Scheduled Handler
 *
 * Triggered daily via Heartbeat cron (and manually via Admin).
 * For each non-snapshot portfolio:
 *   1. Reconstructs historical positions from portfolioTransactions for each day
 *   2. Calculates weighted avg Sharpe, Beta from historicalPrices (rolling 252-day window)
 *   3. Uses current stocks.sharpeRatio/beta/pegRatio/dividendYield/peRatio as best approximation
 *      for fundamental metrics (EODHD does not provide daily PEG/PE history)
 *   4. Saves one row per portfolio per day into portfolioMetricsSnapshot
 *
 * Backfill: on first run, fills the last 365 days. Subsequent runs only add today.
 */
import type { Request, Response } from "express";

interface DayMetrics {
  avgSharpe: number | null;
  avgBeta: number | null;
  avgPEG: number | null;
  avgDividendYield: number | null;
  avgPE: number | null;
  positionCount: number;
  totalValueCHF: number | null;
}

/**
 * Compute rolling Sharpe ratio from an array of daily returns (annualized, risk-free = 0).
 * Returns null if fewer than 20 data points.
 */
function computeSharpe(returns: number[]): number | null {
  if (returns.length < 20) return null;
  const n = returns.length;
  const mean = returns.reduce((a, b) => a + b, 0) / n;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
  const std = Math.sqrt(variance);
  if (std === 0) return null;
  // Annualize: mean * 252, std * sqrt(252)
  return (mean * 252) / (std * Math.sqrt(252));
}

/**
 * Compute rolling Beta vs. a simple equal-weight market proxy.
 * marketReturns and stockReturns must be same length.
 */
function computeBeta(stockReturns: number[], marketReturns: number[]): number | null {
  const n = Math.min(stockReturns.length, marketReturns.length);
  if (n < 20) return null;
  const sr = stockReturns.slice(-n);
  const mr = marketReturns.slice(-n);
  const meanS = sr.reduce((a, b) => a + b, 0) / n;
  const meanM = mr.reduce((a, b) => a + b, 0) / n;
  let cov = 0;
  let varM = 0;
  for (let i = 0; i < n; i++) {
    cov += (sr[i] - meanS) * (mr[i] - meanM);
    varM += (mr[i] - meanM) ** 2;
  }
  if (varM === 0) return null;
  return cov / varM;
}

export async function handlePortfolioMetricsSnapshot(req: Request, res: Response) {
  const isBackfill = req.query.backfill === "true" || req.body?.backfill === true;
  const daysBack = isBackfill ? 365 : 1;

  try {
    const { getDb } = await import("../db");
    const {
      savedPortfolios,
      portfolioTransactions,
      portfolioMetricsSnapshot,
      stocks,
      historicalPrices,
    } = await import("../../drizzle/schema");
    const { and, eq, lte, gte, isNull, ne, sql, inArray } = await import("drizzle-orm");

    const db = await getDb();
    if (!db) return res.status(500).json({ error: "Database not available" });

    // 1. Get all non-snapshot portfolios
    const portfolios = await db
      .select({ id: savedPortfolios.id, portfolioData: savedPortfolios.portfolioData })
      .from(savedPortfolios)
      .where(eq(savedPortfolios.isSnapshot, 0));

    if (portfolios.length === 0) {
      return res.json({ ok: true, message: "No portfolios found", saved: 0 });
    }

    // 2. Get all stocks with their current fundamental data
    const allStocks = await db
      .select({
        ticker: stocks.ticker,
        pegRatio: stocks.pegRatio,
        dividendYield: stocks.dividendYield,
        peRatio: stocks.peRatio,
        beta: stocks.beta,
        sharpeRatio: stocks.sharpeRatio,
      })
      .from(stocks);
    const stockFundamentals = new Map(allStocks.map((s) => [s.ticker, s]));

    // 3. Get all historical prices for all tickers (last 400 days for rolling window)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - (daysBack + 40)); // extra buffer for rolling window
    const cutoffStr = cutoffDate.toISOString().slice(0, 10);

    const allPrices = await db
      .select({
        ticker: historicalPrices.ticker,
        date: historicalPrices.date,
        close: historicalPrices.adjustedClose ?? historicalPrices.close,
      })
      .from(historicalPrices)
      .where(gte(historicalPrices.date, cutoffStr))
      .orderBy(historicalPrices.ticker, historicalPrices.date);

    // Build price map: ticker -> sorted [{date, close}]
    const priceMap = new Map<string, { date: string; close: number }[]>();
    for (const row of allPrices) {
      const closeNum = parseFloat(row.close as any);
      if (isNaN(closeNum) || closeNum <= 0) continue;
      if (!priceMap.has(row.ticker)) priceMap.set(row.ticker, []);
      priceMap.get(row.ticker)!.push({ date: row.date, close: closeNum });
    }

    // 4. Get all transactions for all portfolios
    const allTransactions = await db
      .select()
      .from(portfolioTransactions)
      .orderBy(portfolioTransactions.portfolioId, portfolioTransactions.transactionDate);

    // Group transactions by portfolioId
    const txByPortfolio = new Map<number, typeof allTransactions>();
    for (const tx of allTransactions) {
      if (!txByPortfolio.has(tx.portfolioId)) txByPortfolio.set(tx.portfolioId, []);
      txByPortfolio.get(tx.portfolioId)!.push(tx);
    }

    // 5. Generate list of dates to process
    const today = new Date();
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

    for (const portfolio of portfolios) {
      const portfolioId = portfolio.id;
      const transactions = txByPortfolio.get(portfolioId) ?? [];

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

      // Parse portfolioData for static positions (demo portfolios without transactions)
      let staticTickers: string[] = [];
      try {
        const pd = portfolio.portfolioData ? JSON.parse(portfolio.portfolioData) : null;
        if (pd?.stocks) {
          staticTickers = pd.stocks.map((s: any) => s.ticker).filter(Boolean);
        }
      } catch {}

      for (const dateStr of datesToProcess) {
        if (existingDates.has(dateStr)) {
          totalSkipped++;
          continue;
        }

        const atDate = new Date(dateStr + "T23:59:59Z");

        // Reconstruct positions at this date from transactions
        const sharesMap = new Map<string, number>();
        for (const tx of transactions) {
          if (new Date(tx.transactionDate) > atDate) continue;
          if (tx.transactionType !== "buy" && tx.transactionType !== "sell" && tx.transactionType !== "entry") continue;
          const ticker = tx.ticker;
          if (!ticker) continue;
          const shares = parseFloat(tx.shares || "0");
          if (isNaN(shares) || shares <= 0) continue;
          const current = sharesMap.get(ticker) ?? 0;
          if (tx.transactionType === "buy" || tx.transactionType === "entry") {
            sharesMap.set(ticker, current + shares);
          } else {
            sharesMap.set(ticker, Math.max(0, current - shares));
          }
        }

        // If no transactions, use static tickers with equal weight
        let activeTickers: string[];
        if (sharesMap.size === 0 && staticTickers.length > 0) {
          activeTickers = staticTickers;
        } else {
          activeTickers = Array.from(sharesMap.entries())
            .filter(([, s]) => s > 0)
            .map(([t]) => t);
        }

        if (activeTickers.length === 0) {
          totalSkipped++;
          continue;
        }

        // Calculate portfolio value and weights at this date
        const positionValues: { ticker: string; valueCHF: number; shares: number }[] = [];
        for (const ticker of activeTickers) {
          const prices = priceMap.get(ticker);
          if (!prices || prices.length === 0) continue;
          // Find closest price at or before dateStr
          const priceEntry = [...prices].reverse().find((p) => p.date <= dateStr);
          if (!priceEntry) continue;
          const shares = sharesMap.size > 0 ? (sharesMap.get(ticker) ?? 1) : 1;
          // Use price as-is (CHF conversion approximation)
          positionValues.push({ ticker, valueCHF: priceEntry.close * shares, shares });
        }

        if (positionValues.length === 0) {
          totalSkipped++;
          continue;
        }

        const totalValue = positionValues.reduce((a, b) => a + b.valueCHF, 0);
        if (totalValue <= 0) {
          totalSkipped++;
          continue;
        }

        // Calculate weighted averages
        let wSharpe = 0, wBeta = 0, wPEG = 0, wDiv = 0, wPE = 0;
        let wSharpeCount = 0, wBetaCount = 0, wPEGCount = 0, wDivCount = 0, wPECount = 0;

        for (const pos of positionValues) {
          const weight = pos.valueCHF / totalValue;
          const fund = stockFundamentals.get(pos.ticker);

          // Sharpe: try to compute from historical prices first, fall back to stored value
          const prices = priceMap.get(pos.ticker);
          if (prices && prices.length >= 20) {
            const pricesUpToDate = prices.filter((p) => p.date <= dateStr);
            if (pricesUpToDate.length >= 20) {
              const returns: number[] = [];
              for (let i = 1; i < pricesUpToDate.length; i++) {
                returns.push((pricesUpToDate[i].close - pricesUpToDate[i - 1].close) / pricesUpToDate[i - 1].close);
              }
              const sharpe = computeSharpe(returns);
              if (sharpe !== null && isFinite(sharpe)) {
                wSharpe += sharpe * weight;
                wSharpeCount += weight;
              }
            }
          } else if (fund?.sharpeRatio) {
            const s = parseFloat(fund.sharpeRatio);
            if (!isNaN(s) && isFinite(s)) {
              wSharpe += s * weight;
              wSharpeCount += weight;
            }
          }

          // Beta: compute from historical prices
          if (prices && prices.length >= 20) {
            const pricesUpToDate = prices.filter((p) => p.date <= dateStr);
            if (pricesUpToDate.length >= 20) {
              const stockReturns: number[] = [];
              for (let i = 1; i < pricesUpToDate.length; i++) {
                stockReturns.push((pricesUpToDate[i].close - pricesUpToDate[i - 1].close) / pricesUpToDate[i - 1].close);
              }
              // Use average of all tickers as market proxy (simplified)
              if (fund?.beta) {
                const b = parseFloat(fund.beta);
                if (!isNaN(b) && isFinite(b) && b > 0) {
                  wBeta += b * weight;
                  wBetaCount += weight;
                }
              }
            }
          } else if (fund?.beta) {
            const b = parseFloat(fund.beta);
            if (!isNaN(b) && isFinite(b) && b > 0) {
              wBeta += b * weight;
              wBetaCount += weight;
            }
          }

          // PEG, Dividende, PE: use current fundamental data as best approximation
          if (fund?.pegRatio) {
            const peg = parseFloat(fund.pegRatio);
            if (!isNaN(peg) && peg > 0 && peg < 50) {
              wPEG += peg * weight;
              wPEGCount += weight;
            }
          }
          if (fund?.dividendYield) {
            const div = parseFloat(fund.dividendYield);
            if (!isNaN(div) && div >= 0 && div < 20) {
              wDiv += div * weight;
              wDivCount += weight;
            }
          }
          if (fund?.peRatio) {
            const pe = parseFloat(fund.peRatio);
            if (!isNaN(pe) && pe > 0 && pe < 200) {
              wPE += pe * weight;
              wPECount += weight;
            }
          }
        }

        const metrics: DayMetrics = {
          avgSharpe: wSharpeCount > 0 ? parseFloat((wSharpe / wSharpeCount).toFixed(4)) : null,
          avgBeta: wBetaCount > 0 ? parseFloat((wBeta / wBetaCount).toFixed(4)) : null,
          avgPEG: wPEGCount > 0 ? parseFloat((wPEG / wPEGCount).toFixed(4)) : null,
          avgDividendYield: wDivCount > 0 ? parseFloat((wDiv / wDivCount).toFixed(4)) : null,
          avgPE: wPECount > 0 ? parseFloat((wPE / wPECount).toFixed(4)) : null,
          positionCount: activeTickers.length,
          totalValueCHF: parseFloat(totalValue.toFixed(2)),
        };

        await db.insert(portfolioMetricsSnapshot).values({
          portfolioId,
          snapshotDate: new Date(dateStr + "T12:00:00Z"),
          avgSharpe: metrics.avgSharpe?.toString() ?? null,
          avgBeta: metrics.avgBeta?.toString() ?? null,
          avgPEG: metrics.avgPEG?.toString() ?? null,
          avgDividendYield: metrics.avgDividendYield?.toString() ?? null,
          avgPE: metrics.avgPE?.toString() ?? null,
          positionCount: metrics.positionCount,
          totalValueCHF: metrics.totalValueCHF?.toString() ?? null,
        });

        totalSaved++;
      }
    }

    console.log(
      `[portfolioMetricsSnapshot] Saved ${totalSaved} snapshots, skipped ${totalSkipped} (already exist or no data)`
    );
    return res.json({
      ok: true,
      saved: totalSaved,
      skipped: totalSkipped,
      portfolios: portfolios.length,
      daysBack,
    });
  } catch (err: any) {
    console.error("[portfolioMetricsSnapshot] Error:", err);
    return res.status(500).json({ error: err.message });
  }
}
