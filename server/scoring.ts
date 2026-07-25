/**
 * Stock Scoring System
 * Evaluates dividend and growth stocks with traffic light indicators (Red/Orange/Yellow/Green)
 */

export type StockType = 'dividend' | 'growth';
export type ScoreColor = 'red' | 'orange' | 'yellow' | 'green';

export interface StockMetrics {
  // Available metrics from APIs
  dividendYield?: number;        // in % (EODHD)
  peRatio?: number;              // P/E ratio (EODHD)
  pegRatio?: number;             // PEG ratio (EODHD)
  beta?: number;                 // Beta (EODHD)
  volatility?: number;           // Volatility in % (calculated)
  sharpeRatio?: number;          // Sharpe ratio (calculated)
  earningsGrowth?: number;       // Derived from P/E / PEG (annual %)
  
  // Legacy metrics (not available, kept for compatibility)
  payoutRatio?: number;          // in %
  equityRatio?: number;          // in %
  ytdPerformance?: number;       // Year-to-date performance in %
  fcfYield?: number;             // Free Cash Flow Yield in %
  revenueGrowth?: number;        // 5-year CAGR in %
}

export interface SubScore {
  metric: string;
  value: number | null;
  score: number | null;
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
): { score: number | null; color: ScoreColor } {
  if (value === undefined || value === null || isNaN(value)) {
    return { score: null, color: 'red' };
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
    // R-26: Guard gegen Division durch 0 bei greenMin === yellowMax (vorher
    // rettete nur Math.min die entstehende Infinity) bzw. negative progress
    // bei invertierten/fehlkonfigurierten Schwellen.
    const progress = g > y ? Math.min((effectiveValue - y) / (g - y), 1) : 1;
    score = 62.5 + progress * 25;
    color = 'green';
  }

  return { score: Math.max(0, Math.min(100, score)), color };
}

/**
 * Determine stock type based on category or metrics
 */
export function determineStockType(metrics: StockMetrics, category?: string): StockType {
  // Use category from database if available
  if (category) {
    const categoryLower = category.toLowerCase();
    console.log('[Score] Category:', category, '-> lowercase:', categoryLower);
    // Dividend categories (German + English)
    if (categoryLower.includes('dividend') || categoryLower.includes('dividenden')) {
      console.log('[Score] Classified as DIVIDEND based on category');
      return 'dividend';
    }
    // Growth categories (German + English)
    if (categoryLower.includes('growth') || categoryLower.includes('wachstum')) {
      console.log('[Score] Classified as GROWTH based on category');
      return 'growth';
    }
    // Value, Balanced, ETF, Andere → treat as dividend (stability-focused scoring)
    if (categoryLower === 'value' || categoryLower === 'balanced' || categoryLower === 'etf' || categoryLower === 'andere') {
      console.log('[Score] Classified as DIVIDEND (stability) based on category:', category);
      return 'dividend';
    }
  }
  
  // Fallback: If dividend yield > 2%, likely dividend stock
  if (metrics.dividendYield && metrics.dividendYield > 2) {
    console.log('[Score] Classified as DIVIDEND based on yield:', metrics.dividendYield);
    return 'dividend';
  }
  
  // Default: growth stock
  console.log('[Score] Classified as GROWTH (default)');
  return 'growth';
}

/**
 * Calculate score for dividend stock using available metrics
 */
function scoreDividendStock(metrics: StockMetrics): SubScore[] {
  const subScores: SubScore[] = [];

  // 1. Dividend Yield (40%) - SOFTER thresholds for dividend stocks
  const divYield = calcSubscore(
    metrics.dividendYield,
    [1.5, 2.5, 4, 6],  // <1.5% red, 1.5-2.5% orange, 2.5-4% yellow, >6% green (softer!)
    false
  );
  subScores.push({
    metric: 'Dividendenrendite',
    value: metrics.dividendYield ?? null,
    score: divYield.score,
    weight: 0.40,
    color: divYield.color,
  });

  // 2. P/E Ratio (30%) - inverted (lower is better)
  const pe = calcSubscore(
    metrics.peRatio,
    [12, 18, 25, 25],  // <12 green, 12-18 yellow, 18-25 orange, >25 red
    true
  );
  subScores.push({
    metric: 'KGV',
    value: metrics.peRatio ?? null,
    score: pe.score,
    weight: 0.30,
    color: pe.color,
  });

  // 3. Beta (20%) - inverted (lower is better, more stable)
  const beta = calcSubscore(
    metrics.beta,
    [0.8, 1.0, 1.3, 1.3],  // <0.8 green, 0.8-1.0 yellow, 1.0-1.3 orange, >1.3 red
    true
  );
  subScores.push({
    metric: 'Beta (Stabilität)',
    value: metrics.beta ?? null,
    score: beta.score,
    weight: 0.20,
    color: beta.color,
  });

  // 4. Volatility (10%) - inverted (lower is better)
  const vol = calcSubscore(
    metrics.volatility,
    [15, 25, 35, 35],  // <15% green, 15-25% yellow, 25-35% orange, >35% red
    true
  );
  subScores.push({
    metric: 'Volatilität',
    value: metrics.volatility ?? null,
    score: vol.score,
    weight: 0.10,
    color: vol.color,
  });

  return subScores;
}

/**
 * Calculate score for growth stock using available metrics
 */
function scoreGrowthStock(metrics: StockMetrics): SubScore[] {
  const subScores: SubScore[] = [];

  // Calculate earnings growth from P/E and PEG if available
  let earningsGrowth: number | null = null;
  if (metrics.peRatio && metrics.pegRatio && metrics.pegRatio > 0) {
    earningsGrowth = (metrics.peRatio / metrics.pegRatio);
  }

  // 1. Sharpe Ratio (30%) - reduced weight to make room for earnings growth
  const sharpe = calcSubscore(
    metrics.sharpeRatio,
    [0.5, 1.0, 1.5, 2.0],  // <0.5 red, 0.5-1.0 orange, 1.0-1.5 yellow, >2.0 green
    false
  );
  subScores.push({
    metric: 'Sharpe Ratio',
    value: metrics.sharpeRatio ?? null,
    score: sharpe.score,
    weight: 0.30,
    color: sharpe.color,
  });

  // 2. PEG Ratio (25%) - reduced weight
  const peg = calcSubscore(
    metrics.pegRatio,
    [1.0, 1.5, 2.0, 2.0],  // <1.0 green, 1.0-1.5 yellow, 1.5-2.0 orange, >2.0 red
    true
  );
  subScores.push({
    metric: 'PEG Ratio',
    value: metrics.pegRatio ?? null,
    score: peg.score,
    weight: 0.25,
    color: peg.color,
  });

  // 3. Earnings Growth (25%) - NEW! Derived from P/E / PEG
  const growth = calcSubscore(
    earningsGrowth,
    [5, 10, 15, 20],  // <5% red, 5-10% orange, 10-15% yellow, >20% green
    false
  );
  subScores.push({
    metric: 'Gewinnwachstum (P/E/PEG)',
    value: earningsGrowth,
    score: growth.score,
    weight: 0.25,
    color: growth.color,
  });

  // 4. Beta (20%) - reduced weight
  const beta = calcSubscore(
    metrics.beta,
    [1.0, 1.3, 1.6, 1.6],  // <1.0 green, 1.0-1.3 yellow, 1.3-1.6 orange, >1.6 red
    true
  );
  subScores.push({
    metric: 'Beta (Stabilität)',
    value: metrics.beta ?? null,
    score: beta.score,
    weight: 0.20,
    color: beta.color,
  });

  // 5. Momentum (YTD) - growth stocks reward positive price momentum.
  const momentum = calcSubscore(
    metrics.ytdPerformance,
    [0, 5, 15, 30],  // <0% red, 0-5% orange, 5-15% yellow, >30% green
    false
  );
  subScores.push({
    metric: 'Momentum (YTD)',
    value: metrics.ytdPerformance ?? null,
    score: momentum.score,
    weight: 0.15,
    color: momentum.color,
  });

  return subScores;
}

// ─────────────────────────────────────────────────────────────────────────────
// ACS-1 (2026-07): Asset-class-specific scoring functions
// Obligationen, Gold, Rohstoffe, Krypto, Immobilien have no P/E / PEG.
// ─────────────────────────────────────────────────────────────────────────────

/** Score for bond ETFs: Yield (50%), Momentum (25%), Volatility (25%) */
function scoreBond(metrics: StockMetrics): SubScore[] {
  const subScores: SubScore[] = [];
  const yld = calcSubscore(metrics.dividendYield, [1, 2, 3.5, 5], false);
  subScores.push({ metric: 'Rendite (Coupon)', value: metrics.dividendYield ?? null, score: yld.score, weight: 0.50, color: yld.color });
  const mom = calcSubscore(metrics.ytdPerformance, [-10, -5, 0, 5], false);
  subScores.push({ metric: 'Momentum (YTD)', value: metrics.ytdPerformance ?? null, score: mom.score, weight: 0.25, color: mom.color });
  const vol = calcSubscore(metrics.volatility, [3, 6, 10, 10], true);
  subScores.push({ metric: 'Volatilität', value: metrics.volatility ?? null, score: vol.score, weight: 0.25, color: vol.color });
  return subScores;
}

/** Score for gold ETFs: Momentum (40%), Sharpe (35%), Volatility (25%) */
function scoreGold(metrics: StockMetrics): SubScore[] {
  const subScores: SubScore[] = [];
  const mom = calcSubscore(metrics.ytdPerformance, [-15, -5, 5, 20], false);
  subScores.push({ metric: 'Momentum (YTD)', value: metrics.ytdPerformance ?? null, score: mom.score, weight: 0.40, color: mom.color });
  const sharpe = calcSubscore(metrics.sharpeRatio, [0.3, 0.7, 1.2, 1.8], false);
  subScores.push({ metric: 'Sharpe Ratio', value: metrics.sharpeRatio ?? null, score: sharpe.score, weight: 0.35, color: sharpe.color });
  const vol = calcSubscore(metrics.volatility, [10, 15, 22, 22], true);
  subScores.push({ metric: 'Volatilität', value: metrics.volatility ?? null, score: vol.score, weight: 0.25, color: vol.color });
  return subScores;
}

/** Score for commodity ETFs: Momentum (45%), Sharpe (30%), Volatility (25%) */
function scoreCommodity(metrics: StockMetrics): SubScore[] {
  const subScores: SubScore[] = [];
  const mom = calcSubscore(metrics.ytdPerformance, [-20, -8, 5, 25], false);
  subScores.push({ metric: 'Momentum (YTD)', value: metrics.ytdPerformance ?? null, score: mom.score, weight: 0.45, color: mom.color });
  const sharpe = calcSubscore(metrics.sharpeRatio, [0.2, 0.6, 1.0, 1.5], false);
  subScores.push({ metric: 'Sharpe Ratio', value: metrics.sharpeRatio ?? null, score: sharpe.score, weight: 0.30, color: sharpe.color });
  const vol = calcSubscore(metrics.volatility, [12, 20, 30, 30], true);
  subScores.push({ metric: 'Volatilität', value: metrics.volatility ?? null, score: vol.score, weight: 0.25, color: vol.color });
  return subScores;
}

/** Score for crypto ETPs: Momentum (50%), Sharpe (30%), Volatility (20%) — higher thresholds */
function scoreCrypto(metrics: StockMetrics): SubScore[] {
  const subScores: SubScore[] = [];
  const mom = calcSubscore(metrics.ytdPerformance, [-50, -20, 10, 80], false);
  subScores.push({ metric: 'Momentum (YTD)', value: metrics.ytdPerformance ?? null, score: mom.score, weight: 0.50, color: mom.color });
  const sharpe = calcSubscore(metrics.sharpeRatio, [0.2, 0.5, 1.0, 1.5], false);
  subScores.push({ metric: 'Sharpe Ratio', value: metrics.sharpeRatio ?? null, score: sharpe.score, weight: 0.30, color: sharpe.color });
  const vol = calcSubscore(metrics.volatility, [30, 50, 80, 80], true);
  subScores.push({ metric: 'Volatilität', value: metrics.volatility ?? null, score: vol.score, weight: 0.20, color: vol.color });
  return subScores;
}

/** Score for real estate ETFs (REITs): Yield (45%), Momentum (30%), Volatility (25%) */
function scoreRealEstate(metrics: StockMetrics): SubScore[] {
  const subScores: SubScore[] = [];
  const yld = calcSubscore(metrics.dividendYield, [1.5, 2.5, 3.5, 5], false);
  subScores.push({ metric: 'Ausschüttungsrendite', value: metrics.dividendYield ?? null, score: yld.score, weight: 0.45, color: yld.color });
  const mom = calcSubscore(metrics.ytdPerformance, [-15, -5, 5, 20], false);
  subScores.push({ metric: 'Momentum (YTD)', value: metrics.ytdPerformance ?? null, score: mom.score, weight: 0.30, color: mom.color });
  const vol = calcSubscore(metrics.volatility, [10, 18, 28, 28], true);
  subScores.push({ metric: 'Volatilität', value: metrics.volatility ?? null, score: vol.score, weight: 0.25, color: vol.color });
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
  stockType?: StockType,
  category?: string
): StockScore {
  // ACS-1: Route to asset-class-specific scorer for non-equity assets
  const cat = (category || '').toLowerCase();
  let assetSubScores: SubScore[] | null = null;
  let assetTypeName: StockType = 'growth';
  if (cat.includes('obligation') || cat.includes('bond') || cat.includes('anleihe')) {
    assetSubScores = scoreBond(metrics); assetTypeName = 'dividend';
  } else if (cat.includes('gold')) {
    assetSubScores = scoreGold(metrics); assetTypeName = 'growth';
  } else if (cat.includes('rohstoff') || cat.includes('commodity') || cat.includes('rohwaren')) {
    assetSubScores = scoreCommodity(metrics); assetTypeName = 'growth';
  } else if (cat.includes('krypto') || cat.includes('crypto')) {
    assetSubScores = scoreCrypto(metrics); assetTypeName = 'growth';
  } else if (cat.includes('immobilien') || cat.includes('realestate') || cat.includes('reit')) {
    assetSubScores = scoreRealEstate(metrics); assetTypeName = 'dividend';
  }
  if (assetSubScores !== null) {
    let totalScore = 0; let totalWeight = 0;
    for (const sub of assetSubScores) {
      if (sub.value !== null && sub.score !== null) { totalScore += sub.score * sub.weight; totalWeight += sub.weight; }
    }
    const finalScore = totalWeight > 0 ? totalScore / totalWeight : 0;
    return { ticker, type: assetTypeName, totalScore: Math.round(finalScore * 100) / 100, color: getColorFromScore(finalScore), subScores: assetSubScores };
  }
  // Equity path: determine type if not provided
  const type = stockType || determineStockType(metrics, category);

  // Calculate subscores based on type
  const subScores = type === 'dividend' 
    ? scoreDividendStock(metrics)
    : scoreGrowthStock(metrics);

  // Calculate weighted total score
  let totalScore = 0;
  let totalWeight = 0;

  for (const sub of subScores) {
    if (sub.value !== null && sub.score !== null) {
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

/**
 * Calculate scores for multiple stocks
 */
export function calculateStockScores(stocks: any[]): StockScore[] {
  return stocks.map(stock => {
    const metrics: StockMetrics = {
      dividendYield: stock.dividendYield ? parseFloat(stock.dividendYield) : undefined,
      peRatio: stock.peRatio ? parseFloat(stock.peRatio) : undefined,
      pegRatio: stock.pegRatio ? parseFloat(stock.pegRatio) : undefined,
      beta: stock.beta ? parseFloat(stock.beta) : undefined,
      volatility: stock.volatility ? parseFloat(stock.volatility) : undefined,
      sharpeRatio: stock.sharpeRatio ? parseFloat(stock.sharpeRatio) : undefined,
      ytdPerformance: stock.ytdPerformance ? parseFloat(stock.ytdPerformance) : undefined,
    };
    
    return calculateStockScore(
      stock.ticker,
      metrics,
      undefined, // Let it auto-determine type
      stock.category
    );
  });
}
