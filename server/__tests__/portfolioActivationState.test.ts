import { describe, expect, it } from "vitest";
import { buildPortfolioActivationUpdates } from "../db";

describe("buildPortfolioActivationUpdates", () => {
  it("sets both the lifecycle and portfolio type to live", () => {
    const updates = buildPortfolioActivationUpdates("10000", "SMI");

    expect(updates).toMatchObject({
      status: "live",
      portfolioType: "live",
      isLive: 1,
      startCapital: "10000",
      benchmark: "SMI",
    });
  });
});
