export type HistoricalEntryPriceRow = {
  ticker: string;
  date: string;
  close: string | number;
  adjustedClose?: string | number | null;
  currency?: string | null;
};

export type HistoricalEntryPriceResult =
  | {
      status: "available";
      requestedDate: string;
      effectiveDate: string;
      priceLocal: number;
      priceCurrency: string;
      fxRateToChf: number;
      priceChf: number;
    }
  | {
      status: "price_missing" | "fx_missing" | "incompatible_price_basis";
      requestedDate: string;
      message: string;
    };

/**
 * Resolves a persisted EOD close into a CHF entry price. The function is
 * deliberately read-only and only accepts compatible native price series:
 * ADR/proxy rows in another currency must remain a data gap instead of being
 * presented as a price for the native holding.
 */
export function resolveHistoricalEntryPrice(input: {
  rows: HistoricalEntryPriceRow[];
  requestedDate: string;
  nativeCurrency: string;
  historicalPriceCurrency: string;
  fxRateToChf: number | null;
}): HistoricalEntryPriceResult {
  const requestedDate = input.requestedDate;
  const nativeCurrency = String(input.nativeCurrency || "CHF").toUpperCase();
  const historicalPriceCurrency = String(input.historicalPriceCurrency || nativeCurrency).toUpperCase();

  if (nativeCurrency !== historicalPriceCurrency) {
    return {
      status: "incompatible_price_basis",
      requestedDate,
      message: `Historische ${historicalPriceCurrency}-Preisreihe ist nicht mit der nativen ${nativeCurrency}-Position vergleichbar.`,
    };
  }

  const eligibleRows = input.rows
    .filter((row) => typeof row.date === "string" && row.date <= requestedDate)
    .sort((left, right) => right.date.localeCompare(left.date));
  const selected = eligibleRows[0];
  if (!selected) {
    return {
      status: "price_missing",
      requestedDate,
      message: "Für dieses Datum ist kein historischer Schlusskurs verfügbar.",
    };
  }

  const priceLocal = Number(selected.adjustedClose ?? selected.close);
  if (!Number.isFinite(priceLocal) || priceLocal <= 0) {
    return {
      status: "price_missing",
      requestedDate,
      message: "Der historische Schlusskurs ist ungültig oder fehlt.",
    };
  }

  const fxRateToChf = nativeCurrency === "CHF" ? 1 : input.fxRateToChf;
  if (fxRateToChf === null || !Number.isFinite(fxRateToChf) || fxRateToChf <= 0) {
    return {
      status: "fx_missing",
      requestedDate,
      message: `Für ${nativeCurrency}/CHF ist am historischen Kurstag kein verifizierter FX-Kurs verfügbar.`,
    };
  }

  return {
    status: "available",
    requestedDate,
    effectiveDate: selected.date,
    priceLocal,
    priceCurrency: nativeCurrency,
    fxRateToChf,
    priceChf: priceLocal * fxRateToChf,
  };
}
