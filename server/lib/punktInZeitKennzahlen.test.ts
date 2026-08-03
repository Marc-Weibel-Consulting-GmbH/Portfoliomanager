/**
 * Kennzahlen aus datierten Abschlüssen.
 *
 * Der wichtigste Test ist der letzte: Er stellt sicher, dass die
 * Stabilitätsskala hier dieselbe bleibt wie in `qualityMetricsService`. Beide
 * Stellen rechnen dieselbe Grösse; driften sie auseinander, optimiert der
 * Backtest gegen eine Kennzahl, die live nicht existiert.
 */

import { describe, it, expect } from "vitest";
import { kennzahlenPerStichtag, stabilitaetAusReihe } from "./punktInZeitKennzahlen";
import { beschneideFundamentals } from "./punktInZeit";
import { extractMetrics } from "./qualityMetricsService";

const ABSCHLUSS = {
  Financials: {
    Balance_Sheet: {
      yearly: {
        "2022-12-31": {
          totalStockholderEquity: 4000, longTermDebt: 1500, shortTermDebt: 500, cash: 800,
          commonStockSharesOutstanding: 1000, totalAssets: 9000,
          totalCurrentAssets: 3000, totalCurrentLiabilities: 1500, filing_date: "2023-03-10",
        },
        "2023-12-31": {
          totalStockholderEquity: 4500, longTermDebt: 1400, shortTermDebt: 400, cash: 900,
          commonStockSharesOutstanding: 1000, totalAssets: 9500,
          totalCurrentAssets: 3400, totalCurrentLiabilities: 1500, filing_date: "2024-03-08",
        },
      },
    },
    Income_Statement: {
      yearly: {
        "2022-12-31": {
          totalRevenue: 10000, grossProfit: 3500, operatingIncome: 1200, netIncome: 850,
          incomeBeforeTax: 1100, incomeTaxExpense: 250, depreciationAndAmortization: 400,
          filing_date: "2023-03-10",
        },
        "2023-12-31": {
          totalRevenue: 11000, grossProfit: 4000, operatingIncome: 1500, netIncome: 1100,
          incomeBeforeTax: 1400, incomeTaxExpense: 300, depreciationAndAmortization: 420,
          filing_date: "2024-03-08",
        },
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
      [0.80, 0.85, 0.92, 0.88, 0.97, 1.05, 1.10].map((eps, i) => [
        `${2017 + i}-12-31`, { epsActual: eps },
      ]),
    ),
    History: {},
  },
  Highlights: { PERatio: 99, OperatingMarginTTM: 0.99, MarketCapitalization: 1 },
  Valuation: { ForwardPE: 99 },
};

const stichtag = "2024-06-30";
const beschnitten = beschneideFundamentals(ABSCHLUSS, stichtag);

describe("kennzahlenPerStichtag", () => {
  const k = kennzahlenPerStichtag({ beschnitten, kurs: 22, sektor: "Industrials" });

  it("rechnet die Margen aus dem Abschluss, nicht aus Highlights", () => {
    // Highlights behauptet 99 % Betriebsmarge. Die echte ist 1500/11000.
    expect(k.qualitaet.bruttomarge).toBeCloseTo((4000 / 11000) * 100, 4);
    expect(k.qualitaet.betriebsmarge).toBeCloseTo((1500 / 11000) * 100, 4);
  });

  it("rechnet ROIC aus Betriebsergebnis, Steuersatz und Kapital", () => {
    // Steuersatz 300/1400 = 21.4 %; NOPAT = 1500 × 0.786
    // Kapital = 4500 + (1400 + 400 − 900) = 5400
    const steuersatz = 300 / 1400;
    const erwartet = ((1500 * (1 - steuersatz)) / 5400) * 100;
    expect(k.qualitaet.roic).toBeCloseTo(erwartet, 4);
  });

  it("rechnet Ertragsdeckung und Verschuldung", () => {
    expect(k.qualitaet.ertragsdeckung).toBeCloseTo(1400 / 1100, 4);
    // Nettoschulden 900 ÷ EBITDA (1500 + 420)
    expect(k.qualitaet.netDebtToEbitda).toBeCloseTo(900 / 1920, 4);
  });

  it("rechnet die kursbasierten Grössen aus dem Kurs von damals", () => {
    // EPS 2023 = 1.10 (letzte verfügbare Jahresreihe), Kurs 22 → KGV 20
    expect(k.bewertung.kgv).toBeCloseTo(22 / 1.10, 4);
    // Buchwert je Aktie 4500/1000 = 4.5
    expect(k.bewertung.kursBuchwert).toBeCloseTo(22 / 4.5, 4);
    // FCF 1400 − 350 = 1050; Marktkap. 22 × 1000
    expect(k.bewertung.fcfRendite).toBeCloseTo((1050 / 22000) * 100, 4);
    // Dividende 250 auf 1000 Aktien bei Kurs 22
    expect(k.bewertung.dividendenrendite).toBeCloseTo((250 / 1000 / 22) * 100, 4);
  });

  it("gibt kein PEG aus — die Wachstumsschätzung von heute gehört nicht in damals", () => {
    expect(k.bewertung.adjustedPeg).toBeNull();
  });

  it("rechnet Piotroski auf demselben Stand", () => {
    expect(k.piotroski.berechenbar).toBeGreaterThan(0);
  });

  it("meldet ohne Kurs keine kursbasierten Grössen", () => {
    const ohne = kennzahlenPerStichtag({ beschnitten, kurs: null });
    expect(ohne.bewertung.kgv).toBeNull();
    expect(ohne.bewertung.kursBuchwert).toBeNull();
    expect(ohne.bewertung.fcfRendite).toBeNull();
    // Die Qualitätsseite hängt nicht am Kurs und bleibt vollständig.
    expect(ohne.qualitaet.roic).not.toBeNull();
  });

  it("liefert ohne Abschlüsse keine Abschlusskennzahlen — auch nicht geraten", () => {
    // Stichtag vor dem ersten Abschluss der Testdaten (2022). Die EPS-Reihe
    // reicht weiter zurück und ist zu diesem Zeitpunkt bereits veröffentlicht;
    // das KGV bleibt deshalb rechenbar. Genau diese Trennung ist gewollt: Was
    // damals bekannt war, zählt — was nicht, fehlt.
    const leer = kennzahlenPerStichtag({
      beschnitten: beschneideFundamentals(ABSCHLUSS, "2019-01-01"),
      kurs: 15,
    });
    expect(Object.values(leer.qualitaet).every((v) => v === null)).toBe(true);
    expect(leer.bewertung.kursBuchwert).toBeNull();  // braucht die Bilanz
    expect(leer.bewertung.fcfRendite).toBeNull();    // braucht die Geldflussrechnung
    expect(leer.bewertung.kgv).not.toBeNull();       // braucht nur EPS und Kurs
    expect(leer.piotroski.berechenbar).toBe(0);
  });

  it("verwendet den älteren Abschluss, solange der neuere nicht gemeldet war", () => {
    // Am 01.02.2024 lag der Abschluss 2023 noch nicht vor.
    const frueher = kennzahlenPerStichtag({
      beschnitten: beschneideFundamentals(ABSCHLUSS, "2024-02-01"),
      kurs: 22,
    });
    // Marge aus 2022: 1200/10000
    expect(frueher.qualitaet.betriebsmarge).toBeCloseTo((1200 / 10000) * 100, 4);
  });
});

describe("stabilitaetAusReihe", () => {
  it("hält dieselbe Skala wie qualityMetricsService", () => {
    // Beide Stellen rechnen dieselbe Grösse. Driften sie auseinander,
    // optimiert der Backtest gegen eine Kennzahl, die live nicht existiert.
    const reihe = [3.00, 3.45, 2.24, 3.14, 3.39, 3.80, 3.61, 4.51, 4.96, 5.85, 6.20];
    const hier = stabilitaetAusReihe(reihe);

    const alsAntwort = {
      Highlights: {}, Valuation: {}, Financials: {},
      Earnings: {
        Annual: Object.fromEntries(reihe.map((eps, i) => [`${2015 + i}-12-31`, { epsActual: eps }])),
        History: {},
      },
    };
    const dort = extractMetrics(alsAntwort, "TEST.SW").epsStabilityScore;
    expect(hier).toBe(dort);
  });

  it("gibt null bei zu kurzer Reihe", () => {
    expect(stabilitaetAusReihe([1, 2, 3])).toBeNull();
  });
});
