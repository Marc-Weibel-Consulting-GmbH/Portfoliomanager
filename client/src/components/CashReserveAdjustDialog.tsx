import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, Wallet } from "lucide-react";

interface CashReserveAdjustDialogProps {
  open: boolean;
  onClose: () => void;
  portfolioId: number;
  currentCashBalanceChf: number;
  currentTotalValueChf: number;
  onSuccess?: () => void;
}

function formatChf(value: number): string {
  return new Intl.NumberFormat("de-CH", {
    style: "currency",
    currency: "CHF",
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Direkter, bestätigungspflichtiger Zugang zur schon vorhandenen serverseitigen
 * Demo-Cash-Neugewichtung. Die Vorschau ist rein rechnerisch; die tatsächliche
 * Veränderung wird erst nach der sichtbaren Bestätigung ausgeführt und vom
 * Server erneut gegen Eigentümerschaft, Demo-/Ledger-Status und aktuelle Kurse
 * abgesichert.
 */
export function CashReserveAdjustDialog({
  open,
  onClose,
  portfolioId,
  currentCashBalanceChf,
  currentTotalValueChf,
  onSuccess,
}: CashReserveAdjustDialogProps) {
  const initialCashPct = currentTotalValueChf > 0
    ? (currentCashBalanceChf / currentTotalValueChf) * 100
    : 0;
  const [targetCashPct, setTargetCashPct] = useState(() => initialCashPct.toFixed(1));
  const [confirmed, setConfirmed] = useState(false);
  const utils = trpc.useUtils();

  const targetPctNumber = Number(targetCashPct);
  const preview = useMemo(() => {
    if (!(currentTotalValueChf > 0) || !Number.isFinite(targetPctNumber) || targetPctNumber < 0 || targetPctNumber >= 100) {
      return null;
    }
    const currentSecuritiesValueChf = Math.max(0, currentTotalValueChf - currentCashBalanceChf);
    const targetCashBalanceChf = currentTotalValueChf * targetPctNumber / 100;
    const targetSecuritiesValueChf = currentTotalValueChf - targetCashBalanceChf;
    const scalingFactor = currentSecuritiesValueChf > 0
      ? targetSecuritiesValueChf / currentSecuritiesValueChf
      : null;
    return { currentSecuritiesValueChf, targetCashBalanceChf, targetSecuritiesValueChf, scalingFactor };
  }, [currentCashBalanceChf, currentTotalValueChf, targetPctNumber]);

  const hasChange = Number.isFinite(targetPctNumber) && Math.abs(targetPctNumber - initialCashPct) > 0.0001;
  const rebalanceCashReserve = trpc.portfolios.rebalanceDemoCashReserve.useMutation({
    onSuccess: (result) => {
      toast.success("Cash-Quote proportional angepasst", {
        description: `Wertpapiere ${formatChf(result.securitiesValueChf)} · Cash ${formatChf(result.cashBalanceChf)}`,
      });
      utils.portfolios.list.invalidate();
      utils.portfolios.getWithCurrency.invalidate(portfolioId);
      utils.portfolios.getHistoricalPerformance.invalidate({ portfolioId });
      utils.portfolios.getMultiPeriodPerformanceV2.invalidate();
      utils.dashboard.getRiskMetrics.invalidate({ scope: portfolioId });
      onSuccess?.();
      onClose();
    },
    onError: (error) => toast.error("Cash-Quote konnte nicht angepasst werden", { description: error.message }),
  });

  const handleApply = () => {
    if (!preview || !hasChange || !confirmed) return;
    rebalanceCashReserve.mutate({ portfolioId, targetCashReservePct: targetPctNumber });
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent className="max-w-lg bg-[#172033] border-white/15 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Wallet className="h-5 w-5 text-[#00CFC1]" /> Cash-Position anpassen
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Die Cashquote wird auf Basis des aktuellen Portfoliowerts geändert. Alle Wertschriften werden proportional skaliert; ihre gegenseitigen Gewichte bleiben erhalten.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="rounded-lg border border-white/10 bg-[#0f1420] p-3 text-sm">
            <div className="flex justify-between gap-4"><span className="text-gray-400">Aktueller Gesamtwert</span><span className="font-mono text-white">{formatChf(currentTotalValueChf)}</span></div>
            <div className="mt-2 flex justify-between gap-4"><span className="text-gray-400">Aktuell Cash</span><span className="font-mono text-white">{formatChf(currentCashBalanceChf)} · {initialCashPct.toFixed(1)}%</span></div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="directCashReservePct" className="text-sm text-white">Ziel-Cash-Quote</Label>
            <div className="flex items-center gap-3">
              <Input
                id="directCashReservePct"
                type="number"
                min="0"
                max="99.99"
                step="0.1"
                inputMode="decimal"
                value={targetCashPct}
                onChange={(event) => { setTargetCashPct(event.target.value); setConfirmed(false); }}
                className="w-32 bg-slate-800 border-slate-600 text-white"
              />
              <span className="text-sm text-gray-300">% des aktuellen Gesamtwerts</span>
            </div>
          </div>

          {preview ? (
            <div className="rounded-lg border border-[#00CFC1]/30 bg-[#00CFC1]/[0.06] p-3 space-y-2 text-sm">
              <p className="font-medium text-[#9cf6ef]">Vorschau der proportionalen Anpassung</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <span className="text-gray-400">Wertpapiere danach</span><span className="font-mono text-right text-white">{formatChf(preview.targetSecuritiesValueChf)}</span>
                <span className="text-gray-400">Cash danach</span><span className="font-mono text-right text-white">{formatChf(preview.targetCashBalanceChf)} · {targetPctNumber.toFixed(1)}%</span>
                <span className="text-gray-400">Stückzahlfaktor</span><span className="font-mono text-right text-white">{preview.scalingFactor === null ? "—" : `× ${preview.scalingFactor.toFixed(6)}`}</span>
              </div>
              <p className="pt-1 text-[11px] leading-relaxed text-gray-300">
                Jede bestehende Aktie, jeder ETF/ETP und jede andere bewertbare Wertschrift erhält denselben Faktor. Die endgültigen Werte werden beim Ausführen nochmals serverseitig mit aktuellen Kursen und CHF-Wechselkursen geprüft.
              </p>
            </div>
          ) : (
            <p className="text-sm text-amber-300">Bitte eine Cash-Quote von 0 bis unter 100 % eingeben.</p>
          )}

          {hasChange && preview && (
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-400/[0.06] p-3 text-xs text-amber-100">
              <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 accent-[#00CFC1]" />
              <span>Ich bestätige die proportionale technische Neugewichtung dieses nicht aktivierten Demoportfolios. Es werden keine Börsenorders, Zahlungen oder Ledgerbuchungen erstellt.</span>
            </label>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="ghost" onClick={onClose} className="text-gray-300 hover:text-white">Abbrechen</Button>
          <Button
            type="button"
            onClick={handleApply}
            disabled={!hasChange || !preview || !confirmed || rebalanceCashReserve.isPending}
            className="bg-[#00CFC1] text-black hover:bg-[#00b9ad]"
          >
            {rebalanceCashReserve.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Wird angepasst…</> : <><Wallet className="mr-2 h-4 w-4" />Proportional anpassen</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
