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
  featureSpec?: FeatureSpec;
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
 * Drizzle-backed ArtifactRepo over the modelArtifacts table. Thin adapter; the
 * orchestration logic is tested with a fake repo.
 */
export function createDbArtifactRepo(db: any): ArtifactRepo {
  // Lazy requires to avoid import cycles / load cost when unused.
  return {
    async list(kind: string): Promise<ArtifactRow[]> {
      const { modelArtifacts } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const rows = await db.select().from(modelArtifacts).where(eq(modelArtifacts.kind, kind as any));
      return rows.map((r: any) => ({ id: r.id, kind: r.kind, version: r.version, status: r.status, modelBlob: r.modelBlob, featureSpec: r.featureSpec }));
    },
    async insert(row): Promise<number> {
      const { modelArtifacts } = await import("../../drizzle/schema");
      const res = await db.insert(modelArtifacts).values({
        kind: row.kind, version: row.version, status: row.status, format: row.format,
        modelBlob: row.modelBlob, featureSpec: row.featureSpec, metrics: row.metrics,
        trainStart: row.trainStart, trainEnd: row.trainEnd, universeSize: row.universeSize,
      });
      return Number(res?.[0]?.insertId ?? 0);
    },
    async setStatus(id: number, status: string, promotedAt?: boolean): Promise<void> {
      const { modelArtifacts } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const patch: Record<string, unknown> = { status };
      if (promotedAt) patch.promotedAt = new Date();
      await db.update(modelArtifacts).set(patch).where(eq(modelArtifacts.id, id));
    },
  };
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

export interface ActiveArtifact {
  bytes: Buffer;
  featureSpec: FeatureSpec;
  version: number;
}

/**
 * Load the active artifact's bytes + feature spec + version. Bytes come from the
 * cache when warm; the feature spec/version always come from the DB row (small).
 * Returns null if no model has been promoted or the spec is missing.
 */
export async function loadActiveArtifact(
  deps: { repo: ArtifactRepo; cache: BytesCache },
  kind: string,
): Promise<ActiveArtifact | null> {
  const active = selectActiveArtifact(await deps.repo.list(kind), kind);
  if (!active || !active.modelBlob || !active.featureSpec) return null;
  const cached = await deps.cache.get(activeCacheKey(kind));
  const bytes = cached ?? Buffer.from(active.modelBlob, "base64");
  if (!cached) await deps.cache.set(activeCacheKey(kind), bytes, ACTIVE_TTL);
  return { bytes, featureSpec: active.featureSpec, version: active.version };
}
