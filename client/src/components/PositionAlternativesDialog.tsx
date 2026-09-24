import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StockLogo } from "@/components/StockLogo";
import { trpc } from "@/lib/trpc";
import { Check, GitCompareArrows, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export interface PositionAlternativeSource {
  ticker: string;
  companyName?: string;
}

interface PositionAlternativesDialogProps {
  open: boolean;
  onClose: () => void;
  portfolioId: number;
  source: PositionAlternativeSource | null;
  onSuccess?: () => void;
}

const formatChf = (value: number | null | undefined, digits = 0) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("de-CH", {
    style: "currency",
    currency: "CHF",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
};

const formatPct = (value: number | null | undefined) =>
  value === null || value === undefined || !Number.isFinite(value) ? "—" : `${value.toFixed(1)} %`;

const scoreTone = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "text-gray-500";
  if (value >= 65) return "text-emerald-400";
  if (value >= 50) return "text-amber-300";
  return "text-rose-400";
};

/**
 * Shows a read-only similarity shortlist and requires an explicit second click
 * with the exact CHF payload before a demo position can be replaced.
 */
export function PositionAlternativesDialog({
  open,
  onClose,
  portfolioId,
  source,
  onSuccess,
}: PositionAlternativesDialogProps) {
  const utils = trpc.useUtils();
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const sourceTicker = source?.ticker ?? "";

  const alternativesQuery = trpc.portfolios.getDemoPositionSwapAlternatives.useQuery(
    { portfolioId, sourceTicker },
    {
      enabled: open && portfolioId > 0 && Boolean(sourceTicker),
      staleTime: 0,
      retry: false,
    },
  );
  const selected = useMemo(
    () => alternativesQuery.data?.alternatives.find((alternative) => alternative.ticker === selectedTicker) ?? null,
    [alternativesQuery.data?.alternatives, selectedTicker],
  );

  const swap = trpc.portfolios.confirmDemoPositionSwap.useMutation({
    onSuccess: (result) => {
      toast.success(`${result.sourceTicker} wurde in der Demoansicht durch ${result.targetTicker} ersetzt.`, {
        description: `CHF-Gegenwert ${formatChf(result.targetValueChf, 2)} · Cash-Differenz ${formatChf(result.cashResidualChf, 2)}`,
      });
      utils.portfolios.getWithCurrency.invalidate(portfolioId);
      utils.portfolios.list.invalidate();
      utils.portfolios.getHistoricalPerformance.invalidate({ portfolioId });
      setConfirmOpen(false);
      setSelectedTicker(null);
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      setConfirmOpen(false);
      toast.error("Tausch nicht ausgeführt", { description: error.message });
      alternativesQuery.refetch();
    },
  });

  const handleClose = () => {
    if (swap.isPending) return;
    setSelectedTicker(null);
    setConfirmOpen(false);
    onClose();
  };

  const sourceName = alternativesQuery.data?.source.companyName || source?.companyName || sourceTicker;
  const changeDescription = selected && alternativesQuery.data
    ? `${alternativesQuery.data.source.ticker} (${formatChf(alternativesQuery.data.source.valueChf, 2)}) wird aus diesem nicht aktivierten Demoportfolio entfernt. ${selected.ticker} wird mit ${selected.targetShares.toLocaleString("de-CH", { maximumFractionDigits: 6 })} Stück und demselben CHF-Gegenwert ${formatChf(selected.targetValueChf, 2)} aufgenommen. Der Rundungsrest ${formatChf(selected.cashResidualChf, 2)} wird der Cash-Reserve gutgeschrieben oder belastet. Es wird keine Börsenorder ausgelöst und keine Ledgerbuchung angelegt.`
    : "";

  return (
    <>
      <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) handleClose(); }}>
        <DialogContent className="bg-[#111827] border-white/15 text-white w-[calc(100vw-1.5rem)] max-w-5xl sm:max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <GitCompareArrows className="h-5 w-5 text-[#00CFC1]" />
              Alternativen für {sourceTicker}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Bis zu fünf aktive, nicht bereits enthaltene Aktien aus demselben Sektor und derselben Handelswährung. Die Reihenfolge ist ein Datenvergleich, keine Kaufempfehlung.
            </DialogDescription>
          </DialogHeader>

          {alternativesQuery.isLoading && (
            <div className="flex items-center justify-center min-h-48 text-gray-400 gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Vergleichbare Titel werden geprüft …
            </div>
          )}

          {alternativesQuery.error && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
              {alternativesQuery.error.message}
            </div>
          )}

          {alternativesQuery.data && (
            <div className="space-y-4 py-1">
              <section className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-2">Ausgangsposition</p>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
                  <span className="font-semibold text-white">{alternativesQuery.data.source.ticker} · {sourceName}</span>
                  <span className="text-gray-300">{alternativesQuery.data.source.shares.toLocaleString("de-CH", { maximumFractionDigits: 6 })} Stück</span>
                  <span className="text-[#00CFC1] font-mono">{formatChf(alternativesQuery.data.source.valueChf, 2)}</span>
                </div>
              </section>

              {alternativesQuery.data.alternatives.length === 0 ? (
                <div className="rounded-lg border border-amber-400/25 bg-amber-400/10 p-4 text-sm text-amber-100">
                  Für diese Position liegen aktuell keine fünf vergleichbaren, ausreichend bepreisten Alternativen im aktiven Datenuniversum vor. Es wird kein Ersatz geschätzt.
                </div>
              ) : (
                <div className="space-y-2">
                  {alternativesQuery.data.alternatives.map((alternative) => {
                    const isSelected = alternative.ticker === selectedTicker;
                    return (
                      <button
                        key={alternative.ticker}
                        type="button"
                        onClick={() => setSelectedTicker(alternative.ticker)}
                        className={`w-full text-left rounded-lg border p-3 transition-colors ${
                          isSelected
                            ? "border-[#00CFC1] bg-[#00CFC1]/10"
                            : "border-white/10 bg-white/[0.02] hover:border-white/25 hover:bg-white/[0.05]"
                        }`}
                      >
                        <div className="flex gap-3 items-start">
                          <StockLogo ticker={alternative.ticker} companyName={alternative.companyName} size="sm" />
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="font-semibold text-white font-mono">{alternative.ticker}</span>
                              <span className="text-sm text-gray-300">{alternative.companyName}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded border border-white/15 text-gray-400">
                                {alternative.similarity === "same_industry" ? "gleiche Branche" : "gleicher Sektor"}
                              </span>
                            </div>
                            <div className="overflow-x-auto mt-2">
                              <div className="grid grid-cols-5 min-w-[500px] gap-x-3 text-xs">
                                <span className="text-gray-400 whitespace-nowrap">Div.-Rendite <b className="text-gray-200 font-mono ml-1">{formatPct(alternative.dividendYield)}</b></span>
                                <span className="text-gray-400 whitespace-nowrap">Sharpe <b className="text-gray-200 font-mono ml-1">{alternative.sharpeRatio?.toFixed(2) ?? "—"}</b></span>
                                <span className="text-gray-400 whitespace-nowrap">Qualität <b className={`font-mono ml-1 ${scoreTone(alternative.quality)}`}>{alternative.quality?.toFixed(0) ?? "—"}</b></span>
                                <span className="text-gray-400 whitespace-nowrap">Bewertung <b className={`font-mono ml-1 ${scoreTone(alternative.valuation)}`}>{alternative.valuation?.toFixed(0) ?? "—"}</b></span>
                                <span className="text-gray-400 whitespace-nowrap">Timing <b className={`font-mono ml-1 ${scoreTone(alternative.timing)}`}>{alternative.timing?.toFixed(0) ?? "—"}</b></span>
                              </div>
                            </div>
                            <p className="mt-2 text-[11px] text-gray-500">
                              Tauschvorschau: {alternative.targetShares.toLocaleString("de-CH", { maximumFractionDigits: 6 })} Stück · {formatChf(alternative.targetValueChf, 2)} · Cash-Rest {formatChf(alternative.cashResidualChf, 2)}
                            </p>
                          </div>
                          {isSelected && <Check className="h-5 w-5 shrink-0 text-[#00CFC1]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="flex gap-2 rounded-lg border border-[#00CFC1]/20 bg-[#00CFC1]/5 p-3 text-xs text-gray-300 leading-relaxed">
                <ShieldCheck className="h-4 w-4 shrink-0 text-[#00CFC1] mt-0.5" />
                <span>Der endgültige Tausch ist nur für nicht aktivierte Demoportfolios ohne Ledgerbuchungen möglich. Vor dem Ausführen prüft der Server Eigentümerschaft, aktuellen CHF-Gegenwert, Kursbasis und Cashneutralität nochmals.</span>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleClose} disabled={swap.isPending} className="border-white/15 text-white hover:bg-white/10">Abbrechen</Button>
            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={!selected || swap.isPending}
              className="bg-[#00CFC1] text-[#06121a] hover:bg-[#00CFC1]/85"
            >
              <GitCompareArrows className="h-4 w-4 mr-2" /> Tausch vorbereiten
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Demo-Position wirklich tauschen?"
        description={changeDescription}
        confirmLabel={selected ? `${sourceTicker} durch ${selected.ticker} tauschen` : "Tausch bestätigen"}
        confirmVariant="default"
        onConfirm={() => {
          if (!selected || !alternativesQuery.data) return;
          swap.mutate({
            portfolioId,
            sourceTicker,
            targetTicker: selected.ticker,
            expectedSourceValueChf: alternativesQuery.data.source.valueChf,
            expectedTargetValueChf: selected.targetValueChf,
            confirmed: true,
          });
        }}
        isPending={swap.isPending}
      />
    </>
  );
}
