/**
 * Sornette Finance API Integration
 * =================================
 * Official LPPLS confidence data from the Financial Crisis Observatory (FCO)
 * at ETH Zurich, as provided by sornette.finance.
 *
 * API Docs: https://api.sornette.finance/swagger-ui/index.html
 *
 * Basic Plan assets available:
 *   TSLA, XAUUSD, BCOMCOTR, N225, META, AAPL, MSFT, BTC-USD,
 *   DXY, AMZN, STOXX, NDX, HSI, GSPC (OPEN_FEATURES), NVDA (OPEN_FEATURES)
 *
 * Key endpoint: GET /v1/stock/code/{code}/confidence
 *   Returns all historical LPPLS confidence indicators for a given asset.
 *
 * Confidence indicator codes (time scales):
 *   2-4w   → 2 to 4 weeks  (sortOrder: 50)
 *   1-3m   → 1 to 3 months (sortOrder: 100)
 *   3-6m   → 3 to 6 months (sortOrder: 200)
 *   6-12m  → 6 to 12 months (sortOrder: 300)
 *   12-24m → 12 to 24 months (sortOrder: 400)
 *   2-6y   → 2 to 6 years  (sortOrder: 500)
 *
 * Composite Score Calculation (AM Combo):
 *   - Take the most recent record for each time scale
 *   - Average the positiveConfidence values (NaN → 0)
 *   - Average the negativeConfidence values (NaN → 0)
 *   - Net = AM_pos - AM_neg
 *   - Score (0–100) = clamp(50 + Net * 100, 0, 100)
 *   - The 2-6y indicator is the most important (long-term bubble detection)
 */

const SORNETTE_API_BASE = 'https://api.sornette.finance';
const SORNETTE_AUTH_URL = `${SORNETTE_API_BASE}/v1/auth/token`;

// Map from our internal ticker symbols to Sornette API codes
const TICKER_TO_SORNETTE: Record<string, string> = {
  // Stocks available on Basic plan
  'TSLA': 'TSLA',
  'META': 'META',
  'AAPL': 'AAPL',
  'MSFT': 'MSFT',
  'AMZN': 'AMZN',
  'NVDA': 'NVDA',
  // Indices
  '^GSPC': 'GSPC',
  'GSPC': 'GSPC',
  'SPX': 'GSPC',
  'NDX': 'NDX',
  '^NDX': 'NDX',
  'N225': 'N225',
  '^N225': 'N225',
  'STOXX': 'STOXX',
  'HSI': 'HSI',
  // Commodities/Currencies
  'XAUUSD': 'XAUUSD',
  'GC=F': 'XAUUSD',
  'BTC-USD': 'BTC-USD',
  'DXY': 'DXY',
};

// Time scale codes in order of importance
const TIME_SCALES = ['2-4w', '1-3m', '3-6m', '6-12m', '12-24m', '2-6y'] as const;
type TimeScale = typeof TIME_SCALES[number];

export interface SornetteConfidenceRecord {
  id: number;
  t1: string;
  t2: string;
  indicatorCode: TimeScale;
  indicatorName: string;
  positiveConfidence: number | 'NaN';
  negativeConfidence: number | 'NaN';
  bestPositiveT1: string | null;
  bestNegativeT1: string | null;
  type: string;
  sortOrder: number;
  confidenceType: string;
  positiveT1Qualified: boolean;
  negativeT1Qualified: boolean;
}

export interface SornetteBubbleScore {
  /** Composite score 0–100 (50 = neutral, >50 = bubble risk, <50 = anti-bubble) */
  score: number;
  /** Positive bubble confidence (0–1) for each time scale */
  positiveByScale: Record<TimeScale, number>;
  /** Negative bubble confidence (0–1) for each time scale */
  negativeByScale: Record<TimeScale, number>;
  /** Whether the 2-6y indicator shows a qualified positive bubble */
  longTermBubble: boolean;
  /** Estimated critical time from 2-6y best positive T1 */
  bestPositiveT1_2_6y: string | null;
  /** Data freshness: date of the latest record */
  dataDate: string | null;
  /** Source: 'sornette_api' or 'fallback' */
  source: 'sornette_api' | 'fallback';
}

// ─── Token Cache ───────────────────────────────────────────────────────────────
let cachedToken: string | null = null;
let tokenExpiry: number = 0;

async function getToken(): Promise<string | null> {
  const now = Date.now();
  // Return cached token if still valid (with 5 min buffer)
  if (cachedToken && now < tokenExpiry - 5 * 60 * 1000) {
    return cachedToken;
  }

  const username = process.env.SORNETTE_USERNAME;
  const password = process.env.SORNETTE_PASSWORD;

  if (!username || !password) {
    console.warn('[SornetteAPI] Missing SORNETTE_USERNAME or SORNETTE_PASSWORD env vars');
    return null;
  }

  try {
    const resp = await fetch(SORNETTE_AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!resp.ok) {
      console.error(`[SornetteAPI] Auth failed: ${resp.status}`);
      return null;
    }

    const data = await resp.json() as { token: string; expiresAt?: string };
    cachedToken = data.token;

    // Parse expiry from JWT payload or expiresAt field
    if (data.expiresAt) {
      tokenExpiry = new Date(data.expiresAt).getTime();
    } else {
      // Decode JWT to get exp
      try {
        const payload = JSON.parse(Buffer.from(data.token.split('.')[1], 'base64').toString());
        tokenExpiry = payload.exp ? payload.exp * 1000 : now + 3600 * 1000;
      } catch {
        tokenExpiry = now + 3600 * 1000; // Default 1h
      }
    }

    return cachedToken;
  } catch (err) {
    console.error('[SornetteAPI] Auth error:', err);
    return null;
  }
}

// ─── Confidence Data Cache ──────────────────────────────────────────────────────
const confidenceCache = new Map<string, { data: SornetteConfidenceRecord[]; fetchedAt: number }>();
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours (data updates daily)

async function fetchConfidence(sornetteCode: string): Promise<SornetteConfidenceRecord[] | null> {
  const cached = confidenceCache.get(sornetteCode);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  const token = await getToken();
  if (!token) return null;

  try {
    const resp = await fetch(`${SORNETTE_API_BASE}/v1/stock/code/${sornetteCode}/confidence`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!resp.ok) {
      console.error(`[SornetteAPI] Confidence fetch failed for ${sornetteCode}: ${resp.status}`);
      return null;
    }

    const data = await resp.json() as SornetteConfidenceRecord[];
    confidenceCache.set(sornetteCode, { data, fetchedAt: Date.now() });
    return data;
  } catch (err) {
    console.error(`[SornetteAPI] Error fetching confidence for ${sornetteCode}:`, err);
    return null;
  }
}

// ─── Score Calculation ─────────────────────────────────────────────────────────

function parseConfidence(val: number | 'NaN'): number {
  if (val === 'NaN' || typeof val !== 'number' || isNaN(val as number)) return 0;
  return val as number;
}

/**
 * Calculate composite bubble score from raw confidence records.
 * Uses the AM (Arithmetic Mean) Combo method from the FCO platform.
 */
function calculateCompositeScore(records: SornetteConfidenceRecord[]): SornetteBubbleScore {
  // Get most recent record per time scale
  const latestByScale = new Map<TimeScale, SornetteConfidenceRecord>();
  for (const record of records) {
    const code = record.indicatorCode as TimeScale;
    if (!TIME_SCALES.includes(code)) continue;
    const existing = latestByScale.get(code);
    if (!existing || record.t2 > existing.t2) {
      latestByScale.set(code, record);
    }
  }

  const positiveByScale: Record<TimeScale, number> = {} as Record<TimeScale, number>;
  const negativeByScale: Record<TimeScale, number> = {} as Record<TimeScale, number>;

  let posSum = 0;
  let negSum = 0;
  let count = 0;

  for (const scale of TIME_SCALES) {
    const rec = latestByScale.get(scale);
    const pos = rec ? parseConfidence(rec.positiveConfidence) : 0;
    const neg = rec ? parseConfidence(rec.negativeConfidence) : 0;
    positiveByScale[scale] = pos;
    negativeByScale[scale] = neg;
    posSum += pos;
    negSum += neg;
    count++;
  }

  const amPos = count > 0 ? posSum / count : 0;
  const amNeg = count > 0 ? negSum / count : 0;
  const net = amPos - amNeg;

  // Score: 50 = neutral, 100 = max positive bubble, 0 = max negative bubble
  const score = Math.round(Math.min(100, Math.max(0, 50 + net * 100)));

  // Long-term bubble: 2-6y indicator with qualified positive signal
  const rec2_6y = latestByScale.get('2-6y');
  const longTermBubble = rec2_6y?.positiveT1Qualified === true &&
    parseConfidence(rec2_6y.positiveConfidence) > 0;

  const dataDate = rec2_6y?.t2 ?? null;
  const bestPositiveT1_2_6y = rec2_6y?.bestPositiveT1 ?? null;

  return {
    score,
    positiveByScale,
    negativeByScale,
    longTermBubble,
    bestPositiveT1_2_6y,
    dataDate,
    source: 'sornette_api',
  };
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Get bubble score for a given ticker symbol.
 * Returns null if the ticker is not available in the Sornette API.
 */
export async function getSornetteBubbleScore(ticker: string): Promise<SornetteBubbleScore | null> {
  const sornetteCode = TICKER_TO_SORNETTE[ticker.toUpperCase()];
  if (!sornetteCode) return null;

  const records = await fetchConfidence(sornetteCode);
  if (!records || records.length === 0) return null;

  return calculateCompositeScore(records);
}

/**
 * Get bubble scores for multiple tickers in parallel.
 * Returns a map of ticker → score (only for available tickers).
 */
export async function getBatchSornetteBubbleScores(
  tickers: string[]
): Promise<Map<string, SornetteBubbleScore>> {
  const results = new Map<string, SornetteBubbleScore>();

  await Promise.all(
    tickers.map(async (ticker) => {
      const score = await getSornetteBubbleScore(ticker);
      if (score) results.set(ticker, score);
    })
  );

  return results;
}

/**
 * Get the S&P 500 bubble score (primary market indicator).
 * This is the main signal used in the portfolio risk tab.
 */
export async function getMarketBubbleScore(): Promise<SornetteBubbleScore | null> {
  return getSornetteBubbleScore('GSPC');
}

/**
 * Convert a SornetteBubbleScore to the legacy format used by getBubbleIndicator.
 * score 0–100 → label + interpretation
 */
export function formatBubbleIndicatorResponse(score: SornetteBubbleScore) {
  const s = score.score;
  const label = s < 33 ? 'Niedrig' : s < 55 ? 'Mittel' : s < 75 ? 'Erhöht' : 'Hoch';

  let interpretation = '';
  if (s < 33) {
    interpretation = 'Markt zeigt keine Überhitzung. Strategie kann beibehalten werden.';
  } else if (s < 55) {
    interpretation = 'Moderate Überhitzungssignale. Risikomanagement überprüfen.';
  } else if (s < 75) {
    interpretation = 'Erhöhte Bubble-Signale auf mehreren Zeitskalen. Defensive Positionierung prüfen.';
  } else {
    interpretation = 'Starke Bubble-Signale erkannt (FCO/LPPLS). Defensive Positionierung empfohlen.';
  }

  // Add long-term bubble note
  if (score.longTermBubble && score.bestPositiveT1_2_6y) {
    interpretation += ` Langfristiger LPPL-Fit zeigt kritischen Zeitpunkt um ${score.bestPositiveT1_2_6y}.`;
  }

  // Add data source note
  interpretation += ` (Quelle: FCO/sornette.finance, Stand: ${score.dataDate ?? 'unbekannt'})`;

  return {
    score: s,
    label: label as 'Niedrig' | 'Mittel' | 'Erhöht' | 'Hoch',
    interpretation,
    source: score.source,
    dataDate: score.dataDate,
    longTermBubble: score.longTermBubble,
    bestPositiveT1_2_6y: score.bestPositiveT1_2_6y,
    positiveByScale: score.positiveByScale,
    negativeByScale: score.negativeByScale,
  };
}

/**
 * Map of available Sornette tickers for UI display
 */
export const SORNETTE_AVAILABLE_TICKERS = Object.keys(TICKER_TO_SORNETTE);
