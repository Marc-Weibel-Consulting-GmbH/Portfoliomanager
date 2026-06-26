/**
 * Persistence & promotion for model artifacts.
 *
 * The DB (modelArtifacts) is the source of truth. A training run writes a
 * `candidate`; if it clears the walk-forward promotion gate it becomes `active`
 * (the previous active is archived). The active model's ONNX bytes are cached
 * (Redis/in-memory) under a stable key for fast, cross-instance serving.
 *
 * Repo access is injected so the orchestration is unit-tested without a DB.
 */
import {
  nextVersion,
  selectActiveArtifact,
  passesPromotionGate,
  type PromotionGate,
  type FeatureSpec,
} from "./modelRegistry";
import type { BytesCache } from "../_core/modelCache";

export interface ArtifactRow {
  id: number;
  kind: string;
  version: number;
  status: string;
  modelBlob: string | null; // base64 ONNX
}

export interface ArtifactRepo {
  list(kind: string): Promise<ArtifactRow[]>;
  insert(row: {
    kind: string;
    version: number;
    status: string;
    format: string;
    modelBlob: string;
    featureSpec: FeatureSpec;
    metrics: Record<string, number>;
    trainStart?: string;
    trainEnd?: string;
    universeSize?: number;
  }): Promise<number>; // returns new id
  setStatus(id: number, status: string, promotedAt?: boolean): Promise<void>;
}

export interface TrainingOutput {
  kind: string;
  onnxBytes: Uint8Array;
  featureSpec: FeatureSpec;
  metrics: Record<string, number>;
  trainStart?: string;
  trainEnd?: string;
  universeSize?: number;
}

const ACTIVE_TTL = 7 * 24 * 60 * 60; // 7 days
export const activeCacheKey = (kind: string) => `model:${kind}:active`;

/**
 * Persist a freshly trained candidate and promote it if it clears the gate.
 * Returns the assigned version and whether it was promoted to active.
 */
export async function persistAndMaybePromote(
  deps: { repo: ArtifactRepo; cache: BytesCache },
  out: TrainingOutput,
  gate: PromotionGate,
): Promise<{ version: number; promoted: boolean }> {
  const existing = await deps.repo.list(out.kind);
  const version = nextVersion(existing, out.kind);
  const base64 = Buffer.from(out.onnxBytes).toString("base64");

  const promoted = passesPromotionGate(out.metrics, gate);

  const id = await deps.repo.insert({
    kind: out.kind,
    version,
    status: promoted ? "active" : "candidate",
    format: "onnx",
    modelBlob: base64,
    featureSpec: out.featureSpec,
    metrics: out.metrics,
    trainStart: out.trainStart,
    trainEnd: out.trainEnd,
    universeSize: out.universeSize,
  });

  if (promoted) {
    // Archive any previously active artifact of this kind.
    for (const a of existing) {
      if (a.status === "active") await deps.repo.setStatus(a.id, "archived");
    }
    await deps.repo.setStatus(id, "active", true);
    // Refresh the hot cache with the new active bytes.
    await deps.cache.set(activeCacheKey(out.kind), Buffer.from(out.onnxBytes), ACTIVE_TTL);
  }

  return { version, promoted };
}

/**
 * Load the active model's ONNX bytes for a kind: cache first, then DB (and warm
 * the cache). Returns null if no model has been promoted yet.
 */
export async function loadActiveModelBytes(
  deps: { repo: ArtifactRepo; cache: BytesCache },
  kind: string,
): Promise<Buffer | null> {
  const cached = await deps.cache.get(activeCacheKey(kind));
  if (cached) return cached;

  const active = selectActiveArtifact(await deps.repo.list(kind), kind);
  if (!active || !active.modelBlob) return null;
  const bytes = Buffer.from(active.modelBlob, "base64");
  await deps.cache.set(activeCacheKey(kind), bytes, ACTIVE_TTL);
  return bytes;
}
