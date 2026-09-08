import { describe, expect, it, vi } from "vitest";
import { invalidatePortfolioMutationCaches } from "./portfolioMutationCache";

describe("invalidatePortfolioMutationCaches", () => {
  it("verwirft nach einer Positionsänderung den Detail- und Eigentümer-Performancecache", async () => {
    const cacheDel = vi.fn().mockResolvedValue(undefined);
    const invalidatePerformance = vi.fn().mockResolvedValue(undefined);

    await invalidatePortfolioMutationCaches({
      cacheDel,
      invalidatePerformance,
      portfolioId: 4020001,
      userId: 42,
    });

    expect(cacheDel).toHaveBeenCalledWith("portfolio:detail:4020001:42");
    expect(invalidatePerformance).toHaveBeenCalledWith("perf:v2:42");
  });
});
