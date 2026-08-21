import { describe, expect, it } from "vitest";
import {
  buildSecEvidenceCandidates,
  makeSecEvidenceKey,
  type SecSubmissionsPayload,
} from "./secEvidence";

const asOf = new Date("2026-08-21T12:00:00.000Z");

const payload: SecSubmissionsPayload = {
  cik: "0000789019",
  tickers: ["MSFT"],
  filings: {
    recent: {
      accessionNumber: ["0000789019-26-000111", "0000789019-26-000222", "0000789019-26-000333", "0000789019-25-000444"],
      filingDate: ["2026-08-20", "2026-08-19", "2026-08-18", "2025-01-01"],
      reportDate: ["2026-08-19", "2026-06-30", "2026-08-17", "2024-12-31"],
      acceptanceDateTime: ["2026-08-20T18:42:00.000Z", "2026-08-19T14:03:00.000Z", "2026-08-18T20:12:00.000Z", "2025-01-01T08:00:00.000Z"],
      form: ["8-K", "10-Q", "4", "10-K"],
      primaryDocument: ["msft-8k.htm", "msft-10q.htm", "xslF345X02/form4.xml", "msft-10k.htm"],
      items: ["2.02,7.01", "", "", ""],
    },
  },
};

describe("SEC Evidence Candidate Contract", () => {
  it("normalisiert nur zeitlich passende, unterstützte Filing-Evidenz ohne Score- oder Handelssignal", () => {
    const candidates = buildSecEvidenceCandidates({
      payload,
      ticker: "MSFT",
      cik: "0000789019",
      asOf,
      lookbackDays: 7,
      sourceVersion: "sec-submissions-v1",
    });

    expect(candidates).toHaveLength(3);
    expect(candidates.map((c) => c.eventType)).toEqual([
      "filing_8k",
      "periodic_report",
      "insider_form4",
    ]);
    expect(candidates.every((c) => c.isShadowMode)).toBe(true);
    expect(candidates.every((c) => c.checkerStatus === "pending")).toBe(true);
    expect(candidates.every((c) => c.decisionImpact === "none")).toBe(true);
    expect(candidates.every((c) => !Object.hasOwn(c, "score") && !Object.hasOwn(c, "recommendation"))).toBe(true);
    expect(candidates[0]).toMatchObject({
      ticker: "MSFT",
      cik: "0000789019",
      formType: "8-K",
      sourcePublishedAt: new Date("2026-08-20T18:42:00.000Z"),
      sourceVersion: "sec-submissions-v1",
      sourceUrl: "https://www.sec.gov/Archives/edgar/data/789019/000078901926000111/msft-8k.htm",
    });
  });

  it("erzeugt einen stabilen, quellengebundenen Idempotenzschlüssel", () => {
    expect(makeSecEvidenceKey("0000789019", "0000789019-26-000111"))
      .toBe("sec:0000789019:0000789019-26-000111");
    expect(makeSecEvidenceKey("0000789019", "0000789019-26-000111"))
      .not.toBe(makeSecEvidenceKey("0000789019", "0000789019-26-000222"));
  });

  it("markiert unvollständige SEC-Zeilen als nicht verarbeitet statt fehlende Zeitstempel zu erfinden", () => {
    const incomplete: SecSubmissionsPayload = {
      ...payload,
      filings: {
        recent: {
          accessionNumber: ["0000789019-26-000555"],
          filingDate: ["2026-08-20"],
          reportDate: [""],
          acceptanceDateTime: [""],
          form: ["8-K"],
          primaryDocument: [""],
          items: [""],
        },
      },
    };

    const candidates = buildSecEvidenceCandidates({
      payload: incomplete,
      ticker: "MSFT",
      cik: "0000789019",
      asOf,
      lookbackDays: 7,
      sourceVersion: "sec-submissions-v1",
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      completenessStatus: "incomplete",
      sourcePublishedAt: null,
      checkerStatus: "rejected",
      validationReasons: expect.arrayContaining(["missing_acceptance_timestamp"]),
    });
  });
});
