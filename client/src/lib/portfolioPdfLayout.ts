type PortfolioPdfLayoutInput = {
  kpiCount: number;
  allocationRowCount: number;
};

/** Koordiniert die erste PDF-Seite dynamisch mit der tatsächlich sichtbaren KPI-Zahl. */
export function getPortfolioPdfLayout(input: PortfolioPdfLayoutInput) {
  const kpiRows = Math.max(1, Math.ceil(input.kpiCount / 3));
  const kpiBottom = 45 + (kpiRows - 1) * 25 + 21;
  const chartY = kpiBottom + 7;
  const chartHeight = kpiRows >= 3 ? 54 : 66;
  const allocationY = chartY + chartHeight + 10;
  const allocationRowCount = Math.min(7, Math.max(0, input.allocationRowCount));
  const allocationBottom = allocationY + 7 + allocationRowCount * 6;
  const qualityTop = allocationBottom + 8;
  return { kpiRows, kpiBottom, chartY, chartHeight, allocationY, qualityTop };
}
