import { describe, expect, it } from "vitest";
import { formatFullReoptimizationFraction } from "./fullReoptimizationPresentation";

describe("formatFullReoptimizationFraction", () => {
  it("formatiert eine als Dezimalzahl zurückgegebene Volatilität als Prozentwert", () => {
    expect(formatFullReoptimizationFraction(0.1636)).toBe("16.4%");
  });
});
