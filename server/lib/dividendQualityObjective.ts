import { normalizeTickerForDb } from '../tickerNormalization';

/**
 * Zusätzlicher, bewusst opt-in-basierter Optimierungsvertrag für
 * dividendenorientierte Vorschläge. Der Vertrag verändert keine Standardstrategie
 * und aktiviert keine Portfoliotransaktion; er beschreibt ausschliesslich die
 * Eingabe für eine einmalig angeforderte Vorschlagsrechnung.
 */
export const DIVIDEND_QUALITY_10Y_FEATURE_FLAG = "FEATURE_DIVIDEND_QUALITY_10Y" as const;
export const DIVIDEND_QUALITY_10Y_DEFAULT_ENABLED = false;
export const DIVIDEND_QUALITY_10Y_LOOKBACK_DAYS = 2520;

export type DividendQualitySelection = "standard" | "dividend_quality_10y";

export interface DividendQualityObjectiveInput {
  investmentGoal: string | null | undefined;
  selection?: DividendQualitySelection;
}

export interface DividendQualityObjective {
  id: DividendQualitySelection;
  label: string;
  method: "max_dividend" | "max_sharpe";
  lookbackDays: number;
  requiresTenYearHistory: boolean;
  userConstraints?: {
    minDividendYield: number;
    minSharpe: number;
    /** Positiver Verlustbetrag, z. B. 0.25 = maximal -25 %. */
    maxDrawdown: number;
  };
}

const STANDARD_OBJECTIVE: DividendQualityObjective = {
  id: "standard",
  label: "Dividendenfokus",
  method: "max_dividend",
  lookbackDays: 1260,
  requiresTenYearHistory: false,
};

const DIVIDEND_QUALITY_10Y_OBJECTIVE: DividendQualityObjective = {
  id: "dividend_quality_10y",
  label: "Dividenden + risikoadjustierte Qualität (10 Jahre)",
  method: "max_sharpe",
  lookbackDays: DIVIDEND_QUALITY_10Y_LOOKBACK_DAYS,
  requiresTenYearHistory: true,
  userConstraints: {
    minDividendYield: 0.025,
    minSharpe: 0.5,
    maxDrawdown: 0.25,
  },
};

/**
 * Liefert nur bei expliziter Auswahl UND Dividendenziel den erweiterten Vertrag.
 * Alle anderen Fälle behalten den bestehenden Fünfjahres-Dividendenmodus.
 */
export function resolveDividendQualityObjective(input: DividendQualityObjectiveInput): DividendQualityObjective {
  if (input.investmentGoal === "dividends" && input.selection === "dividend_quality_10y") {
    return DIVIDEND_QUALITY_10Y_OBJECTIVE;
  }
  return STANDARD_OBJECTIVE;
}

/** Zehn Kalenderjahre rückwärts, Leap-Day sicher und unabhängig von Handelstagen. */
export function tenYearHistoryCutoff(asOf: Date): string {
  const cutoff = new Date(asOf);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 10);
  return cutoff.toISOString().slice(0, 10);
}

/**
 * Ein Titel erfüllt das Gate nur, wenn eine gespeicherte Kursbeobachtung am oder
 * vor dem exakten Kalenderstichtag vorliegt. Eine spätere Beobachtung wird nie
 * stillschweigend als zehnjährige Historie dargestellt.
 */
export function hasTenYearPriceHistory(firstObservedDate: string | null | undefined, asOf = new Date()): boolean {
  if (!firstObservedDate || !/^\d{4}-\d{2}-\d{2}$/.test(firstObservedDate)) return false;
  return firstObservedDate <= tenYearHistoryCutoff(asOf);
}

/** Identischer Persistenzschlüssel für Backfill, Datengate und Preisabfrage. */
export function historicalPriceKeyForDividendQuality(ticker: string): string {
  return normalizeTickerForDb(ticker);
}
