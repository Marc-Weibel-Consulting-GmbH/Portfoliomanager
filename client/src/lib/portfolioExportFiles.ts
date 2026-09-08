import type { PortfolioExportKpi, PortfolioExportModel } from "./portfolioExportModel";
import { portfolioExportFilenameStem } from "./portfolioExportModel";
import { getPortfolioExcelMetricValue } from "./portfolioExcelMetricValue";
import { getPortfolioPdfKpiKeys } from "./portfolioPdfKpis";
import { getPortfolioPdfLayout } from "./portfolioPdfLayout";

const COLORS = {
  navy: "0F172A",
  surface: "172033",
  teal: "00CFC1",
  tealDark: "007D74",
  gray: "64748B",
  light: "EAF3F5",
  border: "CBD5E1",
  positive: "008C7C",
  negative: "C2415A",
  warning: "B45309",
};

function formatCHF(value: number | null | undefined, fractionDigits = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("de-CH", {
    style: "currency",
    currency: "CHF",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value.toLocaleString("de-CH", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
}

function formatRatio(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatKpi(kpi: PortfolioExportKpi): string {
  if (kpi.unit === "CHF") return formatCHF(kpi.value);
  if (kpi.unit === "percent") return formatPercent(kpi.value);
  return formatRatio(kpi.value);
}

function toExcelValue(kpi: PortfolioExportKpi): number | string {
  return kpi.value ?? "n/a";
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function applyHeader(row: any, color = COLORS.navy) {
  row.eachCell((cell: any) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
    cell.font = { name: "Aptos", color: { argb: "FFFFFF" }, bold: true, size: 10 };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { bottom: { style: "medium", color: { argb: COLORS.teal } } };
  });
  row.height = 26;
}

function applyTableBorders(worksheet: any, fromRow: number, toRow: number, fromCol: number, toCol: number) {
  for (let row = fromRow; row <= toRow; row += 1) {
    for (let col = fromCol; col <= toCol; col += 1) {
      const cell = worksheet.getCell(row, col);
      cell.border = {
        top: { style: "thin", color: { argb: COLORS.border } },
        bottom: { style: "thin", color: { argb: COLORS.border } },
      };
    }
  }
}

function setCurrencyColumn(worksheet: any, column: string) {
  worksheet.getColumn(column).numFmt = 'CHF #,##0;[Red]-CHF #,##0;—';
}

function setPercentColumn(worksheet: any, column: string) {
  worksheet.getColumn(column).numFmt = '0.0%;[Red]-0.0%;—';
}

/** Erzeugt eine formatierte XLSX-Arbeitsmappe direkt im Browser. */
export async function downloadPortfolioExcel(model: PortfolioExportModel): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Portfoliomanager";
  workbook.created = model.asOf;
  workbook.modified = model.asOf;
  workbook.title = `Portfolioexport – ${model.title}`;
  workbook.subject = "Portfolioübersicht, Kennzahlen und Titel";

  const overview = workbook.addWorksheet("Übersicht", { views: [{ showGridLines: false }] });
  overview.properties.defaultRowHeight = 18;
  overview.columns = [
    { key: "margin", width: 3 },
    { key: "label", width: 28 },
    { key: "value", width: 20 },
    { key: "unit", width: 14 },
    { key: "definition", width: 74 },
  ];
  overview.mergeCells("B2:E2");
  const titleCell = overview.getCell("B2");
  titleCell.value = `Portfolioreport · ${model.title}`;
  titleCell.font = { name: "Aptos Display", size: 20, bold: true, color: { argb: COLORS.navy } };
  titleCell.alignment = { vertical: "middle" };
  overview.getRow(2).height = 32;
  overview.mergeCells("B3:E3");
  overview.getCell("B3").value = `Datenstand: ${model.asOfLabel} · Zeitraum: ${model.periodLabel} · Referenzwährung: ${model.referenceCurrency} · ${model.isLive ? "Live-Portfolio" : "Demo-Portfolio"}`;
  overview.getCell("B3").font = { name: "Aptos", size: 10, color: { argb: COLORS.gray } };

  overview.mergeCells("B5:E5");
  overview.getCell("B5").value = "PORTFOLIO-KENNZAHLEN";
  overview.getCell("B5").fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.light } };
  overview.getCell("B5").font = { name: "Aptos", size: 11, bold: true, color: { argb: COLORS.navy } };
  overview.getRow(5).height = 24;

  const kpiHeader = overview.addRow(["", "Kennzahl", "Wert", "Einheit", "Definition"]);
  applyHeader(kpiHeader);
  const kpiStartRow = kpiHeader.number + 1;
  for (const kpi of model.kpis) {
    const row = overview.addRow(["", kpi.label, getPortfolioExcelMetricValue(kpi), kpi.unit === "CHF" ? "CHF" : kpi.unit === "percent" ? "%" : "Ratio", kpi.definition]);
    row.getCell(2).font = { name: "Aptos", bold: true, color: { argb: COLORS.navy } };
    row.getCell(3).alignment = { horizontal: "right" };
    row.getCell(4).alignment = { horizontal: "center" };
    row.getCell(5).alignment = { wrapText: true, vertical: "middle" };
    row.height = 24;
    if (kpi.unit === "CHF" && typeof kpi.value === "number") row.getCell(3).numFmt = 'CHF #,##0;[Red]-CHF #,##0;—';
    if (kpi.unit === "percent" && typeof kpi.value === "number") row.getCell(3).numFmt = '0.0%;[Red]-0.0%;—';
    if (kpi.unit === "ratio" && typeof kpi.value === "number") row.getCell(3).numFmt = '0.00';
  }
  applyTableBorders(overview, kpiStartRow, overview.lastRow.number, 2, 5);

  const allocationStart = overview.lastRow.number + 3;
  overview.mergeCells(`B${allocationStart}:E${allocationStart}`);
  overview.getCell(`B${allocationStart}`).value = "ALLOKATION NACH SEKTOR";
  overview.getCell(`B${allocationStart}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.light } };
  overview.getCell(`B${allocationStart}`).font = { name: "Aptos", size: 11, bold: true, color: { argb: COLORS.navy } };
  const allocationHeader = overview.addRow(["", "Sektor", "Gewicht", "", ""]);
  applyHeader(allocationHeader, COLORS.tealDark);
  const allocationRowsStart = allocationHeader.number + 1;
  for (const row of model.sectorAllocation) {
    const added = overview.addRow(["", row.name, row.weightPct / 100, "", ""]);
    added.getCell(3).numFmt = '0.0%';
    added.getCell(3).alignment = { horizontal: "right" };
  }
  if (model.sectorAllocation.length > 0) applyTableBorders(overview, allocationRowsStart, overview.lastRow.number, 2, 3);

  const noteStart = overview.lastRow.number + 3;
  overview.mergeCells(`B${noteStart}:E${noteStart}`);
  overview.getCell(`B${noteStart}`).value = "DATENQUALITÄT & HINWEISE";
  overview.getCell(`B${noteStart}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7ED" } };
  overview.getCell(`B${noteStart}`).font = { name: "Aptos", size: 11, bold: true, color: { argb: COLORS.warning } };
  const notes = model.dataQualityNotes.length > 0 ? model.dataQualityNotes : ["Keine Datenqualitätswarnungen im Exportmodell."];
  notes.forEach((note) => {
    const row = overview.addRow(["", note]);
    overview.mergeCells(`B${row.number}:E${row.number}`);
    row.getCell(2).font = { name: "Aptos", size: 10, color: { argb: COLORS.gray } };
    row.getCell(2).alignment = { wrapText: true, vertical: "middle" };
    row.height = 28;
  });
  overview.mergeCells(`B${overview.lastRow.number + 2}:E${overview.lastRow.number + 2}`);
  overview.getCell(`B${overview.lastRow.number}`).value = "Quelle: Portfoliomanager-Portfoliovertrag, Performance-Ledger und aktuelle Positionen. Kennzahlen sind Momentaufnahmen, keine Anlageempfehlung.";
  overview.getCell(`B${overview.lastRow.number}`).font = { name: "Aptos", size: 9, italic: true, color: { argb: COLORS.gray } };
  overview.getCell(`B${overview.lastRow.number}`).alignment = { wrapText: true };

  const positions = workbook.addWorksheet("Titelliste", { views: [{ showGridLines: false, state: "frozen", ySplit: 4 }] });
  positions.columns = [
    { key: "ticker", width: 15 },
    { key: "company", width: 28 },
    { key: "isin", width: 16 },
    { key: "sector", width: 20 },
    { key: "currency", width: 11 },
    { key: "shares", width: 12 },
    { key: "price", width: 15 },
    { key: "value", width: 17 },
    { key: "weight", width: 13 },
    { key: "ytd", width: 13 },
    { key: "total", width: 14 },
    { key: "status", width: 30 },
  ];
  positions.mergeCells("A1:L1");
  positions.getCell("A1").value = `Titelliste · ${model.title}`;
  positions.getCell("A1").font = { name: "Aptos Display", size: 18, bold: true, color: { argb: COLORS.navy } };
  positions.getRow(1).height = 30;
  positions.mergeCells("A2:L2");
  positions.getCell("A2").value = `Datenstand: ${model.asOfLabel} · Sortiert nach aktuellem CHF-Marktwert`;
  positions.getCell("A2").font = { name: "Aptos", size: 10, color: { argb: COLORS.gray } };
  positions.addRow([]);
  const positionHeader = positions.addRow(["Ticker", "Unternehmen", "ISIN", "Sektor", "Währung", "Stück", "Kurs lokal", "Marktwert CHF", "Gewicht", "YTD", "Seit Kauf", "Datenstatus"]);
  applyHeader(positionHeader);
  const positionsStart = positionHeader.number + 1;
  for (const position of model.positions) {
    const row = positions.addRow([
      position.ticker,
      position.companyName,
      position.isin ?? "—",
      position.sector,
      position.currency,
      position.shares ?? "n/a",
      position.currentPriceLocal ?? "n/a",
      position.marketValueCHF ?? "n/a",
      position.portfolioWeightPct !== null ? position.portfolioWeightPct / 100 : "n/a",
      position.ytdReturnPct !== null ? position.ytdReturnPct / 100 : "n/a",
      position.totalReturnPct !== null ? position.totalReturnPct / 100 : "n/a",
      position.dataStatus,
    ]);
    row.getCell(1).font = { name: "Aptos Mono", bold: true, color: { argb: COLORS.tealDark } };
    if (position.dataStatus !== "OK") {
      row.getCell(12).font = { name: "Aptos", color: { argb: COLORS.warning }, bold: true };
      row.getCell(12).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7ED" } };
    }
  }
  if (model.positions.length > 0) applyTableBorders(positions, positionsStart, positions.lastRow.number, 1, 12);
  positions.autoFilter = `A${positionHeader.number}:L${positions.lastRow.number}`;
  positions.getColumn("F").numFmt = '#,##0.00';
  positions.getColumn("G").numFmt = '#,##0.00';
  setCurrencyColumn(positions, "H");
  setPercentColumn(positions, "I");
  setPercentColumn(positions, "J");
  setPercentColumn(positions, "K");

  const development = workbook.addWorksheet("Depotentwicklung", { views: [{ showGridLines: false, state: "frozen", ySplit: 4 }] });
  development.columns = [
    { key: "date", width: 16 },
    { key: "value", width: 20 },
    { key: "return", width: 20 },
  ];
  development.mergeCells("A1:C1");
  development.getCell("A1").value = `Depotentwicklung · ${model.title}`;
  development.getCell("A1").font = { name: "Aptos Display", size: 18, bold: true, color: { argb: COLORS.navy } };
  development.getRow(1).height = 30;
  development.mergeCells("A2:C2");
  const seriesModeLabel = model.depotValueSeriesKind === "actual" ? "historische CHF-Depotwerte (Aktien und Cash)" : model.depotValueSeriesKind === "indexed" ? "indexierter TTWROR-Verlauf (keine vollständige CHF-Wertreihe verfügbar)" : "keine ausreichende Zeitreihe verfügbar";
  development.getCell("A2").value = `Zeitraum: ${model.periodLabel} · ${seriesModeLabel}`;
  development.getCell("A2").font = { name: "Aptos", size: 10, color: { argb: COLORS.gray } };
  development.addRow([]);
  const developmentHeader = development.addRow(["Datum", "Depotwert CHF", "TTWROR kumuliert"]);
  applyHeader(developmentHeader);
  const valueByDate = new Map(model.depotValueSeries.map((point) => [point.date, point.marketValueCHF]));
  const returnByDate = new Map(model.indexedReturnSeries.map((point) => [point.date, point.cumulativeReturnPct]));
  const allDates = Array.from(new Set([...valueByDate.keys(), ...returnByDate.keys()])).sort();
  const developmentStart = developmentHeader.number + 1;
  for (const date of allDates) {
    development.addRow([date, valueByDate.get(date) ?? "n/a", returnByDate.has(date) ? (returnByDate.get(date)! / 100) : "n/a"]);
  }
  if (allDates.length > 0) applyTableBorders(development, developmentStart, development.lastRow.number, 1, 3);
  setCurrencyColumn(development, "B");
  setPercentColumn(development, "C");
  development.autoFilter = `A${developmentHeader.number}:C${development.lastRow.number}`;

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(new Blob([buffer as ArrayBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${portfolioExportFilenameStem(model)}-portfolio.xlsx`);
}

function setPdfTextColor(pdf: any, hex: string) {
  const normalized = hex.replace("#", "");
  const value = Number.parseInt(normalized, 16);
  pdf.setTextColor((value >> 16) & 255, (value >> 8) & 255, value & 255);
}

function setPdfFillColor(pdf: any, hex: string) {
  const normalized = hex.replace("#", "");
  const value = Number.parseInt(normalized, 16);
  pdf.setFillColor((value >> 16) & 255, (value >> 8) & 255, value & 255);
}

function drawPdfKpi(pdf: any, x: number, y: number, width: number, label: string, value: string, accent = COLORS.teal) {
  setPdfFillColor(pdf, "F8FAFC");
  pdf.roundedRect(x, y, width, 21, 2, 2, "F");
  setPdfFillColor(pdf, accent);
  pdf.roundedRect(x, y, 2, 21, 2, 2, "F");
  setPdfTextColor(pdf, COLORS.gray);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.text(label.toUpperCase(), x + 5, y + 7);
  setPdfTextColor(pdf, COLORS.navy);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text(value, x + 5, y + 15);
}

function drawDepotChart(pdf: any, model: PortfolioExportModel, x: number, y: number, width: number, height: number) {
  const actual = model.depotValueSeriesKind === "actual";
  const raw = actual
    ? model.depotValueSeries.map((point) => ({ date: point.date, value: point.marketValueCHF }))
    : model.indexedReturnSeries.map((point) => ({ date: point.date, value: point.cumulativeReturnPct }));
  const series = raw.length > 80 ? raw.filter((_, index) => index % Math.ceil(raw.length / 80) === 0 || index === raw.length - 1) : raw;

  setPdfFillColor(pdf, "F8FAFC");
  pdf.roundedRect(x, y, width, height, 2, 2, "F");
  setPdfTextColor(pdf, COLORS.navy);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text("Depotentwicklung", x + 5, y + 8);
  setPdfTextColor(pdf, COLORS.gray);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.text(actual ? "Historische CHF-Depotwerte inklusive Liquidität" : "Indexierter TTWROR-Verlauf – keine vollständige CHF-Wertreihe", x + 5, y + 13);

  if (series.length < 2) {
    setPdfTextColor(pdf, COLORS.gray);
    pdf.setFontSize(8);
    pdf.text("Für den ausgewählten Zeitraum ist keine ausreichende Zeitreihe verfügbar.", x + 5, y + height / 2);
    return;
  }

  const plot = { left: x + 9, right: x + width - 9, top: y + 21, bottom: y + height - 12 };
  const values = series.map((point) => point.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const span = Math.max(maxValue - minValue, actual ? 1 : 0.1);
  const padding = span * 0.08;
  const minY = minValue - padding;
  const maxY = maxValue + padding;
  const xFor = (index: number) => plot.left + (index / (series.length - 1)) * (plot.right - plot.left);
  const yFor = (value: number) => plot.bottom - ((value - minY) / (maxY - minY)) * (plot.bottom - plot.top);

  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(0.2);
  for (let grid = 0; grid < 3; grid += 1) {
    const gridY = plot.top + ((plot.bottom - plot.top) / 2) * grid;
    pdf.line(plot.left, gridY, plot.right, gridY);
  }
  pdf.setDrawColor(0, 207, 193);
  pdf.setLineWidth(0.8);
  for (let index = 1; index < series.length; index += 1) {
    pdf.line(xFor(index - 1), yFor(series[index - 1].value), xFor(index), yFor(series[index].value));
  }
  setPdfTextColor(pdf, COLORS.gray);
  pdf.setFontSize(6.8);
  pdf.text(series[0].date, plot.left, y + height - 4);
  pdf.text(series[series.length - 1].date, plot.right, y + height - 4, { align: "right" });
  pdf.text(actual ? formatCHF(maxValue) : formatPercent(maxValue), plot.right, plot.top + 2, { align: "right" });
  pdf.text(actual ? formatCHF(minValue) : formatPercent(minValue), plot.right, plot.bottom, { align: "right" });
}

function drawAllocation(pdf: any, model: PortfolioExportModel, x: number, y: number, width: number) {
  setPdfTextColor(pdf, COLORS.navy);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text("Allokation nach Sektor", x, y);
  const rows = model.sectorAllocation.slice(0, 7);
  rows.forEach((entry, index) => {
    const rowY = y + 7 + index * 6;
    const barWidth = Math.min(width - 54, Math.max(0, (entry.weightPct / 100) * (width - 54)));
    setPdfTextColor(pdf, COLORS.gray);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.text(entry.name.length > 18 ? `${entry.name.slice(0, 17)}…` : entry.name, x, rowY);
    setPdfFillColor(pdf, "E2E8F0");
    pdf.roundedRect(x + 45, rowY - 3, width - 60, 3, 1, 1, "F");
    setPdfFillColor(pdf, index === 0 ? COLORS.teal : COLORS.tealDark);
    pdf.roundedRect(x + 45, rowY - 3, barWidth, 3, 1, 1, "F");
    setPdfTextColor(pdf, COLORS.navy);
    pdf.text(formatPercent(entry.weightPct), x + width, rowY, { align: "right" });
  });
}

/** Erzeugt einen gestalteten PDF-Report mit Kennzahlen, Wertkurve, Allokation und Titelliste. */
export async function downloadPortfolioPdf(model: PortfolioExportModel): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 14;
  const usableWidth = pageWidth - margin * 2;

  setPdfFillColor(pdf, COLORS.navy);
  pdf.rect(0, 0, pageWidth, 38, "F");
  setPdfTextColor(pdf, "FFFFFF");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.text(model.title, margin, 16);
  setPdfTextColor(pdf, COLORS.teal);
  pdf.setFontSize(9);
  pdf.text("PORTFOLIO REPORT", margin, 23);
  setPdfTextColor(pdf, "CBD5E1");
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.text(`Datenstand: ${model.asOfLabel} · ${model.periodLabel} · ${model.isLive ? "Live" : "Demo"}`, margin, 30);

  const reportKpis = getPortfolioPdfKpiKeys()
    .map((key) => model.kpis.find((kpi) => kpi.key === key))
    .filter((kpi): kpi is PortfolioExportKpi => Boolean(kpi));
  const firstPageLayout = getPortfolioPdfLayout({
    kpiCount: reportKpis.length,
    allocationRowCount: model.sectorAllocation.length,
  });
  const tileWidth = (usableWidth - 8) / 3;
  reportKpis.forEach((kpi, index) => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const accent = kpi.key === "absolute_gain" && (kpi.value ?? 0) < 0 ? COLORS.negative : COLORS.teal;
    drawPdfKpi(pdf, margin + column * (tileWidth + 4), 45 + row * 25, tileWidth, kpi.label, formatKpi(kpi), accent);
  });

  drawDepotChart(pdf, model, margin, firstPageLayout.chartY, usableWidth, firstPageLayout.chartHeight);
  drawAllocation(pdf, model, margin, firstPageLayout.allocationY, usableWidth);

  const qualityTop = firstPageLayout.qualityTop;
  setPdfFillColor(pdf, "F8FAFC");
  pdf.roundedRect(margin, qualityTop, usableWidth, 28, 2, 2, "F");
  setPdfTextColor(pdf, COLORS.navy);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text("Datenqualität & Methodik", margin + 5, qualityTop + 7);
  setPdfTextColor(pdf, COLORS.gray);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.2);
  const notes = model.dataQualityNotes.length > 0 ? model.dataQualityNotes : ["Keine Datenqualitätswarnungen im Exportmodell."];
  const noteLines = pdf.splitTextToSize(notes.map((note) => `• ${note}`).join("\n"), usableWidth - 10);
  pdf.text(noteLines.slice(0, 4), margin + 5, qualityTop + 13);
  pdf.setFontSize(6.5);
  pdf.text("Definitionen und Datenherkunft sind im Excel-Export vollständig dokumentiert. Kennzahlen sind Momentaufnahmen und keine Anlageempfehlung.", margin, pageHeight - 9);

  pdf.addPage();
  setPdfFillColor(pdf, COLORS.navy);
  pdf.rect(0, 0, pageWidth, 20, "F");
  setPdfTextColor(pdf, "FFFFFF");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.text(`Titelliste · ${model.title}`, margin, 12);
  setPdfTextColor(pdf, COLORS.gray);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.text(`Datenstand: ${model.asOfLabel} · Marktwerte in CHF`, margin, 25);

  autoTable(pdf, {
    startY: 30,
    head: [["Ticker", "Unternehmen", "Sektor", "Stück", "Marktwert CHF", "Gewicht", "YTD", "Seit Kauf", "Status"]],
    body: model.positions.map((position) => [
      position.ticker,
      position.companyName,
      position.sector,
      position.shares === null ? "—" : position.shares.toLocaleString("de-CH", { maximumFractionDigits: 2 }),
      formatCHF(position.marketValueCHF),
      formatPercent(position.portfolioWeightPct),
      formatPercent(position.ytdReturnPct),
      formatPercent(position.totalReturnPct),
      position.dataStatus === "OK" ? "OK" : "Prüfen",
    ]),
    styles: { font: "helvetica", fontSize: 6.5, cellPadding: 1.8, lineColor: [226, 232, 240], lineWidth: 0.1, textColor: [15, 23, 42] },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 15, fontStyle: "bold" },
      1: { cellWidth: 28 },
      2: { cellWidth: 22 },
      3: { cellWidth: 12, halign: "right" },
      4: { cellWidth: 22, halign: "right" },
      5: { cellWidth: 14, halign: "right" },
      6: { cellWidth: 12, halign: "right" },
      7: { cellWidth: 14, halign: "right" },
      8: { cellWidth: 13 },
    },
    didParseCell: (hookData: any) => {
      if (hookData.section === "body" && hookData.column.index === 8 && hookData.cell.raw === "Prüfen") {
        hookData.cell.styles.textColor = [180, 83, 9];
        hookData.cell.styles.fontStyle = "bold";
      }
    },
    didDrawPage: () => {
      setPdfTextColor(pdf, COLORS.gray);
      pdf.setFontSize(6.5);
      pdf.text(`Portfoliomanager · ${model.title}`, margin, pageHeight - 7);
      pdf.text(`Seite ${pdf.getNumberOfPages()}`, pageWidth - margin, pageHeight - 7, { align: "right" });
    },
  });

  pdf.save(`${portfolioExportFilenameStem(model)}-portfolio-report.pdf`);
}
