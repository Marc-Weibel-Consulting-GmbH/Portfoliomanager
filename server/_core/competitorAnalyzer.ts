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
  category: string
): Promise<CompetitorAnalysis> {
  console.log(`[CompetitorAnalyzer] Finding competitors for ${ticker} (${name})`);
  
  // Step 1: Get current stock metrics
  const region = ticker.endsWith('.SW') ? 'CH' : 'US';
  const currentMetrics = await fetchStockMetrics(ticker, region);
  const currentFundamentals = await fetchEODHDFundamentals(ticker);
  
  const currentStock: CompetitorStock = {
    ticker,
    name,
    currentPrice: currentMetrics.currentPrice,
    sharpeRatio: currentMetrics.sharpeRatio,
    pegRatio: currentFundamentals.pegRatio,
    peRatio: currentFundamentals.peRatio,
    dividendYield: currentFundamentals.dividendYield,
    volatility: currentMetrics.volatility,
    beta: currentFundamentals.beta,
    score: calculateScore({
      sharpeRatio: currentMetrics.sharpeRatio,
      pegRatio: currentFundamentals.pegRatio,
      dividendYield: currentFundamentals.dividendYield,
      volatility: currentMetrics.volatility,
    }),
    reason: "Aktuelle Position",
  };
  
  console.log(`[CompetitorAnalyzer] Current stock score: ${currentStock.score.toFixed(2)}`);
  
  // Step 2: Use LLM to find similar companies
  const llmResponse = await invokeLLM({
    messages: [
      {
        role: "system",
        content: "You are a financial analyst expert. Your task is to identify competitor companies in the same industry/sector."
      },
      {
        role: "user",
        content: `Find 5-7 direct competitors for "${name}" (Ticker: ${ticker}, Category: ${category}).
        
Requirements:
- Same industry/sector
- Similar market cap range
- Listed on ${region === 'CH' ? 'Swiss Exchange (use .SW suffix)' : 'US exchanges'}
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
    try {
      const metrics = await fetchStockMetrics(competitorTicker, region);
      const fundamentals = await fetchEODHDFundamentals(competitorTicker);
      
      const score = calculateScore({
        sharpeRatio: metrics.sharpeRatio,
        pegRatio: fundamentals.pegRatio,
        dividendYield: fundamentals.dividendYield,
        volatility: metrics.volatility,
      });
      
      // Only include if score is better than current
      if (score > currentStock.score) {
        const tempCompetitor: CompetitorStock = {
          ticker: competitorTicker,
          name: competitorTicker, // We don't have name from API
          currentPrice: metrics.currentPrice,
          sharpeRatio: metrics.sharpeRatio,
          pegRatio: fundamentals.pegRatio,
          peRatio: fundamentals.peRatio,
          dividendYield: fundamentals.dividendYield,
          volatility: metrics.volatility,
          beta: fundamentals.beta,
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

