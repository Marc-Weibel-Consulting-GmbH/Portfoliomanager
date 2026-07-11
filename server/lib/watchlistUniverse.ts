/**
 * F-13: user-facing stock universe (/aktien) filter.
 *
 * The universe shows ONLY listType='empfehlung' rows.
 * Titles in the Watchlist (listType='watchlist') are for internal observation
 * only and do not appear in the public /aktien list.
 *
 * Admin can toggle any title between 'watchlist' and 'empfehlung' via the
 * Switch in Admin → Aktienliste & Watchlist.
 */
/**
 * Always returns 'empfehlung' — no fallback to all-active rows.
 */
export function universeListType(_count: number): "empfehlung" {
  return "empfehlung";
}

/**
 * Returns 'empfehlung' unconditionally so the invest filter always restricts
 * to curated recommendations.
 */
export async function getUniverseListTypeFilter(_db: any): Promise<"empfehlung"> {
  return "empfehlung";
}
