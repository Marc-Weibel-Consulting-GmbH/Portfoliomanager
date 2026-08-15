import { describe, expect, it } from "vitest";
import { stocksRouter } from "./stocksRouter";

describe("Aktien-Daily-News", () => {
  it("weist anonyme LLM-Anfragen vor der Generierung ab", async () => {
    const caller = stocksRouter.createCaller({ user: null, req: {} as never, res: {} as never });

    await expect(caller.dailyNews({ ticker: "MSFT", companyName: "Microsoft" }))
      .rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
