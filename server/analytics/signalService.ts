/**
 * Unified signal serving: use the active pre-trained GB model (ONNX) when one is
 * promoted, otherwise fall back to the existing on-the-fly RandomForest. Until a
 * model is trained & promoted, behaviour is unchanged (pure fallback).
 *
 * The model loader (DB + cache + onnx session) is injected so the decision logic
 * is unit-tested against a fixture without DB/Redis.
 */
import type { InferenceSession } from "onnxruntime-node";
import { predictVector } from "./onnxPredict";
import { normalizeFeatureVector, type FeatureSpec } from "./modelRegistry";
import { featuresAt } from "./signalFeatures";

export interface ActiveModel {
  session: InferenceSession;
  featureSpec: FeatureSpec;
  version: number;
}

export type ActiveModelLoader = (kind: string) => Promise<ActiveModel | null>;

export interface SignalResult {
  source: "gb" | "rf";
  signal: "buy" | "hold" | "sell";
  confidence: number;
  modelVersion?: number;
}

function labelToSignal(label: number): "buy" | "hold" | "sell" {
  // gb_signal: 1 = forward return up, 0 = down. (Binary model → buy/sell.)
  return label >= 1 ? "buy" : "sell";
}

/**
 * Predict a signal for a price series. Uses the active GB model if available,
 * else the injected fallback (RandomForest). `prices` must be chronological.
 */
export async function predictSignal(
  loader: ActiveModelLoader,
  fallback: () => SignalResult | Promise<SignalResult>,
  kind: string,
  prices: number[],
): Promise<SignalResult> {
  const model = await loader(kind);
  if (!model) return fallback();

  const feats = featuresAt(prices, prices.length - 1);
  if (!feats) return fallback();

  const vec = normalizeFeatureVector(feats, model.featureSpec);
  const pred = await predictVector(model.session, vec);
  return {
    source: "gb",
    signal: labelToSignal(pred.label),
    confidence: pred.confidence,
    modelVersion: model.version,
  };
}
