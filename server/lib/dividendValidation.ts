import { callDataApi } from "../_core/dataApi";

export const DIVIDEND_VALIDATION_THRESHOLD_PERCENT = 8;
export type DividendValidationStatus = "nicht_erforderlich" | "bestaetigt" | "zu_pruefen" | "identitaet_ungeklaert" | "quelle_nicht_verfuegbar";

export function yahooTrailingDividendYield(price: number | null, amounts: unknown[]): number | null {
  const total = amounts.reduce<number>((sum, value) => sum + (Number(value) || 0), 0);
  return price && price > 0 && total >= 0 ? (total / price) * 100 : null;
}

export function dividendValidationStatus(internal: number | null, external: number | null, hasIsin: boolean): DividendValidationStatus {
  if (internal === null || internal < DIVIDEND_VALIDATION_THRESHOLD_PERCENT) return "nicht_erforderlich";
  if (!hasIsin) return "identitaet_ungeklaert";
  if (external === null) return "quelle_nicht_verfuegbar";
  const relative = external === 0 ? Infinity : Math.abs((internal - external) / external) * 100;
  return Math.abs(internal - external) > 0.5 && relative > 20 ? "zu_pruefen" : "bestaetigt";
}

export async function validateDividendYield(ticker: string, isin: string | null, internal: number | null) {
  const initial = dividendValidationStatus(internal, null, Boolean(isin));
  if (initial === "nicht_erforderlich" || initial === "identitaet_ungeklaert") {
    return { status: initial, externalYield: null, reason: initial === "identitaet_ungeklaert" ? "Keine ISIN für Instrumentbindung" : null };
  }
  try {
    const result: any = await callDataApi("YahooFinance/get_stock_chart", {
      query: { symbol: ticker, region: "US", interval: "1d", range: "1y", includeAdjustedClose: "true", events: "div,split" },
    });
    const chart = result?.chart?.result?.[0];
    const meta = chart?.meta;
    const events = Object.values(chart?.events?.dividends ?? {}) as Array<{ amount?: unknown }>;
    const externalYield = yahooTrailingDividendYield(Number(meta?.regularMarketPrice) || null, events.map(event => event.amount));
    const status = dividendValidationStatus(internal, externalYield, true);
    return { status, externalYield, reason: status === "zu_pruefen" ? "EODHD/Yahoo-Dividendenrendite weichen materiell ab" : null };
  } catch (error) {
    return { status: "quelle_nicht_verfuegbar" as const, externalYield: null, reason: error instanceof Error ? error.message.slice(0, 180) : String(error).slice(0, 180) };
  }
}
