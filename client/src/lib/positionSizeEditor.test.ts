import { describe, expect, it } from "vitest";
import {
  calculateSharesForPositionValueChf,
  getPositionSizeEditorBounds,
} from "./positionSizeEditor";

describe("positionSizeEditor", () => {
  it("berechnet Stück aus einem CHF-Zielwert mit derselben sechsstelligen Präzision wie die Demo-Cash-Mutation", () => {
    expect(calculateSharesForPositionValueChf({
      targetValueChf: 14_327,
      currentPriceChf: 28.654,
    })).toBeCloseTo(500.0, 6);

    expect(calculateSharesForPositionValueChf({
      targetValueChf: 20_000,
      currentPriceChf: 80,
    })).toBe(250);
  });

  it("liefert keine Stückzahl ohne positive, aktuelle CHF-Kursbasis", () => {
    expect(calculateSharesForPositionValueChf({
      targetValueChf: 20_000,
      currentPriceChf: 0,
    })).toBeNull();
  });

  it("begrenzt den Regler auf aktuellen Positionswert plus verfügbare Cash-Reserve", () => {
    expect(getPositionSizeEditorBounds({
      shares: 500,
      currentPriceChf: 28.654,
      cashBalanceChf: 8_000,
    })).toEqual({
      currentValueChf: 14_327,
      maxValueChf: 22_327,
      sliderStepChf: 100,
    });
  });

  it("bietet für kleine Positionen eine feinere Reglerstufe und akzeptiert negative Cashwerte nicht", () => {
    expect(getPositionSizeEditorBounds({
      shares: 12,
      currentPriceChf: 50,
      cashBalanceChf: -200,
    })).toEqual({
      currentValueChf: 600,
      maxValueChf: 600,
      sliderStepChf: 10,
    });
  });
});
