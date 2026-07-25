import { describe, it, expect } from "vitest";
import { issuerKey } from "../lib/issuerIdentity";

describe("issuerKey", () => {
  it("führt Zweitnotierungen desselben Unternehmens zusammen", () => {
    // Der Fall aus dem Live-Vorschlag: BATS.L (London) und BTI (US-ADR).
    expect(issuerKey("British American Tobacco")).toBe(
      issuerKey("British American Tobacco p.l.c."),
    );
  });

  it("entfernt gängige Rechtsformzusätze", () => {
    expect(issuerKey("Logitech International S.A.")).toBe("logitech international");
    expect(issuerKey("Holcim AG")).toBe("holcim");
    expect(issuerKey("Givaudan SA")).toBe("givaudan");
    expect(issuerKey("Amazon.com, Inc.")).toBe("amazon com");
    expect(issuerKey("Roche Holding AG")).toBe("roche");
  });

  it("trägt mehrere Zusätze hintereinander ab", () => {
    expect(issuerKey("Prudential Group Holdings plc")).toBe("prudential");
  });

  it("hält verschiedene Unternehmen auseinander", () => {
    expect(issuerKey("Microsoft Corporation")).not.toBe(issuerKey("Micron Technology"));
    expect(issuerKey("Alphabet Inc.")).not.toBe(issuerKey("Amazon.com Inc."));
  });

  it("behält Namen, die nur aus einem Zusatz bestehen", () => {
    expect(issuerKey("Group")).toBe("group");
  });

  it("ist robust gegen leere Werte", () => {
    expect(issuerKey(null)).toBe("");
    expect(issuerKey(undefined)).toBe("");
    expect(issuerKey("")).toBe("");
  });
});
