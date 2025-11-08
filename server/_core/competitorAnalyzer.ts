/**
 * Competition Analyzer
 * Finds better alternative stocks using LLM and financial APIs
 */

import { invokeLLM } from "./llm";
import { fetchStockMetrics } from "./stockDataApi";
import { fetchEODHDFundamentals } from "./eodhdApi";

export interface CompetitorStock {
  ticker: string;
  name: string;
  currentPrice: number | null;
  sharpeRatio: number | null;
  pegRatio: number | null;
  peRatio: number | null;
  dividendYield: number | null;
  volatility: number | null;
  beta: number | null;
  score: number; // Composite score for ranking
  reason: string; // Why this is a better alternative
}

export interface CompetitorAnalysis {
  currentStock: CompetitorStock;
  alternatives: CompetitorStock[];
}

/**
 * Calculate composite score for stock comparison
 * Lower PEG = better, Higher Sharpe = better, Higher Dividend = better
 */
function calculateScore(metrics: {
  sharpeRatio: number | null;
  pegRatio: number | null;
  dividendYield: number | null;
  volatility: number | null;
}): number {
  let score = 0;
  
  // Sharpe Ratio (higher is better): weight 40%
  if (metrics.sharpeRatio !== null) {
    score += metrics.sharpeRatio * 40;
  }
  
  // PEG Ratio (lower is better): weight 30%
  if (metrics.pegRatio !== null && metrics.pegRatio > 0) {
    score += (1 / metrics.pegRatio) * 30;
  }
  
  // Dividend Yield (higher is better): weight 20%
  if (metrics.dividendYield !== null) {
    score += metrics.dividendYield * 20;
  }
  
  // Volatility penalty (lower is better): weight 10%
  if (metrics.volatility !== null) {
    score -= (metrics.volatility / 100) * 10;
  }
  
  return score;
}

/**
 * Generate reason why alternative is better
 */
function generateReason(current: CompetitorStock, alternative: CompetitorStock): string {
  const reasons: string[] = [];
  
  if (alternative.sharpeRatio !== null && current.sharpeRatio !== null) {
    if (alternative.sharpeRatio > current.sharpeRatio) {
      reasons.push(`Höheres Sharpe Ratio (${alternative.sharpeRatio.toFixed(2)} vs ${current.sharpeRatio.toFixed(2)})`);
    }
  }
  
  if (alternative.pegRatio !== null && current.pegRatio !== null) {
    if (alternative.pegRatio < current.pegRatio) {
      reasons.push(`Tieferes PEG (${alternative.pegRatio.toFixed(2)} vs ${current.pegRatio.toFixed(2)})`);
    }
  }
  
  if (alternative.dividendYield !== null && current.dividendYield !== null) {
    if (alternative.dividendYield > current.dividendYield) {
      reasons.push(`Höhere Dividende (${alternative.dividendYield.toFixed(2)}% vs ${current.dividendYield.toFixed(2)}%)`);
    }
  }
  
  return reasons.join(", ") || "Bessere Gesamtbewertung";
}

/**
 * Find competitor stocks using LLM and financial APIs
 */
export async function findCompetitors(
  ticker: string,
  name: string,
  category: string,
  existingTickers: string[] = []
): Promise<CompetitorAnalysis> {
  console.log(`[CompetitorAnalyzer] Finding competitors for ${ticker} (${name})`);
  
  // Step 1: Get current stock metrics with fallback
  const region = ticker.endsWith('.SW') ? 'CH' : 'US';
  const currentMetrics = await fetchStockMetrics(ticker, region);
  const currentFundamentals = await fetchEODHDFundamentals(ticker);
  
  // Yahoo Finance fallback for missing data
  let finalPrice = currentMetrics.currentPrice;
  let finalPegRatio = currentFundamentals.pegRatio || currentMetrics.pegRatio;
  let finalPeRatio = currentFundamentals.peRatio || currentMetrics.peRatio;
  let finalDividendYield = currentFundamentals.dividendYield || currentMetrics.dividendYield;
  let finalBeta = currentFundamentals.beta || currentMetrics.beta;
  
  // If EODHD failed completely, use Yahoo Finance data
  if (!finalPrice && !finalPegRatio && !finalPeRatio) {
    console.log(`[CompetitorAnalyzer] EODHD failed for ${ticker}, using Yahoo Finance fallback`);
    finalPrice = currentMetrics.currentPrice;
    finalPegRatio = currentMetrics.pegRatio;
    finalPeRatio = currentMetrics.peRatio;
    finalDividendYield = currentMetrics.dividendYield;
    finalBeta = currentMetrics.beta;
  }
  
  const currentStock: CompetitorStock = {
    ticker,
    name,
    currentPrice: finalPrice,
    sharpeRatio: currentMetrics.sharpeRatio,
    pegRatio: finalPegRatio,
    peRatio: finalPeRatio,
    dividendYield: finalDividendYield,
    volatility: currentMetrics.volatility,
    beta: finalBeta,
    score: calculateScore({
      sharpeRatio: currentMetrics.sharpeRatio,
      pegRatio: finalPegRatio,
      dividendYield: finalDividendYield,
      volatility: currentMetrics.volatility,
    }),
    reason: "Aktuelle Position",
  };
  
  console.log(`[CompetitorAnalyzer] Current stock score: ${currentStock.score.toFixed(2)}`);
  
  // Get industry/sector for better filtering
  const industry = currentFundamentals.industry || currentFundamentals.sector || category;
  console.log(`[CompetitorAnalyzer] Industry: ${industry}`);
  
  // Step 2: Use LLM to find similar companies
  const llmResponse = await invokeLLM({
    messages: [
      {
        role: "system",
        content: "You are a financial analyst expert. Your task is to identify competitor companies in the EXACT same industry."
      },
      {
        role: "user",
        content: `Find 5-7 direct competitors for "${name}" (Ticker: ${ticker}).
        
REQUIREMENTS:
- MUST be in the EXACT same industry: ${industry}
- Direct competitors of ${name}
- Similar business model and market cap range
- Listed on ${region === 'CH' ? 'Swiss Exchange (use .SW suffix)' : 'US exchanges'}
- DO NOT suggest these tickers (already in portfolio): ${existingTickers.join(', ')}
- Return ONLY ticker symbols, one per line
- No explanations, just tickers

Example format:
AAPL
MSFT
GOOGL`
      }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "competitors",
        strict: true,
        schema: {
          type: "object",
          properties: {
            tickers: {
              type: "array",
              items: { type: "string" },
              description: "List of competitor ticker symbols"
            }
          },
          required: ["tickers"],
          additionalProperties: false
        }
      }
    }
  });
  
  const content = llmResponse.choices[0].message.content;
  const competitorTickers = JSON.parse(typeof content === 'string' ? content : JSON.stringify(content)).tickers;
  console.log(`[CompetitorAnalyzer] LLM suggested ${competitorTickers.length} competitors:`, competitorTickers);
  
  // Step 3: Fetch metrics for all competitors
  const alternatives: CompetitorStock[] = [];
  
  for (const competitorTicker of competitorTickers.slice(0, 7)) {
    // Skip if ticker is already in portfolio
    if (existingTickers.includes(competitorTicker)) {
      console.log(`[CompetitorAnalyzer] Skipping ${competitorTicker} (already in portfolio)`);
      continue;
    }
    
    try {
      const metrics = await fetchStockMetrics(competitorTicker, region);
      const fundamentals = await fetchEODHDFundamentals(competitorTicker);
      
      // Yahoo Finance fallback for missing competitor data
      const altPrice = metrics.currentPrice;
      const altPegRatio = fundamentals.pegRatio || metrics.pegRatio;
      const altPeRatio = fundamentals.peRatio || metrics.peRatio;
      const altDividendYield = fundamentals.dividendYield || metrics.dividendYield;
      const altBeta = fundamentals.beta || metrics.beta;
      
      const score = calculateScore({
        sharpeRatio: metrics.sharpeRatio,
        pegRatio: altPegRatio,
        dividendYield: altDividendYield,
        volatility: metrics.volatility,
      });
      
      // Only include if at least one metric is significantly better
      // AND no metric is significantly worse (using fallback values)
      const isBetter = (
        (metrics.sharpeRatio !== null && currentStock.sharpeRatio !== null && 
         metrics.sharpeRatio > currentStock.sharpeRatio * 1.1) || // 10% better Sharpe
        (altPegRatio !== null && currentStock.pegRatio !== null && currentStock.pegRatio > 0 &&
         altPegRatio < currentStock.pegRatio * 0.9) || // 10% lower PEG
        (altDividendYield !== null && currentStock.dividendYield !== null &&
         altDividendYield > currentStock.dividendYield * 1.2) // 20% higher dividend
      );
      
      const isNotWorse = (
        (metrics.sharpeRatio === null || currentStock.sharpeRatio === null || 
         metrics.sharpeRatio >= currentStock.sharpeRatio * 0.7) && // Not 30% worse Sharpe
        (altPegRatio === null || currentStock.pegRatio === null || currentStock.pegRatio <= 0 ||
         altPegRatio <= currentStock.pegRatio * 1.5) && // Not 50% higher PEG
        (altDividendYield === null || currentStock.dividendYield === null ||
         altDividendYield >= currentStock.dividendYield * 0.8) // Not 20% lower dividend
      );
      
      if (isBetter && isNotWorse && score > currentStock.score) {
        const tempCompetitor: CompetitorStock = {
          ticker: competitorTicker,
          name: fundamentals.companyName || competitorTicker, // Use company name from EODHD API
          currentPrice: altPrice,
          sharpeRatio: metrics.sharpeRatio,
          pegRatio: altPegRatio,
          peRatio: altPeRatio,
          dividendYield: altDividendYield,
          volatility: metrics.volatility,
          beta: altBeta,
          score,
          reason: ""
        };
        
        const competitor: CompetitorStock = {
          ...tempCompetitor,
          reason: generateReason(currentStock, tempCompetitor),
        };
        
        alternatives.push(competitor);
        console.log(`[CompetitorAnalyzer] Found better alternative: ${competitorTicker} (score: ${score.toFixed(2)})`);
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error: any) {
      console.error(`[CompetitorAnalyzer] Failed to fetch ${competitorTicker}:`, error.message);
    }
  }
  
  // Step 4: Sort by score and return top 3
  alternatives.sort((a, b) => b.score - a.score);
  
  return {
    currentStock,
    alternatives: alternatives.slice(0, 3),
  };
}

