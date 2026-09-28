import { describe, expect, it } from "vitest";
import {
  buildHistoricalFxBackfillPlan,
  filterNewHistoricalFxRates,
} from "./historicalFxBackfillPlan";

describe("historical FX backfill plan", () => {
  it("plant nur die fehlende Vorperiode je tatsächlich benötigtem Fremdwährungspaar", () => {
    expect(buildHistoricalFxBackfillPlan({
      currencies: ["CHF", "USD", "EUR", "USD", "GBp"],
      requiredStartDate: "2016-09-07",
      earliestExistingByPair: {
        USDCHF: "2020-01-01",
        EURCHF: "2020-01-01",
        GBPCHF: "2018-02-01",
      },
    })).toEqual([
      { currencyPair: "EURCHF", from: "2016-09-07", to: "2019-12-31" },
      { currencyPair: "GBPCHF", from: "2016-09-07", to: "2018-01-31" },
      { currencyPair: "USDCHF", from: "2016-09-07", to: "2019-12-31" },
    ]);
  });

  it("erzeugt keinen Backfillauftrag, wenn die Währung bereits den Stichtag abdeckt", () => {
    expect(buildHistoricalFxBackfillPlan({
      currencies: ["CHF", "USD"],
      requiredStartDate: "2016-09-07",
      earliestExistingByPair: { USDCHF: "2015-12-31" },
    })).toEqual([]);
  });

  it("dedupliziert EODHD-Tage und verwirft vorhandene, ungültige sowie ausserhalb des Plans liegende Raten", () => {
    expect(filterNewHistoricalFxRates({
      rows: [
        { date: "2016-09-07", close: 0.97 },
        { date: "2016-09-07", close: 0.98 },
        { date: "2016-09-08", close: 0 },
        { date: "2016-09-09", close: 0.96 },
        { date: "2020-01-01", close: 0.98 },
      ],
      existingDates: new Set(["2016-09-09"]),
      from: "2016-09-07",
      to: "2019-12-31",
    })).toEqual([
      { date: "2016-09-07", rate: 0.97 },
    ]);
  });

  it("importiert keine plausibilitätswidrigen Faktor-100-FX-Zeilen", () => {
    expect(filterNewHistoricalFxRates({
      rows: [
        { date: "2022-11-03", close: 0.095754 },
        { date: "2022-11-04", close: 0.000957 },
        { date: "2022-11-07", close: 0.0968 },
      ],
      existingDates: new Set(),
      from: "2022-11-01",
      to: "2022-11-10",
      currencyPair: "NOKCHF",
    })).toEqual([
      { date: "2022-11-03", rate: 0.095754 },
      { date: "2022-11-07", rate: 0.0968 },
    ]);
  });
});
