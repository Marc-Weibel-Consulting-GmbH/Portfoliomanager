export type PortfolioAllocationScope = 'profile_mix' | 'stocks_only';

export interface AssetClassTargetsLike {
  targets: Record<string, number>;
  tolerancePct: number;
  isDefaultProfile: boolean;
}

export interface PresentationRule {
  id: string;
  passed: boolean;
}

/**
 * Eine explizite Aktienstrategie ist eine bewusste Abweichung vom allgemeinen
 * Anlegerprofil. Nicht gewählte Klassen sind deshalb weder Lücke noch Warnung.
 */
export function getAssetClassTargetsForScope<T extends AssetClassTargetsLike>(
  targets: T | undefined,
  scope: PortfolioAllocationScope,
): T | undefined {
  return scope === 'stocks_only' ? undefined : targets;
}

/** Die Kurzansicht zeigt nur echte Prüfaufgaben; der vollständige Audit bleibt optional. */
export function getVisibleDiversificationRules<T extends PresentationRule>(
  rules: T[],
  showAll: boolean,
): T[] {
  return showAll ? rules : rules.filter((rule) => !rule.passed);
}

export function getPortfolioAllocationScope(rawPortfolioData: unknown): PortfolioAllocationScope {
  if (!rawPortfolioData) return 'profile_mix';
  try {
    const parsed = typeof rawPortfolioData === 'string' ? JSON.parse(rawPortfolioData) : rawPortfolioData;
    return parsed?.allocationScope === 'stocks_only' ? 'stocks_only' : 'profile_mix';
  } catch {
    return 'profile_mix';
  }
}
