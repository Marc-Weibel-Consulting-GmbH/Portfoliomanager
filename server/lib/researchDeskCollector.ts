import {
  buildSecEvidenceCandidates,
  type SecEvidenceCandidate,
  type SecSubmissionsPayload,
} from "./secEvidence";

export const SEC_PILOT_UNIVERSE = [
  { ticker: "MSFT", cik: "0000789019" },
  { ticker: "GOOGL", cik: "0001652044" },
  { ticker: "META", cik: "0001326801" },
  { ticker: "AMZN", cik: "0001018724" },
  { ticker: "ORCL", cik: "0001341439" },
] as const;

export const SEC_PILOT_UNIVERSE_VERSION = "hyperscaler-us-v1";
export const SEC_SUBMISSIONS_SOURCE_VERSION = "sec-submissions-v1";

export type SecPilotUniverseEntry = (typeof SEC_PILOT_UNIVERSE)[number];

export interface ResearchDeskCollectionError {
  ticker: string;
  code: "fetch_failed";
  message: string;
}

export interface ResearchDeskCollectionResult {
  evidence: SecEvidenceCandidate[];
  tickersRequested: number;
  tickersFetched: number;
  evidenceObserved: number;
  evidenceIncomplete: number;
  errors: ResearchDeskCollectionError[];
}

export type SecSubmissionsFetcher = (cik: string) => Promise<SecSubmissionsPayload>;

/**
 * Stellt den öffentlichen, serverseitigen SEC-Abruf bereit. Der limitierte
 * Pilot ruft genau eine Submission-Historie pro Pilotemittent ab. Die Anfrage
 * ist klar identifiziert, zeitlich begrenzt und nutzt keine Browser-Scraper.
 */
export async function fetchSecSubmissions(cik: string): Promise<SecSubmissionsPayload> {
  const response = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, {
    headers: {
      "User-Agent": "Portfoliomanager Research Desk contact@portfolio.mw",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`SEC HTTP ${response.status}`);
  return response.json() as Promise<SecSubmissionsPayload>;
}

/**
 * Ruft jede CIK unabhängig ab. Eine temporär nicht erreichbare Quelle stoppt
 * weder das Restuniversum noch erzeugt sie eine synthetische Ersatz-Evidenz.
 */
export async function collectSecPilotEvidence(input: {
  universe?: readonly SecPilotUniverseEntry[];
  asOf?: Date;
  lookbackDays?: number;
  sourceVersion?: string;
  fetchSubmissions?: SecSubmissionsFetcher;
} = {}): Promise<ResearchDeskCollectionResult> {
  const universe = input.universe ?? SEC_PILOT_UNIVERSE;
  const asOf = input.asOf ?? new Date();
  const lookbackDays = input.lookbackDays ?? 7;
  const sourceVersion = input.sourceVersion ?? SEC_SUBMISSIONS_SOURCE_VERSION;
  const fetchSubmissions = input.fetchSubmissions ?? fetchSecSubmissions;
  const evidence: SecEvidenceCandidate[] = [];
  const errors: ResearchDeskCollectionError[] = [];
  let tickersFetched = 0;

  for (const entry of universe) {
    try {
      const payload = await fetchSubmissions(entry.cik);
      tickersFetched += 1;
      evidence.push(...buildSecEvidenceCandidates({
        payload,
        ticker: entry.ticker,
        cik: entry.cik,
        asOf,
        lookbackDays,
        sourceVersion,
      }));
    } catch (error) {
      errors.push({
        ticker: entry.ticker,
        code: "fetch_failed",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    evidence,
    tickersRequested: universe.length,
    tickersFetched,
    evidenceObserved: evidence.length,
    evidenceIncomplete: evidence.filter((entry) => entry.completenessStatus === "incomplete").length,
    errors,
  };
}
