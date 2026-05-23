import { publicProcedure, router } from "../_core/trpc";
import { fetchHistoricalPrices } from "../_core/stockDataApi";

type RegimeLevel = "bullish" | "neutral" | "bearish";
type EngineResult = {
  label: string;
  score: number;
  level: RegimeLevel;
  description: string;
};

function classify(score: number): RegimeLevel {
  if (score > 0.15) return "bullish";
  if (score < -0.15) return "bearish";
  return "neutral";
}

function labelFromLevel(level: RegimeLevel): string {
  switch (level) {
    case "bullish": return "Bullish";
    case "neutral": return "Neutral";
    case "bearish": return "Bearish";
  }
}

/**
 * Trend Engine: S&P 500 vs 200DMA, 50/200 Cross, 12M Momentum
 */
async function calculateTrendEngine(): Promise<EngineResult> {
  try {
    const prices = await fetchHistoricalPrices('GSPC.INDX', 2);
    if (!prices || prices.length < 200) {
      return { label: "Ungenügend Daten", score: 0, level: "neutral", description: "Weniger als 200 Tage Daten" };
    }

    const closes = prices.map((p: any) => p.close);
    const current = closes[closes.length - 1];
    
    // 200 DMA
    const dma200 = closes.slice(-200).reduce((a: number, b: number) => a + b, 0) / 200;
    const dma50 = closes.slice(-50).reduce((a: number, b: number) => a + b, 0) / 50;
    
    // Signals
    const aboveDma200 = current > dma200 ? 0.4 : -0.4;
    const goldenCross = dma50 > dma200 ? 0.3 : -0.3;
    
    // 12M Momentum
    const price12mAgo = closes.length >= 252 ? closes[closes.length - 252] : closes[0];
    const momentum12m = (current - price12mAgo) / price12mAgo;
    const momentumSignal = Math.max(-0.3, Math.min(0.3, momentum12m));
    
    const score = Math.max(-1, Math.min(1, aboveDma200 + goldenCross + momentumSignal));
    const level = classify(score);
    
    const pctAbove200 = ((current / dma200 - 1) * 100).toFixed(1);
    const desc = `S&P 500 ${Number(pctAbove200) >= 0 ? '+' : ''}${pctAbove200}% über 200DMA | ${dma50 > dma200 ? 'Golden Cross' : 'Death Cross'} | 12M: ${(momentum12m * 100).toFixed(1)}%`;
    
    return { label: labelFromLevel(level), score, level, description: desc };
  } catch (e) {
    console.error('[MarketRegime] Trend engine error:', e);
    return { label: "Fehler", score: 0, level: "neutral", description: "Datenabruf fehlgeschlagen" };
  }
}

/**
 * Breadth Engine: RSP/SPY ratio as proxy for market breadth
 */
async function calculateBreadthEngine(): Promise<EngineResult> {
  try {
    const [rspPrices, spyPrices] = await Promise.all([
      fetchHistoricalPrices('RSP.US', 1),
      fetchHistoricalPrices('SPY.US', 1),
    ]);
    
    if (!rspPrices || !spyPrices || rspPrices.length < 20 || spyPrices.length < 20) {
      return { label: "Ungenügend Daten", score: 0, level: "neutral", description: "Weniger als 20 Tage Daten" };
    }

    const rspCloses = rspPrices.map((p: any) => p.close);
    const spyCloses = spyPrices.map((p: any) => p.close);
    
    const rsp1m = (rspCloses[rspCloses.length - 1] - rspCloses[rspCloses.length - 21]) / rspCloses[rspCloses.length - 21];
    const spy1m = (spyCloses[spyCloses.length - 1] - spyCloses[spyCloses.length - 21]) / spyCloses[spyCloses.length - 21];
    
    // If RSP outperforms SPY, breadth is healthy (bullish)
    const breadthDiff = rsp1m - spy1m;
    const score = Math.max(-1, Math.min(1, breadthDiff * 15));
    const level = classify(score);
    
    const desc = `RSP 1M: ${(rsp1m * 100).toFixed(1)}% | SPY 1M: ${(spy1m * 100).toFixed(1)}% | Breadth ${breadthDiff > 0 ? 'gesund' : 'schwach'}`;
    
    return { label: labelFromLevel(level), score, level, description: desc };
  } catch (e) {
    console.error('[MarketRegime] Breadth engine error:', e);
    return { label: "Fehler", score: 0, level: "neutral", description: "Datenabruf fehlgeschlagen" };
  }
}

/**
 * Volatility/Risk Engine: VIX level and trend
 */
async function calculateVolatilityEngine(): Promise<EngineResult> {
  try {
    const prices = await fetchHistoricalPrices('VIX.INDX', 1);
    
    if (!prices || prices.length < 20) {
      return { label: "Ungenügend Daten", score: 0, level: "neutral", description: "Weniger als 20 Tage VIX-Daten" };
    }

    const closes = prices.map((p: any) => p.close);
    const currentVix = closes[closes.length - 1];
    const avg20 = closes.slice(-20).reduce((a: number, b: number) => a + b, 0) / 20;
    
    // VIX level signal (inverted: low VIX = bullish)
    let levelSignal = 0;
    if (currentVix < 15) levelSignal = 0.5;
    else if (currentVix < 20) levelSignal = 0.2;
    else if (currentVix < 25) levelSignal = -0.1;
    else if (currentVix < 30) levelSignal = -0.3;
    else levelSignal = -0.6;
    
    // VIX trend (rising VIX = bearish)
    const vixTrend = (currentVix - avg20) / avg20;
    const trendSignal = Math.max(-0.4, Math.min(0.4, -vixTrend * 5));
    
    const score = Math.max(-1, Math.min(1, levelSignal + trendSignal));
    const level = classify(score);
    
    const desc = `VIX: ${currentVix.toFixed(1)} | 20D-Avg: ${avg20.toFixed(1)} | ${currentVix < avg20 ? 'Fallend' : 'Steigend'}`;
    
    return { label: labelFromLevel(level), score, level, description: desc };
  } catch (e) {
    console.error('[MarketRegime] Volatility engine error:', e);
    return { label: "Fehler", score: 0, level: "neutral", description: "Datenabruf fehlgeschlagen" };
  }
}

/**
 * Liquidity Engine: TLT (bonds) and UUP (dollar) as proxies
 */
async function calculateLiquidityEngine(): Promise<EngineResult> {
  try {
    const [tltPrices, uupPrices] = await Promise.all([
      fetchHistoricalPrices('TLT.US', 1),
      fetchHistoricalPrices('UUP.US', 1),
    ]);
    
    let tltSignal = 0;
    if (tltPrices && tltPrices.length >= 50) {
      const tltCloses = tltPrices.map((p: any) => p.close);
      const tlt1m = (tltCloses[tltCloses.length - 1] - tltCloses[tltCloses.length - 21]) / tltCloses[tltCloses.length - 21];
      tltSignal = Math.max(-1, Math.min(1, tlt1m * 10));
    }

    let dollarSignal = 0;
    if (uupPrices && uupPrices.length >= 50) {
      const uupCloses = uupPrices.map((p: any) => p.close);
      const uup1m = (uupCloses[uupCloses.length - 1] - uupCloses[uupCloses.length - 21]) / uupCloses[uupCloses.length - 21];
      dollarSignal = Math.max(-1, Math.min(1, -uup1m * 10));
    }

    const score = Math.max(-1, Math.min(1, (tltSignal * 0.6 + dollarSignal * 0.4)));
    const level = classify(score);
    
    const desc = `TLT-Signal: ${tltSignal > 0 ? '+' : ''}${(tltSignal * 100).toFixed(0)}% | USD-Signal: ${dollarSignal > 0 ? '+' : ''}${(dollarSignal * 100).toFixed(0)}%`;
    
    return { label: labelFromLevel(level), score, level, description: desc };
  } catch (e) {
    console.error('[MarketRegime] Liquidity engine error:', e);
    return { label: "Fehler", score: 0, level: "neutral", description: "Datenabruf fehlgeschlagen" };
  }
}

/**
 * Credit/Stress Engine: HYG/LQD ratio as credit spread proxy
 */
async function calculateCreditEngine(): Promise<EngineResult> {
  try {
    const [hygPrices, lqdPrices] = await Promise.all([
      fetchHistoricalPrices('HYG.US', 1),
      fetchHistoricalPrices('LQD.US', 1),
    ]);
    
    if (!hygPrices || !lqdPrices || hygPrices.length < 20 || lqdPrices.length < 20) {
      return { label: "Ungenügend Daten", score: 0, level: "neutral", description: "Weniger als 20 Tage Daten" };
    }

    const hygCloses = hygPrices.map((p: any) => p.close);
    const lqdCloses = lqdPrices.map((p: any) => p.close);
    
    // HYG/LQD ratio: rising = tightening spreads = bullish
    const currentRatio = hygCloses[hygCloses.length - 1] / lqdCloses[lqdCloses.length - 1];
    const ratio20dAgo = hygCloses[hygCloses.length - 21] / lqdCloses[lqdCloses.length - 21];
    
    const ratioChange = (currentRatio - ratio20dAgo) / ratio20dAgo;
    const score = Math.max(-1, Math.min(1, ratioChange * 30));
    const level = classify(score);
    
    const desc = `HYG/LQD Ratio: ${currentRatio.toFixed(3)} | 20D-Trend: ${ratioChange > 0 ? 'Spreads tightening' : 'Spreads widening'}`;
    
    return { label: labelFromLevel(level), score, level, description: desc };
  } catch (e) {
    console.error('[MarketRegime] Credit engine error:', e);
    return { label: "Fehler", score: 0, level: "neutral", description: "Datenabruf fehlgeschlagen" };
  }
}

/**
 * Sentiment Engine: VIX Z-Score as contrarian sentiment proxy
 */
async function calculateSentimentEngine(): Promise<EngineResult> {
  try {
    const prices = await fetchHistoricalPrices('VIX.INDX', 1);
    
    if (!prices || prices.length < 60) {
      return { label: "Ungenügend Daten", score: 0, level: "neutral", description: "Weniger als 60 Tage Daten" };
    }

    const closes = prices.map((p: any) => p.close);
    const currentVix = closes[closes.length - 1];
    
    // Calculate Z-Score of VIX (contrarian: extreme fear = buy opportunity)
    const mean = closes.reduce((a: number, b: number) => a + b, 0) / closes.length;
    const std = Math.sqrt(closes.reduce((a: number, b: number) => a + (b - mean) ** 2, 0) / closes.length);
    const zScore = std > 0 ? (currentVix - mean) / std : 0;
    
    // Contrarian: high VIX z-score (extreme fear) = bullish signal
    // Low VIX z-score (complacency) = bearish signal
    let score = 0;
    if (zScore > 2) score = 0.6; // Extreme fear = contrarian buy
    else if (zScore > 1) score = 0.3;
    else if (zScore < -1.5) score = -0.4; // Extreme complacency = warning
    else if (zScore < -0.5) score = -0.2;
    
    const level = classify(score);
    const desc = `VIX Z-Score: ${zScore.toFixed(2)} | ${zScore > 1 ? 'Extreme Angst (konträr bullish)' : zScore < -1 ? 'Sorglosigkeit (Warnung)' : 'Normal'}`;
    
    return { label: labelFromLevel(level), score, level, description: desc };
  } catch (e) {
    console.error('[MarketRegime] Sentiment engine error:', e);
    return { label: "Fehler", score: 0, level: "neutral", description: "Datenabruf fehlgeschlagen" };
  }
}

/**
 * Bubble/LPPL Engine: Uses our existing LPPLS BubbleScore
 */
async function calculateBubbleEngine(): Promise<EngineResult> {
  try {
    const prices = await fetchHistoricalPrices('GSPC.INDX', 2);
    
    if (!prices || prices.length < 250) {
      return { label: "Ungenügend Daten", score: 0, level: "neutral", description: "Weniger als 250 Tage Daten" };
    }

    const { detectBubble } = await import("../analytics/lpplsEngine");
    const priceData = prices.map((p: any) => p.close);
    
    const result = detectBubble({ prices: priceData, sentimentScore: 0 });
    
    // BubbleScore > 0 means bubble detected (bearish for market)
    const score = -result.bubbleScore; // Invert: bubble = bearish
    const level = classify(score);
    
    let desc = `LPPLS Confidence: ${(result.bubbleConfidence * 100).toFixed(0)}%`;
    if (result.bubbleScore > 0.5) desc += " | Bubble-Warnung!";
    else if (result.bubbleScore > 0.2) desc += " | Erhöhtes Risiko";
    else desc += " | Normal";
    
    return { label: labelFromLevel(level), score, level, description: desc };
  } catch (e) {
    console.error('[MarketRegime] Bubble engine error:', e);
    return { label: "Fehler", score: 0, level: "neutral", description: "Berechnung fehlgeschlagen" };
  }
}

// Weights for each engine
const ENGINE_WEIGHTS = {
  trend: 0.30,
  breadth: 0.15,
  volatility: 0.20,
  liquidity: 0.15,
  credit: 0.10,
  sentiment: 0.05,
  bubble: 0.05,
};

export const marketRegimeRouter = router({
  getRegime: publicProcedure.query(async () => {
    // Run all engines in parallel
    const [trend, breadth, volatility, liquidity, credit, sentiment, bubble] = await Promise.all([
      calculateTrendEngine(),
      calculateBreadthEngine(),
      calculateVolatilityEngine(),
      calculateLiquidityEngine(),
      calculateCreditEngine(),
      calculateSentimentEngine(),
      calculateBubbleEngine(),
    ]);

    // Calculate weighted overall score
    const overallScore =
      trend.score * ENGINE_WEIGHTS.trend +
      breadth.score * ENGINE_WEIGHTS.breadth +
      volatility.score * ENGINE_WEIGHTS.volatility +
      liquidity.score * ENGINE_WEIGHTS.liquidity +
      credit.score * ENGINE_WEIGHTS.credit +
      sentiment.score * ENGINE_WEIGHTS.sentiment +
      bubble.score * ENGINE_WEIGHTS.bubble;

    // Determine regime
    let overallRegime: string;
    let equityAllocation: number;
    let regimeMultiplier: number;

    if (overallScore > 0.25) {
      overallRegime = "Risk-On";
      equityAllocation = 80;
      regimeMultiplier = 1.2;
    } else if (overallScore > -0.1) {
      overallRegime = "Neutral";
      equityAllocation = 60;
      regimeMultiplier = 1.0;
    } else if (overallScore > -0.4) {
      overallRegime = "Defensive";
      equityAllocation = 40;
      regimeMultiplier = 0.7;
    } else {
      overallRegime = "Risk-Off";
      equityAllocation = 20;
      regimeMultiplier = 0.3;
    }

    return {
      overallRegime,
      overallScore,
      equityAllocation,
      regimeMultiplier,
      engines: { trend, breadth, volatility, liquidity, credit, sentiment, bubble },
      lastUpdated: new Date().toISOString(),
    };
  }),
});
