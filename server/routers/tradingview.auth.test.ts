import { describe, expect, it } from "vitest";
import { tradingviewRouter } from "./tradingview";

describe("TradingView-Analysezugriff", () => {
  it("weist anonyme Aufrufe ab, bevor ein Upstream-Tool initialisiert wird", async () => {
    const caller = tradingviewRouter.createCaller({ user: null, req: {} as never, res: {} as never });

    await expect(caller.status()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.stockScoring({ symbol: "MSFT" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
