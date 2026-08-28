/**
 * Ableitung fuer das beobachtende Watchlist-x-Capital-Cycle-Overlay.
 *
 * Die Funktion ist bewusst rein: Sie schreibt keine Daten und kennt weder Scores,
 * Portfolios, Alerts noch Handelsauftraege. Die einzige erlaubte Aktion ist ein
 * nicht bindender Hinweis zur manuellen Pruefung.
 */

export const AI_CAPITAL_CYCLE_FRESHNESS_HOURS = 36;

export type CapitalCycleRole =
  | "kapitalinvestor"
  | "infrastrukturzulieferer"
  | "energie_infrastruktur"
  | "finanzierung"
  | "nicht_zugeordnet";

export type CapitalCycleMonitoringStatus = "beobachten" | "daten_pruefen" | "nicht_relevant";
export type CapitalCycleManualAction = "manuell_pruefen" | "keine_handlung";
export type CapitalCycleFreshnessStatus = "aktuell" | "veraltet" | "fehlt" | "nicht_anwendbar";
export type CapitalCycleEvidenceStatus = "bestaetigt" | "ausstehend" | "unvollstaendig" | "nicht_im_sec_pilot";

export interface CapitalCycleMetric {
  metricKey: string;
  displayValue: string;
  source: string;
  fetchedAt: Date;
}

export interface CapitalCycleEvidence {
  ticker: string;
  formType: string;
  sourceUrl: string;
  sourcePublishedAt: Date | null;
  completenessStatus: string;
  checkerStatus: string;
}

export interface AiCapitalCycleAssessmentInput {
  ticker: string;
  companyName: string;
  sector: string | null | undefined;
  now: Date;
  metrics: CapitalCycleMetric[];
  evidence: CapitalCycleEvidence[];
}

export interface AiCapitalCycleAssessment {
  ticker: string;
  role: CapitalCycleRole;
  monitoringStatus: CapitalCycleMonitoringStatus;
  manualAction: CapitalCycleManualAction;
  decisionImpact: "none";
  explanation: string;
  sourceRefs: string[];
  sourceFreshness: {
    status: CapitalCycleFreshnessStatus;
    latestMetricFetchedAt: Date | null;
    staleAfterHours: number;
    requiredMetricKeys: string[];
    staleOrMissingMetricKeys: string[];
  };
  secEvidence: {
    status: CapitalCycleEvidenceStatus;
    count: number;
    latestSourcePublishedAt: Date | null;
  };
}

const ROLE_BY_TICKER: Readonly<Record<string, CapitalCycleRole>> = {
  // Der SEC-Research-Desk-Pilot und die eindeutigsten Hyperscaler.
  MSFT: "kapitalinvestor",
  GOOGL: "kapitalinvestor",
  GOOG: "kapitalinvestor",
  META: "kapitalinvestor",
  AMZN: "kapitalinvestor",
  ORCL: "kapitalinvestor",
  // Lieferkette der Rechen- und Netzwerkinfrastruktur. Keine Sektor-Inferenz.
  NVDA: "infrastrukturzulieferer",
  AVGO: "infrastrukturzulieferer",
  AMD: "infrastrukturzulieferer",
  TSM: "infrastrukturzulieferer",
  ASML: "infrastrukturzulieferer",
  AMAT: "infrastrukturzulieferer",
  LRCX: "infrastrukturzulieferer",
  MU: "infrastrukturzulieferer",
  VRT: "infrastrukturzulieferer",
  ANET: "infrastrukturzulieferer",
  // Energieanbieter werden nur bei direkter, vorab definierter Zuordnung erfasst.
  CEG: "energie_infrastruktur",
  VST: "energie_infrastruktur",
};

const REQUIRED_METRICS_BY_ROLE: Readonly<Record<Exclude<CapitalCycleRole, "nicht_zugeordnet">, readonly string[]>> = {
  kapitalinvestor: ["hyperscaler_capex_yoy", "tech_ig_spread_bps"],
  infrastrukturzulieferer: ["hyperscaler_capex_yoy"],
  energie_infrastruktur: ["hyperscaler_capex_yoy"],
  finanzierung: ["tech_ig_spread_bps", "tech_spread_change_bps"],
};

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase().split(/[.\s]/, 1)[0] ?? "";
}

function newestDate(dates: Array<Date | null | undefined>): Date | null {
  const valid = dates.filter((value): value is Date => value instanceof Date && !Number.isNaN(value.getTime()));
  if (valid.length === 0) return null;
  return new Date(Math.max(...valid.map((value) => value.getTime())));
}

function isFresh(metric: CapitalCycleMetric, now: Date): boolean {
  const ageMs = now.getTime() - metric.fetchedAt.getTime();
  return ageMs >= 0 && ageMs <= AI_CAPITAL_CYCLE_FRESHNESS_HOURS * 60 * 60 * 1000;
}

function deduplicateNonEmpty(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
}

function evidenceStatus(evidence: CapitalCycleEvidence[]): CapitalCycleEvidenceStatus {
  if (evidence.length === 0) return "nicht_im_sec_pilot";
  if (evidence.some((item) => item.completenessStatus !== "complete")) return "unvollstaendig";
  if (evidence.some((item) => item.checkerStatus === "reviewed")) return "bestaetigt";
  return "ausstehend";
}

/**
 * Erstellt eine watchlistnahe, rein beobachtende Einschätzung.
 *
 * Ein frischer Metrikcache ist eine Mindestvoraussetzung, niemals jedoch eine
 * Handelsfreigabe. SEC-Evidenz wird separat ausgewiesen, weil der Pilot nicht
 * die gesamte Watchlist abdeckt und die Monitoringquelle keine Issuer-Filings
 * ersetzt.
 */
export function buildAiCapitalCycleAssessment(input: AiCapitalCycleAssessmentInput): AiCapitalCycleAssessment {
  const ticker = normalizeTicker(input.ticker);
  const role = ROLE_BY_TICKER[ticker] ?? "nicht_zugeordnet";
  const evidence = input.evidence.filter((item) => normalizeTicker(item.ticker) === ticker);
  const evidenceSourceRefs = deduplicateNonEmpty(evidence.map((item) => item.sourceUrl));
  const secStatus = evidenceStatus(evidence);
  const latestEvidenceAt = newestDate(evidence.map((item) => item.sourcePublishedAt));

  if (role === "nicht_zugeordnet") {
    return {
      ticker,
      role,
      monitoringStatus: "nicht_relevant",
      manualAction: "keine_handlung",
      decisionImpact: "none",
      explanation: "Keine vorab definierte Zuordnung zum KI-Kapitalzyklus. Das Overlay leitet keine KI-These allein aus Sektor oder Firmenname ab.",
      sourceRefs: evidenceSourceRefs,
      sourceFreshness: {
        status: "nicht_anwendbar",
        latestMetricFetchedAt: null,
        staleAfterHours: AI_CAPITAL_CYCLE_FRESHNESS_HOURS,
        requiredMetricKeys: [],
        staleOrMissingMetricKeys: [],
      },
      secEvidence: { status: secStatus, count: evidence.length, latestSourcePublishedAt: latestEvidenceAt },
    };
  }

  const requiredMetricKeys = [...REQUIRED_METRICS_BY_ROLE[role]];
  const latestMetricByKey = new Map<string, CapitalCycleMetric>();
  for (const metric of input.metrics) {
    const previous = latestMetricByKey.get(metric.metricKey);
    if (!previous || metric.fetchedAt.getTime() > previous.fetchedAt.getTime()) {
      latestMetricByKey.set(metric.metricKey, metric);
    }
  }
  const sourceRefs = deduplicateNonEmpty([
    ...requiredMetricKeys.map((metricKey) => latestMetricByKey.get(metricKey)?.source),
    ...evidenceSourceRefs,
  ]);

  const staleOrMissingMetricKeys = requiredMetricKeys.filter((metricKey) => {
    const metric = latestMetricByKey.get(metricKey);
    return !metric || !isFresh(metric, input.now);
  });
  const latestMetricFetchedAt = newestDate(requiredMetricKeys.map((metricKey) => latestMetricByKey.get(metricKey)?.fetchedAt));
  const freshness: CapitalCycleFreshnessStatus = staleOrMissingMetricKeys.length > 0
    ? (requiredMetricKeys.some((key) => !latestMetricByKey.has(key)) ? "fehlt" : "veraltet")
    : "aktuell";

  if (freshness !== "aktuell") {
    return {
      ticker,
      role,
      monitoringStatus: "daten_pruefen",
      manualAction: "keine_handlung",
      decisionImpact: "none",
      explanation: `Die erforderlichen globalen Monitoringdaten sind ${freshness === "fehlt" ? "unvollständig" : `älter als ${AI_CAPITAL_CYCLE_FRESHNESS_HOURS} Stunden`}. Deshalb keine Handlung ableiten; zuerst Datenlage prüfen.`,
      sourceRefs,
      sourceFreshness: {
        status: freshness,
        latestMetricFetchedAt,
        staleAfterHours: AI_CAPITAL_CYCLE_FRESHNESS_HOURS,
        requiredMetricKeys,
        staleOrMissingMetricKeys,
      },
      secEvidence: { status: secStatus, count: evidence.length, latestSourcePublishedAt: latestEvidenceAt },
    };
  }

  const evidenceNote = secStatus === "bestaetigt"
    ? "Passende SEC-Shadow-Evidenz wurde geprüft."
    : secStatus === "nicht_im_sec_pilot"
      ? "Für diesen Titel liegt im begrenzten SEC-Pilot keine Einzelevidenz vor."
      : "Vorliegende SEC-Shadow-Evidenz ist noch nicht vollständig menschlich geprüft.";

  return {
    ticker,
    role,
    monitoringStatus: "beobachten",
    manualAction: "manuell_pruefen",
    decisionImpact: "none",
    explanation: `Zuordnung als ${role.replace("_", " ")}. Der globale Monitoring-Cache liegt innerhalb der Frischegrenze; den Quellenzeitraum zeigt die jeweilige Quellenangabe. ${evidenceNote} Der Hinweis ist nicht bindend und verändert weder Score, Signal, Alert noch Handel.`,
    sourceRefs,
    sourceFreshness: {
      status: "aktuell",
      latestMetricFetchedAt,
      staleAfterHours: AI_CAPITAL_CYCLE_FRESHNESS_HOURS,
      requiredMetricKeys,
      staleOrMissingMetricKeys: [],
    },
    secEvidence: { status: secStatus, count: evidence.length, latestSourcePublishedAt: latestEvidenceAt },
  };
}
