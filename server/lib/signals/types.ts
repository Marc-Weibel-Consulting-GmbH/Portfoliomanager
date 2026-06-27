/**
 * Signal Framework — Shared TypeScript Interfaces
 *
 * All types used across regimeEngine, signalEngines, modelSelector,
 * riskOverlayEngine and signalOrchestrator are defined here.
 *
 * Design principles:
 * - Every engine returns rationale[] strings for auditability.
 * - No magic numbers: all thresholds are documented constants.
 * - Defensive: all optional fields are explicitly typed as | null.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Market Regime
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 6-stufige Marktregime-Klassifikation.
 * Erweiterung der bestehenden 3-stufigen Logik in marketRegimeRouter.
 */
export type MarketRegime =
  | "bull_trend"        // Starker Aufwärtstrend, moderate Volatilität
  | "bear_trend"        // Starker Abwärtstrend, erhöhte Volatilität
  | "sideways_low_vol"  // Seitwärtsbewegung, niedrige Volatilität
  | "sideways_high_vol" // Seitwärtsbewegung, hohe Volatilität (Unsicherheit)
  | "crisis"            // Hoher Drawdown + Volatilitätssprung (Crash)
  | "recovery";         // Erholung nach Krise (Drawdown noch hoch, Trend dreht)

export type MarketType =
  | "equity_index"
  | "single_stock"
  | "etf"
  | "fx"
  | "rates"
  | "crypto";

/**
 * Regime-Features: alle numerischen Werte, die zur Regime-Klassifikation
 * verwendet werden. Alle optional (defensiv bei fehlenden Daten).
 */
export interface RegimeFeatures {
  priceVs50d: number | null;      // (price/SMA50 - 1) in %
  priceVs100d: number | null;     // (price/SMA100 - 1) in %
  priceVs200d: number | null;     // (price/SMA200 - 1) in %
  maSlope50d: number | null;      // SMA50 Steigung (normiert, letzte 10 Tage)
  maSlope200d: number | null;     // SMA200 Steigung (normiert, letzte 10 Tage)
  adx: number | null;             // Average Directional Index [0, 100]
  atrPct: number | null;          // ATR(14) / price in %
  realizedVol20d: number | null;  // Annualisierte 20-Tages-Volatilität
  realizedVol60d: number | null;  // Annualisierte 60-Tages-Volatilität
  drawdown63d: number | null;     // Max Drawdown letzte 63 Tage (negativ)
  lpplRisk: number | null;        // LPPLS BubbleScore [-1, 1]
}

export interface RegimeSnapshot {
  date: string;                   // ISO-8601 Datum
  regime: MarketRegime;
  confidence: number;             // [0, 1] — Anteil der Regeln, die zutreffen
  features: RegimeFeatures;
  rationale: string[];            // Erklärung der Klassifikation
}

// ─────────────────────────────────────────────────────────────────────────────
// Signal Engines
// ─────────────────────────────────────────────────────────────────────────────

export type SignalEngineType = "trend" | "mean_reversion" | "breakout" | "ensemble";

/**
 * Ausgabe einer einzelnen Signal-Engine.
 * Jede Engine muss alle Felder befüllen (defensiv: null wenn nicht berechenbar).
 */
export interface SignalOutput {
  engine: SignalEngineType;
  direction: -1 | 0 | 1;         // -1 = bearish, 0 = neutral, +1 = bullish
  rawScore: number;               // [-1, 1] kontinuierlicher Score
  confidence: number;             // [0, 1] Konfidenz der Schätzung
  entry: boolean;                 // Einstiegssignal
  exit: boolean;                  // Ausstiegssignal
  stopLossPct: number | null;     // Empfohlener Stop-Loss in %
  takeProfitPct: number | null;   // Empfohlenes Take-Profit in %
  trailingStopPct: number | null; // Empfohlener Trailing-Stop in %
  holdingPeriodHint: number | null; // Empfohlene Haltedauer in Tagen
  rationale: string[];            // Erklärung des Signals
}

// ─────────────────────────────────────────────────────────────────────────────
// Model Selector
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bewertungsmetriken für eine Signal-Engine in einem bestimmten Regime.
 * In V1 werden diese aus dem aktuellen Signal-Output geschätzt.
 * In V2 werden sie aus historischen Walk-Forward-Backtests befüllt.
 */
export interface ModelEvaluation {
  engine: SignalEngineType;
  regime: MarketRegime;
  // Backtest-Metriken (V1: geschätzt aus Signal-Konfidenz; V2: historisch)
  sharpe: number;
  sortino: number;
  calmar: number;
  profitFactor: number;
  stabilityScore: number;         // Std der Sharpe über 3 Subperioden [0, 1]
  walkForwardScore: number;       // OOS/IS Ratio [0, 1]; 1 = kein Overfitting
  costResilience: number;         // Sharpe nach 0.5% Transaktionskosten [0, 1]
  turnoverPenalty: number;        // Normierter Turnover [0, 1]; 1 = täglich
  /**
   * Gewichtete Gesamtbewertung (zentral dokumentiert):
   * totalScore =
   *   0.20 × sharpe + 0.15 × sortino + 0.15 × calmar
   * + 0.10 × profitFactor + 0.10 × stabilityScore
   * + 0.10 × walkForwardScore + 0.10 × costResilience
   * - 0.10 × turnoverPenalty
   */
  totalScore: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Risk Overlay
// ─────────────────────────────────────────────────────────────────────────────

export type RiskDecision = "allow" | "reduce" | "block" | "hedge";

/**
 * Internes Risk-Overlay-Ergebnis (für riskOverlayEngine.ts).
 * Enthält Dämpfungsfaktor, Entry-Block und Volatitätsanpassung.
 */
export interface RiskOverlay {
  dampingFactor: number;           // [0, 1] — 1 = kein Dämpfen
  blockEntry: boolean;             // true = kein neuer Einstieg
  volAdjustment: number;           // Multiplikator für Stop-Loss/Take-Profit
  lpplBubbleScore?: number;        // Weitergabe des LPPLS-Scores
  warnings: string[];              // Menschenlesbare Warnungen
}

export interface RiskOverlayResult {
  decision: RiskDecision;
  convictionMultiplier: number;   // [0, 1] — 1 = volles Signal, 0 = blockiert
  targetExposureMultiplier: number; // [0, 1] — empfohlene Positionsgrösse
  rationale: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Portfolio Action (Orchestrator Output)
// ─────────────────────────────────────────────────────────────────────────────

export type PortfolioActionType =
  | "buy"
  | "add"
  | "hold"
  | "reduce"
  | "sell"
  | "hedge"
  | "rebalance";

/**
 * Finale Portfolio-Empfehlung des signalOrchestrators.
 * Enthält alle Informationen für Audit und Transparenz.
 */
export interface PortfolioAction {
  ticker: string;
  action: PortfolioActionType;
  conviction: number;             // [0, 1] — Stärke der Empfehlung
  rationale: string[];            // Menschenlesbare Begründung
  triggeredBy: string[];          // Welche Engines haben ausgelöst
  regime: MarketRegime;
  regimeConfidence: number;       // [0, 1]
  selectedModel: SignalEngineType; // Welche Engine wurde gewählt
  rawScore: number;               // [-1, 1] vor Risk-Overlay
  adjustedScore: number;          // [-1, 1] nach Risk-Overlay
  targetWeight: number | null;    // Empfohlene Portfolio-Gewichtung [0, 1]
  stopLossPct: number | null;
  takeProfitPct: number | null;
  // Audit-Felder
  regimeFeatures: RegimeFeatures;
  signalOutputs: SignalOutput[];
  riskOverlay: RiskOverlayResult;
  computedAt: string;             // ISO-8601 Timestamp
}

// ─────────────────────────────────────────────────────────────────────────────
// Orchestrator Input
// ─────────────────────────────────────────────────────────────────────────────

export interface OrchestratorInput {
  ticker: string;
  marketType: MarketType;
  prices: number[];               // Chronologisch, mind. 200 Datenpunkte
  dates?: string[];               // Optional: ISO-8601 Daten zu prices[]
  lpplRisk?: number | null;       // Vorberechneter LPPLS BubbleScore [-1, 1]
  qualityScore?: number | null;   // Vorberechneter Quality-Score [0, 100]
  momentumScore?: number | null;  // Vorberechneter Momentum-Score [0, 100]
}
