/**
 * Kuratiertes Aktien-Universum auf der vereinten `stocks`-Tabelle
 * (STOCK_UNIVERSE_MERGE.md, Phase 2).
 *
 * Seit der Zusammenführung enthält `stocks` sowohl das kuratierte Universum
 * (listType = 'empfehlung' | 'watchlist') als auch reine Portfolio-Stammdaten
 * (listType = NULL). Diese Helfer kapseln den Filter, der frühere
 * `watchlistStocks`-Abfragen (die per Definition nur kuratierte Zeilen
 * enthielten) verhaltensgleich reproduziert.
 */
import { and, eq, isNotNull } from "drizzle-orm";
import { stocks } from "../../drizzle/schema";

/** Kuratiert = im Universum (listType gesetzt). Schliesst Portfolio-Stammdaten aus. */
export function curated() {
  return isNotNull(stocks.listType);
}

/** Aktive kuratierte Titel (entspricht dem alten `watchlistStocks.isActive = 1`). */
export function activeCurated() {
  return and(eq(stocks.isActive, 1), isNotNull(stocks.listType));
}
