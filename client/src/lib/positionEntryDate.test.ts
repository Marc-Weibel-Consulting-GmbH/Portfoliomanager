import { describe, expect, it } from "vitest";
import { resolveInitialEntryDate } from "./positionEntryDate";

describe("resolveInitialEntryDate", () => {
  it("verwendet für eine undatierte Demoposition das Portfolio-Startdatum", () => {
    expect(resolveInitialEntryDate({
      storedEntryDate: null,
      entryBasisStatus: "undated_cost_basis",
      portfolioCreatedAt: "2026-09-08T09:30:00.000Z",
    })).toBe("2026-09-08");
  });

  it("bewahrt ein bestätigtes positionsbezogenes Einstandsdatum", () => {
    expect(resolveInitialEntryDate({
      storedEntryDate: "2026-06-12",
      entryBasisStatus: "confirmed_date",
      portfolioCreatedAt: "2026-09-08T09:30:00.000Z",
    })).toBe("2026-06-12");
  });

  it("erfindet bei mehreren Kauftranchen kein einzelnes Einstandsdatum", () => {
    expect(resolveInitialEntryDate({
      storedEntryDate: null,
      entryBasisStatus: "multiple_transaction_dates",
      portfolioCreatedAt: "2026-09-08T09:30:00.000Z",
    })).toBe("");
  });
});
