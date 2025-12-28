import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function RealizedGainsHistory() {
  const params = useParams<{ id: string }>();
  const portfolioId = parseInt(params.id || "0");
  const [, setLocation] = useLocation();

  const { data: gainsHistory, isLoading } = trpc.realizedGainsHistory.getAll.useQuery(
    { portfolioId },
    { enabled: !!portfolioId }
  );

  const { data: portfolios = [] } = trpc.portfolios.list.useQuery();
  const portfolio = portfolios.find((p: any) => p.id === portfolioId);

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-center h-64">
          <p className="text-slate-400">Lade realisierte Gewinne...</p>
        </div>
      </div>
    );
  }

  if (!gainsHistory || gainsHistory.length === 0) {
    return (
      <div className="container py-8">
        <Button
          variant="outline"
          onClick={() => window.history.back()}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Zurück zum Portfolio
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Realisierte Gewinne/Verluste</CardTitle>
            <CardDescription>
              {portfolio?.name || "Portfolio"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-slate-400 text-center py-8">
              Noch keine Verkäufe getätigt
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate totals
  const totalStockGain = gainsHistory.reduce((sum, g) => sum + (g.stockGainLocal || 0), 0);
  const totalFxGain = gainsHistory.reduce((sum, g) => sum + (g.fxGain || 0), 0);
  const totalGain = gainsHistory.reduce((sum, g) => sum + (g.totalGain || 0), 0);
  const totalFees = gainsHistory.reduce((sum, g) => sum + (g.totalFees || 0), 0);
  const totalNetProfit = gainsHistory.reduce((sum, g) => sum + (g.netProfit || 0), 0);

  return (
    <div className="container py-8">
      <Button
        variant="outline"
        onClick={() => window.history.back()}
        className="mb-6"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Zurück zum Portfolio
      </Button>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Realisierte Gewinne/Verluste</CardTitle>
          <CardDescription>
            {portfolio?.name || "Portfolio"} - Alle Verkäufe mit Kostenaufstellung
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="pt-6">
                <p className="text-sm text-slate-400 mb-1">Aktiengewinne</p>
                <p className={`text-2xl font-bold ${totalStockGain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  CHF {totalStockGain.toFixed(2)}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="pt-6">
                <p className="text-sm text-slate-400 mb-1">Währungsgewinne</p>
                <p className={`text-2xl font-bold ${totalFxGain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  CHF {totalFxGain.toFixed(2)}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="pt-6">
                <p className="text-sm text-slate-400 mb-1">Total Gewinne</p>
                <p className={`text-2xl font-bold ${totalGain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  CHF {totalGain.toFixed(2)}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="pt-6">
                <p className="text-sm text-slate-400 mb-1">Transaktionskosten</p>
                <p className="text-2xl font-bold text-orange-400">
                  CHF {totalFees.toFixed(2)}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="pt-6">
                <p className="text-sm text-slate-400 mb-1">Netto-Gewinn</p>
                <p className={`text-2xl font-bold ${totalNetProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  CHF {totalNetProfit.toFixed(2)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Aktie</TableHead>
                  <TableHead className="text-right">Aktien</TableHead>
                  <TableHead className="text-right">Ø Kaufpreis</TableHead>
                  <TableHead className="text-right">Verkaufspreis</TableHead>
                  <TableHead className="text-right">Aktiengewinn</TableHead>
                  <TableHead className="text-right">FX Gewinn</TableHead>
                  <TableHead className="text-right">Total Gewinn</TableHead>
                  <TableHead className="text-right">Kaufgebühren</TableHead>
                  <TableHead className="text-right">Verkaufsgebühren</TableHead>
                  <TableHead className="text-right">Total Kosten</TableHead>
                  <TableHead className="text-right">Netto-Gewinn</TableHead>
                  <TableHead className="text-right">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gainsHistory.map((gain) => (
                  <TableRow key={gain.id}>
                    <TableCell className="font-medium">
                      {new Date(gain.transactionDate).toLocaleDateString('de-CH')}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{gain.ticker}</p>
                        <p className="text-xs text-slate-400">{gain.stockName}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{gain.shares.toFixed(0)}</TableCell>
                    <TableCell className="text-right">
                      {gain.currency} {gain.avgCostBasis.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {gain.currency} {gain.sellPrice.toFixed(2)}
                    </TableCell>
                    <TableCell className={`text-right ${gain.stockGainLocal >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {gain.currency} {gain.stockGainLocal.toFixed(2)}
                    </TableCell>
                    <TableCell className={`text-right ${gain.fxGain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      CHF {gain.fxGain.toFixed(2)}
                    </TableCell>
                    <TableCell className={`text-right font-semibold ${gain.totalGain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      CHF {gain.totalGain.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-orange-400">
                      CHF {gain.buyFees.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-orange-400">
                      CHF {gain.sellFees.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-orange-400 font-medium">
                      CHF {gain.totalFees.toFixed(2)}
                    </TableCell>
                    <TableCell className={`text-right font-bold ${gain.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      <div className="flex items-center justify-end gap-1">
                        {gain.netProfit >= 0 ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : (
                          <TrendingDown className="h-4 w-4" />
                        )}
                        CHF {gain.netProfit.toFixed(2)}
                      </div>
                    </TableCell>
                    <TableCell className={`text-right ${gain.realizedGainPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {gain.realizedGainPercent.toFixed(2)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Footer Note */}
          <div className="mt-6 p-4 bg-slate-800 rounded-md border border-slate-700">
            <p className="text-sm text-slate-400">
              <strong className="text-slate-300">Hinweis für Steuererklärung:</strong> Aktiengewinne und Währungsgewinne werden in der Schweiz unterschiedlich besteuert. 
              Diese Aufstellung zeigt die Aufteilung für Ihre Steuererklärung.
            </p>
            <p className="text-xs text-slate-500 mt-2">
              Transaktionskosten umfassen alle Kauf- und Verkaufsgebühren für die jeweilige Position.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
