type RiskHeaderMetricInput = {
  dataAvailable?: unknown;
  sharpeRatio?: unknown;
  sharpeBenchmark?: unknown;
  maxDrawdown?: unknown;
  drawdownBenchmark?: unknown;
  riskWindowStatus?: unknown;
};

export type RiskHeaderStatus = "loading" | "error" | "unavailable" | "gate" | "ready";

export type RiskHeaderPresentation = {
  status: RiskHeaderStatus;
  canRetry: boolean;
  sharpe: { value: string; sub: string };
  maxDrawdown: { value: string; sub: string };
};

export type RiskHeaderQueryState = {
  isLoading: boolean;
  isError?: boolean;
};

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function missingRiskSub(status: unknown, metric: "sharpe" | "drawdown"): string {
  if (status === "insufficient_history") {
    return metric === "sharpe" ? "5J-Historie unvollständig" : "5J-Gate nicht erfüllt";
  }
  if (status === "incompatible_history") {
    return "Historische Datenlücke";
  }
  if (status === "five_year_without_stress") {
    return "Krisengate nicht erfüllt";
  }
  return metric === "sharpe" ? "Keine qualifizierte Risikoreihe" : "5J-Gate erforderlich";
}

function unavailablePresentation(status: "error" | "unavailable"): RiskHeaderPresentation {
  return status === "error"
    ? {
        status,
        canRetry: true,
        sharpe: { value: "—", sub: "Risikoanalyse vorübergehend nicht verfügbar" },
        maxDrawdown: { value: "—", sub: "Abruf fehlgeschlagen – erneut versuchen" },
      }
    : {
        status,
        canRetry: true,
        sharpe: { value: "—", sub: "Keine qualifizierte Risikoreihe" },
        maxDrawdown: { value: "—", sub: "Risikodaten nicht verfügbar" },
      };
}

/**
 * Keeps the compact portfolio header honest: loading, a failed request, an
 * explicit server-side no-data result, and a completed five-year quality gate
 * are four different states. A failed fetch must never be displayed as 0.00
 * or as a permanent history gap.
 */
export function getRiskHeaderPresentation(
  risk: RiskHeaderMetricInput | undefined,
  queryState: RiskHeaderQueryState,
): RiskHeaderPresentation {
  if (queryState.isLoading) {
    return {
      status: "loading",
      canRetry: false,
      sharpe: { value: "Wird berechnet…", sub: "5J-Risikoanalyse lädt" },
      maxDrawdown: { value: "Wird berechnet…", sub: "5J-Fenster wird geprüft" },
    };
  }

  if (queryState.isError) {
    return unavailablePresentation("error");
  }

  if (!risk || risk.dataAvailable === false) {
    return unavailablePresentation("unavailable");
  }

  const sharpeRatio = finiteNumber(risk.sharpeRatio);
  const sharpeBenchmark = finiteNumber(risk.sharpeBenchmark);
  const maxDrawdown = finiteNumber(risk.maxDrawdown);
  const drawdownBenchmark = finiteNumber(risk.drawdownBenchmark);
  const isValidatedGate = risk.riskWindowStatus === "five_year_with_stress";

  return {
    status: isValidatedGate ? "ready" : "gate",
    canRetry: false,
    sharpe: {
      value: sharpeRatio === null ? "—" : sharpeRatio.toFixed(2),
      sub: sharpeBenchmark === null
        ? missingRiskSub(risk.riskWindowStatus, "sharpe")
        : `Bench ${sharpeBenchmark.toFixed(2)}`,
    },
    maxDrawdown: {
      value: maxDrawdown === null ? "—" : `${maxDrawdown.toFixed(1)}%`,
      sub: drawdownBenchmark === null
        ? missingRiskSub(risk.riskWindowStatus, "drawdown")
        : `Bench ${drawdownBenchmark.toFixed(1)}%`,
    },
  };
}
