import { rundlaufKostenPct } from "./backtestKennzahlen";

export const MOMENTUM_WALK_FORWARD_VERSION = "v1.0.0";
export const MIN_CENSOR_DAYS = 1;
export const MIN_DECISION_DATES = 24;
export const MIN_OOS_SELECTED = 50;
export const TOP_QUARTILE_PERCENTILE = 75;

export type HistoricalMomentumRow = {
  ticker: string;
  signalDate: string;
  /** Earliest executable trading date. Must be later than `signalDate`. */
  executionDate: string;
  /** Exit date of a fixed, already elapsed holding period. */
  exitDate: string;
  entryPrice: number | null;
  exitPrice: number | null;
  universePercentile: number | null;
  trendState: string | null;
  crashRiskActive: boolean;
  dataQuality: "qualified" | "data_gap" | "excluded";
};

export type WalkForwardRow = HistoricalMomentumRow & {
  grossReturnPct: number;
  netReturnPct: number;
  selected: boolean;
};

export type WalkForwardSlice = {
  dates: number;
  selectedN: number;
  baselineN: number;
  selectedMeanNetReturnPct: number | null;
  baselineMeanNetReturnPct: number | null;
  excessMeanNetReturnPct: number | null;
  selectedHitRatePct: number | null;
  turnoverPct: number | null;
};

export type MomentumWalkForwardResult = {
  version: string;
  inputRows: number;
  validRows: number;
  excludedRows: number;
  censorGapDays: number;
  roundTripCostPct: number;
  splitDate: string | null;
  training: WalkForwardSlice;
  outOfSample: WalkForwardSlice;
  eligibleForSignalWeight: false;
  verdict: string;
};

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

function mean(values: number[]): number | null {
  const finite = values.filter(Number.isFinite);
  return finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : null;
}

function selection(row: HistoricalMomentumRow): boolean {
  return row.universePercentile !== null
    && row.universePercentile >= TOP_QUARTILE_PERCENTILE
    && !row.crashRiskActive
    && (row.trendState === "intakt" || row.trendState === "konsolidierung");
}

/**
 * Produces only observations whose information and execution dates are ordered.
 * A row without a proven next-trading-day censor gap is discarded, never repaired
 * with same-day prices. This makes a leaky momentum result impossible by contract.
 */
export function buildCensoredMomentumObservations(rows: HistoricalMomentumRow[]): {
  rows: WalkForwardRow[];
  excludedRows: number;
} {
  const cost = rundlaufKostenPct();
  const valid: WalkForwardRow[] = [];
  let excludedRows = 0;
  for (const row of rows) {
    const timingValid = daysBetween(row.signalDate, row.executionDate) >= MIN_CENSOR_DAYS
      && daysBetween(row.executionDate, row.exitDate) >= MIN_CENSOR_DAYS;
    const priceValid = row.entryPrice !== null && row.exitPrice !== null
      && Number.isFinite(row.entryPrice) && Number.isFinite(row.exitPrice)
      && row.entryPrice > 0 && row.exitPrice > 0;
    if (row.dataQuality !== "qualified" || !timingValid || !priceValid) {
      excludedRows += 1;
      continue;
    }
    const grossReturnPct = ((row.exitPrice / row.entryPrice) - 1) * 100;
    valid.push({ ...row, grossReturnPct, netReturnPct: grossReturnPct - cost, selected: selection(row) });
  }
  return { rows: valid.sort((a, b) => a.signalDate.localeCompare(b.signalDate) || a.ticker.localeCompare(b.ticker)), excludedRows };
}

function turnoverByDate(rows: WalkForwardRow[]): number | null {
  const byDate = new Map<string, Set<string>>();
  for (const row of rows) {
    const set = byDate.get(row.signalDate) ?? new Set<string>();
    if (row.selected) set.add(row.ticker);
    byDate.set(row.signalDate, set);
  }
  const dates = [...byDate.keys()].sort();
  if (dates.length < 2) return null;
  const turnovers: number[] = [];
  for (let index = 1; index < dates.length; index += 1) {
    const previous = byDate.get(dates[index - 1])!;
    const current = byDate.get(dates[index])!;
    const union = new Set([...previous, ...current]).size;
    if (!union) continue;
    const retained = [...current].filter((ticker) => previous.has(ticker)).length;
    turnovers.push((1 - retained / union) * 100);
  }
  return mean(turnovers);
}

export function summarizeMomentumWalkForward(rows: WalkForwardRow[]): WalkForwardSlice {
  const selected = rows.filter((row) => row.selected);
  const baseline = rows;
  const selectedMean = mean(selected.map((row) => row.netReturnPct));
  const baselineMean = mean(baseline.map((row) => row.netReturnPct));
  return {
    dates: new Set(rows.map((row) => row.signalDate)).size,
    selectedN: selected.length,
    baselineN: baseline.length,
    selectedMeanNetReturnPct: selectedMean,
    baselineMeanNetReturnPct: baselineMean,
    excessMeanNetReturnPct: selectedMean !== null && baselineMean !== null ? selectedMean - baselineMean : null,
    selectedHitRatePct: selected.length ? (selected.filter((row) => row.netReturnPct > 0).length / selected.length) * 100 : null,
    turnoverPct: turnoverByDate(rows),
  };
}

/** Time split only: the same snapshot date can never appear in both training and test. */
export function evaluateMomentumWalkForward(rows: HistoricalMomentumRow[]): MomentumWalkForwardResult {
  const built = buildCensoredMomentumObservations(rows);
  const dates = [...new Set(built.rows.map((row) => row.signalDate))].sort();
  const splitIndex = dates.length >= 2 ? Math.max(0, Math.floor(dates.length * 0.8) - 1) : -1;
  const splitDate = splitIndex >= 0 ? dates[splitIndex] ?? null : null;
  const trainingRows = splitDate ? built.rows.filter((row) => row.signalDate <= splitDate) : built.rows;
  const outRows = splitDate ? built.rows.filter((row) => row.signalDate > splitDate) : [];
  const training = summarizeMomentumWalkForward(trainingRows);
  const outOfSample = summarizeMomentumWalkForward(outRows);
  const sufficientDates = dates.length >= MIN_DECISION_DATES;
  const sufficientOos = outOfSample.selectedN >= MIN_OOS_SELECTED;
  const outperformance = (outOfSample.excessMeanNetReturnPct ?? Number.NEGATIVE_INFINITY) > 0;
  const verdict = !sufficientDates
    ? `Noch nicht auswertbar: ${dates.length}/${MIN_DECISION_DATES} unabhängige Entscheidungsstichtage.`
    : !sufficientOos
      ? `Noch nicht auswertbar: ${outOfSample.selectedN}/${MIN_OOS_SELECTED} ausgewählte Out-of-Sample-Beobachtungen.`
      : !outperformance
        ? "Nicht übernehmen: Die fixe Momentumregel schlägt den gleich gemessenen Basisvergleich nach Kosten nicht."
        : "Ergebnis nur als Forschungsbefund: eine separate Prüfung gegen das bestehende Drei-Score-Signal bleibt erforderlich.";
  return {
    version: MOMENTUM_WALK_FORWARD_VERSION,
    inputRows: rows.length,
    validRows: built.rows.length,
    excludedRows: built.excludedRows,
    censorGapDays: MIN_CENSOR_DAYS,
    roundTripCostPct: rundlaufKostenPct(),
    splitDate,
    training,
    outOfSample,
    // Deliberate invariant: no code path from this report can alter live signal weights.
    eligibleForSignalWeight: false,
    verdict,
  };
}
