import { readFile, writeFile } from "node:fs/promises";
import { refreshSignalCache } from "../cron/signalCacheCron";

const OUT = "docs/audit/workings/SIGNAL_REFRESH_AFTER_SPLIT_CORRECTION_2026-10-09.json";

async function main() {
  const startedAt = new Date();
  await refreshSignalCache();
  const report = {
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    scope: "Aktive Stock-Signal-Caches nach der splitbereinigten Preisbasisaktualisierung",
    note: "Der Refresh ändert keine Rohpreise, Portfolios, Cash, Ledger, Transaktionen oder Orders.",
  };
  await writeFile(OUT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ outPath: OUT, ...report }, null, 2));
}
main().then(() => process.exit(0)).catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
