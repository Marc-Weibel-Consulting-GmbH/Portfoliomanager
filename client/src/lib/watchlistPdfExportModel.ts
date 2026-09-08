export type WatchlistPdfRow = {
  ticker: string;
  name: string;
  sector: string;
  currency: string;
  price: number | null;
  dividendYieldPct: number | null;
  peRatio: number | null;
  ytdReturnPct: number | null;
  signal: string;
  score: number | null;
  dataStatus: "OK" | "Kursdaten fehlen" | "Wechselkursdaten fehlen" | "Kurs- und Wechselkursdaten fehlen";
};

type UnknownRecord = Record<string, unknown>;

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asText(value: unknown, fallback = "—"): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function getDataStatus(stock: UnknownRecord): WatchlistPdfRow["dataStatus"] {
  const priceMissing = stock.priceMissing === true;
  const fxMissing = stock.fxMissing === true;
  if (priceMissing && fxMissing) return "Kurs- und Wechselkursdaten fehlen";
  if (priceMissing) return "Kursdaten fehlen";
  if (fxMissing) return "Wechselkursdaten fehlen";
  return "OK";
}

/** Bereitet nur bereits vorhandene Watchlistwerte für einen statischen PDF-Report auf. */
export function buildWatchlistPdfRows(stocks: UnknownRecord[]): WatchlistPdfRow[] {
  return stocks.map((stock) => ({
    ticker: asText(stock.ticker),
    name: asText(stock.companyName, asText(stock.name)),
    sector: asText(stock.sector),
    currency: asText(stock.currency),
    price: asNumber(stock.currentPrice),
    dividendYieldPct: asNumber(stock.dividendYield),
    peRatio: asNumber(stock.peRatio),
    ytdReturnPct: asNumber(stock.ytdPerformance),
    signal: asText(stock.signalType),
    score: asNumber(stock.signalScore),
    dataStatus: getDataStatus(stock),
  }));
}
