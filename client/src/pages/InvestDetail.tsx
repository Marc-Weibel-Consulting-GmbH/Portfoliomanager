import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useRef, useState } from "react";
import { useRoute, useLocation } from "wouter";
import {
  ArrowLeft, TrendingUp, TrendingDown, Minus, ExternalLink, Globe, Users,
  BarChart3, Activity, DollarSign, Target, Loader2, AlertTriangle
} from "lucide-react";
import Chart from "chart.js/auto";

export default function InvestDetail() {
  const [matched, params] = useRoute("/invest/:ticker");
  const [, setLocation] = useLocation();
  const ticker = (params as any)?.ticker || "";
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);
  const [chartPeriod, setChartPeriod] = useState<string>("1Y");

  const { data: stockData, isLoading, error } = trpc.invest.stockDetail.useQuery(
    { ticker },
    { enabled: !!ticker }
  );

  const { data: newsData } = trpc.invest.stockNews.useQuery(
    { ticker },
    { enabled: !!ticker }
  );

  // Chart rendering
  useEffect(() => {
    if (!chartRef.current || !stockData?.priceHistory?.length) return;

    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    // Filter data by period
    const now = new Date();
    let startDate = new Date(now);
    switch (chartPeriod) {
      case "1M": startDate.setMonth(now.getMonth() - 1); break;
      case "3M": startDate.setMonth(now.getMonth() - 3); break;
      case "6M": startDate.setMonth(now.getMonth() - 6); break;
      case "1Y": startDate.setFullYear(now.getFullYear() - 1); break;
      case "3Y": startDate.setFullYear(now.getFullYear() - 3); break;
      case "5Y": startDate.setFullYear(now.getFullYear() - 5); break;
      case "10Y": startDate.setFullYear(now.getFullYear() - 10); break;
      case "MAX": startDate = new Date("2000-01-01"); break;
      default: startDate = new Date("2000-01-01");
    }

    const filteredData = stockData.priceHistory.filter(
      (p) => new Date(p.date) >= startDate
    );

    const labels = filteredData.map(p => p.date);
    const prices = filteredData.map(p => p.close);

    const isPositive = prices.length > 1 && prices[prices.length - 1] >= prices[0];
    const lineColor = isPositive ? "rgb(34, 197, 94)" : "rgb(239, 68, 68)";
    const bgColor = isPositive ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)";

    chartInstance.current = new Chart(chartRef.current, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: `${ticker} Kurs`,
          data: prices,
          borderColor: lineColor,
          backgroundColor: bgColor,
          fill: true,
          tension: 0.1,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${stockData.currency || ""} ${ctx.parsed.y.toFixed(2)}`,
            },
          },
        },
        scales: {
          x: {
            display: true,
            ticks: {
              maxTicksLimit: 8,
              font: { size: 10 },
            },
            grid: { display: false },
          },
          y: {
            display: true,
            ticks: {
              font: { size: 10 },
              callback: (val) => `${Number(val).toFixed(0)}`,
            },
            grid: { color: "rgba(0,0,0,0.05)" },
          },
        },
      },
    });

    return () => {
      if (chartInstance.current) chartInstance.current.destroy();
    };
  }, [stockData, chartPeriod, ticker]);

  const formatNumber = (val: number | null | undefined, decimals = 2) => {
    if (val === null || val === undefined) return "—";
    return val.toLocaleString("de-CH", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  const formatLargeNumber = (val: number | null | undefined) => {
    if (!val) return "—";
    if (val >= 1e12) return `${(val / 1e12).toFixed(2)} Bio.`;
    if (val >= 1e9) return `${(val / 1e9).toFixed(2)} Mrd.`;
    if (val >= 1e6) return `${(val / 1e6).toFixed(1)} Mio.`;
    return val.toLocaleString("de-CH");
  };

  const getSignalBadge = (signal: string | undefined, strength: string | undefined) => {
    if (signal === "buy") return <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-base px-3 py-1"><TrendingUp className="w-4 h-4 mr-2" />{strength === "stark" ? "Starkes Kaufsignal" : "Kaufsignal"}</Badge>;
    if (signal === "sell") return <Badge className="bg-red-500/10 text-red-600 border-red-500/20 text-base px-3 py-1"><TrendingDown className="w-4 h-4 mr-2" />{strength === "stark" ? "Starkes Verkaufssignal" : "Verkaufssignal"}</Badge>;
    return <Badge variant="outline" className="text-base px-3 py-1"><Minus className="w-4 h-4 mr-2" />Halten</Badge>;
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !stockData) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <Button variant="ghost" onClick={() => setLocation("/invest")}>
            <ArrowLeft className="w-4 h-4 mr-2" />Zurück
          </Button>
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <p className="text-lg">Keine Daten für "{ticker}" gefunden</p>
              <p className="text-sm mt-2">Bitte überprüfen Sie den Ticker und versuchen Sie es erneut.</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <Button variant="ghost" size="sm" onClick={() => setLocation("/invest")} className="mb-2">
              <ArrowLeft className="w-4 h-4 mr-2" />Zurück zur Suche
            </Button>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{stockData.companyName}</h1>
              <Badge variant="outline" className="font-mono text-base">{ticker}</Badge>
            </div>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              {stockData.sector && <span>{stockData.sector}</span>}
              {stockData.industry && <><span>•</span><span>{stockData.industry}</span></>}
              {stockData.exchange && <><span>•</span><span>{stockData.exchange}</span></>}
              {stockData.country && <><span>•</span><span>{stockData.country}</span></>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">
              {stockData.currency} {formatNumber(stockData.currentPrice)}
            </div>
            {stockData.previousClose && stockData.currentPrice && (
              <div className={`text-sm font-medium ${stockData.currentPrice >= stockData.previousClose ? "text-green-600" : "text-red-600"}`}>
                {stockData.currentPrice >= stockData.previousClose ? "+" : ""}
                {formatNumber(stockData.currentPrice - stockData.previousClose)} ({formatNumber(((stockData.currentPrice - stockData.previousClose) / stockData.previousClose) * 100)}%)
              </div>
            )}
          </div>
        </div>

        {/* Recommendation */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {getSignalBadge(stockData.recommendation?.signal, stockData.recommendation?.strength)}
                <span className="text-sm text-muted-foreground">Score: <span className="font-mono font-bold">{stockData.signalScore}</span>/100</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {stockData.recommendation?.reasons.map((r, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">{r}</Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* LPPLS Bubble Risk */}
        <BubbleRiskCard ticker={ticker} />

        {/* Chart */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Kursverlauf</CardTitle>
              <div className="flex gap-1">
                {["1M", "3M", "6M", "1Y", "3Y", "5Y", "10Y", "MAX"].map(p => (
                  <Button
                    key={p}
                    variant={chartPeriod === p ? "default" : "ghost"}
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setChartPeriod(p)}
                  >
                    {p}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div style={{ height: "350px" }}>
              <canvas ref={chartRef} />
            </div>
          </CardContent>
        </Card>

        {/* Tabs: Kennzahlen, Kursdaten, Analysten, News */}
        <Tabs defaultValue="metrics" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="metrics">Kennzahlen</TabsTrigger>
            <TabsTrigger value="price">Kursdaten</TabsTrigger>
            <TabsTrigger value="analysts">Analysten</TabsTrigger>
            <TabsTrigger value="news">News</TabsTrigger>
          </TabsList>

          <TabsContent value="metrics" className="mt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard label="P/E Ratio" value={formatNumber(stockData.peRatio, 1)} icon={<BarChart3 className="w-4 h-4" />} />
              <MetricCard label="PEG Ratio" value={formatNumber(stockData.pegRatio, 2)} icon={<Activity className="w-4 h-4" />} />
              <MetricCard label="EPS" value={formatNumber(stockData.eps, 2)} icon={<DollarSign className="w-4 h-4" />} />
              <MetricCard label="Dividendenrendite" value={stockData.dividendYield ? `${formatNumber(stockData.dividendYield, 1)}%` : "—"} icon={<TrendingUp className="w-4 h-4" />} />
              <MetricCard label="Beta" value={formatNumber(stockData.beta, 2)} icon={<Activity className="w-4 h-4" />} />
              <MetricCard label="Market Cap" value={formatLargeNumber(stockData.marketCap)} icon={<Globe className="w-4 h-4" />} />
              <MetricCard label="52W Hoch" value={`${stockData.currency || ""} ${formatNumber(stockData.week52High)}`} icon={<TrendingUp className="w-4 h-4" />} />
              <MetricCard label="52W Tief" value={`${stockData.currency || ""} ${formatNumber(stockData.week52Low)}`} icon={<TrendingDown className="w-4 h-4" />} />
              <MetricCard label="RSI (14)" value={stockData.rsi14 ? formatNumber(stockData.rsi14, 0) : "—"} icon={<Activity className="w-4 h-4" />} highlight={stockData.rsi14 ? (stockData.rsi14 < 30 ? "green" : stockData.rsi14 > 70 ? "red" : undefined) : undefined} />
              <MetricCard label="Price/Book" value={formatNumber(stockData.priceToBook, 2)} icon={<BarChart3 className="w-4 h-4" />} />
              <MetricCard label="ROE" value={stockData.returnOnEquity ? `${formatNumber(stockData.returnOnEquity, 1)}%` : "—"} icon={<Target className="w-4 h-4" />} />
              <MetricCard label="Umsatzwachstum" value={stockData.revenueGrowth ? `${formatNumber(stockData.revenueGrowth, 1)}%` : "—"} icon={<TrendingUp className="w-4 h-4" />} />
              <MetricCard label="Gewinnmarge" value={stockData.profitMargin ? `${formatNumber(stockData.profitMargin, 1)}%` : "—"} icon={<DollarSign className="w-4 h-4" />} />
              <MetricCard label="Debt/Equity" value={formatNumber(stockData.debtToEquity, 1)} icon={<BarChart3 className="w-4 h-4" />} />
              <MetricCard label="50-Tage Ø" value={`${stockData.currency || ""} ${formatNumber(stockData.fiftyDayAvg)}`} icon={<Activity className="w-4 h-4" />} />
              <MetricCard label="200-Tage Ø" value={`${stockData.currency || ""} ${formatNumber(stockData.twoHundredDayAvg)}`} icon={<Activity className="w-4 h-4" />} />
            </div>
          </TabsContent>

          <TabsContent value="price" className="mt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard label="Aktueller Kurs" value={`${stockData.currency || ""} ${formatNumber(stockData.currentPrice)}`} icon={<DollarSign className="w-4 h-4" />} />
              <MetricCard label="Vortagesschluss" value={`${stockData.currency || ""} ${formatNumber(stockData.previousClose)}`} icon={<DollarSign className="w-4 h-4" />} />
              <MetricCard label="Eröffnung" value={`${stockData.currency || ""} ${formatNumber(stockData.open)}`} icon={<DollarSign className="w-4 h-4" />} />
              <MetricCard label="Tageshoch" value={`${stockData.currency || ""} ${formatNumber(stockData.dayHigh)}`} icon={<TrendingUp className="w-4 h-4" />} />
              <MetricCard label="Tagestief" value={`${stockData.currency || ""} ${formatNumber(stockData.dayLow)}`} icon={<TrendingDown className="w-4 h-4" />} />
              <MetricCard label="Volumen" value={formatLargeNumber(stockData.volume)} icon={<BarChart3 className="w-4 h-4" />} />
              <MetricCard label="Ø Volumen" value={formatLargeNumber(stockData.avgVolume)} icon={<BarChart3 className="w-4 h-4" />} />
              <MetricCard label="Mitarbeiter" value={stockData.employees ? stockData.employees.toLocaleString("de-CH") : "—"} icon={<Users className="w-4 h-4" />} />
            </div>
            {stockData.description && (
              <Card className="mt-4">
                <CardHeader><CardTitle className="text-base">Unternehmensbeschreibung</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-6">{stockData.description}</p>
                  {stockData.website && (
                    <a href={stockData.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary mt-2 hover:underline">
                      <Globe className="w-3 h-3" />{stockData.website}
                    </a>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="analysts" className="mt-4">
            {stockData.analystConsensus && (
              <Card>
                <CardHeader><CardTitle className="text-base">Analysten-Konsens</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="text-center p-3 rounded-lg bg-green-500/10">
                      <div className="text-2xl font-bold text-green-600">{stockData.analystConsensus.buy}</div>
                      <div className="text-xs text-muted-foreground">Kaufen</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-yellow-500/10">
                      <div className="text-2xl font-bold text-yellow-600">{stockData.analystConsensus.hold}</div>
                      <div className="text-xs text-muted-foreground">Halten</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-red-500/10">
                      <div className="text-2xl font-bold text-red-600">{stockData.analystConsensus.sell}</div>
                      <div className="text-xs text-muted-foreground">Verkaufen</div>
                    </div>
                    {stockData.analystConsensus.targetPrice && (
                      <div className="text-center p-3 rounded-lg bg-primary/10">
                        <div className="text-2xl font-bold text-primary">{stockData.currency} {formatNumber(stockData.analystConsensus.targetPrice)}</div>
                        <div className="text-xs text-muted-foreground">Kursziel</div>
                      </div>
                    )}
                  </div>
                  {stockData.analystConsensus.targetPrice && stockData.currentPrice && (
                    <div className="text-sm text-muted-foreground">
                      Potenzial: <span className={`font-semibold ${stockData.analystConsensus.targetPrice > stockData.currentPrice ? "text-green-600" : "text-red-600"}`}>
                        {formatNumber(((stockData.analystConsensus.targetPrice - stockData.currentPrice) / stockData.currentPrice) * 100, 1)}%
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="news" className="mt-4">
            {newsData?.news && newsData.news.length > 0 ? (
              <div className="grid gap-3">
                {newsData.news.map((article, i) => (
                  <Card key={i} className="hover:bg-muted/50 transition-colors">
                    <CardContent className="py-3 px-4">
                      <a href={article.link} target="_blank" rel="noopener noreferrer" className="block">
                        <div className="flex items-start gap-4">
                          {article.thumbnail && (
                            <img
                              src={article.thumbnail}
                              alt=""
                              className="w-20 h-14 object-cover rounded flex-shrink-0"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-sm leading-tight hover:text-primary transition-colors line-clamp-2">{article.title}</h3>
                            <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                              <span className="font-medium">{article.publisher}</span>
                              {article.publishedAt && (
                                <>
                                  <span>•</span>
                                  <span>{new Date(article.publishedAt).toLocaleDateString("de-CH", { day: "2-digit", month: "short", year: "numeric" })}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                        </div>
                      </a>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Keine aktuellen News verfügbar
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

function BubbleRiskCard({ ticker }: { ticker: string }) {
  const { data, isLoading } = trpc.prediction.bubbleAnalysis.useQuery(
    { ticker },
    { enabled: !!ticker }
  );

  if (isLoading || !data?.result) return null;

  const { bubbleConfidence, regime, daysUntilCritical, superExponentialGrowth, logPeriodicOscillation } = data.result;
  
  // Only show if there's meaningful bubble risk
  if (bubbleConfidence < 0.2) return null;

  const getRiskColor = (conf: number) => {
    if (conf >= 0.7) return 'text-red-500 bg-red-500/10 border-red-500/30';
    if (conf >= 0.5) return 'text-orange-500 bg-orange-500/10 border-orange-500/30';
    return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30';
  };

  const getRiskLabel = (conf: number) => {
    if (conf >= 0.7) return 'Hohes Bubble-Risiko';
    if (conf >= 0.5) return 'Erh\u00f6htes Bubble-Risiko';
    return 'Leichtes Bubble-Risiko';
  };

  return (
    <Card className={`border ${getRiskColor(bubbleConfidence)}`}>
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5" />
            <div>
              <div className="font-semibold text-sm">{getRiskLabel(bubbleConfidence)}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                LPPLS-Modell (Sornette) · Konfidenz: {(bubbleConfidence * 100).toFixed(0)}%
                {regime === 'negative_bubble' && ' · Negativblase'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs">
            {daysUntilCritical && daysUntilCritical > 0 && (
              <div className="text-center">
                <div className="font-bold text-lg">{daysUntilCritical}</div>
                <div className="text-muted-foreground">Tage bis tc</div>
              </div>
            )}
            <div className="flex flex-col gap-1">
              {superExponentialGrowth && <Badge variant="outline" className="text-xs">Super-exp. Wachstum</Badge>}
              {logPeriodicOscillation && <Badge variant="outline" className="text-xs">Log-period. Oszillation</Badge>}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MetricCard({ label, value, icon, highlight }: { label: string; value: string; icon: React.ReactNode; highlight?: "green" | "red" }) {
  return (
    <Card>
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          {icon}
          <span className="text-xs">{label}</span>
        </div>
        <div className={`text-lg font-semibold font-mono ${highlight === "green" ? "text-green-600" : highlight === "red" ? "text-red-600" : ""}`}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
