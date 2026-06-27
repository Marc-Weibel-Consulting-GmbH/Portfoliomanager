/**
 * Signals Router
 * ==============
 * Generates trading signals based on live Yahoo Finance data.
 * Fetches P/E, PEG, dividend yield, YTD performance, 52-week range
 * from Yahoo Finance quoteSummary and chart endpoints.
 * 
 * P1 Fix: Parallelized signal generation with batched concurrent processing
 * and per-stock timeout to prevent overall request timeout.
 */

import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { eq } from "drizzle-orm";
import { savedPortfolios } from "../../drizzle/schema";
import YahooFinanceClass from "yahoo-finance2";
import { randomForestSignal } from '../analytics/mlEngine';
import { signalForSeries, getActiveSignalModel } from '../analytics/signalService';
import { analyzeSentiment, sentimentToSignalScore } from '../analytics/sentimentEngine';
import { getActiveWeights, type WeightConfig } from '../analytics/optimizerWorker';
import { detectBubble } from '../analytics/lpplsEngine';
import { calculateQualityScore, calculateMomentumScore, extractQualityFromYahoo } from '../analytics/qualityMomentumEngine';
import { runSignalOrchestrator } from '../lib/signals/signalOrchestrator';
import type { PortfolioAction } from '../lib/signals/types';

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
  rfSignal?: string;
  rfScore?: number;
  sentimentScore?: number;
  sentimentLabel?: string;
  bubbleScore?: number;
  bubbleRegime?: string;
  qualityGrade?: string;
  qualityScore?: number;
  momentumGrade?: string;
  momentumScore?: number;
  // Combined Momentum+Quality+LPPL score (same model as tradingview.stockScoring)
  combinedScore?: number;
  combinedSignal?: string;
  overallGrade?: string;
  // Regime-based signal from the new signal framework
  regimeSignal?: PortfolioAction;
}

// Per-stock timeout: 12 seconds max per individual stock processing
const PER_STOCK_TIMEOUT_MS = 12_000;
// Batch size for concurrent processing (9 = 2 batches for 18 stocks)
const BATCH_SIZE = 9;
// Max sentiment analyses to avoid rate limiting
const MAX_SENTIMENT = 5;

/**
 * Wrap a promise with a timeout. Returns the result or null on timeout.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
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
  roe: number | null;
  debtToEquity: number | null;
  fcfYield: number | null;
  grossMargin: number | null;
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
  let roe: number | null = null;
  let debtToEquity: number | null = null;
  let fcfYield: number | null = null;
  let grossMargin: number | null = null;

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

    // Quality metrics extraction
    roe = fd?.returnOnEquity ? fd.returnOnEquity * 100 : null;
    debtToEquity = fd?.debtToEquity ? fd.debtToEquity / 100 : null;
    grossMargin = fd?.grossMargins ? fd.grossMargins * 100 : null;
    if (fd?.freeCashflow && ks?.marketCap) {
      fcfYield = (fd.freeCashflow / ks.marketCap) * 100;
    }
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
    roe,
    debtToEquity,
    fcfYield,
    grossMargin,
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
 * Uses optimized weights from the Signal Auto-Optimizer (if available)
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
}, weights?: WeightConfig): Signal {
  const criteria: string[] = [];
  let score = 0; // Positive = buy, Negative = sell
  
  // Use optimized weights if available (scale factor to convert 0-0.25 weights to integer scores)
  const WEIGHT_SCALE = 12; // Converts weight (0.05-0.25) to score contribution comparable to old system
  const useWeights = !!weights;

  const {
    ticker, companyName, peRatio, pegRatio, dividendYield,
    currentPrice, fiftyTwoWeekHigh, fiftyTwoWeekLow, ytdPerformance, rsi14
  } = data;

  // ── P/E Ratio analysis ──
  if (peRatio !== null && !isNaN(peRatio) && peRatio > 0) {
    const w = useWeights ? weights!.pe * WEIGHT_SCALE : 1;
    if (peRatio < 12) {
      score += 3 * w;
      criteria.push(`Sehr niedriges P/E (${peRatio.toFixed(1)})`);
    } else if (peRatio < 18) {
      score += 1 * w;
      criteria.push(`Moderates P/E (${peRatio.toFixed(1)})`);
    } else if (peRatio > 35) {
      score -= 2 * w;
      criteria.push(`Hohes P/E (${peRatio.toFixed(1)})`);
    } else if (peRatio > 25) {
      score -= 1 * w;
      criteria.push(`Erhöhtes P/E (${peRatio.toFixed(1)})`);
    }
  }

  // ── PEG Ratio analysis ──
  if (pegRatio !== null && !isNaN(pegRatio) && pegRatio > 0) {
    const w = useWeights ? weights!.peg * WEIGHT_SCALE : 1;
    if (pegRatio < 0.8) {
      score += 2 * w;
      criteria.push(`Sehr attraktives PEG (${pegRatio.toFixed(2)})`);
    } else if (pegRatio < 1.2) {
      score += 1 * w;
      criteria.push(`Faires PEG (${pegRatio.toFixed(2)})`);
    } else if (pegRatio > 2.5) {
      score -= 2 * w;
      criteria.push(`Teures PEG (${pegRatio.toFixed(2)})`);
    } else if (pegRatio > 1.8) {
      score -= 1 * w;
      criteria.push(`Erhöhtes PEG (${pegRatio.toFixed(2)})`);
    }
  }

  // ── Dividend Yield analysis ──
  {
    const w = useWeights ? weights!.dividend * WEIGHT_SCALE : 1;
    if (dividendYield > 5) {
      score += 2 * w;
      criteria.push(`Hohe Dividende (${dividendYield.toFixed(1)}%)`);
    } else if (dividendYield > 3) {
      score += 1 * w;
      criteria.push(`Gute Dividende (${dividendYield.toFixed(1)}%)`);
    }
  }

  // ── YTD Performance analysis (contrarian signals) ──
  if (ytdPerformance !== 0 && !isNaN(ytdPerformance)) {
    const w = useWeights ? weights!.ytd * WEIGHT_SCALE : 1;
    if (ytdPerformance < -25) {
      score += 2 * w;
      criteria.push(`Stark überverkauft YTD (${ytdPerformance.toFixed(1)}%)`);
    } else if (ytdPerformance < -15) {
      score += 1 * w;
      criteria.push(`Deutlich gefallen YTD (${ytdPerformance.toFixed(1)}%)`);
    } else if (ytdPerformance > 50) {
      score -= 2 * w;
      criteria.push(`Stark überkauft YTD (${ytdPerformance.toFixed(1)}%)`);
    } else if (ytdPerformance > 35) {
      score -= 1 * w;
      criteria.push(`Stark gestiegen YTD (${ytdPerformance.toFixed(1)}%)`);
    }
  }

  // ── 52-Week Range analysis ──
  if (fiftyTwoWeekHigh && fiftyTwoWeekLow && currentPrice > 0) {
    const w = useWeights ? weights!.week52 * WEIGHT_SCALE : 1;
    const range = fiftyTwoWeekHigh - fiftyTwoWeekLow;
    if (range > 0) {
      const positionInRange = (currentPrice - fiftyTwoWeekLow) / range;
      if (positionInRange < 0.2) {
        score += 2 * w;
        criteria.push(`Nahe 52W-Tief (${(positionInRange * 100).toFixed(0)}% vom Tief)`);
      } else if (positionInRange < 0.35) {
        score += 1 * w;
        criteria.push(`Untere 52W-Range (${(positionInRange * 100).toFixed(0)}%)`);
      } else if (positionInRange > 0.95) {
        score -= 1 * w;
        criteria.push(`Nahe 52W-Hoch (${(positionInRange * 100).toFixed(0)}%)`);
      }
    }
  }

  // ── RSI analysis ──
  if (rsi14 !== null && !isNaN(rsi14)) {
    const w = useWeights ? weights!.rsi * WEIGHT_SCALE : 1;
    if (rsi14 < 30) {
      score += 2 * w;
      criteria.push(`RSI überverkauft (${rsi14.toFixed(0)})`);
    } else if (rsi14 < 40) {
      score += 1 * w;
      criteria.push(`RSI niedrig (${rsi14.toFixed(0)})`);
    } else if (rsi14 > 75) {
      score -= 2 * w;
      criteria.push(`RSI überkauft (${rsi14.toFixed(0)})`);
    } else if (rsi14 > 65) {
      score -= 1 * w;
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

/**
 * Process a single stock completely: fetch data + generate signal + ML enhancement
 * This is the atomic unit of work that runs in parallel.
 */
async function processStock(
  stock: { ticker: string; companyName?: string; currentPrice?: number | string },
  optimizedWeights: WeightConfig | undefined,
  enableSentiment: boolean,
): Promise<Signal> {
  const ticker = stock.ticker;
  const normalizedTicker = normalizeTicker(ticker);

  // Step 1: Fetch live fundamental data
  let liveData: Awaited<ReturnType<typeof fetchLiveData>> | null = null;
  try {
    liveData = await fetchLiveData(ticker);
  } catch (e) {
    console.warn(`[Signals] fetchLiveData failed for ${ticker}:`, (e as Error).message);
  }

  // Step 2: Generate base signal
  let signal: Signal;
  if (liveData && liveData.currentPrice > 0) {
    signal = generateSignal({
      ticker,
      companyName: liveData.companyName || stock.companyName || ticker,
      peRatio: liveData.peRatio,
      pegRatio: liveData.pegRatio,
      dividendYield: liveData.dividendYield,
      currentPrice: liveData.currentPrice,
      fiftyTwoWeekHigh: liveData.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: liveData.fiftyTwoWeekLow,
      ytdPerformance: liveData.ytdPerformance,
      rsi14: liveData.rsi14,
    }, optimizedWeights);
  } else {
    // Fallback: use stored data if live fetch fails
    const currentPrice = typeof stock.currentPrice === 'number'
      ? stock.currentPrice
      : parseFloat(stock.currentPrice as string) || 0;
    signal = generateSignal({
      ticker,
      companyName: stock.companyName || ticker,
      peRatio: null,
      pegRatio: null,
      dividendYield: 0,
      currentPrice,
      fiftyTwoWeekHigh: null,
      fiftyTwoWeekLow: null,
      ytdPerformance: 0,
      rsi14: null,
    }, optimizedWeights);
  }

  // Step 3: Quality Factor scoring
  if (liveData) {
    try {
      const qualityResult = calculateQualityScore({
        roe: liveData.roe,
        debtToEquity: liveData.debtToEquity,
        fcfYield: liveData.fcfYield,
        grossMargin: liveData.grossMargin,
      });
      signal.qualityGrade = qualityResult.grade;
      signal.qualityScore = qualityResult.score;
      if (qualityResult.grade === 'A') {
        signal.criteria.push(`Quality: ${qualityResult.grade} (ROE ${liveData.roe?.toFixed(1) ?? 'N/A'}%, D/E ${liveData.debtToEquity?.toFixed(2) ?? 'N/A'})`);
      } else if (qualityResult.grade === 'F') {
        signal.criteria.push(`Quality: ${qualityResult.grade} - Schwache Fundamentaldaten`);
      }
    } catch (e) {
      // Quality scoring failed silently
    }
  }

  // Step 4: Fetch historical chart data for ML enhancement
  try {
    const chartResult = await yahooFinance.chart(normalizedTicker, {
      period1: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      period2: new Date().toISOString().split('T')[0],
      interval: '1d',
    }) as any;
    const quotes = chartResult.quotes ?? [];
    const prices = quotes.map((q: any) => q.close).filter((c: any) => c != null);
    const volumes = quotes.map((q: any) => q.volume).filter((v: any) => v != null);
    const fundamentals = liveData ? {
      peRatio: liveData.peRatio,
      pegRatio: liveData.pegRatio,
      dividendYield: liveData.dividendYield,
    } : {};

    // Step 5: Random Forest signal
    if (prices.length >= 60) {
      try {
        const rf = await signalForSeries(getActiveSignalModel, () => randomForestSignal(prices, volumes, fundamentals), 'gb_signal', prices);
        signal.rfSignal = rf.signal;
        signal.rfScore = rf.score;
        if (rf.signal === 'strong_buy' || rf.signal === 'strong_sell') {
          signal.criteria.push(`RF: ${rf.signal === 'strong_buy' ? 'Starkes Kaufsignal' : 'Starkes Verkaufssignal'} (Score ${rf.score})`);
        }
      } catch (e) {
        // RF failed silently
      }
    }

    // Step 6: LPPLS Bubble analysis
    if (prices.length >= 60) {
      try {
        const bubbleResult = detectBubble({
          prices,
          sentimentScore: signal.sentimentScore,
          sentimentConfidence: signal.sentimentScore !== undefined ? 0.6 : 0,
        });
        signal.bubbleScore = bubbleResult.bubbleScore;
        signal.bubbleRegime = bubbleResult.regime;

        if (bubbleResult.regime === 'bubble' && bubbleResult.bubbleConfidence > 0.3) {
          signal.criteria.push(`Bubble-Risiko: ${(bubbleResult.bubbleConfidence * 100).toFixed(0)}% Confidence`);
        } else if (bubbleResult.regime === 'negative_bubble' && bubbleResult.negBubbleConfidence > 0.3) {
          signal.criteria.push(`Negative Bubble: Rebound-Chance (${(bubbleResult.negBubbleConfidence * 100).toFixed(0)}%)`);
        }
      } catch (e) {
        // Bubble analysis failed silently
      }
    }

    // Step 7: Momentum Factor scoring
    if (prices.length >= 60) {
      try {
        const momentumResult = calculateMomentumScore(prices);
        signal.momentumGrade = momentumResult.grade;
        signal.momentumScore = momentumResult.score;
        if (momentumResult.grade === 'A') {
          signal.criteria.push(`Momentum: ${momentumResult.grade} (Rel. Stärke ${momentumResult.score.toFixed(0)})`);
        } else if (momentumResult.grade === 'F') {
          signal.criteria.push(`Momentum: ${momentumResult.grade} - Schwaches Momentum`);
        }
      } catch (e) {
        // Momentum scoring failed silently
      }
    }

    // Step 8a: Compute combined Momentum+Quality+LPPL score (same formula as tradingview.stockScoring)
    // This ensures consistency between the Signals page and StockDetail page
    if (signal.momentumScore !== undefined && signal.qualityScore !== undefined) {
      try {
        const mNorm = (signal.momentumScore + 1) / 2; // -1..1 → 0..1
        const qNorm = (signal.qualityScore + 1) / 2;  // -1..1 → 0..1
        const bScore = signal.bubbleScore ?? 0;
        const bRegime = signal.bubbleRegime ?? 'normal';
        const lpplPenalty = bRegime === 'bubble' ? bScore * 0.5 : 0;
        const combined = Math.max(0, Math.min(1, 0.4 * mNorm + 0.4 * qNorm - lpplPenalty));
        signal.combinedScore = parseFloat((combined * 100).toFixed(1));
        signal.overallGrade = combined >= 0.75 ? 'A' : combined >= 0.60 ? 'B' : combined >= 0.45 ? 'C' : combined >= 0.30 ? 'D' : 'F';
        signal.combinedSignal = combined >= 0.70 ? 'STRONG BUY' : combined >= 0.55 ? 'BUY' : combined >= 0.45 ? 'HOLD' : combined >= 0.30 ? 'SELL' : 'STRONG SELL';
        // Override the legacy signal type with the combined model for consistency
        if (signal.combinedSignal === 'STRONG BUY' || signal.combinedSignal === 'BUY') {
          signal.type = 'buy';
          signal.strength = signal.combinedSignal === 'STRONG BUY' ? 'strong' : 'moderate';
        } else if (signal.combinedSignal === 'STRONG SELL' || signal.combinedSignal === 'SELL') {
          signal.type = 'sell';
          signal.strength = signal.combinedSignal === 'STRONG SELL' ? 'strong' : 'moderate';
        } else {
          signal.type = 'hold';
          signal.strength = 'moderate';
        }
      } catch (e) {
        // Combined scoring failed silently
      }
    }

    // Step 8b: Regime-based signal via signalOrchestrator
    if (prices.length >= 60) {
      try {
        const lpplRisk = signal.bubbleScore !== undefined
          ? { bubbleScore: signal.bubbleScore, regime: signal.bubbleRegime ?? 'normal', confidence: 0.6 }
          : null;
        signal.regimeSignal = runSignalOrchestrator({
          ticker,
          marketType: 'single_stock',
          prices,
          dates: [],
          lpplRisk: signal.bubbleScore ?? null,
          qualityScore: signal.qualityScore ?? null,
          momentumScore: signal.momentumScore ?? null,
        });
      } catch (e) {
        // Regime signal failed silently
      }
    }

    // Step 8: Sentiment analysis (only if enabled for this stock)
    if (enableSentiment) {
      try {
        const sentiment = await analyzeSentiment(signal.ticker, signal.companyName);
        if (sentiment.newsCount > 0 && sentiment.confidence > 0.3) {
          signal.sentimentScore = sentiment.score;
          signal.sentimentLabel = sentiment.sentiment;
          const sentContrib = sentimentToSignalScore(sentiment);
          if (Math.abs(sentContrib) >= 1) {
            signal.criteria.push(
              `Sentiment: ${sentiment.sentiment === 'bullish' ? 'Positiv' : sentiment.sentiment === 'bearish' ? 'Negativ' : 'Neutral'} (${sentiment.score > 0 ? '+' : ''}${sentiment.score})`
            );
          }
        }
      } catch (e) {
        // Sentiment failed silently
      }
    }
  } catch (e) {
    // Chart/ML enhancement failed silently — signal still has base data
    console.warn(`[Signals] ML enhancement failed for ${ticker}:`, (e as Error).message);
  }

  return signal;
}

export const signalsRouter = router({
  /**
   * Get regime-based signal for a single ticker (on-demand, for StockDetail page)
   */
  getRegimeSignal: protectedProcedure
    .input(z.object({ ticker: z.string() }))
    .query(async ({ input }) => {
      const ticker = input.ticker;
      const normalizedTicker = normalizeTicker(ticker);
      try {
        const chartResult = await yahooFinance.chart(normalizedTicker, {
          period1: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          period2: new Date().toISOString().split('T')[0],
          interval: '1d',
        }) as any;
        const quotes = chartResult.quotes ?? [];
        const prices: number[] = quotes.map((q: any) => q.close).filter((c: any) => c != null);
        if (prices.length < 60) return null;

        // Quick quality + momentum for regime context
        const { score: momentumScore } = calculateMomentumScore({ prices });
        const bubbleResult = detectBubble({ prices });

        return runSignalOrchestrator({
          ticker,
          marketType: 'single_stock',
          prices,
          dates: [],
          lpplRisk: bubbleResult.bubbleScore ?? null,
          momentumScore,
          qualityScore: null,
        });
      } catch (e) {
        console.warn(`[signals.getRegimeSignal] Failed for ${ticker}:`, (e as Error).message);
        return null;
      }
    }),

  /**
   * Generate trading signals for a portfolio using LIVE Yahoo Finance data
   * 
   * P1 Fix: Fully parallelized with batched concurrent processing.
   * Each stock is processed independently with a per-stock timeout.
   * Batch size of 6 concurrent stocks prevents rate limiting.
   * Total expected time: ~15-20s for 18 stocks (vs. >60s sequential).
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

      // Load optimized weights (from Signal Auto-Optimizer)
      const optimizedWeights = await getActiveWeights();

      // Parse portfolio data to get ticker list
      const portfolioData = JSON.parse(portfolio.portfolioData);
      const stocks = portfolioData.stocks || [];

      console.log(`[Signals] Processing ${stocks.length} stocks in parallel (batch size ${BATCH_SIZE})...`);
      const startTime = Date.now();

      // Process all stocks in parallel batches with per-stock timeout
      const signals: Signal[] = [];
      let sentimentCount = 0;

      for (let i = 0; i < stocks.length; i += BATCH_SIZE) {
        const batch = stocks.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.allSettled(
          batch.map((stock: any, batchIdx: number) => {
            // Only enable sentiment for first MAX_SENTIMENT stocks total
            const globalIdx = i + batchIdx;
            const enableSentiment = globalIdx < MAX_SENTIMENT;
            
            // Wrap each stock processing with a timeout
            return withTimeout(
              processStock(stock, optimizedWeights, enableSentiment),
              PER_STOCK_TIMEOUT_MS
            );
          })
        );

        // Collect results from this batch
        for (let j = 0; j < batchResults.length; j++) {
          const result = batchResults[j];
          const stock = batch[j];
          
          if (result.status === "fulfilled" && result.value !== null) {
            signals.push(result.value);
          } else {
            // Stock timed out or failed — create a minimal fallback signal
            const reason = result.status === "rejected" 
              ? `Fehler: ${(result.reason as Error)?.message || 'Unbekannt'}`
              : 'Timeout bei Datenabfrage';
            console.warn(`[Signals] ${stock.ticker}: ${reason}`);
            
            const currentPrice = typeof stock.currentPrice === 'number'
              ? stock.currentPrice
              : parseFloat(stock.currentPrice) || 0;
            
            signals.push({
              ticker: stock.ticker,
              companyName: stock.companyName || stock.ticker,
              type: "hold",
              strength: "weak",
              currentPrice,
              targetPrice: currentPrice,
              peRatio: null,
              pegRatio: null,
              dividendYield: 0,
              ytdPerformance: 0,
              fiftyTwoWeekHigh: null,
              fiftyTwoWeekLow: null,
              rsi14: null,
              reason: `Daten konnten nicht vollständig geladen werden (${reason}). Bitte später erneut versuchen.`,
              criteria: [`⚠️ ${reason}`],
            });
          }
        }
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[Signals] Completed ${signals.length}/${stocks.length} stocks in ${elapsed}s`);

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
