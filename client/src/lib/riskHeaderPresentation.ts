type RiskHeaderMetricInput = {
  dataAvailable?: unknown;
  annualizedReturn?: unknown;
  annualizedPriceReturn?: unknown;
  volatility?: unknown;
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
  priceReturn: { value: string; sub: string };
  annualReturn: { value: string; sub: string };
  volatility: { value: string; sub: string };
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
        priceReturn: { value: "—", sub: "Risikoanalyse vorübergehend nicht verfügbar" },
        annualReturn: { value: "—", sub: "Risikoanalyse vorübergehend nicht verfügbar" },
        volatility: { value: "—", sub: "Risikoanalyse vorübergehend nicht verfügbar" },
        sharpe: { value: "—", sub: "Risikoanalyse vorübergehend nicht verfügbar" },
        maxDrawdown: { value: "—", sub: "Abruf fehlgeschlagen – erneut versuchen" },
      }
    : {
        status,
        canRetry: true,
        priceReturn: { value: "—", sub: "Keine qualifizierte Risikoreihe" },
        annualReturn: { value: "—", sub: "Keine qualifizierte Risikoreihe" },
        volatility: { value: "—", sub: "Keine qualifizierte Risikoreihe" },
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
      priceReturn: { value: "Wird berechnet…", sub: "5J-Kursreihe lädt" },
      annualReturn: { value: "Wird berechnet…", sub: "5J-Allokationsproxy lädt" },
      volatility: { value: "Wird berechnet…", sub: "5J-Allokationsproxy lädt" },
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
  const annualizedReturn = finiteNumber(risk.annualizedReturn);
  const annualizedPriceReturn = finiteNumber(risk.annualizedPriceReturn);
  const volatility = finiteNumber(risk.volatility);
  const sharpeBenchmark = finiteNumber(risk.sharpeBenchmark);
  const maxDrawdown = finiteNumber(risk.maxDrawdown);
  const drawdownBenchmark = finiteNumber(risk.drawdownBenchmark);
  const isValidatedGate = risk.riskWindowStatus === "five_year_with_stress";

  return {
    status: isValidatedGate ? "ready" : "gate",
    canRetry: false,
    priceReturn: {
      value: annualizedPriceReturn === null ? "—" : `${annualizedPriceReturn >= 0 ? "+" : ""}${annualizedPriceReturn.toFixed(1)}%`,
      sub: annualizedPriceReturn === null ? missingRiskSub(risk.riskWindowStatus, "sharpe") : "5J-Proxy · p.a. · ohne Div.",
    },
    annualReturn: {
      value: annualizedReturn === null ? "—" : `${annualizedReturn >= 0 ? "+" : ""}${annualizedReturn.toFixed(1)}%`,
      sub: annualizedReturn === null ? missingRiskSub(risk.riskWindowStatus, "sharpe") : "5J-Proxy · p.a. · inkl. Div.",
    },
    volatility: {
      value: volatility === null ? "—" : `${volatility.toFixed(1)}%`,
      sub: volatility === null ? missingRiskSub(risk.riskWindowStatus, "sharpe") : "5J-Proxy · p.a.",
    },
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
