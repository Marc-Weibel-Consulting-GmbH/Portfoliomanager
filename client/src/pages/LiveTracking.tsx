import { useState, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Wallet,
  BarChart3,
  PieChart,
  Calendar,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import { Link, useRoute } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { StockLogo } from "@/components/StockLogo";
import PremiumTeaser from "@/components/PremiumTeaser";

export default function LiveTracking() {
  const { user } = useAuth();
  const [, params] = useRoute<{ id: string }>("/live-tracking/:id");
  const portfolioId = params?.id ? parseInt(params.id) : null;

  // Fetch portfolios
  const { data: portfolios = [], isLoading: portfoliosLoading } = trpc.portfolios.list.useQuery();
  
  // Find the selected portfolio or use first live portfolio
  const livePortfolios = portfolios.filter((p: any) => p.isLive);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<number | null>(
    portfolioId || (livePortfolios.length > 0 ? livePortfolios[0].id : null)
  );

  const portfolio = portfolios.find((p: any) => p.id === selectedPortfolioId);

  // Fetch CHF-converted holdings with performance
  const { data: chfHoldings = [], isLoading: holdingsLoading } = trpc.portfolios.getHoldingsWithChfPerformance.useQuery(
    { id: selectedPortfolioId! },
    { enabled: !!selectedPortfolioId }
  );

  if (!user) {
    return null;
  }

  if (portfoliosLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Portfolios werden geladen...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (livePortfolios.length === 0) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto">
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Kein Live-Portfolio gefunden</h3>
              <p className="text-muted-foreground text-center mb-6 max-w-md">
                Sie haben noch kein Portfolio im Live-Modus. Aktivieren Sie ein Portfolio, um Live-Tracking zu nutzen.
              </p>
              <Button asChild>
                <Link href="/portfolios">Zu Portfolios</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (!portfolio) {
    return null;
  }

  // Calculate metrics from holdings data
  const totalInvestedCHF = useMemo(() => {
    return chfHoldings.reduce((sum: number, h: any) => sum + (h.shares * h.avgCostCHF), 0);
  }, [chfHoldings]);

  const totalValueCHF = useMemo(() => {
    return chfHoldings.reduce((sum: number, h: any) => sum + h.currentValueCHF, 0);
  }, [chfHoldings]);

  const cashPosition = 0; // TODO: Add cash position tracking
  // Handle case where avgCostCHF is 0 (no transaction data)
  const performanceCHF = totalInvestedCHF > 0 ? totalValueCHF - totalInvestedCHF : 0;
  const performancePercent = totalInvestedCHF > 0 ? ((totalValueCHF - totalInvestedCHF) / totalInvestedCHF) * 100 : 0;

  const isPositive = performancePercent >= 0;

  // Calculate average dividend yield
  const avgDividendYield = useMemo(() => {
    if (chfHoldings.length === 0) return 0;
    const totalValue = chfHoldings.reduce((sum: number, h: any) => sum + h.currentValueCHF, 0);
    if (totalValue === 0) return 0;
    const weightedYield = chfHoldings.reduce((sum: number, h: any) => {
      const weight = h.currentValueCHF / totalValue;
      return sum + (h.dividendYield || 0) * weight;
    }, 0);
    return weightedYield;
  }, [chfHoldings]);

  // Calculate portfolio composition
  const composition = useMemo(() => {
    const totalValue = chfHoldings.reduce((sum: number, h: any) => sum + h.currentValueCHF, 0);
    return chfHoldings.map((h: any) => ({
      ...h,
      weight: totalValue > 0 ? (h.currentValueCHF / totalValue) * 100 : 0,
    }));
  }, [chfHoldings]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-white">{portfolio.name}</h1>
              <Badge variant="default" className="bg-green-500 text-white">
                <span className="relative flex h-2 w-2 mr-1">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                </span>
                Live
              </Badge>
            </div>
            <p className="text-gray-400">
              Echtzeit-Tracking seit {new Date(portfolio.liveStartDate).toLocaleDateString("de-CH")}
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Zurück
            </Link>
          </Button>
        </div>

        {/* Portfolio Selector */}
        {livePortfolios.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {livePortfolios.map((p: any) => (
              <Button
                key={p.id}
                variant={p.id === selectedPortfolioId ? "default" : "outline"}
                onClick={() => setSelectedPortfolioId(p.id)}
                className="shrink-0"
              >
                {p.name}
              </Button>
            ))}
          </div>
        )}

        {holdingsLoading ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Performance wird berechnet...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                <div className="flex items-center gap-2 mb-2">
                  <Wallet className="h-4 w-4 text-blue-400" />
                  <p className="text-sm text-muted-foreground">Gesamtwert</p>
                </div>
                <p className="text-2xl font-bold text-white">
                  CHF {totalValueCHF.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>

              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="h-4 w-4 text-blue-400" />
                  <p className="text-sm text-muted-foreground">Performance</p>
                </div>
                <p className="text-2xl font-bold text-white">
                  {performancePercent.toFixed(1)}%
                </p>
              </div>

              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                <div className="flex items-center gap-2 mb-2">
                  {isPositive ? (
                    <TrendingUp className="h-4 w-4 text-green-400" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-400" />
                  )}
                  <p className="text-sm text-muted-foreground">Gewinn/Verlust</p>
                </div>
                <p className={`text-2xl font-bold ${isPositive ? "text-green-400" : "text-red-400"}`}>
                  {isPositive ? "+" : ""}
                  CHF {performanceCHF.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>

              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4 text-green-400" />
                  <p className="text-sm text-muted-foreground">Ø Dividendenrendite</p>
                </div>
                <p className="text-2xl font-bold text-white">{avgDividendYield.toFixed(2)}%</p>
              </div>
            </div>

            {/* Holdings Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  Positionen ({chfHoldings.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-2">Aktie</th>
                        <th className="text-right py-3 px-2">Anzahl</th>
                        <th className="text-right py-3 px-2">Ø Kaufpreis</th>
                        <th className="text-right py-3 px-2">Aktueller Preis</th>
                        <th className="text-right py-3 px-2">Wert (CHF)</th>
                        <th className="text-right py-3 px-2">Gewicht</th>
                        <th className="text-right py-3 px-2">Performance</th>
                        <th className="text-right py-3 px-2">Div. Rendite</th>
                      </tr>
                    </thead>
                    <tbody>
                      {composition.map((holding: any) => {
                        // Safely handle undefined values
                        const shares = holding.shares ?? 0;
                        const avgCostCHF = holding.avgCostCHF ?? 0;
                        const currentPriceCHF = holding.currentPriceCHF ?? 0;
                        const currentValueCHF = holding.currentValueCHF ?? 0;
                        const weight = holding.weight ?? 0;
                        const dividendYield = holding.dividendYield;

                        const perfPercent = avgCostCHF > 0
                          ? ((currentPriceCHF - avgCostCHF) / avgCostCHF) * 100
                          : 0;
                        const isProfitable = perfPercent >= 0;

                        return (
                          <tr key={holding.ticker} className="border-b border-border/50 hover:bg-muted/50">
                            <td className="py-3 px-2">
                              <div className="flex items-center gap-2">
                                <StockLogo ticker={holding.ticker} companyName={holding.companyName} size="sm" />
                                <div>
                                  <div className="font-medium">{holding.ticker}</div>
                                  <div className="text-xs text-muted-foreground">{holding.companyName}</div>
                                </div>
                              </div>
                            </td>
                            <td className="text-right py-3 px-2">{shares.toFixed(2)}</td>
                            <td className="text-right py-3 px-2">
                              CHF {avgCostCHF.toFixed(2)}
                            </td>
                            <td className="text-right py-3 px-2">
                              CHF {currentPriceCHF.toFixed(2)}
                            </td>
                            <td className="text-right py-3 px-2 font-medium">
                              CHF {currentValueCHF.toLocaleString("de-CH", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="text-right py-3 px-2">{weight.toFixed(1)}%</td>
                            <td className={`text-right py-3 px-2 font-medium ${isProfitable ? "text-green-500" : "text-red-500"}`}>
                              {isProfitable ? "+" : ""}
                              {perfPercent.toFixed(2)}%
                            </td>
                            <td className="text-right py-3 px-2">
                              {dividendYield ? `${dividendYield.toFixed(2)}%` : "-"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Cash Position */}
                {cashPosition > 0 && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-blue-400" />
                        <span className="font-medium">Cash Position</span>
                      </div>
                      <span className="font-bold text-blue-400">
                        CHF {cashPosition.toLocaleString("de-CH", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Premium Teaser */}
            <PremiumTeaser
              title="Live-Tracking"
              description="Verfolge dein Portfolio in Echtzeit mit IRR, MWR und detaillierten Performance-Metriken."
            />
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
