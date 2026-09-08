export interface YtdPricePoint {
  date: string;
  close: number | string | null;
  adjustedClose?: number | string | null;
}

export interface AdjustedYtdPerformance {
  startDate: string;
  startPrice: number;
  endDate: string;
  endPrice: number;
  performancePct: number;
  usedAdjustedClose: boolean;
  /** Nur bei klar erkennbaren, grossen Rohkurs-Splitfaktoren ohne adjustedClose. */
  usedInferredSplitAdjustment: boolean;
}

function numeric(value: number | string | null | undefined): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function inferredRawCloseSplitAdjustment(rows: YtdPricePoint[]): number {
  let adjustment = 1;
  for (let index = 1; index < rows.length; index++) {
    const previous = numeric(rows[index - 1]?.close);
    const current = numeric(rows[index]?.close);
    if (previous == null || current == null) continue;
    const ratio = previous / current;
    const factor = Math.round(ratio);
    // Nur grosse, nahezu ganzzahlige Sprünge werden als Split erkannt. Damit
    // bleiben normale Kursschwankungen und 1:2-Crash-Tage unberührt.
    if (factor >= 5 && factor <= 20 && Math.abs(ratio - factor) / factor <= 0.05) {
      adjustment /= factor;
      continue;
    }
    const reverseRatio = current / previous;
    const reverseFactor = Math.round(reverseRatio);
    if (reverseFactor >= 5 && reverseFactor <= 20 && Math.abs(reverseRatio - reverseFactor) / reverseFactor <= 0.05) {
      adjustment *= reverseFactor;
    }
  }
  return adjustment;
}

/**
 * Berechnet die Kalenderjahresrendite ausschliesslich aus derselben Preisbasis.
 * adjustedClose gewinnt, sobald er an beiden Vergleichstagen vorhanden ist.
 * Ohne adjustedClose darf der Close-Fallback nur bei einer klar erkennbaren
 * grossen Splitdiskontinuität rückwirkend angepasst werden.
 */
export function calculateAdjustedYtdPerformance(
  rows: YtdPricePoint[],
  year: number,
): AdjustedYtdPerformance | null {
  const startBoundary = `${year}-01-01`;
  const startWindowEnd = `${year}-01-15`;
  const sorted = rows
    .filter((row) => typeof row.date === "string" && row.date.length >= 10)
    .slice()
    .sort((left, right) => left.date.localeCompare(right.date));
  const startCandidates = sorted.filter((row) => row.date >= startBoundary && row.date <= startWindowEnd);
  const endCandidates = sorted.filter((row) => row.date >= startBoundary);
  if (startCandidates.length === 0 || endCandidates.length === 0) return null;
  const end = [...endCandidates].reverse().find((row) => numeric(row.close) != null);
  if (!end) return null;

  const endAdjusted = numeric(end.adjustedClose);
  if (endAdjusted != null) {
    for (const start of startCandidates) {
      const startAdjusted = numeric(start.adjustedClose);
      if (startAdjusted == null) continue;
      return {
        startDate: start.date,
        startPrice: startAdjusted,
        endDate: end.date,
        endPrice: endAdjusted,
        performancePct: ((endAdjusted - startAdjusted) / startAdjusted) * 100,
        usedAdjustedClose: true,
        usedInferredSplitAdjustment: false,
      };
    }
  }

  const start = startCandidates.find((row) => numeric(row.close) != null);
  if (!start) return null;
  const rawStartPrice = numeric(start.close);
  const endPrice = numeric(end.close);
  if (rawStartPrice == null || endPrice == null) return null;
  const rawRows = sorted.filter((row) => row.date >= start.date && row.date <= end.date && numeric(row.close) != null);
  const splitAdjustment = inferredRawCloseSplitAdjustment(rawRows);
  const startPrice = rawStartPrice * splitAdjustment;
  return {
    startDate: start.date,
    startPrice,
    endDate: end.date,
    endPrice,
    performancePct: ((endPrice - startPrice) / startPrice) * 100,
    usedAdjustedClose: false,
    usedInferredSplitAdjustment: splitAdjustment !== 1,
  };
}
