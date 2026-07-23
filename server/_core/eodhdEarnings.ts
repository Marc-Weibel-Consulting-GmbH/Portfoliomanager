/**
 * Earnings- & Analysten-Insights aus der EODHD-Fundamentals-Antwort.
 *
 * Dieselbe `/api/fundamentals`-Antwort, die wir ohnehin je Aktie abrufen,
 * enthält weit mehr als die paar Kennzahlen, die wir bisher auslesen. Dieses
 * Modul extrahiert gezielt die Bausteine für ein Einzeltitel-Briefing
 * (Earnings-Hub-Stil):
 *  - Surprise-Historie (epsActual vs. epsEstimate)
 *  - nächster Quartals-Konsens (EPS/Umsatz)
 *  - Analysten-Kursziel + Rating-Verteilung
 *
 * Bewusst defensiv geparst: die Blöcke variieren je Titel/Region, fehlende
 * Felder ⇒ null, nie ein Fehler nach oben.
 */

import { ENV } from "./env";
import { apiCache } from "./apiCache";
import { retryFetch } from "./retryUtil";
import { toEodhdSymbol } from "../lib/eodhdSymbol";

export interface EarningsSurprise {
  date: string;
  epsActual: number | null;
  epsEstimate: number | null;
  surprisePercent: number | null;
  beat: boolean | null;
}

export interface AnalystView {
  targetPrice: number | null;
  rating: number | null; // EODHD-Skala 1 (Strong Buy) … 5 (Strong Sell)
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
}

export interface EarningsInsights {
  surprises: EarningsSurprise[]; // neueste zuerst, bis zu 4
  beatCount: number;             // wie viele der zurückgegebenen Surprises geschlagen wurden
  nextEarningsDate: string | null;
  nextEpsEstimate: number | null;
  nextRevenueEstimate: number | null;
  analyst: AnalystView | null;
}

const EMPTY: EarningsInsights = { surprises: [], beatCount: 0, nextEarningsDate: null, nextEpsEstimate: null, nextRevenueEstimate: null, analyst: null };

/** Robuste Zahl-Extraktion (EODHD liefert teils Strings, "NA", ""). */
function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

function extractSurprises(history: Record<string, any> | undefined | null): EarningsSurprise[] {
  if (!history || typeof history !== "object") return [];
  const rows = Object.entries(history)
    .map(([key, e]) => {
      const epsActual = num(e?.epsActual ?? e?.reportedEPS);
      const epsEstimate = num(e?.epsEstimate ?? e?.estimate);
      let surprisePercent = num(e?.surprisePercent);
      if (surprisePercent === null && epsActual !== null && epsEstimate !== null && epsEstimate !== 0) {
        surprisePercent = ((epsActual - epsEstimate) / Math.abs(epsEstimate)) * 100;
      }
      const beat = epsActual !== null && epsEstimate !== null ? epsActual >= epsEstimate : null;
      return { date: String(e?.reportDate ?? e?.date ?? key), epsActual, epsEstimate, surprisePercent, beat };
    })
    .filter((r) => r.epsActual !== null) // nur bereits berichtete Quartale
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  return rows.slice(0, 4);
}

/** Nächstes noch nicht berichtetes Quartal aus Earnings.Trend (Konsens EPS/Umsatz). */
function extractNext(trend: Record<string, any> | undefined | null, highlights: any): { date: string | null; eps: number | null; rev: number | null } {
  let date: string | null = null;
  let eps: number | null = null;
  let rev: number | null = null;
  if (trend && typeof trend === "object") {
    // Periode "0q" = laufendes/nächstes Quartal; sonst frühester zukünftiger Eintrag.
    const entries = Object.entries(trend).map(([key, t]) => ({ key, t }));
    const zeroQ = entries.find((x) => String(x.t?.period) === "0q") ?? entries.find((x) => String(x.t?.period) === "+1q");
    const chosen = zeroQ ?? entries.sort((a, b) => (a.key < b.key ? -1 : 1))[0];
    if (chosen) {
      date = String(chosen.t?.date ?? chosen.key);
      eps = num(chosen.t?.earningsEstimateAvg ?? chosen.t?.epsEstimateAvg);
      rev = num(chosen.t?.revenueEstimateAvg);
    }
  }
  if (eps === null) eps = num(highlights?.EPSEstimateNextQuarter ?? highlights?.EPSEstimateCurrentQuarter);
  return { date, eps, rev };
}

function extractAnalyst(ar: any): AnalystView | null {
  if (!ar || typeof ar !== "object") return null;
  const targetPrice = num(ar.TargetPrice);
  const rating = num(ar.Rating);
  const strongBuy = num(ar.StrongBuy) ?? 0;
  const buy = num(ar.Buy) ?? 0;
  const hold = num(ar.Hold) ?? 0;
  const sell = num(ar.Sell) ?? 0;
  const strongSell = num(ar.StrongSell) ?? 0;
  if (targetPrice === null && rating === null && strongBuy + buy + hold + sell + strongSell === 0) return null;
  return { targetPrice, rating, strongBuy, buy, hold, sell, strongSell };
}

/** Reine Extraktion aus der EODHD-Fundamentals-Antwort (netzwerkfrei, testbar). */
export function extractEarningsInsights(raw: any): EarningsInsights {
  const surprises = extractSurprises(raw?.Earnings?.History);
  const next = extractNext(raw?.Earnings?.Trend, raw?.Highlights);
  return {
    surprises,
    beatCount: surprises.filter((s) => s.beat).length,
    nextEarningsDate: next.date,
    nextEpsEstimate: next.eps,
    nextRevenueEstimate: next.rev,
    analyst: extractAnalyst(raw?.AnalystRatings),
  };
}

/**
 * Lädt die EODHD-Fundamentals-Antwort und extrahiert die Earnings-/Analysten-
 * Insights. Cache 6h. Fehlt der Key oder scheitert der Call ⇒ leeres Objekt.
 */
export async function fetchEODHDEarningsInsights(ticker: string): Promise<EarningsInsights> {
  const apiKey = ENV.eodhdApiKey;
  if (!apiKey) return { ...EMPTY };

  const cacheKey = `eodhd:earnings-insights:${ticker}`;
  const cached = apiCache.get<EarningsInsights>(cacheKey);
  if (cached) return cached;

  try {
    const url = `https://eodhd.com/api/fundamentals/${toEodhdSymbol(ticker)}?api_token=${apiKey}&fmt=json`;
    const response = await retryFetch(url, {}, { maxRetries: 2, baseDelay: 1000 });
    if (!response.ok) return { ...EMPTY };
    const raw: any = await response.json();
    const insights = extractEarningsInsights(raw);
    apiCache.set(cacheKey, insights, 6 * 60 * 60 * 1000);
    return insights;
  } catch (e) {
    console.warn(`[EODHD] earnings insights failed for ${ticker}:`, (e as any)?.message);
    return { ...EMPTY };
  }
}
