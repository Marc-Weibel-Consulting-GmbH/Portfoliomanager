/**
 * Gedächtnis-Schleife (Track A2 / P2, AI_ALPHA_ROADMAP.md).
 *
 * Kern des sich selbst verbessernden Signal-Systems: aus dem bereits gemessenen
 * Out-of-Sample-Alpha je Engine × Regime (Tabelle `signal_history`) werden REGIME-
 * ABHÄNGIGE Engine-Gewichte gelernt — Engines mit nachweislich positivem Alpha in einem
 * Regime bekommen dort mehr Gewicht. Mit Shrinkage zu Gleichgewicht bei dünner Datenlage
 * (gegen Überanpassung) und Mindest-Stichprobe, sonst Default-Gleichgewicht.
 *
 * Bewusst REIN und deterministisch (keine DB) — die ausgewerteten Zeilen werden injiziert,
 * damit die Logik unit-testbar ist. Die DB-Anbindung (Lesen aus signal_history, Persistieren
 * der Gewichte, Neukalibrierung bei Regimewechsel) sitzt in der aufrufenden Schicht.
 */

export interface EvaluatedSignalRow {
  engine: string;
  regime: string;
  /** Realisiertes Alpha vs. Benchmark in Prozent (nur ausgewertete Zeilen). */
  alphaPct: number;
}

export interface LearnOptions {
  /**
   * Shrinkage-Konstante k: Gewicht des Regimes-Durchschnitts = n/(n+k). Größeres k =
   * stärkere Zurückhaltung, bis genug Beobachtungen vorliegen. Default 20.
   */
  shrinkageK?: number;
  /** Mindestbeobachtungen je Engine/Regime, sonst volle Rückführung auf Gleichgewicht. Default 5. */
  minSamples?: number;
  /** Untere/obere Schranke je Engine-Gewicht nach Normierung (verhindert 0/Monokultur). */
  minWeight?: number;
  maxWeight?: number;
}

/** regime → (engine → normalisiertes Gewicht, Summe 1). */
export type RegimeEngineWeights = Record<string, Record<string, number>>;

interface Acc {
  n: number;
  sumAlpha: number;
}

/**
 * Lernt regime-abhängige Engine-Gewichte aus ausgewerteten Signalen.
 *
 * Vorgehen je Regime:
 *  1. Mittleres Alpha je Engine (nur Engines mit >= minSamples; sonst neutral).
 *  2. Shrinkage des Engine-Alphas zum Regime-Mittel: adj = λ·mean_engine + (1-λ)·mean_regime,
 *     λ = n/(n+k). Dünne Evidenz zieht Richtung Regime-Durchschnitt.
 *  3. Positives adj-Alpha (über dem Regime-Mittel) → höheres Gewicht; auf [minWeight,maxWeight]
 *     begrenzt und auf Summe 1 normiert.
 */
export function learnRegimeWeights(
  rows: EvaluatedSignalRow[],
  opts: LearnOptions = {}
): RegimeEngineWeights {
  const k = opts.shrinkageK ?? 20;
  const minSamples = opts.minSamples ?? 5;
  const minWeight = opts.minWeight ?? 0.05;
  const maxWeight = opts.maxWeight ?? 0.6;

  // regime → engine → {n, sumAlpha}
  const byRegime = new Map<string, Map<string, Acc>>();
  for (const r of rows) {
    if (!r.engine || !r.regime) continue;
    if (typeof r.alphaPct !== "number" || !Number.isFinite(r.alphaPct)) continue;
    let engines = byRegime.get(r.regime);
    if (!engines) {
      engines = new Map();
      byRegime.set(r.regime, engines);
    }
    const acc = engines.get(r.engine) ?? { n: 0, sumAlpha: 0 };
    acc.n += 1;
    acc.sumAlpha += r.alphaPct;
    engines.set(r.engine, acc);
  }

  const result: RegimeEngineWeights = {};

  for (const [regime, engines] of byRegime) {
    const names = [...engines.keys()];
    // Regime-Mittel über alle Beobachtungen (Baseline für Shrinkage).
    let totalN = 0;
    let totalAlpha = 0;
    for (const acc of engines.values()) {
      totalN += acc.n;
      totalAlpha += acc.sumAlpha;
    }
    const regimeMean = totalN > 0 ? totalAlpha / totalN : 0;

    // Shrinkage-adjustiertes Alpha je Engine.
    const adjusted: Record<string, number> = {};
    for (const name of names) {
      const acc = engines.get(name)!;
      if (acc.n < minSamples) {
        adjusted[name] = regimeMean; // zu wenig Evidenz → neutral (Regime-Mittel)
        continue;
      }
      const engineMean = acc.sumAlpha / acc.n;
      const lambda = acc.n / (acc.n + k);
      adjusted[name] = lambda * engineMean + (1 - lambda) * regimeMean;
    }

    // Score = adjustiertes Alpha über dem Regime-Mittel, auf >= 0 gehoben (relative Stärke).
    const raw: Record<string, number> = {};
    let rawSum = 0;
    for (const name of names) {
      const v = Math.max(0, adjusted[name] - regimeMean) + 0.01; // +Epsilon: keine 0-Gewichte
      raw[name] = v;
      rawSum += v;
    }

    result[regime] =
      rawSum <= 0
        ? Object.fromEntries(names.map((n) => [n, 1 / names.length]))
        : normalizeWithBounds(raw, minWeight, maxWeight);
  }

  return result;
}

/**
 * Proportionale Normierung auf Summe 1 unter Einhaltung von Unter-/Obergrenze je Gewicht
 * (Water-Filling): zuerst Engines an der Obergrenze fixieren, dann an der Untergrenze, den
 * Rest proportional zum Roh-Score verteilen. So bleiben die Schranken hart UND die Summe = 1.
 * Fällt auf Gleichgewicht zurück, falls die Schranken bei n Engines nicht erfüllbar sind.
 */
function normalizeWithBounds(
  raw: Record<string, number>,
  minWeight: number,
  maxWeight: number
): Record<string, number> {
  const names = Object.keys(raw);
  const n = names.length;
  if (n === 0) return {};
  // Erfüllbarkeit prüfen (n·min <= 1 <= n·max); sonst Gleichgewicht.
  if (n * minWeight > 1 + 1e-9 || n * maxWeight < 1 - 1e-9) {
    return Object.fromEntries(names.map((k) => [k, 1 / n]));
  }

  const fixed: Record<string, number> = {};
  let active = [...names];
  let remaining = 1;

  for (let guard = 0; guard < n + 2; guard++) {
    const sumRaw = active.reduce((s, k) => s + raw[k], 0) || 1;
    // 1) Obergrenze verletzt?
    const over = active.filter((k) => (remaining * raw[k]) / sumRaw > maxWeight);
    if (over.length > 0) {
      for (const k of over) {
        fixed[k] = maxWeight;
        remaining -= maxWeight;
      }
      active = active.filter((k) => !over.includes(k));
      continue;
    }
    // 2) Untergrenze verletzt?
    const under = active.filter((k) => (remaining * raw[k]) / sumRaw < minWeight);
    if (under.length > 0) {
      for (const k of under) {
        fixed[k] = minWeight;
        remaining -= minWeight;
      }
      active = active.filter((k) => !under.includes(k));
      continue;
    }
    break;
  }

  const sumRaw = active.reduce((s, k) => s + raw[k], 0) || 1;
  for (const k of active) fixed[k] = (remaining * raw[k]) / sumRaw;
  return fixed;
}
