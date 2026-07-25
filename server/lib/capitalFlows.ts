/**
 * Kapitalströme für den Markt-Hub — zwei ehrlich getrennte Signale:
 *
 * 1. Sektor-Flow-PROXY: Dollarvolumen-Trend + Momentum der 11 US-Sektor-ETFs
 *    (SPDR) aus EODHD-EOD-Daten. Hohes relatives Volumen bei steigenden Kursen
 *    ≈ Akkumulation (Zufluss), bei fallenden Kursen ≈ Distribution (Abfluss).
 *    Das ist eine NÄHERUNG über Handelsvolumen — keine effektiven Fondsflüsse
 *    (EPFR-Klasse-Daten sind institutionell/teuer). Wird im UI so beschriftet.
 *
 * 2. COT-Positionierung: echte Futures-Positionierung der Grossanleger
 *    (Non-Commercials) aus dem wöchentlichen CFTC Commitment-of-Traders-Report
 *    — öffentliche, kostenlose Daten (publicreporting.cftc.gov, Socrata-API,
 *    Datensatz 6dca-aqww "Legacy Futures Only"; live verifiziert).
 *
 * Bewusst NUR Anzeige (Research/Markt-Hub) — kein Einfluss auf Sektor-Tilts,
 * bis sich das Signal in der Beobachtung bewährt hat.
 */

import { apiCache } from "../_core/apiCache";

// ── Typen ──────────────────────────────────────────────────────────────────────

export type FlowDirection = "zufluss" | "abfluss" | "neutral";

export interface SectorFlow {
  sector: string;          // deutscher Sektorname
  ticker: string;          // ETF-Ticker (Anzeige)
  momentum20Pct: number;   // Kursveränderung ~20 Handelstage in %
  relVolume: number;       // Ø Dollarvolumen 20T / Ø Dollarvolumen 90T
  direction: FlowDirection;
}

export interface CotMarket {
  market: string;          // deutscher Marktname
  reportDate: string;      // Datum des letzten Reports (YYYY-MM-DD)
  netPosition: number;     // Non-Commercial long − short (Kontrakte)
  weeklyChange: number;    // Veränderung zum Vorwochenreport
  percentile: number;      // Perzentil der aktuellen Netto-Position (letzte ~30 Wochen, 0-100)
  stance: string;          // Einordnung in Worten
}

export interface CapitalFlows {
  sectorFlows: SectorFlow[];
  cot: CotMarket[];
  fetchedAt: string;
}

// ── Reine Rechenlogik (testbar) ────────────────────────────────────────────────

/** Einstufung des Sektor-Flow-Proxys: erhöhtes Volumen + Richtung = Fluss. */
export function classifySectorFlow(relVolume: number, momentum20Pct: number): FlowDirection {
  if (relVolume >= 1.1 && momentum20Pct > 1) return "zufluss";
  if (relVolume >= 1.1 && momentum20Pct < -1) return "abfluss";
  return "neutral";
}

/** Perzentil-Rang von `value` innerhalb `series` (0-100). */
export function percentileRank(value: number, series: number[]): number {
  if (!series.length) return 50;
  const below = series.filter((v) => v < value).length;
  const equal = series.filter((v) => v === value).length;
  return Math.round(((below + equal / 2) / series.length) * 100);
}

/** Einordnung der Netto-Positionierung anhand des Perzentils. */
export function cotStance(percentile: number): string {
  if (percentile >= 80) return "sehr bullisch positioniert";
  if (percentile >= 60) return "bullisch positioniert";
  if (percentile > 40) return "neutral positioniert";
  if (percentile > 20) return "bärisch positioniert";
  return "sehr bärisch positioniert";
}

// ── Sektor-Flow-Proxy (EODHD, US-Sektor-ETFs) ─────────────────────────────────

const SECTOR_ETFS: Array<{ sector: string; ticker: string }> = [
  { sector: "Technologie", ticker: "XLK" },
  { sector: "Finanzen", ticker: "XLF" },
  { sector: "Gesundheit", ticker: "XLV" },
  { sector: "Energie", ticker: "XLE" },
  { sector: "Industrie", ticker: "XLI" },
  { sector: "Basiskonsum", ticker: "XLP" },
  { sector: "Zykl. Konsum", ticker: "XLY" },
  { sector: "Versorger", ticker: "XLU" },
  { sector: "Grundstoffe", ticker: "XLB" },
  { sector: "Kommunikation", ticker: "XLC" },
  { sector: "Immobilien", ticker: "XLRE" },
];

async function fetchSectorFlows(): Promise<SectorFlow[]> {
  const apiKey = process.env.EODHD_API_KEY;
  if (!apiKey) return [];

  const today = new Date();
  const from = new Date(today.getTime() - 200 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const to = today.toISOString().split("T")[0];

  const results = await Promise.allSettled(
    SECTOR_ETFS.map(async (s) => {
      const url = `https://eodhd.com/api/eod/${s.ticker}.US?api_token=${apiKey}&from=${from}&to=${to}&fmt=json&period=d`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rows: Array<{ date: string; close: number; adjusted_close: number; volume: number }> = await res.json();
      if (!Array.isArray(rows) || rows.length < 90) throw new Error("zu wenig Historie");

      const dollarVol = rows.map((r) => (r.close ?? 0) * (r.volume ?? 0));
      const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / (arr.length || 1);
      const avg20 = avg(dollarVol.slice(-20));
      const avg90 = avg(dollarVol.slice(-90));
      const relVolume = avg90 > 0 ? avg20 / avg90 : 1;

      const closes = rows.map((r) => r.adjusted_close ?? r.close);
      const last = closes[closes.length - 1];
      const ago20 = closes[Math.max(0, closes.length - 21)];
      const momentum20Pct = ago20 > 0 ? ((last - ago20) / ago20) * 100 : 0;

      return {
        sector: s.sector,
        ticker: s.ticker,
        momentum20Pct: Math.round(momentum20Pct * 10) / 10,
        relVolume: Math.round(relVolume * 100) / 100,
        direction: classifySectorFlow(relVolume, momentum20Pct),
      } satisfies SectorFlow;
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<SectorFlow> => r.status === "fulfilled")
    .map((r) => r.value)
    // stärkste Bewegungen zuerst: Zufluss oben, Abfluss unten, Rest dazwischen
    .sort((a, b) => b.momentum20Pct - a.momentum20Pct);
}

// ── COT-Positionierung (CFTC, gratis) ─────────────────────────────────────────

const COT_MARKETS: Array<{ market: string; contractName: string }> = [
  { market: "S&P 500 (E-Mini)", contractName: "E-MINI S&P 500" },
  { market: "Nasdaq 100 (Mini)", contractName: "NASDAQ MINI" },
  { market: "Gold", contractName: "GOLD" },
  { market: "US-Staatsanleihen 10J", contractName: "UST 10Y NOTE" },
];

const CFTC_URL = "https://publicreporting.cftc.gov/resource/6dca-aqww.json";

async function fetchCotPositioning(): Promise<CotMarket[]> {
  const results = await Promise.allSettled(
    COT_MARKETS.map(async (m) => {
      const params = new URLSearchParams({
        $select: "report_date_as_yyyy_mm_dd,noncomm_positions_long_all,noncomm_positions_short_all",
        $order: "report_date_as_yyyy_mm_dd DESC",
        $limit: "30",
        contract_market_name: m.contractName,
      });
      const res = await fetch(`${CFTC_URL}?${params.toString()}`, { signal: AbortSignal.timeout(12000) });
      if (!res.ok) throw new Error(`CFTC HTTP ${res.status}`);
      const rows: Array<{ report_date_as_yyyy_mm_dd: string; noncomm_positions_long_all: string; noncomm_positions_short_all: string }> = await res.json();
      if (!Array.isArray(rows) || rows.length < 2) throw new Error("zu wenig COT-Historie");

      const nets = rows.map((r) => (parseInt(r.noncomm_positions_long_all, 10) || 0) - (parseInt(r.noncomm_positions_short_all, 10) || 0));
      const current = nets[0];
      const previous = nets[1];
      const percentile = percentileRank(current, nets);

      return {
        market: m.market,
        reportDate: String(rows[0].report_date_as_yyyy_mm_dd).split("T")[0],
        netPosition: current,
        weeklyChange: current - previous,
        percentile,
        stance: cotStance(percentile),
      } satisfies CotMarket;
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<CotMarket> => r.status === "fulfilled")
    .map((r) => r.value);
}

// ── Öffentlicher Einstieg (gecacht) ───────────────────────────────────────────

const CACHE_KEY = "capitalFlows:v1";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h — Flows täglich, COT wöchentlich

export async function getCapitalFlows(): Promise<CapitalFlows> {
  const cached = apiCache.get<CapitalFlows>(CACHE_KEY);
  if (cached) return cached;

  const [sectorFlows, cot] = await Promise.all([
    fetchSectorFlows().catch((e) => { console.warn("[capitalFlows] Sektor-Flows fehlgeschlagen:", e?.message); return []; }),
    fetchCotPositioning().catch((e) => { console.warn("[capitalFlows] COT fehlgeschlagen:", e?.message); return []; }),
  ]);

  const result: CapitalFlows = { sectorFlows, cot, fetchedAt: new Date().toISOString() };
  // Leere Antworten nicht 6h festnageln — kurz cachen, damit ein Ausfall heilt.
  apiCache.set(CACHE_KEY, result, sectorFlows.length || cot.length ? CACHE_TTL_MS : 5 * 60 * 1000);
  return result;
}
