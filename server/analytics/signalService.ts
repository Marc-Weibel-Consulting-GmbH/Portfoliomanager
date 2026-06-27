/**
 * Unified signal serving: use the active pre-trained GB model (ONNX) when one is
 * promoted, otherwise fall back to the existing on-the-fly RandomForest. Until a
 * model is trained & promoted, behaviour is unchanged (pure fallback).
 *
 * The model loader (DB + cache + onnx session) is injected so the decision logic
 * is unit-tested against a fixture without DB/Redis.
 */
import type { InferenceSession } from "onnxruntime-node";
import { predictVector, createSession, type OnnxPrediction } from "./onnxPredict";
import { normalizeFeatureVector, type FeatureSpec } from "./modelRegistry";
import { featuresAt } from "./signalFeatures";
import type { RFSignalResult } from "./mlEngine";

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

// ─────────────────────────────────────────────────────────────────────────────
// Integration into the existing call-sites: produce an RFSignalResult-shaped
// result from the GB model (so consumers are unchanged), else use the injected
// RandomForest fallback.
// ─────────────────────────────────────────────────────────────────────────────

/** Probability of "up" from a binary GB prediction (class 1). */
function probUp(pred: OnnxPrediction): number {
  if (pred.probabilities.length >= 2) return pred.probabilities[1];
  return pred.label >= 1 ? pred.confidence : 1 - pred.confidence;
}

/** Map a GB prediction into the RFSignalResult shape used across the app. */
export function gbSignalResult(pred: OnnxPrediction, version: number): RFSignalResult {
  const pUp = probUp(pred);
  let signal: RFSignalResult["signal"];
  if (pUp >= 0.66) signal = "strong_buy";
  else if (pUp >= 0.55) signal = "buy";
  else if (pUp > 0.45) signal = "hold";
  else if (pUp > 0.34) signal = "sell";
  else signal = "strong_sell";
  return {
    signal,
    confidence: pred.confidence,
    score: Math.round(pUp * 100),
    featureImportance: [],
    reasons: [`GB-Modell v${version}: Aufwärts-Wahrscheinlichkeit ${(pUp * 100).toFixed(0)}%`],
    source: 'gb' as const,
    modelVersion: version,
  };
}

/**
 * Drop-in replacement for direct randomForestSignal calls: use the active GB
 * model when available, else the RandomForest fallback. Returns RFSignalResult.
 */
export async function signalForSeries(
  loader: ActiveModelLoader,
  fallback: () => RFSignalResult,
  kind: string,
  prices: number[],
): Promise<RFSignalResult> {
  const model = await loader(kind);
  if (!model) return fallback();
  const feats = featuresAt(prices, prices.length - 1);
  if (!feats) return fallback();
  const vec = normalizeFeatureVector(feats, model.featureSpec);
  const pred = await predictVector(model.session, vec);
  return gbSignalResult(pred, model.version);
}

// ─────────────────────────────────────────────────────────────────────────────
// Real loader: DB (active artifact) + bytes cache + per-version ONNX session,
// memoized in-process briefly so requests don't re-hit the DB. No-op-safe: any
// failure (no DB / no model) returns null and callers fall back to RandomForest.
// ─────────────────────────────────────────────────────────────────────────────
const MEMO_TTL_MS = 5 * 60 * 1000;
const memo = new Map<string, { model: ActiveModel | null; expiresAt: number }>();
const sessionByVersion = new Map<number, InferenceSession>();

export async function getActiveSignalModel(kind: string): Promise<ActiveModel | null> {
  const cached = memo.get(kind);
  if (cached && Date.now() < cached.expiresAt) return cached.model;

  let model: ActiveModel | null = null;
  try {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (db) {
      const { createDbArtifactRepo, loadActiveArtifact } = await import("./modelStore");
      const { getModelCache } = await import("../_core/modelCache");
      const repo = createDbArtifactRepo(db);
      const cache = await getModelCache();
      const art = await loadActiveArtifact({ repo, cache }, kind);
      if (art) {
        let session = sessionByVersion.get(art.version);
        if (!session) {
          session = await createSession(new Uint8Array(art.bytes));
          sessionByVersion.set(art.version, session);
        }
        model = { session, featureSpec: art.featureSpec, version: art.version };
      }
    }
  } catch (e) {
    console.error("[signalService] getActiveSignalModel failed, using fallback:", (e as Error)?.message);
    model = null;
  }
  memo.set(kind, { model, expiresAt: Date.now() + MEMO_TTL_MS });
  return model;
}

/** Test-only: clear memo + session caches. */
export function __resetSignalServiceForTests() {
  memo.clear();
  sessionByVersion.clear();
}
