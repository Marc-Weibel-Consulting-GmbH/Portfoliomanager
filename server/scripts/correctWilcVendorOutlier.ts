import { mkdir, writeFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { stocks } from "../../drizzle/schema";
import { getDb } from "../db";

const OUT = "docs/audit/workings/WILC_VENDOR_OUTLIER_CORRECTION_2026-10-09.json";
const GATE = "[Preisbasis]";

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Datenbankverbindung nicht verfügbar");
  const [before] = await db.select().from(stocks).where(eq(stocks.ticker, "WILC")).limit(1);
  if (!before) throw new Error("WILC nicht gefunden");

  const preservedNotes = [...new Set((before.dataQualityNotes ?? "")
    .split(" · ")
    .filter(Boolean)
    .filter((note) => !note.startsWith(GATE)))]
    // The scheduler may have appended a repeated legacy signal message before
    // this correction. Preserve only concise, distinct non-price disclosures.
    .slice(0, 4);
  const reason = "EODHD liefert in WILC.US isolierte, nicht durch Splits belegte 300×-Ausreißer (z. B. 2026-07-03 10'160 nach 33.31); YTD und 52W sind bis zu einer verifizierten konsistenten Handelslinie gesperrt.";
  const update = {
    // No current point quote can be asserted while EODHD returns a stale
    // 7'679 and Yahoo's last observation dates to 2026-08-26. Expose a data
    // gap rather than presenting a stale or mechanically impossible quote.
    currentPrice: null,
    ytdStartPrice: null,
    ytdPerformance: null,
    week52High: null,
    week52Low: null,
    dataQualityStatus: "pruefen" as const,
    dataQualityNotes: [...preservedNotes, `${GATE} ${reason}`].join(" · "),
    dataQualityUpdatedAt: new Date(),
  };
  await db.update(stocks).set(update).where(eq(stocks.id, before.id));
  const [after] = await db.select().from(stocks).where(eq(stocks.ticker, "WILC")).limit(1);
  const report = {
    correctedAt: new Date().toISOString(),
    ticker: "WILC",
    classification: "vendor_outlier_not_verified_corporate_action",
    evidence: "WILC_PRICE_RAW_EVIDENCE_2026-10-09.json",
    before: {
      currentPrice: before.currentPrice,
      ytdStartPrice: before.ytdStartPrice,
      ytdPerformance: before.ytdPerformance,
      week52High: before.week52High,
      week52Low: before.week52Low,
    },
    after: after ? {
      currentPrice: after.currentPrice,
      ytdStartPrice: after.ytdStartPrice,
      ytdPerformance: after.ytdPerformance,
      week52High: after.week52High,
      week52Low: after.week52Low,
      dataQualityStatus: after.dataQualityStatus,
      dataQualityNotes: after.dataQualityNotes,
    } : null,
    invariants: {
      rawHistoricalPricesMutated: false,
      splitSnapshotsMutated: false,
      portfolioMutated: false,
      cashMutated: false,
      ledgerMutated: false,
      transactionsMutated: false,
      ordersPlaced: false,
    },
  };
  await mkdir("docs/audit/workings", { recursive: true });
  await writeFile(OUT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ outPath: OUT, before: report.before, after: report.after }, null, 2));
}
main().then(() => process.exit(0)).catch((error) => { console.error(error instanceof Error ? error.stack ?? error.message : error); process.exit(1); });
