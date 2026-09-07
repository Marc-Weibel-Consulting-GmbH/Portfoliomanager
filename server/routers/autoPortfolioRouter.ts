import { protectedProcedure, router } from "../_core/trpc";
import { startProposalProcedure, getProposalStatusProcedure } from "./autoPortfolioJobs";
import { DIVIDEND_QUALITY_10Y_FEATURE_FLAG, DIVIDEND_QUALITY_10Y_DEFAULT_ENABLED } from "../lib/dividendQualityObjective";

export const autoPortfolioRouter = router({
  // K4 (Vorab-Schnitt): Der alte `buildProposal`-Pfad — ein zweiter, kompletter
  // Vorschlags-Rechenweg mit eigener Sleeve-Zumischung und eigenem
  // stocksOnly-Default — ist entfernt. Kein Client rief ihn mehr auf; der
  // einzige Vorschlagsweg ist startProposal (autoPortfolioJobs).

  startProposal: startProposalProcedure,
  getProposalStatus: getProposalStatusProcedure,

  /**
   * Read-only capability contract for intentionally gated experimental
   * proposal objectives. The client cannot activate a flag through this route.
   */
  objectives: protectedProcedure.query(() => ({
    dividendQuality10y: {
      enabled: process.env[DIVIDEND_QUALITY_10Y_FEATURE_FLAG] === "true",
      defaultEnabled: DIVIDEND_QUALITY_10Y_DEFAULT_ENABLED,
      featureFlag: DIVIDEND_QUALITY_10Y_FEATURE_FLAG,
      requiredHistoryYears: 10,
      description: "Dividendenqualität mit Max-Sharpe-Ziel und historischem Drawdown-Soft-Constraint; nur mit belegter 10-Jahres-Kurshistorie.",
    },
  })),

  // Der frühere LLM-Endpoint `generatePortfolio` und der alte
  // `buildProposal`-Zweitpfad sind entfernt — der einzige Vorschlagsweg ist
  // startProposal (deterministisch + Wächter + Challenge-Layer).
});
