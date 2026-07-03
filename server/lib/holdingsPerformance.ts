/**
 * Holdings Performance — point-in-time cost basis / unrealized gains per holding.
 *
 * Extracted verbatim from the retired legacy engine
 * (server/performanceCalculations.ts, deleted in D-01 Phase 5.1): this is the
 * one function of that module that was still correct and heavily used — it is
 * a pure point-in-time calculation (no price history involved), so the R-04
 * "past dates valued with current prices" defect never applied to it.
 *
 * Behavior is pinned by CT-6 (server/__characterization__/
 * ct6-holdingsPerformance.char.test.ts), including the known edge cases:
 * - R-20: oversell flips the cost basis negative and the position is silently
 *   dropped (shares <= 0) instead of validated.
 * - R-06-Klasse: the replay is input-order dependent (DESC input yields
 *   different holdings than chronological ASC input).
 * - R-27: cost basis 0 shows "0 % gain" instead of "n/a".
 */

import { PortfolioTransaction } from "../../drizzle/schema";
import { getGrossAmountCHF, getFeesCHF } from "./transactionSemantics";

export interface HoldingPerformance {
  ticker: string;
  shares: number;
  avgCostBasis: number; // Average purchase price per share in CHF
  currentPrice: number; // Current price per share in CHF
  currentValue: number; // Current value in CHF
  unrealizedGain: number; // Unrealized gain/loss in CHF
  unrealizedGainPercent: number; // Unrealized gain/loss as percentage
  totalInvested: number; // Total amount invested in this position
}

/**
 * Calculate current holdings and their performance
 * @param transactions All transactions for the portfolio
 * @param currentPrices Map of ticker to current price
 * @returns Array of holding performance data
 */
export function calculateHoldingsPerformance(
  transactions: PortfolioTransaction[],
  currentPrices: Map<string, number>
): HoldingPerformance[] {
  // Group transactions by ticker
  const holdingsMap = new Map<string, {
    shares: number;
    totalCost: number; // Total amount invested (in CHF)
    ticker: string;
  }>();

  for (const tx of transactions) {
    if (!tx.ticker) continue;

    const ticker = tx.ticker;
    const holding = holdingsMap.get(ticker) || { shares: 0, totalCost: 0, ticker };

    const shares = parseFloat(tx.shares || "0");
    // Kanonische Semantik (R-02): totalAmountCHF = Brutto EXKL. Fees,
    // Kostenbasis = Brutto + Fees (siehe lib/transactionSemantics.ts).
    const totalAmountCHF = getGrossAmountCHF(tx);
    const fees = getFeesCHF(tx);

    if (tx.transactionType === "buy") {
      holding.shares += shares;
      holding.totalCost += totalAmountCHF + fees;
    } else if (tx.transactionType === "sell") {
      // For sells, reduce shares and proportionally reduce cost basis
      if (holding.shares > 0) {
        const sellRatio = shares / holding.shares;
        holding.totalCost -= holding.totalCost * sellRatio;
        holding.shares -= shares;
      }
    }

    holdingsMap.set(ticker, holding);
  }

  // Calculate performance for each holding
  const holdings: HoldingPerformance[] = [];

  for (const [ticker, holding] of Array.from(holdingsMap.entries())) {
    if (holding.shares <= 0) continue; // Skip closed positions

    const currentPrice = currentPrices.get(ticker) || 0;
    const currentValue = holding.shares * currentPrice;
    const avgCostBasis = holding.shares > 0 ? holding.totalCost / holding.shares : 0;
    const unrealizedGain = currentValue - holding.totalCost;
    const unrealizedGainPercent = holding.totalCost > 0
      ? (unrealizedGain / holding.totalCost) * 100
      : 0;

    holdings.push({
      ticker,
      shares: holding.shares,
      avgCostBasis,
      currentPrice,
      currentValue,
      unrealizedGain,
      unrealizedGainPercent,
      totalInvested: holding.totalCost,
    });
  }

  return holdings;
}
