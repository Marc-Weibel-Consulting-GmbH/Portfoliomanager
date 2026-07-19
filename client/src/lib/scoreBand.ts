// Score-Bänder (0–100 → Label) für die UI. Spiegelt server/lib/portfolioQualityScore.ts
// (SCORE_BANDS) — Quelle der Wahrheit ist der Server; hier nur zur Anzeige.
export interface ScoreBand {
  min: number;
  label: string;
  color: string; // Hex
}

export const SCORE_BANDS: ScoreBand[] = [
  { min: 80, label: "Exzellent", color: "#00CFC1" },
  { min: 60, label: "Solide", color: "#4ade80" },
  { min: 40, label: "Ausbaufähig", color: "#fbbf24" },
  { min: 0, label: "Kritisch", color: "#f87171" },
];

/** Ordnet einen Score (0–100) einem Band mit Label + Farbe zu. */
export function getScoreBand(score: number): ScoreBand {
  return SCORE_BANDS.find((b) => score >= b.min) ?? SCORE_BANDS[SCORE_BANDS.length - 1];
}
