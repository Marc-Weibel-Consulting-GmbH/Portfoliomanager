export type ResearchDeskDecisionImpact = "none" | "score" | "recommendation" | "trade";

export interface ShadowModeContract {
  isShadowMode: boolean;
  decisionImpact: ResearchDeskDecisionImpact;
}

/**
 * Forschungs-Pilotvertrag: Bis zum separaten OOS-Gate dürfen Evidenzen weder
 * Scores noch Empfehlungen oder Handelsentscheidungen beeinflussen.
 */
export function assertShadowModeOnly(contract: ShadowModeContract): ShadowModeContract {
  if (!contract.isShadowMode || contract.decisionImpact !== "none") {
    throw new Error("Research Desk Pilot erlaubt ausschliesslich Shadow-Mode-Evidenz ohne Entscheidungswirkung.");
  }
  return contract;
}

export function buildResearchDeskRunKey(input: {
  runDate: Date;
  universeVersion: string;
  sourceVersion: string;
}): string {
  const date = input.runDate.toISOString().slice(0, 10);
  return `research-desk:${date}:${input.universeVersion}:${input.sourceVersion}`;
}
