/**
 * Prediction Router - ML-based price predictions
 */
import { z } from 'zod';
import { protectedProcedure, router } from '../_core/trpc';
import { generatePricePrediction, randomForestSignal } from '../analytics/mlEngine';
import { signalForSeries, getActiveSignalModel } from '../analytics/signalService';
import { analyzeSentiment, batchSentimentAnalysis, sentimentToSignalScore } from '../analytics/sentimentEngine';
import { detectBubble, calculatePortfolioBubbleExposure } from '../analytics/lpplsEngine';
import YahooFinance from 'yahoo-finance2';

const yf = new YahooFinance();

// Normalize ticker for Yahoo Finance (strip .US suffix, keep .SW etc.)
function normalizeForYahoo(ticker: string): string {
  if (ticker.endsWith('.US')) return ticker.replace('.US', '');
  return ticker;
}

export const predictionRouter = router({
  /**
   * Get price prediction for a single stock
   */
  predict: protectedProcedure
    .input(z.object({ ticker: z.string() }))
    .query(async ({ input }) => {
      const yahooTicker = normalizeForYahoo(input.ticker);
      
      try {
        // Fetch 2 years of historical data for better predictions
        const endDate = new Date();
        const startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 2);
        
        const chart = await (yf as any).chart(yahooTicker, {
          period1: startDate.toISOString().split('T')[0],
          period2: endDate.toISOString().split('T')[0],
          interval: '1d',
        });
        
        if (!chart || !chart.quotes || chart.quotes.length < 60) {
          return { error: 'Nicht genügend historische Daten', prediction: null, rfSignal: null };
        }
        
        const prices = chart.quotes
          .filter((q: any) => q.close != null)
          .map((q: any) => q.close as number);
        
        const volumes = chart.quotes
          .filter((q: any) => q.close != null)
          .map((q: any) => (q.volume as number) || 0);
        
        const currentPrice = prices[prices.length - 1];
        
        // Get fundamentals for Random Forest
        let fundamentals: any = {};
        try {
          const quote = await (yf as any).quoteSummary(yahooTicker, {
            modules: ['defaultKeyStatistics', 'summaryDetail'],
          });
          fundamentals = {
            peRatio: quote?.summaryDetail?.trailingPE || quote?.defaultKeyStatistics?.forwardPE || undefined,
            pegRatio: quote?.defaultKeyStatistics?.pegRatio || undefined,
            dividendYield: (quote?.summaryDetail?.dividendYield || 0) * 100,
            beta: quote?.defaultKeyStatistics?.beta || 1,
          };
        } catch (e) {
          // Use defaults
        }
        
        // Generate predictions
        const prediction = generatePricePrediction(input.ticker, prices, currentPrice);
        
        // Generate signal: active GB model if promoted, else RandomForest fallback.
        const rfSignal = await signalForSeries(getActiveSignalModel, () => randomForestSignal(prices, volumes, fundamentals), 'gb_signal', prices);
        
        return {
          error: null,
          prediction,
          rfSignal,
          ticker: input.ticker,
          yahooTicker,
          currency: chart.meta?.currency || 'USD',
        };
      } catch (error) {
        // Try with .SW suffix for Swiss stocks
        if (!yahooTicker.includes('.')) {
          try {
            const swTicker = yahooTicker + '.SW';
            const endDate = new Date();
            const startDate = new Date();
            startDate.setFullYear(startDate.getFullYear() - 2);
            
            const chart = await (yf as any).chart(swTicker, {
              period1: startDate.toISOString().split('T')[0],
              period2: endDate.toISOString().split('T')[0],
              interval: '1d',
            });
            
            if (!chart || !chart.quotes || chart.quotes.length < 60) {
              return { error: 'Nicht genügend historische Daten', prediction: null, rfSignal: null };
            }
            
            const prices = chart.quotes
              .filter((q: any) => q.close != null)
              .map((q: any) => q.close as number);
            
            const volumes = chart.quotes
              .filter((q: any) => q.close != null)
              .map((q: any) => (q.volume as number) || 0);
            
            const currentPrice = prices[prices.length - 1];
            
            let fundamentals: any = {};
            try {
              const quote = await (yf as any).quoteSummary(swTicker, {
                modules: ['defaultKeyStatistics', 'summaryDetail'],
              });
              fundamentals = {
                peRatio: quote?.summaryDetail?.trailingPE || quote?.defaultKeyStatistics?.forwardPE || undefined,
                pegRatio: quote?.defaultKeyStatistics?.pegRatio || undefined,
                dividendYield: (quote?.summaryDetail?.dividendYield || 0) * 100,
                beta: quote?.defaultKeyStatistics?.beta || 1,
              };
            } catch (e) {}
            
            const prediction = generatePricePrediction(input.ticker, prices, currentPrice);
            const rfSignal = await signalForSeries(getActiveSignalModel, () => randomForestSignal(prices, volumes, fundamentals), 'gb_signal', prices);
            
            return {
              error: null,
              prediction,
              rfSignal,
              ticker: input.ticker,
              yahooTicker: swTicker,
              currency: chart.meta?.currency || 'CHF',
            };
          } catch (e2) {
            return { error: 'Ticker nicht gefunden: ' + input.ticker, prediction: null, rfSignal: null };
          }
        }
        return { error: 'Fehler bei Datenabfrage: ' + (error as Error).message, prediction: null, rfSignal: null };
      }
    }),

  /**
   * Sentiment analysis for a single stock
   */
  sentiment: protectedProcedure
    .input(z.object({ ticker: z.string(), companyName: z.string().optional() }))
    .query(async ({ input }) => {
      const yahooTicker = normalizeForYahoo(input.ticker);
      return analyzeSentiment(yahooTicker, input.companyName);
    }),

  /**
   * Batch sentiment for multiple tickers
   */
  batchSentiment: protectedProcedure
    .input(z.object({ tickers: z.array(z.object({ ticker: z.string(), companyName: z.string().optional() })).max(10) }))
    .query(async ({ input }) => {
      const normalized = input.tickers.map(t => ({
        ticker: normalizeForYahoo(t.ticker),
        companyName: t.companyName,
      }));
      return batchSentimentAnalysis(normalized);
    }),

  /**
   * LPPLS Bubble Analysis for a single stock
   */
  bubbleAnalysis: protectedProcedure
    .input(z.object({ ticker: z.string() }))
    .query(async ({ input }) => {
      const yahooTicker = normalizeForYahoo(input.ticker);
      
      try {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 2);
        
        let chart: any;
        let resolvedTicker = yahooTicker;
        try {
          chart = await (yf as any).chart(resolvedTicker, {
            period1: startDate.toISOString().split('T')[0],
            period2: endDate.toISOString().split('T')[0],
            interval: '1d',
          });
        } catch {
          if (!resolvedTicker.includes('.')) {
            resolvedTicker = resolvedTicker + '.SW';
            chart = await (yf as any).chart(resolvedTicker, {
              period1: startDate.toISOString().split('T')[0],
              period2: endDate.toISOString().split('T')[0],
              interval: '1d',
            });
          }
        }
        
        if (!chart || !chart.quotes || chart.quotes.length < 60) {
          return { error: 'Nicht genügend Daten für Bubble-Analyse', result: null };
        }
        
        const prices = chart.quotes
          .filter((q: any) => q.close != null)
          .map((q: any) => q.close as number);
        
        const dates = chart.quotes
          .filter((q: any) => q.close != null)
          .map((q: any) => new Date(q.date));
        
        const result = detectBubble({ prices, dates });
        
        return {
          error: null,
          result,
          ticker: input.ticker,
          yahooTicker: resolvedTicker,
        };
      } catch (error) {
        return { error: 'Fehler bei Bubble-Analyse: ' + (error as Error).message, result: null };
      }
    }),

  /**
   * Portfolio-level bubble exposure
   */
  portfolioBubbleExposure: protectedProcedure
    .input(z.object({
      holdings: z.array(z.object({
        ticker: z.string(),
        weight: z.number(), // 0-1 portfolio weight
      })).max(50),
    }))
    .query(async ({ input }) => {
      const holdingsWithBubble: Array<{ ticker: string; weight: number; bubbleConfidence: number }> = [];
      
      for (const holding of input.holdings) {
        const yahooTicker = normalizeForYahoo(holding.ticker);
        let bubbleConfidence = 0;
        
        try {
          const endDate = new Date();
          const startDate = new Date();
          startDate.setFullYear(startDate.getFullYear() - 2);
          
          let chart: any;
          let resolvedTicker = yahooTicker;
          try {
            chart = await (yf as any).chart(resolvedTicker, {
              period1: startDate.toISOString().split('T')[0],
              period2: endDate.toISOString().split('T')[0],
              interval: '1d',
            });
          } catch {
            if (!resolvedTicker.includes('.')) {
              resolvedTicker = resolvedTicker + '.SW';
              chart = await (yf as any).chart(resolvedTicker, {
                period1: startDate.toISOString().split('T')[0],
                period2: endDate.toISOString().split('T')[0],
                interval: '1d',
              });
            }
          }
          
          if (chart && chart.quotes && chart.quotes.length >= 60) {
            const prices = chart.quotes
              .filter((q: any) => q.close != null)
              .map((q: any) => q.close as number);
            
            const result = detectBubble({ prices });
            bubbleConfidence = result.bubbleConfidence;
          }
        } catch {
          // Use 0 confidence if analysis fails
        }
        
        holdingsWithBubble.push({
          ticker: holding.ticker,
          weight: holding.weight,
          bubbleConfidence,
        });
        
        // Rate limiting
        await new Promise(r => setTimeout(r, 300));
      }
      
      const exposure = calculatePortfolioBubbleExposure(holdingsWithBubble);
      return { ...exposure, holdings: holdingsWithBubble };
    }),

  /**
   * Get active ML model info (no blob) - for transparency panel shown to all users.
   * Returns null if no model is promoted yet.
   */
  getActiveModelInfo: protectedProcedure
    .query(async () => {
      try {
        const { getDb } = await import('../db');
        const { modelArtifacts } = await import('../../drizzle/schema');
        const { eq } = await import('drizzle-orm');
        const db = await getDb();
        if (!db) return { model: null };

        const rows = await db
          .select({
            id: modelArtifacts.id,
            kind: modelArtifacts.kind,
            version: modelArtifacts.version,
            status: modelArtifacts.status,
            trainStart: modelArtifacts.trainStart,
            trainEnd: modelArtifacts.trainEnd,
            universeSize: modelArtifacts.universeSize,
            metrics: modelArtifacts.metrics,
            promotedAt: modelArtifacts.promotedAt,
            createdAt: modelArtifacts.createdAt,
            // modelBlob intentionally omitted
          })
          .from(modelArtifacts)
          .where(eq(modelArtifacts.status, 'active'))
          .limit(1);

        if (rows.length === 0) return { model: null };

        const row = rows[0];
        // Parse metrics JSON if stored as string
        let metrics: Record<string, number> = {};
        try {
          metrics = typeof row.metrics === 'string' ? JSON.parse(row.metrics) : (row.metrics as any) ?? {};
        } catch { /* ignore */ }

        return {
          model: {
            version: row.version,
            kind: row.kind,
            trainStart: row.trainStart,
            trainEnd: row.trainEnd,
            universeSize: row.universeSize,
            promotedAt: row.promotedAt,
            hitRate: metrics.hit_rate ?? metrics.hitRate ?? null,
            alpha: metrics.alpha ?? null,
            overfitRatio: metrics.overfit_ratio ?? metrics.overfitRatio ?? null,
          },
        };
      } catch (e) {
        return { model: null };
      }
    }),

  /**
   * Batch prediction for portfolio stocks
   */
  portfolioPredictions: protectedProcedure
    .input(z.object({ tickers: z.array(z.string()).max(20) }))
    .query(async ({ input }) => {
      const results: Array<{
        ticker: string;
        currentPrice: number;
        predicted30d: number;
        predicted90d: number;
        trend: string;
        confidence: number;
        rfSignal: string;
        rfScore: number;
      }> = [];
      
      for (const ticker of input.tickers) {
        const yahooTicker = normalizeForYahoo(ticker);
        let resolvedTicker = yahooTicker;
        
        try {
          const endDate = new Date();
          const startDate = new Date();
          startDate.setFullYear(startDate.getFullYear() - 2);
          
          let chart: any;
          try {
            chart = await (yf as any).chart(resolvedTicker, {
              period1: startDate.toISOString().split('T')[0],
              period2: endDate.toISOString().split('T')[0],
              interval: '1d',
            });
          } catch {
            // Try .SW suffix
            if (!resolvedTicker.includes('.')) {
              resolvedTicker = resolvedTicker + '.SW';
              chart = await (yf as any).chart(resolvedTicker, {
                period1: startDate.toISOString().split('T')[0],
                period2: endDate.toISOString().split('T')[0],
                interval: '1d',
              });
            }
          }
          
          if (!chart || !chart.quotes || chart.quotes.length < 60) continue;
          
          const prices = chart.quotes
            .filter((q: any) => q.close != null)
            .map((q: any) => q.close as number);
          
          const volumes = chart.quotes
            .filter((q: any) => q.close != null)
            .map((q: any) => (q.volume as number) || 0);
          
          const currentPrice = prices[prices.length - 1];
          const prediction = generatePricePrediction(ticker, prices, currentPrice);
          const rfSignal = await signalForSeries(getActiveSignalModel, () => randomForestSignal(prices, volumes, {}), 'gb_signal', prices);
          
          results.push({
            ticker,
            currentPrice,
            predicted30d: prediction.predictions.days30.predictedPrice,
            predicted90d: prediction.predictions.days90.predictedPrice,
            trend: prediction.predictions.days30.trend,
            confidence: prediction.predictions.days30.confidence,
            rfSignal: rfSignal.signal,
            rfScore: rfSignal.score,
          });
        } catch (e) {
          // Skip failed tickers
        }
        
        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 200));
      }
      
      return results;
    }),
});
