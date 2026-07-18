/**
 * Universe Expansion Module
 *
 * Analysiert den aktuellen Kandidaten-Pool auf Lücken in Sektoren und
 * Faktoren. Bei Lücken werden via EODHD-Screener neue Titel aus dem
 * gesamten Aktienuniversum gesucht und als "universe_expansion"-Kandidaten
 * zurückgegeben.
 *
 * Regeln:
 * - Max. 20% der finalen Positionen dürfen externe Titel sein
 * - Externe Titel werden in stocks-Tabelle als listType="watchlist",
 *   source="ai_recommended", notes="universe_expansion" gespeichert
 * - Admin kann Titel via /admin/watchlist-candidates in die Watchlist übernehmen
 */

import { ENV } from "../_core/env";
import { retryFetch } from "../_core/retryUtil";
import { apiCache, CACHE_TTL } from "../_core/apiCache";

const EODHD_BASE_URL = "https://eodhd.com/api";

// ─── Typen ───────────────────────────────────────────────────────────────────

export interface GapAnalysisResult {
  /** Sektoren mit zu wenigen Kandidaten */
  sectorGaps: SectorGap[];
  /** Faktor-Lücken (Dividende, Sharpe, Momentum) */
  factorGaps: FactorGap[];
  /** Gesamtzahl der Lücken */
  totalGaps: number;
  /** Wie viele externe Titel maximal ergänzt werden dürfen (max 20% von maxTitles) */
  maxExternalCount: number;
}

export interface SectorGap {
  sector: string;
  currentCount: number;
  minRequired: number;
  deficit: number;
}

export interface FactorGap {
  factor: "dividend" | "value" | "momentum" | "quality";
  description: string;
  currentCount: number;
  minRequired: number;
}

export interface ExternalCandidate {
  ticker: string;
  companyName: string;
  sector: string | null;
  industry: string | null;
  marketCap: number | null;
  currency: string | null;
  exchange: string | null;
  dividendYield: number | null;
  peRatio: number | null;
  /** Warum dieser Titel ergänzt wurde */
  gapReason: string;
  /** Welche Lücke er schließt */
  closesGap: string;
  /** Herkunft: immer "universe_expansion" */
  source: "universe_expansion";
}

// ─── Lücken-Analyse ──────────────────────────────────────────────────────────

/**
 * Analysiert den Kandidaten-Pool auf Lücken in Sektoren und Faktoren.
 *
 * @param candidates Aktuell verfügbare Kandidaten (aus Watchlist)
 * @param maxTitles Maximale Anzahl Positionen im Portfolio
 * @param excludedSectors Vom Nutzer ausgeschlossene Sektoren
 * @param goal Anlageziel ("growth" | "dividends" | "balanced")
 */
export function analyzeGaps(
  candidates: Array<{
    ticker: string;
    sector: string | null;
    dividendYield: string | null;
    sharpeRatio: string | null;
    ytdPerformance: string | null;
    peRatio: string | null;
  }>,
  maxTitles: number,
  excludedSectors: string[],
  goal: string
): GapAnalysisResult {
  // Mindestanzahl Kandidaten pro Sektor (damit Diversifikation möglich ist)
  const MIN_PER_SECTOR = 2;
  // Mindestanzahl Kandidaten pro Faktor
  const MIN_FACTOR_COUNT = 2;

  // Sektoren zählen
  const sectorCounts: Record<string, number> = {};
  for (const c of candidates) {
    const sec = c.sector || "Andere";
    if (!excludedSectors.includes(sec)) {
      sectorCounts[sec] = (sectorCounts[sec] || 0) + 1;
    }
  }

  // Wichtige Sektoren die mindestens vertreten sein sollten
  const IMPORTANT_SECTORS = [
    "Technology",
    "Healthcare",
    "Financial Services",
    "Consumer Defensive",
    "Industrials",
    "Energy",
    "Basic Materials",
    "Consumer Cyclical",
    "Utilities",
    "Real Estate",
    "Communication Services",
  ].filter((s) => !excludedSectors.includes(s));

  const sectorGaps: SectorGap[] = [];
  for (const sector of IMPORTANT_SECTORS) {
    const count = sectorCounts[sector] || 0;
    if (count < MIN_PER_SECTOR) {
      sectorGaps.push({
        sector,
        currentCount: count,
        minRequired: MIN_PER_SECTOR,
        deficit: MIN_PER_SECTOR - count,
      });
    }
  }

  // Faktor-Lücken
  const factorGaps: FactorGap[] = [];

  // Dividenden-Lücke (für Dividenden-Ziel oder ausgewogen)
  if (goal === "dividends" || goal === "balanced") {
    const highDivCount = candidates.filter((c) => {
      const div = parseFloat(c.dividendYield ?? "0");
      return div >= 2.5;
    }).length;
    if (highDivCount < MIN_FACTOR_COUNT) {
      factorGaps.push({
        factor: "dividend",
        description: "Dividendenrendite ≥ 2.5%",
        currentCount: highDivCount,
        minRequired: MIN_FACTOR_COUNT,
      });
    }
  }

  // Value-Lücke (niedriges KGV)
  const valueTitleCount = candidates.filter((c) => {
    const pe = parseFloat(c.peRatio ?? "999");
    return pe > 0 && pe < 18;
  }).length;
  if (valueTitleCount < MIN_FACTOR_COUNT) {
    factorGaps.push({
      factor: "value",
      description: "KGV < 18 (Value-Titel)",
      currentCount: valueTitleCount,
      minRequired: MIN_FACTOR_COUNT,
    });
  }

  // Momentum-Lücke (starke YTD-Performance)
  if (goal === "growth" || goal === "balanced") {
    const momentumCount = candidates.filter((c) => {
      const ytd = parseFloat(c.ytdPerformance ?? "0");
      return ytd >= 15;
    }).length;
    if (momentumCount < MIN_FACTOR_COUNT) {
      factorGaps.push({
        factor: "momentum",
        description: "YTD-Performance ≥ 15% (Momentum)",
        currentCount: momentumCount,
        minRequired: MIN_FACTOR_COUNT,
      });
    }
  }

  const totalGaps = sectorGaps.length + factorGaps.length;
  // Max. 20% der Positionen dürfen extern sein
  const maxExternalCount = Math.max(1, Math.floor(maxTitles * 0.2));

  return { sectorGaps, factorGaps, totalGaps, maxExternalCount };
}

// ─── EODHD-Screener ──────────────────────────────────────────────────────────

interface EodhdScreenerItem {
  code: string;
  exchange: string;
  name: string;
  market_capitalization?: number;
  sector?: string;
  industry?: string;
  currency?: string;
  earnings_share?: number;
  book_value?: number;
  dividend_yield?: number;
  pe?: number;
}

/**
 * Sucht via EODHD-Screener nach Titeln für eine bestimmte Lücke.
 */
async function screenForGap(params: {
  sector?: string;
  factor?: "dividend" | "value" | "momentum" | "quality";
  exchange?: string;
  limit?: number;
}): Promise<EodhdScreenerItem[]> {
  const apiKey = ENV.eodhdApiKey;
  if (!apiKey) {
    console.warn("[UniverseExpansion] EODHD API key not configured");
    return [];
  }

  const cacheKey = `universe_expansion:screen:${params.sector ?? ""}:${params.factor ?? ""}:${params.exchange ?? "us"}`;
  const cached = apiCache.get<EodhdScreenerItem[]>(cacheKey);
  if (cached) return cached;

  const filters: string[] = [];
  // Mindest-Marktkapitalisierung: 1 Mrd. USD
  filters.push("market_capitalization>=1000000000");

  if (params.sector) {
    filters.push(`sector=="${params.sector}"`);
  }

  // Faktor-spezifische Filter
  if (params.factor === "dividend") {
    filters.push("dividend_yield>=2.5");
  } else if (params.factor === "value") {
    filters.push("pe>=1");
    filters.push("pe<=18");
  }

  const exchange = params.exchange ?? "us";
  const limit = params.limit ?? 20;
  const filterStr = filters.length > 0
    ? `&filters_json=${encodeURIComponent(JSON.stringify(filters))}`
    : "";

  const url = `${EODHD_BASE_URL}/screener?api_token=${apiKey}&sort=market_capitalization.desc&limit=${limit}&offset=0&exchange=${exchange}${filterStr}`;

  try {
    const response = await retryFetch(url, {}, { maxRetries: 2, baseDelay: 1000 });
    const data = await response.json();
    const items: EodhdScreenerItem[] = data?.data || data || [];
    if (!Array.isArray(items)) return [];

    apiCache.set(cacheKey, items, CACHE_TTL.FUNDAMENTALS); // 24h cache for screener results
    return items;
  } catch (err) {
    console.warn("[UniverseExpansion] EODHD screener error:", err);
    return [];
  }
}

/**
 * Konvertiert einen EODHD-Screener-Eintrag in einen ExternalCandidate.
 */
function toExternalCandidate(
  item: EodhdScreenerItem,
  gapReason: string,
  closesGap: string
): ExternalCandidate {
  const code = (item.code || "").trim().toUpperCase();
  const exch = (item.exchange || "").toUpperCase();

  // Ticker-Format anpassen
  let ticker = code;
  if (exch === "SW" || exch === "SWX") ticker = code.includes(".") ? code : `${code}.SW`;
  else if (exch === "XETRA" || exch === "DE") ticker = code.includes(".") ? code : `${code}.DE`;
  else if (exch === "PA") ticker = code.includes(".") ? code : `${code}.PA`;
  else if (exch === "LSE") ticker = code.includes(".") ? code : `${code}.L`;
  else if (exch === "AS") ticker = code.includes(".") ? code : `${code}.AS`;
  else if (exch === "MI") ticker = code.includes(".") ? code : `${code}.MI`;
  // US: kein Suffix

  return {
    ticker,
    companyName: item.name || ticker,
    sector: item.sector || null,
    industry: item.industry || null,
    marketCap: item.market_capitalization || null,
    currency: item.currency || null,
    exchange: exch || null,
    dividendYield: item.dividend_yield || null,
    peRatio: item.pe || null,
    gapReason,
    closesGap,
    source: "universe_expansion",
  };
}

// ─── Haupt-Funktion ──────────────────────────────────────────────────────────

/**
 * Sucht externe Kandidaten für identifizierte Lücken.
 *
 * @param gaps Ergebnis der Lücken-Analyse
 * @param existingTickers Bereits im Pool vorhandene Ticker (werden ausgeschlossen)
 * @param referenceCurrency Referenzwährung (bestimmt bevorzugte Börse)
 * @returns Externe Kandidaten (max. gaps.maxExternalCount)
 */
export async function findExternalCandidates(
  gaps: GapAnalysisResult,
  existingTickers: Set<string>,
  referenceCurrency: string = "CHF"
): Promise<ExternalCandidate[]> {
  if (gaps.totalGaps === 0) {
    console.log("[UniverseExpansion] Keine Lücken gefunden — kein externes Screening nötig");
    return [];
  }

  // Bevorzugte Börse basierend auf Referenzwährung
  const preferredExchange =
    referenceCurrency === "CHF" ? "sw" :
    referenceCurrency === "EUR" ? "xetra" :
    referenceCurrency === "GBP" ? "lse" :
    "us";

  const allCandidates: ExternalCandidate[] = [];
  const seenTickers = new Set<string>(existingTickers);

  // 1) Sektor-Lücken schließen
  for (const gap of gaps.sectorGaps) {
    if (allCandidates.length >= gaps.maxExternalCount) break;

    console.log(`[UniverseExpansion] Screening für Sektor-Lücke: ${gap.sector} (${gap.currentCount}/${gap.minRequired})`);

    // Erst bevorzugte Börse, dann US als Fallback
    const exchanges = preferredExchange !== "us"
      ? [preferredExchange, "us"]
      : ["us"];

    for (const exchange of exchanges) {
      if (allCandidates.length >= gaps.maxExternalCount) break;

      const items = await screenForGap({
        sector: gap.sector,
        exchange,
        limit: 10,
      });

      for (const item of items) {
        if (allCandidates.length >= gaps.maxExternalCount) break;
        const candidate = toExternalCandidate(
          item,
          `Sektor ${gap.sector} hat nur ${gap.currentCount} Kandidaten (Minimum: ${gap.minRequired})`,
          `sector:${gap.sector}`
        );
        if (!seenTickers.has(candidate.ticker.toUpperCase())) {
          seenTickers.add(candidate.ticker.toUpperCase());
          allCandidates.push(candidate);
        }
      }
    }
  }

  // 2) Faktor-Lücken schließen
  for (const gap of gaps.factorGaps) {
    if (allCandidates.length >= gaps.maxExternalCount) break;

    console.log(`[UniverseExpansion] Screening für Faktor-Lücke: ${gap.factor} (${gap.currentCount}/${gap.minRequired})`);

    const items = await screenForGap({
      factor: gap.factor,
      exchange: preferredExchange !== "us" ? preferredExchange : "us",
      limit: 10,
    });

    for (const item of items) {
      if (allCandidates.length >= gaps.maxExternalCount) break;
      const candidate = toExternalCandidate(
        item,
        `Faktor-Lücke: ${gap.description} (${gap.currentCount}/${gap.minRequired} Titel)`,
        `factor:${gap.factor}`
      );
      if (!seenTickers.has(candidate.ticker.toUpperCase())) {
        seenTickers.add(candidate.ticker.toUpperCase());
        allCandidates.push(candidate);
      }
    }
  }

  console.log(`[UniverseExpansion] ${allCandidates.length} externe Kandidaten gefunden (max: ${gaps.maxExternalCount})`);
  return allCandidates.slice(0, gaps.maxExternalCount);
}

/**
 * Speichert externe Kandidaten in der stocks-Tabelle als Staging-Einträge.
 * Bereits vorhandene Ticker werden übersprungen.
 *
 * @returns Anzahl neu eingefügter Einträge
 */
export async function storeExternalCandidates(
  candidates: ExternalCandidate[]
): Promise<{ stored: number; skipped: number }> {
  if (candidates.length === 0) return { stored: 0, skipped: 0 };

  const { getDb } = await import("../db");
  const db = await getDb();
  if (!db) return { stored: 0, skipped: 0 };

  const { stocks } = await import("../../drizzle/schema");
  const { eq } = await import("drizzle-orm");

  let stored = 0;
  let skipped = 0;

  for (const c of candidates) {
    try {
      // Prüfen ob Ticker bereits existiert
      const existing = await db
        .select({ id: stocks.id })
        .from(stocks)
        .where(eq(stocks.ticker, c.ticker))
        .limit(1);

      if (existing.length > 0) {
        skipped++;
        continue;
      }

      // Preis via EODHD laden
      let livePrice = "0";
      let liveExchangeRate: string | null = null;
      try {
        const { ENV } = await import('../_core/env');
        if (ENV.eodhdApiKey) {
          const eoTicker = c.ticker.includes('.') ? c.ticker : `${c.ticker}.US`;
          const resp = await fetch(`https://eodhd.com/api/real-time/${eoTicker}?api_token=${ENV.eodhdApiKey}&fmt=json`);
          if (resp.ok) {
            const data: any = await resp.json();
            const price = parseFloat(data?.close ?? data?.adjusted_close ?? '0');
            if (price > 0) {
              livePrice = String(price);
              // FX-Rate aus DB (andere Aktie mit gleicher Währung)
              const currency = (c.currency ?? 'USD').toUpperCase();
              if (currency === 'CHF') {
                liveExchangeRate = '1';
              } else {
                const fxRow = await db.select({ exchangeRateToChf: stocks.exchangeRateToChf })
                  .from(stocks)
                  .where(eq(stocks.currency, currency))
                  .limit(1);
                if (fxRow[0]?.exchangeRateToChf) liveExchangeRate = String(fxRow[0].exchangeRateToChf);
              }
              console.log(`[UniverseExpansion] Live price for ${c.ticker}: ${livePrice} (fxRate: ${liveExchangeRate})`);
            }
          }
        }
      } catch (priceErr) {
        console.warn(`[UniverseExpansion] Could not fetch price for ${c.ticker}:`, priceErr);
      }

      await db.insert(stocks).values({
        ticker: c.ticker,
        companyName: c.companyName,
        sector: c.sector,
        industry: c.industry,
        currency: c.currency,
        marketCap: c.marketCap?.toString() ?? null,
        dividendYield: c.dividendYield?.toString() ?? null,
        peRatio: c.peRatio?.toString() ?? null,
        listType: "watchlist",   // Staging — noch nicht in Empfehlungen
        source: "ai_recommended",
        notes: `universe_expansion|${c.closesGap}|${c.gapReason}`,
        isActive: 1,
        currentPrice: livePrice,
        exchangeRateToChf: liveExchangeRate,
      });
      stored++;
    } catch (err) {
      console.warn(`[UniverseExpansion] Failed to store ${c.ticker}:`, err);
      skipped++;
    }
  }

  console.log(`[UniverseExpansion] Stored ${stored} new candidates, skipped ${skipped}`);
  return { stored, skipped };
}
