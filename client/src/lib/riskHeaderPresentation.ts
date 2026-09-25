type RiskHeaderMetricInput = {
  sharpeRatio?: unknown;
  sharpeBenchmark?: unknown;
  maxDrawdown?: unknown;
  drawdownBenchmark?: unknown;
  riskWindowStatus?: unknown;
};

export type RiskHeaderPresentation = {
  sharpe: { value: string; sub: string };
  maxDrawdown: { value: string; sub: string };
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
    return metric === "sharpe" ? "Krisengate nicht erfüllt" : "Krisengate nicht erfüllt";
  }
  return metric === "sharpe" ? "Keine qualifizierte Risikoreihe" : "5J-Gate erforderlich";
}

/**
 * Keeps the compact portfolio header honest: an in-flight five-year risk query
 * is visibly loading, while a completed quality gate remains a data-limitation.
 */
export function getRiskHeaderPresentation(
  risk: RiskHeaderMetricInput | undefined,
  isLoading: boolean,
): RiskHeaderPresentation {
  if (isLoading) {
    return {
      sharpe: { value: "Wird berechnet…", sub: "5J-Risikoanalyse lädt" },
      maxDrawdown: { value: "Wird berechnet…", sub: "5J-Fenster wird geprüft" },
    };
  }

  const sharpeRatio = finiteNumber(risk?.sharpeRatio);
  const sharpeBenchmark = finiteNumber(risk?.sharpeBenchmark);
  const maxDrawdown = finiteNumber(risk?.maxDrawdown);
  const drawdownBenchmark = finiteNumber(risk?.drawdownBenchmark);

  return {
    sharpe: {
      value: sharpeRatio === null ? "—" : sharpeRatio.toFixed(2),
      sub: sharpeBenchmark === null
        ? missingRiskSub(risk?.riskWindowStatus, "sharpe")
        : `Bench ${sharpeBenchmark.toFixed(2)}`,
    },
    maxDrawdown: {
      value: maxDrawdown === null ? "—" : `${maxDrawdown.toFixed(1)}%`,
      sub: drawdownBenchmark === null
        ? missingRiskSub(risk?.riskWindowStatus, "drawdown")
        : `Bench ${drawdownBenchmark.toFixed(1)}%`,
    },
  };
}
