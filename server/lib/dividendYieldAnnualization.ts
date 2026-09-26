/**
 * Dividend yield calculation contract
 *
 * `stocks.dividendYield` is always a percent value.  This module calculates a
 * trailing-twelve-month **gross regular-dividend** yield only when the cash
 * events and the price refer to the same trading currency.  It intentionally
 * does not infer FX rates, annualize one payment, or mix special dividends into
 * the recurring-income figure.
 */

export type DividendYieldEvent = {
  exDate: string;
  amount: number | string | null | undefined;
  currency: string | null | undefined;
  period?: string | null | undefined;
};

export type TrailingDividendYieldResult = {
  status: "available" | "price_missing" | "no_qualifying_events" | "currency_mismatch";
  basis: "ttm_gross" | null;
  dividendYieldPct: number | null;
  annualDividendPerShare: number | null;
  currency: string | null;
  eventCount: number;
  excludedSpecialEventCount: number;
  asOfDate: string;
};

function calendarDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizedCurrency(value: string | null | undefined): string | null {
  const result = String(value ?? "").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(result) ? result : null;
}

/** EODHD's period is provider text, so retain a narrow but explicit exclusion. */
export function isSpecialDividendPeriod(period: string | null | undefined): boolean {
  const value = String(period ?? "").trim().toLowerCase();
  return value.includes("special") || value.includes("extraordinary") || value.includes("capital return");
}

/**
 * Derives a recurring TTM gross dividend yield from dated cash events.
 *
 * Events are inclusive from `asOfDate - 365 days` through `asOfDate`.  Duplicate
 * provider rows for the same ex-date, amount and currency count once.  A single
 * inconsistent or unknown cash currency makes the result a transparent data gap:
 * dividing USD per share by a NOK price would be economically meaningless.
 */
export function calculateTrailingTwelveMonthDividendYield(input: {
  asOfDate: string;
  currentPrice: number | string | null | undefined;
  tradingCurrency: string | null | undefined;
  events: DividendYieldEvent[];
}): TrailingDividendYieldResult {
  const asOf = calendarDate(input.asOfDate);
  const price = Number(input.currentPrice);
  const tradingCurrency = normalizedCurrency(input.tradingCurrency);
  const base = {
    annualDividendPerShare: null,
    currency: tradingCurrency,
    eventCount: 0,
    excludedSpecialEventCount: 0,
    asOfDate: input.asOfDate,
  };

  if (!asOf || !tradingCurrency || !Number.isFinite(price) || price <= 0) {
    return { status: "price_missing", basis: null, dividendYieldPct: null, ...base };
  }

  const trailingStart = new Date(asOf);
  trailingStart.setUTCDate(trailingStart.getUTCDate() - 365);
  const seen = new Set<string>();
  const regular: Array<{ exDate: string; amount: number; currency: string }> = [];
  let excludedSpecialEventCount = 0;

  for (const event of input.events ?? []) {
    const date = calendarDate(event.exDate);
    const amount = Number(event.amount);
    if (!date || !Number.isFinite(amount) || amount <= 0 || date < trailingStart || date > asOf) continue;
    if (isSpecialDividendPeriod(event.period)) {
      excludedSpecialEventCount += 1;
      continue;
    }
    const currency = normalizedCurrency(event.currency);
    const key = `${event.exDate}|${amount}|${currency ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    regular.push({ exDate: event.exDate, amount, currency: currency ?? "" });
  }

  if (regular.length === 0) {
    return {
      status: "no_qualifying_events",
      basis: null,
      dividendYieldPct: null,
      ...base,
      excludedSpecialEventCount,
    };
  }

  if (regular.some((event) => event.currency !== tradingCurrency)) {
    return {
      status: "currency_mismatch",
      basis: null,
      dividendYieldPct: null,
      ...base,
      eventCount: regular.length,
      excludedSpecialEventCount,
    };
  }

  const annualDividendPerShare = regular.reduce((sum, event) => sum + event.amount, 0);
  return {
    status: "available",
    basis: "ttm_gross",
    dividendYieldPct: (annualDividendPerShare / price) * 100,
    annualDividendPerShare,
    currency: tradingCurrency,
    eventCount: regular.length,
    excludedSpecialEventCount,
    asOfDate: input.asOfDate,
  };
}
