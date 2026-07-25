/**
 * Stock Check Router
 * ==================
 * Aggregierter "Stock-Check" für ein einzelnes Symbol (Earnings-Hub-Stil):
 * Quote + Bewertung + Quality-Grades + Earnings-Track-Record + nächster
 * Earnings-Termin + Analysten-Trend.
 *
 * Datenquelle: Finnhub (alle genutzten Endpoints sind im Free Tier verfügbar):
 *   /quote, /stock/metric, /stock/earnings, /calendar/earnings,
 *   /stock/recommendation
 * Kursziele (price targets) sind bei Finnhub Premium-only und werden daher
 * bewusst nicht abgefragt; als Analysten-Signal dient der Recommendation-Trend.
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getFinnhubApiKey } from "../_core/env";
import { apiCache } from "../_core/apiCache";

const STOCK_CHECK_TTL = 15 * 60 * 1000; // 15 Minuten

export type Grade = "A" | "B" | "C" | "D" | "F";

// Schwellwerte bewusst einfach und dokumentiert gehalten; Werte sind
// Prozent (Growth) bzw. Ratio (P/E, P/S). null = Datenpunkt fehlt.
export function gradeEpsGrowth(pct: number | null): Grade | null {
  if (pct === null || !Number.isFinite(pct)) return null;
  if (pct >= 30) return "A";
  if (pct >= 15) return "B";
  if (pct >= 5) return "C";
  if (pct >= 0) return "D";
  return "F";
}

export function gradeRevenueGrowth(pct: number | null): Grade | null {
  if (pct === null || !Number.isFinite(pct)) return null;
  if (pct >= 20) return "A";
  if (pct >= 10) return "B";
  if (pct >= 5) return "C";
  if (pct >= 0) return "D";
  return "F";
}

export function gradePe(pe: number | null): Grade | null {
  if (pe === null || !Number.isFinite(pe) || pe <= 0) return null;
  if (pe < 15) return "A";
  if (pe < 22) return "B";
  if (pe < 30) return "C";
  if (pe < 45) return "D";
  return "F";
}

export function gradePs(ps: number | null): Grade | null {
  if (ps === null || !Number.isFinite(ps) || ps <= 0) return null;
  if (ps < 2) return "A";
  if (ps < 5) return "B";
  if (ps < 8) return "C";
  if (ps < 12) return "D";
  return "F";
}

const GRADE_POINTS: Record<Grade, number> = { A: 4, B: 3, C: 2, D: 1, F: 0 };
const POINT_GRADES: Grade[] = ["F", "D", "C", "B", "A"];

export function overallGrade(grades: Array<Grade | null>): Grade | null {
  const present = grades.filter((g): g is Grade => g !== null);
  if (present.length === 0) return null;
  const avg = present.reduce((sum, g) => sum + GRADE_POINTS[g], 0) / present.length;
  return POINT_GRADES[Math.round(avg)];
}

// Finnhub-Rohantworten (nur die Felder, die wir tatsächlich lesen)
interface FinnhubQuote {
  c?: number; // current price
  dp?: number; // change percent
}
interface FinnhubMetric {
  metric?: {
    peTTM?: number;
    psTTM?: number;
    epsGrowthTTMYoy?: number;
    revenueGrowthTTMYoy?: number;
    marketCapitalization?: number; // in Millionen
    "52WeekHigh"?: number;
    "52WeekLow"?: number;
  };
}
interface FinnhubEarnings {
  period?: string;
  actual?: number | null;
  estimate?: number | null;
  surprisePercent?: number | null;
}
interface FinnhubEarningsCalendar {
  earningsCalendar?: Array<{
    date?: string;
    hour?: string; // bmo | amc | dmh
    epsEstimate?: number | null;
    revenueEstimate?: number | null;
  }>;
}
interface FinnhubRecommendation {
  period?: string;
  strongBuy?: number;
  buy?: number;
  hold?: number;
  sell?: number;
  strongSell?: number;
}

export interface StockCheckResult {
  symbol: string;
  quote: {
    price: number | null;
    changePercent: number | null;
    high52w: number | null;
    low52w: number | null;
  };
  valuation: {
    peTTM: number | null;
    psTTM: number | null;
    marketCap: number | null; // in USD (Finnhub liefert Millionen, hier umgerechnet)
  };
  growth: {
    epsGrowthYoyPct: number | null;
    revenueGrowthYoyPct: number | null;
  };
  score: {
    epsGrowth: Grade | null;
    revenueGrowth: Grade | null;
    pe: Grade | null;
    ps: Grade | null;
    overall: Grade | null;
  };
  earningsHistory: Array<{
    period: string;
    actual: number | null;
    estimate: number | null;
    surprisePercent: number | null;
    beat: boolean | null;
  }>;
  nextEarnings: {
    date: string;
    hour: string | null;
    epsEstimate: number | null;
    revenueEstimate: number | null;
  } | null;
  analystTrend: {
    period: string;
    strongBuy: number;
    buy: number;
    hold: number;
    sell: number;
    strongSell: number;
  } | null;
}

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/**
 * Reine Assembly-Funktion (getrennt vom Fetch, damit sie testbar ist).
 * Jeder Teil darf null sein — ein ausgefallener Endpoint (z.B. Rate Limit)
 * lässt die übrigen Sektionen intakt.
 */
export function buildStockCheck(
  symbol: string,
  raw: {
    quote: FinnhubQuote | null;
    metric: FinnhubMetric | null;
    earnings: FinnhubEarnings[] | null;
    calendar: FinnhubEarningsCalendar | null;
    recommendations: FinnhubRecommendation[] | null;
  },
): StockCheckResult {
  const m = raw.metric?.metric ?? {};
  const peTTM = num(m.peTTM);
  const psTTM = num(m.psTTM);
  const epsGrowth = num(m.epsGrowthTTMYoy);
  const revenueGrowth = num(m.revenueGrowthTTMYoy);

  const epsGrade = gradeEpsGrowth(epsGrowth);
  const revenueGrade = gradeRevenueGrowth(revenueGrowth);
  const peGrade = gradePe(peTTM);
  const psGrade = gradePs(psTTM);

  const marketCapMio = num(m.marketCapitalization);

  const earningsHistory = (raw.earnings ?? [])
    .filter((e) => typeof e.period === "string")
    .map((e) => {
      const actual = num(e.actual);
      const estimate = num(e.estimate);
      return {
        period: e.period as string,
        actual,
        estimate,
        surprisePercent: num(e.surprisePercent),
        beat: actual !== null && estimate !== null ? actual > estimate : null,
      };
    });

  const upcoming = (raw.calendar?.earningsCalendar ?? [])
    .filter((e) => typeof e.date === "string")
    .sort((a, b) => (a.date as string).localeCompare(b.date as string))[0];

  const latestTrend = (raw.recommendations ?? []).find(
    (r) => typeof r.period === "string",
  );

  return {
    symbol,
    quote: {
      price: num(raw.quote?.c),
      changePercent: num(raw.quote?.dp),
      high52w: num(m["52WeekHigh"]),
      low52w: num(m["52WeekLow"]),
    },
    valuation: {
      peTTM,
      psTTM,
      marketCap: marketCapMio !== null ? marketCapMio * 1_000_000 : null,
    },
    growth: {
      epsGrowthYoyPct: epsGrowth,
      revenueGrowthYoyPct: revenueGrowth,
    },
    score: {
      epsGrowth: epsGrade,
      revenueGrowth: revenueGrade,
      pe: peGrade,
      ps: psGrade,
      overall: overallGrade([epsGrade, revenueGrade, peGrade, psGrade]),
    },
    earningsHistory,
    nextEarnings: upcoming
      ? {
          date: upcoming.date as string,
          hour: upcoming.hour ?? null,
          epsEstimate: num(upcoming.epsEstimate),
          revenueEstimate: num(upcoming.revenueEstimate),
        }
      : null,
    analystTrend: latestTrend
      ? {
          period: latestTrend.period as string,
          strongBuy: latestTrend.strongBuy ?? 0,
          buy: latestTrend.buy ?? 0,
          hold: latestTrend.hold ?? 0,
          sell: latestTrend.sell ?? 0,
          strongSell: latestTrend.strongSell ?? 0,
        }
      : null,
  };
}

async function finnhubGet<T>(
  path: string,
  params: Record<string, string>,
  apiKey: string,
): Promise<T | null> {
  const query = new URLSearchParams({ ...params, token: apiKey });
  try {
    const res = await fetch(`https://finnhub.io/api/v1/${path}?${query}`);
    if (!res.ok) {
      console.warn(`[StockCheck] Finnhub ${path} returned ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (error) {
    console.warn(`[StockCheck] Finnhub ${path} failed:`, (error as Error).message);
    return null;
  }
}

export const stockCheckRouter = router({
  get: protectedProcedure
    .input(z.object({ symbol: z.string().trim().min(1).max(12) }))
    .query(async ({ input }): Promise<StockCheckResult> => {
      const symbol = input.symbol.toUpperCase();

      const cacheKey = `stockCheck:${symbol}`;
      const cached = apiCache.get<StockCheckResult>(cacheKey);
      if (cached) return cached;

      const apiKey = await getFinnhubApiKey();
      if (!apiKey) {
        throw new Error(
          "Finnhub API key not configured. Please add it via Admin > API Secrets.",
        );
      }

      // Kalenderfenster: heute bis +90 Tage (Free Tier liefert anstehende Termine)
      const today = new Date().toISOString().split("T")[0];
      const to = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      const [quote, metric, earnings, calendar, recommendations] =
        await Promise.all([
          finnhubGet<FinnhubQuote>("quote", { symbol }, apiKey),
          finnhubGet<FinnhubMetric>(
            "stock/metric",
            { symbol, metric: "all" },
            apiKey,
          ),
          finnhubGet<FinnhubEarnings[]>(
            "stock/earnings",
            { symbol, limit: "4" },
            apiKey,
          ),
          finnhubGet<FinnhubEarningsCalendar>(
            "calendar/earnings",
            { symbol, from: today, to },
            apiKey,
          ),
          finnhubGet<FinnhubRecommendation[]>(
            "stock/recommendation",
            { symbol },
            apiKey,
          ),
        ]);

      const result = buildStockCheck(symbol, {
        quote,
        metric,
        earnings,
        calendar,
        recommendations,
      });

      apiCache.set(cacheKey, result, STOCK_CHECK_TTL);
      return result;
    }),
});
