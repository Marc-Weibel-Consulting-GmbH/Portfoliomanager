import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, DollarSign, Receipt, Calendar } from "lucide-react";

interface PerformanceSummary {
  year: number;
  unrealizedGains: number;
  realizedGains: number;
  realizedStockGains?: number;
  realizedFxGains?: number;
  dividendIncome: number;
  totalFees: number;
  netPerformance: number;
  totalInvested: number;
  currentValue: number;
  returnOnInvestment: number;
}

interface AnnualPerformanceSummaryProps {
  isOpen: boolean;
  onClose: () => void;
  summary: PerformanceSummary | null;
  isLoading: boolean;
}

export default function AnnualPerformanceSummary({
  isOpen,
  onClose,
  summary,
  isLoading,
}: AnnualPerformanceSummaryProps) {
  if (!summary && !isLoading) {
    return null;
  }

  const formatCurrency = (amount: number) => {
    const sign = amount >= 0 ? '+' : '';
    return `${sign}CHF ${Math.abs(amount).toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatPercent = (percent: number) => {
    const sign = percent >= 0 ? '+' : '';
    return `${sign}${percent.toFixed(2)}%`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Calendar className="w-6 h-6 text-blue-400" />
            Jahres-Performance {summary?.year || new Date().getFullYear()}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-slate-400">Lade Performance-Daten...</div>
          </div>
        ) : summary ? (
          <div className="space-y-6">
            {/* Net Performance Card */}
            <div className={`rounded-lg p-6 border-2 ${
              summary.netPerformance >= 0 
                ? 'bg-gradient-to-r from-green-600/20 to-emerald-600/20 border-green-500/50' 
                : 'bg-gradient-to-r from-red-600/20 to-rose-600/20 border-red-500/50'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-300 mb-1">Netto-Performance</p>
                  <p className={`text-4xl font-bold ${summary.netPerformance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatCurrency(summary.netPerformance)}
                  </p>
                  <p className={`text-lg mt-1 ${summary.netPerformance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatPercent(summary.returnOnInvestment)}
                  </p>
                </div>
                {summary.netPerformance >= 0 ? (
                  <TrendingUp className="w-16 h-16 text-green-400 opacity-50" />
                ) : (
                  <TrendingDown className="w-16 h-16 text-red-400 opacity-50" />
                )}
              </div>
            </div>

            {/* Performance Breakdown */}
            <div className="grid grid-cols-2 gap-4">
              {/* Unrealized Gains */}
              <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-blue-400" />
                  <p className="text-sm text-slate-300">Unrealisierte Gewinne/Verluste</p>
                </div>
                <p className={`text-2xl font-bold ${summary.unrealizedGains >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatCurrency(summary.unrealizedGains)}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Aktueller Wert - Kaufwert
                </p>
              </div>

              {/* Realized Gains */}
              <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-5 h-5 text-green-400" />
                  <p className="text-sm text-slate-300">Realisierte Gewinne/Verluste</p>
                </div>
                <p className={`text-2xl font-bold ${summary.realizedGains >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatCurrency(summary.realizedGains)}
                </p>
                {summary.realizedStockGains !== undefined && summary.realizedFxGains !== undefined ? (
                  <div className="text-xs text-slate-400 mt-2 space-y-1">
                    <div className="flex justify-between">
                      <span>Aktiengewinne:</span>
                      <span className={summary.realizedStockGains >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {formatCurrency(summary.realizedStockGains)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Währungsgewinne:</span>
                      <span className={summary.realizedFxGains >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {formatCurrency(summary.realizedFxGains)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 mt-1">
                    Aus Verkäufen
                  </p>
                )}
              </div>

              {/* Dividend Income */}
              <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-green-400" />
                  <p className="text-sm text-slate-300">Dividendenerträge</p>
                </div>
                <p className="text-2xl font-bold text-green-400">
                  {formatCurrency(summary.dividendIncome)}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Erhaltene Dividenden
                </p>
              </div>

              {/* Total Fees */}
              <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                <div className="flex items-center gap-2 mb-2">
                  <Receipt className="w-5 h-5 text-red-400" />
                  <p className="text-sm text-slate-300">Kosten</p>
                </div>
                <p className="text-2xl font-bold text-red-400">
                  -{formatCurrency(summary.totalFees).replace('+', '')}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Transaktionsgebühren
                </p>
              </div>
            </div>

            {/* Portfolio Overview */}
            <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
              <h3 className="text-lg font-semibold mb-3 text-slate-200">Portfolio-Übersicht</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-400">Total investiert</p>
                  <p className="text-xl font-bold text-white">
                    CHF {summary.totalInvested.toLocaleString('de-CH', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Aktueller Wert</p>
                  <p className="text-xl font-bold text-white">
                    CHF {summary.currentValue.toLocaleString('de-CH', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>

            {/* Calculation Formula */}
            <div className="bg-blue-600/10 border border-blue-500/30 rounded-lg p-4">
              <p className="text-sm text-blue-300 font-semibold mb-2">Berechnung:</p>
              <p className="text-xs text-slate-300 font-mono">
                Netto-Performance = Unrealisierte Gewinne + Realisierte Gewinne + Dividenden - Kosten
              </p>
              <p className="text-xs text-slate-400 mt-2">
                * Für Steuer-Reporting: Realisierte Gewinne und Dividenden sind steuerpflichtig
              </p>
            </div>

            {/* Footer */}
            <div className="flex justify-end pt-4 border-t border-slate-700">
              <Button 
                onClick={onClose}
                className="bg-slate-700 hover:bg-slate-600"
              >
                Schließen
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <Calendar className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg">Keine Performance-Daten verfügbar</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
