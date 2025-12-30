import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { StockLogo } from "@/components/StockLogo";

interface RealizedGain {
  id: number;
  transactionDate: Date | string;
  ticker: string;
  stockName: string;
  shares: number;
  avgCostBasis: number;
  sellPrice: number;
  stockGainLocal: number;
  fxGain: number;
  totalGain: number;
  currency: string;
  buyFxRate: number;
  sellFxRate: number;
  buyFees: number;
  sellFees: number;
  totalFees: number;
  netProfit: number;
  realizedGainPercent: number;
}

interface RealizedGainsTableProps {
  gains: RealizedGain[];
}

export function RealizedGainsTable({ gains }: RealizedGainsTableProps) {
  // Calculate totals
  const totals = useMemo(() => {
    return gains.reduce(
      (acc, gain) => ({
        totalGain: acc.totalGain + gain.totalGain,
        stockGain: acc.stockGain + gain.stockGainLocal,
        fxGain: acc.fxGain + gain.fxGain,
        totalFees: acc.totalFees + gain.totalFees,
        netProfit: acc.netProfit + gain.netProfit,
      }),
      { totalGain: 0, stockGain: 0, fxGain: 0, totalFees: 0, netProfit: 0 }
    );
  }, [gains]);

  if (gains.length === 0) {
    return (
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle>Realisierte Gewinne/Verluste</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Keine realisierten Gewinne oder Verluste vorhanden.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle>Realisierte Gewinne/Verluste</CardTitle>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-4">
          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">Gesamt Gewinn/Verlust</p>
            <p className={`text-lg font-bold ${totals.totalGain >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {totals.totalGain >= 0 ? '+' : ''}CHF {totals.totalGain.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">Kursgewinn/-verlust</p>
            <p className={`text-lg font-bold ${totals.stockGain >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {totals.stockGain >= 0 ? '+' : ''}CHF {totals.stockGain.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">FX Gewinn/Verlust</p>
            <p className={`text-lg font-bold ${totals.fxGain >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {totals.fxGain >= 0 ? '+' : ''}CHF {totals.fxGain.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">Gesamt Gebühren</p>
            <p className="text-lg font-bold text-red-500">
              -CHF {totals.totalFees.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">Netto Gewinn/Verlust</p>
            <p className={`text-lg font-bold ${totals.netProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {totals.netProfit >= 0 ? '+' : ''}CHF {totals.netProfit.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Datum</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Aktie</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Stückzahl</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Ø Kaufpreis</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Verkaufspreis</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Kursgewinn</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">FX Gewinn</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Gebühren</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Netto</th>
              </tr>
            </thead>
            <tbody>
              {gains.map((gain) => (
                <tr key={gain.id} className="border-b border-border/50 hover:bg-muted/50">
                  <td className="py-3 px-4 text-sm text-foreground">
                    {new Date(gain.transactionDate).toLocaleDateString('de-CH')}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <StockLogo ticker={gain.ticker} size="sm" />
                      <div>
                        <p className="font-medium text-foreground">{gain.ticker}</p>
                        <p className="text-xs text-muted-foreground">{gain.stockName}</p>
                      </div>
                    </div>
                  </td>
                  <td className="text-right py-3 px-4 text-sm text-foreground">
                    {gain.shares.toFixed(2)}
                  </td>
                  <td className="text-right py-3 px-4 text-sm text-foreground">
                    {gain.currency} {gain.avgCostBasis.toFixed(2)}
                  </td>
                  <td className="text-right py-3 px-4 text-sm text-foreground">
                    {gain.currency} {gain.sellPrice.toFixed(2)}
                  </td>
                  <td className={`text-right py-3 px-4 text-sm font-medium ${gain.stockGainLocal >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {gain.stockGainLocal >= 0 ? '+' : ''}CHF {gain.stockGainLocal.toFixed(2)}
                  </td>
                  <td className={`text-right py-3 px-4 text-sm font-medium ${gain.fxGain >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {gain.fxGain >= 0 ? '+' : ''}CHF {gain.fxGain.toFixed(2)}
                  </td>
                  <td className="text-right py-3 px-4 text-sm text-red-500">
                    -CHF {gain.totalFees.toFixed(2)}
                  </td>
                  <td className={`text-right py-3 px-4 text-sm font-bold ${gain.netProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {gain.netProfit >= 0 ? '+' : ''}CHF {gain.netProfit.toFixed(2)}
                    <span className="ml-2 text-xs">
                      ({gain.realizedGainPercent >= 0 ? '+' : ''}{gain.realizedGainPercent.toFixed(2)}%)
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
