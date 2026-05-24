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
import { randomForestSignal } from '../analytics/mlEngine';
import { analyzeSentiment, sentimentToSignalScore } from '../analytics/sentimentEngine';
import { getActiveWeights, type WeightConfig } from '../analytics/optimizerWorker';
import { detectBubble } from '../analytics/lpplsEngine';
import { calculateQualityScore, calculateMomentumScore, extractQualityFromYahoo } from '../analytics/qualityMomentumEngine';

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
 * Enhanced signal generation with ML (Random Forest + Sentiment)
 */
async function enhanceSignalWithML(
  signal: Signal,
  prices: number[],
  volumes: number[],
  fundamentals: any
): Promise<Signal> {
  // Random Forest signal
  try {
    if (prices.length >= 60) {
      const rf = randomForestSignal(prices, volumes, fundamentals);
      signal.rfSignal = rf.signal;
      signal.rfScore = rf.score;
      
      // Adjust signal based on RF
      if (rf.signal === 'strong_buy' && signal.type !== 'buy') {
        signal.criteria.push(`RF: Starkes Kaufsignal (Score ${rf.score})`);
      } else if (rf.signal === 'strong_sell' && signal.type !== 'sell') {
        signal.criteria.push(`RF: Starkes Verkaufssignal (Score ${rf.score})`);
      } else if (rf.signal !== 'hold') {
        signal.criteria.push(`RF: ${rf.signal === 'buy' ? 'Kauf' : 'Verkauf'} (Score ${rf.score})`);
      }
    }
  } catch (e) {
    // RF failed silently
  }
  
  // LPPLS Bubble analysis
  try {
    if (prices.length >= 60) {
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
    }
  } catch (e) {
    // Bubble analysis failed silently
  }

  // Momentum Factor analysis
  try {
    if (prices.length >= 60) {
      const momentumResult = calculateMomentumScore({ prices });
      signal.momentumScore = momentumResult.score;
      signal.momentumGrade = momentumResult.grade;
      if (momentumResult.trend === 'strong_up') {
        signal.criteria.push(`Momentum: Stark aufwärts (Score ${(momentumResult.score * 100).toFixed(0)}%)`);
      } else if (momentumResult.trend === 'strong_down') {
        signal.criteria.push(`Momentum: Stark abwärts (Score ${(momentumResult.score * 100).toFixed(0)}%)`);
      }
    }
  } catch (e) {
    // Momentum analysis failed silently
  }

  // Sentiment analysis (only for first 5 stocks to avoid rate limiting)
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
  
  return signal;
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

      // Load optimized weights (from Signal Auto-Optimizer)
      const optimizedWeights = await getActiveWeights();

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

      // Generate signals using live data + ML enhancement
      const signals: Signal[] = [];
      let sentimentCount = 0; // Limit sentiment calls to avoid rate limiting
      const MAX_SENTIMENT = 5;

      for (const stock of stocks) {
        const liveData = liveDataMap.get(stock.ticker);
        let signal: Signal;
        if (liveData && liveData.currentPrice > 0) {
          signal = generateSignal({
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
          }, optimizedWeights);
        } else {
          // Fallback: use stored data if live fetch fails
          const currentPrice = typeof stock.currentPrice === 'number'
            ? stock.currentPrice
            : parseFloat(stock.currentPrice) || 0;
          signal = generateSignal({
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
          }, optimizedWeights);
        }

        // Quality Factor scoring (uses data already fetched from Yahoo)
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

        // Enhance with ML (RF + Sentiment) - fetch chart data for RF
        try {
          const normalizedTicker = normalizeTicker(stock.ticker);
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

          // Only run sentiment for top stocks (to avoid rate limiting)
          if (sentimentCount < MAX_SENTIMENT) {
            signal = await enhanceSignalWithML(signal, prices, volumes, fundamentals);
            sentimentCount++;
          } else {
            // RF only, no sentiment
            if (prices.length >= 60) {
              const rf = randomForestSignal(prices, volumes, fundamentals);
              signal.rfSignal = rf.signal;
              signal.rfScore = rf.score;
              if (rf.signal === 'strong_buy' || rf.signal === 'strong_sell') {
                signal.criteria.push(`RF: ${rf.signal === 'strong_buy' ? 'Starkes Kaufsignal' : 'Starkes Verkaufssignal'} (Score ${rf.score})`);
              }
            }
          }
          // Momentum Factor scoring (uses prices already fetched for chart)
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
        } catch (e) {
          // ML enhancement failed silently
        }

        signals.push(signal);
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
