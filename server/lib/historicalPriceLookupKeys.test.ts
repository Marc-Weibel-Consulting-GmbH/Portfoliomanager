import { describe, expect, it } from "vitest";
import { historicalPriceLookupKeys } from "./historicalPriceLookupKeys";

describe("historicalPriceLookupKeys", () => {
  it("enthält bei nackten US-Tickern den kanonischen und den bestehenden Legacy-Preiskey", () => {
    expect(historicalPriceLookupKeys("MU")).toEqual(["MU.US", "MU"]);
  });

  it("behält bereits kanonische Börsensymbole ohne künstliche Zweitbörse bei", () => {
    expect(historicalPriceLookupKeys("NESN.SW")).toEqual(["NESN.SW"]);
  });
});
