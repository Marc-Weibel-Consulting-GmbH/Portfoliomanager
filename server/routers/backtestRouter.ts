import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import YahooFinanceClass from "yahoo-finance2";
import { getActiveWeights, type WeightConfig } from "../analytics/optimizerWorker";

const yahooFinance: any = new (YahooFinanceClass as any)();

function normalizeTicker(ticker: string): string {
  if (ticker.endsWith(".US")) return ticker.slice(0, -3);
  return ticker;
}

interface BacktestSignal {
  date: string;
  ticker: string;
  type: "buy" | "sell";
  reason: string;
  price: number;
  score: number;
}

interface BacktestTrade {
  entryDate: string;
  exitDate: string;
  ticker: string;
  entryPrice: number;
  exitPrice: number;
  returnPct: number;
  holdingDays: number;
  signalType: string;
}

// ──────────────────────────────────────────────────────────────
// Technical Indicators
// ──────────────────────────────────────────────────────────────

function calcRSI(prices: number[], period = 14): number[] {
  const rsi: number[] = [];
  if (prices.length < period + 1) return rsi;

  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;

  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  rsi.push(100 - 100 / (1 + rs));

  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    const rs2 = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi.push(100 - 100 / (1 + rs2));
  }
  return rsi;
}

function calcEMA(prices: number[], period: number): number[] {
  const ema: number[] = [];
  if (prices.length < period) return ema;

  let sum = 0;
  for (let i = 0; i < period; i++) sum += prices[i];
  ema.push(sum / period);

  const multiplier = 2 / (period + 1);
  for (let i = period; i < prices.length; i++) {
    ema.push((prices[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1]);
  }
  return ema;
}

function calcMACD(prices: number[]): { macd: number[]; signal: number[]; histogram: number[] } {
  const ema12 = calcEMA(prices, 12);
  const ema26 = calcEMA(prices, 26);

  const macdLine: number[] = [];
  const offset = ema12.length - ema26.length;

  for (let i = 0; i < ema26.length; i++) {
    macdLine.push(ema12[i + offset] - ema26[i]);
  }

  const signalLine = calcEMA(macdLine, 9);
  const histogram: number[] = [];
  const sigOffset = macdLine.length - signalLine.length;

  for (let i = 0; i < signalLine.length; i++) {
    histogram.push(macdLine[i + sigOffset] - signalLine[i]);
  }

  return { macd: macdLine, signal: signalLine, histogram };
}

// ──────────────────────────────────────────────────────────────
// Multi-Factor Signal Generation (uses Optimizer Weights)
// ──────────────────────────────────────────────────────────────

interface DailyContext {
  rsi: number | null;
  macdCrossUp: boolean;
  macdCrossDown: boolean;
  macdHistogram: number;
  priceVs52wHigh: number; // 0-1 position in 52w range
  momentum20d: number; // 20-day return %
  momentum60d: number; // 60-day return %
}

/**
 * Calculate a weighted composite score for a given day using the same
 * indicator set as the Signal-Engine (signalsRouter.ts).
 * 
 * This ensures Backtesting results match what the user sees in "Signale & Scores".
 */
function calculateDailyScore(
  ctx: DailyContext,
  weights: WeightConfig,
  fundamentals: { peRatio: number | null; pegRatio: number | null; dividendYield: number }
): { score: number; reasons: string[] } {
  const WEIGHT_SCALE = 12;
  let score = 0;
  const reasons: string[] = [];

  // ── RSI ──
  if (ctx.rsi !== null) {
    const w = weights.rsi * WEIGHT_SCALE;
    if (ctx.rsi < 30) { score += 2 * w; reasons.push(`RSI überverkauft (${ctx.rsi.toFixed(0)})`); }
    else if (ctx.rsi < 40) { score += 1 * w; reasons.push(`RSI niedrig (${ctx.rsi.toFixed(0)})`); }
    else if (ctx.rsi > 75) { score -= 2 * w; reasons.push(`RSI überkauft (${ctx.rsi.toFixed(0)})`); }
    else if (ctx.rsi > 65) { score -= 1 * w; reasons.push(`RSI hoch (${ctx.rsi.toFixed(0)})`); }
  }

  // ── MACD ──
  {
    const w = weights.macd * WEIGHT_SCALE;
    if (ctx.macdCrossUp) { score += 2 * w; reasons.push("MACD Kreuzung aufwärts"); }
    else if (ctx.macdCrossDown) { score -= 2 * w; reasons.push("MACD Kreuzung abwärts"); }
    else if (ctx.macdHistogram > 0) { score += 0.5 * w; }
    else if (ctx.macdHistogram < 0) { score -= 0.5 * w; }
  }

  // ── 52-Week Range ──
  {
    const w = weights.week52 * WEIGHT_SCALE;
    if (ctx.priceVs52wHigh < 0.2) { score += 2 * w; reasons.push("Nahe 52W-Tief"); }
    else if (ctx.priceVs52wHigh < 0.35) { score += 1 * w; }
    else if (ctx.priceVs52wHigh > 0.95) { score -= 1 * w; reasons.push("Nahe 52W-Hoch"); }
  }

  // ── Momentum (as proxy for YTD in daily context) ──
  {
    const w = weights.momentum * WEIGHT_SCALE;
    if (ctx.momentum60d > 15) { score += 1 * w; reasons.push(`Starkes Momentum (${ctx.momentum60d.toFixed(1)}%)`); }
    else if (ctx.momentum60d < -15) { score += 1 * w; reasons.push(`Überverkauft (${ctx.momentum60d.toFixed(1)}%)`); } // contrarian
    if (ctx.momentum20d > 8) { score += 0.5 * w; }
    else if (ctx.momentum20d < -8) { score += 0.5 * w; } // contrarian bounce
  }

  // ── Fundamentals (static for the backtest period, applied with weights) ──
  if (fundamentals.peRatio !== null && fundamentals.peRatio > 0) {
    const w = weights.pe * WEIGHT_SCALE;
    if (fundamentals.peRatio < 12) { score += 3 * w; reasons.push(`Niedriges P/E (${fundamentals.peRatio.toFixed(1)})`); }
    else if (fundamentals.peRatio < 18) { score += 1 * w; }
    else if (fundamentals.peRatio > 35) { score -= 2 * w; reasons.push(`Hohes P/E (${fundamentals.peRatio.toFixed(1)})`); }
    else if (fundamentals.peRatio > 25) { score -= 1 * w; }
  }

  if (fundamentals.pegRatio !== null && fundamentals.pegRatio > 0) {
    const w = weights.peg * WEIGHT_SCALE;
    if (fundamentals.pegRatio < 0.8) { score += 2 * w; }
    else if (fundamentals.pegRatio < 1.2) { score += 1 * w; }
    else if (fundamentals.pegRatio > 2.5) { score -= 2 * w; }
    else if (fundamentals.pegRatio > 1.8) { score -= 1 * w; }
  }

  if (fundamentals.dividendYield > 5) {
    const w = weights.dividend * WEIGHT_SCALE;
    score += 2 * w;
  } else if (fundamentals.dividendYield > 3) {
    const w = weights.dividend * WEIGHT_SCALE;
    score += 1 * w;
  }

  return { score, reasons };
}

/**
 * Generate signals using the full multi-factor model with optimizer weights.
 * This replaces the old RSI+MACD-only approach.
 */
function generateSignals(
  dates: string[],
  prices: number[],
  ticker: string,
  weights: WeightConfig,
  fundamentals: { peRatio: number | null; pegRatio: number | null; dividendYield: number }
): BacktestSignal[] {
  const signals: BacktestSignal[] = [];
  const rsiValues = calcRSI(prices, 14);
  const { macd, signal, histogram } = calcMACD(prices);

  // Offsets for alignment
  const rsiOffset = prices.length - rsiValues.length;
  const macdOffset = prices.length - signal.length;
  const histOffset = prices.length - histogram.length;
  const startIdx = Math.max(rsiOffset, macdOffset, histOffset, 60) + 1; // Need 60 days for momentum

  // Calculate rolling 52-week high/low (252 trading days)
  const lookback252 = 252;

  // Buy/Sell threshold (adaptive based on weight distribution)
  const buyThreshold = 3.5;
  const sellThreshold = -3.5;

  let lastSignalType: "buy" | "sell" | null = null;

  for (let i = startIdx; i < prices.length; i++) {
    const rsiIdx = i - rsiOffset;
    const macdIdx = i - macdOffset;
    const histIdx = i - histOffset;
    const prevMacdIdx = macdIdx - 1;

    if (rsiIdx < 0 || rsiIdx >= rsiValues.length) continue;
    if (macdIdx < 0 || macdIdx >= signal.length) continue;
    if (prevMacdIdx < 0) continue;
    if (histIdx < 0 || histIdx >= histogram.length) continue;

    // 52-week range position
    const lookbackStart = Math.max(0, i - lookback252);
    const windowPrices = prices.slice(lookbackStart, i + 1);
    const high52 = Math.max(...windowPrices);
    const low52 = Math.min(...windowPrices);
    const range52 = high52 - low52;
    const priceVs52wHigh = range52 > 0 ? (prices[i] - low52) / range52 : 0.5;

    // Momentum
    const momentum20d = i >= 20 ? ((prices[i] - prices[i - 20]) / prices[i - 20]) * 100 : 0;
    const momentum60d = i >= 60 ? ((prices[i] - prices[i - 60]) / prices[i - 60]) * 100 : 0;

    // MACD crossover detection
    const macdCrossUp = macd[macdIdx] > signal[macdIdx] && macd[prevMacdIdx] <= signal[prevMacdIdx];
    const macdCrossDown = macd[macdIdx] < signal[macdIdx] && macd[prevMacdIdx] >= signal[prevMacdIdx];

    const ctx: DailyContext = {
      rsi: rsiValues[rsiIdx],
      macdCrossUp,
      macdCrossDown,
      macdHistogram: histogram[histIdx],
      priceVs52wHigh,
      momentum20d,
      momentum60d,
    };

    const { score, reasons } = calculateDailyScore(ctx, weights, fundamentals);

    // Generate signal only on threshold crossings (avoid duplicate signals)
    if (score >= buyThreshold && lastSignalType !== "buy") {
      signals.push({
        date: dates[i],
        ticker,
        type: "buy",
        reason: reasons.slice(0, 3).join(" + "),
        price: prices[i],
        score,
      });
      lastSignalType = "buy";
    } else if (score <= sellThreshold && lastSignalType !== "sell") {
      signals.push({
        date: dates[i],
        ticker,
        type: "sell",
        reason: reasons.slice(0, 3).join(" + "),
        price: prices[i],
        score,
      });
      lastSignalType = "sell";
    }
  }

  return signals;
}

// Convert signals to trades (pair buy/sell)
function signalsToTrades(signals: BacktestSignal[]): BacktestTrade[] {
  const trades: BacktestTrade[] = [];
  let openPosition: BacktestSignal | null = null;

  for (const signal of signals) {
    if (signal.type === "buy" && !openPosition) {
      openPosition = signal;
    } else if (signal.type === "sell" && openPosition) {
      const returnPct = ((signal.price - openPosition.price) / openPosition.price) * 100;
      const entryDate = new Date(openPosition.date);
      const exitDate = new Date(signal.date);
      const holdingDays = Math.round((exitDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));

      trades.push({
        entryDate: openPosition.date,
        exitDate: signal.date,
        ticker: signal.ticker,
        entryPrice: openPosition.price,
        exitPrice: signal.price,
        returnPct,
        holdingDays,
        signalType: openPosition.reason,
      });
      openPosition = null;
    }
  }

  return trades;
}

export const backtestRouter = router({
  // Run backtest for a specific stock using optimizer weights
  runSingle: protectedProcedure
    .input(z.object({
      ticker: z.string(),
      lookbackMonths: z.number().min(3).max(60).optional().default(12),
    }))
    .query(async ({ input }) => {
      const normalizedTicker = normalizeTicker(input.ticker);
      const lookbackDays = input.lookbackMonths * 30;

      const end = new Date();
      const start = new Date(end.getTime() - lookbackDays * 24 * 60 * 60 * 1000);

      // Get active optimizer weights
      const weights = await getActiveWeights();

      // Fetch fundamentals for the stock
      let peRatio: number | null = null;
      let pegRatio: number | null = null;
      let dividendYield = 0;
      try {
        const summary = await yahooFinance.quoteSummary(normalizedTicker, {
          modules: ["summaryDetail", "defaultKeyStatistics"],
        }) as any;
        peRatio = summary.summaryDetail?.trailingPE ?? null;
        pegRatio = summary.defaultKeyStatistics?.pegRatio ?? null;
        dividendYield = (summary.summaryDetail?.dividendYield ?? 0) * 100;
      } catch { /* use defaults */ }

      try {
        const chartResult = await yahooFinance.chart(normalizedTicker, {
          period1: start.toISOString().split("T")[0],
          period2: end.toISOString().split("T")[0],
          interval: "1d",
        }) as any;

        const quotes = chartResult.quotes || [];
        if (quotes.length < 50) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Nicht genügend Daten für Backtest" });
        }

        const dates = quotes.map((q: any) => q.date?.toISOString?.()?.split("T")[0] || "");
        const prices = quotes.map((q: any) => q.close).filter((p: any) => p != null);
        const validDates = dates.slice(0, prices.length);

        const signals = generateSignals(validDates, prices, input.ticker, weights, { peRatio, pegRatio, dividendYield });
        const trades = signalsToTrades(signals);

        // Calculate performance metrics
        const totalReturn = trades.reduce((sum, t) => sum + t.returnPct, 0);
        const avgReturn = trades.length > 0 ? totalReturn / trades.length : 0;
        const winningTrades = trades.filter(t => t.returnPct > 0);
        const losingTrades = trades.filter(t => t.returnPct <= 0);
        const winRate = trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;
        const avgWin = winningTrades.length > 0 ? winningTrades.reduce((s, t) => s + t.returnPct, 0) / winningTrades.length : 0;
        const avgLoss = losingTrades.length > 0 ? losingTrades.reduce((s, t) => s + t.returnPct, 0) / losingTrades.length : 0;
        const profitFactor = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : avgWin > 0 ? Infinity : 0;
        const maxDrawdown = trades.length > 0 ? Math.min(...trades.map(t => t.returnPct)) : 0;

        // Buy & Hold comparison
        const buyHoldReturn = prices.length > 1 ? ((prices[prices.length - 1] - prices[0]) / prices[0]) * 100 : 0;

        // Fetch benchmark data
        let sp500Return = 0;
        let spiReturn = 0;
        try {
          const sp500Chart = await yahooFinance.chart("^GSPC", {
            period1: start.toISOString().split("T")[0],
            period2: end.toISOString().split("T")[0],
            interval: "1d",
          }) as any;
          const sp500Quotes = sp500Chart.quotes || [];
          if (sp500Quotes.length > 1) {
            const sp500Prices = sp500Quotes.map((q: any) => q.close).filter((p: any) => p != null);
            sp500Return = ((sp500Prices[sp500Prices.length - 1] - sp500Prices[0]) / sp500Prices[0]) * 100;
          }
        } catch { /* ignore */ }

        try {
          const spiChart = await yahooFinance.chart("^SSMI", {
            period1: start.toISOString().split("T")[0],
            period2: end.toISOString().split("T")[0],
            interval: "1d",
          }) as any;
          const spiQuotes = spiChart.quotes || [];
          if (spiQuotes.length > 1) {
            const spiPrices = spiQuotes.map((q: any) => q.close).filter((p: any) => p != null);
            spiReturn = ((spiPrices[spiPrices.length - 1] - spiPrices[0]) / spiPrices[0]) * 100;
          }
        } catch { /* ignore */ }

        // Equity curve (cumulative returns)
        const equityCurve: { date: string; value: number }[] = [{ date: validDates[0], value: 100 }];
        let equity = 100;
        for (const trade of trades) {
          equity *= (1 + trade.returnPct / 100);
          equityCurve.push({ date: trade.exitDate, value: equity });
        }

        return {
          ticker: input.ticker,
          period: `${input.lookbackMonths} Monate`,
          startDate: validDates[0],
          endDate: validDates[validDates.length - 1],
          totalDataPoints: prices.length,
          signals,
          trades,
          metrics: {
            totalReturn,
            avgReturn,
            winRate,
            totalTrades: trades.length,
            winningTrades: winningTrades.length,
            losingTrades: losingTrades.length,
            avgWin,
            avgLoss,
            profitFactor,
            maxDrawdown,
            buyHoldReturn,
            outperformance: totalReturn - buyHoldReturn,
            sp500Return,
            spiReturn,
            vsSpx: totalReturn - sp500Return,
            vsSpi: totalReturn - spiReturn,
          },
          equityCurve,
          priceData: validDates.map((d: string, i: number) => ({ date: d, price: prices[i] })),
          activeWeights: weights,
        };
      } catch (err: any) {
        if (err.code) throw err;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Backtest fehlgeschlagen: ${err.message}` });
      }
    }),

  // Run backtest for entire portfolio
  runPortfolio: protectedProcedure
    .input(z.object({
      portfolioId: z.number(),
      lookbackMonths: z.number().min(3).max(60).optional().default(12),
    }))
    .query(async ({ input, ctx }) => {
      const { getSavedPortfolioById } = await import("../db");

      const portfolio = await getSavedPortfolioById(input.portfolioId, ctx.user.id);
      if (!portfolio) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Portfolio nicht gefunden" });
      }

      const rawData = JSON.parse(portfolio.portfolioData);
      const stocks: any[] = Array.isArray(rawData) ? rawData : (rawData.stocks || []);
      const lookbackDays = input.lookbackMonths * 30;

      const end = new Date();
      const start = new Date(end.getTime() - lookbackDays * 24 * 60 * 60 * 1000);

      // Get active optimizer weights
      const weights = await getActiveWeights();

      const results: any[] = [];

      for (const stock of stocks.slice(0, 20)) {
        try {
          const normalizedTicker = normalizeTicker(stock.ticker);

          // Fetch fundamentals
          let peRatio: number | null = null;
          let pegRatio: number | null = null;
          let dividendYield = 0;
          try {
            const summary = await yahooFinance.quoteSummary(normalizedTicker, {
              modules: ["summaryDetail", "defaultKeyStatistics"],
            }) as any;
            peRatio = summary.summaryDetail?.trailingPE ?? null;
            pegRatio = summary.defaultKeyStatistics?.pegRatio ?? null;
            dividendYield = (summary.summaryDetail?.dividendYield ?? 0) * 100;
          } catch { /* use defaults */ }

          const chartResult = await yahooFinance.chart(normalizedTicker, {
            period1: start.toISOString().split("T")[0],
            period2: end.toISOString().split("T")[0],
            interval: "1d",
          }) as any;

          const quotes = chartResult.quotes || [];
          if (quotes.length < 50) continue;

          const dates = quotes.map((q: any) => q.date?.toISOString?.()?.split("T")[0] || "");
          const prices = quotes.map((q: any) => q.close).filter((p: any) => p != null);
          const validDates = dates.slice(0, prices.length);

          const signals = generateSignals(validDates, prices, stock.ticker, weights, { peRatio, pegRatio, dividendYield });
          const trades = signalsToTrades(signals);

          const totalReturn = trades.reduce((sum: number, t: BacktestTrade) => sum + t.returnPct, 0);
          const winRate = trades.length > 0 ? (trades.filter(t => t.returnPct > 0).length / trades.length) * 100 : 0;
          const buyHoldReturn = prices.length > 1 ? ((prices[prices.length - 1] - prices[0]) / prices[0]) * 100 : 0;

          results.push({
            ticker: stock.ticker,
            companyName: stock.companyName || stock.name || stock.ticker,
            weight: parseFloat(stock.weight || "0"),
            totalSignals: signals.length,
            totalTrades: trades.length,
            signalReturn: totalReturn,
            buyHoldReturn,
            outperformance: totalReturn - buyHoldReturn,
            winRate,
          });
        } catch (err) {
          console.warn(`[Backtest] Failed for ${stock.ticker}:`, err);
        }
        // Rate limiting
        await new Promise(r => setTimeout(r, 200));
      }

      // Fetch benchmark data
      let sp500Return = 0;
      let spiReturn = 0;
      try {
        const sp500Chart = await yahooFinance.chart("^GSPC", {
          period1: start.toISOString().split("T")[0],
          period2: end.toISOString().split("T")[0],
          interval: "1d",
        }) as any;
        const sp500Quotes = sp500Chart.quotes || [];
        if (sp500Quotes.length > 1) {
          const sp500Prices = sp500Quotes.map((q: any) => q.close).filter((p: any) => p != null);
          sp500Return = ((sp500Prices[sp500Prices.length - 1] - sp500Prices[0]) / sp500Prices[0]) * 100;
        }
      } catch { /* ignore */ }

      try {
        const spiChart = await yahooFinance.chart("^SSMI", {
          period1: start.toISOString().split("T")[0],
          period2: end.toISOString().split("T")[0],
          interval: "1d",
        }) as any;
        const spiQuotes = spiChart.quotes || [];
        if (spiQuotes.length > 1) {
          const spiPrices = spiQuotes.map((q: any) => q.close).filter((p: any) => p != null);
          spiReturn = ((spiPrices[spiPrices.length - 1] - spiPrices[0]) / spiPrices[0]) * 100;
        }
      } catch { /* ignore */ }

      // Portfolio-level metrics
      const totalWeightedSignalReturn = results.reduce((sum, r) => sum + (r.signalReturn * r.weight / 100), 0);
      const totalWeightedBuyHold = results.reduce((sum, r) => sum + (r.buyHoldReturn * r.weight / 100), 0);
      const avgWinRate = results.length > 0 ? results.reduce((sum, r) => sum + r.winRate, 0) / results.length : 0;

      return {
        portfolioName: portfolio.name,
        period: `${input.lookbackMonths} Monate`,
        stockResults: results,
        portfolioMetrics: {
          weightedSignalReturn: totalWeightedSignalReturn,
          weightedBuyHoldReturn: totalWeightedBuyHold,
          outperformance: totalWeightedSignalReturn - totalWeightedBuyHold,
          avgWinRate,
          totalStocksAnalyzed: results.length,
          totalSignalsGenerated: results.reduce((sum, r) => sum + r.totalSignals, 0),
          totalTradesExecuted: results.reduce((sum, r) => sum + r.totalTrades, 0),
          sp500Return,
          spiReturn,
          vsSpx: totalWeightedSignalReturn - sp500Return,
          vsSpi: totalWeightedSignalReturn - spiReturn,
        },
        activeWeights: weights,
      };
    }),
});
