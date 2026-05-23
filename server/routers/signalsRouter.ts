/**
 * Signals Router
 * ==============
 * Generates trading signals based on live Yahoo Finance data.
 * Fetches P/E, PEG, dividend yield, YTD performance, 52-week range
 * from Yahoo Finance quoteSummary and chart endpoints.
 */

import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { eq } from "drizzle-orm";
import { savedPortfolios } from "../../drizzle/schema";
import YahooFinanceClass from "yahoo-finance2";

// yahoo-finance2 v3: default export is a constructor class
const yahooFinance = new (YahooFinanceClass as any)();

type SignalType = "buy" | "sell" | "hold";
type SignalStrength = "strong" | "moderate" | "weak";

interface Signal {
  ticker: string;
  companyName: string;
  type: SignalType;
  strength: SignalStrength;
  currentPrice: number;
  targetPrice: number;
  peRatio: number | null;
  pegRatio: number | null;
  dividendYield: number;
  ytdPerformance: number;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  rsi14: number | null;
  reason: string;
  criteria: string[];
}

/**
 * Normalize ticker: strip .US suffix for US stocks, keep .SW for Swiss
 */
function normalizeTicker(ticker: string): string {
  if (ticker.endsWith(".US")) return ticker.slice(0, -3);
  return ticker;
}

/**
 * Fetch live fundamental data from Yahoo Finance for a single ticker
 */
async function fetchLiveData(ticker: string): Promise<{
  peRatio: number | null;
  pegRatio: number | null;
  dividendYield: number;
  currentPrice: number;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  ytdPerformance: number;
  rsi14: number | null;
  companyName: string;
}> {
  const normalizedTicker = normalizeTicker(ticker);
  
  let peRatio: number | null = null;
  let pegRatio: number | null = null;
  let dividendYield = 0;
  let currentPrice = 0;
  let fiftyTwoWeekHigh: number | null = null;
  let fiftyTwoWeekLow: number | null = null;
  let ytdPerformance = 0;
  let rsi14: number | null = null;
  let companyName = ticker;

  try {
    // Fetch quoteSummary for fundamentals
    const summary = await yahooFinance.quoteSummary(normalizedTicker, {
      modules: ["summaryDetail", "defaultKeyStatistics", "financialData", "price"],
    }) as any;

    const sd = summary.summaryDetail;
    const ks = summary.defaultKeyStatistics;
    const fd = summary.financialData;
    const price = summary.price;

    // Extract fundamentals
    peRatio = sd?.trailingPE ?? ((fd?.currentPrice && fd?.earningsPerShare) 
      ? fd.currentPrice / fd.earningsPerShare : null);
    pegRatio = ks?.pegRatio ?? null;
    dividendYield = (sd?.dividendYield ?? 0) * 100; // Convert from decimal to percentage
    currentPrice = fd?.currentPrice ?? sd?.regularMarketPrice ?? price?.regularMarketPrice ?? 0;
    fiftyTwoWeekHigh = sd?.fiftyTwoWeekHigh ?? null;
    fiftyTwoWeekLow = sd?.fiftyTwoWeekLow ?? null;
    companyName = price?.longName ?? price?.shortName ?? ticker;
  } catch (err) {
    console.warn(`[Signals] quoteSummary failed for ${normalizedTicker}:`, (err as Error).message);
  }

  // Fetch YTD performance from chart data
  try {
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);
    
    const chartResult = await yahooFinance.chart(normalizedTicker, {
      period1: yearStart.toISOString().split("T")[0],
      period2: now.toISOString().split("T")[0],
      interval: "1d",
    }) as any;

    const quotes = chartResult.quotes ?? [];
    if (quotes.length > 1) {
      const firstClose = quotes[0]?.close;
      const lastClose = quotes[quotes.length - 1]?.close;
      if (firstClose && lastClose && firstClose > 0) {
        ytdPerformance = ((lastClose - firstClose) / firstClose) * 100;
      }
      // Use last close as current price if not available from summary
      if (currentPrice === 0 && lastClose) {
        currentPrice = lastClose;
      }

      // Calculate RSI-14 from chart data
      if (quotes.length >= 15) {
        rsi14 = calcRSI(quotes.map((q: any) => q.close).filter((c: any) => c != null), 14);
      }
    }
  } catch (err) {
    console.warn(`[Signals] chart failed for ${normalizedTicker}:`, (err as Error).message);
  }

  return {
    peRatio,
    pegRatio,
    dividendYield,
    currentPrice,
    fiftyTwoWeekHigh,
    fiftyTwoWeekLow,
    ytdPerformance,
    rsi14,
    companyName,
  };
}

/**
 * Calculate RSI (Relative Strength Index) from closing prices
 */
function calcRSI(prices: number[], period: number = 14): number | null {
  if (prices.length < period + 1) return null;

  // Calculate price changes
  const changes: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }

  // Use last `period * 3` changes for a more stable RSI (or all if less)
  const relevantChanges = changes.slice(-period * 3);
  if (relevantChanges.length < period) return null;

  // Initial average gain/loss
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    if (relevantChanges[i] > 0) avgGain += relevantChanges[i];
    else avgLoss += Math.abs(relevantChanges[i]);
  }
  avgGain /= period;
  avgLoss /= period;

  // Smoothed RSI using Wilder's method
  for (let i = period; i < relevantChanges.length; i++) {
    const change = relevantChanges[i];
    if (change > 0) {
      avgGain = (avgGain * (period - 1) + change) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
    }
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/**
 * Generate trading signal based on live fundamental + technical data
 */
function generateSignal(data: {
  ticker: string;
  companyName: string;
  peRatio: number | null;
  pegRatio: number | null;
  dividendYield: number;
  currentPrice: number;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  ytdPerformance: number;
  rsi14: number | null;
}): Signal {
  const criteria: string[] = [];
  let score = 0; // Positive = buy, Negative = sell

  const {
    ticker, companyName, peRatio, pegRatio, dividendYield,
    currentPrice, fiftyTwoWeekHigh, fiftyTwoWeekLow, ytdPerformance, rsi14
  } = data;

  // ── P/E Ratio analysis ──
  if (peRatio !== null && !isNaN(peRatio) && peRatio > 0) {
    if (peRatio < 12) {
      score += 3;
      criteria.push(`Sehr niedriges P/E (${peRatio.toFixed(1)})`);
    } else if (peRatio < 18) {
      score += 1;
      criteria.push(`Moderates P/E (${peRatio.toFixed(1)})`);
    } else if (peRatio > 35) {
      score -= 2;
      criteria.push(`Hohes P/E (${peRatio.toFixed(1)})`);
    } else if (peRatio > 25) {
      score -= 1;
      criteria.push(`Erhöhtes P/E (${peRatio.toFixed(1)})`);
    }
  }

  // ── PEG Ratio analysis ──
  if (pegRatio !== null && !isNaN(pegRatio) && pegRatio > 0) {
    if (pegRatio < 0.8) {
      score += 2;
      criteria.push(`Sehr attraktives PEG (${pegRatio.toFixed(2)})`);
    } else if (pegRatio < 1.2) {
      score += 1;
      criteria.push(`Faires PEG (${pegRatio.toFixed(2)})`);
    } else if (pegRatio > 2.5) {
      score -= 2;
      criteria.push(`Teures PEG (${pegRatio.toFixed(2)})`);
    } else if (pegRatio > 1.8) {
      score -= 1;
      criteria.push(`Erhöhtes PEG (${pegRatio.toFixed(2)})`);
    }
  }

  // ── Dividend Yield analysis ──
  if (dividendYield > 5) {
    score += 2;
    criteria.push(`Hohe Dividende (${dividendYield.toFixed(1)}%)`);
  } else if (dividendYield > 3) {
    score += 1;
    criteria.push(`Gute Dividende (${dividendYield.toFixed(1)}%)`);
  }

  // ── YTD Performance analysis (contrarian signals) ──
  if (ytdPerformance !== 0 && !isNaN(ytdPerformance)) {
    if (ytdPerformance < -25) {
      score += 2;
      criteria.push(`Stark überverkauft YTD (${ytdPerformance.toFixed(1)}%)`);
    } else if (ytdPerformance < -15) {
      score += 1;
      criteria.push(`Deutlich gefallen YTD (${ytdPerformance.toFixed(1)}%)`);
    } else if (ytdPerformance > 50) {
      score -= 2;
      criteria.push(`Stark überkauft YTD (${ytdPerformance.toFixed(1)}%)`);
    } else if (ytdPerformance > 35) {
      score -= 1;
      criteria.push(`Stark gestiegen YTD (${ytdPerformance.toFixed(1)}%)`);
    }
  }

  // ── 52-Week Range analysis ──
  if (fiftyTwoWeekHigh && fiftyTwoWeekLow && currentPrice > 0) {
    const range = fiftyTwoWeekHigh - fiftyTwoWeekLow;
    if (range > 0) {
      const positionInRange = (currentPrice - fiftyTwoWeekLow) / range;
      if (positionInRange < 0.2) {
        score += 2;
        criteria.push(`Nahe 52W-Tief (${(positionInRange * 100).toFixed(0)}% vom Tief)`);
      } else if (positionInRange < 0.35) {
        score += 1;
        criteria.push(`Untere 52W-Range (${(positionInRange * 100).toFixed(0)}%)`);
      } else if (positionInRange > 0.95) {
        score -= 1;
        criteria.push(`Nahe 52W-Hoch (${(positionInRange * 100).toFixed(0)}%)`);
      }
    }
  }

  // ── RSI analysis ──
  if (rsi14 !== null && !isNaN(rsi14)) {
    if (rsi14 < 30) {
      score += 2;
      criteria.push(`RSI überverkauft (${rsi14.toFixed(0)})`);
    } else if (rsi14 < 40) {
      score += 1;
      criteria.push(`RSI niedrig (${rsi14.toFixed(0)})`);
    } else if (rsi14 > 75) {
      score -= 2;
      criteria.push(`RSI überkauft (${rsi14.toFixed(0)})`);
    } else if (rsi14 > 65) {
      score -= 1;
      criteria.push(`RSI hoch (${rsi14.toFixed(0)})`);
    }
  }

  // ── Determine signal type and strength ──
  let type: SignalType;
  let strength: SignalStrength;
  let reason: string;
  let targetPrice: number;

  if (score >= 5) {
    type = "buy";
    strength = "strong";
    reason = "Starke Kaufgelegenheit: Mehrere fundamentale und technische Indikatoren deuten auf eine deutliche Unterbewertung hin.";
    targetPrice = currentPrice * 1.20;
  } else if (score >= 3) {
    type = "buy";
    strength = "moderate";
    reason = "Moderate Kaufgelegenheit: Die Bewertung ist attraktiv und einige Indikatoren sprechen für einen Einstieg.";
    targetPrice = currentPrice * 1.12;
  } else if (score >= 1) {
    type = "buy";
    strength = "weak";
    reason = "Leichte Kauftendenz: Einzelne positive Signale vorhanden, aber keine starke Überzeugung.";
    targetPrice = currentPrice * 1.06;
  } else if (score <= -5) {
    type = "sell";
    strength = "strong";
    reason = "Starkes Verkaufssignal: Überbewertung und technische Schwäche deuten auf Korrekturbedarf hin. Gewinnmitnahme empfohlen.";
    targetPrice = currentPrice * 0.85;
  } else if (score <= -3) {
    type = "sell";
    strength = "moderate";
    reason = "Moderates Verkaufssignal: Bewertung erscheint überzogen. Position reduzieren oder eng absichern.";
    targetPrice = currentPrice * 0.92;
  } else if (score <= -1) {
    type = "sell";
    strength = "weak";
    reason = "Leichte Verkaufstendenz: Einige Warnsignale erkennbar. Überwachung empfohlen.";
    targetPrice = currentPrice * 0.96;
  } else {
    type = "hold";
    strength = "moderate";
    reason = "Neutrale Bewertung: Aktuelle Position beibehalten und Entwicklung beobachten.";
    targetPrice = currentPrice;
  }

  return {
    ticker,
    companyName,
    type,
    strength,
    currentPrice,
    targetPrice,
    peRatio,
    pegRatio,
    dividendYield,
    ytdPerformance,
    fiftyTwoWeekHigh,
    fiftyTwoWeekLow,
    rsi14,
    reason,
    criteria,
  };
}

export const signalsRouter = router({
  /**
   * Generate trading signals for a portfolio using LIVE Yahoo Finance data
   */
  generate: protectedProcedure
    .input(z.object({
      portfolioId: z.number()
    }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      // Fetch portfolio
      const [portfolio] = await db
        .select()
        .from(savedPortfolios)
        .where(eq(savedPortfolios.id, input.portfolioId))
        .limit(1);

      if (!portfolio) {
        throw new Error("Portfolio not found");
      }

      // Parse portfolio data to get ticker list
      const portfolioData = JSON.parse(portfolio.portfolioData);
      const stocks = portfolioData.stocks || [];

      // Fetch live data for all tickers in parallel (with concurrency limit)
      const tickers = stocks.map((s: any) => s.ticker as string);
      const BATCH_SIZE = 5; // Limit concurrent requests to avoid rate limiting
      const liveDataMap = new Map<string, Awaited<ReturnType<typeof fetchLiveData>>>();

      for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
        const batch = tickers.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map(async (ticker: string) => {
            const data = await fetchLiveData(ticker);
            return { ticker, data };
          })
        );
        for (const result of results) {
          if (result.status === "fulfilled") {
            liveDataMap.set(result.value.ticker, result.value.data);
          }
        }
      }

      // Generate signals using live data
      const signals: Signal[] = [];
      for (const stock of stocks) {
        const liveData = liveDataMap.get(stock.ticker);
        if (liveData && liveData.currentPrice > 0) {
          signals.push(generateSignal({
            ticker: stock.ticker,
            companyName: liveData.companyName || stock.companyName || stock.ticker,
            peRatio: liveData.peRatio,
            pegRatio: liveData.pegRatio,
            dividendYield: liveData.dividendYield,
            currentPrice: liveData.currentPrice,
            fiftyTwoWeekHigh: liveData.fiftyTwoWeekHigh,
            fiftyTwoWeekLow: liveData.fiftyTwoWeekLow,
            ytdPerformance: liveData.ytdPerformance,
            rsi14: liveData.rsi14,
          }));
        } else {
          // Fallback: use stored data if live fetch fails
          const currentPrice = typeof stock.currentPrice === 'number'
            ? stock.currentPrice
            : parseFloat(stock.currentPrice) || 0;
          signals.push(generateSignal({
            ticker: stock.ticker,
            companyName: stock.companyName || stock.ticker,
            peRatio: null,
            pegRatio: null,
            dividendYield: 0,
            currentPrice,
            fiftyTwoWeekHigh: null,
            fiftyTwoWeekLow: null,
            ytdPerformance: 0,
            rsi14: null,
          }));
        }
      }

      // Sort by signal strength and type (strong buy first, then moderate buy, etc.)
      const signalOrder: Record<string, number> = { buy: 0, hold: 1, sell: 2 };
      const strengthOrder: Record<string, number> = { strong: 0, moderate: 1, weak: 2 };

      signals.sort((a, b) => {
        if (signalOrder[a.type] !== signalOrder[b.type]) {
          return signalOrder[a.type] - signalOrder[b.type];
        }
        return strengthOrder[a.strength] - strengthOrder[b.strength];
      });

      return signals;
    })
});
