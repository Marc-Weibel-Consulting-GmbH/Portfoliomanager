/**
 * Punkt-in-Zeit-Zuschnitt der Fundamentaldaten.
 *
 * Hier entstehen die Rückschaufehler, die man später nicht mehr sieht: Ein
 * Backtest mit durchgesickerten Zukunftsdaten sieht nicht falsch aus, er sieht
 * nur zu gut aus. Deshalb prüfen diese Tests vor allem das, was NICHT
 * durchkommen darf.
 */

import { describe, it, expect } from "vitest";
import {
  abschlussVerfuegbarAm,
  beschneideFundamentals,
  monatsStichtage,
  MELDEFRIST_TAGE,
} from "./punktInZeit";

describe("abschlussVerfuegbarAm", () => {
  it("verwendet das Meldedatum, wenn EODHD es liefert", () => {
    expect(abschlussVerfuegbarAm("2023-12-31", "2024-02-15", "2024-03-01")).toBe(true);
    expect(abschlussVerfuegbarAm("2023-12-31", "2024-02-15", "2024-02-01")).toBe(false);
  });

  it("der Bilanzstichtag allein macht einen Abschluss nicht verfügbar", () => {
    // Genau der Fehler, um den es geht: Der Abschluss per 31.12. liegt am
    // 1.1. noch nicht vor.
    expect(abschlussVerfuegbarAm("2023-12-31", null, "2024-01-02")).toBe(false);
  });

  it("fällt ohne Meldedatum auf die Meldefrist zurück", () => {
    // 31.12.2023 + 90 Tage = 30.03.2024
    expect(abschlussVerfuegbarAm("2023-12-31", null, "2024-03-29")).toBe(false);
    expect(abschlussVerfuegbarAm("2023-12-31", null, "2024-03-31")).toBe(true);
  });

  it("die Frist ist einstellbar", () => {
    expect(abschlussVerfuegbarAm("2023-12-31", null, "2024-01-15", 10)).toBe(true);
    expect(MELDEFRIST_TAGE).toBe(90);
  });

  it("lehnt undatierte Abschlüsse ab", () => {
    expect(abschlussVerfuegbarAm("keine-ahnung", null, "2024-06-30")).toBe(false);
    expect(abschlussVerfuegbarAm("2023-12-31", null, "kaputt")).toBe(false);
  });
});

describe("beschneideFundamentals", () => {
  const antwort = {
    General: { Name: "Test AG" },
    Highlights: {
      PERatio: 35.4,
      MarketCapitalization: 144_900_000_000,
      OperatingMarginTTM: 0.18,
      ReturnOnEquityTTM: 0.22,
      EBITDA: 5_000_000_000,
    },
    Valuation: { ForwardPE: 30, PriceBookMRQ: 6.2 },
    Financials: {
      Balance_Sheet: {
        yearly: {
          "2022-12-31": { totalStockholderEquity: 100, filing_date: "2023-03-10" },
          "2023-12-31": { totalStockholderEquity: 120, filing_date: "2024-03-08" },
          "2024-12-31": { totalStockholderEquity: 140, filing_date: "2025-03-06" },
        },
        quarterly: {
          "2024-06-30": { totalStockholderEquity: 130, filing_date: "2024-07-25" },
        },
      },
      Income_Statement: {
        yearly: {
          "2023-12-31": { netIncome: 10, filing_date: "2024-03-08" },
          "2024-12-31": { netIncome: 12, filing_date: "2025-03-06" },
        },
      },
      Cash_Flow: {
        yearly: {
          "2023-12-31": { freeCashFlow: 8, filing_date: "2024-03-08" },
          "2024-12-31": { freeCashFlow: 9, filing_date: "2025-03-06" },
        },
      },
    },
    Earnings: {
      Annual: {
        "2023-12-31": { epsActual: 2.1 },
        "2024-12-31": { epsActual: 2.4 },
      },
      History: {
        "2024-09-30": { epsActual: 0.6, reportDate: "2024-10-22" },
        "2024-12-31": { epsActual: 0.7, reportDate: "2025-02-04" },
      },
    },
  };

  it("entfernt Highlights und Valuation vollständig", () => {
    // Der wichtigste Test der Datei. Jede Zahl in diesen Blöcken ist ein
    // Tageswert von heute; sie durchzureichen wäre der stillste
    // Rückschaufehler überhaupt.
    const b = beschneideFundamentals(antwort, "2024-06-30");
    expect(b.Highlights).toEqual({});
    expect(b.Valuation).toEqual({});
  });

  it("behält nur die am Stichtag veröffentlichten Jahresabschlüsse", () => {
    const b = beschneideFundamentals(antwort, "2024-06-30");
    const jahre = Object.keys(b.Financials.Balance_Sheet.yearly).sort();
    expect(jahre).toEqual(["2022-12-31", "2023-12-31"]);
    // Der Abschluss 2024 wurde erst im März 2025 gemeldet.
    expect(jahre).not.toContain("2024-12-31");
  });

  it("beschneidet auch die Quartalsabschlüsse", () => {
    const frueh = beschneideFundamentals(antwort, "2024-06-30");
    expect(Object.keys(frueh.Financials.Balance_Sheet.quarterly)).toEqual([]);
    const spaet = beschneideFundamentals(antwort, "2024-08-31");
    expect(Object.keys(spaet.Financials.Balance_Sheet.quarterly)).toEqual(["2024-06-30"]);
  });

  it("filtert Quartalsberichte nach ihrem Berichtsdatum", () => {
    const b = beschneideFundamentals(antwort, "2024-12-31");
    // Bericht zum Q4 erschien erst am 04.02.2025.
    expect(Object.keys(b.Earnings.History)).toEqual(["2024-09-30"]);
  });

  it("beschneidet die EPS-Jahresreihe über die Meldefrist", () => {
    const b = beschneideFundamentals(antwort, "2024-06-30");
    expect(Object.keys(b.Earnings.Annual)).toEqual(["2023-12-31"]);
  });

  it("lässt die Eingabe unverändert", () => {
    const vorher = JSON.stringify(antwort);
    beschneideFundamentals(antwort, "2024-06-30");
    expect(JSON.stringify(antwort)).toBe(vorher);
  });

  it("gibt an einem sehr frühen Stichtag nichts zurück, statt zu raten", () => {
    const b = beschneideFundamentals(antwort, "2020-01-01");
    expect(Object.keys(b.Financials.Income_Statement.yearly)).toEqual([]);
    expect(Object.keys(b.Earnings.Annual)).toEqual([]);
  });

  it("verträgt eine leere oder unvollständige Antwort", () => {
    const b = beschneideFundamentals({}, "2024-06-30");
    expect(b.Financials.Balance_Sheet.yearly).toEqual({});
    expect(b.Earnings.Annual).toEqual({});
  });
});

describe("Zusammenspiel mit den bestehenden Formeln", () => {
  it("Piotroski rechnet auf dem zugeschnittenen Stand von damals", async () => {
    const { berechnePiotroski } = await import("./piotroski");
    const antwort = {
      Financials: {
        Balance_Sheet: {
          yearly: {
            "2022-12-31": { totalAssets: 1000, totalCurrentAssets: 400, totalCurrentLiabilities: 200,
                            longTermDebt: 300, commonStockSharesOutstanding: 100, filing_date: "2023-03-10" },
            "2023-12-31": { totalAssets: 1100, totalCurrentAssets: 500, totalCurrentLiabilities: 200,
                            longTermDebt: 250, commonStockSharesOutstanding: 100, filing_date: "2024-03-08" },
          },
        },
        Income_Statement: {
          yearly: {
            "2022-12-31": { netIncome: 50, totalRevenue: 800, grossProfit: 300, filing_date: "2023-03-10" },
            "2023-12-31": { netIncome: 80, totalRevenue: 900, grossProfit: 360, filing_date: "2024-03-08" },
          },
        },
        Cash_Flow: {
          yearly: {
            "2022-12-31": { totalCashFromOperatingActivities: 60, filing_date: "2023-03-10" },
            "2023-12-31": { totalCashFromOperatingActivities: 95, filing_date: "2024-03-08" },
          },
        },
      },
      Earnings: { Annual: {}, History: {} },
    };

    // Im Februar 2024 lag der Abschluss 2023 noch nicht vor — nur ein Jahr,
    // also kein Vorjahresvergleich und damit kein F-Score.
    const februar = berechnePiotroski(beschneideFundamentals(antwort, "2024-02-01").Financials);
    expect(februar.berechenbar).toBe(0);

    // Im April 2024 liegen beide Jahre vor.
    const april = berechnePiotroski(beschneideFundamentals(antwort, "2024-04-01").Financials);
    expect(april.berechenbar).toBeGreaterThan(0);
  });
});

describe("monatsStichtage", () => {
  it("liefert Monatsletzte im Zeitraum", () => {
    expect(monatsStichtage("2024-01-01", "2024-04-15")).toEqual([
      "2024-01-31", "2024-02-29", "2024-03-31",
    ]);
  });

  it("beachtet Schaltjahre", () => {
    expect(monatsStichtage("2023-02-01", "2023-03-01")).toEqual(["2023-02-28"]);
  });

  it("gibt bei umgekehrter oder unbrauchbarer Reihenfolge nichts zurück", () => {
    expect(monatsStichtage("2024-06-30", "2024-01-01")).toEqual([]);
    expect(monatsStichtage("kaputt", "2024-01-01")).toEqual([]);
  });
});
