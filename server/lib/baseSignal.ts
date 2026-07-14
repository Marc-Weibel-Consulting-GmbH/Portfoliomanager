/**
 * Basis-Signal aus Fundamental- und Technik-Indikatoren (SIG-4, Audit 2026-07).
 *
 * EINE gewichtete Basis-Scoring-Funktion für Live-Pfad (signalsRouter.processStock)
 * und Signal-Cache-Cron — vorher hatte der Cron eine eigene, UNGEWICHTETE
 * Inline-Kopie, obwohl er die optimierten Gewichte bereits geladen hatte.
 * Die vom Optimizer getunten Gewichte (optimizerWorker.getActiveWeights)
 * fliessen hier ein; bei Titeln mit genug Historie überstimmt später der
 * kombinierte Momentum+Qualität-Score (blendCombinedScore) das Basis-Signal —
 * das Basis-Signal ist der Fallback für dünne Datenlagen.
 */

import type { WeightConfig } from "../analytics/optimizerWorker";

export type SignalType = "buy" | "sell" | "hold";
export type SignalStrength = "strong" | "moderate" | "weak";

export interface BaseSignal {
  ticker: string;
  companyName: string;
  type: SignalType;
  strength: SignalStrength;
  currentPrice: number;
  targetPrice: number;
  peRatio: number | null;
  pegRatio: number | null;
  dividendYield: number;
  ytdPerformance: number;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  rsi14: number | null;
  reason: string;
  criteria: string[];
}

export function generateSignal(data: {
  ticker: string;
  companyName: string;
  peRatio: number | null;
  pegRatio: number | null;
  dividendYield: number;
  currentPrice: number;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  ytdPerformance: number;
  rsi14: number | null;
}, weights?: WeightConfig): BaseSignal {
  const criteria: string[] = [];
  let score = 0; // Positive = buy, Negative = sell

  // Use optimized weights if available (scale factor to convert 0-0.25 weights to integer scores)
  const WEIGHT_SCALE = 12; // Converts weight (0.05-0.25) to score contribution comparable to old system
  const useWeights = !!weights;

  const {
    ticker, companyName, peRatio, pegRatio, dividendYield,
    currentPrice, fiftyTwoWeekHigh, fiftyTwoWeekLow, ytdPerformance, rsi14
  } = data;

  // ── P/E Ratio analysis ──
  if (peRatio !== null && !isNaN(peRatio) && peRatio > 0) {
    const w = useWeights ? weights!.pe * WEIGHT_SCALE : 1;
    if (peRatio < 12) {
      score += 3 * w;
      criteria.push(`Sehr niedriges P/E (${peRatio.toFixed(1)})`);
    } else if (peRatio < 18) {
      score += 1 * w;
      criteria.push(`Moderates P/E (${peRatio.toFixed(1)})`);
    } else if (peRatio > 35) {
      score -= 2 * w;
      criteria.push(`Hohes P/E (${peRatio.toFixed(1)})`);
    } else if (peRatio > 25) {
      score -= 1 * w;
      criteria.push(`Erhöhtes P/E (${peRatio.toFixed(1)})`);
    }
  }

  // ── PEG Ratio analysis ──
  if (pegRatio !== null && !isNaN(pegRatio) && pegRatio > 0) {
    const w = useWeights ? weights!.peg * WEIGHT_SCALE : 1;
    if (pegRatio < 0.8) {
      score += 2 * w;
      criteria.push(`Sehr attraktives PEG (${pegRatio.toFixed(2)})`);
    } else if (pegRatio < 1.2) {
      score += 1 * w;
      criteria.push(`Faires PEG (${pegRatio.toFixed(2)})`);
    } else if (pegRatio > 2.5) {
      score -= 2 * w;
      criteria.push(`Teures PEG (${pegRatio.toFixed(2)})`);
    } else if (pegRatio > 1.8) {
      score -= 1 * w;
      criteria.push(`Erhöhtes PEG (${pegRatio.toFixed(2)})`);
    }
  }

  // ── Dividend Yield analysis ──
  {
    const w = useWeights ? weights!.dividend * WEIGHT_SCALE : 1;
    if (dividendYield > 5) {
      score += 2 * w;
      criteria.push(`Hohe Dividende (${dividendYield.toFixed(1)}%)`);
    } else if (dividendYield > 3) {
      score += 1 * w;
      criteria.push(`Gute Dividende (${dividendYield.toFixed(1)}%)`);
    }
  }

  // ── YTD Performance analysis (contrarian signals) ──
  if (ytdPerformance !== 0 && !isNaN(ytdPerformance)) {
    const w = useWeights ? weights!.ytd * WEIGHT_SCALE : 1;
    if (ytdPerformance < -25) {
      score += 2 * w;
      criteria.push(`Stark überverkauft YTD (${ytdPerformance.toFixed(1)}%)`);
    } else if (ytdPerformance < -15) {
      score += 1 * w;
      criteria.push(`Deutlich gefallen YTD (${ytdPerformance.toFixed(1)}%)`);
    } else if (ytdPerformance > 50) {
      score -= 2 * w;
      criteria.push(`Stark überkauft YTD (${ytdPerformance.toFixed(1)}%)`);
    } else if (ytdPerformance > 35) {
      score -= 1 * w;
      criteria.push(`Stark gestiegen YTD (${ytdPerformance.toFixed(1)}%)`);
    }
  }

  // ── 52-Week Range analysis ──
  if (fiftyTwoWeekHigh && fiftyTwoWeekLow && currentPrice > 0) {
    const w = useWeights ? weights!.week52 * WEIGHT_SCALE : 1;
    const range = fiftyTwoWeekHigh - fiftyTwoWeekLow;
    if (range > 0) {
      const positionInRange = (currentPrice - fiftyTwoWeekLow) / range;
      if (positionInRange < 0.2) {
        score += 2 * w;
        criteria.push(`Nahe 52W-Tief (${(positionInRange * 100).toFixed(0)}% vom Tief)`);
      } else if (positionInRange < 0.35) {
        score += 1 * w;
        criteria.push(`Untere 52W-Range (${(positionInRange * 100).toFixed(0)}%)`);
      } else if (positionInRange > 0.95) {
        score -= 1 * w;
        criteria.push(`Nahe 52W-Hoch (${(positionInRange * 100).toFixed(0)}%)`);
      }
    }
  }

  // ── RSI analysis ──
  if (rsi14 !== null && !isNaN(rsi14)) {
    const w = useWeights ? weights!.rsi * WEIGHT_SCALE : 1;
    if (rsi14 < 30) {
      score += 2 * w;
      criteria.push(`RSI überverkauft (${rsi14.toFixed(0)})`);
    } else if (rsi14 < 40) {
      score += 1 * w;
      criteria.push(`RSI niedrig (${rsi14.toFixed(0)})`);
    } else if (rsi14 > 75) {
      score -= 2 * w;
      criteria.push(`RSI überkauft (${rsi14.toFixed(0)})`);
    } else if (rsi14 > 65) {
      score -= 1 * w;
      criteria.push(`RSI hoch (${rsi14.toFixed(0)})`);
    }
  }

  // ── Determine signal type and strength ──
  let type: SignalType;
  let strength: SignalStrength;
  let reason: string;
  let targetPrice: number;

  if (score >= 5) {
    type = "buy";
    strength = "strong";
    reason = "Starke Kaufgelegenheit: Mehrere fundamentale und technische Indikatoren deuten auf eine deutliche Unterbewertung hin.";
    targetPrice = currentPrice * 1.20;
  } else if (score >= 3) {
    type = "buy";
    strength = "moderate";
    reason = "Moderate Kaufgelegenheit: Die Bewertung ist attraktiv und einige Indikatoren sprechen für einen Einstieg.";
    targetPrice = currentPrice * 1.12;
  } else if (score >= 1) {
    type = "buy";
    strength = "weak";
    reason = "Leichte Kauftendenz: Einzelne positive Signale vorhanden, aber keine starke Überzeugung.";
    targetPrice = currentPrice * 1.06;
  } else if (score <= -5) {
    type = "sell";
    strength = "strong";
    reason = "Starkes Verkaufssignal: Überbewertung und technische Schwäche deuten auf Korrekturbedarf hin. Gewinnmitnahme empfohlen.";
    targetPrice = currentPrice * 0.85;
  } else if (score <= -3) {
    type = "sell";
    strength = "moderate";
    reason = "Moderates Verkaufssignal: Bewertung erscheint überzogen. Position reduzieren oder eng absichern.";
    targetPrice = currentPrice * 0.92;
  } else if (score <= -1) {
    type = "sell";
    strength = "weak";
    reason = "Leichte Verkaufstendenz: Einige Warnsignale erkennbar. Überwachung empfohlen.";
    targetPrice = currentPrice * 0.96;
  } else {
    type = "hold";
    strength = "moderate";
    reason = "Neutrale Bewertung: Aktuelle Position beibehalten und Entwicklung beobachten.";
    targetPrice = currentPrice;
  }

  return {
    ticker,
    companyName,
    type,
    strength,
    currentPrice,
    targetPrice,
    peRatio,
    pegRatio,
    dividendYield,
    ytdPerformance,
    fiftyTwoWeekHigh,
    fiftyTwoWeekLow,
    rsi14,
    reason,
    criteria,
  };
}
