import { router } from "../_core/trpc";
import { startProposalProcedure, getProposalStatusProcedure } from "./autoPortfolioJobs";

export const autoPortfolioRouter = router({
  // K4 (Vorab-Schnitt): Der alte `buildProposal`-Pfad — ein zweiter, kompletter
  // Vorschlags-Rechenweg mit eigener Sleeve-Zumischung und eigenem
  // stocksOnly-Default — ist entfernt. Kein Client rief ihn mehr auf; der
  // einzige Vorschlagsweg ist startProposal (autoPortfolioJobs).

  startProposal: startProposalProcedure,
  getProposalStatus: getProposalStatusProcedure,

  // Der frühere LLM-Endpoint `generatePortfolio` und der alte
  // `buildProposal`-Zweitpfad sind entfernt — der einzige Vorschlagsweg ist
  // startProposal (deterministisch + Wächter + Challenge-Layer).
});
