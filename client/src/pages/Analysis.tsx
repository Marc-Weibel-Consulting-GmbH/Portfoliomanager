import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, TrendingUp, Activity, Target, ShieldCheck, Zap, Calculator, Brain } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useState, useMemo } from "react";
import { Link } from "wouter";

export default function Analysis() {
  const { user } = useAuth();
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<number | null>(null);
  const [benchmark, setBenchmark] = useState("SPY");

  const { data: portfolios } = trpc.portfolios.list.useQuery(undefined, { enabled: !!user });
  const activePortfolioId = selectedPortfolioId ?? portfolios?.[0]?.id ?? null;

  const { data: portfolioData } = trpc.portfolios.getWithCurrency.useQuery(
    activePortfolioId!,
    { enabled: !!activePortfolioId }
  );

  const holdings = useMemo(() => {
    if (!portfolioData?.enrichedStocks?.length) return [];
    const totalValue = portfolioData.enrichedStocks.reduce(
      (sum: number, s: any) => sum + (parseFloat(s.totalValue ?? s.valueCHF ?? 0)),
      0
    );
    if (totalValue === 0) return [];
    return portfolioData.enrichedStocks
      .filter((s: any) => s.ticker && parseFloat(s.totalValue ?? s.valueCHF ?? 0) > 0)
      .map((s: any) => ({
        ticker: s.ticker as string,
        weight: parseFloat(s.totalValue ?? s.valueCHF ?? 0) / totalValue,
        currency: (s.currency as string) ?? "USD",
      }));
  }, [portfolioData]);

  const { data: riskData, isLoading: riskLoading } = trpc.analytics.riskMetrics.useQuery(
    { holdings, benchmark, lookbackDays: 252 },
    { enabled: holdings.length > 0 }
  );

  const assets = riskData?.assets ?? [];
  const isLoading = riskLoading && holdings.length > 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Makro-Indikatoren</h1>
            <p className="text-muted-foreground mt-1">
              Einzeltitel-Analyse und weiterführende Tools
            </p>
          </div>
          <div className="flex gap-2">
            <Select
              value={activePortfolioId?.toString() ?? ""}
              onValueChange={(v) => setSelectedPortfolioId(Number(v))}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Portfolio wählen" />
              </SelectTrigger>
              <SelectContent>
                {portfolios?.map((p: any) => (
                  <SelectItem key={p.id} value={p.id.toString()}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={benchmark} onValueChange={setBenchmark}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SPY">S&P 500 (SPY)</SelectItem>
                <SelectItem value="QQQ">NASDAQ (QQQ)</SelectItem>
                <SelectItem value="EWL">SMI (EWL)</SelectItem>
                <SelectItem value="VT">World (VT)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs defaultValue="assets" className="space-y-4">
          <TabsList>
            <TabsTrigger value="assets">Einzeltitel</TabsTrigger>
            <TabsTrigger value="links">Weitere Tools</TabsTrigger>
          </TabsList>

          {/* Assets Tab */}
          <TabsContent value="assets" className="space-y-4">
            {!activePortfolioId ? (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Target className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Kein Portfolio ausgewählt</h3>
                  </div>
                </CardContent>
              </Card>
            ) : isLoading ? (
              <Card>
                <CardContent className="py-8">
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : assets.length === 0 ? (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <p className="text-muted-foreground">Keine Einzeltitel-Daten verfügbar.</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Einzeltitel-Analyse</CardTitle>
                  <CardDescription>Risikokennzahlen pro Position</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground">
                          <th className="text-left py-2 pr-4">Ticker</th>
                          <th className="text-right py-2 pr-4">Gewicht</th>
                          <th className="text-right py-2 pr-4">Volatilität</th>
                          <th className="text-right py-2 pr-4">Jahresrendite</th>
                          <th className="text-right py-2 pr-4">Sharpe</th>
                          <th className="text-right py-2">Beta</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assets.map((asset: any) => (
                          <tr key={asset.ticker} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="py-2 pr-4 font-medium">{asset.ticker}</td>
                            <td className="text-right py-2 pr-4">{((asset.weight ?? 0) * 100).toFixed(1)}%</td>
                            <td className="text-right py-2 pr-4">{(asset.volatility ?? 0).toFixed(1)}%</td>
                            <td className={`text-right py-2 pr-4 ${(asset.annualReturn ?? 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                              {(asset.annualReturn ?? 0) >= 0 ? "+" : ""}{(asset.annualReturn ?? 0).toFixed(1)}%
                            </td>
                            <td className={`text-right py-2 pr-4 ${(asset.sharpeRatio ?? 0) >= 1 ? "text-green-500" : (asset.sharpeRatio ?? 0) >= 0 ? "text-yellow-500" : "text-red-500"}`}>
                              {(asset.sharpeRatio ?? 0).toFixed(2)}
                            </td>
                            <td className={`text-right py-2 ${(asset.beta ?? 0) < 0.8 ? "text-green-500" : (asset.beta ?? 0) < 1.2 ? "text-yellow-500" : "text-red-500"}`}>
                              {(asset.beta ?? 0).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Links Tab */}
          <TabsContent value="links" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Link href="/risk-dashboard">
                <Card className="cursor-pointer hover:border-primary transition-colors">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base">Risiko-Analyse</CardTitle>
                    </div>
                    <CardDescription>
                      Vollständiges Risiko-Dashboard mit VaR, Drawdown-Chart und Einzeltitel-Analyse
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
              <Link href="/dcf-valuation">
                <Card className="cursor-pointer hover:border-primary transition-colors">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Calculator className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base">DCF-Bewertung</CardTitle>
                    </div>
                    <CardDescription>
                      Discounted Cash Flow Bewertung für einzelne Aktien mit Intrinsic Value
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
              <Link href="/portfolio-optimizer">
                <Card className="cursor-pointer hover:border-primary transition-colors">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base">Portfolio-Optimierung</CardTitle>
                    </div>
                    <CardDescription>
                      Efficient Frontier und optimale Gewichtung nach Modern Portfolio Theory
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
