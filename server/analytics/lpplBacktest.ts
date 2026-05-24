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
 * 
 * The LPPL model: ln(p(t)) = A + B*(tc-t)^m + C1*(tc-t)^m * cos(omega*ln(tc-t)) + C2*(tc-t)^m * sin(omega*ln(tc-t))
 * 
 * Key insight: For fixed nonlinear params (tc, m, omega), the model is LINEAR in (A, B, C1, C2).
 * We grid-search over (tc, m, omega) and solve the linear part via OLS.
 */

import YahooFinanceClass from 'yahoo-finance2';
// yahoo-finance2 v3: default export is a constructor class
const yahooFinance = new (YahooFinanceClass as any)();

// ============ TYPES ============

export interface LPPLParams {
  tc: number; // Critical time (predicted crash date)
  m: number; // Power law exponent (0.1 < m < 0.9)
  omega: number; // Log-periodic frequency (4 < 25)
  A: number; // Log-price at critical time
  B: number; // Amplitude of power law (must be negative for bubble)
  C1: number; // Cosine amplitude of oscillation
  C2: number; // Sine amplitude of oscillation
  C: number; // Combined oscillation amplitude sqrt(C1^2 + C2^2)
  phi: number; // Phase of oscillation atan2(C2, C1)
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

// ============ LINEAR ALGEBRA HELPERS ============

/**
 * Solve linear system Ax = b using QR decomposition (Gram-Schmidt)
 * Returns x or null if system is singular
 */
function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const m = A.length; // rows
  const n = A[0].length; // cols
  
  if (m < n) return null;
  
  // Compute A^T * A and A^T * b (normal equations)
  const ATA: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  const ATb: number[] = Array(n).fill(0);
  
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let sum = 0;
      for (let k = 0; k < m; k++) {
        sum += A[k][i] * A[k][j];
      }
      ATA[i][j] = sum;
    }
    let sum = 0;
    for (let k = 0; k < m; k++) {
      sum += A[k][i] * b[k];
    }
    ATb[i] = sum;
  }
  
  // Solve using Gaussian elimination with partial pivoting
  const augmented = ATA.map((row, i) => [...row, ATb[i]]);
  
  for (let col = 0; col < n; col++) {
    // Find pivot
    let maxVal = Math.abs(augmented[col][col]);
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(augmented[row][col]) > maxVal) {
        maxVal = Math.abs(augmented[row][col]);
        maxRow = row;
      }
    }
    
    if (maxVal < 1e-12) return null; // Singular
    
    // Swap rows
    if (maxRow !== col) {
      [augmented[col], augmented[maxRow]] = [augmented[maxRow], augmented[col]];
    }
    
    // Eliminate below
    for (let row = col + 1; row < n; row++) {
      const factor = augmented[row][col] / augmented[col][col];
      for (let j = col; j <= n; j++) {
        augmented[row][j] -= factor * augmented[col][j];
      }
    }
  }
  
  // Back substitution
  const x = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = augmented[i][n];
    for (let j = i + 1; j < n; j++) {
      sum -= augmented[i][j] * x[j];
    }
    x[i] = sum / augmented[i][i];
  }
  
  return x;
}

// ============ LPPL FITTING ============

interface FitResult {
  params: LPPLParams;
  residual: number; // normalized sum of squared residuals
  r2: number; // R-squared
}

/**
 * For fixed (tc, m, omega), solve for (A, B, C1, C2) via OLS.
 * 
 * Model: y_i = A + B * f_i + C1 * g_i + C2 * h_i
 * where:
 *   y_i = ln(price_i)
 *   f_i = (tc - t_i)^m
 *   g_i = (tc - t_i)^m * cos(omega * ln(tc - t_i))
 *   h_i = (tc - t_i)^m * sin(omega * ln(tc - t_i))
 */
function fitLPPLLinear(
  logPrices: number[],
  times: number[], // normalized [0, 1]
  tc: number,
  m: number,
  omega: number
): FitResult | null {
  const n = logPrices.length;
  
  // Build design matrix
  const designMatrix: number[][] = [];
  const validIndices: number[] = [];
  
  for (let i = 0; i < n; i++) {
    const dt = tc - times[i];
    if (dt <= 0.001) continue; // Skip points too close to tc
    
    const dtm = Math.pow(dt, m);
    const logDt = Math.log(dt);
    const fi = dtm;
    const gi = dtm * Math.cos(omega * logDt);
    const hi = dtm * Math.sin(omega * logDt);
    
    designMatrix.push([1, fi, gi, hi]);
    validIndices.push(i);
  }
  
  if (validIndices.length < 20) return null; // Need enough points
  
  const y = validIndices.map(i => logPrices[i]);
  
  // Solve OLS: [A, B, C1, C2] = (X^T X)^-1 X^T y
  const solution = solveLinearSystem(designMatrix, y);
  if (!solution) return null;
  
  const [A, B, C1, C2] = solution;
  
  // Check constraints:
  // B must be negative (super-exponential growth approaching tc)
  if (B >= 0) return null;
  
  // |C| should be smaller than |B| (oscillation is subordinate to trend)
  const C = Math.sqrt(C1 * C1 + C2 * C2);
  if (C > Math.abs(B)) return null;
  
  // Calculate residual and R²
  let ssRes = 0;
  let ssTot = 0;
  const yMean = y.reduce((a, b) => a + b, 0) / y.length;
  
  for (let idx = 0; idx < validIndices.length; idx++) {
    const predicted = designMatrix[idx][0] * A + 
                      designMatrix[idx][1] * B + 
                      designMatrix[idx][2] * C1 + 
                      designMatrix[idx][3] * C2;
    ssRes += Math.pow(y[idx] - predicted, 2);
    ssTot += Math.pow(y[idx] - yMean, 2);
  }
  
  const residual = ssRes / validIndices.length;
  const r2 = ssTot > 0 ? 1 - (ssRes / ssTot) : 0;
  
  // R² should be high for a good fit (>0.9 typically)
  if (r2 < 0.85) return null;
  
  const phi = Math.atan2(C2, C1);
  
  return {
    params: { tc, m, omega, A, B, C1, C2, C, phi },
    residual,
    r2
  };
}

/**
 * Multi-scale LPPL fitting with grid search over nonlinear parameters
 * Uses multiple window sizes to capture different bubble timescales
 */
function fitLPPLMultiScale(
  prices: HistoricalPrice[],
  windowSizes: number[] = [60, 90, 120, 180]
): { bestFit: FitResult | null; validFitCount: number; totalAttempts: number } {
  let bestFit: FitResult | null = null;
  let validFitCount = 0;
  let totalAttempts = 0;
  
  for (const windowSize of windowSizes) {
    if (prices.length < windowSize) continue;
    
    const window = prices.slice(-windowSize);
    const logPrices = window.map(p => Math.log(p.close));
    const n = logPrices.length;
    const times = Array.from({ length: n }, (_, i) => i / n);
    
    // Grid search over (tc, m, omega)
    // tc > 1 means crash is predicted in the future
    const tcValues = [1.01, 1.03, 1.05, 1.08, 1.1, 1.15, 1.2, 1.3, 1.4, 1.5];
    const mValues = [0.15, 0.25, 0.33, 0.4, 0.5, 0.6, 0.7, 0.8];
    const omegaValues = [5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 20];
    
    for (const tc of tcValues) {
      for (const m of mValues) {
        for (const omega of omegaValues) {
          totalAttempts++;
          const fit = fitLPPLLinear(logPrices, times, tc, m, omega);
          
          if (fit) {
            validFitCount++;
            if (!bestFit || fit.r2 > bestFit.r2) {
              bestFit = fit;
            }
          }
        }
      }
    }
  }
  
  return { bestFit, validFitCount, totalAttempts };
}

// ============ BUBBLE CONFIDENCE ============

/**
 * Calculate bubble confidence based on multiple indicators:
 * 1. LPPL fit quality (R², residual)
 * 2. Fraction of valid fits (multi-scale)
 * 3. Price acceleration (super-exponential growth)
 * 4. Proximity to critical time
 * 5. Oscillation quality (log-periodic signature)
 */
function calculateBubbleConfidence(
  fitResult: { bestFit: FitResult | null; validFitCount: number; totalAttempts: number },
  prices: HistoricalPrice[]
): number {
  const { bestFit, validFitCount, totalAttempts } = fitResult;
  
  let confidence = 0;
  
  // 1. Valid fit fraction (0-20 points)
  // Higher fraction of valid fits = stronger bubble signal
  const fitFraction = totalAttempts > 0 ? validFitCount / totalAttempts : 0;
  if (fitFraction > 0.15) confidence += 20;
  else if (fitFraction > 0.08) confidence += 15;
  else if (fitFraction > 0.04) confidence += 10;
  else if (fitFraction > 0.02) confidence += 5;
  
  if (!bestFit) {
    // Even without a good LPPL fit, check for price acceleration
    if (prices.length >= 60) {
      const recent30 = prices.slice(-30);
      const prior30 = prices.slice(-60, -30);
      const recentReturn = (recent30[recent30.length - 1].close - recent30[0].close) / recent30[0].close;
      const priorReturn = (prior30[prior30.length - 1].close - prior30[0].close) / prior30[0].close;
      if (recentReturn > 0 && priorReturn > 0 && recentReturn > priorReturn * 1.5) {
        confidence += 10;
      }
    }
    return Math.min(100, confidence);
  }
  
  const { params, r2, residual } = bestFit;
  
  // 2. Fit quality - R² (0-25 points)
  if (r2 > 0.98) confidence += 25;
  else if (r2 > 0.96) confidence += 20;
  else if (r2 > 0.93) confidence += 15;
  else if (r2 > 0.90) confidence += 10;
  else if (r2 > 0.85) confidence += 5;
  
  // 3. Price acceleration / super-exponential growth (0-20 points)
  if (prices.length >= 90) {
    const recent30 = prices.slice(-30);
    const mid30 = prices.slice(-60, -30);
    const prior30 = prices.slice(-90, -60);
    
    const recentReturn = (recent30[recent30.length - 1].close - recent30[0].close) / recent30[0].close;
    const midReturn = (mid30[mid30.length - 1].close - mid30[0].close) / mid30[0].close;
    const priorReturn = (prior30[prior30.length - 1].close - prior30[0].close) / prior30[0].close;
    
    // Super-exponential: each period faster than the last
    if (recentReturn > midReturn && midReturn > priorReturn && recentReturn > 0.05) {
      confidence += 20;
    } else if (recentReturn > midReturn && recentReturn > 0.03) {
      confidence += 12;
    } else if (recentReturn > 0.02 && recentReturn > priorReturn) {
      confidence += 6;
    }
  } else if (prices.length >= 60) {
    const recent30 = prices.slice(-30);
    const prior30 = prices.slice(-60, -30);
    const recentReturn = (recent30[recent30.length - 1].close - recent30[0].close) / recent30[0].close;
    const priorReturn = (prior30[prior30.length - 1].close - prior30[0].close) / prior30[0].close;
    
    if (recentReturn > priorReturn * 1.3 && recentReturn > 0.03) {
      confidence += 15;
    } else if (recentReturn > priorReturn && recentReturn > 0.02) {
      confidence += 8;
    }
  }
  
  // 4. Proximity to critical time (0-15 points)
  if (params.tc <= 1.05) confidence += 15; // Very close — crash imminent
  else if (params.tc <= 1.1) confidence += 12;
  else if (params.tc <= 1.2) confidence += 8;
  else if (params.tc <= 1.4) confidence += 4;
  
  // 5. Log-periodic oscillation quality (0-20 points)
  // |C|/|B| ratio indicates oscillation strength relative to trend
  const oscillationRatio = params.C / Math.abs(params.B);
  if (oscillationRatio > 0.05 && oscillationRatio < 0.8) {
    // Good oscillation: visible but not dominant
    if (oscillationRatio > 0.1 && oscillationRatio < 0.5) confidence += 20;
    else confidence += 10;
  }
  
  // Omega in valid range (academic consensus: 6-13 is most common)
  if (params.omega >= 6 && params.omega <= 13) confidence += 5;
  
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
  
  console.log(`[LPPLBacktest] ${bubble.name}: ${prices.length} data points loaded`);
  
  // Generate signals using rolling window
  const signals: LPPLSignal[] = [];
  const stepSize = 5; // Check every 5 trading days
  const minWindowSize = 60; // Minimum window for fitting
  
  let falsePositives = 0;
  let detectedBubble = false;
  let detectionDate: string | null = null;
  let maxConfidence = 0;
  
  // Only analyze the period leading up to and including the crash
  // Start analysis once we have enough data (minWindowSize)
  for (let i = minWindowSize; i < prices.length; i += stepSize) {
    const currentDate = prices[i].date;
    const currentPrice = prices[i].close;
    
    // Use multiple window sizes for multi-scale analysis
    const windowSizes = [60, 90, 120, 180].filter(w => w <= i);
    const windowPrices = prices.slice(Math.max(0, i - 180), i);
    
    // Fit LPPL model (multi-scale)
    const fitResult = fitLPPLMultiScale(windowPrices, windowSizes);
    
    // Calculate confidence
    const confidence = calculateBubbleConfidence(fitResult, windowPrices);
    
    // Determine regime
    let regime: 'bubble' | 'normal' | 'crash' = 'normal';
    if (confidence >= 45) regime = 'bubble';
    if (currentDate > bubble.crashStartDate && currentDate <= bubble.crashEndDate) {
      regime = 'crash';
    }
    
    // Predict crash date
    let predictedCrashDate: string | null = null;
    let daysToPredict: number | null = null;
    if (fitResult.bestFit && confidence >= 40) {
      const params = fitResult.bestFit.params;
      // tc is in normalized time [0,1] relative to the window
      // Convert to actual days
      const effectiveWindow = windowPrices.length;
      const daysToTc = Math.round((params.tc - 1) * effectiveWindow);
      if (daysToTc > 0 && daysToTc < 365) {
        const crashDate = new Date(currentDate);
        crashDate.setDate(crashDate.getDate() + daysToTc);
        predictedCrashDate = crashDate.toISOString().split('T')[0];
        daysToPredict = daysToTc;
      }
    }
    
    // Track detection: bubble detected if confidence >= 45 before peak
    if (confidence >= 45 && !detectedBubble && currentDate <= bubble.peakDate) {
      detectedBubble = true;
      detectionDate = currentDate;
    }
    
    if (confidence > maxConfidence) {
      maxConfidence = confidence;
    }
    
    // Count false positives (high confidence signals during recovery periods)
    if (confidence >= 45 && currentDate > bubble.crashEndDate) {
      falsePositives++;
    }
    
    const params = fitResult.bestFit?.params || null;
    
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
  if (detectedBubble && daysBeforePeak && daysBeforePeak > 60) {
    accuracy = 'excellent';
  } else if (detectedBubble && daysBeforePeak && daysBeforePeak > 14) {
    accuracy = 'good';
  } else if (detectedBubble) {
    accuracy = 'moderate';
  } else {
    accuracy = 'poor';
  }
  
  console.log(`[LPPLBacktest] ${bubble.name}: detected=${detectedBubble}, daysBeforePeak=${daysBeforePeak}, maxConfidence=${maxConfidence.toFixed(1)}%`);
  
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
      await new Promise(resolve => setTimeout(resolve, 1500));
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
      (r.daysBeforePeak ? ` (${r.daysBeforePeak} Tage vorher, Konfidenz: ${r.maxConfidence.toFixed(0)}%)` : ` (Max-Konfidenz: ${r.maxConfidence.toFixed(0)}%)`) +
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
  
  if (prices.length < 60) {
    return [];
  }
  
  const signals: LPPLSignal[] = [];
  const stepSize = 5;
  const minWindowSize = 60;
  
  for (let i = minWindowSize; i < prices.length; i += stepSize) {
    const currentDate = prices[i].date;
    const currentPrice = prices[i].close;
    
    const windowSizes = [60, 90, 120, 180].filter(w => w <= i);
    const windowPrices = prices.slice(Math.max(0, i - 180), i);
    
    const fitResult = fitLPPLMultiScale(windowPrices, windowSizes);
    const confidence = calculateBubbleConfidence(fitResult, windowPrices);
    
    let regime: 'bubble' | 'normal' | 'crash' = 'normal';
    if (confidence >= 45) regime = 'bubble';
    
    let predictedCrashDate: string | null = null;
    let daysToPredict: number | null = null;
    if (fitResult.bestFit && confidence >= 40) {
      const params = fitResult.bestFit.params;
      const effectiveWindow = windowPrices.length;
      const daysToTc = Math.round((params.tc - 1) * effectiveWindow);
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
      params: fitResult.bestFit?.params || null,
      regime
    });
  }
  
  return signals;
}
