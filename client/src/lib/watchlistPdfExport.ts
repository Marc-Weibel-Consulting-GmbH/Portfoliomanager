import { buildWatchlistPdfRows } from "./watchlistPdfExportModel";

type WatchlistPdfOptions = {
  title: string;
  stocks: Record<string, unknown>[];
  filterLabel: string;
  asOf?: Date;
};

const formatNumber = (value: number | null, digits = 1) => value === null
  ? "—"
  : value.toLocaleString("de-CH", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Erstellt einen statischen, druckbaren Report der aktuell gefilterten Watchlist. */
export async function downloadWatchlistPdf(options: WatchlistPdfOptions): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const rows = buildWatchlistPdfRows(options.stocks);
  const asOf = options.asOf ?? new Date();
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  const margin = 12;

  pdf.setFillColor(15, 23, 42);
  pdf.rect(0, 0, width, 29, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text(options.title, margin, 13);
  pdf.setTextColor(0, 207, 193);
  pdf.setFontSize(8.5);
  pdf.text("WATCHLIST REPORT", margin, 20);
  pdf.setTextColor(203, 213, 225);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.text(`Datenstand: ${new Intl.DateTimeFormat("de-CH", { dateStyle: "medium", timeStyle: "short" }).format(asOf)} · Filter: ${options.filterLabel} · ${rows.length} Titel`, margin, 25);

  autoTable(pdf, {
    startY: 36,
    head: [["Ticker", "Unternehmen", "Sektor", "Währung", "Kurs", "Div.-Rendite", "KGV", "YTD", "Signal", "Score", "Datenstatus"]],
    body: rows.map((row) => [
      row.ticker,
      row.name,
      row.sector,
      row.currency,
      formatNumber(row.price, 2),
      row.dividendYieldPct === null ? "—" : `${formatNumber(row.dividendYieldPct)} %`,
      formatNumber(row.peRatio, 1),
      row.ytdReturnPct === null ? "—" : `${formatNumber(row.ytdReturnPct)} %`,
      row.signal.toUpperCase(),
      formatNumber(row.score, 0),
      row.dataStatus,
    ]),
    styles: { font: "helvetica", fontSize: 6.7, cellPadding: 1.55, lineColor: [226, 232, 240], lineWidth: 0.1, textColor: [15, 23, 42] },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 17, fontStyle: "bold" }, 1: { cellWidth: 34 }, 2: { cellWidth: 30 }, 3: { cellWidth: 16 },
      4: { cellWidth: 18, halign: "right" }, 5: { cellWidth: 20, halign: "right" }, 6: { cellWidth: 15, halign: "right" },
      7: { cellWidth: 15, halign: "right" }, 8: { cellWidth: 18 }, 9: { cellWidth: 14, halign: "right" }, 10: { cellWidth: 28 },
    },
    didParseCell: (data: any) => {
      if (data.section === "body" && data.column.index === 10 && data.cell.raw !== "OK") {
        data.cell.styles.textColor = [180, 83, 9];
        data.cell.styles.fontStyle = "bold";
      }
    },
    didDrawPage: () => {
      pdf.setTextColor(100, 116, 139);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6.5);
      pdf.text("Quelle: Portfoliomanager Watchlist · Kennzahlen sind Momentaufnahmen und keine Anlageempfehlung.", margin, height - 7);
      pdf.text(`Seite ${pdf.getNumberOfPages()}`, width - margin, height - 7, { align: "right" });
    },
  });
  const fileName = `${options.title.toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "watchlist"}-${asOf.toISOString().slice(0, 10)}.pdf`;
  pdf.save(fileName);
}
