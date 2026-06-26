/**
 * Trigger ONE ML pre-training run on demand (instead of waiting for the weekly cron).
 *
 * Reads the universe + price series from the DB, calls the Python analytics_service
 * /analytics/train, then persists & promotes the artifact if it clears the gate.
 *
 * Requires (in the deployed env): ANALYTICS_SERVICE_URL, DB access, and optionally
 * Upstash/Redis env. Without ANALYTICS_SERVICE_URL the run is a logged no-op.
 *
 * Usage: pnpm ml:train
 */
import { runMlTrainingOnce } from "../server/cron/mlTrainingCron";

async function main() {
  console.log("[ml:train] starting one-off training run…");
  await runMlTrainingOnce();
  console.log("[ml:train] done");
  process.exit(0);
}

main().catch((e) => {
  console.error("[ml:train] failed:", e?.message ?? e);
  process.exit(1);
});
