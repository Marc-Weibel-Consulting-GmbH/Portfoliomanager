/**
 * Sentiment Analysis Engine
 * =========================
 * Uses LLM (invokeLLM) to analyze news headlines and generate
 * a sentiment score for stocks. Integrates into the signals system.
 */

import { invokeLLM, invokeKimi } from '../_core/llm';
import YahooFinance from 'yahoo-finance2';

const yf = new (YahooFinance as any)();

export interface SentimentResult {
  ticker: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  score: number; // -100 to +100
  confidence: number; // 0 to 1
  summary: string;
  newsCount: number;
  topHeadlines: string[];
}

/**
 * Fetch recent news headlines for a ticker from Yahoo Finance
 */
async function fetchNewsHeadlines(ticker: string): Promise<string[]> {
  try {
    const results = await yf.search(ticker, { newsCount: 10 }) as any;
    const news = results?.news || [];
    return news
      .filter((n: any) => n.title)
      .map((n: any) => n.title as string)
      .slice(0, 10);
  } catch (e) {
    return [];
  }
}

/**
 * Analyze sentiment of news headlines using LLM
 */
export async function analyzeSentiment(ticker: string, companyName?: string): Promise<SentimentResult> {
  const headlines = await fetchNewsHeadlines(ticker);
  
  if (headlines.length === 0) {
    return {
      ticker,
      sentiment: 'neutral',
      score: 0,
      confidence: 0,
      summary: 'Keine aktuellen Nachrichten verfügbar.',
      newsCount: 0,
      topHeadlines: [],
    };
  }

  const headlineText = headlines.map((h, i) => `${i + 1}. ${h}`).join('\n');
  
  try {
    const response = await invokeKimi({
      messages: [
        {
          role: 'system',
          content: `Du bist ein Finanzanalyst der Nachrichtenstimmung für Aktien bewertet. 
Analysiere die folgenden Nachrichtenschlagzeilen und gib eine strukturierte Bewertung ab.
Antworte NUR mit validem JSON im angegebenen Format.`
        },
        {
          role: 'user',
          content: `Analysiere die Stimmung dieser Nachrichten für ${companyName || ticker} (${ticker}):

${headlineText}

Antworte mit JSON:
{
  "sentiment": "bullish" | "bearish" | "neutral",
  "score": <Zahl von -100 bis +100, wobei -100 extrem bearish und +100 extrem bullish ist>,
  "confidence": <Zahl von 0 bis 1, wie sicher du dir bist>,
  "summary": "<1-2 Sätze Zusammenfassung der Gesamtstimmung auf Deutsch>"
}`
        }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'sentiment_analysis',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              sentiment: { type: 'string', enum: ['bullish', 'bearish', 'neutral'] },
              score: { type: 'number' },
              confidence: { type: 'number' },
              summary: { type: 'string' },
            },
            required: ['sentiment', 'score', 'confidence', 'summary'],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices?.[0]?.message?.content;
    let parsed: any;
    
    if (typeof content === 'string') {
      parsed = JSON.parse(content);
    } else {
      // Handle array content
      const textPart = Array.isArray(content) 
        ? content.find((c: any) => c.type === 'text') 
        : null;
      parsed = JSON.parse((textPart as any)?.text || '{}');
    }

    return {
      ticker,
      sentiment: parsed.sentiment || 'neutral',
      score: Math.max(-100, Math.min(100, parsed.score || 0)),
      confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
      summary: parsed.summary || 'Analyse nicht verfügbar.',
      newsCount: headlines.length,
      topHeadlines: headlines.slice(0, 5),
    };
  } catch (e) {
    console.warn(`[Sentiment] LLM analysis failed for ${ticker}:`, (e as Error).message);
    return {
      ticker,
      sentiment: 'neutral',
      score: 0,
      confidence: 0,
      summary: 'Sentiment-Analyse fehlgeschlagen.',
      newsCount: headlines.length,
      topHeadlines: headlines.slice(0, 5),
    };
  }
}

/**
 * Batch sentiment analysis for multiple tickers
 */
export async function batchSentimentAnalysis(
  tickers: Array<{ ticker: string; companyName?: string }>
): Promise<SentimentResult[]> {
  const results: SentimentResult[] = [];
  
  // Process sequentially to avoid rate limiting
  for (const { ticker, companyName } of tickers) {
    const result = await analyzeSentiment(ticker, companyName);
    results.push(result);
    // Small delay between LLM calls
    await new Promise(r => setTimeout(r, 500));
  }
  
  return results;
}

/**
 * Convert sentiment score to signal contribution
 * Returns a value between -3 and +3 to add to the signal score
 */
export function sentimentToSignalScore(sentiment: SentimentResult): number {
  if (sentiment.confidence < 0.3 || sentiment.newsCount < 2) return 0;
  
  const { score, confidence } = sentiment;
  
  // Scale: score (-100 to +100) * confidence → signal contribution (-3 to +3)
  const contribution = (score / 100) * 3 * confidence;
  
  return Math.round(contribution * 10) / 10; // Round to 1 decimal
}
