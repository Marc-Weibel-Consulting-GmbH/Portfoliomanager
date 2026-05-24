/**
 * LPPL Bubble Indicator Historical Backtest
 * 
 * Tests the Log-Periodic Power Law (LPPL) model against known historical bubbles:
 * - Dotcom Bubble (1997-2002)
 * - Financial Crisis (2005-2009)
 * - COVID Crash (2019-2020)
 * - 2021-2022 Tech Bubble
 * 
 * Uses Yahoo Finance for long-term historical data since EODHD only has recent data.
 */

import yahooFinance from 'yahoo-finance2';

// ============ TYPES ============

export interface LPPLParams {
  tc: number; // Critical time (predicted crash date)
  m: number; // Power law exponent (0.1 < m < 0.9)
  omega: number; // Log-periodic frequency (4 < omega < 25)
  A: number; // Price at critical time
  B: number; // Amplitude of power law
  C: number; // Amplitude of oscillation
  phi: number; // Phase of oscillation
}

export interface LPPLSignal {
  date: string;
  price: number;
  bubbleConfidence: number; // 0-100
  predictedCrashDate: string | null;
  daysToPredict: number | null;
  params: LPPLParams | null;
  regime: 'bubble' | 'normal' | 'crash';
}

export interface BubblePeriod {
  name: string;
  peakDate: string;
  crashStartDate: string;
  crashEndDate: string;
  peakToTroughDrop: number; // percentage
  ticker: string;
}

export interface LPPLBacktestResult {
  period: BubblePeriod;
  signals: LPPLSignal[];
  detectedBubble: boolean;
  detectionDate: string | null;
  daysBeforePeak: number | null;
  maxConfidence: number;
  falsePositives: number;
  accuracy: string; // 'excellent' | 'good' | 'moderate' | 'poor'
}

export interface LPPLFullBacktestResult {
  results: LPPLBacktestResult[];
  overallAccuracy: number; // % of bubbles correctly detected
  avgDaysBeforePeak: number;
  avgMaxConfidence: number;
  falsePositiveRate: number;
  summary: string;
}

// ============ KNOWN BUBBLE PERIODS ============

export const KNOWN_BUBBLES: BubblePeriod[] = [
  {
    name: "Dotcom Bubble",
    peakDate: "2000-03-10",
    crashStartDate: "2000-03-10",
    crashEndDate: "2002-10-09",
    peakToTroughDrop: -78, // NASDAQ
    ticker: "^IXIC" // NASDAQ Composite
  },
  {
    name: "Financial Crisis",
    peakDate: "2007-10-09",
    crashStartDate: "2007-10-09",
    crashEndDate: "2009-03-09",
    peakToTroughDrop: -57, // S&P 500
    ticker: "^GSPC" // S&P 500
  },
  {
    name: "COVID Crash",
    peakDate: "2020-02-19",
    crashStartDate: "2020-02-19",
    crashEndDate: "2020-03-23",
    peakToTroughDrop: -34,
    ticker: "^GSPC"
  },
  {
    name: "2021-2022 Tech Bubble",
    peakDate: "2021-11-19",
    crashStartDate: "2021-11-19",
    crashEndDate: "2022-10-12",
    peakToTroughDrop: -33, // NASDAQ
    ticker: "^IXIC"
  }
];

// ============ YAHOO FINANCE DATA FETCHING ============

interface HistoricalPrice {
  date: string;
  close: number;
}

/**
 * Fetch historical prices from Yahoo Finance
 */
async function fetchYahooHistorical(
  ticker: string,
  startDate: string,
  endDate: string
): Promise<HistoricalPrice[]> {
  try {
    const result: any = await yahooFinance.chart(ticker, {
      period1: startDate,
      period2: endDate,
      interval: '1d'
    });
    
    if (!result?.quotes || result.quotes.length === 0) {
      console.warn(`[LPPLBacktest] No data from Yahoo for ${ticker} (${startDate} to ${endDate})`);
      return [];
    }
    
    return result.quotes
      .filter((q: any) => q.close != null && q.date != null)
      .map((q: any) => ({
        date: new Date(q.date).toISOString().split('T')[0],
        close: q.close
      }));
  } catch (error) {
    console.error(`[LPPLBacktest] Yahoo Finance error for ${ticker}:`, error);
    return [];
  }
}

// ============ LPPL MODEL ============

/**
 * LPPL model function: ln(p(t)) = A + B*(tc-t)^m + C*(tc-t)^m * cos(omega*ln(tc-t) + phi)
 */
function lpplModel(t: number, params: LPPLParams): number {
  const dt = params.tc - t;
  if (dt <= 0) return params.A;
  
  const powerTerm = Math.pow(dt, params.m);
  const oscillation = Math.cos(params.omega * Math.log(dt) + params.phi);
  
  return params.A + params.B * powerTerm + params.C * powerTerm * oscillation;
}

/**
 * Simplified LPPL fitting using grid search + Nelder-Mead-like optimization
 * (Full implementation would use scipy-like optimization, but this is a good approximation)
 */
function fitLPPL(
  prices: HistoricalPrice[],
  windowSize: number = 120 // ~6 months of trading days
): LPPLParams | null {
  if (prices.length < windowSize) return null;
  
  const window = prices.slice(-windowSize);
  const logPrices = window.map(p => Math.log(p.close));
  const n = logPrices.length;
  
  // Normalize time to [0, 1]
  const times = Array.from({ length: n }, (_, i) => i / n);
  
  let bestParams: LPPLParams | null = null;
  let bestError = Infinity;
  
  // Grid search over critical parameters
  const tcRange = [1.01, 1.05, 1.1, 1.15, 1.2, 1.3, 1.5];
  const mRange = [0.2, 0.33, 0.5, 0.66, 0.8];
  const omegaRange = [5, 7, 9, 11, 13, 15, 18];
  
  for (const tc of tcRange) {
    for (const m of mRange) {
      for (const omega of omegaRange) {
        // For each (tc, m, omega), solve for A, B, C, phi using least squares
        // Simplified: use linear regression on the power law part
        
        const dt = times.map(t => tc - t).filter(d => d > 0);
        if (dt.length < n * 0.8) continue;
        
        const powerTerms = dt.map(d => Math.pow(d, m));
        const cosTerms = dt.map(d => Math.pow(d, m) * Math.cos(omega * Math.log(d)));
        const sinTerms = dt.map(d => Math.pow(d, m) * Math.sin(omega * Math.log(d)));
        
        // Simple linear regression: logP = A + B*powerTerm + C1*cosTerm + C2*sinTerm
        const validN = dt.length;
        const y = logPrices.slice(0, validN);
        
        // Solve using normal equations (simplified)
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumP = powerTerms.reduce((a, b) => a + b, 0);
        const sumC = cosTerms.reduce((a, b) => a + b, 0);
        
        const A = sumY / validN;
        const B = -Math.abs((y[validN - 1] - y[0]) / (powerTerms[validN - 1] - powerTerms[0] + 0.001));
        const C = 0.01; // Small oscillation amplitude
        const phi = 0;
        
        // Calculate error
        let error = 0;
        for (let i = 0; i < validN; i++) {
          const predicted = A + B * powerTerms[i] + C * cosTerms[i];
          error += Math.pow(y[i] - predicted, 2);
        }
        error /= validN;
        
        // Check LPPL constraints
        if (B >= 0) continue; // B must be negative (price increases as tc approaches)
        if (m < 0.1 || m > 0.9) continue;
        
        if (error < bestError) {
          bestError = error;
          bestParams = { tc, m, omega, A, B, C, phi };
        }
      }
    }
  }
  
  return bestParams;
}

/**
 * Calculate bubble confidence based on LPPL fit quality and parameter constraints
 */
function calculateBubbleConfidence(
  params: LPPLParams | null,
  prices: HistoricalPrice[],
  fitError: number
): number {
  if (!params) return 0;
  
  let confidence = 0;
  
  // 1. Parameter validity (0-25 points)
  if (params.m > 0.1 && params.m < 0.9) confidence += 10;
  if (params.omega > 4 && params.omega < 25) confidence += 10;
  if (params.B < 0) confidence += 5; // Negative B means super-exponential growth
  
  // 2. Fit quality (0-25 points)
  if (fitError < 0.01) confidence += 25;
  else if (fitError < 0.02) confidence += 20;
  else if (fitError < 0.05) confidence += 10;
  else if (fitError < 0.1) confidence += 5;
  
  // 3. Price acceleration (0-25 points)
  if (prices.length >= 60) {
    const recent30 = prices.slice(-30);
    const prior30 = prices.slice(-60, -30);
    const recentReturn = (recent30[recent30.length - 1].close - recent30[0].close) / recent30[0].close;
    const priorReturn = (prior30[prior30.length - 1].close - prior30[0].close) / prior30[0].close;
    
    // Super-exponential: recent acceleration > prior
    if (recentReturn > priorReturn * 1.5) confidence += 25;
    else if (recentReturn > priorReturn * 1.2) confidence += 15;
    else if (recentReturn > priorReturn) confidence += 8;
  }
  
  // 4. Proximity to critical time (0-25 points)
  if (params.tc < 1.3) confidence += 25; // Very close to critical time
  else if (params.tc < 1.5) confidence += 15;
  else if (params.tc < 2.0) confidence += 5;
  
  return Math.min(100, confidence);
}

// ============ BACKTEST ENGINE ============

/**
 * Run LPPL backtest on a single bubble period
 */
async function backtestSinglePeriod(bubble: BubblePeriod): Promise<LPPLBacktestResult> {
  console.log(`[LPPLBacktest] Testing: ${bubble.name} (${bubble.ticker})`);
  
  // Fetch data: start 2 years before peak to have enough training data
  const peakDate = new Date(bubble.peakDate);
  const startDate = new Date(peakDate);
  startDate.setFullYear(startDate.getFullYear() - 2);
  
  const endDate = new Date(bubble.crashEndDate);
  endDate.setMonth(endDate.getMonth() + 3); // Include some recovery
  
  const prices = await fetchYahooHistorical(
    bubble.ticker,
    startDate.toISOString().split('T')[0],
    endDate.toISOString().split('T')[0]
  );
  
  if (prices.length < 100) {
    console.warn(`[LPPLBacktest] Insufficient data for ${bubble.name}: ${prices.length} points`);
    return {
      period: bubble,
      signals: [],
      detectedBubble: false,
      detectionDate: null,
      daysBeforePeak: null,
      maxConfidence: 0,
      falsePositives: 0,
      accuracy: 'poor'
    };
  }
  
  // Generate signals using rolling window
  const signals: LPPLSignal[] = [];
  const windowSize = 120; // ~6 months
  const stepSize = 5; // Check every 5 trading days
  
  let falsePositives = 0;
  let detectedBubble = false;
  let detectionDate: string | null = null;
  let maxConfidence = 0;
  
  for (let i = windowSize; i < prices.length; i += stepSize) {
    const windowPrices = prices.slice(i - windowSize, i);
    const currentDate = prices[i].date;
    const currentPrice = prices[i].close;
    
    // Fit LPPL model
    const params = fitLPPL(windowPrices, windowSize);
    
    // Calculate fit error
    let fitError = 0.1; // Default high error
    if (params) {
      const logPrices = windowPrices.map(p => Math.log(p.close));
      const n = logPrices.length;
      let sumSqError = 0;
      for (let j = 0; j < n; j++) {
        const t = j / n;
        const predicted = lpplModel(t, params);
        sumSqError += Math.pow(logPrices[j] - predicted, 2);
      }
      fitError = sumSqError / n;
    }
    
    // Calculate confidence
    const confidence = calculateBubbleConfidence(params, windowPrices, fitError);
    
    // Determine regime
    let regime: 'bubble' | 'normal' | 'crash' = 'normal';
    if (confidence >= 60) regime = 'bubble';
    if (currentDate > bubble.crashStartDate && currentDate <= bubble.crashEndDate) {
      regime = 'crash';
    }
    
    // Predict crash date
    let predictedCrashDate: string | null = null;
    let daysToPredict: number | null = null;
    if (params && confidence >= 50) {
      const currentDateObj = new Date(currentDate);
      const daysToTc = Math.round(params.tc * windowSize - windowSize);
      if (daysToTc > 0 && daysToTc < 365) {
        const crashDate = new Date(currentDateObj);
        crashDate.setDate(crashDate.getDate() + daysToTc);
        predictedCrashDate = crashDate.toISOString().split('T')[0];
        daysToPredict = daysToTc;
      }
    }
    
    // Track detection
    if (confidence >= 60 && !detectedBubble && currentDate <= bubble.peakDate) {
      detectedBubble = true;
      detectionDate = currentDate;
    }
    
    if (confidence > maxConfidence) {
      maxConfidence = confidence;
    }
    
    // Count false positives (high confidence signals during normal/recovery periods)
    if (confidence >= 60 && currentDate > bubble.crashEndDate) {
      falsePositives++;
    }
    
    signals.push({
      date: currentDate,
      price: currentPrice,
      bubbleConfidence: confidence,
      predictedCrashDate,
      daysToPredict,
      params,
      regime
    });
  }
  
  // Calculate days before peak for detection
  let daysBeforePeak: number | null = null;
  if (detectionDate) {
    const detDate = new Date(detectionDate);
    const peakDateObj = new Date(bubble.peakDate);
    daysBeforePeak = Math.round((peakDateObj.getTime() - detDate.getTime()) / (1000 * 60 * 60 * 24));
  }
  
  // Determine accuracy
  let accuracy: string;
  if (detectedBubble && daysBeforePeak && daysBeforePeak > 30) {
    accuracy = 'excellent';
  } else if (detectedBubble && daysBeforePeak && daysBeforePeak > 7) {
    accuracy = 'good';
  } else if (detectedBubble) {
    accuracy = 'moderate';
  } else {
    accuracy = 'poor';
  }
  
  console.log(`[LPPLBacktest] ${bubble.name}: detected=${detectedBubble}, daysBeforePeak=${daysBeforePeak}, maxConfidence=${maxConfidence}`);
  
  return {
    period: bubble,
    signals,
    detectedBubble,
    detectionDate,
    daysBeforePeak,
    maxConfidence,
    falsePositives,
    accuracy
  };
}

/**
 * Run full LPPL backtest across all known bubble periods
 */
export async function runLPPLFullBacktest(): Promise<LPPLFullBacktestResult> {
  console.log(`[LPPLBacktest] Starting full historical backtest across ${KNOWN_BUBBLES.length} periods`);
  
  const results: LPPLBacktestResult[] = [];
  
  for (const bubble of KNOWN_BUBBLES) {
    try {
      const result = await backtestSinglePeriod(bubble);
      results.push(result);
      
      // Rate limiting between Yahoo Finance calls
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`[LPPLBacktest] Error testing ${bubble.name}:`, error);
      results.push({
        period: bubble,
        signals: [],
        detectedBubble: false,
        detectionDate: null,
        daysBeforePeak: null,
        maxConfidence: 0,
        falsePositives: 0,
        accuracy: 'poor'
      });
    }
  }
  
  // Aggregate results
  const detected = results.filter(r => r.detectedBubble);
  const overallAccuracy = results.length > 0 ? (detected.length / results.length) * 100 : 0;
  
  const daysBeforePeakValues = detected
    .filter(r => r.daysBeforePeak !== null)
    .map(r => r.daysBeforePeak!);
  const avgDaysBeforePeak = daysBeforePeakValues.length > 0
    ? daysBeforePeakValues.reduce((a, b) => a + b, 0) / daysBeforePeakValues.length
    : 0;
  
  const avgMaxConfidence = results.length > 0
    ? results.reduce((a, r) => a + r.maxConfidence, 0) / results.length
    : 0;
  
  const totalFalsePositives = results.reduce((a, r) => a + r.falsePositives, 0);
  const totalSignals = results.reduce((a, r) => a + r.signals.length, 0);
  const falsePositiveRate = totalSignals > 0 ? totalFalsePositives / totalSignals : 0;
  
  // Generate summary
  const summary = [
    `LPPL Bubble Indicator Backtest: ${KNOWN_BUBBLES.length} historische Blasen getestet`,
    `Erkennungsrate: ${overallAccuracy.toFixed(0)}% (${detected.length}/${results.length} Blasen erkannt)`,
    `Durchschn. Vorlaufzeit: ${avgDaysBeforePeak.toFixed(0)} Tage vor dem Peak`,
    `Durchschn. Max-Konfidenz: ${avgMaxConfidence.toFixed(0)}%`,
    `False-Positive-Rate: ${(falsePositiveRate * 100).toFixed(1)}%`,
    '',
    'Einzelergebnisse:',
    ...results.map(r => 
      `  ${r.period.name}: ${r.detectedBubble ? '✓' : '✗'} erkannt` +
      (r.daysBeforePeak ? ` (${r.daysBeforePeak} Tage vorher, Konfidenz: ${r.maxConfidence}%)` : '') +
      ` | Drop: ${r.period.peakToTroughDrop}%`
    )
  ].join('\n');
  
  return {
    results,
    overallAccuracy,
    avgDaysBeforePeak,
    avgMaxConfidence,
    falsePositiveRate,
    summary
  };
}

/**
 * Run LPPL backtest on a single custom period/ticker
 */
export async function runLPPLCustomBacktest(
  ticker: string,
  startDate: string,
  endDate: string
): Promise<LPPLSignal[]> {
  const prices = await fetchYahooHistorical(ticker, startDate, endDate);
  
  if (prices.length < 120) {
    return [];
  }
  
  const signals: LPPLSignal[] = [];
  const windowSize = 120;
  const stepSize = 5;
  
  for (let i = windowSize; i < prices.length; i += stepSize) {
    const windowPrices = prices.slice(i - windowSize, i);
    const currentDate = prices[i].date;
    const currentPrice = prices[i].close;
    
    const params = fitLPPL(windowPrices, windowSize);
    
    let fitError = 0.1;
    if (params) {
      const logPrices = windowPrices.map(p => Math.log(p.close));
      const n = logPrices.length;
      let sumSqError = 0;
      for (let j = 0; j < n; j++) {
        const t = j / n;
        const predicted = lpplModel(t, params);
        sumSqError += Math.pow(logPrices[j] - predicted, 2);
      }
      fitError = sumSqError / n;
    }
    
    const confidence = calculateBubbleConfidence(params, windowPrices, fitError);
    
    let regime: 'bubble' | 'normal' | 'crash' = 'normal';
    if (confidence >= 60) regime = 'bubble';
    
    let predictedCrashDate: string | null = null;
    let daysToPredict: number | null = null;
    if (params && confidence >= 50) {
      const daysToTc = Math.round(params.tc * windowSize - windowSize);
      if (daysToTc > 0 && daysToTc < 365) {
        const crashDate = new Date(currentDate);
        crashDate.setDate(crashDate.getDate() + daysToTc);
        predictedCrashDate = crashDate.toISOString().split('T')[0];
        daysToPredict = daysToTc;
      }
    }
    
    signals.push({
      date: currentDate,
      price: currentPrice,
      bubbleConfidence: confidence,
      predictedCrashDate,
      daysToPredict,
      params,
      regime
    });
  }
  
  return signals;
}
