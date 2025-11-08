// Ticker validator uses inline fetch logic to avoid circular dependencies

export interface TickerValidationResult {
  isValid: boolean;
  ticker: string;
  originalTicker: string;
  completeness: number; // 0-100%
  missingFields: string[];
  data?: {
    currentPrice?: number;
    pe?: number;
    peg?: number;
    sharpe?: number;
    dividendYield?: number;
  };
}

/**
 * Inline stock data fetching (simplified version from routers.ts)
 */
async function fetchStockDataInline(ticker: string): Promise<any> {
  const apiKey = process.env.EODHD_API_KEY;
  if (!apiKey) throw new Error("EODHD API key not configured");

  const cleanTicker = ticker;
  const fundamentalsUrl = `https://eodhd.com/api/fundamentals/${cleanTicker}?api_token=${apiKey}`;
  const quoteUrl = `https://eodhd.com/api/real-time/${cleanTicker}?api_token=${apiKey}&fmt=json`;

  const [fundamentalsRes, quoteRes] = await Promise.all([
    fetch(fundamentalsUrl),
    fetch(quoteUrl),
  ]);

  if (!fundamentalsRes.ok || !quoteRes.ok) {
    throw new Error(`Failed to fetch data for ${ticker}`);
  }

  const fundamentals = await fundamentalsRes.json();
  const quote = await quoteRes.json();

  return {
    currentPrice: quote.close || null,
    pe: fundamentals.Highlights?.PERatio || null,
    peg: fundamentals.Highlights?.PEGRatio || null,
    sharpe: fundamentals.Technicals?.SharpeRatio || null,
    dividendYield: fundamentals.Highlights?.DividendYield
      ? fundamentals.Highlights.DividendYield * 100
      : null,
  };
}

/**
 * Validates a ticker and checks data completeness
 * Returns the best ticker variant with most complete data
 */
export async function validateTicker(
  ticker: string
): Promise<TickerValidationResult> {
  const originalTicker = ticker;

  // Generate ticker variants to try
  const variants = generateTickerVariants(ticker);

  console.log(`[Ticker Validator] Testing ${variants.length} variants for ${ticker}:`, variants);

  let bestResult: TickerValidationResult | null = null;
  let bestCompleteness = 0;

  for (const variant of variants) {
    try {
      const data = await fetchStockDataInline(variant);

      const result = evaluateDataCompleteness(variant, originalTicker, data);

      console.log(
        `[Ticker Validator] ${variant}: ${result.completeness}% complete (missing: ${result.missingFields.join(', ') || 'none'})`
      );

      if (result.completeness > bestCompleteness) {
        bestResult = result;
        bestCompleteness = result.completeness;
      }

      // If we found 100% complete data, stop searching
      if (result.completeness === 100) {
        console.log(`[Ticker Validator] Found 100% complete data for ${variant}`);
        break;
      }
    } catch (error) {
      console.log(`[Ticker Validator] ${variant}: Failed to fetch data`);
    }
  }

  if (!bestResult) {
    return {
      isValid: false,
      ticker: originalTicker,
      originalTicker,
      completeness: 0,
      missingFields: ['currentPrice', 'pe', 'peg', 'sharpe', 'dividendYield'],
    };
  }

  return bestResult;
}

/**
 * Generate ticker variants to try
 * Priority order: Original → .SW → .US → without suffix
 */
function generateTickerVariants(ticker: string): string[] {
  const variants: string[] = [ticker];

  // Remove existing suffix if present
  const baseTicker = ticker.replace(/\.(SW|US|PA|MI|N|F|L)$/i, '');

  // Add Swiss variant if not already present
  if (!ticker.endsWith('.SW')) {
    variants.push(`${baseTicker}.SW`);
  }

  // Add US variant if not already present
  if (!ticker.endsWith('.US')) {
    variants.push(`${baseTicker}.US`);
  }

  // Add base ticker without suffix if different from original
  if (baseTicker !== ticker) {
    variants.push(baseTicker);
  }

  return variants;
}

/**
 * Evaluate data completeness and return result
 */
function evaluateDataCompleteness(
  ticker: string,
  originalTicker: string,
  data: any
): TickerValidationResult {
  const missingFields: string[] = [];
  let completenessScore = 0;
  const totalFields = 5;

  // Check currentPrice (most important)
  if (data.currentPrice && data.currentPrice > 0) {
    completenessScore++;
  } else {
    missingFields.push('currentPrice');
  }

  // Check P/E ratio
  if (data.pe && data.pe > 0) {
    completenessScore++;
  } else {
    missingFields.push('pe');
  }

  // Check PEG ratio
  if (data.peg && data.peg > 0) {
    completenessScore++;
  } else {
    missingFields.push('peg');
  }

  // Check Sharpe ratio
  if (data.sharpe !== undefined && data.sharpe !== null) {
    completenessScore++;
  } else {
    missingFields.push('sharpe');
  }

  // Check dividend yield
  if (data.dividendYield !== undefined && data.dividendYield >= 0) {
    completenessScore++;
  } else {
    missingFields.push('dividendYield');
  }

  const completeness = Math.round((completenessScore / totalFields) * 100);

  return {
    isValid: completeness >= 20, // At least price must be available
    ticker,
    originalTicker,
    completeness,
    missingFields,
    data: {
      currentPrice: data.currentPrice,
      pe: data.pe,
      peg: data.peg,
      sharpe: data.sharpe,
      dividendYield: data.dividendYield,
    },
  };
}
