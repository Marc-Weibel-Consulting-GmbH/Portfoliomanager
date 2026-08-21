import { createHash } from "node:crypto";
import { assertShadowModeOnly } from "./researchDeskShadow";

export interface SecSubmissionsPayload {
  cik?: string;
  tickers?: string[];
  filings: {
    recent: {
      accessionNumber: string[];
      filingDate: string[];
      reportDate: string[];
      acceptanceDateTime: string[];
      form: string[];
      primaryDocument: string[];
      items: string[];
    };
  };
}

export type SecEventType = "filing_8k" | "periodic_report" | "insider_form4";
export type EvidenceCompletenessStatus = "complete" | "incomplete";
export type EvidenceCheckerStatus = "pending" | "rejected";

export interface SecEvidenceCandidate {
  evidenceKey: string;
  ticker: string;
  cik: string;
  eventType: SecEventType;
  formType: string;
  sourceUrl: string;
  sourcePublishedAt: Date | null;
  fetchedAt: Date;
  sourceVersion: string;
  rawHash: string;
  rawPayload: Record<string, unknown>;
  isShadowMode: boolean;
  decisionImpact: "none";
  completenessStatus: EvidenceCompletenessStatus;
  checkerStatus: EvidenceCheckerStatus;
  validationReasons: string[];
}

function normaliseCik(cik: string): string {
  return cik.replace(/\D/g, "").padStart(10, "0");
}

function makeSecSourceUrl(cik: string, accessionNumber: string, primaryDocument: string): string {
  const archiveCik = String(Number(normaliseCik(cik)));
  const accession = accessionNumber.replaceAll("-", "");
  const base = `https://www.sec.gov/Archives/edgar/data/${archiveCik}/${accession}`;
  return primaryDocument ? `${base}/${primaryDocument}` : `${base}/`;
}

function classifyForm(formType: string): SecEventType | null {
  if (formType === "8-K") return "filing_8k";
  if (["10-Q", "10-K", "20-F", "40-F", "6-K"].includes(formType)) return "periodic_report";
  if (formType === "4") return "insider_form4";
  return null;
}

function parseTimestamp(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function hashPayload(payload: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function makeSecEvidenceKey(cik: string, accessionNumber: string): string {
  return `sec:${normaliseCik(cik)}:${accessionNumber}`;
}

/**
 * Wandelt die kompakte SEC-Submissionhistorie ohne heuristische Bewertung in
 * versionierte Roh-Evidenz um. Die Funktion erzeugt bewusst keine Scores,
 * Empfehlungen oder Handelssignale.
 */
export function buildSecEvidenceCandidates(input: {
  payload: SecSubmissionsPayload;
  ticker: string;
  cik: string;
  asOf: Date;
  lookbackDays: number;
  sourceVersion: string;
}): SecEvidenceCandidate[] {
  const { recent } = input.payload.filings;
  const since = new Date(input.asOf.getTime() - input.lookbackDays * 86_400_000);
  const candidates: SecEvidenceCandidate[] = [];
  const rowCount = recent.accessionNumber.length;

  for (let i = 0; i < rowCount; i++) {
    const accessionNumber = recent.accessionNumber[i];
    const formType = recent.form[i];
    const eventType = classifyForm(formType);
    const filingDate = parseTimestamp(recent.filingDate[i]);
    if (!accessionNumber || !eventType || !filingDate || filingDate < since || filingDate > input.asOf) continue;

    const sourcePublishedAt = parseTimestamp(recent.acceptanceDateTime[i]);
    const primaryDocument = recent.primaryDocument[i] ?? "";
    const rawPayload = {
      accessionNumber,
      filingDate: recent.filingDate[i] ?? null,
      reportDate: recent.reportDate[i] ?? null,
      acceptanceDateTime: recent.acceptanceDateTime[i] ?? null,
      form: formType,
      primaryDocument: primaryDocument || null,
      items: recent.items[i] ?? null,
    };
    const validationReasons: string[] = [];
    if (!sourcePublishedAt) validationReasons.push("missing_acceptance_timestamp");
    if (!primaryDocument) validationReasons.push("missing_primary_document");
    const completenessStatus: EvidenceCompletenessStatus = validationReasons.length === 0 ? "complete" : "incomplete";
    const checkerStatus: EvidenceCheckerStatus = completenessStatus === "complete" ? "pending" : "rejected";
    assertShadowModeOnly({ isShadowMode: true, decisionImpact: "none" });

    candidates.push({
      evidenceKey: makeSecEvidenceKey(input.cik, accessionNumber),
      ticker: input.ticker.toUpperCase(),
      cik: normaliseCik(input.cik),
      eventType,
      formType,
      sourceUrl: makeSecSourceUrl(input.cik, accessionNumber, primaryDocument),
      sourcePublishedAt,
      fetchedAt: input.asOf,
      sourceVersion: input.sourceVersion,
      rawHash: hashPayload(rawPayload),
      rawPayload,
      isShadowMode: true,
      decisionImpact: "none",
      completenessStatus,
      checkerStatus,
      validationReasons,
    });
  }

  return candidates;
}
