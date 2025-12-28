import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar, TrendingUp } from "lucide-react";

interface DividendEvent {
  ticker: string;
  companyName?: string;
  exDividendDate: string;
  paymentDate: string;
  amount: number;
  currency: string;
  shares: number;
  expectedIncome: number;
}

interface DividendCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  dividends: DividendEvent[];
  isLoading: boolean;
}

export default function DividendCalendarModal({
  isOpen,
  onClose,
  dividends,
  isLoading,
}: DividendCalendarModalProps) {
  // Sort by ex-dividend date (nearest first)
  const sortedDividends = [...dividends].sort((a, b) => 
    new Date(a.exDividendDate).getTime() - new Date(b.exDividendDate).getTime()
  );

  const totalExpectedIncome = dividends.reduce((sum, div) => sum + div.expectedIncome, 0);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-CH', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  };

  const formatCurrency = (amount: number, currency: string) => {
    return `${currency} ${amount.toFixed(2)}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Calendar className="w-6 h-6 text-green-400" />
            Dividendenkalender
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-slate-400">Lade Dividenden-Daten...</div>
          </div>
        ) : dividends.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <Calendar className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg">Keine bevorstehenden Dividenden</p>
            <p className="text-sm mt-2">In den nächsten 12 Monaten sind keine Dividendenzahlungen geplant.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary Card */}
            <div className="bg-gradient-to-r from-green-600/20 to-emerald-600/20 border border-green-500/30 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Erwartete Dividenden (nächste 12 Monate)</p>
                  <p className="text-3xl font-bold text-green-400 mt-1">
                    CHF {totalExpectedIncome.toFixed(2)}
                  </p>
                </div>
                <TrendingUp className="w-12 h-12 text-green-400 opacity-50" />
              </div>
              <p className="text-xs text-slate-400 mt-2">
                {dividends.length} bevorstehende Dividendenzahlung{dividends.length !== 1 ? 'en' : ''}
              </p>
            </div>

            {/* Dividends Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-2 text-sm font-semibold text-slate-300">Ticker</th>
                    <th className="text-left py-3 px-2 text-sm font-semibold text-slate-300">Firma</th>
                    <th className="text-left py-3 px-2 text-sm font-semibold text-slate-300">Ex-Datum</th>
                    <th className="text-left py-3 px-2 text-sm font-semibold text-slate-300">Zahltag</th>
                    <th className="text-right py-3 px-2 text-sm font-semibold text-slate-300">Div/Aktie</th>
                    <th className="text-right py-3 px-2 text-sm font-semibold text-slate-300">Aktien</th>
                    <th className="text-right py-3 px-2 text-sm font-semibold text-slate-300">Erwarteter Ertrag</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedDividends.map((dividend, index) => {
                    const isUpcoming = new Date(dividend.exDividendDate) > new Date();
                    
                    return (
                      <tr 
                        key={`${dividend.ticker}-${dividend.exDividendDate}-${index}`}
                        className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors"
                      >
                        <td className="py-3 px-2">
                          <span className="font-mono font-semibold text-blue-400">
                            {dividend.ticker}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-sm text-slate-300">
                          {dividend.companyName || '-'}
                        </td>
                        <td className="py-3 px-2 text-sm">
                          <div className="flex items-center gap-2">
                            <span className={isUpcoming ? 'text-green-400' : 'text-slate-400'}>
                              {formatDate(dividend.exDividendDate)}
                            </span>
                            {isUpcoming && (
                              <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">
                                Bevorstehend
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-2 text-sm text-slate-300">
                          {formatDate(dividend.paymentDate)}
                        </td>
                        <td className="py-3 px-2 text-right text-sm font-mono">
                          {formatCurrency(dividend.amount, dividend.currency)}
                        </td>
                        <td className="py-3 px-2 text-right text-sm text-slate-300">
                          {dividend.shares.toFixed(0)}
                        </td>
                        <td className="py-3 px-2 text-right font-semibold text-green-400">
                          CHF {dividend.expectedIncome.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
        )}
      </DialogContent>
    </Dialog>
  );
}
