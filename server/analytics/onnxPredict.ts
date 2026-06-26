/**
 * ONNX inference for pre-trained signal models (serving side).
 *
 * Loads an ONNX model (exported by analytics_service/ml_training.py) and runs
 * inference on a feature vector that has already been standardized via the
 * artifact's featureSpec (see modelRegistry.normalizeFeatureVector). The model
 * input is named "input" and outputs a class label + class probabilities
 * (skl2onnx GradientBoosting, zipmap=False).
 *
 * NOTE for the server bundle: onnxruntime-node is a NATIVE module and must be
 * marked external in the esbuild config (not bundled). pnpm onlyBuiltDependencies
 * already allows its install script so the native binary is fetched on deploy.
 */
import * as ort from "onnxruntime-node";
import { normalizeFeatureVector, type FeatureSpec } from "./modelRegistry";

export interface OnnxPrediction {
  /** Predicted class label (model-specific; for gb_signal: 1=up, 0=down). */
  label: number;
  /** Class probabilities, if the model emits them. */
  probabilities: number[];
  /** Confidence = max class probability (0..1). */
  confidence: number;
}

/** Create an inference session from raw ONNX bytes (DB/Redis) or a file path. */
export async function createSession(model: Uint8Array | string): Promise<ort.InferenceSession> {
  return ort.InferenceSession.create(model as any);
}

/** Run inference on an already-normalized feature vector. */
export async function predictVector(
  session: ort.InferenceSession,
  normalized: number[],
): Promise<OnnxPrediction> {
  const input = new ort.Tensor("float32", Float32Array.from(normalized), [1, normalized.length]);
  const feeds: Record<string, ort.Tensor> = { [session.inputNames[0]]: input };
  const out = await session.run(feeds);

  // skl2onnx emits "label" (int64) and "probabilities" (float); be defensive.
  const labelName = session.outputNames.find((n) => n.toLowerCase().includes("label")) ?? session.outputNames[0];
  const probName = session.outputNames.find((n) => n.toLowerCase().includes("prob"));

  const labelData = out[labelName].data as BigInt64Array | Float32Array | Int32Array;
  const label = Number(labelData[0]);

  let probabilities: number[] = [];
  if (probName && out[probName]) {
    probabilities = Array.from(out[probName].data as Float32Array, (v) => Number(v));
  }
  const confidence = probabilities.length ? Math.max(...probabilities) : 1;
  return { label, probabilities, confidence };
}

/** Convenience: normalize raw features via the spec, then run inference. */
export async function predictFeatures(
  session: ort.InferenceSession,
  rawFeatures: Record<string, number>,
  spec: FeatureSpec,
): Promise<OnnxPrediction> {
  return predictVector(session, normalizeFeatureVector(rawFeatures, spec));
}
