export type HistoricalFxRow = { date: string; close: number | string | null | undefined };

export type HistoricalFxBackfillPlanInput = {
  currencies: string[];
  requiredStartDate: string;
  earliestExistingByPair: Record<string, string | undefined>;
  /** Wird nur verwendet, wenn für ein benötigtes Paar noch keine Reihe vorhanden ist. */
  endDateIfNoExistingRate?: string;
};

export type HistoricalFxBackfillWindow = {
  currencyPair: string;
  from: string;
  to: string;
};

function isoDayBefore(date: string): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

/** Ordnet Handelswährungen dem CHF-FX-Paar zu; GBp verwendet die GBP-Reihe. */
export function currencyToChfPair(currency: string): string | null {
  const normalized = currency.trim();
  if (!normalized || normalized === "CHF") return null;
  return `${normalized === "GBp" ? "GBP" : normalized}CHF`;
}

/**
 * Ermittelt ausschliesslich den noch fehlenden Zeitraum VOR der bestehenden
 * FX-Reihe. Das verhindert Überlappungen und bewahrt bereits persistierte
 * historische Raten unverändert.
 */
export function buildHistoricalFxBackfillPlan(
  input: HistoricalFxBackfillPlanInput,
): HistoricalFxBackfillWindow[] {
  const pairs = [...new Set(input.currencies.map(currencyToChfPair).filter((pair): pair is string => Boolean(pair)))].sort();
  const fallbackEnd = input.endDateIfNoExistingRate ?? new Date().toISOString().slice(0, 10);
  const result: HistoricalFxBackfillWindow[] = [];

  for (const currencyPair of pairs) {
    const earliestExisting = input.earliestExistingByPair[currencyPair];
    if (earliestExisting && earliestExisting <= input.requiredStartDate) continue;
    const to = earliestExisting ? isoDayBefore(earliestExisting) : fallbackEnd;
    if (to < input.requiredStartDate) continue;
    result.push({ currencyPair, from: input.requiredStartDate, to });
  }
  return result;
}

/** Bereinigt eine EODHD-Forex-Antwort unmittelbar vor dem reinen Insert. */
export function filterNewHistoricalFxRates(input: {
  rows: HistoricalFxRow[];
  existingDates: ReadonlySet<string>;
  from: string;
  to: string;
}): Array<{ date: string; rate: number }> {
  const seen = new Set<string>();
  const output: Array<{ date: string; rate: number }> = [];
  for (const row of input.rows) {
    const date = typeof row.date === "string" ? row.date.slice(0, 10) : "";
    const rate = typeof row.close === "number" ? row.close : Number.parseFloat(String(row.close ?? ""));
    if (!date || date < input.from || date > input.to || input.existingDates.has(date) || seen.has(date)) continue;
    if (!Number.isFinite(rate) || rate <= 0) continue;
    seen.add(date);
    output.push({ date, rate });
  }
  return output.sort((a, b) => a.date.localeCompare(b.date));
}
