// Test calculateStockScore for RO.SW with actual DB values
const ticker = 'RO.SW';
const metrics = {
  dividendYield: 2.94,
  peRatio: 20.871733,
  pegRatio: 1.49,
  beta: 0.344,
  volatility: 24.85532758494903,
  sharpeRatio: 0.9011684941452013,
};
const category = 'Dividendenaktien';

// Simulate the scoring logic
function scoreMetric(value, ranges, reverse = false) {
  if (value === undefined || value === null || isNaN(value)) return 50;
  for (const [threshold, score] of ranges) {
    if (reverse ? value <= threshold : value >= threshold) return score;
  }
  return ranges[ranges.length - 1][1];
}

// PE Ratio scoring (lower is better for value stocks)
const peScore = metrics.peRatio <= 10 ? 100 : metrics.peRatio <= 15 ? 85 : metrics.peRatio <= 20 ? 70 : metrics.peRatio <= 25 ? 55 : metrics.peRatio <= 35 ? 40 : 20;
console.log('PE Score:', peScore, '(PE:', metrics.peRatio, ')');

// PEG scoring (lower is better)
const pegScore = metrics.pegRatio <= 0.5 ? 100 : metrics.pegRatio <= 1.0 ? 85 : metrics.pegRatio <= 1.5 ? 70 : metrics.pegRatio <= 2.0 ? 55 : metrics.pegRatio <= 3.0 ? 35 : 15;
console.log('PEG Score:', pegScore, '(PEG:', metrics.pegRatio, ')');

// Beta scoring (lower is better for stability)
const betaScore = metrics.beta <= 0.5 ? 100 : metrics.beta <= 0.8 ? 85 : metrics.beta <= 1.0 ? 70 : metrics.beta <= 1.2 ? 55 : metrics.beta <= 1.5 ? 35 : 15;
console.log('Beta Score:', betaScore, '(Beta:', metrics.beta, ')');

// Volatility scoring (lower is better)
const volScore = metrics.volatility <= 10 ? 100 : metrics.volatility <= 15 ? 85 : metrics.volatility <= 20 ? 70 : metrics.volatility <= 25 ? 55 : metrics.volatility <= 35 ? 35 : 15;
console.log('Volatility Score:', volScore, '(Vol:', metrics.volatility, ')');

// Sharpe scoring (higher is better)
const sharpeScore = metrics.sharpeRatio >= 2.0 ? 100 : metrics.sharpeRatio >= 1.5 ? 85 : metrics.sharpeRatio >= 1.0 ? 70 : metrics.sharpeRatio >= 0.5 ? 55 : metrics.sharpeRatio >= 0 ? 35 : 15;
console.log('Sharpe Score:', sharpeScore, '(Sharpe:', metrics.sharpeRatio, ')');

const avg = (peScore + pegScore + betaScore + volScore + sharpeScore) / 5;
console.log('Average Score:', avg.toFixed(1));
