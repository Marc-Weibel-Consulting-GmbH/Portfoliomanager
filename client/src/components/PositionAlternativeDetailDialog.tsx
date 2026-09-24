import { useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PriceChart } from "@/components/charts";
import { StockLogo } from "@/components/StockLogo";
import { trpc } from "@/lib/trpc";
import { BarChart3, Loader2, TrendingDown, TrendingUp } from "lucide-react";

interface PositionAlternativeDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portfolioId: number;
  sourceTicker: string;
  targetTicker: string | null;
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

function Metric({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-1 font-mono text-sm ${emphasis ? "text-[#00CFC1]" : "text-gray-100"}`}>{value}</p>
    </div>
  );
}

/**
 * Compact, read-only equivalent of the stock detail page for an alternative
 * currently eligible in the demo-swap shortlist. It uses only server-backed
 * EODHD data and does not expose any add-to-portfolio or trade action.
 */
export function PositionAlternativeDetailDialog({
  open,
  onOpenChange,
  portfolioId,
  sourceTicker,
  targetTicker,
}: PositionAlternativeDetailDialogProps) {
  const detailQuery = trpc.portfolios.getDemoPositionSwapAlternativeDetail.useQuery(
    { portfolioId, sourceTicker, targetTicker: targetTicker ?? "" },
    { enabled: open && portfolioId > 0 && Boolean(sourceTicker) && Boolean(targetTicker), retry: false, staleTime: 5 * 60 * 1000 },
  );
  const detail = detailQuery.data;
  const chartValues = useMemo(
    () => (detail?.chart ?? []).map((point) => ({ time: point.date, value: point.value })),
    [detail?.chart],
  );
  const isPositive = (detail?.periodReturnPct ?? 0) >= 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-5xl border-white/15 bg-[#111827] p-5 text-white sm:max-w-5xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-white">
            <StockLogo ticker={targetTicker ?? ""} companyName={detail?.companyName ?? targetTicker ?? ""} size="md" />
            <span>{detail?.ticker ?? targetTicker ?? "Alternative"} · {detail?.companyName ?? "Details laden …"}</span>
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Lesende Vergleichsansicht. Der Chart zeigt die verfügbare, dividenden- und splitbereinigte EODHD-Kursreihe über 1 Jahr; fehlende Felder werden nicht geschätzt.
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
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <BarChart3 className="h-4 w-4 text-[#00CFC1]" /> Kursentwicklung · 1 Jahr
                </div>
                <div className={`flex items-center gap-1 font-mono text-sm ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                  {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {formatPct(detail.periodReturnPct, 2)}
                </div>
              </div>
              {chartValues.length >= 2 ? (
                <PriceChart
                  values={chartValues}
                  seriesType="area"
                  height={300}
                  className="min-h-[300px]"
                  colors={{ lineColor: "#00CFC1", areaTopColor: "rgba(0, 207, 193, 0.22)", areaBottomColor: "rgba(0, 207, 193, 0.02)", textColor: "#94a3b8" }}
                />
              ) : (
                <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed border-white/10 text-sm text-gray-500">
                  Keine ausreichende EODHD-Kursreihe verfügbar.
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
              Branche: {detail.industry ?? "—"} · Handelswährung: {detail.currency ?? "—"} · Datenquelle: EODHD · Stand: {new Date(detail.generatedAt).toLocaleString("de-CH")}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
