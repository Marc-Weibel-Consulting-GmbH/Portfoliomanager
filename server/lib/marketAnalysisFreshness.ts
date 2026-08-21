/** Marktanalysen älter als 36 Stunden sind für eine tagesaktuelle Darstellung nicht mehr verwendbar. */
export const MARKET_ANALYSIS_MAX_AGE_MS = 36 * 60 * 60 * 1000;

export function isFreshMarketAnalysis(
  analysis: { generatedAt: Date | string | null | undefined },
  now = new Date()
): boolean {
  if (!analysis.generatedAt) return false;
  const generatedAt = new Date(analysis.generatedAt);
  const timestamp = generatedAt.getTime();
  return Number.isFinite(timestamp) && timestamp <= now.getTime() && now.getTime() - timestamp <= MARKET_ANALYSIS_MAX_AGE_MS;
}
