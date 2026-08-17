/**
 * KGV-Duplikat-Erkennung über Titel hinweg — KIMI-PEG-Audit R3/R6.
 *
 * Befund: 83 Gruppen VERSCHIEDENER Firmen mit bit-identischem KGV auf
 * 4 Dezimalstellen (Zufallserwartung: ~1 Gruppe). Egal ob Vendor- oder
 * App-Ursache — identische KGVs verschiedener Emittenten sind kein
 * Marktbefund, sondern ein Datenartefakt und gehören in den Review.
 */

import { describe, it, expect } from "vitest";
import { kgvDuplikate } from "./kgvDuplikate";

describe("kgvDuplikate", () => {
  it("findet Gruppen mit identischem Wert auf 4 Dezimalstellen", () => {
    const gruppen = kgvDuplikate([
      { ticker: "GSK.L", kgv: 19.7628 },
      { ticker: "FIE.DE", kgv: 19.7628 },
      { ticker: "AAPL", kgv: 35.08 },
      { ticker: "MCD", kgv: 21.097 },
      { ticker: "BLK", kgv: 21.097 },
      { ticker: "E0P.DE", kgv: 21.097 },
    ]);
    expect(gruppen).toHaveLength(2);
    const drei = gruppen.find((g) => g.ticker.length === 3)!;
    expect(drei.ticker).toEqual(["MCD", "BLK", "E0P.DE"]);
    expect(drei.wert).toBeCloseTo(21.097, 4);
  });

  it("knapp verschiedene Werte sind KEINE Duplikate — echte Markt-Nähe bleibt unangetastet", () => {
    expect(kgvDuplikate([
      { ticker: "A", kgv: 15.2672 },
      { ticker: "B", kgv: 15.2673 },
    ])).toHaveLength(0);
  });

  it("null-Werte und Einzelgänger erzeugen keine Gruppen", () => {
    expect(kgvDuplikate([
      { ticker: "A", kgv: null },
      { ticker: "B", kgv: null },
      { ticker: "C", kgv: 12.5 },
    ])).toHaveLength(0);
  });
});
