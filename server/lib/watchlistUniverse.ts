/**
 * F-13: user-facing stock universe (/aktien) filter.
 *
 * The universe shows only listType='empfehlung' rows. Existing rows default to
 * 'watchlist', which would empty /aktien until the admin curates — so we fall
 * back to ALL active rows as long as zero 'empfehlung' rows exist (graceful
 * transition; the admin bulk action «Alle aktiven als Empfehlung markieren»
 * migrates in one click).
 */
import { and, count, eq } from "drizzle-orm";
import { watchlistStocks } from "../../drizzle/schema";

/**
 * Pure decision: which listType the user-facing universe should be filtered
 * to, given how many active 'empfehlung' rows exist. Exported for unit tests.
 */
export function universeListType(activeEmpfehlungCount: number): "empfehlung" | null {
  return activeEmpfehlungCount > 0 ? "empfehlung" : null;
}

/**
 * Returns the listType the universe queries must filter on, or null for
 * "no listType filter" (fallback while nothing is marked as Empfehlung yet).
 */
export async function getUniverseListTypeFilter(db: any): Promise<"empfehlung" | null> {
  const rows = await db
    .select({ c: count() })
    .from(watchlistStocks)
    .where(and(eq(watchlistStocks.isActive, 1), eq(watchlistStocks.listType, "empfehlung")));
  return universeListType(rows[0]?.c ?? 0);
}
