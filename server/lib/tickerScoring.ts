/**
 * Ticker-Scoring aus Kursreihen (Konzept F4).
 *
 * Kombinierter Score aus Momentum + Qualität − LPPL-Malus — identisch zur
 * Logik in dashboardRouter.getScoringWatchlist, hier als wiederverwendbarer
 * Helfer für die automatische Portfolio-Zusammenstellung. DB-only (keine
 * Fundamentaldaten → Qualität degradiert graziös auf C; Momentum + LPPL aus
 * den historicalPrices bleiben belastbar). Kein Yahoo (in Prod blockiert).
 */

export interface TickerScore {
  combinedScore: number; // 0..100
  overallGrade: "A" | "B" | "C" | "D" | "F";
  signal: "STRONG BUY" | "BUY" | "HOLD" | "SELL" | "STRONG SELL";
  momentumGrade: string;
  qualityGrade: string;
  regime: string;
}

/**
 * Score aus einer bereinigten Kursreihe (aufsteigend). Braucht ≥ 60 Punkte für Momentum/LPPL.
 * P3: Momentum-/Qualitätsgewicht optional (aus dem Anlageprofil-Horizont); Default 0.4/0.4
 * → Standardverhalten unverändert.
 */
export async function scoreFromPrices(
  prices: number[],
  weights: { momentum: number; quality: number } = { momentum: 0.4, quality: 0.4 },
): Promise<TickerScore> {
  const { calculateQualityScore, calculateMomentumScore } = await import("../analytics/qualityMomentumEngine");
  const { detectBubble } = await import("../analytics/lpplsEngine");

  let momentumResult: any = { score: 0, grade: "C", trend: "neutral" };
  if (prices.length >= 60) {
    try { momentumResult = calculateMomentumScore({ prices }); } catch { /* neutral */ }
  }
  let qualityResult: any = { score: 0, grade: "C" };
  // Keine Fundamentaldaten in der DB → leeres Metrik-Objekt (Qualität degradiert auf C).
  const qualityMetrics: any = {};
  try { qualityResult = calculateQualityScore(qualityMetrics); } catch { /* neutral */ }

  let bubbleScore = 0, bubbleRegime = "normal";
  if (prices.length >= 60) {
    try { const b = detectBubble({ prices }); bubbleScore = b.bubbleScore ?? 0; bubbleRegime = b.regime ?? "normal"; } catch { /* normal */ }
  }

  const mNorm = (momentumResult.score + 1) / 2;
  const qNorm = (qualityResult.score + 1) / 2;
  const lpplPenalty = bubbleRegime === "bubble" ? bubbleScore * 0.5 : 0;
  const combined = Math.max(0, Math.min(1, weights.momentum * mNorm + weights.quality * qNorm - lpplPenalty));
  const score = parseFloat((combined * 100).toFixed(1));

  return {
    combinedScore: score,
    overallGrade: combined >= 0.75 ? "A" : combined >= 0.6 ? "B" : combined >= 0.45 ? "C" : combined >= 0.3 ? "D" : "F",
    signal: combined >= 0.7 ? "STRONG BUY" : combined >= 0.55 ? "BUY" : combined >= 0.45 ? "HOLD" : combined >= 0.3 ? "SELL" : "STRONG SELL",
    momentumGrade: momentumResult.grade,
    qualityGrade: qualityResult.grade,
    regime: bubbleRegime,
  };
}
