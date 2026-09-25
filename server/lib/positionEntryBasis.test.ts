import { describe, expect, it } from "vitest";
import { resolvePositionEntryBasis } from "./positionEntryBasis";

describe("resolvePositionEntryBasis", () => {
  it("weist fehlende Einstandsbasis explizit als Datenlücke aus", () => {
    expect(resolvePositionEntryBasis({ hasCostBasis: false })).toEqual({
      status: "missing",
      entryDate: null,
      label: "Einstandsdaten fehlen",
    });
  });

  it("bewahrt einen manuell bestätigten Einstandstag", () => {
    expect(resolvePositionEntryBasis({ hasCostBasis: true, storedEntryDate: "2026-09-08" })).toEqual({
      status: "confirmed_date",
      entryDate: "2026-09-08",
      label: "Einstand bestätigt",
    });
  });

  it("kennzeichnet die berechnete Portfolio-Startbasis getrennt von einem bestätigten Kauf", () => {
    expect(resolvePositionEntryBasis({
      hasCostBasis: true,
      isPortfolioStartBasis: true,
      portfolioStartDate: "2026-09-08",
    })).toEqual({
      status: "portfolio_start",
      entryDate: "2026-09-08",
      label: "Einstand aus Portfolio-Start",
    });
  });

  it("leitet einen eindeutigen Einstandstag aus einer einzelnen Buchung ab", () => {
    expect(resolvePositionEntryBasis({ hasCostBasis: true, transactionDates: ["2026-09-08", "2026-09-08"] })).toEqual({
      status: "transaction_date",
      entryDate: "2026-09-08",
      label: "Einstand aus Buchung",
    });
  });

  it("erfindet für mehrere Kauftranchen kein einzelnes Einstandsdatum", () => {
    expect(resolvePositionEntryBasis({ hasCostBasis: true, transactionDates: ["2026-01-03", "2026-05-17"] })).toEqual({
      status: "multiple_transaction_dates",
      entryDate: null,
      label: "Mehrere Kauftranchen",
    });
  });
});
