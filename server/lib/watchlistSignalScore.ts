/**
 * SIG-3 (Audit 2026-07): DIE eine Formel für `stocks.signalScore`/`signalType`.
 *
 * Vorher schrieben zwei unvereinbare Formeln in dieselben Spalten:
 *  - watchlistRouter.calculateSignalScore (Optimizer-Gewichte, 50 + score·2.5,
 *    buy ≥ 65 / sell ≤ 35), und
 *  - watchlistAlertsCron (additiv ab 50, admin-konfigurierbar via alertConfig,
 *    buy ≥ 70 / sell ≤ 30).
 * Je nachdem, welcher Job zuletzt lief, kippten Score und Signal desselben
 * Titels. Kanonisch ist jetzt die admin-konfigurierbare additive Formel
 * (Admin → Alarm-Konfiguration); Cron UND Router nutzen dieses Modul.
 *
 * Zusätzlich: calcWilderRSI ersetzt die fehlerhafte RSI im watchlistRouter,
 * die das ÄLTESTE 14-Tage-Fenster eines 30-Tage-Zeitraums mittelte (H5).
 */

export interface AlertScoreConfig {
  peLow: number; peMedium: number; peHigh: number; peVeryHigh: number;
  peLowPoints: number; peMediumPoints: number; peHighPoints: number; peVeryHighPoints: number;
  divHigh: number; divMedium: number;
  divHighPoints: number; divMediumPoints: number;
  week52NearLow: number; week52BelowMid: number; week52NearHigh: number;
  week52NearLowPoints: number; week52BelowMidPoints: number; week52NearHighPoints: number;
  pegVeryLow: number; pegModerate: number; pegHigh: number;
  pegVeryLowPoints: number; pegModeratePoints: number; pegHighPoints: number;
  buyTriggerScore: number; sellTriggerScore: number;
  buyPreviousScoreThreshold: number; sellPreviousScoreThreshold: number;
  scoreChangeTrigger: number;
  /** Mindestabstand in Tagen zwischen zwei Alerts für dieselbe Aktie (0 = kein Cooldown). */
  alertCooldownDays: number;
}

export const DEFAULT_ALERT_SCORE_CONFIG: AlertScoreConfig = {
  peLow: 15, peMedium: 20, peHigh: 40, peVeryHigh: 60,
  peLowPoints: 12, peMediumPoints: 6, peHighPoints: -8, peVeryHighPoints: -15,
  divHigh: 0.04, divMedium: 0.025,
  divHighPoints: 12, divMediumPoints: 6,
  week52NearLow: 0.20, week52BelowMid: 0.35, week52NearHigh: 0.95,
  week52NearLowPoints: 15, week52BelowMidPoints: 8, week52NearHighPoints: -10,
  pegVeryLow: 0.80, pegModerate: 1.20, pegHigh: 3.00,
  pegVeryLowPoints: 12, pegModeratePoints: 5, pegHighPoints: -8,
  buyTriggerScore: 75, sellTriggerScore: 25,
  buyPreviousScoreThreshold: 70, sellPreviousScoreThreshold: 35,
  scoreChangeTrigger: 10,
  alertCooldownDays: 7,
};

/** Admin-Konfiguration aus der alertConfig-Tabelle laden (Fallback: Defaults). */
export async function loadAlertScoreConfig(): Promise<AlertScoreConfig> {
  try {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) return DEFAULT_ALERT_SCORE_CONFIG;
    const { alertConfig: alertConfigTable } = await import("../../drizzle/schema");
    const rows = await db.select().from(alertConfigTable).limit(1);
    const cfg: any = rows.length > 0 ? rows[0] : null;
    if (!cfg) return DEFAULT_ALERT_SCORE_CONFIG;
    const D = DEFAULT_ALERT_SCORE_CONFIG;
    return {
      peLow: parseFloat(cfg.peLow) || D.peLow,
      peMedium: parseFloat(cfg.peMedium) || D.peMedium,
      peHigh: parseFloat(cfg.peHigh) || D.peHigh,
      peVeryHigh: parseFloat(cfg.peVeryHigh) || D.peVeryHigh,
      peLowPoints: cfg.peLowPoints ?? D.peLowPoints,
      peMediumPoints: cfg.peMediumPoints ?? D.peMediumPoints,
      peHighPoints: cfg.peHighPoints ?? D.peHighPoints,
      peVeryHighPoints: cfg.peVeryHighPoints ?? D.peVeryHighPoints,
      divHigh: parseFloat(cfg.divHigh) || D.divHigh,
      divMedium: parseFloat(cfg.divMedium) || D.divMedium,
      divHighPoints: cfg.divHighPoints ?? D.divHighPoints,
      divMediumPoints: cfg.divMediumPoints ?? D.divMediumPoints,
      week52NearLow: parseFloat(cfg.week52NearLow) || D.week52NearLow,
      week52BelowMid: parseFloat(cfg.week52BelowMid) || D.week52BelowMid,
      week52NearHigh: parseFloat(cfg.week52NearHigh) || D.week52NearHigh,
      week52NearLowPoints: cfg.week52NearLowPoints ?? D.week52NearLowPoints,
      week52BelowMidPoints: cfg.week52BelowMidPoints ?? D.week52BelowMidPoints,
      week52NearHighPoints: cfg.week52NearHighPoints ?? D.week52NearHighPoints,
      pegVeryLow: parseFloat(cfg.pegVeryLow) || D.pegVeryLow,
      pegModerate: parseFloat(cfg.pegModerate) || D.pegModerate,
      pegHigh: parseFloat(cfg.pegHigh) || D.pegHigh,
      pegVeryLowPoints: cfg.pegVeryLowPoints ?? D.pegVeryLowPoints,
      pegModeratePoints: cfg.pegModeratePoints ?? D.pegModeratePoints,
      pegHighPoints: cfg.pegHighPoints ?? D.pegHighPoints,
      buyTriggerScore: cfg.buyTriggerScore ?? D.buyTriggerScore,
      sellTriggerScore: cfg.sellTriggerScore ?? D.sellTriggerScore,
      buyPreviousScoreThreshold: cfg.buyPreviousScoreThreshold ?? D.buyPreviousScoreThreshold,
      sellPreviousScoreThreshold: cfg.sellPreviousScoreThreshold ?? D.sellPreviousScoreThreshold,
      scoreChangeTrigger: cfg.scoreChangeTrigger ?? D.scoreChangeTrigger,
      alertCooldownDays: cfg.alertCooldownDays ?? D.alertCooldownDays,
    };
  } catch {
    return DEFAULT_ALERT_SCORE_CONFIG;
  }
}

export interface SignalScoreInput {
  /** Trailing P/E (null, wenn unbekannt). */
  pe: number | null;
  /** Dividendenrendite als BRUCH (0.03 = 3 %), null wenn unbekannt. */
  dividendYieldFraction: number | null;
  /** Position im 52-Wochen-Band: (Kurs − Tief) / (Hoch − Tief), 0..1, null wenn unbekannt. */
  week52Position: number | null;
  /** PEG-Ratio (null, wenn unbekannt). */
  peg: number | null;
}

export interface SignalScoreResult {
  score: number;
  signalType: "buy" | "sell" | "hold";
  reasons: string[];
}

/** Additive Score-Formel ab Basis 50 (identisch zur bisherigen Cron-Logik). */
export function computeWatchlistSignalScore(
  input: SignalScoreInput,
  C: AlertScoreConfig = DEFAULT_ALERT_SCORE_CONFIG
): SignalScoreResult {
  let signalScore = 50;
  const reasons: string[] = [];
  const { pe, dividendYieldFraction: divYield, week52Position: position, peg } = input;

  if (pe && pe < C.peLow) { signalScore += C.peLowPoints; reasons.push(`Niedriges P/E (${pe.toFixed(1)})`); }
  else if (pe && pe < C.peMedium) { signalScore += C.peMediumPoints; reasons.push(`Moderates P/E (${pe.toFixed(1)})`); }
  else if (pe && pe > C.peVeryHigh) { signalScore += C.peVeryHighPoints; reasons.push(`Sehr hohes P/E (${pe.toFixed(1)})`); }
  else if (pe && pe > C.peHigh) { signalScore += C.peHighPoints; reasons.push(`Hohes P/E (${pe.toFixed(1)})`); }

  if (divYield && divYield > C.divHigh) { signalScore += C.divHighPoints; reasons.push(`Hohe Dividende (${(divYield * 100).toFixed(1)}%)`); }
  else if (divYield && divYield > C.divMedium) { signalScore += C.divMediumPoints; reasons.push(`Gute Dividende (${(divYield * 100).toFixed(1)}%)`); }

  if (position !== null && Number.isFinite(position)) {
    if (position < C.week52NearLow) { signalScore += C.week52NearLowPoints; reasons.push(`Nahe 52W-Tief (${(position * 100).toFixed(0)}%)`); }
    else if (position < C.week52BelowMid) { signalScore += C.week52BelowMidPoints; reasons.push(`Unter 52W-Mitte (${(position * 100).toFixed(0)}%)`); }
    else if (position > C.week52NearHigh) { signalScore += C.week52NearHighPoints; reasons.push(`Am 52W-Hoch (${(position * 100).toFixed(0)}%)`); }
  }

  if (peg && peg < C.pegVeryLow) { signalScore += C.pegVeryLowPoints; reasons.push(`PEG sehr niedrig (${peg.toFixed(2)})`); }
  else if (peg && peg < C.pegModerate) { signalScore += C.pegModeratePoints; reasons.push(`PEG moderat (${peg.toFixed(2)})`); }
  else if (peg && peg > C.pegHigh) { signalScore += C.pegHighPoints; reasons.push(`PEG hoch (${peg.toFixed(2)})`); }

  signalScore = Math.max(0, Math.min(100, signalScore));
  const signalType: "buy" | "sell" | "hold" = signalScore >= 70 ? "buy" : signalScore <= 30 ? "sell" : "hold";
  return { score: signalScore, signalType, reasons };
}

/**
 * Wilder-RSI über die LETZTEN `period` Perioden (Standard 14).
 * Ersetzt die H5-fehlerhafte Variante, die das älteste Fenster mittelte.
 * Liefert null bei zu wenig Daten (braucht period + 1 Schlusskurse).
 */
export function calcWilderRSI(closes: number[], period = 14): number | null {
  if (!Array.isArray(closes) || closes.length < period + 1) return null;
  let avgGain = 0;
  let avgLoss = 0;
  // Initiales Mittel über die ersten `period` Differenzen …
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) avgGain += change; else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;
  // … dann Wilder-Glättung bis zum jüngsten Kurs.
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}
