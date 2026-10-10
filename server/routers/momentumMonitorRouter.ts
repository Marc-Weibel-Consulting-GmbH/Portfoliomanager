import { and, desc, eq, lte } from "drizzle-orm";
import { z } from "zod";
import { momentumMonitorRuns, momentumMonitorSnapshots } from "../../drizzle/schema";
import { median } from "../lib/momentumMonitor";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

function fromBps(value: number | null | undefined): number | null {
  return value === null || value === undefined ? null : value / 100;
}

function snapshotCutoff(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() - 28);
  return parsed.toISOString().slice(0, 10);
}

function serializeRow(row: typeof momentumMonitorSnapshots.$inferSelect, previous?: typeof momentumMonitorSnapshots.$inferSelect) {
  const currentComposite = fromBps(row.compositeBps);
  const previousComposite = fromBps(previous?.compositeBps);
  return {
    ticker: row.ticker,
    companyName: row.companyName,
    sector: row.sector,
    region: row.region,
    sourceSymbol: row.sourceSymbol,
    snapshotDate: row.snapshotDate,
    priceAsOfDate: row.priceAsOfDate,
    priceBasis: row.priceBasis,
    coverageDays: row.coverageDays,
    return6mPct: fromBps(row.return6mBps),
    return12mPct: fromBps(row.return12mBps),
    compositeMomentumPct: currentComposite,
    compositeMomentumChangePp: currentComposite !== null && previousComposite !== null ? currentComposite - previousComposite : null,
    universePercentile: row.universePercentile,
    sectorPercentile: row.sectorPercentile,
    benchmarkKey: row.benchmarkKey,
    benchmarkReturn6mPct: fromBps(row.benchmarkReturn6mBps),
    benchmarkReturn12mPct: fromBps(row.benchmarkReturn12mBps),
    relative6mPct: fromBps(row.relative6mBps),
    relative12mPct: fromBps(row.relative12mBps),
    trendState: row.trendState,
    trendDistancePct: fromBps(row.trendDistanceBps),
    crashRiskActive: row.crashRiskActive === 1,
    crashRiskReason: row.crashRiskReason,
    dataQuality: row.dataQuality,
    dataQualityReason: row.dataQualityReason,
  };
}

export const momentumMonitorRouter = router({
  overview: protectedProcedure
    .input(z.object({ limit: z.number().min(5).max(100).optional().default(30) }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Datenbank nicht verfügbar");
      const latestRun = (await db.select().from(momentumMonitorRuns)
        .where(eq(momentumMonitorRuns.status, "completed"))
        .orderBy(desc(momentumMonitorRuns.snapshotDate))
        .limit(1))[0];
      if (!latestRun) return { available: false as const, snapshotDate: null, summary: null, leaders: [], sectors: [], dataGaps: [] };

      const current = await db.select().from(momentumMonitorSnapshots)
        .where(eq(momentumMonitorSnapshots.snapshotDate, latestRun.snapshotDate));
      const previousDate = (await db.select({ snapshotDate: momentumMonitorSnapshots.snapshotDate })
        .from(momentumMonitorSnapshots)
        .where(lte(momentumMonitorSnapshots.snapshotDate, snapshotCutoff(latestRun.snapshotDate)))
        .orderBy(desc(momentumMonitorSnapshots.snapshotDate))
        .limit(1))[0]?.snapshotDate;
      const previous = previousDate
        ? await db.select().from(momentumMonitorSnapshots).where(eq(momentumMonitorSnapshots.snapshotDate, previousDate))
        : [];
      const previousByTicker = new Map(previous.map((row) => [row.ticker, row]));
      const serialized = current.map((row) => serializeRow(row, previousByTicker.get(row.ticker)));
      const qualified = serialized.filter((row) => row.dataQuality === "qualified" && row.compositeMomentumPct !== null);
      const leaders = [...qualified]
        .sort((left, right) => (right.compositeMomentumPct ?? -Infinity) - (left.compositeMomentumPct ?? -Infinity))
        .slice(0, input?.limit ?? 30);
      const dataGaps = serialized.filter((row) => row.dataQuality !== "qualified");
      const bySector = new Map<string, typeof qualified>();
      for (const row of qualified) {
        const key = row.sector?.trim() || "Ohne Sektor";
        bySector.set(key, [...(bySector.get(key) ?? []), row]);
      }
      const sectors = [...bySector.entries()].map(([sector, rows]) => {
        const stateCount = (state: string) => rows.filter((row) => row.trendState === state).length;
        const withRelativeStrength = rows.filter((row) => row.relative12mPct !== null);
        return {
          sector,
          qualifiedCount: rows.length,
          median6mPct: median(rows.map((row) => row.return6mPct ?? Number.NaN)),
          median12mPct: median(rows.map((row) => row.return12mPct ?? Number.NaN)),
          medianCompositePct: median(rows.map((row) => row.compositeMomentumPct ?? Number.NaN)),
          medianChangePp: median(rows.map((row) => row.compositeMomentumChangePp ?? Number.NaN)),
          aboveBenchmarkCount: withRelativeStrength.filter((row) => (row.relative12mPct ?? 0) > 0).length,
          relativeStrengthCoverage: withRelativeStrength.length,
          intactCount: stateCount("intakt"),
          consolidationCount: stateCount("konsolidierung"),
          overheatCount: stateCount("ueberhitzt"),
          breakCount: stateCount("trendbruch"),
          crashRiskCount: rows.filter((row) => row.crashRiskActive).length,
        };
      }).sort((left, right) => (right.medianCompositePct ?? -Infinity) - (left.medianCompositePct ?? -Infinity));

      return {
        available: true as const,
        snapshotDate: latestRun.snapshotDate,
        summary: {
          activeInstrumentCount: latestRun.activeInstrumentCount,
          qualifiedCount: latestRun.qualifiedCount,
          dataGapCount: latestRun.dataGapCount,
          excludedCount: latestRun.excludedCount,
          crashRiskCount: latestRun.crashRiskCount,
          priceBasis: "Splitbereinigte Preisrendite ohne Cashdividenden",
          methodVersion: current[0]?.methodVersion ?? null,
        },
        leaders,
        sectors,
        dataGaps: dataGaps.slice(0, 100),
      };
    }),

  detail: protectedProcedure
    .input(z.object({ ticker: z.string().min(1).max(50) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Datenbank nicht verfügbar");
      const row = (await db.select().from(momentumMonitorSnapshots)
        .where(eq(momentumMonitorSnapshots.ticker, input.ticker))
        .orderBy(desc(momentumMonitorSnapshots.snapshotDate))
        .limit(1))[0];
      return row ? serializeRow(row) : null;
    }),
});
