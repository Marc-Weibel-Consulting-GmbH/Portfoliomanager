/**
 * EODHD-basierte Holdings-Beschaffung für die Copilot-Analyse (Track D / Empfehlungs-Cron).
 *
 * Die interaktive analyze-Prozedur beschafft Kurse/Fundamentaldaten historisch über Yahoo —
 * in der EODHD-only-Produktion ist Yahoo jedoch blockiert. Für die serverseitige (Cron-)
 * Generierung von Empfehlungslisten werden die Holdings deshalb ausschliesslich aus EODHD
 * aufgebaut: EOD-Schlusskurse (split-bereinigt) + Fundamentaldaten + Währung.
 *
 * Ohne Kursreihe (leeres prices) liefert runCopilotAnalysis kein belastbares Signal — deshalb
 * überspringt der Aufrufer Titel mit leerer Reihe, statt Platzhalter zu erfinden (Datenintegrität).
 */
import { getEodhdApiKey } from "../_core/env";
import { toEodhdSymbol } from "./eodhdSymbol";
import { fetchEODHDFundamentals } from "../_core/eodhdApi";
import { getStockCurrency } from "../fxHelper";
import type { PortfolioHolding } from "../analytics/portfolioCopilot";

interface EodRow {
  date: string;
  close: number;
  adjusted_close?: number;
  volume?: number;
}

/** EOD-Kurse (bevorzugt adjusted_close) + Volumina eines Tickers über EODHD. */
async function fetchEodhdSeries(
  ticker: string,
  lookbackDays: number
): Promise<{ prices: number[]; volumes: number[] }> {
  const apiKey = await getEodhdApiKey();
  if (!apiKey) return { prices: [], volumes: [] };

  const to = new Date();
  const from = new Date(to.getTime() - lookbackDays * 86_400_000);
  const symbol = toEodhdSymbol(ticker);
  const url = `https://eodhd.com/api/eod/${symbol}?api_token=${apiKey}&from=${from
    .toISOString()
    .split("T")[0]}&to=${to.toISOString().split("T")[0]}&fmt=json`;

  try {
    const res = await fetch(url);
    if (!res.ok) return { prices: [], volumes: [] };
    const rows = (await res.json()) as EodRow[];
    if (!Array.isArray(rows)) return { prices: [], volumes: [] };
    const prices: number[] = [];
    const volumes: number[] = [];
    for (const r of rows) {
      const px = r.adjusted_close ?? r.close;
      if (px == null || !Number.isFinite(px)) continue;
      prices.push(px);
      volumes.push(r.volume ?? 0);
    }
    return { prices, volumes };
  } catch {
    return { prices: [], volumes: [] };
  }
}

/**
 * Baut ein einzelnes PortfolioHolding aus EODHD-Daten. `weight` wird vom Aufrufer gesetzt
 * (er kennt den Portfolio-Gesamtwert); hier wird 0 vorbelegt.
 */
export async function fetchHoldingDataEodhd(
  stock: { ticker: string; companyName?: string; name?: string; shares?: number | string; sector?: string },
  lookbackDays = 365
): Promise<PortfolioHolding> {
  const ticker = stock.ticker;
  const [series, fundamentals, currency] = await Promise.all([
    fetchEodhdSeries(ticker, lookbackDays),
    fetchEODHDFundamentals(ticker).catch(() => null),
    getStockCurrency(ticker).catch(() => "CHF"),
  ]);

  const currentPrice = series.prices.length > 0 ? series.prices[series.prices.length - 1] : 0;

  return {
    ticker,
    companyName: stock.companyName || stock.name || ticker,
    weight: 0,
    shares: typeof stock.shares === "string" ? parseFloat(stock.shares) || 0 : stock.shares ?? 0,
    currentPrice,
    currency,
    sector: fundamentals?.sector ?? stock.sector ?? undefined,
    prices: series.prices,
    volumes: series.volumes,
    fundamentals: {
      peRatio: fundamentals?.peRatio ?? undefined,
      pegRatio: fundamentals?.pegRatio ?? undefined,
      dividendYield: fundamentals?.dividendYield ?? undefined,
      beta: fundamentals?.beta ?? undefined,
      marketCap: fundamentals?.marketCap ?? undefined,
    },
  };
}

/**
 * Baut alle Holdings eines Portfolios (parallel, EODHD). Setzt `weight` anhand des
 * effektiven Positionswerts (shares × currentPrice) über die Gesamtsumme. Titel ohne
 * Kursreihe behalten weight 0 und werden vom Aufrufer übersprungen.
 */
export async function buildHoldingsEodhd(
  stocks: Array<{ ticker: string; companyName?: string; name?: string; shares?: number | string; sector?: string }>
): Promise<PortfolioHolding[]> {
  const holdings = await Promise.all(stocks.map((s) => fetchHoldingDataEodhd(s)));
  const totalValue = holdings.reduce((sum, h) => sum + h.shares * h.currentPrice, 0);
  for (const h of holdings) {
    h.weight = totalValue > 0 ? (h.shares * h.currentPrice) / totalValue : 1 / holdings.length;
  }
  return holdings;
}
