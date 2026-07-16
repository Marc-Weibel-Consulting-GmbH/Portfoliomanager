/**
 * Bridge zum exakten Mean-Variance-Optimierer des Python-analytics_service
 * (PyPortfolioOpt, POST /analytics/optimize-exact).
 *
 * Arbeitsteilung: die TS-Engine (engine.ts) liefert μ (Black-Litterman-Posterior)
 * und die Ledoit-Wolf-Kovarianz aus CHF-konvertierten, datums-alignierten Renditen
 * — Python löst nur das Optimierungsproblem, dafür exakt (konvexer Solver statt
 * Zufallssuche) und mit optional harten Sektor-Caps.
 *
 * Ehrlichkeits-Grenzen (bewusst):
 *  - Ohne ANALYTICS_SERVICE_URL ist alles inaktiv (null, kein Fehler) — dieselbe
 *    Konvention wie die ML-Pipeline (mlTrainingCron).
 *  - Jeder Abruf ist zeitbegrenzt und non-fatal: bei Fehler/Timeout fällt die
 *    Engine auf die bisherige deterministische Zufallssuche zurück und
 *    kennzeichnet das im Ergebnis (optimizerEngine).
 */

export interface ExactOptimizeParams {
  tickers: string[];
  /** Annualisierte Erwartungsrenditen (Dezimal), Reihenfolge = tickers. */
  mu: number[];
  /** Annualisierte Kovarianzmatrix n×n. */
  cov: number[][];
  riskFreeRate: number;
  /** Effektive (bereits aufgeweitete) Positions-Bounds 0..1. */
  minWeight: number;
  maxWeight: number;
  method: "max_sharpe" | "min_variance";
  sectorByTicker?: Record<string, string>;
  /** Max. Sektorgewicht in Prozent (z. B. 30). */
  maxSectorWeightPct?: number;
}

export interface ExactOptimizeResult {
  /** Gewichte 0..1 je Ticker, Summe ≈ 1. */
  weights: Record<string, number>;
  expectedReturn: number;
  volatility: number;
  sharpe: number;
  sectorConstraintApplied: boolean;
}

const EXACT_TIMEOUT_MS = 15000;

export function isExactOptimizerConfigured(): boolean {
  return !!process.env.ANALYTICS_SERVICE_URL?.trim();
}

/** Exakte Optimierung anfragen; null bei fehlender Konfiguration oder Fehler (non-fatal). */
export async function solveExactWeights(
  params: ExactOptimizeParams
): Promise<ExactOptimizeResult | null> {
  const base = process.env.ANALYTICS_SERVICE_URL?.trim();
  if (!base) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EXACT_TIMEOUT_MS);
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/analytics/optimize-exact`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(params),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.warn(`[exactOptimizer] ${res.status} ${res.statusText}: ${detail.slice(0, 300)}`);
      return null;
    }
    const data = (await res.json()) as Partial<ExactOptimizeResult> & { weights?: unknown };

    // Plausibilisierung: alle Ticker mit finitem Gewicht, Summe ≈ 1 — sonst
    // lieber der bekannte Fallback als ein kaputtes "exaktes" Ergebnis.
    const weights = data.weights as Record<string, number> | undefined;
    if (!weights || typeof weights !== "object") return null;
    let sum = 0;
    for (const t of params.tickers) {
      const w = weights[t];
      if (typeof w !== "number" || !Number.isFinite(w) || w < -1e-6) return null;
      sum += w;
    }
    if (Math.abs(sum - 1) > 0.01) return null;
    if (
      typeof data.expectedReturn !== "number" ||
      typeof data.volatility !== "number" ||
      typeof data.sharpe !== "number"
    ) {
      return null;
    }

    return {
      weights,
      expectedReturn: data.expectedReturn,
      volatility: data.volatility,
      sharpe: data.sharpe,
      sectorConstraintApplied: data.sectorConstraintApplied === true,
    };
  } catch (e: any) {
    console.warn(`[exactOptimizer] nicht erreichbar/fehlgeschlagen: ${e?.message ?? e}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
