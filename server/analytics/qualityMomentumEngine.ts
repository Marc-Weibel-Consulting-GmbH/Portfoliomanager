/**
 * Quality & Momentum Factor Engines
 * ===================================
 * Layer 2 Signal Model extension:
 * - Quality Factor: ROE, Debt/Equity, FCF-Yield, Gross Margin
 * - Momentum Factor: Relative Strength vs Sector, 3M/6M/12M Momentum, Price Acceleration
 */

export interface QualityMetrics {
  roe: number | null;           // Return on Equity (%)
  debtToEquity: number | null;  // Debt/Equity ratio
  fcfYield: number | null;      // Free Cash Flow Yield (%)
  grossMargin: number | null;   // Gross Margin (%)
}

export interface QualityScore {
  score: number;        // -1 to +1 (normalized)
  rawScore: number;     // Raw composite score
  components: {
    roe: { value: number | null; score: number; label: string };
    debtToEquity: { value: number | null; score: number; label: string };
    fcfYield: { value: number | null; score: number; label: string };
    grossMargin: { value: number | null; score: number; label: string };
  };
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

export interface MomentumMetrics {
  prices: number[];           // Historical prices (most recent last)
  sectorPrices?: number[];    // Sector ETF prices for relative strength
  ticker?: string;
}

export interface MomentumScore {
  score: number;        // -1 to +1 (normalized)
  rawScore: number;     // Raw composite score
  components: {
    momentum3m: { value: number | null; score: number; label: string };
    momentum6m: { value: number | null; score: number; label: string };
    momentum12m: { value: number | null; score: number; label: string };
    relativeStrength: { value: number | null; score: number; label: string };
    acceleration: { value: number | null; score: number; label: string };
  };
  trend: 'strong_up' | 'up' | 'neutral' | 'down' | 'strong_down';
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

/**
 * Calculate Quality Factor Score
 * 
 * Scoring logic:
 * - ROE: >20% = excellent, 12-20% = good, 8-12% = fair, <8% = poor, <0% = very poor
 * - Debt/Equity: <0.3 = excellent, 0.3-0.7 = good, 0.7-1.5 = fair, >1.5 = poor, >3 = very poor
 * - FCF Yield: >8% = excellent, 5-8% = good, 3-5% = fair, 0-3% = poor, <0% = very poor
 * - Gross Margin: >60% = excellent, 40-60% = good, 25-40% = fair, <25% = poor
 */
export function calculateQualityScore(metrics: QualityMetrics): QualityScore {
  const components = {
    roe: scoreROE(metrics.roe),
    debtToEquity: scoreDebtToEquity(metrics.debtToEquity),
    fcfYield: scoreFCFYield(metrics.fcfYield),
    grossMargin: scoreGrossMargin(metrics.grossMargin),
  };

  // Weighted composite (ROE most important for quality)
  const weights = { roe: 0.35, debtToEquity: 0.25, fcfYield: 0.25, grossMargin: 0.15 };
  let totalWeight = 0;
  let weightedSum = 0;

  for (const [key, weight] of Object.entries(weights)) {
    const comp = components[key as keyof typeof components];
    if (comp.value !== null) {
      weightedSum += comp.score * weight;
      totalWeight += weight;
    }
  }

  const rawScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
  const score = Math.max(-1, Math.min(1, rawScore));

  // Grade assignment
  let grade: 'A' | 'B' | 'C' | 'D' | 'F';
  if (score >= 0.6) grade = 'A';
  else if (score >= 0.3) grade = 'B';
  else if (score >= 0) grade = 'C';
  else if (score >= -0.3) grade = 'D';
  else grade = 'F';

  return { score, rawScore, components, grade };
}

/**
 * Calculate Momentum Factor Score
 * 
 * Uses multi-timeframe momentum with acceleration detection:
 * - 3M Momentum: Short-term trend
 * - 6M Momentum: Medium-term trend
 * - 12M Momentum: Long-term trend (most weight)
 * - Relative Strength: Performance vs sector/market
 * - Acceleration: Is momentum increasing or decreasing?
 */
export function calculateMomentumScore(metrics: MomentumMetrics): MomentumScore {
  const { prices, sectorPrices } = metrics;

  const components = {
    momentum3m: calcMomentum(prices, 63),    // ~3 months trading days
    momentum6m: calcMomentum(prices, 126),   // ~6 months
    momentum12m: calcMomentum(prices, 252),  // ~12 months
    relativeStrength: calcRelativeStrength(prices, sectorPrices, 126),
    acceleration: calcAcceleration(prices),
  };

  // Weighted composite (12M momentum most important per academic research)
  const weights = { momentum3m: 0.15, momentum6m: 0.20, momentum12m: 0.30, relativeStrength: 0.20, acceleration: 0.15 };
  let totalWeight = 0;
  let weightedSum = 0;

  for (const [key, weight] of Object.entries(weights)) {
    const comp = components[key as keyof typeof components];
    if (comp.value !== null) {
      weightedSum += comp.score * weight;
      totalWeight += weight;
    }
  }

  const rawScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
  const score = Math.max(-1, Math.min(1, rawScore));

  // Trend classification
  let trend: 'strong_up' | 'up' | 'neutral' | 'down' | 'strong_down';
  if (score >= 0.5) trend = 'strong_up';
  else if (score >= 0.15) trend = 'up';
  else if (score >= -0.15) trend = 'neutral';
  else if (score >= -0.5) trend = 'down';
  else trend = 'strong_down';

  // Grade based on normalized score
  let grade: 'A' | 'B' | 'C' | 'D' | 'F';
  if (score >= 0.5) grade = 'A';
  else if (score >= 0.2) grade = 'B';
  else if (score >= -0.2) grade = 'C';
  else if (score >= -0.5) grade = 'D';
  else grade = 'F';

  return { score, rawScore, components, trend, grade };
}

// ─── Quality Component Scorers ───────────────────────────────────────────────

function scoreROE(roe: number | null): { value: number | null; score: number; label: string } {
  if (roe === null || isNaN(roe)) return { value: null, score: 0, label: 'N/A' };
  let score: number;
  let label: string;
  if (roe >= 25) { score = 1; label = 'Exzellent'; }
  else if (roe >= 20) { score = 0.7; label = 'Sehr gut'; }
  else if (roe >= 12) { score = 0.4; label = 'Gut'; }
  else if (roe >= 8) { score = 0.1; label = 'Fair'; }
  else if (roe >= 0) { score = -0.3; label = 'Schwach'; }
  else { score = -0.8; label = 'Negativ'; }
  return { value: roe, score, label };
}

function scoreDebtToEquity(de: number | null): { value: number | null; score: number; label: string } {
  if (de === null || isNaN(de)) return { value: null, score: 0, label: 'N/A' };
  let score: number;
  let label: string;
  if (de < 0.3) { score = 0.8; label = 'Sehr niedrig'; }
  else if (de < 0.7) { score = 0.5; label = 'Niedrig'; }
  else if (de < 1.0) { score = 0.2; label = 'Moderat'; }
  else if (de < 1.5) { score = -0.1; label = 'Erhöht'; }
  else if (de < 3.0) { score = -0.5; label = 'Hoch'; }
  else { score = -0.9; label = 'Sehr hoch'; }
  return { value: de, score, label };
}

function scoreFCFYield(fcf: number | null): { value: number | null; score: number; label: string } {
  if (fcf === null || isNaN(fcf)) return { value: null, score: 0, label: 'N/A' };
  let score: number;
  let label: string;
  if (fcf >= 10) { score = 1; label = 'Exzellent'; }
  else if (fcf >= 7) { score = 0.7; label = 'Sehr gut'; }
  else if (fcf >= 5) { score = 0.4; label = 'Gut'; }
  else if (fcf >= 3) { score = 0.1; label = 'Fair'; }
  else if (fcf >= 0) { score = -0.3; label = 'Schwach'; }
  else { score = -0.7; label = 'Negativ'; }
  return { value: fcf, score, label };
}

function scoreGrossMargin(gm: number | null): { value: number | null; score: number; label: string } {
  if (gm === null || isNaN(gm)) return { value: null, score: 0, label: 'N/A' };
  let score: number;
  let label: string;
  if (gm >= 70) { score = 0.9; label = 'Exzellent'; }
  else if (gm >= 50) { score = 0.6; label = 'Sehr gut'; }
  else if (gm >= 35) { score = 0.3; label = 'Gut'; }
  else if (gm >= 20) { score = 0; label = 'Fair'; }
  else { score = -0.4; label = 'Schwach'; }
  return { value: gm, score, label };
}

// ─── Momentum Component Calculators ──────────────────────────────────────────

function calcMomentum(prices: number[], lookback: number): { value: number | null; score: number; label: string } {
  if (prices.length < lookback + 1) return { value: null, score: 0, label: 'N/A' };

  const current = prices[prices.length - 1];
  const past = prices[prices.length - 1 - lookback];
  if (!current || !past || past === 0) return { value: null, score: 0, label: 'N/A' };

  const returnPct = ((current - past) / past) * 100;

  // Score based on return magnitude
  let score: number;
  let label: string;
  if (returnPct >= 40) { score = 1; label = `+${returnPct.toFixed(1)}% (Stark)`; }
  else if (returnPct >= 20) { score = 0.7; label = `+${returnPct.toFixed(1)}% (Gut)`; }
  else if (returnPct >= 8) { score = 0.4; label = `+${returnPct.toFixed(1)}%`; }
  else if (returnPct >= 0) { score = 0.1; label = `+${returnPct.toFixed(1)}%`; }
  else if (returnPct >= -8) { score = -0.1; label = `${returnPct.toFixed(1)}%`; }
  else if (returnPct >= -20) { score = -0.5; label = `${returnPct.toFixed(1)}% (Schwach)`; }
  else { score = -0.9; label = `${returnPct.toFixed(1)}% (Crash)`; }

  return { value: returnPct, score, label };
}

function calcRelativeStrength(
  prices: number[],
  sectorPrices: number[] | undefined,
  lookback: number
): { value: number | null; score: number; label: string } {
  if (!sectorPrices || sectorPrices.length < lookback + 1 || prices.length < lookback + 1) {
    return { value: null, score: 0, label: 'N/A' };
  }

  const stockReturn = (prices[prices.length - 1] - prices[prices.length - 1 - lookback]) / prices[prices.length - 1 - lookback];
  const sectorReturn = (sectorPrices[sectorPrices.length - 1] - sectorPrices[sectorPrices.length - 1 - lookback]) / sectorPrices[sectorPrices.length - 1 - lookback];

  const relStrength = (stockReturn - sectorReturn) * 100; // Outperformance in %

  let score: number;
  let label: string;
  if (relStrength >= 20) { score = 0.9; label = `+${relStrength.toFixed(1)}% vs Sektor`; }
  else if (relStrength >= 10) { score = 0.6; label = `+${relStrength.toFixed(1)}% vs Sektor`; }
  else if (relStrength >= 3) { score = 0.3; label = `+${relStrength.toFixed(1)}% vs Sektor`; }
  else if (relStrength >= -3) { score = 0; label = `${relStrength.toFixed(1)}% (Inline)`; }
  else if (relStrength >= -10) { score = -0.3; label = `${relStrength.toFixed(1)}% vs Sektor`; }
  else if (relStrength >= -20) { score = -0.6; label = `${relStrength.toFixed(1)}% vs Sektor`; }
  else { score = -0.9; label = `${relStrength.toFixed(1)}% (Stark unter Sektor)`; }

  return { value: relStrength, score, label };
}

function calcAcceleration(prices: number[]): { value: number | null; score: number; label: string } {
  // Compare recent momentum (1M) vs prior momentum (1M before that)
  if (prices.length < 44) return { value: null, score: 0, label: 'N/A' }; // Need at least ~2 months

  const current = prices[prices.length - 1];
  const oneMonthAgo = prices[prices.length - 22];
  const twoMonthsAgo = prices[prices.length - 44];

  if (!current || !oneMonthAgo || !twoMonthsAgo || oneMonthAgo === 0 || twoMonthsAgo === 0) {
    return { value: null, score: 0, label: 'N/A' };
  }

  const recentMom = (current - oneMonthAgo) / oneMonthAgo;
  const priorMom = (oneMonthAgo - twoMonthsAgo) / twoMonthsAgo;
  const acceleration = (recentMom - priorMom) * 100; // Difference in momentum

  let score: number;
  let label: string;
  if (acceleration >= 10) { score = 0.8; label = 'Stark beschleunigend'; }
  else if (acceleration >= 4) { score = 0.5; label = 'Beschleunigend'; }
  else if (acceleration >= -2) { score = 0.1; label = 'Stabil'; }
  else if (acceleration >= -6) { score = -0.3; label = 'Verlangsamend'; }
  else { score = -0.7; label = 'Stark verlangsamend'; }

  return { value: acceleration, score, label };
}

/**
 * Fetch quality metrics from Yahoo Finance quoteSummary
 * Returns ROE, Debt/Equity, FCF Yield, Gross Margin
 */
export function extractQualityFromYahoo(summary: any): QualityMetrics {
  const fd = summary?.financialData;
  const ks = summary?.defaultKeyStatistics;
  const bs = summary?.balanceSheetHistory?.balanceSheetStatements?.[0];
  const cf = summary?.cashflowStatementHistory?.cashflowStatements?.[0];
  const is_ = summary?.incomeStatementHistory?.incomeStatementHistory?.[0];

  let roe: number | null = null;
  let debtToEquity: number | null = null;
  let fcfYield: number | null = null;
  let grossMargin: number | null = null;

  // ROE from financialData or calculate from income/equity
  if (fd?.returnOnEquity) {
    roe = fd.returnOnEquity * 100;
  }

  // Debt/Equity from financialData
  if (fd?.debtToEquity) {
    debtToEquity = fd.debtToEquity / 100; // Yahoo returns as percentage
  }

  // FCF Yield = Free Cash Flow / Market Cap
  if (fd?.freeCashflow && ks?.marketCap) {
    fcfYield = (fd.freeCashflow / ks.marketCap) * 100;
  } else if (cf?.totalCashFromOperatingActivities && cf?.capitalExpenditures && ks?.marketCap) {
    const fcf = cf.totalCashFromOperatingActivities + cf.capitalExpenditures; // capex is negative
    fcfYield = (fcf / ks.marketCap) * 100;
  }

  // Gross Margin
  if (fd?.grossMargins) {
    grossMargin = fd.grossMargins * 100;
  } else if (is_?.grossProfit && is_?.totalRevenue && is_.totalRevenue > 0) {
    grossMargin = (is_.grossProfit / is_.totalRevenue) * 100;
  }

  return { roe, debtToEquity, fcfYield, grossMargin };
}
