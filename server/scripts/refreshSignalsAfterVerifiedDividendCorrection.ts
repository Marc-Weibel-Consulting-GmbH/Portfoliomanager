import { mkdir, writeFile } from "node:fs/promises";
import { refreshSignalCache } from "../cron/signalCacheCron";

const AS_OF_DATE = process.env.AUDIT_AS_OF_DATE ?? new Date().toISOString().slice(0, 10);
const OUTPUT = `docs/audit/workings/SIGNAL_REFRESH_AFTER_VERIFIED_DIVIDEND_CORRECTION_${AS_OF_DATE}.json`;

async function main(): Promise<void> {
  const startedAt = new Date();
  await refreshSignalCache();
  const report = {
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    scope: "Aktive Signalcaches nach verifizierter EODHD-TTM-/Forward-Dividendenbasis für 314 aktive Instrumente",
    note: "Der Refresh ändert keine Rohpreise, Portfolios, Cash, Ledger, Transaktionen oder Orders.",
  };
  await mkdir("docs/audit/workings", { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ output: OUTPUT, ...report }, null, 2));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
