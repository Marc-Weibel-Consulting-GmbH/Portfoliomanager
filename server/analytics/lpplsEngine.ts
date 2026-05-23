/**
 * LPPLS Bubble Detector Engine v2
 * ================================
 * Enhanced implementation based on:
 * - Sornette et al. (2015): Filter conditions (Table 1)
 * - Fantazzini (2016): Shrinking window approach, fraction-based confidence
 * - Cao et al. (2025): BubbleScore with sentiment amplification
 *
 * The LPPLS model fits price data to:
 *   ln(p(t)) = A + B * (tc - t)^m + C * (tc - t)^m * cos(ω * ln(tc - t) + φ)
 *
 * Key improvements over v1:
 * 1. Shrinking window approach (multiple fits per endpoint)
 * 2. Fraction-based confidence (count valid fits / total fits)
 * 3. Sornette filter conditions (m, ω, tc, oscillations, damping, relative error)
 * 4. Separate positive/negative bubble confidence
 * 5. BubbleScore = normalized LPPLS confidence * (1 + sentiment amplification)
 */

export interface LPPLSResult {
  bubbleConfidence: number;          // [0, 1] - overall bubble confidence (fraction of valid fits)
  posBubbleConfidence: number;       // [0, 1] - positive bubble confidence
  negBubbleConfidence: number;       // [0, 1] - negative bubble confidence
  bubbleScore: number;               // [-1, 1] - continuous BubbleScore (Cao et al.)
  criticalTime: Date | null;         // Estimated tc (crash/correction date)
  daysUntilCritical: number | null;  // Days until tc
  regime: 'bubble' | 'normal' | 'negative_bubble';
  avgM: number | null;               // Average power law exponent across valid fits
  avgOmega: number | null;           // Average log-periodic frequency across valid fits
  numValidFits: number;              // Number of fits passing Sornette conditions
  totalFits: number;                 // Total number of fits attempted
  superExponentialGrowth: boolean;
  logPeriodicOscillation: boolean;
}

export interface BubbleScoreInput {
  prices: number[];
  dates?: Date[];
  sentimentScore?: number;  // [-1, 1] from sentiment engine
  sentimentConfidence?: number; // [0, 1]
}

interface FitResult {
  valid: boolean;
  isPosBubble: boolean;
  isNegBubble: boolean;
  tc: number;
  m: number;
  omega: number;
  A: number;
  B: number;
  C: number;  // amplitude sqrt(C1² + C2²)
  numOscillations: number;
  damping: number;
  relativeError: number;
  rSquared: number;
}

// ═══════════════════════════════════════════════════════════════
// Sornette et al. (2015) Filter Conditions (Table 1, Condition 1)
// ═══════════════════════════════════════════════════════════════
const FILTER = {
  m_min: 0.01,         // Power law exponent lower bound
  m_max: 1.2,          // Power law exponent upper bound
  omega_min: 2,        // Log-periodic frequency lower bound
  omega_max: 25,       // Log-periodic frequency upper bound
  tc_min_ratio: 0.95,  // tc must be > 95% of window length
  tc_max_ratio: 1.11,  // tc must be < 111% of window length
  num_osc_min: 2.5,    // Minimum number of oscillations
  damping_min: 0.8,    // Minimum damping ratio
  rel_error_max: 0.05, // Maximum relative error
};

// ═══════════════════════════════════════════════════════════════
// Main API
// ═══════════════════════════════════════════════════════════════

/**
 * Main LPPLS analysis with BubbleScore
 * Uses shrinking window approach (Fantazzini) with Sornette filter conditions
 */
export function detectBubble(input: BubbleScoreInput): LPPLSResult {
  const { prices, dates, sentimentScore, sentimentConfidence } = input;

  if (prices.length < 60) {
    return emptyResult();
  }

  // ─── Shrinking Window Analysis ───
  // For each endpoint (t2 = last observation), we create multiple windows
  // by shrinking from the maximum window size down to a minimum
  const maxWindow = Math.min(prices.length, 500);
  const minWindow = 60;
  const stepSize = Math.max(20, Math.floor((maxWindow - minWindow) / 8)); // ~8 windows

  const fitResults: FitResult[] = [];

  for (let windowSize = maxWindow; windowSize >= minWindow; windowSize -= stepSize) {
    const windowPrices = prices.slice(-windowSize);
    const result = fitAndFilter(windowPrices);
    fitResults.push(result);
  }

  const totalFits = fitResults.length;
  const validFits = fitResults.filter(f => f.valid);
  const posBubbleFits = fitResults.filter(f => f.isPosBubble);
  const negBubbleFits = fitResults.filter(f => f.isNegBubble);

  // ─── Fraction-based Confidence (Fantazzini) ───
  const bubbleConfidence = totalFits > 0 ? validFits.length / totalFits : 0;
  const posBubbleConfidence = totalFits > 0 ? posBubbleFits.length / totalFits : 0;
  const negBubbleConfidence = totalFits > 0 ? negBubbleFits.length / totalFits : 0;

  // ─── Average parameters from valid fits ───
  let avgM: number | null = null;
  let avgOmega: number | null = null;
  let avgTc: number | null = null;

  if (validFits.length > 0) {
    avgM = validFits.reduce((s, f) => s + f.m, 0) / validFits.length;
    avgOmega = validFits.reduce((s, f) => s + f.omega, 0) / validFits.length;
    avgTc = validFits.reduce((s, f) => s + f.tc, 0) / validFits.length;
  }

  // ─── Critical Time estimation ───
  let criticalTime: Date | null = null;
  let daysUntilCritical: number | null = null;

  if (avgTc !== null && dates && dates.length > 0) {
    const lastDate = dates[dates.length - 1] || new Date();
    const daysAhead = avgTc - prices.length; // tc relative to window start
    if (daysAhead > 0 && daysAhead < 365) {
      const tcDate = new Date(lastDate.getTime() + daysAhead * 24 * 60 * 60 * 1000);
      if (tcDate > new Date()) {
        criticalTime = tcDate;
        daysUntilCritical = Math.round((tcDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
      }
    }
  }

  // ─── Super-exponential growth check ───
  const superExponentialGrowth = checkSuperExponentialGrowth(prices);

  // ─── Log-periodic oscillation check ───
  const logPeriodicOscillation = checkLogPeriodicOscillation(prices);

  // ─── Determine regime ───
  let regime: 'bubble' | 'normal' | 'negative_bubble' = 'normal';
  if (posBubbleConfidence > 0.3) {
    regime = 'bubble';
  } else if (negBubbleConfidence > 0.3) {
    regime = 'negative_bubble';
  }

  // ─── BubbleScore (Cao et al. inspired) ───
  // BubbleScore = ε_norm * (1 + sentimentAmplifier)
  // ε_norm is the signed confidence: positive for bubble, negative for neg-bubble
  let epsilonNorm = 0;
  if (regime === 'bubble') {
    epsilonNorm = posBubbleConfidence;
  } else if (regime === 'negative_bubble') {
    epsilonNorm = -negBubbleConfidence;
  }

  // Sentiment amplification (regime-dependent, Cao et al. Eq. 14)
  let sentimentAmplifier = 0;
  if (sentimentScore !== undefined && sentimentConfidence !== undefined && sentimentConfidence > 0.3) {
    const alpha1 = 0.3; // Hype/sentiment fusion weight
    if (epsilonNorm > 0) {
      // Positive bubble: bullish sentiment amplifies bubble signal
      sentimentAmplifier = alpha1 * Math.max(0, sentimentScore);
    } else if (epsilonNorm < 0) {
      // Negative bubble: bearish sentiment amplifies negative bubble
      sentimentAmplifier = alpha1 * Math.max(0, -sentimentScore);
    }
  }

  const bubbleScore = Math.max(-1, Math.min(1, epsilonNorm * (1 + sentimentAmplifier)));

  return {
    bubbleConfidence: Math.round(bubbleConfidence * 100) / 100,
    posBubbleConfidence: Math.round(posBubbleConfidence * 100) / 100,
    negBubbleConfidence: Math.round(negBubbleConfidence * 100) / 100,
    bubbleScore: Math.round(bubbleScore * 100) / 100,
    criticalTime,
    daysUntilCritical,
    regime,
    avgM: avgM !== null ? Math.round(avgM * 1000) / 1000 : null,
    avgOmega: avgOmega !== null ? Math.round(avgOmega * 100) / 100 : null,
    numValidFits: validFits.length,
    totalFits,
    superExponentialGrowth,
    logPeriodicOscillation,
  };
}

/**
 * Legacy-compatible wrapper (for existing code that calls detectBubble(prices, dates))
 */
export function detectBubbleLegacy(
  prices: number[],
  dates?: Date[]
): LPPLSResult {
  return detectBubble({ prices, dates });
}

// ═══════════════════════════════════════════════════════════════
// Core Fitting & Filtering
// ═══════════════════════════════════════════════════════════════

/**
 * Fit LPPLS model to a window and apply Sornette filter conditions
 */
function fitAndFilter(prices: number[]): FitResult {
  const n = prices.length;
  const logPrices = prices.map(p => Math.log(Math.max(p, 0.01)));

  // Grid search over tc, m, omega
  const tcValues = generateTcRange(n);
  const mValues = [0.05, 0.1, 0.15, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1];
  const omegaValues = [3, 4, 5, 6, 7, 8, 10, 12, 14, 16, 18, 20, 22, 24];

  let bestFit: { tc: number; m: number; omega: number; A: number; B: number; C1: number; C2: number; residual: number } | null = null;
  let bestResidual = Infinity;

  for (const tc of tcValues) {
    for (const m of mValues) {
      for (const omega of omegaValues) {
        const fit = fitLPPLS(logPrices, tc, m, omega);
        if (fit && fit.residual < bestResidual) {
          bestResidual = fit.residual;
          bestFit = fit;
        }
      }
    }
  }

  if (!bestFit) {
    return invalidFitResult();
  }

  // ─── Calculate derived metrics ───
  const { tc, m, omega, A, B, C1, C2, residual } = bestFit;
  const C = Math.sqrt(C1 * C1 + C2 * C2);

  // Number of oscillations: ω/(2π) * ln(|tc - t1| / |tc - t2|)
  // t1 = 0 (start of window), t2 = n-1 (end of window)
  const numOscillations = (tc > 0 && tc > n - 1)
    ? (omega / (2 * Math.PI)) * Math.log(Math.abs(tc / (tc - (n - 1))))
    : 0;

  // Damping: (m * |B|) / (ω * |C|)
  const damping = (omega * C > 0.0001)
    ? (m * Math.abs(B)) / (omega * C)
    : 0;

  // Relative error: mean(|Y - Yfit| / |Yfit|)
  let relativeError = 0;
  const meanLogPrice = logPrices.reduce((a, b) => a + b, 0) / n;
  const totalVariance = logPrices.reduce((sum, p) => sum + (p - meanLogPrice) ** 2, 0);
  const rSquared = totalVariance > 0 ? Math.max(0, 1 - (residual / totalVariance)) : 0;

  // Compute relative error from fitted values
  let relErrSum = 0;
  let relErrCount = 0;
  for (let t = 0; t < n; t++) {
    const dt = tc - t;
    if (dt <= 0) continue;
    const dtm = Math.pow(dt, m);
    const logDt = Math.log(dt);
    const predicted = A + B * dtm + C1 * dtm * Math.cos(omega * logDt) + C2 * dtm * Math.sin(omega * logDt);
    if (Math.abs(predicted) > 0.001) {
      relErrSum += Math.abs((logPrices[t] - predicted) / predicted);
      relErrCount++;
    }
  }
  relativeError = relErrCount > 0 ? relErrSum / relErrCount : 1;

  // ─── Apply Sornette Filter Conditions ───
  const tcRatio = tc / n;
  const validM = m >= FILTER.m_min && m <= FILTER.m_max;
  const validOmega = omega >= FILTER.omega_min && omega <= FILTER.omega_max;
  const validTc = tcRatio >= FILTER.tc_min_ratio && tcRatio <= FILTER.tc_max_ratio;
  const validOsc = numOscillations >= FILTER.num_osc_min;
  const validDamping = damping >= FILTER.damping_min;
  const validRelErr = relativeError <= FILTER.rel_error_max;

  const allConditionsMet = validM && validOmega && validTc && validOsc && validDamping && validRelErr;

  // ─── Fantazzini (2016) pos/neg bubble conditions ───
  // Positive bubble: m ∈ (0,1), B < 0
  const isPosBubble = allConditionsMet && m > 0 && m < 1 && B < 0;
  // Negative bubble: m ∈ (0,1), B > 0
  const isNegBubble = allConditionsMet && m > 0 && m < 1 && B > 0;

  return {
    valid: allConditionsMet,
    isPosBubble,
    isNegBubble,
    tc,
    m,
    omega,
    A,
    B,
    C,
    numOscillations,
    damping,
    relativeError,
    rSquared,
  };
}

/**
 * Generate tc search range based on window length
 * tc should be between 0.95*n and 1.11*n (Sornette condition)
 */
function generateTcRange(n: number): number[] {
  const tcMin = Math.floor(n * 0.95);
  const tcMax = Math.ceil(n * 1.11);
  const step = Math.max(1, Math.floor((tcMax - tcMin) / 8));
  const values: number[] = [];
  for (let tc = tcMin; tc <= tcMax; tc += step) {
    values.push(tc);
  }
  return values;
}

/**
 * Fit LPPLS model using Slave Equation (linear regression for A, B, C1, C2)
 * given fixed tc, m, omega
 */
function fitLPPLS(
  logPrices: number[],
  tc: number,
  m: number,
  omega: number
): { tc: number; m: number; omega: number; A: number; B: number; C1: number; C2: number; residual: number } | null {
  const n = logPrices.length;

  // Build design matrix
  // ln(p(t)) = A + B*(tc-t)^m + C1*(tc-t)^m*cos(ω*ln(tc-t)) + C2*(tc-t)^m*sin(ω*ln(tc-t))
  const X: number[][] = [];
  const y: number[] = [];

  for (let t = 0; t < n; t++) {
    const dt = tc - t;
    if (dt <= 0) return null;

    const dtm = Math.pow(dt, m);
    const logDt = Math.log(dt);
    const cosVal = Math.cos(omega * logDt);
    const sinVal = Math.sin(omega * logDt);

    X.push([1, dtm, dtm * cosVal, dtm * sinVal]);
    y.push(logPrices[t]);
  }

  // Solve normal equations: (X'X)^-1 * X'y
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

// ═══════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════

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

  // Gaussian elimination with partial pivoting
  const augmented: number[][] = XtX.map((row, i) => [...row, Xty[i]]);

  for (let col = 0; col < p; col++) {
    let maxRow = col;
    let maxVal = Math.abs(augmented[col][col]);
    for (let row = col + 1; row < p; row++) {
      if (Math.abs(augmented[row][col]) > maxVal) {
        maxVal = Math.abs(augmented[row][col]);
        maxRow = row;
      }
    }

    if (maxVal < 1e-12) return null; // Singular

    if (maxRow !== col) {
      [augmented[col], augmented[maxRow]] = [augmented[maxRow], augmented[col]];
    }

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
 */
function checkSuperExponentialGrowth(prices: number[]): boolean {
  if (prices.length < 60) return false;

  const logPrices = prices.map(p => Math.log(Math.max(p, 0.01)));

  // Compare growth rates in quarters
  const quarterLen = Math.floor(logPrices.length / 4);
  const rates: number[] = [];
  for (let i = 0; i < 4; i++) {
    const segment = logPrices.slice(i * quarterLen, (i + 1) * quarterLen);
    if (segment.length > 1) {
      rates.push((segment[segment.length - 1] - segment[0]) / segment.length);
    }
  }

  // Super-exponential: growth accelerating AND all positive
  if (rates.length >= 3) {
    const allPositive = rates.every(r => r > 0);
    const accelerating = rates.slice(1).every((r, i) => r > rates[i] * 1.2);
    if (allPositive && accelerating) return true;
  }

  // Also check half-split
  const halfLen = Math.floor(logPrices.length / 2);
  const rate1 = (logPrices[halfLen - 1] - logPrices[0]) / halfLen;
  const rate2 = (logPrices[logPrices.length - 1] - logPrices[halfLen]) / (logPrices.length - halfLen);

  return rate1 > 0 && rate2 > 0 && rate2 > rate1 * 1.3;
}

/**
 * Check for log-periodic oscillations in detrended residuals
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

  // Count zero crossings
  let zeroCrossings = 0;
  for (let i = 1; i < residuals.length; i++) {
    if (residuals[i] * residuals[i - 1] < 0) {
      zeroCrossings++;
    }
  }

  // Expected for log-periodic: between 4 and 15
  const minCrossings = 4;
  const maxCrossings = Math.min(18, Math.floor(n / 5));

  if (zeroCrossings >= minCrossings && zeroCrossings <= maxCrossings) {
    // Amplitude check: oscillations must be significant
    const maxResidual = Math.max(...residuals.map(Math.abs));
    const priceRange = Math.max(...logPrices) - Math.min(...logPrices);
    if (priceRange > 0 && maxResidual > priceRange * 0.02) {
      return true;
    }
  }

  return false;
}

function emptyResult(): LPPLSResult {
  return {
    bubbleConfidence: 0,
    posBubbleConfidence: 0,
    negBubbleConfidence: 0,
    bubbleScore: 0,
    criticalTime: null,
    daysUntilCritical: null,
    regime: 'normal',
    avgM: null,
    avgOmega: null,
    numValidFits: 0,
    totalFits: 0,
    superExponentialGrowth: false,
    logPeriodicOscillation: false,
  };
}

function invalidFitResult(): FitResult {
  return {
    valid: false,
    isPosBubble: false,
    isNegBubble: false,
    tc: 0,
    m: 0,
    omega: 0,
    A: 0,
    B: 0,
    C: 0,
    numOscillations: 0,
    damping: 0,
    relativeError: 1,
    rSquared: 0,
  };
}

// ═══════════════════════════════════════════════════════════════
// Portfolio-Level Analysis
// ═══════════════════════════════════════════════════════════════

/**
 * Calculate portfolio-level bubble exposure
 */
export function calculatePortfolioBubbleExposure(
  holdings: Array<{ ticker: string; weight: number; bubbleConfidence: number; bubbleScore?: number }>
): {
  exposureScore: number;
  avgBubbleScore: number;
  highRiskPercentage: number;
  riskLevel: 'low' | 'moderate' | 'elevated' | 'high' | 'extreme';
  topRisks: Array<{ ticker: string; confidence: number; bubbleScore: number; weight: number }>;
} {
  let weightedExposure = 0;
  let weightedBubbleScore = 0;
  let highRiskNAV = 0;
  const topRisks: Array<{ ticker: string; confidence: number; bubbleScore: number; weight: number }> = [];

  for (const h of holdings) {
    weightedExposure += h.weight * h.bubbleConfidence;
    weightedBubbleScore += h.weight * (h.bubbleScore ?? 0);
    if (h.bubbleConfidence > 0.5) {
      highRiskNAV += h.weight;
      topRisks.push({
        ticker: h.ticker,
        confidence: h.bubbleConfidence,
        bubbleScore: h.bubbleScore ?? 0,
        weight: h.weight,
      });
    }
  }

  topRisks.sort((a, b) => (b.confidence * b.weight) - (a.confidence * a.weight));

  let riskLevel: 'low' | 'moderate' | 'elevated' | 'high' | 'extreme';
  if (weightedExposure < 0.15) riskLevel = 'low';
  else if (weightedExposure < 0.3) riskLevel = 'moderate';
  else if (weightedExposure < 0.5) riskLevel = 'elevated';
  else if (weightedExposure < 0.7) riskLevel = 'high';
  else riskLevel = 'extreme';

  return {
    exposureScore: Math.round(weightedExposure * 100) / 100,
    avgBubbleScore: Math.round(weightedBubbleScore * 100) / 100,
    highRiskPercentage: Math.round(highRiskNAV * 100),
    riskLevel,
    topRisks: topRisks.slice(0, 5),
  };
}
