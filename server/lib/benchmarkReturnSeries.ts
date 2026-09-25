export type DatedClose = {
  date: string;
  close: string | number;
  id?: number;
  createdAt?: Date | string | null;
};

export type DatedReturn = {
  date: string;
  value: number;
};

export type MatchedReturnPair = {
  date: string;
  portfolioReturn: number;
  benchmarkReturn: number;
};

function toTimestamp(value: Date | string | null | undefined): number {
  if (!value) return 0;
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

/**
 * `benchmarkData` can contain additive historical imports for the same date.
 * The latest recorded row is the governing EODHD observation; this turns the
 * raw table into a deterministic one-close-per-day price series without
 * mutating historical rows.
 */
export function selectLatestBenchmarkRows<T extends DatedClose>(rows: T[]): T[] {
  const latestByDate = new Map<string, T>();

  for (const row of rows) {
    const close = Number(row.close);
    if (!row.date || !Number.isFinite(close) || close <= 0) continue;

    const existing = latestByDate.get(row.date);
    if (!existing) {
      latestByDate.set(row.date, row);
      continue;
    }

    const incomingTimestamp = toTimestamp(row.createdAt);
    const existingTimestamp = toTimestamp(existing.createdAt);
    const incomingId = row.id ?? 0;
    const existingId = existing.id ?? 0;
    if (incomingTimestamp > existingTimestamp || (incomingTimestamp === existingTimestamp && incomingId > existingId)) {
      latestByDate.set(row.date, row);
    }
  }

  return Array.from(latestByDate.values())
    .sort((left, right) => left.date.localeCompare(right.date));
}

export function deduplicateBenchmarkCloses(rows: DatedClose[]): Array<{ date: string; close: number }> {
  return selectLatestBenchmarkRows(rows)
    .map((row) => ({ date: row.date, close: Number(row.close) }))
    .sort((left, right) => left.date.localeCompare(right.date));
}

export function calculateDatedReturns(series: Array<{ date: string; value: number }>): DatedReturn[] {
  const ordered = [...series]
    .filter((point) => point.date && Number.isFinite(point.value) && point.value > 0)
    .sort((left, right) => left.date.localeCompare(right.date));
  const returns: DatedReturn[] = [];

  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    if (!previous || !current || previous.value <= 0) continue;
    returns.push({ date: current.date, value: (current.value - previous.value) / previous.value });
  }

  return returns;
}

/** Pairs only same-day returns, avoiding holiday/duplicate-row index shifts. */
export function alignReturnsByDate(portfolioReturns: DatedReturn[], benchmarkReturns: DatedReturn[]): MatchedReturnPair[] {
  const benchmarkByDate = new Map(benchmarkReturns.map((point) => [point.date, point.value]));
  return portfolioReturns.flatMap((portfolioReturn) => {
    const benchmarkReturn = benchmarkByDate.get(portfolioReturn.date);
    return benchmarkReturn === undefined
      ? []
      : [{ date: portfolioReturn.date, portfolioReturn: portfolioReturn.value, benchmarkReturn }];
  });
}

/** Beta = sample covariance(portfolio, benchmark) / sample variance(benchmark). */
export function calculatePairedBeta(pairs: MatchedReturnPair[]): number | null {
  if (pairs.length < 2) return null;

  const portfolioMean = pairs.reduce((sum, pair) => sum + pair.portfolioReturn, 0) / pairs.length;
  const benchmarkMean = pairs.reduce((sum, pair) => sum + pair.benchmarkReturn, 0) / pairs.length;
  let covariance = 0;
  let benchmarkVariance = 0;

  for (const pair of pairs) {
    const portfolioDelta = pair.portfolioReturn - portfolioMean;
    const benchmarkDelta = pair.benchmarkReturn - benchmarkMean;
    covariance += portfolioDelta * benchmarkDelta;
    benchmarkVariance += benchmarkDelta ** 2;
  }

  covariance /= pairs.length - 1;
  benchmarkVariance /= pairs.length - 1;
  return benchmarkVariance > 0 ? covariance / benchmarkVariance : null;
}
