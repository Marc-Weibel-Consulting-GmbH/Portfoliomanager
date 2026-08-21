import { describe, expect, it, vi } from "vitest";
import { invalidatePortfolioDetailCache } from "./portfolioDetailCache";

describe("invalidatePortfolioDetailCache", () => {
  it("verwirft den benutzerspezifischen Detailcache nach einer Transaktion", async () => {
    const cacheDel = vi.fn().mockResolvedValue(undefined);

    await invalidatePortfolioDetailCache(cacheDel, 3570001, 42);

    expect(cacheDel).toHaveBeenCalledWith("portfolio:detail:3570001:42");
  });
});
