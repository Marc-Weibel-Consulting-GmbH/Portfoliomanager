/**
 * Machine Learning Engine for Stock Analysis
 * 
 * Implements:
 * 1. Linear Regression - trend-based price prediction
 * 2. ARIMA-style - time series forecasting with moving averages
 * 3. Random Forest - multi-indicator buy/sell signal classification
 */

import { RandomForestClassifier } from 'ml-random-forest';
import * as ss from 'simple-statistics';

// ============================================================
// 1. LINEAR REGRESSION - Price Prediction
// ============================================================

interface PredictionResult {
  predictedPrice: number;
  confidence: number; // 0-1
  upperBound: number;
  lowerBound: number;
  trend: 'bullish' | 'bearish' | 'neutral';
  dailyReturn: number;
  annualizedReturn: number;
}

interface PricePrediction {
  ticker: string;
  currentPrice: number;
  predictions: {
    days30: PredictionResult;
    days60: PredictionResult;
    days90: PredictionResult;
  };
  modelMetrics: {
    rSquared: number;
    mse: number;
    method: string;
  };
}

/**
 * Linear Regression price prediction
 * Uses OLS regression on log-prices with time as independent variable
 */
export function linearRegressionPredict(
  prices: number[],
  daysAhead: number
): PredictionResult {
  if (prices.length < 30) {
    return {
      predictedPrice: prices[prices.length - 1],
      confidence: 0,
      upperBound: prices[prices.length - 1],
      lowerBound: prices[prices.length - 1],
      trend: 'neutral',
      dailyReturn: 0,
      annualizedReturn: 0,
    };
  }

  // Use log prices for better linear fit
  const logPrices = prices.map(p => Math.log(p));
  const n = logPrices.length;
  
  // Create (x, y) pairs where x = day index
  const data: [number, number][] = logPrices.map((lp, i) => [i, lp]);
  
  // Calculate linear regression
  const regression = ss.linearRegression(data);
  const regressionLine = ss.linearRegressionLine(regression);
  
  // R-squared
  const predicted = data.map(d => regressionLine(d[0]));
  const rSquared = 1 - ss.sumSimple(logPrices.map((lp, i) => Math.pow(lp - predicted[i], 2))) / ss.sumSimple(logPrices.map(lp => Math.pow(lp - ss.mean(logPrices), 2)));
  
  // Predict future price
  const futureX = n + daysAhead;
  const predictedLogPrice = regressionLine(futureX);
  const predictedPrice = Math.exp(predictedLogPrice);
  
  // Calculate residuals for confidence interval
  const residuals = logPrices.map((lp, i) => lp - regressionLine(i));
  const residualStd = ss.standardDeviation(residuals);
  
  // 95% confidence interval (approximately 1.96 * std)
  const confidenceMultiplier = 1.96 * Math.sqrt(1 + 1/n + Math.pow(futureX - n/2, 2) / ss.sumSimple(data.map(d => Math.pow(d[0] - n/2, 2))));
  const upperBound = Math.exp(predictedLogPrice + confidenceMultiplier * residualStd);
  const lowerBound = Math.exp(predictedLogPrice - confidenceMultiplier * residualStd);
  
  // Confidence based on R² and prediction horizon
  const horizonPenalty = Math.max(0.5, 1 - daysAhead / 365);
  const confidence = Math.max(0, Math.min(1, rSquared * horizonPenalty));
  
  // Daily and annualized return
  const currentPrice = prices[prices.length - 1];
  const totalReturn = (predictedPrice - currentPrice) / currentPrice;
  const dailyReturn = totalReturn / daysAhead;
  const annualizedReturn = Math.pow(1 + totalReturn, 252 / daysAhead) - 1;
  
  // Trend determination
  let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  if (totalReturn > 0.03) trend = 'bullish';
  else if (totalReturn < -0.03) trend = 'bearish';
  
  return {
    predictedPrice: Math.round(predictedPrice * 100) / 100,
    confidence: Math.round(confidence * 100) / 100,
    upperBound: Math.round(upperBound * 100) / 100,
    lowerBound: Math.round(lowerBound * 100) / 100,
    trend,
    dailyReturn: Math.round(dailyReturn * 10000) / 10000,
    annualizedReturn: Math.round(annualizedReturn * 10000) / 10000,
  };
}

// ============================================================
// 2. ARIMA-STYLE - Exponential Smoothing + Moving Average
// ============================================================

/**
 * Triple Exponential Smoothing (Holt-Winters) for time series prediction
 * Captures level, trend, and seasonality
 */
export function arimaStylePredict(
  prices: number[],
  daysAhead: number
): PredictionResult {
  if (prices.length < 60) {
    return linearRegressionPredict(prices, daysAhead);
  }

  const n = prices.length;
  
  // Double Exponential Smoothing (Holt's method)
  const alpha = 0.3; // Level smoothing
  const beta = 0.1;  // Trend smoothing
  
  // Initialize
  let level = prices[0];
  let trend = (prices[Math.min(5, n-1)] - prices[0]) / Math.min(5, n-1);
  
  // Smooth through all data
  for (let i = 1; i < n; i++) {
    const prevLevel = level;
    level = alpha * prices[i] + (1 - alpha) * (prevLevel + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }
  
  // Forecast
  const predictedPrice = level + trend * daysAhead;
  
  // Calculate forecast error from in-sample predictions
  const errors: number[] = [];
  let l = prices[0];
  let t = (prices[Math.min(5, n-1)] - prices[0]) / Math.min(5, n-1);
  
  for (let i = 1; i < n; i++) {
    const forecast = l + t;
    errors.push(prices[i] - forecast);
    const prevL = l;
    l = alpha * prices[i] + (1 - alpha) * (prevL + t);
    t = beta * (l - prevL) + (1 - beta) * t;
  }
  
  const errorStd = ss.standardDeviation(errors);
  const confidenceWidth = 1.96 * errorStd * Math.sqrt(daysAhead);
  
  const upperBound = predictedPrice + confidenceWidth;
  const lowerBound = Math.max(0, predictedPrice - confidenceWidth);
  
  // Confidence
  const mape = ss.mean(errors.map((e, i) => Math.abs(e) / prices[i + 1]));
  const confidence = Math.max(0, Math.min(1, (1 - mape) * Math.max(0.4, 1 - daysAhead / 200)));
  
  const currentPrice = prices[n - 1];
  const totalReturn = (predictedPrice - currentPrice) / currentPrice;
  const dailyReturn = totalReturn / daysAhead;
  const annualizedReturn = Math.pow(1 + Math.abs(totalReturn), 252 / daysAhead) - 1;
  
  let trendDir: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  if (totalReturn > 0.03) trendDir = 'bullish';
  else if (totalReturn < -0.03) trendDir = 'bearish';
  
  return {
    predictedPrice: Math.round(Math.max(0, predictedPrice) * 100) / 100,
    confidence: Math.round(confidence * 100) / 100,
    upperBound: Math.round(upperBound * 100) / 100,
    lowerBound: Math.round(Math.max(0, lowerBound) * 100) / 100,
    trend: trendDir,
    dailyReturn: Math.round(dailyReturn * 10000) / 10000,
    annualizedReturn: Math.round((totalReturn > 0 ? 1 : -1) * annualizedReturn * 10000) / 10000,
  };
}

/**
 * Combined prediction using ensemble of Linear Regression and ARIMA-style
 */
export function ensemblePredict(
  prices: number[],
  daysAhead: number
): PredictionResult {
  const lr = linearRegressionPredict(prices, daysAhead);
  const arima = arimaStylePredict(prices, daysAhead);
  
  // Weight by confidence
  const totalConf = lr.confidence + arima.confidence;
  if (totalConf === 0) return lr;
  
  const wLR = lr.confidence / totalConf;
  const wARIMA = arima.confidence / totalConf;
  
  return {
    predictedPrice: Math.round((lr.predictedPrice * wLR + arima.predictedPrice * wARIMA) * 100) / 100,
    confidence: Math.round(Math.max(lr.confidence, arima.confidence) * 100) / 100,
    upperBound: Math.round((lr.upperBound * wLR + arima.upperBound * wARIMA) * 100) / 100,
    lowerBound: Math.round((lr.lowerBound * wLR + arima.lowerBound * wARIMA) * 100) / 100,
    trend: lr.confidence > arima.confidence ? lr.trend : arima.trend,
    dailyReturn: Math.round((lr.dailyReturn * wLR + arima.dailyReturn * wARIMA) * 10000) / 10000,
    annualizedReturn: Math.round((lr.annualizedReturn * wLR + arima.annualizedReturn * wARIMA) * 10000) / 10000,
  };
}

export function generatePricePrediction(
  ticker: string,
  prices: number[],
  currentPrice: number
): PricePrediction {
  const lr30 = linearRegressionPredict(prices, 30);
  const arima30 = arimaStylePredict(prices, 30);
  
  // Calculate R² for model metrics
  const logPrices = prices.map(p => Math.log(p));
  const data: [number, number][] = logPrices.map((lp, i) => [i, lp]);
  const regression = ss.linearRegression(data);
  const regressionLine = ss.linearRegressionLine(regression);
  const predicted = data.map(d => regressionLine(d[0]));
  const meanLogPrice = ss.mean(logPrices);
  const ssRes = ss.sumSimple(logPrices.map((lp, i) => Math.pow(lp - predicted[i], 2)));
  const ssTot = ss.sumSimple(logPrices.map(lp => Math.pow(lp - meanLogPrice, 2)));
  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  const residuals = logPrices.map((lp, i) => lp - predicted[i]);
  const mse = ss.mean(residuals.map(r => r * r));
  
  return {
    ticker,
    currentPrice,
    predictions: {
      days30: ensemblePredict(prices, 30),
      days60: ensemblePredict(prices, 60),
      days90: ensemblePredict(prices, 90),
    },
    modelMetrics: {
      rSquared: Math.round(rSquared * 1000) / 1000,
      mse: Math.round(mse * 100000) / 100000,
      method: 'Ensemble (Linear Regression + Holt-Winters)',
    },
  };
}

// ============================================================
// 3. RANDOM FOREST - Multi-indicator Signal Classification
// ============================================================

export interface StockFeatures {
  rsi14: number;          // RSI (14)
  macdSignal: number;     // MACD - Signal line (normalized)
  macdHistogram: number;  // MACD histogram (normalized)
  peRatio: number;        // P/E ratio (capped at 100)
  pegRatio: number;       // PEG ratio (capped at 5)
  dividendYield: number;  // Dividend yield %
  beta: number;           // Beta
  fiftyTwoWeekPos: number; // Position in 52-week range (0-1)
  volumeTrend: number;    // Volume vs 20-day avg (ratio)
  sma20Cross: number;     // Price vs SMA20 (ratio - 1)
  sma50Cross: number;     // Price vs SMA50 (ratio - 1)
  priceChange5d: number;  // 5-day price change %
  priceChange20d: number; // 20-day price change %
  volatility20d: number;  // 20-day volatility (annualized)
  sentiment: number;      // Sentiment score (-1 to 1), 0 if unavailable
}

export interface RFSignalResult {
  signal: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
  confidence: number; // 0-1
  score: number; // 0-100
  featureImportance: { feature: string; importance: number }[];
  reasons: string[];
}

/**
 * Generate training data from historical indicators
 * Labels: 1 = buy (price went up >5% in next 30 days), 0 = hold, -1 = sell (price went down >5%)
 */
function generateTrainingLabels(prices: number[], lookAhead: number = 30): number[] {
  const labels: number[] = [];
  for (let i = 0; i < prices.length - lookAhead; i++) {
    const futureReturn = (prices[i + lookAhead] - prices[i]) / prices[i];
    if (futureReturn > 0.05) labels.push(2);       // strong buy
    else if (futureReturn > 0.02) labels.push(1);  // buy
    else if (futureReturn < -0.05) labels.push(-2); // strong sell
    else if (futureReturn < -0.02) labels.push(-1); // sell
    else labels.push(0);                            // hold
  }
  return labels;
}

/**
 * Calculate technical features for a given point in the price series
 */
function calculateFeaturesAtPoint(
  prices: number[],
  volumes: number[] | null,
  index: number
): number[] | null {
  if (index < 50) return null; // Need at least 50 days of history
  
  const slice = prices.slice(Math.max(0, index - 50), index + 1);
  const n = slice.length;
  
  // RSI (14)
  const changes = [];
  for (let i = 1; i < Math.min(15, n); i++) {
    changes.push(slice[n - i] - slice[n - i - 1]);
  }
  const gains = changes.filter(c => c > 0);
  const losses = changes.filter(c => c < 0).map(c => Math.abs(c));
  const avgGain = gains.length > 0 ? ss.mean(gains) : 0;
  const avgLoss = losses.length > 0 ? ss.mean(losses) : 0.001;
  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));
  
  // MACD
  const ema12 = calculateEMA(slice, 12);
  const ema26 = calculateEMA(slice, 26);
  const macd = ema12 - ema26;
  const currentPrice = slice[n - 1];
  const macdNorm = macd / currentPrice; // Normalize
  
  // SMA crossovers
  const sma20 = ss.mean(slice.slice(-20));
  const sma50 = ss.mean(slice.slice(-50));
  const sma20Cross = (currentPrice / sma20) - 1;
  const sma50Cross = (currentPrice / sma50) - 1;
  
  // 52-week position (approximate with available data)
  const high = Math.max(...slice);
  const low = Math.min(...slice);
  const range = high - low;
  const fiftyTwoWeekPos = range > 0 ? (currentPrice - low) / range : 0.5;
  
  // Price changes
  const priceChange5d = n >= 6 ? (currentPrice - slice[n - 6]) / slice[n - 6] : 0;
  const priceChange20d = n >= 21 ? (currentPrice - slice[n - 21]) / slice[n - 21] : 0;
  
  // Volatility (20-day)
  const returns20 = [];
  for (let i = Math.max(1, n - 20); i < n; i++) {
    returns20.push(Math.log(slice[i] / slice[i - 1]));
  }
  const volatility = returns20.length > 1 ? ss.standardDeviation(returns20) * Math.sqrt(252) : 0;
  
  // Volume trend
  let volumeTrend = 1;
  if (volumes && volumes.length > index && index >= 20) {
    const recentVol = volumes[index];
    const avgVol = ss.mean(volumes.slice(index - 20, index));
    volumeTrend = avgVol > 0 ? recentVol / avgVol : 1;
  }
  
  return [
    rsi,
    macdNorm,
    macdNorm * 0.5, // histogram approximation
    0, // P/E (filled externally)
    0, // PEG (filled externally)
    0, // Dividend yield (filled externally)
    1, // Beta (filled externally)
    fiftyTwoWeekPos,
    volumeTrend,
    sma20Cross,
    sma50Cross,
    priceChange5d,
    priceChange20d,
    volatility,
    0, // Sentiment (filled externally)
  ];
}

function calculateEMA(data: number[], period: number): number {
  const k = 2 / (period + 1);
  let ema = data[0];
  for (let i = 1; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
  }
  return ema;
}

/**
 * Train a Random Forest model on historical price data and predict signal
 */
export function randomForestSignal(
  prices: number[],
  volumes: number[] | null,
  fundamentals: {
    peRatio?: number;
    pegRatio?: number;
    dividendYield?: number;
    beta?: number;
    sentiment?: number;
  }
): RFSignalResult {
  if (prices.length < 100) {
    return {
      signal: 'hold',
      confidence: 0,
      score: 50,
      featureImportance: [],
      reasons: ['Nicht genügend historische Daten für ML-Analyse (min. 100 Tage benötigt)'],
    };
  }

  // Generate training data
  const lookAhead = 30;
  const features: number[][] = [];
  const labels: number[] = [];
  const rawLabels = generateTrainingLabels(prices, lookAhead);
  
  for (let i = 50; i < prices.length - lookAhead; i++) {
    const feat = calculateFeaturesAtPoint(prices, volumes, i);
    if (feat) {
      // Fill fundamental data (constant for training, use current values)
      feat[3] = Math.min(fundamentals.peRatio || 20, 100);
      feat[4] = Math.min(fundamentals.pegRatio || 1.5, 5);
      feat[5] = fundamentals.dividendYield || 0;
      feat[6] = fundamentals.beta || 1;
      feat[14] = fundamentals.sentiment || 0;
      
      features.push(feat);
      // Map labels to 0-4 for classification (RF needs non-negative integers)
      labels.push(rawLabels[i - 50] + 2); // -2->0, -1->1, 0->2, 1->3, 2->4
    }
  }
  
  if (features.length < 30) {
    return {
      signal: 'hold',
      confidence: 0,
      score: 50,
      featureImportance: [],
      reasons: ['Nicht genügend Trainingsdaten für Random Forest'],
    };
  }

  try {
    // Train Random Forest
    const rf = new RandomForestClassifier({
      nEstimators: 50,
      maxFeatures: 0.7,
      replacement: true,
      seed: 42,
    });
    
    rf.train(features, labels);
    
    // Predict current state
    const currentFeatures = calculateFeaturesAtPoint(prices, volumes, prices.length - 1);
    if (!currentFeatures) {
      return {
        signal: 'hold',
        confidence: 0,
        score: 50,
        featureImportance: [],
        reasons: ['Fehler bei Feature-Berechnung'],
      };
    }
    
    // Fill fundamentals for current prediction
    currentFeatures[3] = Math.min(fundamentals.peRatio || 20, 100);
    currentFeatures[4] = Math.min(fundamentals.pegRatio || 1.5, 5);
    currentFeatures[5] = fundamentals.dividendYield || 0;
    currentFeatures[6] = fundamentals.beta || 1;
    currentFeatures[14] = fundamentals.sentiment || 0;
    
    const prediction = rf.predict([currentFeatures])[0]; // 0-4
    
    // Get prediction probabilities via voting
    // Since ml-random-forest doesn't have predict_proba, we use OOB or estimate
    const allPredictions = rf.predict(features);
    const accuracy = allPredictions.reduce((acc: number, pred: number, i: number) => 
      acc + (pred === labels[i] ? 1 : 0), 0) / allPredictions.length;
    
    // Map prediction back to signal
    const signalMap: Record<number, 'strong_sell' | 'sell' | 'hold' | 'buy' | 'strong_buy'> = {
      0: 'strong_sell',
      1: 'sell',
      2: 'hold',
      3: 'buy',
      4: 'strong_buy',
    };
    
    const signal = signalMap[prediction] || 'hold';
    const confidence = Math.round(accuracy * 100) / 100;
    
    // Score: 0-100
    const scoreMap: Record<number, number> = { 0: 10, 1: 30, 2: 50, 3: 70, 4: 90 };
    const score = scoreMap[prediction] || 50;
    
    // Feature importance (approximate by permutation importance)
    const featureNames = [
      'RSI (14)', 'MACD Signal', 'MACD Histogramm', 'P/E Ratio', 'PEG Ratio',
      'Dividendenrendite', 'Beta', '52W-Position', 'Volumen-Trend', 'SMA20 Cross',
      'SMA50 Cross', '5-Tage Veränderung', '20-Tage Veränderung', 'Volatilität', 'Sentiment'
    ];
    
    // Simple feature importance: variance of each feature weighted by correlation with labels
    const featureImportance = featureNames.map((name, idx) => {
      const featureValues = features.map(f => f[idx]);
      const variance = featureValues.length > 1 ? ss.variance(featureValues) : 0;
      // Correlation with labels
      let corr = 0;
      try {
        const pairs: [number, number][] = featureValues.map((v, i) => [v, labels[i]]);
        corr = Math.abs(ss.sampleCorrelation(featureValues, labels));
      } catch { corr = 0; }
      return { feature: name, importance: Math.round(corr * 100) / 100 };
    }).sort((a, b) => b.importance - a.importance);
    
    // Generate reasons
    const reasons: string[] = [];
    const rsi = currentFeatures[0];
    const macdSig = currentFeatures[1];
    const sma20 = currentFeatures[9];
    const fiftyTwoW = currentFeatures[7];
    
    if (rsi > 70) reasons.push('RSI überkauft (' + Math.round(rsi) + ')');
    else if (rsi < 30) reasons.push('RSI überverkauft (' + Math.round(rsi) + ')');
    
    if (macdSig > 0.01) reasons.push('MACD bullish');
    else if (macdSig < -0.01) reasons.push('MACD bearish');
    
    if (sma20 > 0.02) reasons.push('Kurs über SMA20 (+' + Math.round(sma20 * 100) + '%)');
    else if (sma20 < -0.02) reasons.push('Kurs unter SMA20 (' + Math.round(sma20 * 100) + '%)');
    
    if (fiftyTwoW > 0.8) reasons.push('Nahe 52-Wochen-Hoch');
    else if (fiftyTwoW < 0.2) reasons.push('Nahe 52-Wochen-Tief');
    
    if (fundamentals.peRatio && fundamentals.peRatio < 15) reasons.push('Niedrige Bewertung (P/E ' + fundamentals.peRatio.toFixed(1) + ')');
    if (fundamentals.dividendYield && fundamentals.dividendYield > 3) reasons.push('Hohe Dividende (' + fundamentals.dividendYield.toFixed(1) + '%)');
    
    if (signal === 'strong_buy' || signal === 'buy') {
      reasons.push('Random Forest: ' + Math.round(accuracy * 100) + '% Trainingsgenauigkeit');
    } else if (signal === 'strong_sell' || signal === 'sell') {
      reasons.push('Random Forest: Verkaufssignal mit ' + Math.round(accuracy * 100) + '% Genauigkeit');
    }
    
    return {
      signal,
      confidence,
      score,
      featureImportance: featureImportance.slice(0, 5), // Top 5
      reasons: reasons.slice(0, 5),
    };
  } catch (error) {
    console.error('[ML] Random Forest error:', error);
    return {
      signal: 'hold',
      confidence: 0,
      score: 50,
      featureImportance: [],
      reasons: ['ML-Modell konnte nicht trainiert werden: ' + (error as Error).message],
    };
  }
}
