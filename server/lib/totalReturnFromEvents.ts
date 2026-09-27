export type RawCloseRow = {
  date: string;
  close: number;
};

export type CashDividendEvent = {
  date: string;
  amount: number;
  currency: string | null | undefined;
};

export type ReconstructedTotalReturnRow = {
  date: string;
  adjustedClose: number;
};

function normalizedCurrency(value: string | null | undefined): string {
  return String(value ?? "").trim().toUpperCase();
}

function cashAmountInQuoteCurrency(input: {
  amount: number;
  dividendCurrency: string | null | undefined;
  quoteCurrency: string;
}): number | null {
  if (!Number.isFinite(input.amount) || input.amount <= 0) return null;
  const dividendUnit = String(input.dividendCurrency ?? "").trim();
  const quoteUnit = String(input.quoteCurrency ?? "").trim();
  const dividendCurrency = normalizedCurrency(dividendUnit);
  const quoteCurrency = normalizedCurrency(quoteUnit);

  // London EOD quotes trade in pence (GBp), while the EODHD cash event is
  // conventionally reported in pounds (GBP).  This is a quote-scale conversion,
  // not an FX estimate, and must be applied before calculating total return.
  if (quoteUnit === "GBp" && dividendCurrency === "GBP") return input.amount * 100;
  if (quoteCurrency === "GBP" && dividendUnit === "GBp") return input.amount / 100;
  if (!dividendCurrency || dividendCurrency === quoteCurrency) return input.amount;

  // A cash event in another currency cannot be combined with the listing's
  // price without an event-date FX cross.  The caller retains the provider
  // adjusted series and surfaces no invented total-return replacement.
  return null;
}

function normalizeRawRows(rows: RawCloseRow[]): RawCloseRow[] {
  const byDate = new Map<string, RawCloseRow>();
  for (const row of rows) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) continue;
    if (!Number.isFinite(row.close) || row.close <= 0) continue;
    byDate.set(row.date, { date: row.date, close: row.close });
  }
  return Array.from(byDate.values()).sort((left, right) => left.date.localeCompare(right.date));
}

/**
 * Builds a gross total-return wealth index from one homogeneous raw-close series
 * and dated cash dividend events.  Cash is re-invested at the ex-date close.
 * The first row keeps its raw-close level, so a quotient of any two values is a
 * transparent total-return gross factor for the same period.
 */
export function buildEventReconstructedTotalReturnRows(input: {
  quoteCurrency: string;
  rawRows: RawCloseRow[];
  dividends: CashDividendEvent[];
}): ReconstructedTotalReturnRow[] {
  const rawRows = normalizeRawRows(input.rawRows);
  if (rawRows.length === 0) return [];

  const dividendByEffectiveDate = new Map<string, number>();
  for (const event of input.dividends) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(event.date)) continue;
    const effectiveRow = rawRows.find((row) => row.date >= event.date);
    if (!effectiveRow) continue;
    const convertedAmount = cashAmountInQuoteCurrency({
      amount: event.amount,
      dividendCurrency: event.currency,
      quoteCurrency: input.quoteCurrency,
    });
    if (convertedAmount === null) continue;
    dividendByEffectiveDate.set(
      effectiveRow.date,
      (dividendByEffectiveDate.get(effectiveRow.date) ?? 0) + convertedAmount,
    );
  }

  const rows: ReconstructedTotalReturnRow[] = [{
    date: rawRows[0].date,
    adjustedClose: rawRows[0].close,
  }];
  let wealth = rawRows[0].close;
  for (let index = 1; index < rawRows.length; index += 1) {
    const previous = rawRows[index - 1];
    const current = rawRows[index];
    const dividend = dividendByEffectiveDate.get(current.date) ?? 0;
    wealth *= (current.close + dividend) / previous.close;
    rows.push({ date: current.date, adjustedClose: wealth });
  }
  return rows;
}

/**
 * Provider-adjusted prices remain the default.  A reconstruction replaces them
 * only when both series cover the same endpoints and their total-return gross
 * factors differ by at least 50 bp.  This threshold deliberately avoids
 * overwriting a vendor series for rounding, minor timing, or small correction
 * differences.
 */
export function hasMaterialTotalReturnMismatch(input: {
  providerRows: ReconstructedTotalReturnRow[];
  reconstructedRows: ReconstructedTotalReturnRow[];
  threshold?: number;
}): boolean {
  const threshold = input.threshold ?? 0.005;
  const providerByDate = new Map(input.providerRows.map((row) => [row.date, row.adjustedClose]));
  const reconstructedByDate = new Map(input.reconstructedRows.map((row) => [row.date, row.adjustedClose]));
  const sharedDates = Array.from(providerByDate.keys()).filter((date) => reconstructedByDate.has(date)).sort();
  if (sharedDates.length < 2) return false;
  const first = sharedDates[0];
  const last = sharedDates.at(-1)!;
  const providerGross = providerByDate.get(last)! / providerByDate.get(first)!;
  const reconstructedGross = reconstructedByDate.get(last)! / reconstructedByDate.get(first)!;
  if (!Number.isFinite(providerGross) || !Number.isFinite(reconstructedGross) || providerGross <= 0 || reconstructedGross <= 0) return false;
  return Math.abs(providerGross / reconstructedGross - 1) >= threshold;
}
