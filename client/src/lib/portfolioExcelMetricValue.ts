export type PortfolioExcelMetricInput = {
  value: number | null;
  unit: "CHF" | "percent" | "ratio";
};

/** Übersetzt Anzeigeprozentpunkte in die Dezimalbasis des nativen Excel-Prozentformats. */
export function getPortfolioExcelMetricValue(input: PortfolioExcelMetricInput): number | string {
  if (input.value === null || !Number.isFinite(input.value)) return "n/a";
  return input.unit === "percent" ? input.value / 100 : input.value;
}
