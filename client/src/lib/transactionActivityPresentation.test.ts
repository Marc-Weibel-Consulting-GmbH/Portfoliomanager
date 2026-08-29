import { describe, expect, it } from "vitest";
import { getTransactionActivityPresentation } from "./transactionActivityPresentation";

describe("getTransactionActivityPresentation", () => {
  it("kennzeichnet eine Eintrittsbuchung als positiven Anfangsbestand", () => {
    expect(getTransactionActivityPresentation("entry")).toEqual({
      label: "Anfangsbestand",
      tone: "positive",
      sign: "+",
    });
  });

  it("behält die etablierte Kauf- und Verkaufssemantik bei", () => {
    expect(getTransactionActivityPresentation("buy")).toMatchObject({ label: "Kauf", tone: "positive", sign: "+" });
    expect(getTransactionActivityPresentation("sell")).toMatchObject({ label: "Verkauf", tone: "negative", sign: "-" });
  });
});
