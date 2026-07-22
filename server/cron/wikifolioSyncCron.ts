/**
 * Wikifolio-Trades-Sync-Cron (Track B5)
 * ======================================
 * Ruft täglich die Transaktionshistorie aller verfolgten Wikifolios ab
 * und persistiert neue Trades in der wikifolio_trades-Tabelle.
 *
 * Voraussetzung: Wikifolio muss in der `wikifolios`-Tabelle mit
 * `isTracked = 1` markiert sein.
 *
 * Läuft täglich um 03:00 UTC (nach dem Marktschluss Europa/US).
 */
import { eq, isNotNull } from "drizzle-orm";
import { getDb } from "../db";
import { wikifolios, wikifolioTrades } from "../../drizzle/schema";
import { getWikifolioTrades } from "../lib/wikifolioService";
import { resolveIsinViaEodhd } from "../lib/isinResolver";

let isSyncing = false;

/**
 * Sync trades for all tracked wikifolios.
 * Returns a summary of what was synced.
 */
export async function syncWikifolioTrades(): Promise<{
  synced: number;
  newTrades: number;
  errors: string[];
}> {
  if (isSyncing) {
    console.log("[wikifolioSyncCron] Already running, skipping...");
    return { synced: 0, newTrades: 0, errors: ["Already running"] };
  }
  isSyncing = true;
  const errors: string[] = [];
  let synced = 0;
  let newTrades = 0;

  try {
    const db = await getDb();
    if (!db) {
      console.error("[wikifolioSyncCron] DB not available");
      return { synced: 0, newTrades: 0, errors: ["DB not available"] };
    }

    // 1. Alle verfolgten Wikifolios laden
    const trackedWikifolios = await db
      .select()
      .from(wikifolios)
      .where(eq(wikifolios.isTracked, 1));

    if (trackedWikifolios.length === 0) {
      console.log("[wikifolioSyncCron] No tracked wikifolios found. Mark wikifolios as isTracked=1 in the DB.");
      return { synced: 0, newTrades: 0, errors: [] };
    }

    console.log(`[wikifolioSyncCron] Syncing ${trackedWikifolios.length} tracked wikifolios...`);

    // 2. ISIN → Ticker-Mapping aus bereits aufgelösten wikifolio_trades aufbauen
    const existingResolved = await db
      .select({ isin: wikifolioTrades.isin, resolvedTicker: wikifolioTrades.resolvedTicker })
      .from(wikifolioTrades)
      .where(isNotNull(wikifolioTrades.resolvedTicker));
    const isinToTicker: Record<string, string> = {};
    for (const r of existingResolved) {
      if (r.isin && r.resolvedTicker) isinToTicker[r.isin] = r.resolvedTicker;
    }

    // 3. Für jedes Wikifolio Trades abrufen und persistieren
    for (const wiki of trackedWikifolios) {
      try {
        const rawTrades = await getWikifolioTrades(wiki.symbol, 200);
        if (!rawTrades || rawTrades.length === 0) {
          console.log(`[wikifolioSyncCron] No trades for ${wiki.symbol}`);
          synced++;
          continue;
        }

        // 4. Trades in DB einfügen (IGNORE bei Duplikaten via externalTradeId)
        let inserted = 0;
        for (const trade of rawTrades) {
          if (!trade.externalTradeId) continue; // Ohne ID keine Deduplizierung möglich

          // ISIN → Ticker auflösen: erst aus Cache, dann via EODHD
          let resolvedTicker = trade.isin ? (isinToTicker[trade.isin] ?? null) : null;
          if (!resolvedTicker && trade.isin) {
            try {
              const resolved = await resolveIsinViaEodhd(trade.isin);
              if (resolved) {
                resolvedTicker = resolved;
                isinToTicker[trade.isin] = resolved; // Cache für spätere Trades
              }
            } catch { /* silent — EODHD-Fehler nicht fatal */ }
          }
          const side: "buy" | "sell" | "other" =
            trade.side === "buy" ? "buy" : trade.side === "sell" ? "sell" : "other";

          try {
            await db.insert(wikifolioTrades).values({
              wikifolioId: wiki.id,
              externalTradeId: trade.externalTradeId,
              isin: trade.isin ?? null,
              resolvedTicker,
              name: trade.name ?? null,
              side,
              executionPrice: trade.executionPrice != null ? String(trade.executionPrice) : null,
              weightage: trade.weightage != null ? String(trade.weightage) : null,
              executedAt: trade.executedAt ? new Date(trade.executedAt) : null,
            }).onDuplicateKeyUpdate({
              // Bei Duplikat: nur resolvedTicker aktualisieren (falls inzwischen aufgelöst)
              set: { resolvedTicker },
            });
            inserted++;
          } catch {
            // Duplikat oder anderer Fehler — still ignorieren
          }
        }

        // 5. lastTradesSyncAt aktualisieren
        await db
          .update(wikifolios)
          .set({ lastTradesSyncAt: new Date() })
          .where(eq(wikifolios.id, wiki.id));

        newTrades += inserted;
        synced++;
        console.log(`[wikifolioSyncCron] ${wiki.symbol}: ${rawTrades.length} trades fetched, ${inserted} new`);
      } catch (err: any) {
        const msg = `${wiki.symbol}: ${err?.message ?? "Unknown error"}`;
        errors.push(msg);
        console.warn(`[wikifolioSyncCron] Error for ${wiki.symbol}:`, err?.message);
      }
    }

    console.log(`[wikifolioSyncCron] Done: ${synced} wikifolios synced, ${newTrades} new trades, ${errors.length} errors`);
    return { synced, newTrades, errors };
  } catch (err) {
    console.error("[wikifolioSyncCron] Fatal error:", err);
    return { synced, newTrades, errors: [...errors, String(err)] };
  } finally {
    isSyncing = false;
  }
}

/**
 * Initialize the wikifolio sync cron (runs daily at 03:00 UTC).
 */
export function initWikifolioSyncCron(): void {
  // Erste Ausführung: 5 Minuten nach Server-Start (damit Auth-Session aufgebaut ist)
  setTimeout(() => {
    syncWikifolioTrades().catch((e) =>
      console.error("[wikifolioSyncCron] Initial run failed:", e)
    );
  }, 5 * 60 * 1000);

  // Täglich um 03:00 UTC
  const DAILY_MS = 24 * 60 * 60 * 1000;
  const now = new Date();
  const next3am = new Date(now);
  next3am.setUTCHours(3, 0, 0, 0);
  if (next3am <= now) next3am.setUTCDate(next3am.getUTCDate() + 1);
  const msUntil3am = next3am.getTime() - now.getTime();

  setTimeout(() => {
    syncWikifolioTrades().catch((e) =>
      console.error("[wikifolioSyncCron] Scheduled run failed:", e)
    );
    setInterval(() => {
      syncWikifolioTrades().catch((e) =>
        console.error("[wikifolioSyncCron] Scheduled run failed:", e)
      );
    }, DAILY_MS);
  }, msUntil3am);

  console.log(
    `[wikifolioSyncCron] Initialized (daily at 03:00 UTC, first scheduled in ${Math.round(msUntil3am / 3600000)}h)`
  );
}
