import { describe, expect, it } from "vitest";
import { dividendValidationStatus, yahooTrailingDividendYield } from "./dividendValidation";

describe("ISIN-gebundene Dividendenvalidierung", () => {
  it("berechnet die Yahoo-Trailing-Rendite aus demselben Instrumentkurs und Ausschüttungen", () => {
    expect(yahooTrailingDividendYield(9345, [180])).toBeCloseTo(1.926, 3);
  });
  it("markiert einen materiellen Quellenkonflikt statt den internen Wert zu ändern", () => {
    expect(dividendValidationStatus(18.98, 1.926, true)).toBe("zu_pruefen");
    expect(dividendValidationStatus(18.98, 1.926, false)).toBe("identitaet_ungeklaert");
  });
});
