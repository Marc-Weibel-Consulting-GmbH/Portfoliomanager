/**
 * Model registry & feature contract — pure helpers shared by the training side
 * (Python exports the artifact + featureSpec) and the TS serving side (loads the
 * active artifact, normalizes features, runs ONNX inference).
 *
 * These are runtime-independent and unit-tested. DB access / ONNX inference /
 * Redis caching live in the (deploy-gated) wiring on top of these.
 */

export interface FeatureSpecEntry {
  name: string;
  /** Training-set mean used for standardization. */
  mean: number;
  /** Training-set std used for standardization (0 -> treated as 1). */
  std: number;
}

export interface FeatureSpec {
  /** Ordered list of features the model expects, with normalization params. */
  features: FeatureSpecEntry[];
}

export interface ArtifactLike {
  kind: string;
  version: number;
  status: string; // candidate | active | archived | failed
}

/**
 * Build the normalized, correctly-ordered input vector for a model from a raw
 * feature map. Standardizes each feature with its training mean/std. Missing
 * features fall back to the mean (i.e. a normalized value of 0), so a partially
 * available feature set still produces a valid vector instead of NaNs.
 */
export function normalizeFeatureVector(
  raw: Record<string, number>,
  spec: FeatureSpec,
): number[] {
  return spec.features.map((f) => {
    const v = raw[f.name];
    if (v === undefined || v === null || Number.isNaN(v)) return 0;
    const std = f.std && f.std !== 0 ? f.std : 1;
    return (v - f.mean) / std;
  });
}

/** The active artifact for a kind, or null if none is promoted yet. */
export function selectActiveArtifact<T extends ArtifactLike>(
  artifacts: T[],
  kind: string,
): T | null {
  const active = artifacts.filter((a) => a.kind === kind && a.status === "active");
  if (active.length === 0) return null;
  // Defensive: if more than one is marked active, prefer the highest version.
  return active.reduce((best, a) => (a.version > best.version ? a : best));
}

/** Next version number to assign when persisting a new artifact for a kind. */
export function nextVersion(artifacts: ArtifactLike[], kind: string): number {
  const versions = artifacts.filter((a) => a.kind === kind).map((a) => a.version);
  return versions.length ? Math.max(...versions) + 1 : 1;
}

export interface PromotionGate {
  minHitRate?: number;
  maxOverfitRatio?: number;
  minAlpha?: number;
}

export interface CandidateMetrics {
  hitRate?: number;
  overfitRatio?: number;
  alpha?: number;
}

/**
 * Decide whether a freshly trained candidate clears the promotion gate. Walk-
 * forward OOS metrics gate the promotion: a candidate only goes live if it beats
 * the configured thresholds. Missing required metrics fail closed.
 */
export function passesPromotionGate(metrics: CandidateMetrics, gate: PromotionGate): boolean {
  if (gate.minHitRate !== undefined) {
    if (metrics.hitRate === undefined || metrics.hitRate < gate.minHitRate) return false;
  }
  if (gate.maxOverfitRatio !== undefined) {
    if (metrics.overfitRatio === undefined || metrics.overfitRatio > gate.maxOverfitRatio) return false;
  }
  if (gate.minAlpha !== undefined) {
    if (metrics.alpha === undefined || metrics.alpha < gate.minAlpha) return false;
  }
  return true;
}
