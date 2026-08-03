/**
 * Rekonstruktion der Score-Reihe.
 *
 * Der Lauf ist so gebaut, dass Abruf und Rechnung getrennt sind — dadurch
 * lässt sich das Wesentliche ohne EODHD-Zugang prüfen: dass kein Kurs aus der
 * Zukunft verwendet wird und dass eine Reihe Lücken zeigt, statt sie zu füllen.
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("./punktInZeitStore", () => ({
  haltefestHistorie: async (s: unknown[]) => s.length,
}));

import { kursAm, reiheFuerTitel, rekonstruiere } from "./punktInZeitRekonstruktion";

const KURSE = [
  { date: "2024-03-27", close: 20 },
  { date: "2024-03-28", close: 21 },
  // 29.–31.03. Feiertag/Wochenende
  { date: "2024-04-02", close: 25 },
];

describe("kursAm", () => {
  it("nimmt den letzten Handelstag vor dem Stichtag", () => {
    expect(kursAm(KURSE, "2024-03-31")).toBe(21);
  });

  it("nimmt NIE einen Kurs von nach dem Stichtag", () => {
    // Der Kern: Am 31.03. war der Kurs vom 02.04. nicht bekannt. Würde die
    // Suche den nächstgelegenen statt den letzten vorherigen nehmen, flösse
    // ein Zukunftskurs in die Bewertung.
    expect(kursAm(KURSE, "2024-03-31")).not.toBe(25);
  });

  it("gibt null zurück, wenn die Reihe erst später beginnt", () => {
    expect(kursAm(KURSE, "2023-01-31")).toBeNull();
  });
});

const FUNDAMENTALS = {
  Financials: {
    Balance_Sheet: {
      yearly: {
        "2022-12-31": { totalStockholderEquity: 4000, longTermDebt: 1000, cash: 500,
                        commonStockSharesOutstanding: 1000, totalAssets: 9000,
                        totalCurrentAssets: 3000, totalCurrentLiabilities: 1500,
                        filing_date: "2023-03-10" },
        "2023-12-31": { totalStockholderEquity: 4500, longTermDebt: 900, cash: 600,
                        commonStockSharesOutstanding: 1000, totalAssets: 9500,
                        totalCurrentAssets: 3400, totalCurrentLiabilities: 1500,
                        filing_date: "2024-03-08" },
      },
    },
    Income_Statement: {
      yearly: {
        "2022-12-31": { totalRevenue: 10000, grossProfit: 3500, operatingIncome: 1200,
                        netIncome: 850, incomeBeforeTax: 1100, incomeTaxExpense: 250,
                        depreciationAndAmortization: 400, filing_date: "2023-03-10" },
        "2023-12-31": { totalRevenue: 11000, grossProfit: 4000, operatingIncome: 1500,
                        netIncome: 1100, incomeBeforeTax: 1400, incomeTaxExpense: 300,
                        depreciationAndAmortization: 420, filing_date: "2024-03-08" },
      },
    },
    Cash_Flow: {
      yearly: {
        "2022-12-31": { totalCashFromOperatingActivities: 1000, capitalExpenditures: 300,
                        dividendsPaid: -200, filing_date: "2023-03-10" },
        "2023-12-31": { totalCashFromOperatingActivities: 1400, capitalExpenditures: 350,
                        dividendsPaid: -250, filing_date: "2024-03-08" },
      },
    },
  },
  Earnings: {
    Annual: Object.fromEntries(
      [0.80, 0.85, 0.92, 0.88, 0.97, 1.05, 1.10].map((eps, i) => [`${2017 + i}-12-31`, { epsActual: eps }]),
    ),
    History: {},
  },
  Highlights: { PERatio: 99 },
  Valuation: { ForwardPE: 99 },
};

const TAGESKURSE = (() => {
  const aus: { date: string; close: number }[] = [];
  for (let jahr = 2023; jahr <= 2024; jahr++) {
    for (let m = 1; m <= 12; m++) {
      aus.push({ date: `${jahr}-${String(m).padStart(2, "0")}-15`, close: 20 + m * 0.5 });
    }
  }
  return aus;
})();

describe("reiheFuerTitel", () => {
  const stichtage = ["2023-06-30", "2023-12-31", "2024-06-30"];
  const reihe = reiheFuerTitel("TEST.SW", FUNDAMENTALS, TAGESKURSE, stichtage, "Industrials");

  it("liefert eine Zeile je Stichtag mit Datengrundlage", () => {
    expect(reihe.map((r) => r.datum)).toEqual(stichtage);
  });

  it("die Scores ändern sich, wenn ein neuer Abschluss veröffentlicht wird", () => {
    // Im Juni 2023 trägt der Abschluss 2022, im Juni 2024 der von 2023.
    const juni23 = reihe.find((r) => r.datum === "2023-06-30")!;
    const juni24 = reihe.find((r) => r.datum === "2024-06-30")!;
    expect(juni23.qualitaet).not.toBe(juni24.qualitaet);
  });

  it("hält fest, worauf die Zeile beruht", () => {
    for (const r of reihe) {
      expect(r.belegt).toBeGreaterThan(0);
      expect(r.meldefristTage).toBe(90);
      expect(r.kurs).not.toBeNull();
    }
  });

  it("lässt Stichtage ohne Datengrundlage aus, statt Nullen zu schreiben", () => {
    const frueh = reiheFuerTitel("TEST.SW", FUNDAMENTALS, TAGESKURSE, ["2016-06-30"]);
    expect(frueh).toEqual([]);
  });
});

describe("rekonstruiere", () => {
  it("meldet übersprungene Titel, statt sie stillschweigend auszulassen", async () => {
    const meldungen: string[] = [];
    const r = await rekonstruiere(
      [{ ticker: "GUT.SW", sektor: null }, { ticker: "OHNE.SW", sektor: null }],
      "2023-06-01", "2024-06-30",
      async (t) => (t === "GUT.SW" ? FUNDAMENTALS : null),
      async () => TAGESKURSE,
      (m) => meldungen.push(m),
    );
    expect(r.titel).toBe(1);
    expect(r.zeilen).toBeGreaterThan(0);
    expect(r.uebersprungen.some((u) => u.startsWith("OHNE.SW"))).toBe(true);
    expect(r.meldungen.join(" ")).toContain("OHNE.SW");
  });

  it("überspringt einen Titel ohne Kurse, statt ihn ohne Bewertung zu schreiben", async () => {
    const r = await rekonstruiere(
      [{ ticker: "STUMM.SW", sektor: null }],
      "2023-06-01", "2024-06-30",
      async () => FUNDAMENTALS,
      async () => [],
      () => {},
    );
    expect(r.zeilen).toBe(0);
    expect(r.uebersprungen[0]).toContain("keine Kurse");
  });

  it("meldet die Zahl der Uebersprungenen waehrend des Laufs, nicht erst am Ende", async () => {
    // Vorher stand in der Fortschrittsmeldung nur «X/Y Titel, Z Zeilen». Ein
    // Lauf, der reihenweise scheiterte, sah damit aus wie einer, der arbeitet
    // — sichtbar wurde es erst nach Stunden.
    const meldungen: string[] = [];
    await rekonstruiere(
      Array.from({ length: 10 }, (_, i) => ({ ticker: `T${i}.SW`, sektor: null })),
      "2023-06-01", "2024-06-30",
      async () => null,
      async () => TAGESKURSE,
      (m) => meldungen.push(m),
    );
    const fortschritt = meldungen.filter((m) => m.startsWith("Fortschritt"));
    expect(fortschritt.length).toBeGreaterThan(0);
    expect(fortschritt.at(-1)).toContain("übersprungen");
  });

  it("faengt einen Fehler je Titel ab, statt den Lauf abzubrechen", async () => {
    const r = await rekonstruiere(
      [{ ticker: "KAPUTT.SW", sektor: null }, { ticker: "GUT.SW", sektor: null }],
      "2023-06-01", "2024-06-30",
      async (t) => { if (t === "KAPUTT.SW") throw new Error("EODHD 500"); return FUNDAMENTALS; },
      async () => TAGESKURSE,
      () => {},
    );
    expect(r.zeilen).toBeGreaterThan(0);
    expect(r.uebersprungen[0]).toContain("EODHD 500");
  });
});
