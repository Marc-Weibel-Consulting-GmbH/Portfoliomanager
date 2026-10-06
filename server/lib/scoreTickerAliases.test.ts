import { describe, expect, it } from "vitest";
import { scoreTickerAliases } from "./scoreTickerAliases";

describe("scoreTickerAliases", () => {
  it("ordnet die ausschliesslich syntaktische US-EODHD-Route der gespeicherten Stammzeile zu", () => {
    expect(scoreTickerAliases("PLTR.US")).toEqual(["PLTR.US", "PLTR"]);
  });

  it("verändert keine Börsen- oder ADR-Zuordnung", () => {
    expect(scoreTickerAliases("STMN.SW")).toEqual(["STMN.SW"]);
    expect(scoreTickerAliases("DBSDY.US")).toEqual(["DBSDY.US", "DBSDY"]);
  });
});
