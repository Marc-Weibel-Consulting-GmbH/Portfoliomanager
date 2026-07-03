/**
 * Fiscal.ai API Wrapper
 * Provides access to professional financial ratios including Forward P/E
 */

import { ENV } from './env';
import { fiscalPEHistorySchema, payloadSample } from './externalSchemas';

const FISCAL_API_KEY = ENV.fiscalApiKey;
const FISCAL_API_BASE = 'https://api.fiscal.ai/v1';

export interface FiscalPERatio {
  date: string;
  ratio: number;
}

/**
 * Fetch historical P/E ratio data from Fiscal.ai
 * Returns daily P/E ratios for the specified ticker
 * 
 * @param ticker - Stock ticker symbol (e.g., 'NVDA', 'META')
 * @returns Array of {date, ratio} objects, or null if not available
 */
export async function getFiscalPEHistory(ticker: string): Promise<FiscalPERatio[] | null> {
  if (!FISCAL_API_KEY) {
    console.warn('[Fiscal.ai] API key not configured');
    return null;
  }

  try {
    const url = `${FISCAL_API_BASE}/company/ratios/daily/ratio_price_to_earnings?ticker=${ticker}&apiKey=${FISCAL_API_KEY}`;
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      
      // Check if this is a "not available" error (403)
      if (response.status === 403 && error.errors?.[0]?.message?.includes('not available')) {
        console.log(`[Fiscal.ai] ${ticker} not available in current plan`);
        return null;
      }
      
      console.error(`[Fiscal.ai] API error for ${ticker}:`, error);
      return null;
    }

    const raw = await response.json();

    // A-05: validate instead of blindly casting — unexpected payloads
    // (error objects, HTML) must not flow into median-P/E calculations.
    const parsed = fiscalPEHistorySchema.safeParse(raw);
    if (!parsed.success) {
      console.warn(`[Fiscal.ai] Unexpected P/E payload for ${ticker}. Sample: ${payloadSample(raw)}`);
      return null;
    }

    const data: FiscalPERatio[] = parsed.data;

    if (data.length === 0) {
      console.log(`[Fiscal.ai] No data available for ${ticker}`);
      return null;
    }

    console.log(`[Fiscal.ai] Successfully fetched ${data.length} P/E data points for ${ticker}`);
    return data;
    
  } catch (error) {
    console.error(`[Fiscal.ai] Failed to fetch P/E data for ${ticker}:`, error);
    return null;
  }
}

/**
 * Calculate median P/E ratio from historical data
 */
export function calculateMedianPE(data: FiscalPERatio[]): number {
  const ratios = data.map(d => d.ratio).filter(r => r > 0 && isFinite(r));
  
  if (ratios.length === 0) return 0;
  
  ratios.sort((a, b) => a - b);
  const mid = Math.floor(ratios.length / 2);
  
  return ratios.length % 2 === 0
    ? (ratios[mid - 1] + ratios[mid]) / 2
    : ratios[mid];
}
