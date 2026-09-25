export type AdjustedClosePoint = {
  date: string;
  close: number | string | null;
  adjustedClose: number | string | null;
};

export type AdjustedCloseEnrichmentPlan = {
  eligible: boolean;
  reason: "existing_adjusted_close_differs" | "raw_close_differs" | "provider_missing_local_date" | null;
  updates: Array<{ date: string; adjustedClose: number }>;
};

const EPSILON = 1e-8;

function positive(value: number | string | null | undefined): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

/**
 * Produces an additive-only enrichment plan for `adjustedClose` values.
 * Existing non-zero adjusted values and raw close values are immutable guards:
 * any provider divergence rejects the entire ticker. Provider-only dates are
 * never inserted by this plan.
 */
export function planAdjustedCloseEnrichment(
  localRows: AdjustedClosePoint[],
  providerRows: AdjustedClosePoint[],
): AdjustedCloseEnrichmentPlan {
  const providerByDate = new Map(
    providerRows.map((row) => [row.date.slice(0, 10), {
      close: positive(row.close),
      adjustedClose: positive(row.adjustedClose),
    }]),
  );
  const updates: Array<{ date: string; adjustedClose: number }> = [];

  for (const localRow of localRows) {
    const date = localRow.date.slice(0, 10);
    const provider = providerByDate.get(date);
    if (!provider || provider.close === null || provider.adjustedClose === null) {
      return { eligible: false, reason: "provider_missing_local_date", updates: [] };
    }

    const localClose = positive(localRow.close);
    if (localClose === null || Math.abs(localClose - provider.close) > EPSILON) {
      return { eligible: false, reason: "raw_close_differs", updates: [] };
    }

    const localAdjustedClose = positive(localRow.adjustedClose);
    if (localAdjustedClose === null) {
      updates.push({ date, adjustedClose: provider.adjustedClose });
      continue;
    }

    if (Math.abs(localAdjustedClose - provider.adjustedClose) > EPSILON) {
      return { eligible: false, reason: "existing_adjusted_close_differs", updates: [] };
    }
  }

  return { eligible: true, reason: null, updates };
}
