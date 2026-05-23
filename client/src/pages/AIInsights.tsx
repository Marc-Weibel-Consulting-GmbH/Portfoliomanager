import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, TrendingUp, AlertCircle, Lightbulb, Target, RefreshCw, CheckCircle, XCircle, Info } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useState, useMemo } from "react";

export default function AIInsights() {
  const { user } = useAuth();
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<number | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const { data: portfolios } = trpc.portfolios.list.useQuery(undefined, { enabled: !!user });
  const activePortfolioId = selectedPortfolioId ?? portfolios?.[0]?.id ?? null;

  const { data: portfolioData } = trpc.portfolios.getWithCurrency.useQuery(
    activePortfolioId!,
    { enabled: !!activePortfolioId }
  );

  const holdings = useMemo(() => {
    if (!portfolioData?.enrichedStocks?.length) return [];
    const totalValue = portfolioData.enrichedStocks.reduce(
      (sum: number, s: any) => sum + parseFloat(s.valueCHF ?? s.currentValueCHF ?? '0'),
      0
    );
    if (totalValue === 0) return [];
    return portfolioData.enrichedStocks
      .filter((s: any) => s.ticker && s.ticker !== 'CASH' && parseFloat(s.valueCHF ?? s.currentValueCHF ?? '0') > 0)
      .map((s: any) => ({
        ticker: s.ticker as string,
        weight: (parseFloat(s.valueCHF ?? s.currentValueCHF ?? '0') / totalValue) * 100,
        sector: (s.sector as string) ?? "Unbekannt",
      }));
  }, [portfolioData]);

  const { data: riskData } = trpc.analytics.riskMetrics.useQuery(
    {
      holdings: holdings.map((h: any) => ({
        ticker: h.ticker,
        weight: h.weight / 100,
        currency: "USD",
      })),
      benchmark: "SPY",
    },
    { enabled: holdings.length > 0 }
  );

  const analyzeMutation = trpc.aiInsights.analyzePortfolio.useMutation({
    onSuccess: (data) => {
      setAnalysisResult(data);
      setIsAnalyzing(false);
    },
    onError: (err) => {
      setAnalysisError(err.message);
      setIsAnalyzing(false);
    },
  });

  const runAnalysis = () => {
    if (!portfolioData || holdings.length === 0) return;
    setIsAnalyzing(true);
    setAnalysisError(null);

    analyzeMutation.mutate({
      portfolioName: portfolioData.name ?? "Portfolio",
      holdings: holdings.map((h: any) => ({
        ticker: h.ticker,
        weight: h.weight,
        sector: h.sector,
      })),
      riskMetrics: riskData?.portfolio
        ? {
            sharpeRatio: riskData.portfolio.sharpeRatio,
            sortinoRatio: riskData.portfolio.sortinoRatio,
            beta: riskData.portfolio.beta,
            volatility: riskData.portfolio.volatility,
            maxDrawdown: riskData.portfolio.maxDrawdown,
            annualReturn: riskData.portfolio.annualReturn,
            varHistorical95: riskData.portfolio.varHistorical95,
          }
        : undefined,
    });
  };

  const healthColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 65) return "text-teal-500";
    if (score >= 50) return "text-yellow-500";
    if (score >= 35) return "text-orange-500";
    return "text-red-500";
  };

  const healthBadgeVariant = (label: string): "default" | "secondary" | "destructive" | "outline" => {
    if (label === "Sehr gut" || label === "Gut") return "default";
    if (label === "Akzeptabel") return "secondary";
    return "destructive";
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">KI-Insights</h1>
            <p className="text-muted-foreground mt-1">
              KI-gestützte Portfolio-Analyse und Empfehlungen
            </p>
          </div>
          <div className="flex gap-2">
            <Select
              value={activePortfolioId?.toString() ?? ""}
              onValueChange={(v) => {
                setSelectedPortfolioId(Number(v));
                setAnalysisResult(null);
              }}
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
            <Button
              className="gap-2"
              onClick={runAnalysis}
              disabled={isAnalyzing || holdings.length === 0}
            >
              <RefreshCw className={`h-4 w-4 ${isAnalyzing ? "animate-spin" : ""}`} />
              {isAnalyzing ? "Analysiere..." : "Analyse starten"}
            </Button>
          </div>
        </div>

        {!activePortfolioId ? (
          <Card>
            <CardContent className="flex items-center justify-center py-16">
              <div className="text-center">
                <Sparkles className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Portfolio auswählen</h3>
                <p className="text-sm text-muted-foreground">
                  Wählen Sie ein Portfolio aus und starten Sie die KI-Analyse.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : !analysisResult && !isAnalyzing ? (
          <Card>
            <CardContent className="flex items-center justify-center py-16">
              <div className="text-center">
                <Sparkles className="h-16 w-16 text-primary mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  {holdings.length > 0
                    ? `Portfolio "${portfolioData?.name}" bereit`
                    : "Portfolio wird geladen..."}
                </h3>
                <p className="text-sm text-muted-foreground mb-6">
                  {holdings.length > 0
                    ? `${holdings.length} Positionen gefunden. Klicken Sie auf "Analyse starten" für eine KI-gestützte Bewertung.`
                    : "Bitte warten Sie, während die Portfolio-Daten geladen werden."}
                </p>
                {holdings.length > 0 && (
                  <Button onClick={runAnalysis} className="gap-2">
                    <Sparkles className="h-4 w-4" />
                    Analyse starten
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : isAnalyzing ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-48" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-24 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : analysisError ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Fehler bei der Analyse</h3>
                <p className="text-sm text-muted-foreground">{analysisError}</p>
                <Button onClick={runAnalysis} className="mt-4">Erneut versuchen</Button>
              </div>
            </CardContent>
          </Card>
        ) : analysisResult ? (
          <div className="space-y-4">
            {/* Health Score + Risk Profile */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <CardTitle>Portfolio-Gesundheit</CardTitle>
                  </div>
                  <CardDescription>KI-basierte Bewertung Ihres Portfolios</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center py-4 gap-3">
                    <div className={`text-6xl font-bold ${healthColor(analysisResult.healthScore)}`}>
                      {analysisResult.healthScore}
                    </div>
                    <Badge variant={healthBadgeVariant(analysisResult.healthLabel)}>
                      {analysisResult.healthLabel}
                    </Badge>
                    <p className="text-sm text-muted-foreground text-center mt-2">
                      {analysisResult.summary}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Info className="h-5 w-5 text-blue-500" />
                    <CardTitle>Risikoprofil</CardTitle>
                  </div>
                  <CardDescription>Einschätzung des Portfolio-Risikos</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center py-4 gap-3">
                    <div className="text-4xl font-bold text-primary">
                      {analysisResult.riskLevel}
                    </div>
                    <p className="text-sm text-muted-foreground text-center">
                      Basierend auf Beta, Volatilität und Drawdown-Analyse
                    </p>
                    {riskData?.portfolio && (
                      <div className="w-full mt-2 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Sharpe Ratio</span>
                          <span className="font-medium">{riskData.portfolio.sharpeRatio.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Beta</span>
                          <span className="font-medium">{riskData.portfolio.beta.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Volatilität</span>
                          <span className="font-medium">{riskData.portfolio.volatility.toFixed(1)}%</span>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Strengths, Risks, Recommendations */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <CardTitle className="text-base">Stärken</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {(analysisResult.strengths || []).map((s: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-orange-500" />
                    <CardTitle className="text-base">Risiken</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {(analysisResult.risks || []).map((r: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <XCircle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-yellow-500" />
                    <CardTitle className="text-base">Empfehlungen</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {(analysisResult.recommendations || []).map((r: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Target className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Top Holdings */}
            {holdings.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    <CardTitle>Top Positionen</CardTitle>
                  </div>
                  <CardDescription>Die grössten Positionen im analysierten Portfolio</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[...holdings]
                      .sort((a: any, b: any) => b.weight - a.weight)
                      .slice(0, 8)
                      .map((h: any) => (
                        <div key={h.ticker} className="flex items-center justify-between py-1">
                          <div className="flex items-center gap-3">
                            <span className="font-medium text-sm w-20">{h.ticker}</span>
                            <span className="text-xs text-muted-foreground">{h.sector}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="w-24 bg-muted rounded-full h-1.5">
                              <div
                                className="bg-primary h-1.5 rounded-full"
                                style={{ width: `${Math.min(100, h.weight * 3)}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium w-12 text-right">{h.weight.toFixed(1)}%</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
