/**
 * Portfolio Copilot Engine
 * =======================
 * ML-based portfolio decision engine that provides:
 * 1. Cross-sectional Ranking (relative attractiveness per position)
 * 2. Rebalancing Suggestions (target weights with constraints)
 * 3. Concentration & Drawdown Warnings
 * 4. Diversification Score before/after suggested changes
 * 
 * Philosophy: ML as portfolio decision layer, not isolated price oracle.
 * Ranking > absolute price targets. Portfolio context > single stock view.
 */

import { randomForestSignal } from './mlEngine';
import * as ss from 'simple-statistics';

// ============================================================
// TYPES
// ============================================================

export interface PortfolioHolding {
  ticker: string;
  companyName: string;
  weight: number; // current weight 0-1
  shares: number;
  currentPrice: number;
  currency: string;
  sector?: string;
  prices?: number[]; // historical daily prices (252 days)
  volumes?: number[];
  fundamentals?: {
    peRatio?: number;
    pegRatio?: number;
    dividendYield?: number;
    beta?: number;
    marketCap?: number;
  };
}

export interface RankingResult {
  ticker: string;
  companyName: string;
  currentWeight: number;
  rankScore: number; // 0-100, higher = more attractive
  outperformProbability: number; // 0-1, probability of outperforming basket
  uncertainty: number; // 0-1, model uncertainty
  signal: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
  momentum: number; // -1 to 1
  riskAdjustedReturn: number; // Sharpe-like metric
  drivers: string[]; // top 3 reasons
}

export interface RebalancingSuggestion {
  ticker: string;
  companyName: string;
  currentWeight: number;
  targetWeight: number;
  delta: number; // targetWeight - currentWeight
  action: 'increase' | 'decrease' | 'hold' | 'exit';
  reason: string;
  estimatedImpact: {
    expectedReturnChange: number; // basis points
    riskChange: number; // basis points
    diversificationChange: number; // -1 to 1
  };
}

export interface ConcentrationWarning {
  type: 'sector_concentration' | 'single_stock' | 'correlation_cluster' | 'drawdown_risk' | 'weak_risk_reward';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  affectedTickers: string[];
  suggestedAction: string;
}

export interface DiversificationScore {
  overall: number; // 0-100
  sectorDiversification: number; // 0-100
  correlationDiversification: number; // 0-100
  concentrationScore: number; // 0-100 (100 = well diversified)
  herfindahlIndex: number; // 0-1
}

export interface CopilotAnalysis {
  rankings: RankingResult[];
  rebalancingSuggestions: RebalancingSuggestion[];
  warnings: ConcentrationWarning[];
  diversificationScore: DiversificationScore;
  portfolioMetrics: {
    expectedReturn: number;
    expectedVolatility: number;
    sharpeRatio: number;
    maxDrawdownRisk: number;
  };
  timestamp: string;
}

// ============================================================
// 1. CROSS-SECTIONAL RANKING
// ============================================================

function calculateMomentum(prices: number[]): number {
  if (prices.length < 20) return 0;
  
  // Multi-timeframe momentum
  const current = prices[prices.length - 1];
  const m5 = prices.length >= 5 ? (current / prices[prices.length - 5] - 1) : 0;
  const m20 = prices.length >= 20 ? (current / prices[prices.length - 20] - 1) : 0;
  const m60 = prices.length >= 60 ? (current / prices[prices.length - 60] - 1) : 0;
  const m120 = prices.length >= 120 ? (current / prices[prices.length - 120] - 1) : 0;
  
  // Weighted momentum (recent momentum weighted higher)
  return m5 * 0.1 + m20 * 0.3 + m60 * 0.35 + m120 * 0.25;
}

function calculateVolatility(prices: number[]): number {
  if (prices.length < 20) return 0;
  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push(Math.log(prices[i] / prices[i - 1]));
  }
  return ss.standardDeviation(returns) * Math.sqrt(252);
}

function calculateMaxDrawdown(prices: number[]): number {
  if (prices.length < 2) return 0;
  let maxDD = 0;
  let peak = prices[0];
  for (const price of prices) {
    if (price > peak) peak = price;
    const dd = (peak - price) / peak;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD;
}

function calculateSharpeForStock(prices: number[], riskFreeRate = 0.02): number {
  if (prices.length < 60) return 0;
  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push(prices[i] / prices[i - 1] - 1);
  }
  const meanReturn = ss.mean(returns) * 252;
  const vol = ss.standardDeviation(returns) * Math.sqrt(252);
  if (vol === 0) return 0;
  return (meanReturn - riskFreeRate) / vol;
}

export function calculateRankings(holdings: PortfolioHolding[]): RankingResult[] {
  const rawScores: Array<{
    holding: PortfolioHolding;
    momentum: number;
    sharpe: number;
    rfScore: number;
    rfConfidence: number;
    volatility: number;
    maxDD: number;
    fundamentalScore: number;
  }> = [];

  for (const h of holdings) {
    const prices = h.prices || [];
    const volumes = h.volumes || [];
    
    const momentum = calculateMomentum(prices);
    const sharpe = calculateSharpeForStock(prices);
    const volatility = calculateVolatility(prices);
    const maxDD = calculateMaxDrawdown(prices);
    
    // Random Forest signal
    let rfScore = 50;
    let rfConfidence = 0;
    if (prices.length >= 100) {
      const rf = randomForestSignal(prices, volumes, h.fundamentals || {});
      rfScore = rf.score;
      rfConfidence = rf.confidence;
    }
    
    // Fundamental score (value + quality)
    let fundamentalScore = 50;
    if (h.fundamentals) {
      const f = h.fundamentals;
      let fScore = 0;
      let fCount = 0;
      
      if (f.peRatio && f.peRatio > 0) {
        // Lower PE = higher score (inverted, capped)
        fScore += Math.max(0, Math.min(100, 100 - f.peRatio * 2));
        fCount++;
      }
      if (f.pegRatio && f.pegRatio > 0) {
        // PEG < 1 is attractive
        fScore += Math.max(0, Math.min(100, 100 - f.pegRatio * 40));
        fCount++;
      }
      if (f.dividendYield) {
        // Higher dividend = higher score (capped at 8%)
        fScore += Math.min(100, f.dividendYield * 15);
        fCount++;
      }
      
      if (fCount > 0) fundamentalScore = fScore / fCount;
    }
    
    rawScores.push({
      holding: h,
      momentum,
      sharpe,
      rfScore,
      rfConfidence,
      volatility,
      maxDD,
      fundamentalScore,
    });
  }

  if (rawScores.length === 0) return [];

  // Cross-sectional ranking: normalize each factor to 0-100 within the portfolio
  const normalize = (values: number[], higherIsBetter = true): number[] => {
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (max === min) return values.map(() => 50);
    return values.map(v => {
      const norm = (v - min) / (max - min) * 100;
      return higherIsBetter ? norm : 100 - norm;
    });
  };

  const normMomentum = normalize(rawScores.map(s => s.momentum));
  const normSharpe = normalize(rawScores.map(s => s.sharpe));
  const normRF = normalize(rawScores.map(s => s.rfScore));
  const normVol = normalize(rawScores.map(s => s.volatility), false); // lower is better
  const normDD = normalize(rawScores.map(s => s.maxDD), false); // lower is better
  const normFundamental = normalize(rawScores.map(s => s.fundamentalScore));

  // Composite score: weighted combination
  const compositeScores = rawScores.map((_, i) => {
    return (
      normMomentum[i] * 0.25 +
      normSharpe[i] * 0.20 +
      normRF[i] * 0.20 +
      normVol[i] * 0.10 +
      normDD[i] * 0.10 +
      normFundamental[i] * 0.15
    );
  });

  // Calculate outperformance probability based on composite score distribution
  const meanScore = ss.mean(compositeScores);
  const stdScore = compositeScores.length > 1 ? ss.standardDeviation(compositeScores) : 10;

  return rawScores.map((s, i) => {
    const rankScore = Math.round(Math.max(0, Math.min(100, compositeScores[i])));
    
    // Probability of outperforming the basket (z-score based)
    const zScore = stdScore > 0 ? (compositeScores[i] - meanScore) / stdScore : 0;
    const outperformProbability = Math.round(normalCDF(zScore) * 100) / 100;
    
    // Uncertainty: based on RF confidence and data availability
    const dataQuality = Math.min(1, (s.holding.prices?.length || 0) / 252);
    const uncertainty = Math.round((1 - (s.rfConfidence * 0.5 + dataQuality * 0.5)) * 100) / 100;
    
    // Signal based on composite score
    let signal: RankingResult['signal'] = 'hold';
    if (rankScore >= 75) signal = 'strong_buy';
    else if (rankScore >= 60) signal = 'buy';
    else if (rankScore <= 25) signal = 'strong_sell';
    else if (rankScore <= 40) signal = 'sell';
    
    // Top drivers
    const drivers: string[] = [];
    if (normMomentum[i] > 70) drivers.push(`Starkes Momentum (${(s.momentum * 100).toFixed(1)}%)`);
    else if (normMomentum[i] < 30) drivers.push(`Schwaches Momentum (${(s.momentum * 100).toFixed(1)}%)`);
    
    if (normSharpe[i] > 70) drivers.push(`Gutes Chance/Risiko (Sharpe ${s.sharpe.toFixed(2)})`);
    else if (normSharpe[i] < 30) drivers.push(`Schwaches Chance/Risiko (Sharpe ${s.sharpe.toFixed(2)})`);
    
    if (normRF[i] > 70) drivers.push(`ML-Signal positiv (Score ${s.rfScore})`);
    else if (normRF[i] < 30) drivers.push(`ML-Signal negativ (Score ${s.rfScore})`);
    
    if (normVol[i] > 70) drivers.push(`Niedrige Volatilität (${(s.volatility * 100).toFixed(1)}%)`);
    else if (normVol[i] < 30) drivers.push(`Hohe Volatilität (${(s.volatility * 100).toFixed(1)}%)`);
    
    if (normFundamental[i] > 70) drivers.push('Attraktive Bewertung');
    else if (normFundamental[i] < 30) drivers.push('Hohe Bewertung');
    
    if (s.maxDD > 0.2) drivers.push(`Hoher Drawdown (-${(s.maxDD * 100).toFixed(1)}%)`);
    
    return {
      ticker: s.holding.ticker,
      companyName: s.holding.companyName,
      currentWeight: s.holding.weight,
      rankScore,
      outperformProbability,
      uncertainty,
      signal,
      momentum: Math.round(s.momentum * 1000) / 1000,
      riskAdjustedReturn: Math.round(s.sharpe * 100) / 100,
      drivers: drivers.slice(0, 3),
    };
  }).sort((a, b) => b.rankScore - a.rankScore);
}

// ============================================================
// 2. REBALANCING SUGGESTIONS
// ============================================================

interface RebalancingConfig {
  maxPositionSize: number; // e.g. 0.15 = 15%
  minPositionSize: number; // e.g. 0.02 = 2%
  maxSectorWeight: number; // e.g. 0.35 = 35%
  tradingCostBps: number; // e.g. 10 = 0.1%
  rebalanceThreshold: number; // minimum delta to suggest (e.g. 0.01 = 1%)
}

const DEFAULT_CONFIG: RebalancingConfig = {
  maxPositionSize: 0.15,
  minPositionSize: 0.02,
  maxSectorWeight: 0.35,
  tradingCostBps: 10,
  rebalanceThreshold: 0.01,
};

export function calculateRebalancingSuggestions(
  holdings: PortfolioHolding[],
  rankings: RankingResult[],
  config: RebalancingConfig = DEFAULT_CONFIG
): RebalancingSuggestion[] {
  if (holdings.length === 0) return [];

  // Create a map of rankings by ticker
  const rankMap = new Map(rankings.map(r => [r.ticker, r]));
  
  // Calculate target weights based on ranking scores
  // Use score-weighted approach with constraints
  const totalScore = rankings.reduce((sum, r) => sum + Math.max(r.rankScore, 10), 0);
  
  const rawTargets = holdings.map(h => {
    const rank = rankMap.get(h.ticker);
    const score = rank ? Math.max(rank.rankScore, 10) : 50;
    return {
      holding: h,
      rank,
      rawTarget: score / totalScore,
    };
  });

  // Apply constraints
  const suggestions: RebalancingSuggestion[] = rawTargets.map(({ holding, rank, rawTarget }) => {
    // Clamp to min/max position size
    let targetWeight = Math.max(config.minPositionSize, Math.min(config.maxPositionSize, rawTarget));
    
    // If rank suggests exit (very low score), allow going to 0
    if (rank && rank.rankScore <= 20 && rank.signal === 'strong_sell') {
      targetWeight = 0;
    }
    
    const delta = targetWeight - holding.weight;
    
    // Determine action
    let action: RebalancingSuggestion['action'] = 'hold';
    if (targetWeight === 0) action = 'exit';
    else if (delta > config.rebalanceThreshold) action = 'increase';
    else if (delta < -config.rebalanceThreshold) action = 'decrease';
    
    // Generate reason
    let reason = '';
    if (action === 'increase' && rank) {
      reason = `Ranking-Score ${rank.rankScore}/100 (${rank.outperformProbability * 100}% Outperformance-Wahrscheinlichkeit). ${rank.drivers[0] || ''}`;
    } else if (action === 'decrease' && rank) {
      reason = `Ranking-Score ${rank.rankScore}/100. ${rank.drivers[0] || 'Schwächere relative Attraktivität'}`;
    } else if (action === 'exit' && rank) {
      reason = `Starkes Verkaufssignal (Score ${rank.rankScore}). ${rank.drivers[0] || ''}`;
    } else {
      reason = 'Position im Zielbereich, kein Handlungsbedarf.';
    }
    
    // Estimated impact
    const expectedReturnChange = Math.round(delta * (rank?.riskAdjustedReturn || 0) * 100); // bps
    const riskChange = Math.round(delta * (rank ? (100 - rank.rankScore) / 100 : 0.5) * 50); // bps
    
    return {
      ticker: holding.ticker,
      companyName: holding.companyName,
      currentWeight: Math.round(holding.weight * 1000) / 1000,
      targetWeight: Math.round(targetWeight * 1000) / 1000,
      delta: Math.round(delta * 1000) / 1000,
      action,
      reason,
      estimatedImpact: {
        expectedReturnChange,
        riskChange,
        diversificationChange: 0, // calculated later
      },
    };
  });

  // Normalize target weights to sum to 1
  const totalTarget = suggestions.reduce((sum, s) => sum + s.targetWeight, 0);
  if (totalTarget > 0 && Math.abs(totalTarget - 1) > 0.01) {
    const scale = 1 / totalTarget;
    for (const s of suggestions) {
      s.targetWeight = Math.round(s.targetWeight * scale * 1000) / 1000;
      s.delta = Math.round((s.targetWeight - s.currentWeight) * 1000) / 1000;
      // Re-evaluate action after normalization
      if (Math.abs(s.delta) < config.rebalanceThreshold) s.action = 'hold';
      else if (s.delta > 0) s.action = 'increase';
      else s.action = 'decrease';
    }
  }

  // Sort by absolute delta (biggest changes first)
  return suggestions.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

// ============================================================
// 3. CONCENTRATION & DRAWDOWN WARNINGS
// ============================================================

export function calculateWarnings(
  holdings: PortfolioHolding[],
  rankings: RankingResult[]
): ConcentrationWarning[] {
  const warnings: ConcentrationWarning[] = [];
  const rankMap = new Map(rankings.map(r => [r.ticker, r]));

  // 1. Single stock concentration (>15%)
  for (const h of holdings) {
    if (h.weight > 0.15) {
      warnings.push({
        type: 'single_stock',
        severity: h.weight > 0.25 ? 'high' : 'medium',
        title: `Klumpenrisiko: ${h.companyName}`,
        description: `${h.companyName} macht ${(h.weight * 100).toFixed(1)}% des Portfolios aus. Eine Einzelposition über 15% erhöht das unsystematische Risiko erheblich.`,
        affectedTickers: [h.ticker],
        suggestedAction: `Position auf max. 10-12% reduzieren und in andere Sektoren diversifizieren.`,
      });
    }
  }

  // 2. Sector concentration (>35%)
  const sectorWeights = new Map<string, { weight: number; tickers: string[] }>();
  for (const h of holdings) {
    const sector = h.sector || 'Unbekannt';
    const existing = sectorWeights.get(sector) || { weight: 0, tickers: [] };
    existing.weight += h.weight;
    existing.tickers.push(h.ticker);
    sectorWeights.set(sector, existing);
  }
  
  for (const [sector, data] of sectorWeights) {
    if (data.weight > 0.35 && sector !== 'Unbekannt') {
      warnings.push({
        type: 'sector_concentration',
        severity: data.weight > 0.50 ? 'high' : 'medium',
        title: `Sektorkonzentration: ${sector}`,
        description: `${sector} macht ${(data.weight * 100).toFixed(1)}% des Portfolios aus (${data.tickers.length} Titel). Sektorrisiken können das gesamte Portfolio treffen.`,
        affectedTickers: data.tickers,
        suggestedAction: `Sektorgewicht auf max. 30% reduzieren. Titel aus unterrepräsentierten Sektoren ergänzen.`,
      });
    }
  }

  // 3. Correlation cluster (highly correlated positions)
  if (holdings.length >= 3) {
    const correlatedPairs: Array<{ t1: string; t2: string; corr: number }> = [];
    
    for (let i = 0; i < holdings.length; i++) {
      for (let j = i + 1; j < holdings.length; j++) {
        const p1 = holdings[i].prices;
        const p2 = holdings[j].prices;
        if (p1 && p2 && p1.length >= 60 && p2.length >= 60) {
          const len = Math.min(p1.length, p2.length);
          const r1 = [];
          const r2 = [];
          for (let k = 1; k < len; k++) {
            r1.push(p1[p1.length - len + k] / p1[p1.length - len + k - 1] - 1);
            r2.push(p2[p2.length - len + k] / p2[p2.length - len + k - 1] - 1);
          }
          try {
            const corr = ss.sampleCorrelation(r1, r2);
            if (corr > 0.8) {
              correlatedPairs.push({
                t1: holdings[i].ticker,
                t2: holdings[j].ticker,
                corr,
              });
            }
          } catch {}
        }
      }
    }
    
    if (correlatedPairs.length > 0) {
      const affectedTickers = [...new Set(correlatedPairs.flatMap(p => [p.t1, p.t2]))];
      const topPair = correlatedPairs.sort((a, b) => b.corr - a.corr)[0];
      
      warnings.push({
        type: 'correlation_cluster',
        severity: correlatedPairs.length > 3 ? 'high' : 'medium',
        title: `Korrelationscluster: ${correlatedPairs.length} hochkorrelierte Paare`,
        description: `${affectedTickers.length} Titel bewegen sich stark synchron (Korrelation >0.8). Höchste: ${topPair.t1}/${topPair.t2} (${(topPair.corr * 100).toFixed(0)}%). Diversifikationseffekt ist eingeschränkt.`,
        affectedTickers,
        suggestedAction: `Eine Position pro Cluster reduzieren und durch weniger korrelierte Titel ersetzen.`,
      });
    }
  }

  // 4. Drawdown risk (positions with high recent drawdown)
  for (const h of holdings) {
    if (h.prices && h.prices.length >= 60) {
      const recentPrices = h.prices.slice(-60);
      const dd = calculateMaxDrawdown(recentPrices);
      if (dd > 0.15 && h.weight > 0.05) {
        warnings.push({
          type: 'drawdown_risk',
          severity: dd > 0.25 ? 'high' : 'medium',
          title: `Drawdown-Warnung: ${h.companyName}`,
          description: `${h.companyName} hat in den letzten 60 Tagen einen Drawdown von -${(dd * 100).toFixed(1)}% erlitten. Bei ${(h.weight * 100).toFixed(1)}% Gewichtung bedeutet das -${(dd * h.weight * 100).toFixed(2)}% Portfolio-Impact.`,
          affectedTickers: [h.ticker],
          suggestedAction: `Stop-Loss prüfen oder Position reduzieren bis Erholung eintritt.`,
        });
      }
    }
  }

  // 5. Weak risk/reward positions
  for (const h of holdings) {
    const rank = rankMap.get(h.ticker);
    if (rank && rank.rankScore < 35 && h.weight > 0.05) {
      warnings.push({
        type: 'weak_risk_reward',
        severity: rank.rankScore < 20 ? 'high' : 'low',
        title: `Schwaches Chance/Risiko: ${h.companyName}`,
        description: `${h.companyName} hat einen Ranking-Score von nur ${rank.rankScore}/100 bei ${(h.weight * 100).toFixed(1)}% Gewichtung. Outperformance-Wahrscheinlichkeit: ${(rank.outperformProbability * 100).toFixed(0)}%.`,
        affectedTickers: [h.ticker],
        suggestedAction: `Position reduzieren und Kapital in höher gerankte Titel umschichten.`,
      });
    }
  }

  // Sort by severity
  const severityOrder = { high: 0, medium: 1, low: 2 };
  return warnings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

// ============================================================
// 4. DIVERSIFICATION SCORE
// ============================================================

export function calculateDiversificationScore(holdings: PortfolioHolding[]): DiversificationScore {
  if (holdings.length === 0) {
    return { overall: 0, sectorDiversification: 0, correlationDiversification: 0, concentrationScore: 0, herfindahlIndex: 1 };
  }

  // Herfindahl-Hirschman Index (concentration)
  const hhi = holdings.reduce((sum, h) => sum + h.weight * h.weight, 0);
  // Perfect diversification: 1/n, worst: 1
  const minHHI = 1 / holdings.length;
  const concentrationScore = Math.round(Math.max(0, (1 - (hhi - minHHI) / (1 - minHHI))) * 100);

  // Sector diversification
  const sectorWeights = new Map<string, number>();
  for (const h of holdings) {
    const sector = h.sector || 'Unbekannt';
    sectorWeights.set(sector, (sectorWeights.get(sector) || 0) + h.weight);
  }
  const sectorHHI = [...sectorWeights.values()].reduce((sum, w) => sum + w * w, 0);
  const sectorCount = sectorWeights.size;
  const minSectorHHI = sectorCount > 0 ? 1 / sectorCount : 1;
  const sectorDiversification = Math.round(Math.max(0, (1 - (sectorHHI - minSectorHHI) / (1 - minSectorHHI))) * 100);

  // Correlation diversification (average pairwise correlation)
  let avgCorrelation = 0;
  let corrCount = 0;
  for (let i = 0; i < holdings.length; i++) {
    for (let j = i + 1; j < holdings.length; j++) {
      const p1 = holdings[i].prices;
      const p2 = holdings[j].prices;
      if (p1 && p2 && p1.length >= 60 && p2.length >= 60) {
        const len = Math.min(p1.length, p2.length, 120);
        const r1 = [];
        const r2 = [];
        for (let k = 1; k < len; k++) {
          r1.push(p1[p1.length - len + k] / p1[p1.length - len + k - 1] - 1);
          r2.push(p2[p2.length - len + k] / p2[p2.length - len + k - 1] - 1);
        }
        try {
          const corr = ss.sampleCorrelation(r1, r2);
          if (!isNaN(corr)) {
            avgCorrelation += corr;
            corrCount++;
          }
        } catch {}
      }
    }
  }
  
  if (corrCount > 0) avgCorrelation /= corrCount;
  // Lower correlation = better diversification
  const correlationDiversification = Math.round(Math.max(0, (1 - avgCorrelation)) * 100);

  // Overall score (weighted)
  const overall = Math.round(
    concentrationScore * 0.35 +
    sectorDiversification * 0.35 +
    correlationDiversification * 0.30
  );

  return {
    overall,
    sectorDiversification,
    correlationDiversification,
    concentrationScore,
    herfindahlIndex: Math.round(hhi * 1000) / 1000,
  };
}

// ============================================================
// 5. PORTFOLIO METRICS
// ============================================================

function calculatePortfolioMetrics(holdings: PortfolioHolding[]) {
  // Calculate weighted portfolio returns
  const minLen = Math.min(...holdings.filter(h => h.prices && h.prices.length > 60).map(h => h.prices!.length));
  
  if (minLen < 60) {
    return { expectedReturn: 0, expectedVolatility: 0, sharpeRatio: 0, maxDrawdownRisk: 0 };
  }

  const portfolioReturns: number[] = [];
  const len = Math.min(minLen, 252);
  
  for (let day = 1; day < len; day++) {
    let dayReturn = 0;
    for (const h of holdings) {
      if (h.prices && h.prices.length >= len) {
        const r = h.prices[h.prices.length - len + day] / h.prices[h.prices.length - len + day - 1] - 1;
        dayReturn += r * h.weight;
      }
    }
    portfolioReturns.push(dayReturn);
  }

  if (portfolioReturns.length < 20) {
    return { expectedReturn: 0, expectedVolatility: 0, sharpeRatio: 0, maxDrawdownRisk: 0 };
  }

  const expectedReturn = Math.round(ss.mean(portfolioReturns) * 252 * 10000) / 10000;
  const expectedVolatility = Math.round(ss.standardDeviation(portfolioReturns) * Math.sqrt(252) * 10000) / 10000;
  const sharpeRatio = expectedVolatility > 0 ? Math.round((expectedReturn - 0.02) / expectedVolatility * 100) / 100 : 0;
  
  // Max drawdown risk (historical)
  let cumReturn = 1;
  let peak = 1;
  let maxDD = 0;
  for (const r of portfolioReturns) {
    cumReturn *= (1 + r);
    if (cumReturn > peak) peak = cumReturn;
    const dd = (peak - cumReturn) / peak;
    if (dd > maxDD) maxDD = dd;
  }

  return {
    expectedReturn,
    expectedVolatility,
    sharpeRatio,
    maxDrawdownRisk: Math.round(maxDD * 10000) / 10000,
  };
}

// ============================================================
// MAIN COPILOT FUNCTION
// ============================================================

export function runCopilotAnalysis(holdings: PortfolioHolding[]): CopilotAnalysis {
  // Step 1: Calculate rankings
  const rankings = calculateRankings(holdings);
  
  // Step 2: Generate rebalancing suggestions
  const rebalancingSuggestions = calculateRebalancingSuggestions(holdings, rankings);
  
  // Step 3: Generate warnings
  const warnings = calculateWarnings(holdings, rankings);
  
  // Step 4: Calculate diversification score
  const diversificationScore = calculateDiversificationScore(holdings);
  
  // Step 5: Portfolio metrics
  const portfolioMetrics = calculatePortfolioMetrics(holdings);

  return {
    rankings,
    rebalancingSuggestions,
    warnings,
    diversificationScore,
    portfolioMetrics,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================
// HELPERS
// ============================================================

function normalCDF(x: number): number {
  // Approximation of the standard normal CDF
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  
  return 0.5 * (1.0 + sign * y);
}
