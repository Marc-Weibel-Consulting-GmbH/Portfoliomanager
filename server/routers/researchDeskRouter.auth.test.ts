import { describe, expect, it } from "vitest";
import { researchDeskRouter } from "./researchDeskRouter";

function anonymousCaller() {
  return researchDeskRouter.createCaller({
    user: null,
    req: {} as never,
    res: {} as never,
  });
}

describe("researchDeskRouter capital-cycle watchlist authorization", () => {
  it("rejects an anonymous capital-cycle watchlist read before querying research data", async () => {
    await expect(anonymousCaller().capitalCycleWatchlistOverview()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});
