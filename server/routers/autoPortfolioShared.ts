/**
 * Geteilte Bausteine des Auto-Portfolio-Routers: Job-Registry (Async-Proposal-
 * Muster) und Multi-Asset-Sleeve-Hilfsfunktionen.
 *
 * Aus autoPortfolioRouter.ts ausgelagert (reine Dateigrössen-Aufteilung,
 * keine Verhaltensänderung). Wird von autoPortfolioRouter.ts (buildProposal)
 * und autoPortfolioJobs.ts (startProposal/getProposalStatus) importiert.
 */

// ── In-memory proposal job registry ──────────────────────────────────────────
// Stores running/completed proposal jobs per user. TTL: 30 minutes.
export type ProposalJobStatus = 'running' | 'enhancing' | 'done' | 'error';
export interface ProposalJob {
  status: ProposalJobStatus;
  progress: string[];
  result: any | null;
  error: string | null;
  userId: number;
  startedAt: number;
}
export const proposalJobs = new Map<string, ProposalJob>();
export const PROPOSAL_JOB_TTL_MS = 30 * 60 * 1000; // 30 minutes

/** Anzeigenamen der Multi-Asset-Anlageklassen (Prompts/Response). */
export const SLEEVE_CLASS_LABELS: Record<string, string> = {
  equity: "Aktien",
  bond: "Obligationen",
  commodity: "Rohstoffe",
  gold: "Gold",
  realestate: "Immobilien",
  crypto: "Krypto",
};

/** Allokation als Prompt-/Anzeige-String, z. B. "Aktien 55%, Obligationen 25%". */
export function formatSleeveAllocation(allocation: Record<string, number> | null | undefined): string {
  if (!allocation) return "Aktien 100%";
  const parts = Object.entries(allocation)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${SLEEVE_CLASS_LABELS[k] ?? k} ${v}%`);
  return parts.length > 0 ? parts.join(", ") : "Aktien 100%";
}

// Cleanup expired jobs every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, job] of proposalJobs.entries()) {
    if (now - job.startedAt > PROPOSAL_JOB_TTL_MS) {
      proposalJobs.delete(id);
    }
  }
}, 10 * 60 * 1000);
