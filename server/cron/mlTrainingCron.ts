/**
 * Weekly ML pre-training cron.
 *
 * Builds the universe + price series from the DB, calls the Python
 * analytics_service /analytics/train (GB + walk-forward + ONNX), then persists &
 * promotes the artifact. Training is disabled (logged + skipped) when
 * ANALYTICS_SERVICE_URL is not configured, so the app runs fine without it.
 */
import cron from "node-cron";
import {
  runTrainingJob,
  DEFAULT_TRAINING_OPTIONS,
  type TrainingJobDeps,
  type PriceSeries,
  type TrainServiceResponse,
} from "../analytics/mlTrainingJob";
import { persistAndMaybePromote, createDbArtifactRepo } from "../analytics/modelStore";
import { getModelCache } from "../_core/modelCache";

const MAX_UNIVERSE = 80; // bound training cost / API load

async function buildDeps(): Promise<TrainingJobDeps | null> {
  const serviceUrl = process.env.ANALYTICS_SERVICE_URL;
  if (!serviceUrl) {
    console.log("[mlTraining] ANALYTICS_SERVICE_URL not set — training disabled");
    return null;
  }
  const { getDb } = await import("../db");
  const db = await getDb();
  if (!db) {
    console.error("[mlTraining] DB unavailable");
    return null;
  }

  return {
    async getUniverse(): Promise<string[]> {
      const { getWatchlistTickers } = await import("../analytics/walkForwardEngine");
      const tickers = await getWatchlistTickers();
      return tickers.slice(0, MAX_UNIVERSE);
    },
    async getSeries(tickers: string[]): Promise<Record<string, PriceSeries>> {
      const { historicalPrices } = await import("../../drizzle/schema");
      const { eq, asc } = await import("drizzle-orm");
      const out: Record<string, PriceSeries> = {};
      for (const ticker of tickers) {
        const rows = await db
          .select()
          .from(historicalPrices)
          .where(eq(historicalPrices.ticker, ticker))
          .orderBy(asc(historicalPrices.date));
        if (!rows.length) continue;
        const dates: string[] = [];
        const prices: number[] = [];
        for (const r of rows as any[]) {
          const px = parseFloat(r.adjustedClose ?? r.close ?? "0");
          if (px > 0) { dates.push(r.date); prices.push(px); }
        }
        if (prices.length) out[ticker] = { dates, prices };
      }
      return out;
    },
    async callTrainService(payload): Promise<TrainServiceResponse> {
      const res = await fetch(`${serviceUrl.replace(/\/$/, "")}/analytics/train`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`train service ${res.status}`);
      return (await res.json()) as TrainServiceResponse;
    },
    async persist(out, gate) {
      const repo = createDbArtifactRepo(db);
      const cache = await getModelCache();
      return persistAndMaybePromote({ repo, cache }, out, gate);
    },
    log: (m: string) => console.log(m),
  };
}

async function runOnce() {
  try {
    const deps = await buildDeps();
    if (!deps) return;
    const result = await runTrainingJob(deps, DEFAULT_TRAINING_OPTIONS);
    console.log("[mlTraining] run result:", JSON.stringify(result));
  } catch (e) {
    console.error("[mlTraining] run failed:", (e as Error)?.message);
  }
}

/** Initialize the weekly training cron (Mondays 02:37 UTC). */
export function initMlTrainingCron() {
  // second minute hour day month dayOfWeek
  cron.schedule("0 37 2 * * 1", runOnce);
  console.log("[mlTraining] Cron initialized (weekly, Mon 02:37 UTC)");
}

export { runOnce as runMlTrainingOnce };
