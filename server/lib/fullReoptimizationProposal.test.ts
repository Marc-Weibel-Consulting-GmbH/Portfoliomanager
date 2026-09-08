import { describe, expect, it } from "vitest";
import {
  buildAssetAllocationPreservingEquityProposal,
  type ExistingPortfolioPosition,
} from "./fullReoptimizationProposal";

describe("buildAssetAllocationPreservingEquityProposal", () => {
  const currentPositions: ExistingPortfolioPosition[] = [
    { ticker: "AAA.US", weightPct: 24, assetKind: "equity" },
    { ticker: "BBB.US", weightPct: 16, assetKind: "equity" },
    { ticker: "BOND.SW", weightPct: 45, assetKind: "sleeve", assetClass: "Obligationen" },
    { ticker: "GOLD.SW", weightPct: 5, assetKind: "sleeve", assetClass: "Gold" },
  ];

  it("optimiert ausschliesslich den bestehenden Aktienanteil und bewahrt Cash sowie Sleeves", () => {
    const proposal = buildAssetAllocationPreservingEquityProposal({
      currentPositions,
      cashWeightPct: 10,
      optimizedEquityWeights: {
        "CHF.US": 0.6,
        "NEW.US": 0.4,
      },
    });

    expect(proposal.equityBudgetPct).toBeCloseTo(40, 10);
    expect(proposal.cashWeightPct).toBeCloseTo(10, 10);
    expect(proposal.fixedSleeveWeightPct).toBeCloseTo(50, 10);
    expect(proposal.positions).toEqual([
      expect.objectContaining({ ticker: "BOND.SW", weightPct: 45, assetKind: "sleeve" }),
      expect.objectContaining({ ticker: "GOLD.SW", weightPct: 5, assetKind: "sleeve" }),
      expect.objectContaining({ ticker: "CHF.US", weightPct: 24, assetKind: "equity" }),
      expect.objectContaining({ ticker: "NEW.US", weightPct: 16, assetKind: "equity" }),
    ]);
    expect(proposal.positions.reduce((sum, position) => sum + position.weightPct, 0)).toBeCloseTo(90, 10);
    expect(proposal.totalWeightPct).toBeCloseTo(100, 10);
  });

  it("lehnt eine Kapitalbasis ab, wenn Cash und unveränderte Sleeves den Aktienanteil übersteigen", () => {
    expect(() =>
      buildAssetAllocationPreservingEquityProposal({
        currentPositions: [
          { ticker: "BOND.SW", weightPct: 70, assetKind: "sleeve" },
          { ticker: "GOLD.SW", weightPct: 25, assetKind: "sleeve" },
        ],
        cashWeightPct: 10,
        optimizedEquityWeights: { "NEW.US": 1 },
      }),
    ).toThrow(/Kapitalbasis/i);
  });
});
