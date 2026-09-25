import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PriceChart } from "@/components/charts";
import { StockLogo } from "@/components/StockLogo";
import { trpc } from "@/lib/trpc";
import { BarChart3, Loader2, TrendingDown, TrendingUp } from "lucide-react";

interface FullReoptimizationCandidateDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portfolioId: number;
  ticker: string | null;
}

const formatNative = (value: number | null | undefined, currency: string | null | undefined, digits = 2) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("de-CH", {
    style: "currency",
    currency: currency || "CHF",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
};

const formatPct = (value: number | null | undefined, digits = 1) =>
  value === null || value === undefined || !Number.isFinite(value) ? "—" : `${value.toFixed(digits)} %`;

const formatRatio = (value: number | null | undefined, digits = 2) =>
  value === null || value === undefined || !Number.isFinite(value) ? "—" : value.toFixed(digits);

const CHART_PERIODS = ["YTD", "1Y", "3Y", "5Y", "Max"] as const;
type ChartPeriod = (typeof CHART_PERIODS)[number];

const chartPeriodLabel = (period: ChartPeriod) => ({
  YTD: "YTD",
  "1Y": "1 Jahr",
  "3Y": "3 Jahre",
  "5Y": "5 Jahre",
  Max: "Max.",
})[period];

function Metric({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-1 font-mono text-sm ${emphasis ? "text-[#00CFC1]" : "text-gray-100"}`}>{value}</p>
    </div>
  );
}

/**
 * Read-only drill-down for a selected candidate in the complete equity
 * reoptimization preview. This component contains no allocation, mutation, or
 * portfolio action; its sole purpose is to make the candidate selection auditable.
 */
export function FullReoptimizationCandidateDetailDialog({
  open,
  onOpenChange,
  portfolioId,
  ticker,
}: FullReoptimizationCandidateDetailDialogProps) {
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>("1Y");
  const detailQuery = trpc.analytics.getFullReoptimizationCandidateDetail.useQuery(
    { portfolioId, ticker: ticker ?? "", chartPeriod },
    { enabled: open && portfolioId > 0 && Boolean(ticker), retry: false, staleTime: 5 * 60 * 1000 },
  );
  const detail = detailQuery.data;
  const chartValues = useMemo(
    () => (detail?.chart ?? []).map((point) => ({ time: point.date, value: point.value })),
    [detail?.chart],
  );
  const isPositive = (detail?.periodReturnPct ?? 0) >= 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-5xl max-h-[88vh] overflow-y-auto border-white/15 bg-[#111827] p-5 text-white sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-white">
            <StockLogo ticker={ticker ?? ""} companyName={detail?.companyName ?? ticker ?? ""} size="md" />
            <span>{detail?.ticker ?? ticker ?? "Titel"} · {detail?.companyName ?? "Details laden …"}</span>
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Lesende Detailansicht eines ausgewählten Kandidaten der vollständigen Aktien-Neuoptimierung. Sie ändert weder die Vorschau noch Positionen, Cash, Buchungen oder Orders.
          </DialogDescription>
        </DialogHeader>

        {detailQuery.isLoading && (
          <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Kennzahlen und Kursreihe werden geladen …
          </div>
        )}

        {detailQuery.error && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
            {detailQuery.error.message}
          </div>
        )}

        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <Metric label="Kurs" value={formatNative(detail.currentPrice, detail.currency)} emphasis />
              <Metric label="Div.-Rendite" value={formatPct(detail.dividendYield)} emphasis />
              <Metric label="KGV (P/E)" value={formatRatio(detail.peRatio)} />
              <Metric label="PEG Ratio" value={formatRatio(detail.pegRatio)} />
              <Metric label="Beta" value={formatRatio(detail.beta)} />
              <Metric label="Sharpe" value={formatRatio(detail.sharpeRatio)} />
            </div>

            <section className="rounded-xl border border-white/10 bg-white/[0.02] p-3 sm:p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <BarChart3 className="h-4 w-4 text-[#00CFC1]" /> Kursentwicklung · {chartPeriodLabel(chartPeriod)}
                  {detail.chartIsHistoricalProxy && (
                    <span className="rounded border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-200">
                      {detail.chartCurrency}-Proxy
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <div className="flex items-center rounded-lg border border-white/10 bg-black/10 p-0.5" aria-label="Kurszeitraum wählen">
                    {CHART_PERIODS.map((period) => (
                      <button
                        key={period}
                        type="button"
                        aria-pressed={chartPeriod === period}
                        onClick={() => setChartPeriod(period)}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                          chartPeriod === period
                            ? "bg-[#00CFC1] text-[#07101c]"
                            : "text-gray-400 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        {chartPeriodLabel(period)}
                      </button>
                    ))}
                  </div>
                  <div className={`flex items-center gap-1 font-mono text-sm ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                    {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    {formatPct(detail.periodReturnPct, 2)}
                  </div>
                </div>
              </div>
              {chartValues.length >= 2 ? (
                <>
                  <PriceChart
                    values={chartValues}
                    seriesType="area"
                    height={300}
                    className="min-h-[300px]"
                    colors={{ lineColor: "#00CFC1", areaTopColor: "rgba(0, 207, 193, 0.22)", areaBottomColor: "rgba(0, 207, 193, 0.02)", textColor: "#94a3b8" }}
                  />
                  {detail.chartIsHistoricalProxy && (
                    <p className="mt-2 text-xs leading-relaxed text-amber-200/80">
                      Historische Kursquelle in {detail.chartCurrency} (Auslandslisting/ADR-Proxy). Der Chart dient nur der Transparenz und fliesst ohne bestätigtes Umrechnungsverhältnis nicht in Risiko-, Rendite- oder Optimierungskennzahlen ein.
                    </p>
                  )}
                </>
              ) : (
                <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed border-white/10 text-sm text-gray-500">
                  {detail.chartDataReason ?? "Keine ausreichende gespeicherte EODHD-Kursreihe verfügbar."}
                </div>
              )}
            </section>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Metric label="Qualität" value={formatRatio(detail.quality, 0)} />
              <Metric label="Bewertung" value={formatRatio(detail.valuation, 0)} />
              <Metric label="Timing" value={formatRatio(detail.timing, 0)} />
              <Metric label="Signal" value={detail.signalScore === null || detail.signalScore === undefined ? "—" : `${detail.signalLabel ?? "—"} · ${detail.signalScore.toFixed(0)}`} />
            </div>

            <p className="text-xs leading-relaxed text-gray-500">
              Branche: {detail.industry ?? "—"} · Sektor: {detail.sector ?? "—"} · Handelswährung: {detail.currency ?? "—"} · Chartwährung: {detail.chartCurrency ?? detail.currency ?? "—"} · Datenquelle: {detail.source} · Stand: {new Date(detail.generatedAt).toLocaleString("de-CH")}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
