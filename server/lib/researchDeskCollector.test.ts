import { describe, expect, it } from "vitest";
import { collectSecPilotEvidence, SEC_PILOT_UNIVERSE } from "./researchDeskCollector";
import type { SecSubmissionsPayload } from "./secEvidence";

const samplePayload: SecSubmissionsPayload = {
  cik: "0000789019",
  tickers: ["MSFT"],
  filings: {
    recent: {
      accessionNumber: ["0000789019-26-000111"],
      filingDate: ["2026-08-20"],
      reportDate: ["2026-08-19"],
      acceptanceDateTime: ["2026-08-20T18:42:00.000Z"],
      form: ["8-K"],
      primaryDocument: ["msft-8k.htm"],
      items: ["2.02"],
    },
  },
};

describe("Research Desk SEC Pilot Collector", () => {
  it("enthält nur das versionierte Hyperscaler-Universum mit gegen SEC verifizierten CIKs", () => {
    expect(SEC_PILOT_UNIVERSE).toEqual([
      { ticker: "MSFT", cik: "0000789019" },
      { ticker: "GOOGL", cik: "0001652044" },
      { ticker: "META", cik: "0001326801" },
      { ticker: "AMZN", cik: "0001018724" },
      { ticker: "ORCL", cik: "0001341439" },
    ]);
  });

  it("isoliert Quellenfehler je Ticker und liefert ausschliesslich Shadow-Evidenz des erfolgreichen Restuniversums", async () => {
    const result = await collectSecPilotEvidence({
      universe: SEC_PILOT_UNIVERSE.slice(0, 2),
      asOf: new Date("2026-08-21T12:00:00.000Z"),
      lookbackDays: 7,
      sourceVersion: "sec-submissions-v1",
      fetchSubmissions: async (cik) => {
        if (cik === "0001652044") throw new Error("SEC HTTP 503");
        return samplePayload;
      },
    });

    expect(result).toMatchObject({
      tickersRequested: 2,
      tickersFetched: 1,
      evidenceObserved: 1,
      evidenceIncomplete: 0,
      errors: [{ ticker: "GOOGL", code: "fetch_failed" }],
    });
    expect(result.evidence[0]).toMatchObject({
      ticker: "MSFT",
      isShadowMode: true,
      decisionImpact: "none",
    });
  });
});
