import { describe, expect, it } from "vitest";
import { buildPortfolioExportModel } from "./portfolioExportModel";

describe("buildPortfolioExportModel", () => {
  const base = {
    portfolio: {
      id: 7,
      name: "Beispiel Depot",
      totalValueCHF: 250_000,
      cashBalance: 25_000,
      investmentAmount: 240_000,
      avgDividendYield: 2.8,
      isLive: 1,
    },
    holdings: [
      {
        ticker: "NOVN.SW",
        companyName: "Novartis AG",
        isin: "CH0012032048",
        sector: "Healthcare",
        currency: "CHF",
        shares: 100,
        currentPriceLocal: 102,
        valueCHF: 10_200,
        weight: 4.08,
        ytdPerformance: 8.4,
        totalReturn: 12.1,
      },
    ],
    performance: {
      ttwror: 0.052,
      annualizedTtwror: 0.052,
      irr: 0.049,
      absoluteGainCHF: 10_000,
      currentValueCHF: 250_000,
      totalInvestedCHF: 240_000,
      periodDays: 250,
      dailySeries: [
        { date: "2026-01-02", cumulativeReturn: 0 },
        { date: "2026-01-05", cumulativeReturn: 0.012 },
      ],
      dailyValuations: [
        { date: "2026-01-02", marketValue: 240_000 },
        { date: "2026-01-05", marketValue: 242_880 },
      ],
      unpricedTickers: [],
      dataQualityWarnings: [],
    },
    risk: {
      dataAvailable: true,
      sharpeRatio: 1.24,
      volatility: 12.5,
      maxDrawdown: -8.3,
      var95: -1.8,
      concentrationTop3: 38,
    },
    referenceCurrency: "CHF",
    asOf: new Date("2026-09-07T10:30:00.000Z"),
    periodLabel: "YTD",
  };

  it("übernimmt den Gesamtwert unverändert und zählt die bereits enthaltene Liquidität nicht doppelt", () => {
    const model = buildPortfolioExportModel(base);

    expect(model.summary.currentValueCHF).toBe(250_000);
    expect(model.summary.cashBalanceCHF).toBe(25_000);
    expect(model.summary.cashWeightPct).toBeCloseTo(10, 8);
    expect(model.kpis.find((kpi) => kpi.key === "current_value")?.value).toBe(250_000);
    expect(model.kpis.find((kpi) => kpi.key === "cash")?.definition).toContain("bereits im Depotwert enthalten");
  });

  it("liefert eine vollständige Titelliste samt Kennzahlen und eine echte CHF-Wertreihe für den Bericht", () => {
    const model = buildPortfolioExportModel(base);

    expect(model.positions).toEqual([
      expect.objectContaining({
        ticker: "NOVN.SW",
        companyName: "Novartis AG",
        isin: "CH0012032048",
        marketValueCHF: 10_200,
        portfolioWeightPct: 4.08,
      }),
    ]);
    expect(model.depotValueSeries).toEqual([
      { date: "2026-01-02", marketValueCHF: 240_000 },
      { date: "2026-01-05", marketValueCHF: 242_880 },
    ]);
    expect(model.depotValueSeriesKind).toBe("actual");
    expect(model.kpis).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "ttwror", value: 0.052 }),
      expect.objectContaining({ key: "sharpe", value: 1.24 }),
    ]));
  });

  it("weist fehlende Kurs- oder Wechselkurswerte als Datenlücke aus statt sie als Wert null zu behaupten", () => {
    const model = buildPortfolioExportModel({
      ...base,
      holdings: [{
        ticker: "MISSING.US",
        companyName: "Unvollständiger Titel",
        currency: "USD",
        shares: 10,
        valueCHF: 0,
        weight: 0,
        priceMissing: true,
        fxMissing: true,
      }],
      performance: {
        ...base.performance,
        dailyValuations: [],
        unpricedTickers: ["MISSING.US"],
      },
    });

    expect(model.positions[0]).toMatchObject({
      ticker: "MISSING.US",
      marketValueCHF: null,
      dataStatus: "Kurs- und Wechselkursdaten fehlen",
    });
    expect(model.dataQualityNotes).toEqual(expect.arrayContaining([
      expect.stringContaining("MISSING.US"),
    ]));
  });

  it("kennzeichnet den gewichteten Demo-Chart transparent als indexierten statt als historischen CHF-Depotwert", () => {
    const model = buildPortfolioExportModel({
      ...base,
      performance: { ...base.performance, dailySeries: [], dailyValuations: [] },
      fallbackIndexedSeries: [
        { date: "2026-01-02", portfolio: 0 },
        { date: "2026-01-05", portfolio: 1.2 },
      ],
    });

    expect(model.depotValueSeriesKind).toBe("indexed");
    expect(model.indexedReturnSeries).toEqual([
      { date: "2026-01-02", cumulativeReturnPct: 0 },
      { date: "2026-01-05", cumulativeReturnPct: 1.2 },
    ]);
    expect(model.dataQualityNotes).toEqual(expect.arrayContaining([
      expect.stringContaining("keine rückwirkend ausgeführte Transaktionshistorie"),
    ]));
  });
});
