export type CanonicalRawCoverage = {
  ticker: string;
  firstDate: string | null;
};

export type RawHistoryBackfillCandidate = {
  ticker: string;
  reason: "missing_canonical_series" | "starts_after_requested_window";
  firstDate: string | null;
};

/**
 * Builds a deterministic, additive backfill plan for the canonical database
 * ticker of each portfolio position. Legacy aliases are deliberately not used
 * as a substitute: a risk calculation must never splice two price series.
 */
export function planRawHistoryBackfill(input: {
  tickers: string[];
  requestedStart: string;
  coverage: CanonicalRawCoverage[];
}): RawHistoryBackfillCandidate[] {
  const coverageByTicker = new Map(input.coverage.map((item) => [item.ticker.trim(), item.firstDate]));
  return Array.from(new Set(input.tickers.map((ticker) => ticker.trim()).filter(Boolean)))
    .sort()
    .flatMap<RawHistoryBackfillCandidate>((ticker) => {
      const firstDate = coverageByTicker.get(ticker) ?? null;
      if (!firstDate) return [{ ticker, reason: "missing_canonical_series", firstDate: null }];
      if (firstDate > input.requestedStart) {
        return [{ ticker, reason: "starts_after_requested_window", firstDate }];
      }
      return [];
    });
}
