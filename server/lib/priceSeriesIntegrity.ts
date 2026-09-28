export type PriceSeriesPoint = { date: string; close: number };

export type PriceSeriesIntegrity = {
  valid: boolean;
  reason?: string;
};

/**
 * Raw closes are fit for technical timing only when they have no unresolved
 * mechanical jump. A >= 2x overnight move can be a split, reverse split,
 * spin-off or a bad vendor row. The correct adjustment must come from a
 * verified corporate-action series; it must never be guessed from the price.
 */
export function assessRawPriceSeriesIntegrity(rows: PriceSeriesPoint[]): PriceSeriesIntegrity {
  let previous: PriceSeriesPoint | null = null;
  for (const point of rows) {
    if (!Number.isFinite(point.close) || point.close <= 0) continue;
    if (previous) {
      const ratio = point.close / previous.close;
      if (ratio >= 2 || ratio <= 0.5) {
        return {
          valid: false,
          reason: `Ungeklärter Rohkurssprung von ${previous.date} zu ${point.date} (${((ratio - 1) * 100).toFixed(1)} %); Timing erst nach geprüfter Corporate-Action-Reihe.`,
        };
      }
    }
    previous = point;
  }
  return { valid: true };
}
