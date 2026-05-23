/**
 * LPPLS Bubble Detector Engine
 * =============================
 * Simplified JavaScript implementation of the Log-Periodic Power Law Singularity model
 * (Sornette/Johansen) for detecting financial bubbles.
 * 
 * The LPPLS model fits price data to:
 *   ln(p(t)) = A + B * (tc - t)^m + C * (tc - t)^m * cos(ω * ln(tc - t) + φ)
 * 
 * Where:
 *   tc = critical time (predicted crash/correction time)
 *   m = power law exponent (0.1 < m < 0.9)
 *   ω = angular log-frequency (4 < ω < 25)
 *   A, B, C, φ = fitting parameters
 * 
 * Output: Bubble Confidence Score [0, 1] indicating probability of bubble regime
 */

export interface LPPLSResult {
  bubbleConfidence: number;       // [0, 1] - overall bubble confidence
  criticalTime: Date | null;      // Estimated tc (crash/correction date)
  daysUntilCritical: number | null; // Days until tc
  regime: 'bubble' | 'normal' | 'negative_bubble';
  windows: WindowResult[];        // Multi-window analysis results
  superExponentialGrowth: boolean; // Whether price shows faster-than-exponential growth
  logPeriodicOscillation: boolean; // Whether log-periodic oscillations detected
}

interface WindowResult {
  windowDays: number;
  confidence: number;
  tc: number | null;
  m: number | null;
  omega: number | null;
  oscillationStrength: number;
}

interface FitParams {
  tc: number;
  m: number;
  omega: number;
  A: number;
  B: number;
  C1: number;
  C2: number;
  residual: number;
}

/**
 * Main LPPLS analysis function
 * Performs multi-window analysis on price data
 */
export function detectBubble(
  prices: number[],
  dates?: Date[]
): LPPLSResult {
  if (prices.length < 30) {
    return {
      bubbleConfidence: 0,
      criticalTime: null,
      daysUntilCritical: null,
      regime: 'normal',
      windows: [],
      superExponentialGrowth: false,
      logPeriodicOscillation: false,
    };
  }

  // Multi-window analysis (different lookback periods)
  const windowSizes = [30, 60, 90, 180, 365, 500].filter(w => w <= prices.length);
  const windowResults: WindowResult[] = [];

  for (const windowDays of windowSizes) {
    const windowPrices = prices.slice(-windowDays);
    const result = analyzeWindow(windowPrices, windowDays);
    windowResults.push(result);
  }

  // Aggregate confidence across windows
  const validWindows = windowResults.filter(w => w.confidence > 0);
  let aggregateConfidence = 0;

  if (validWindows.length > 0) {
    // Weighted average: longer windows get more weight
    let totalWeight = 0;
    let weightedSum = 0;
    for (const w of validWindows) {
      const weight = Math.sqrt(w.windowDays); // Longer windows more reliable
      weightedSum += w.confidence * weight;
      totalWeight += weight;
    }
    aggregateConfidence = weightedSum / totalWeight;
  }

  // Check for super-exponential growth
  const superExponentialGrowth = checkSuperExponentialGrowth(prices);

  // Check for log-periodic oscillations
  const logPeriodicOscillation = checkLogPeriodicOscillation(prices);

  // Boost confidence if both conditions are met
  if (superExponentialGrowth && logPeriodicOscillation) {
    aggregateConfidence = Math.min(1, aggregateConfidence * 1.3);
  } else if (superExponentialGrowth) {
    aggregateConfidence = Math.min(1, aggregateConfidence * 1.1);
  }

  // Determine critical time from best-fitting window
  let criticalTime: Date | null = null;
  let daysUntilCritical: number | null = null;
  const bestWindow = validWindows.sort((a, b) => b.confidence - a.confidence)[0];
  
  if (bestWindow?.tc && dates && dates.length > 0) {
    const lastDate = dates[dates.length - 1] || new Date();
    const tcDate = new Date(lastDate.getTime() + bestWindow.tc * 24 * 60 * 60 * 1000);
    if (tcDate > new Date()) {
      criticalTime = tcDate;
      daysUntilCritical = Math.round((tcDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    }
  }

  // Determine regime
  let regime: 'bubble' | 'normal' | 'negative_bubble' = 'normal';
  if (aggregateConfidence > 0.5) {
    // Check if it's a positive or negative bubble
    const recentReturn = prices.length > 30
      ? (prices[prices.length - 1] - prices[prices.length - 30]) / prices[prices.length - 30]
      : 0;
    regime = recentReturn > 0 ? 'bubble' : 'negative_bubble';
  }

  return {
    bubbleConfidence: Math.round(aggregateConfidence * 100) / 100,
    criticalTime,
    daysUntilCritical,
    regime,
    windows: windowResults,
    superExponentialGrowth,
    logPeriodicOscillation,
  };
}

/**
 * Analyze a single time window for LPPLS characteristics
 */
function analyzeWindow(prices: number[], windowDays: number): WindowResult {
  if (prices.length < 20) {
    return { windowDays, confidence: 0, tc: null, m: null, omega: null, oscillationStrength: 0 };
  }

  // Convert to log prices
  const logPrices = prices.map(p => Math.log(Math.max(p, 0.01)));
  const n = logPrices.length;

  // Grid search over tc, m, omega
  let bestFit: FitParams | null = null;
  let bestResidual = Infinity;

  // tc search range: 1 to 120 days ahead
  const tcRange = [5, 10, 20, 30, 50, 80, 120];
  // m search range: 0.1 to 0.9 (power law exponent)
  const mRange = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
  // omega search range: 4 to 25 (log-periodic frequency)
  const omegaRange = [4, 6, 8, 10, 12, 15, 18, 21, 25];

  for (const tc of tcRange) {
    for (const m of mRange) {
      for (const omega of omegaRange) {
        const fit = fitLPPLS(logPrices, n + tc, m, omega);
        if (fit && fit.residual < bestResidual) {
          bestResidual = fit.residual;
          bestFit = fit;
        }
      }
    }
  }

  if (!bestFit) {
    return { windowDays, confidence: 0, tc: null, m: null, omega: null, oscillationStrength: 0 };
  }

  // Calculate confidence based on fit quality and parameter validity
  let confidence = 0;

  // 1. Fit quality (R² equivalent)
  const meanLogPrice = logPrices.reduce((a, b) => a + b, 0) / n;
  const totalVariance = logPrices.reduce((sum, p) => sum + (p - meanLogPrice) ** 2, 0);
  const rSquared = totalVariance > 0 ? 1 - (bestFit.residual / totalVariance) : 0;
  
  if (rSquared > 0.8) confidence += 0.3;
  else if (rSquared > 0.6) confidence += 0.2;
  else if (rSquared > 0.4) confidence += 0.1;

  // 2. Parameter validity (Sornette conditions)
  const validM = bestFit.m >= 0.1 && bestFit.m <= 0.9;
  const validOmega = bestFit.omega >= 4 && bestFit.omega <= 25;
  const validB = bestFit.B < 0; // B should be negative for positive bubble
  
  if (validM) confidence += 0.15;
  if (validOmega) confidence += 0.15;
  if (validB) confidence += 0.1;

  // 3. Oscillation strength (C/B ratio)
  const oscillationStrength = Math.abs(bestFit.B) > 0.001
    ? Math.sqrt(bestFit.C1 ** 2 + bestFit.C2 ** 2) / Math.abs(bestFit.B)
    : 0;
  
  if (oscillationStrength > 0.1 && oscillationStrength < 5) {
    confidence += 0.15;
  }

  // 4. Damping condition: |m * B| > |C| * sqrt(m² + ω²)
  const dampingLHS = Math.abs(bestFit.m * bestFit.B);
  const dampingRHS = Math.sqrt(bestFit.C1 ** 2 + bestFit.C2 ** 2) * Math.sqrt(bestFit.m ** 2 + bestFit.omega ** 2);
  if (dampingLHS > dampingRHS) {
    confidence += 0.15;
  }

  // Cap at 1.0
  confidence = Math.min(1, Math.max(0, confidence));

  return {
    windowDays,
    confidence,
    tc: bestFit.tc - n, // Days ahead from last observation
    m: bestFit.m,
    omega: bestFit.omega,
    oscillationStrength,
  };
}

/**
 * Fit LPPLS model using linear regression for A, B, C1, C2
 * given fixed tc, m, omega (Slave equation approach)
 */
function fitLPPLS(
  logPrices: number[],
  tc: number,  // critical time index (from start of series)
  m: number,
  omega: number
): FitParams | null {
  const n = logPrices.length;
  
  // Build design matrix for linear regression
  // ln(p(t)) = A + B*f(t) + C1*g(t) + C2*h(t)
  // where f(t) = (tc-t)^m, g(t) = (tc-t)^m * cos(ω*ln(tc-t)), h(t) = (tc-t)^m * sin(ω*ln(tc-t))
  
  const X: number[][] = [];
  const y: number[] = [];

  for (let t = 0; t < n; t++) {
    const dt = tc - t;
    if (dt <= 0) return null; // tc must be in the future

    const dtm = Math.pow(dt, m);
    const logDt = Math.log(dt);
    const cosVal = Math.cos(omega * logDt);
    const sinVal = Math.sin(omega * logDt);

    X.push([1, dtm, dtm * cosVal, dtm * sinVal]);
    y.push(logPrices[t]);
  }

  // Solve using normal equations: (X'X)^-1 * X'y
  const result = solveLinearRegression(X, y);
  if (!result) return null;

  const [A, B, C1, C2] = result.coefficients;

  // Calculate residual sum of squares
  let residual = 0;
  for (let i = 0; i < n; i++) {
    const predicted = A + B * X[i][1] + C1 * X[i][2] + C2 * X[i][3];
    residual += (y[i] - predicted) ** 2;
  }

  return { tc, m, omega, A, B, C1, C2, residual };
}

/**
 * Solve linear regression using normal equations
 */
function solveLinearRegression(X: number[][], y: number[]): { coefficients: number[] } | null {
  const n = X.length;
  const p = X[0].length;

  // Compute X'X
  const XtX: number[][] = Array.from({ length: p }, () => Array(p).fill(0));
  for (let i = 0; i < p; i++) {
    for (let j = 0; j < p; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum += X[k][i] * X[k][j];
      }
      XtX[i][j] = sum;
    }
  }

  // Compute X'y
  const Xty: number[] = Array(p).fill(0);
  for (let i = 0; i < p; i++) {
    let sum = 0;
    for (let k = 0; k < n; k++) {
      sum += X[k][i] * y[k];
    }
    Xty[i] = sum;
  }

  // Solve using Gaussian elimination with partial pivoting
  const augmented: number[][] = XtX.map((row, i) => [...row, Xty[i]]);
  
  for (let col = 0; col < p; col++) {
    // Find pivot
    let maxRow = col;
    let maxVal = Math.abs(augmented[col][col]);
    for (let row = col + 1; row < p; row++) {
      if (Math.abs(augmented[row][col]) > maxVal) {
        maxVal = Math.abs(augmented[row][col]);
        maxRow = row;
      }
    }
    
    if (maxVal < 1e-12) return null; // Singular matrix

    // Swap rows
    if (maxRow !== col) {
      [augmented[col], augmented[maxRow]] = [augmented[maxRow], augmented[col]];
    }

    // Eliminate
    for (let row = col + 1; row < p; row++) {
      const factor = augmented[row][col] / augmented[col][col];
      for (let j = col; j <= p; j++) {
        augmented[row][j] -= factor * augmented[col][j];
      }
    }
  }

  // Back substitution
  const coefficients = Array(p).fill(0);
  for (let i = p - 1; i >= 0; i--) {
    let sum = augmented[i][p];
    for (let j = i + 1; j < p; j++) {
      sum -= augmented[i][j] * coefficients[j];
    }
    coefficients[i] = sum / augmented[i][i];
    if (!isFinite(coefficients[i])) return null;
  }

  return { coefficients };
}

/**
 * Check for super-exponential (faster-than-exponential) growth
 * Uses the second derivative of log prices
 */
function checkSuperExponentialGrowth(prices: number[]): boolean {
  if (prices.length < 60) return false;

  const logPrices = prices.map(p => Math.log(Math.max(p, 0.01)));
  
  // Calculate growth rates in different halves
  const halfLen = Math.floor(logPrices.length / 2);
  const firstHalf = logPrices.slice(0, halfLen);
  const secondHalf = logPrices.slice(halfLen);

  // Linear growth rate in each half
  const growthRate1 = (firstHalf[firstHalf.length - 1] - firstHalf[0]) / firstHalf.length;
  const growthRate2 = (secondHalf[secondHalf.length - 1] - secondHalf[0]) / secondHalf.length;

  // Super-exponential: second half grows faster than first half
  // AND both are positive (upward trend)
  if (growthRate1 > 0 && growthRate2 > 0 && growthRate2 > growthRate1 * 1.3) {
    return true;
  }

  // Also check acceleration of growth (third derivative positive)
  const quarterLen = Math.floor(logPrices.length / 4);
  const rates: number[] = [];
  for (let i = 0; i < 4; i++) {
    const segment = logPrices.slice(i * quarterLen, (i + 1) * quarterLen);
    if (segment.length > 1) {
      rates.push((segment[segment.length - 1] - segment[0]) / segment.length);
    }
  }

  // Check if growth is accelerating (each quarter faster than previous)
  if (rates.length >= 3) {
    const accelerating = rates.every((r, i) => i === 0 || r > rates[i - 1]);
    if (accelerating && rates[rates.length - 1] > 0) return true;
  }

  return false;
}

/**
 * Check for log-periodic oscillations using Lomb-Scargle-like approach
 * Looks for periodic patterns in the residuals after removing the trend
 */
function checkLogPeriodicOscillation(prices: number[]): boolean {
  if (prices.length < 60) return false;

  const logPrices = prices.map(p => Math.log(Math.max(p, 0.01)));
  const n = logPrices.length;

  // Remove linear trend
  const xMean = (n - 1) / 2;
  const yMean = logPrices.reduce((a, b) => a + b, 0) / n;
  
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (i - xMean) * (logPrices[i] - yMean);
    sxx += (i - xMean) ** 2;
  }
  const slope = sxy / sxx;
  const intercept = yMean - slope * xMean;

  // Detrended residuals
  const residuals = logPrices.map((p, i) => p - (slope * i + intercept));

  // Check for periodicity in log-time using spectral analysis
  // Transform to log-time and look for peaks
  const logTimeResiduals: number[] = [];
  for (let i = 1; i < n; i++) {
    const logT = Math.log(n - i); // log(tc - t) approximation
    logTimeResiduals.push(residuals[i]);
  }

  // Simple periodicity check: count zero crossings
  let zeroCrossings = 0;
  for (let i = 1; i < logTimeResiduals.length; i++) {
    if (logTimeResiduals[i] * logTimeResiduals[i - 1] < 0) {
      zeroCrossings++;
    }
  }

  // Expected zero crossings for log-periodic: between 3 and 15 for typical ω range
  const expectedMinCrossings = Math.max(3, Math.floor(logTimeResiduals.length / 30));
  const expectedMaxCrossings = Math.min(20, Math.floor(logTimeResiduals.length / 5));

  if (zeroCrossings >= expectedMinCrossings && zeroCrossings <= expectedMaxCrossings) {
    // Additional check: oscillation amplitude should be significant
    const maxResidual = Math.max(...residuals.map(Math.abs));
    const priceRange = Math.max(...logPrices) - Math.min(...logPrices);
    
    if (maxResidual > priceRange * 0.02) { // At least 2% of total range
      return true;
    }
  }

  return false;
}

/**
 * Calculate portfolio-level bubble exposure
 */
export function calculatePortfolioBubbleExposure(
  holdings: Array<{ ticker: string; weight: number; bubbleConfidence: number }>
): {
  exposureScore: number;        // Weighted bubble exposure [0, 1]
  highRiskPercentage: number;   // % of NAV in high-confidence bubble assets
  riskLevel: 'low' | 'moderate' | 'elevated' | 'high' | 'extreme';
  topRisks: Array<{ ticker: string; confidence: number; weight: number }>;
} {
  let weightedExposure = 0;
  let highRiskNAV = 0;
  const topRisks: Array<{ ticker: string; confidence: number; weight: number }> = [];

  for (const h of holdings) {
    weightedExposure += h.weight * h.bubbleConfidence;
    if (h.bubbleConfidence > 0.6) {
      highRiskNAV += h.weight;
      topRisks.push({ ticker: h.ticker, confidence: h.bubbleConfidence, weight: h.weight });
    }
  }

  // Sort top risks by confidence * weight
  topRisks.sort((a, b) => (b.confidence * b.weight) - (a.confidence * a.weight));

  // Determine risk level
  let riskLevel: 'low' | 'moderate' | 'elevated' | 'high' | 'extreme';
  if (weightedExposure < 0.15) riskLevel = 'low';
  else if (weightedExposure < 0.3) riskLevel = 'moderate';
  else if (weightedExposure < 0.5) riskLevel = 'elevated';
  else if (weightedExposure < 0.7) riskLevel = 'high';
  else riskLevel = 'extreme';

  return {
    exposureScore: Math.round(weightedExposure * 100) / 100,
    highRiskPercentage: Math.round(highRiskNAV * 100),
    riskLevel,
    topRisks: topRisks.slice(0, 5),
  };
}
