// Bewusst behalten (aktuell nicht geroutet): wird in Phase 4 wieder angeschlossen — siehe OPTIMIZATION_PLAN.md U-03 (Abhängigkeit von TransactionModal)
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown } from "lucide-react";

interface RealizedGainModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticker: string;
  companyName?: string;
  realizedGain: {
    amount: number;
    percent: number;
    avgCostBasis: number;
    sellPrice: number;
    shares: number;
    stockGainLocal?: number;
    stockGainCHF?: number;
    fxGain?: number;
    currency?: string;
    buyFxRate?: number;
    sellFxRate?: number;
  };
}

export function RealizedGainModal({
  isOpen,
  onClose,
  ticker,
  companyName,
  realizedGain,
}: RealizedGainModalProps) {
  const isProfit = realizedGain.amount >= 0;
  const totalSaleAmount = realizedGain.sellPrice * realizedGain.shares;
  const totalCostBasis = realizedGain.avgCostBasis * realizedGain.shares;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-slate-800 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white flex items-center gap-2">
            {isProfit ? (
              <>
                <TrendingUp className="w-6 h-6 text-green-400" />
                <span className="text-green-400">Gewinn realisiert!</span>
              </>
            ) : (
              <>
                <TrendingDown className="w-6 h-6 text-red-400" />
                <span className="text-red-400">Verlust realisiert</span>
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Stock Info */}
          <div className="text-center pb-4 border-b border-slate-700">
            <div className="text-slate-400 text-sm">{companyName || ticker}</div>
            <div className="text-white font-mono text-lg">{ticker}</div>
          </div>

          {/* Realized Gain/Loss Amount */}
          <div className="text-center py-6 bg-slate-900 rounded-lg">
            <div className="text-slate-400 text-sm mb-2">Realisierter {isProfit ? 'Gewinn' : 'Verlust'}</div>
            <div className={`text-4xl font-bold ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
              {isProfit ? '+' : ''}CHF {realizedGain.amount.toFixed(2)}
            </div>
            <div className={`text-2xl font-semibold mt-2 ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
              {isProfit ? '+' : ''}{realizedGain.percent.toFixed(2)}%
            </div>
          </div>

          {/* Transaction Details */}
          <div className="space-y-3 text-sm">
            <div className="flex justify-between text-slate-300">
              <span>Verkaufte Aktien:</span>
              <span className="font-mono">{realizedGain.shares.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Ø Kaufpreis:</span>
              <span className="font-mono">{realizedGain.currency || 'CHF'} {realizedGain.avgCostBasis.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Verkaufspreis:</span>
              <span className="font-mono">{realizedGain.currency || 'CHF'} {realizedGain.sellPrice.toFixed(2)}</span>
            </div>
            <div className="border-t border-slate-700 pt-3"></div>
            <div className="flex justify-between text-slate-400">
              <span>Ursprüngliche Kosten:</span>
              <span className="font-mono">{realizedGain.currency || 'CHF'} {totalCostBasis.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Verkaufserlös:</span>
              <span className="font-mono">{realizedGain.currency || 'CHF'} {totalSaleAmount.toFixed(2)}</span>
            </div>
          </div>

          {/* FX Breakdown (only if currency data available) */}
          {realizedGain.currency && realizedGain.currency !== 'CHF' && (
            <div className="space-y-3 text-sm bg-slate-900 p-4 rounded-lg">
              <div className="text-slate-300 font-semibold mb-2">Gewinn/Verlust Aufteilung:</div>
              <div className="flex justify-between text-slate-300">
                <span>Aktiengewinn ({realizedGain.currency}):</span>
                <span className={`font-mono ${(realizedGain.stockGainLocal || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {(realizedGain.stockGainLocal || 0) >= 0 ? '+' : ''}{realizedGain.currency} {(realizedGain.stockGainLocal || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Aktiengewinn (CHF):</span>
                <span className={`font-mono ${(realizedGain.stockGainCHF || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {(realizedGain.stockGainCHF || 0) >= 0 ? '+' : ''}CHF {(realizedGain.stockGainCHF || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Währungsgewinn/-verlust:</span>
                <span className={`font-mono ${(realizedGain.fxGain || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {(realizedGain.fxGain || 0) >= 0 ? '+' : ''}CHF {(realizedGain.fxGain || 0).toFixed(2)}
                </span>
              </div>
              <div className="border-t border-slate-700 pt-2 mt-2"></div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>Wechselkurs beim Kauf:</span>
                <span className="font-mono">{realizedGain.currency}/CHF {(realizedGain.buyFxRate || 0).toFixed(4)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>Wechselkurs beim Verkauf:</span>
                <span className="font-mono">{realizedGain.currency}/CHF {(realizedGain.sellFxRate || 0).toFixed(4)}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button
            onClick={onClose}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Schließen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}