/**
 * Wikifolio-Konsens-Signal (Track B5, AI_ALPHA_ROADMAP.md).
 *
 * Aggregiert die Transaktionen erfolgreicher Wikifolios zu einem Signal je Titel:
 * "N erfolgreiche Wikifolios haben Titel X in den letzten M Tagen gekauft/verkauft".
 *
 * Bewusst REIN (keine DB, kein Date.now()) — `asOfMs` wird injiziert, damit die
 * Aggregation deterministisch und unit-testbar bleibt. Das Ergebnis ist EINE
 * gewichtete Quelle im Signal-Aggregat, nicht das Fundament.
 */

export interface ConsensusTradeInput {
  /** Interne wikifolios.id — Basis der Distinct-Zählung (ein Wikifolio zählt je Seite max. 1×). */
  wikifolioId: number;
  resolvedTicker: string | null;
  side: "buy" | "sell" | "other";
  /** ISO-Datum des Trades; ungültige/fehlende Werte werden übersprungen. */
  executedAt: string | null;
  /** Sharpe des Wikifolios — gewichtet die Stimme (erfolgreichere Trader zählen mehr). Optional. */
  sharpe?: number | null;
}

export interface ConsensusResult {
  ticker: string;
  /** Anzahl DISTINCT Wikifolios, die im Fenster gekauft haben. */
  buyWikifolios: number;
  sellWikifolios: number;
  netDirection: "buy" | "sell" | "neutral";
  /** Gewichteter Netto-Score, auf [-100, 100] begrenzt. Positiv = Kauf-Konsens. */
  score: number;
  /** Menschenlesbarer Herkunfts-Hinweis für das UI-Badge. */
  provenance: string;
}

export interface ConsensusOptions {
  /** Betrachtungsfenster in Tagen (Default 30). */
  windowDays?: number;
  /** Bezugszeitpunkt (ms seit Epoch) — injiziert für Determinismus. */
  asOfMs: number;
  /** Mindestanzahl distinct Wikifolios auf der dominanten Seite, damit ein Signal entsteht (Default 2). */
  minWikifolios?: number;
}

/** Sharpe → Stimmgewicht in [0.5, 2]. Fehlender/negativer Sharpe zählt als 1 (neutrale Stimme). */
function voteWeight(sharpe: number | null | undefined): number {
  if (typeof sharpe !== "number" || !Number.isFinite(sharpe) || sharpe <= 0) return 1;
  return Math.min(2, 0.5 + sharpe * 0.75);
}

export function computeWikifolioConsensus(
  trades: ConsensusTradeInput[],
  opts: ConsensusOptions
): ConsensusResult[] {
  const windowDays = opts.windowDays ?? 30;
  const minWikifolios = opts.minWikifolios ?? 2;
  const cutoffMs = opts.asOfMs - windowDays * 86_400_000;

  // ticker → side → Map(wikifolioId → maxVoteWeight). Distinct je Wikifolio; bei
  // mehreren Trades desselben Wikifolios/derselben Seite zählt die stärkste Stimme.
  type SideMap = { buy: Map<number, number>; sell: Map<number, number> };
  const byTicker = new Map<string, SideMap>();

  for (const t of trades) {
    if (!t.resolvedTicker) continue;
    if (t.side !== "buy" && t.side !== "sell") continue;
    if (!t.executedAt) continue;
    const execMs = new Date(t.executedAt).getTime();
    if (!Number.isFinite(execMs)) continue;
    if (execMs < cutoffMs || execMs > opts.asOfMs) continue;

    let entry = byTicker.get(t.resolvedTicker);
    if (!entry) {
      entry = { buy: new Map(), sell: new Map() };
      byTicker.set(t.resolvedTicker, entry);
    }
    const side = entry[t.side];
    const w = voteWeight(t.sharpe);
    const prev = side.get(t.wikifolioId) ?? 0;
    if (w > prev) side.set(t.wikifolioId, w);
  }

  const results: ConsensusResult[] = [];
  for (const [ticker, side] of byTicker) {
    const buyCount = side.buy.size;
    const sellCount = side.sell.size;
    const dominant = Math.max(buyCount, sellCount);
    if (dominant < minWikifolios) continue;

    const buyWeight = sum(side.buy.values());
    const sellWeight = sum(side.sell.values());
    const netWeight = buyWeight - sellWeight;
    // Skalierung: jede gewichtete Netto-Stimme ~ 25 Punkte, gekappt auf ±100.
    const score = Math.max(-100, Math.min(100, Math.round(netWeight * 25)));
    const netDirection: ConsensusResult["netDirection"] =
      score > 0 ? "buy" : score < 0 ? "sell" : "neutral";

    const leadSide = buyCount >= sellCount ? "kauften" : "verkauften";
    const leadCount = Math.max(buyCount, sellCount);
    results.push({
      ticker,
      buyWikifolios: buyCount,
      sellWikifolios: sellCount,
      netDirection,
      score,
      provenance: `Wikifolio-Konsens: ${leadCount} erfolgreiche Wikifolios ${leadSide} in den letzten ${windowDays} Tagen`,
    });
  }

  // Stärkstes Signal (nach |score|) zuerst.
  return results.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
}

function sum(vals: IterableIterator<number>): number {
  let s = 0;
  for (const v of vals) s += v;
  return s;
}
