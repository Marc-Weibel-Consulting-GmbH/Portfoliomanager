/**
 * ML training orchestration (the weekly pre-training run).
 *
 * Flow: pick universe -> load price series from the DB -> POST to the Python
 * analytics_service /analytics/train -> persist the returned artifact and promote
 * it if it cleared the gate. All side-effecting steps are injected so the
 * orchestration is unit-tested without a DB, network, or the Python service.
 */
import type { PromotionGate } from "./modelRegistry";

export interface PriceSeries {
  dates: string[];
  prices: number[];
}

export interface TrainServiceResponse {
  kind: string;
  metrics: Record<string, number>;
  featureSpec: { features: { name: string; mean: number; std: number }[] };
  passedGate: boolean;
  onnxBase64: string | null;
  notes: string[];
}

export interface TrainingJobDeps {
  getUniverse(): Promise<string[]>;
  getSeries(tickers: string[]): Promise<Record<string, PriceSeries>>;
  callTrainService(payload: {
    kind: string;
    seriesByTicker: Record<string, PriceSeries>;
    lookahead: number;
    minHitRate: number;
    maxOverfitRatio: number;
    minAlpha: number;
  }): Promise<TrainServiceResponse>;
  persist(
    out: {
      kind: string;
      onnxBytes: Uint8Array;
      featureSpec: TrainServiceResponse["featureSpec"];
      metrics: Record<string, number>;
      universeSize: number;
    },
    gate: PromotionGate,
  ): Promise<{ version: number; promoted: boolean }>;
  log?: (msg: string) => void;
}

export interface TrainingJobOptions {
  kind: string;
  gate: Required<PromotionGate>;
  lookahead: number;
  minSeriesLength: number; // skip tickers with too little history
  minTickers: number; // skip the whole run if the universe is too small
}

export const DEFAULT_TRAINING_OPTIONS: TrainingJobOptions = {
  kind: "gb_signal",
  gate: { minHitRate: 0.52, maxOverfitRatio: 2.0, minAlpha: 0 },
  lookahead: 30,
  minSeriesLength: 150,
  minTickers: 5,
};

export interface TrainingJobResult {
  status: "trained" | "skipped" | "failed";
  reason?: string;
  version?: number;
  promoted?: boolean;
  metrics?: Record<string, number>;
  universeSize?: number;
}

export async function runTrainingJob(
  deps: TrainingJobDeps,
  opts: TrainingJobOptions = DEFAULT_TRAINING_OPTIONS,
): Promise<TrainingJobResult> {
  const log = deps.log ?? (() => {});
  const universe = await deps.getUniverse();
  const seriesAll = await deps.getSeries(universe);

  // Keep only tickers with enough history.
  const seriesByTicker: Record<string, PriceSeries> = {};
  for (const [tk, s] of Object.entries(seriesAll)) {
    if (s && s.prices.length >= opts.minSeriesLength) seriesByTicker[tk] = s;
  }
  const usable = Object.keys(seriesByTicker).length;
  if (usable < opts.minTickers) {
    log(`[mlTraining] skipped: only ${usable} usable tickers (< ${opts.minTickers})`);
    return { status: "skipped", reason: `too few tickers (${usable})`, universeSize: usable };
  }

  log(`[mlTraining] training '${opts.kind}' on ${usable} tickers`);
  const resp = await deps.callTrainService({
    kind: opts.kind,
    seriesByTicker,
    lookahead: opts.lookahead,
    minHitRate: opts.gate.minHitRate,
    maxOverfitRatio: opts.gate.maxOverfitRatio,
    minAlpha: opts.gate.minAlpha,
  });

  if (!resp.onnxBase64) {
    log(`[mlTraining] failed: no model returned (${resp.notes?.join("; ")})`);
    return { status: "failed", reason: "no model returned", metrics: resp.metrics, universeSize: usable };
  }

  const onnxBytes = new Uint8Array(Buffer.from(resp.onnxBase64, "base64"));
  const { version, promoted } = await deps.persist(
    { kind: opts.kind, onnxBytes, featureSpec: resp.featureSpec, metrics: resp.metrics, universeSize: usable },
    opts.gate,
  );
  log(`[mlTraining] persisted v${version} promoted=${promoted} hitRate=${resp.metrics?.hitRate?.toFixed?.(3)}`);
  return { status: "trained", version, promoted, metrics: resp.metrics, universeSize: usable };
}
