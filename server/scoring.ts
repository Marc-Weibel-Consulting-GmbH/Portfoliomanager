/**
 * Stock Scoring System
 * Evaluates dividend and growth stocks with traffic light indicators (Red/Orange/Yellow/Green)
 */

export type StockType = 'dividend' | 'growth';
export type ScoreColor = 'red' | 'orange' | 'yellow' | 'green';

export interface StockMetrics {
  // Dividend stock metrics
  dividendYield?: number;        // in %
  payoutRatio?: number;          // in %
  equityRatio?: number;          // in %
  peRatio?: number;              // P/E ratio
  
  // Growth stock metrics
  pegRatio?: number;             // PEG ratio
  earningsGrowth?: number;       // 5-year CAGR in %
  fcfYield?: number;             // Free Cash Flow Yield in %
  revenueGrowth?: number;        // 5-year CAGR in %
}

export interface SubScore {
  metric: string;
  value: number | null;
  score: number;
  weight: number;
  color: ScoreColor;
}

export interface StockScore {
  ticker: string;
  type: StockType;
  totalScore: number;
  color: ScoreColor;
  subScores: SubScore[];
}

/**
 * Calculate subscore for a single metric with linear interpolation
 */
function calcSubscore(
  value: number | undefined | null,
  thresholds: [number, number, number, number],
  inverted: boolean = false
): { score: number; color: ScoreColor } {
  if (value === undefined || value === null || isNaN(value)) {
    return { score: 0, color: 'red' };
  }

  const [redMax, orangeMax, yellowMax, greenMin] = thresholds;

  // For inverted metrics (lower is better), flip the value
  const effectiveValue = inverted ? -value : value;
  const [r, o, y, g] = inverted ? [-greenMin, -yellowMax, -orangeMax, -redMax] : [redMax, orangeMax, yellowMax, greenMin];

  let score: number;
  let color: ScoreColor;

  if (effectiveValue <= r) {
    // Red zone
    score = 12.5;
    color = 'red';
  } else if (effectiveValue <= o) {
    // Orange zone - interpolate between red and orange
    const progress = (effectiveValue - r) / (o - r);
    score = 12.5 + progress * 25;
    color = 'orange';
  } else if (effectiveValue <= y) {
    // Yellow zone - interpolate between orange and yellow
    const progress = (effectiveValue - o) / (y - o);
    score = 37.5 + progress * 25;
    color = 'yellow';
  } else {
    // Green zone - interpolate from yellow to green
    const progress = Math.min((effectiveValue - y) / (g - y), 1);
    score = 62.5 + progress * 25;
    color = 'green';
  }

  return { score: Math.max(0, Math.min(100, score)), color };
}

/**
 * Determine stock type based on metrics
 */
export function determineStockType(metrics: StockMetrics): StockType {
  // If dividend yield > 2% and payout ratio exists, likely dividend stock
  if (metrics.dividendYield && metrics.dividendYield > 2 && metrics.payoutRatio !== undefined) {
    return 'dividend';
  }
  
  // If PEG ratio or high growth rates exist, likely growth stock
  if (metrics.pegRatio !== undefined || 
      (metrics.earningsGrowth && metrics.earningsGrowth > 15) ||
      (metrics.revenueGrowth && metrics.revenueGrowth > 15)) {
    return 'growth';
  }
  
  // Default: if dividend yield exists, dividend stock, otherwise growth
  return metrics.dividendYield !== undefined ? 'dividend' : 'growth';
}

/**
 * Calculate score for dividend stock
 */
function scoreDividendStock(metrics: StockMetrics): SubScore[] {
  const subScores: SubScore[] = [];

  // 1. Dividend Yield (30%)
  const divYield = calcSubscore(
    metrics.dividendYield,
    [2, 3, 5, 5],  // <2% red, 2-3% orange, 3-5% yellow, >5% green
    false
  );
  subScores.push({
    metric: 'Dividendenrendite',
    value: metrics.dividendYield ?? null,
    score: divYield.score,
    weight: 0.30,
    color: divYield.color,
  });

  // 2. Payout Ratio (25%) - inverted (lower is better)
  const payout = calcSubscore(
    metrics.payoutRatio,
    [50, 70, 80, 80],  // <50% green, 50-70% yellow, 70-80% orange, >80% red
    true
  );
  subScores.push({
    metric: 'Ausschüttungsquote',
    value: metrics.payoutRatio ?? null,
    score: payout.score,
    weight: 0.25,
    color: payout.color,
  });

  // 3. Equity Ratio (25%)
  const equity = calcSubscore(
    metrics.equityRatio,
    [30, 40, 60, 60],  // <30% red, 30-40% orange, 40-60% yellow, >60% green
    false
  );
  subScores.push({
    metric: 'Eigenkapitalquote',
    value: metrics.equityRatio ?? null,
    score: equity.score,
    weight: 0.25,
    color: equity.color,
  });

  // 4. P/E Ratio (20%) - inverted (lower is better)
  const pe = calcSubscore(
    metrics.peRatio,
    [12, 20, 25, 25],  // <12 green, 12-20 yellow, 20-25 orange, >25 red
    true
  );
  subScores.push({
    metric: 'KGV',
    value: metrics.peRatio ?? null,
    score: pe.score,
    weight: 0.20,
    color: pe.color,
  });

  return subScores;
}

/**
 * Calculate score for growth stock
 */
function scoreGrowthStock(metrics: StockMetrics): SubScore[] {
  const subScores: SubScore[] = [];

  // 1. PEG Ratio (30%) - inverted (lower is better)
  const peg = calcSubscore(
    metrics.pegRatio,
    [1.0, 1.5, 2.0, 2.0],  // <1.0 green, 1.0-1.5 yellow, 1.5-2.0 orange, >2.0 red
    true
  );
  subScores.push({
    metric: 'PEG-Ratio',
    value: metrics.pegRatio ?? null,
    score: peg.score,
    weight: 0.30,
    color: peg.color,
  });

  // 2. Earnings Growth CAGR (30%)
  const earnings = calcSubscore(
    metrics.earningsGrowth,
    [5, 10, 20, 20],  // <5% red, 5-10% orange, 10-20% yellow, >20% green
    false
  );
  subScores.push({
    metric: 'Gewinnwachstum (5J CAGR)',
    value: metrics.earningsGrowth ?? null,
    score: earnings.score,
    weight: 0.30,
    color: earnings.color,
  });

  // 3. FCF Yield (25%)
  const fcf = calcSubscore(
    metrics.fcfYield,
    [3, 5, 8, 8],  // <3% red, 3-5% orange, 5-8% yellow, >8% green
    false
  );
  subScores.push({
    metric: 'Free Cash Flow Yield',
    value: metrics.fcfYield ?? null,
    score: fcf.score,
    weight: 0.25,
    color: fcf.color,
  });

  // 4. Revenue Growth CAGR (15%)
  const revenue = calcSubscore(
    metrics.revenueGrowth,
    [5, 10, 15, 15],  // <5% red, 5-10% orange, 10-15% yellow, >15% green
    false
  );
  subScores.push({
    metric: 'Umsatzwachstum (5J CAGR)',
    value: metrics.revenueGrowth ?? null,
    score: revenue.score,
    weight: 0.15,
    color: revenue.color,
  });

  return subScores;
}

/**
 * Get color from total score
 */
function getColorFromScore(score: number): ScoreColor {
  if (score <= 40) return 'red';
  if (score <= 60) return 'orange';
  if (score <= 80) return 'yellow';
  return 'green';
}

/**
 * Main scoring function
 */
export function calculateStockScore(
  ticker: string,
  metrics: StockMetrics,
  stockType?: StockType
): StockScore {
  // Determine type if not provided
  const type = stockType || determineStockType(metrics);

  // Calculate subscores based on type
  const subScores = type === 'dividend' 
    ? scoreDividendStock(metrics)
    : scoreGrowthStock(metrics);

  // Calculate weighted total score
  let totalScore = 0;
  let totalWeight = 0;

  for (const sub of subScores) {
    if (sub.value !== null) {
      totalScore += sub.score * sub.weight;
      totalWeight += sub.weight;
    }
  }

  // Normalize if not all metrics available
  const finalScore = totalWeight > 0 ? totalScore / totalWeight : 0;

  return {
    ticker,
    type,
    totalScore: Math.round(finalScore * 100) / 100,
    color: getColorFromScore(finalScore),
    subScores,
  };
}
