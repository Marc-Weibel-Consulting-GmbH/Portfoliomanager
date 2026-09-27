import type { RiskHistorySelection } from "./nativeRiskHistory";

export type TotalReturnPriceRow = {
  date: string;
  adjustedClose: number;
};

export type TotalReturnHistorySelection = {
  source: "eodhd_adjusted" | "yahoo_adjusted" | "unavailable";
  currency: string | null;
  rows: TotalReturnPriceRow[];
  reason?: "missing_adjusted_history";
};

function normaliseRows(rows: TotalReturnPriceRow[]): TotalReturnPriceRow[] {
  const byDate = new Map<string, TotalReturnPriceRow>();
  for (const row of rows) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) continue;
    if (!Number.isFinite(row.adjustedClose) || row.adjustedClose <= 0) continue;
    byDate.set(row.date, { date: row.date, adjustedClose: row.adjustedClose });
  }
  return Array.from(byDate.values()).sort((left, right) => left.date.localeCompare(right.date));
}

/**
 * Selects the dividend-adjusted series that exactly matches the homogeneous
 * source chosen for the 5Y price-return/risk series. It deliberately never
 * stitches EODHD and Yahoo rows or substitutes an ADR/foreign proxy. A missing
 * total-return series is a disclosed data gap, not an inferred dividend return.
 */
export function selectTotalReturnHistorySeries(input: {
  priceSource: RiskHistorySelection["source"];
  nativeCurrency: string;
  eodhdRows: TotalReturnPriceRow[];
  nativeRows: TotalReturnPriceRow[];
}): TotalReturnHistorySelection {
  const currency = String(input.nativeCurrency || "").trim().toUpperCase() || null;
  if (input.priceSource === "eodhd_primary") {
    const rows = normaliseRows(input.eodhdRows);
    return rows.length > 0
      ? { source: "eodhd_adjusted", currency, rows }
      : { source: "unavailable", currency: null, rows: [], reason: "missing_adjusted_history" };
  }

  if (input.priceSource === "yahoo_native" || input.priceSource === "yahoo_primary_equivalent") {
    const rows = normaliseRows(input.nativeRows);
    return rows.length > 0
      ? { source: "yahoo_adjusted", currency, rows }
      : { source: "unavailable", currency: null, rows: [], reason: "missing_adjusted_history" };
  }

  return { source: "unavailable", currency: null, rows: [], reason: "missing_adjusted_history" };
}
