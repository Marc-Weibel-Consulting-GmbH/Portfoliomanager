/**
 * EODHD-basierte Holdings-Beschaffung für die Copilot-Analyse (Track D / Empfehlungs-Cron).
 *
 * Die Kursreihen für die Rangfolge stammen aus EODHD. Die angezeigten
 * Portfolioanteile werden dagegen aus CHF-Marktwerten und der Cash-Reserve
 * bestimmt — identisch zur Portfolio-Positionsansicht. Lokale Kurswährungen
 * dürfen niemals als miteinander vergleichbare Werte addiert werden.
 */
import { getEodhdApiKey } from "../_core/env";
import { fetchEODHDFundamentals } from "../_core/eodhdApi";
import { getStocksByTickers } from "../db";
import { getStockCurrency, tryConvertToCHF } from "../fxHelper";
import { toEodhdSymbol } from "./eodhdSymbol";
import type { PortfolioHolding } from "../analytics/portfolioCopilot";

interface EodRow {
  date: string;
  close: number;
  adjusted_close?: number;
  volume?: number;
}

export interface ChfHoldingMarketValue {
  ticker: string;
  marketValueCHF: number | null;
}

/**
 * Deterministic portfolio-budget calculation shared by interactive and scheduled
 * recommendation paths. Missing valuations stay at zero; they must never be
 * represented by an unconverted local-currency value.
 */
export function calculateChfHoldingWeights(
  positions: ChfHoldingMarketValue[],
  cashBalanceCHF = 0,
): {
  totalValueCHF: number;
  investedWeight: number;
  weightsByTicker: Record<string, number>;
} {
  const valuesByTicker: Record<string, number> = {};
  let securitiesValueCHF = 0;

  for (const position of positions) {
    const value = position.marketValueCHF;
    const validValue = typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
    valuesByTicker[position.ticker] = validValue;
    securitiesValueCHF += validValue;
  }

  const validCash = Number.isFinite(cashBalanceCHF) && cashBalanceCHF > 0 ? cashBalanceCHF : 0;
  const totalValueCHF = securitiesValueCHF + validCash;
  const weightsByTicker = Object.fromEntries(
    Object.entries(valuesByTicker).map(([ticker, value]) => [ticker, totalValueCHF > 0 ? value / totalValueCHF : 0]),
  );

  return {
    totalValueCHF,
    investedWeight: totalValueCHF > 0 ? securitiesValueCHF / totalValueCHF : 0,
    weightsByTicker,
  };
}

/** EOD-Kurse (bevorzugt adjusted_close) + Volumina eines Tickers über EODHD. */
async function fetchEodhdSeries(
  ticker: string,
  lookbackDays: number,
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
    for (const row of rows) {
      const price = row.adjusted_close ?? row.close;
      if (price == null || !Number.isFinite(price)) continue;
      prices.push(price);
      volumes.push(row.volume ?? 0);
    }
    return { prices, volumes };
  } catch {
    return { prices: [], volumes: [] };
  }
}

/**
 * Baut ein einzelnes PortfolioHolding aus EODHD-Daten. `weight` wird vom
 * Aufrufer aus CHF-Marktwerten gesetzt; die EODHD-Reihe bleibt ausschliesslich
 * die Grundlage für Momentum-, Volatilitäts- und Drawdownsignale.
 */
export async function fetchHoldingDataEodhd(
  stock: { ticker: string; companyName?: string; name?: string; shares?: number | string; sector?: string },
  lookbackDays = 365,
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
 * Builds all portfolio holdings. Price-series and fundamentals are read from
 * EODHD, but weights are calculated from the same current DB quote, FX rule
 * and cash-aware CHF denominator used by portfolio positions.
 */
export async function buildHoldingsEodhd(
  stocks: Array<{ ticker: string; companyName?: string; name?: string; shares?: number | string; sector?: string }>,
  options: { cashBalanceCHF?: number } = {},
): Promise<PortfolioHolding[]> {
  const holdings = await Promise.all(stocks.map((stock) => fetchHoldingDataEodhd(stock)));
  const quoteMap = await getStocksByTickers(stocks.map((stock) => stock.ticker));
  const asOfDate = new Date().toISOString().slice(0, 10);

  const valuations = await Promise.all(holdings.map(async (holding) => {
    const storedQuote = quoteMap.get(holding.ticker);
    const price = Number.parseFloat(String(storedQuote?.currentPrice ?? holding.currentPrice));
    const currency = String(storedQuote?.currency ?? holding.currency ?? "CHF").toUpperCase();
    const localMarketValue = holding.shares * price;
    const marketValueCHF = Number.isFinite(localMarketValue) && localMarketValue > 0
      ? await tryConvertToCHF(localMarketValue, currency, asOfDate)
      : null;
    return { ticker: holding.ticker, marketValueCHF };
  }));

  const weightResult = calculateChfHoldingWeights(valuations, options.cashBalanceCHF ?? 0);
  for (const holding of holdings) {
    holding.weight = weightResult.weightsByTicker[holding.ticker] ?? 0;
  }
  return holdings;
}
