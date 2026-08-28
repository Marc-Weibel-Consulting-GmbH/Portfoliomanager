import { describe, expect, it } from "vitest";
import {
  buildAiCapitalCycleAssessment,
  type CapitalCycleMetric,
  type CapitalCycleEvidence,
} from "./aiCapitalCycleWatchlist";

const now = new Date("2026-08-25T12:00:00.000Z");

const freshMetrics: CapitalCycleMetric[] = [
  {
    metricKey: "hyperscaler_capex_yoy",
    displayValue: "+38% YoY",
    source: "FactSet, August 2026",
    fetchedAt: new Date("2026-08-25T06:00:00.000Z"),
  },
  {
    metricKey: "tech_ig_spread_bps",
    displayValue: "112 bps",
    source: "ICE BofA, August 2026",
    fetchedAt: new Date("2026-08-25T06:00:00.000Z"),
  },
];

const secEvidence: CapitalCycleEvidence[] = [
  {
    ticker: "MSFT",
    formType: "10-Q",
    sourceUrl: "https://www.sec.gov/Archives/edgar/data/789019/example.htm",
    sourcePublishedAt: new Date("2026-07-30T00:00:00.000Z"),
    completenessStatus: "complete",
    checkerStatus: "reviewed",
  },
];

describe("buildAiCapitalCycleAssessment", () => {
  it("ordnet einen Hyperscaler quellengebunden ein und begrenzt jede Handlung auf manuelle Prüfung", () => {
    const result = buildAiCapitalCycleAssessment({
      ticker: "MSFT",
      companyName: "Microsoft Corp.",
      sector: "Technology",
      now,
      metrics: freshMetrics,
      evidence: secEvidence,
    });

    expect(result.role).toBe("kapitalinvestor");
    expect(result.monitoringStatus).toBe("beobachten");
    expect(result.manualAction).toBe("manuell_pruefen");
    expect(result.decisionImpact).toBe("none");
    expect(result.sourceRefs).toContain("FactSet, August 2026");
    expect(result.sourceRefs).toContain("https://www.sec.gov/Archives/edgar/data/789019/example.htm");
  });

  it("stuft unzureichend frische Marktquellen als nicht entscheidungsreif ein und gibt keine Richtungsempfehlung", () => {
    const result = buildAiCapitalCycleAssessment({
      ticker: "NVDA",
      companyName: "NVIDIA Corp.",
      sector: "Technology",
      now,
      metrics: [{ ...freshMetrics[0], fetchedAt: new Date("2026-08-20T00:00:00.000Z") }],
      evidence: [],
    });

    expect(result.role).toBe("infrastrukturzulieferer");
    expect(result.monitoringStatus).toBe("daten_pruefen");
    expect(result.manualAction).toBe("keine_handlung");
    expect(result.decisionImpact).toBe("none");
  });

  it("zeigt für nicht zuordenbare Watchlist-Titel transparent keine künstliche KI-These", () => {
    const result = buildAiCapitalCycleAssessment({
      ticker: "NESN.SW",
      companyName: "Nestlé S.A.",
      sector: "Consumer Defensive",
      now,
      metrics: freshMetrics,
      evidence: [],
    });

    expect(result.role).toBe("nicht_zugeordnet");
    expect(result.monitoringStatus).toBe("nicht_relevant");
    expect(result.manualAction).toBe("keine_handlung");
    expect(result.decisionImpact).toBe("none");
  });

  it("dedupliziert Quellen und kennzeichnet unvollständige SEC-Evidenz statt sie als Bestätigung auszugeben", () => {
    const result = buildAiCapitalCycleAssessment({
      ticker: "ORCL",
      companyName: "Oracle Corporation",
      sector: "Technology",
      now,
      metrics: [
        ...freshMetrics,
        { ...freshMetrics[0], metricKey: "hyperscaler_capex_yoy" },
      ],
      evidence: [{
        ticker: "ORCL",
        formType: "8-K",
        sourceUrl: "https://www.sec.gov/Archives/edgar/data/1341439/example.htm",
        sourcePublishedAt: new Date("2026-08-01T00:00:00.000Z"),
        completenessStatus: "incomplete",
        checkerStatus: "pending",
      }],
    });

    expect(result.sourceRefs.filter((source) => source === "FactSet, August 2026")).toHaveLength(1);
    expect(result.secEvidence.status).toBe("unvollstaendig");
    expect(result.manualAction).toBe("manuell_pruefen");
    expect(result.decisionImpact).toBe("none");
  });
});
