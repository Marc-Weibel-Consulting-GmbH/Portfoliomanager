export type FullReoptimizationMethod =
  | "max_sharpe"
  | "min_variance"
  | "equal_weight"
  | "max_dividend"
  | "hrp"
  | "min_cvar";

export interface FullReoptimizationCandidate {
  ticker: string;
  currency: string | null;
  currentPrice: number | null;
  sharpeRatio?: number | null;
  volatility?: number | null;
  dividendYield?: number | null;
  signalScore?: number | null;
  signalType?: "buy" | "hold" | "sell" | null;
  dataQualityStatus?: string | null;
  /** Durch die Router-Datenbasis belegte Historienabdeckung für den gewählten Lookback. */
  hasSufficientHistory?: boolean;
  /** Eindeutige Preisdatumswerte nach Kurs-/FX-Validierung, nur für die Datenüberlappungsprüfung. */
  historyDates?: string[];
  isActive: boolean;
  isSleeve?: boolean;
}

export interface CandidateExclusion {
  ticker: string;
  reason: "inactive" | "sleeve" | "invalid_price" | "sell_signal" | "data_gap" | "insufficient_history" | "insufficient_overlap";
}

export interface FullReoptimizationUniverseInput {
  candidates: FullReoptimizationCandidate[];
  method: FullReoptimizationMethod;
  candidateLimit: number;
  minChfWeight?: number;
  maxEquityPositionWeight: number;
}

function normalizedCurrency(currency: string | null | undefined): string {
  return String(currency ?? "").trim().toUpperCase();
}

function candidateScore(candidate: FullReoptimizationCandidate, method: FullReoptimizationMethod): number {
  const signal = candidate.signalScore ?? 0;
  if (method === "max_dividend") return (candidate.dividendYield ?? 0) * 100 + signal / 1000;
  if (method === "min_variance") return -(candidate.volatility ?? Number.POSITIVE_INFINITY) + signal / 1000;
  if (method === "max_sharpe" || method === "hrp") return (candidate.sharpeRatio ?? -Infinity) + signal / 10_000;
  if (method === "min_cvar") return -(candidate.volatility ?? Number.POSITIVE_INFINITY) + signal / 1000;
  return signal;
}

/**
 * Stellt das erweiterte Aktienuniversum einer reinen Vorschau zusammen.
 * Die Funktion trifft keine Anlageentscheidung und verändert keine Daten.
 */
export function selectFullReoptimizationUniverse(
  input: FullReoptimizationUniverseInput,
): { tickers: string[]; requiredChfCandidateCount: number; excluded: CandidateExclusion[]; commonHistoryDateCount: number | null } {
  if (!Number.isInteger(input.candidateLimit) || input.candidateLimit < 2) {
    throw new Error("Die Kandidatenobergrenze muss mindestens zwei Titel erlauben.");
  }
  if (!Number.isFinite(input.maxEquityPositionWeight) || input.maxEquityPositionWeight <= 0 || input.maxEquityPositionWeight > 1) {
    throw new Error("Die Aktien-Positionsobergrenze muss zwischen 0 und 1 liegen.");
  }
  const minChfWeight = input.minChfWeight ?? 0;
  if (!Number.isFinite(minChfWeight) || minChfWeight < 0 || minChfWeight > 1) {
    throw new Error("Das CHF-Ziel muss zwischen 0 und 1 liegen.");
  }

  const excluded: CandidateExclusion[] = [];
  const eligible = input.candidates.filter((candidate) => {
    if (!candidate.isActive) {
      excluded.push({ ticker: candidate.ticker, reason: "inactive" });
      return false;
    }
    if (candidate.isSleeve) {
      excluded.push({ ticker: candidate.ticker, reason: "sleeve" });
      return false;
    }
    if (!Number.isFinite(candidate.currentPrice) || (candidate.currentPrice ?? 0) <= 0) {
      excluded.push({ ticker: candidate.ticker, reason: "invalid_price" });
      return false;
    }
    if (candidate.hasSufficientHistory === false) {
      excluded.push({ ticker: candidate.ticker, reason: "insufficient_history" });
      return false;
    }
    if (candidate.signalType === "sell") {
      excluded.push({ ticker: candidate.ticker, reason: "sell_signal" });
      return false;
    }
    if (String(candidate.dataQualityStatus ?? "").trim().toLowerCase() === "datenlücke") {
      excluded.push({ ticker: candidate.ticker, reason: "data_gap" });
      return false;
    }
    return true;
  });

  const ranked = eligible
    .slice()
    .sort((left, right) => candidateScore(right, input.method) - candidateScore(left, input.method));
  const requiredChfCandidateCount = Math.ceil(minChfWeight / input.maxEquityPositionWeight - 1e-12);
  if (requiredChfCandidateCount > input.candidateLimit) {
    throw new Error("Das CHF-Ziel ist mit der gewählten Positionsobergrenze und Kandidatenobergrenze nicht erreichbar.");
  }

  const selected: FullReoptimizationCandidate[] = [];
  const selectedTickers = new Set<string>();
  let commonHistoryDates: Set<string> | null = null;
  const trySelect = (candidate: FullReoptimizationCandidate): boolean => {
    const candidateDates = candidate.historyDates ? new Set(candidate.historyDates) : null;
    const overlap = commonHistoryDates && candidateDates
      ? new Set(Array.from(commonHistoryDates).filter((date) => candidateDates.has(date)))
      : candidateDates ?? commonHistoryDates;
    // 31 Preiswerte ergeben mindestens 30 Tagesrenditen. Ohne gelieferten
    // Datumsnachweis bleibt der etablierte Legacy-Testvertrag unverändert;
    // der vollständige Router liefert für echte Vorschauen immer Datumswerte.
    if (overlap && overlap.size < 31) {
      excluded.push({ ticker: candidate.ticker, reason: "insufficient_overlap" });
      return false;
    }
    selected.push(candidate);
    selectedTickers.add(candidate.ticker);
    commonHistoryDates = overlap;
    return true;
  };
  const chfCandidates = ranked.filter((candidate) => normalizedCurrency(candidate.currency) === "CHF");
  for (const candidate of chfCandidates) {
    if (selected.length >= requiredChfCandidateCount) break;
    trySelect(candidate);
  }
  if (selected.length < requiredChfCandidateCount) {
    throw new Error("Zu wenig CHF-Aktienkandidaten mit gemeinsamer prüfbarer Kurshistorie, um das gesetzte CHF-Ziel abzubilden.");
  }
  for (const candidate of ranked) {
    if (selected.length >= input.candidateLimit) break;
    if (selectedTickers.has(candidate.ticker)) continue;
    trySelect(candidate);
  }

  return {
    tickers: selected.map((candidate) => candidate.ticker),
    requiredChfCandidateCount,
    excluded,
    commonHistoryDateCount: commonHistoryDates?.size ?? null,
  };
}
