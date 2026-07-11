/**
 * Dividend Calendar Integration using EODHD API
 * Fetches historical and upcoming dividends with exact dates and amounts
 * Fallback to yahoo-finance2 if EODHD unavailable
 */

import { apiCache, CACHE_TTL } from "./_core/apiCache";
import { retryFetch } from "./_core/retryUtil";
import { getEodhdApiKey } from "./_core/env";
import { toEodhdSymbol } from "./lib/eodhdSymbol";

export interface DividendEvent {
  ticker: string;
  exDividendDate: string;
  paymentDate: string;
  declarationDate: string | null;
  amount: number;
  currency: string;
  period: string; // "Quarterly", "Annual", "Semi-Annual", "Interim", "Final"
  type: "upcoming" | "past" | "estimated";
}

/**
 * Convert internal ticker format to EODHD format
 * EODHD uses: AAPL.US, NESN.SW, ROG.SW etc.
 */
function toEODHDTicker(ticker: string): string {
  // Zentrale Symbol-Aliasse zuerst (z. B. MONC.MI→MONRY, HELN.SW→HELNF), sonst 404.
  const aliased = toEodhdSymbol(ticker);
  if (aliased !== ticker) return aliased;
  // If already has exchange suffix like .SW, .PA, .DE, keep it
  if (ticker.includes(".")) {
    return ticker;
  }
  // Default to US exchange
  return `${ticker}.US`;
}

/**
 * Fetch dividend data from EODHD API for a single ticker
 * Returns both historical and upcoming dividends
 */
async function fetchTickerDividendsEODHD(ticker: string): Promise<DividendEvent[]> {
  const apiKey = await getEodhdApiKey();
  if (!apiKey) {
    console.warn("[DividendCalendar] EODHD_API_KEY not configured");
    return [];
  }

  const cacheKey = `dividends:eodhd:${ticker}`;
  const cached = apiCache.get<DividendEvent[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const eodhdTicker = toEODHDTicker(ticker);
  const today = new Date();
  
  // Fetch 3 years of data: 1 year back + 2 years forward (to cover 2027 dividends)
  const fromDate = new Date(today);
  fromDate.setFullYear(fromDate.getFullYear() - 1);
  const toDate = new Date(today);
  toDate.setFullYear(toDate.getFullYear() + 2);

  const url = `https://eodhd.com/api/div/${eodhdTicker}?api_token=${apiKey}&fmt=json&from=${fromDate.toISOString().split("T")[0]}&to=${toDate.toISOString().split("T")[0]}`;

  try {
    const response = await retryFetch(url, {}, { maxRetries: 2, baseDelay: 500 });

    if (!response.ok) {
      console.warn(`[DividendCalendar] EODHD API failed for ${eodhdTicker}: ${response.status}`);
      return [];
    }

    const data: any[] = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      console.log(`[DividendCalendar] No dividend data from EODHD for ${eodhdTicker}`);
      return [];
    }

    const events: DividendEvent[] = data.map(div => {
      const exDate = new Date(div.date);
      const isUpcoming = exDate >= today;

      return {
        ticker: ticker, // Keep original ticker format
        exDividendDate: div.date,
        paymentDate: div.paymentDate || div.date,
        declarationDate: div.declarationDate || null,
        amount: div.value || div.unadjustedValue || 0,
        currency: div.currency || "USD",
        period: div.period || "Unknown",
        type: isUpcoming ? "upcoming" : "past",
      };
    });

    // Estimate future dividends: project multiple payments within the 2-year horizon
    const upcomingEvents = events.filter(e => e.type === "upcoming");
    const pastEvents = events.filter(e => e.type === "past").sort(
      (a, b) => new Date(b.exDividendDate).getTime() - new Date(a.exDividendDate).getTime()
    );

    if (pastEvents.length >= 2) {
      const lastDate = new Date(pastEvents[0].exDividendDate);
      const secondLastDate = new Date(pastEvents[1].exDividendDate);
      const intervalDays = Math.round(
        (lastDate.getTime() - secondLastDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (intervalDays > 0) {
        // Find the most recent known date (announced or past) to project from
        const allKnownDates = [
          ...upcomingEvents.map(e => new Date(e.exDividendDate)),
          lastDate,
        ].sort((a, b) => b.getTime() - a.getTime());
        let projectionBase = allKnownDates[0];

        // Roll forward until we exceed the 2-year horizon, adding estimated events
        let nextEstDate = new Date(projectionBase.getTime() + intervalDays * 24 * 60 * 60 * 1000);
        while (nextEstDate <= toDate) {
          // Only add if no announced event already covers this date (±30 days)
          const alreadyCovered = events.some(e => {
            const diff = Math.abs(new Date(e.exDividendDate).getTime() - nextEstDate.getTime());
            return e.type !== "past" && diff < 30 * 24 * 60 * 60 * 1000;
          });
          if (!alreadyCovered && nextEstDate > today) {
            events.push({
              ticker,
              exDividendDate: nextEstDate.toISOString().split("T")[0],
              paymentDate: new Date(nextEstDate.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
              declarationDate: null,
              amount: pastEvents[0].amount,
              currency: pastEvents[0].currency,
              period: pastEvents[0].period,
              type: "estimated",
            });
          }
          nextEstDate = new Date(nextEstDate.getTime() + intervalDays * 24 * 60 * 60 * 1000);
        }
      }
    }

    console.log(`[DividendCalendar] ${ticker}: ${events.filter(e => e.type === "upcoming").length} upcoming, ${events.filter(e => e.type === "estimated").length} estimated, ${events.filter(e => e.type === "past").length} past`);

    // Cache for 4 hours
    apiCache.set(cacheKey, events, 4 * 60 * 60 * 1000);
    return events;
  } catch (error: any) {
    console.error(`[DividendCalendar] Error fetching EODHD dividends for ${eodhdTicker}: ${error.message}`);
    return [];
  }
}

/**
 * Fetch upcoming dividends for all tickers (kept for backward compatibility)
 */
export async function fetchUpcomingDividends(from: string, to: string): Promise<DividendEvent[]> {
  return [];
}

/**
 * Get upcoming dividends for specific tickers in a portfolio
 * @param tickers Array of stock tickers
 * @param daysAhead Number of days to look ahead (default: 365)
 * @returns Array of upcoming/estimated dividend events
 */
export async function getPortfolioDividends(tickers: string[], daysAhead: number = 365): Promise<DividendEvent[]> {
  console.log(`[DividendCalendar] Fetching dividends for ${tickers.length} tickers using EODHD API`);

  const allDividends: DividendEvent[] = [];

  // Process in batches of 5 to respect rate limits
  const batchSize = 5;
  for (let i = 0; i < tickers.length; i += batchSize) {
    const batch = tickers.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(ticker => fetchTickerDividendsEODHD(ticker)));
    allDividends.push(...results.flat());

    if (i + batchSize < tickers.length) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  // Filter to upcoming and estimated dividends within daysAhead
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() + daysAhead);
  const today = new Date();

  const upcomingDividends = allDividends
    .filter(d => {
      if (d.type === "past") return false;
      const exDate = new Date(d.exDividendDate);
      return exDate >= today && exDate <= cutoffDate;
    })
    .sort((a, b) => new Date(a.exDividendDate).getTime() - new Date(b.exDividendDate).getTime());

  console.log(`[DividendCalendar] Portfolio has ${upcomingDividends.length} upcoming/estimated dividends in next ${daysAhead} days`);
  return upcomingDividends;
}

/**
 * Get all dividends (past + upcoming) for a portfolio - used for the full calendar view
 */
export async function getAllPortfolioDividends(tickers: string[]): Promise<DividendEvent[]> {
  console.log(`[DividendCalendar] Fetching all dividends (past + upcoming) for ${tickers.length} tickers`);

  const allDividends: DividendEvent[] = [];

  const batchSize = 5;
  for (let i = 0; i < tickers.length; i += batchSize) {
    const batch = tickers.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(ticker => fetchTickerDividendsEODHD(ticker)));
    allDividends.push(...results.flat());

    if (i + batchSize < tickers.length) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  return allDividends.sort((a, b) => new Date(a.exDividendDate).getTime() - new Date(b.exDividendDate).getTime());
}

/**
 * Nächste erwartete Dividende JE TITEL — auch wenn sie erst >12 Monate entfernt ist (z. B. 2027
 * bei jährlich zahlenden Schweizer Titeln). Damit ist der Portfolio-Dividenden-Tab nicht leer,
 * nur weil die nächste Ausschüttung noch nicht angekündigt ist.
 *
 * Logik je Ticker:
 *   1) Gibt es eine bereits angekündigte anstehende Dividende (Ex-Termin ≥ heute)? → die nächste.
 *   2) Sonst aus der Historie projizieren: nächster Ex-Termin = letzter Ex-Termin + typisches
 *      Intervall (Gap der letzten beiden Termine; jährlich ≈ 365 Tage), auf die Zukunft hochgerollt;
 *      Betrag/Aktie = letzte Ausschüttung. Ergebnis-Typ "estimated".
 * Höchstens eine Position pro Ticker; Titel ganz ohne Dividendenhistorie fehlen (kein Fake).
 */
export async function getNextDividendPerTicker(tickers: string[]): Promise<DividendEvent[]> {
  const todayMs = Date.now();
  const result: DividendEvent[] = [];

  const batchSize = 5;
  for (let i = 0; i < tickers.length; i += batchSize) {
    const batch = tickers.slice(i, i + batchSize);
    const perTicker = await Promise.all(batch.map(async (ticker): Promise<DividendEvent | null> => {
      const events = await fetchTickerDividendsEODHD(ticker);
      if (events.length === 0) return null;

      // 1) Bereits angekündigte anstehende Dividende bevorzugen (nächster Ex-Termin).
      const announced = events
        .filter(e => e.type !== "past" && new Date(e.exDividendDate).getTime() >= todayMs)
        .sort((a, b) => new Date(a.exDividendDate).getTime() - new Date(b.exDividendDate).getTime());
      if (announced.length > 0) return announced[0];

      // 2) Sonst aus der Historie projizieren.
      const past = events
        .filter(e => e.type === "past")
        .sort((a, b) => new Date(b.exDividendDate).getTime() - new Date(a.exDividendDate).getTime());
      if (past.length === 0) return null;

      const lastEx = new Date(past[0].exDividendDate);
      let intervalDays = 365; // Default: jährlich (typisch für CH-Titel)
      if (past.length >= 2) {
        const gap = Math.round((lastEx.getTime() - new Date(past[1].exDividendDate).getTime()) / 86400000);
        if (gap > 0) intervalDays = gap;
      }
      const nextEx = new Date(lastEx.getTime() + intervalDays * 86400000);
      while (nextEx.getTime() < todayMs) nextEx.setTime(nextEx.getTime() + intervalDays * 86400000);

      return {
        ticker,
        exDividendDate: nextEx.toISOString().split("T")[0],
        paymentDate: new Date(nextEx.getTime() + 14 * 86400000).toISOString().split("T")[0],
        declarationDate: null,
        amount: past[0].amount,
        currency: past[0].currency,
        period: past[0].period,
        type: "estimated",
      };
    }));
    result.push(...perTicker.filter((e): e is DividendEvent => e !== null));
    if (i + batchSize < tickers.length) await new Promise(r => setTimeout(r, 300));
  }

  return result.sort((a, b) => new Date(a.exDividendDate).getTime() - new Date(b.exDividendDate).getTime());
}

/**
 * Check for dividends happening today or in the next few days
 */
export async function checkDividendNotifications(portfolioId: number, notificationDays: number = 3): Promise<DividendEvent[]> {
  console.log(`[DividendCalendar] Checking notifications for portfolio ${portfolioId}`);
  return [];
}

/**
 * Calculate expected dividend income for a portfolio.
 * FX via fxHelper.convertToCHF (D-02) — dividends without a resolvable rate
 * contribute 0 (R-10 convention) instead of a hardcoded conversion.
 */
export async function calculateExpectedDividendIncome(
  holdings: Record<string, number>,
  dividends: DividendEvent[]
): Promise<number> {
  const { convertToCHF } = await import("./fxHelper");
  const today = new Date().toISOString().split("T")[0];
  let totalIncome = 0;

  for (const div of dividends) {
    const shares = holdings[div.ticker] || holdings[div.ticker.toUpperCase()] || 0;
    if (shares > 0) {
      // Future payment dates have no FX rate yet — use today's rate as estimate.
      const fxDate = div.paymentDate && div.paymentDate <= today ? div.paymentDate : today;
      const amountInCHF = await convertToCHF(div.amount, div.currency, fxDate);
      totalIncome += shares * amountInCHF;
    }
  }

  return totalIncome;
}
