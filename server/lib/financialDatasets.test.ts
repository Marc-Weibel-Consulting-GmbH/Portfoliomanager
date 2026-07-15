import { describe, it, expect } from "vitest";
import { summarizeFundamentals, toUsTicker } from "./financialDatasets";

describe("toUsTicker — nur US-Titel werden abgefragt", () => {
  it("US-Ticker durchlassen (mit und ohne .US-Suffix)", () => {
    expect(toUsTicker("AAPL")).toBe("AAPL");
    expect(toUsTicker("aapl.us")).toBe("AAPL");
  });

  it("Nicht-US-Suffixe liefern null (CH/EU nicht abgedeckt)", () => {
    expect(toUsTicker("NESN.SW")).toBeNull();
    expect(toUsTicker("DGE.L")).toBeNull();
    expect(toUsTicker("SAP.DE")).toBeNull();
    expect(toUsTicker("")).toBeNull();
  });
});

describe("summarizeFundamentals — kompakte Fakten-Zeile", () => {
  const income = [
    { report_period: "2025-09-30", revenue: 400e9, net_income: 100e9 },
    { report_period: "2024-09-30", revenue: 380e9, net_income: 95e9 },
  ];
  const cashflow = [
    { report_period: "2025-09-30", free_cash_flow: 110e9 },
    { report_period: "2024-09-30", free_cash_flow: 100e9 },
  ];

  it("berechnet Umsatz-YoY, Nettomarge und FCF-YoY", () => {
    const f = summarizeFundamentals("AAPL", income, cashflow)!;
    expect(f.revenueYoYPct).toBeCloseTo(5.3, 1);
    expect(f.netMarginPct).toBe(25);
    expect(f.fcfYoYPct).toBe(10);
    expect(f.summary).toContain("AAPL");
    expect(f.summary).toContain("Umsatz 400.0 Mrd.");
    expect(f.summary).toContain("Nettomarge 25%");
    expect(f.summary).toContain("Financial Datasets");
  });

  it("normalisiert die Perioden-Reihenfolge (älteste zuerst → gleiches Ergebnis)", () => {
    const f = summarizeFundamentals("AAPL", [...income].reverse(), [...cashflow].reverse())!;
    expect(f.revenueYoYPct).toBeCloseTo(5.3, 1);
    expect(f.fcfYoYPct).toBe(10);
  });

  it("degradiert bei fehlenden Feldern statt zu raten", () => {
    const f = summarizeFundamentals("XYZ", [{ report_period: "2025-12-31", revenue: 50e6 }], [])!;
    expect(f.netMarginPct).toBeNull();
    expect(f.freeCashFlow).toBeNull();
    expect(f.summary).toContain("Umsatz 50 Mio.");
  });

  it("liefert null bei komplett leeren Daten (kein leeres Versprechen)", () => {
    expect(summarizeFundamentals("XYZ", [], [])).toBeNull();
    expect(summarizeFundamentals("XYZ", [{ report_period: "2025-12-31" }], [])).toBeNull();
  });
});
