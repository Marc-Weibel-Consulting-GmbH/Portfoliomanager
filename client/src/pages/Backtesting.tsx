import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, BarChart3, Target, Activity, Clock, ArrowUpRight, ArrowDownRight } from "lucide-react";

function getWithCurrency(value: number | null | undefined, decimals = 2): string {
  if (value == null || isNaN(value)) return "–";
  return value.toFixed(decimals) + "%";
}

export default function Backtesting() {
  const { user } = useAuth();
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<number | null>(null);
  const [selectedTicker, setSelectedTicker] = useState<string>("");
  const [lookbackMonths, setLookbackMonths] = useState(12);
  const [activeTab, setActiveTab] = useState("portfolio");

  const portfoliosQuery = trpc.portfolios.list.useQuery();

  const portfolioBacktest = trpc.backtest.runPortfolio.useQuery(
    { portfolioId: selectedPortfolioId!, lookbackMonths },
    { enabled: !!selectedPortfolioId && activeTab === "portfolio" }
  );

  const singleBacktest = trpc.backtest.runSingle.useQuery(
    { ticker: selectedTicker, lookbackMonths },
    { enabled: !!selectedTicker && activeTab === "single" }
  );

  // Get tickers from selected portfolio
  const portfolioStocks = useMemo(() => {
    if (!portfoliosQuery.data || !selectedPortfolioId) return [];
    const portfolio = portfoliosQuery.data.find((p: any) => p.id === selectedPortfolioId);
    if (!portfolio) return [];
    try {
      const data = JSON.parse(portfolio.portfolioData || "{}");
      const stocks = Array.isArray(data) ? data : (data.stocks || []);
      return stocks.map((s: any) => ({ ticker: s.ticker, name: s.companyName || s.name || s.ticker }));
    } catch { return []; }
  }, [portfoliosQuery.data, selectedPortfolioId]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Backtesting</h1>
        <p className="text-muted-foreground mt-1">Historische Signal-Performance — wie hätten RSI/MACD-Signale performt?</p>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium">Portfolio</label>
              <Select
                value={selectedPortfolioId?.toString() || ""}
                onValueChange={(v) => {
                  setSelectedPortfolioId(parseInt(v));
                  setSelectedTicker("");
                }}
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Portfolio wählen" />
                </SelectTrigger>
                <SelectContent>
                  {portfoliosQuery.data?.map((p: any) => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Zeitraum</label>
              <Select value={lookbackMonths.toString()} onValueChange={(v) => setLookbackMonths(parseInt(v))}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 Monate</SelectItem>
                  <SelectItem value="6">6 Monate</SelectItem>
                  <SelectItem value="12">12 Monate</SelectItem>
                  <SelectItem value="24">24 Monate</SelectItem>
                  <SelectItem value="36">36 Monate</SelectItem>
                  <SelectItem value="60">60 Monate</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {activeTab === "single" && portfolioStocks.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Aktie</label>
                <Select value={selectedTicker} onValueChange={setSelectedTicker}>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Aktie wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {portfolioStocks.map((s: any) => (
                      <SelectItem key={s.ticker} value={s.ticker}>
                        {s.ticker} — {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedPortfolioId && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="portfolio">Portfolio-Backtest</TabsTrigger>
            <TabsTrigger value="single">Einzeltitel-Backtest</TabsTrigger>
          </TabsList>

          {/* Portfolio Backtest */}
          <TabsContent value="portfolio" className="space-y-6">
            {portfolioBacktest.isLoading && (
              <Card>
                <CardContent className="py-12 text-center">
                  <Activity className="w-8 h-8 animate-spin mx-auto text-primary mb-4" />
                  <p className="text-muted-foreground">Backtest wird berechnet... (kann bis zu 60s dauern)</p>
                </CardContent>
              </Card>
            )}

            {portfolioBacktest.data && (
              <>
                {/* Summary Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Target className="w-4 h-4 text-primary" />
                        <span className="text-xs text-muted-foreground">Signal-Rendite (gew.)</span>
                      </div>
                      <p className={`text-xl font-bold ${portfolioBacktest.data.portfolioMetrics.weightedSignalReturn >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {getWithCurrency(portfolioBacktest.data.portfolioMetrics.weightedSignalReturn)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center gap-2 mb-1">
                        <BarChart3 className="w-4 h-4 text-blue-500" />
                        <span className="text-xs text-muted-foreground">Buy & Hold (gew.)</span>
                      </div>
                      <p className={`text-xl font-bold ${portfolioBacktest.data.portfolioMetrics.weightedBuyHoldReturn >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {getWithCurrency(portfolioBacktest.data.portfolioMetrics.weightedBuyHoldReturn)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center gap-2 mb-1">
                        {portfolioBacktest.data.portfolioMetrics.outperformance >= 0 ? 
                          <TrendingUp className="w-4 h-4 text-green-500" /> :
                          <TrendingDown className="w-4 h-4 text-red-500" />
                        }
                        <span className="text-xs text-muted-foreground">Outperformance</span>
                      </div>
                      <p className={`text-xl font-bold ${portfolioBacktest.data.portfolioMetrics.outperformance >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {getWithCurrency(portfolioBacktest.data.portfolioMetrics.outperformance)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Activity className="w-4 h-4 text-purple-500" />
                        <span className="text-xs text-muted-foreground">Ø Win Rate</span>
                      </div>
                      <p className="text-xl font-bold text-foreground">
                        {getWithCurrency(portfolioBacktest.data.portfolioMetrics.avgWinRate)}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Benchmark Comparison */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Benchmark-Vergleich</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">S&P 500</p>
                        <p className={`text-lg font-bold ${(portfolioBacktest.data.portfolioMetrics as any).sp500Return >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {getWithCurrency((portfolioBacktest.data.portfolioMetrics as any).sp500Return)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">SMI (Schweiz)</p>
                        <p className={`text-lg font-bold ${(portfolioBacktest.data.portfolioMetrics as any).spiReturn >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {getWithCurrency((portfolioBacktest.data.portfolioMetrics as any).spiReturn)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">vs. S&P 500</p>
                        <p className={`text-lg font-bold ${(portfolioBacktest.data.portfolioMetrics as any).vsSpx >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {(portfolioBacktest.data.portfolioMetrics as any).vsSpx >= 0 ? "+" : ""}{getWithCurrency((portfolioBacktest.data.portfolioMetrics as any).vsSpx)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">vs. SMI</p>
                        <p className={`text-lg font-bold ${(portfolioBacktest.data.portfolioMetrics as any).vsSpi >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {(portfolioBacktest.data.portfolioMetrics as any).vsSpi >= 0 ? "+" : ""}{getWithCurrency((portfolioBacktest.data.portfolioMetrics as any).vsSpi)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Stats Row */}
                <div className="flex gap-4 flex-wrap">
                  <Badge variant="outline" className="text-sm py-1 px-3">
                    {portfolioBacktest.data.portfolioMetrics.totalStocksAnalyzed} Aktien analysiert
                  </Badge>
                  <Badge variant="outline" className="text-sm py-1 px-3">
                    {portfolioBacktest.data.portfolioMetrics.totalSignalsGenerated} Signale generiert
                  </Badge>
                  <Badge variant="outline" className="text-sm py-1 px-3">
                    {portfolioBacktest.data.portfolioMetrics.totalTradesExecuted} Trades ausgeführt
                  </Badge>
                  <Badge variant="outline" className="text-sm py-1 px-3">
                    <Clock className="w-3 h-3 mr-1" /> {portfolioBacktest.data.period}
                  </Badge>
                </div>

                {/* Stock Results Table */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Ergebnisse pro Aktie</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-3 px-2">Ticker</th>
                            <th className="text-left py-3 px-2">Unternehmen</th>
                            <th className="text-right py-3 px-2">Gewicht</th>
                            <th className="text-right py-3 px-2">Signale</th>
                            <th className="text-right py-3 px-2">Trades</th>
                            <th className="text-right py-3 px-2">Signal-Rendite</th>
                            <th className="text-right py-3 px-2">Buy & Hold</th>
                            <th className="text-right py-3 px-2">Outperformance</th>
                            <th className="text-right py-3 px-2">Win Rate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {portfolioBacktest.data.stockResults.map((r: any) => (
                            <tr key={r.ticker} className="border-b border-border/50 hover:bg-muted/50">
                              <td className="py-2 px-2 font-mono font-medium">{r.ticker}</td>
                              <td className="py-2 px-2 text-muted-foreground">{r.companyName}</td>
                              <td className="py-2 px-2 text-right">{r.weight.toFixed(1)}%</td>
                              <td className="py-2 px-2 text-right">{r.totalSignals}</td>
                              <td className="py-2 px-2 text-right">{r.totalTrades}</td>
                              <td className={`py-2 px-2 text-right font-medium ${r.signalReturn >= 0 ? "text-green-500" : "text-red-500"}`}>
                                {r.signalReturn.toFixed(2)}%
                              </td>
                              <td className={`py-2 px-2 text-right ${r.buyHoldReturn >= 0 ? "text-green-500" : "text-red-500"}`}>
                                {r.buyHoldReturn.toFixed(2)}%
                              </td>
                              <td className="py-2 px-2 text-right">
                                <span className={`inline-flex items-center gap-1 ${r.outperformance >= 0 ? "text-green-500" : "text-red-500"}`}>
                                  {r.outperformance >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                  {r.outperformance.toFixed(2)}%
                                </span>
                              </td>
                              <td className="py-2 px-2 text-right">{r.winRate.toFixed(0)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Single Stock Backtest */}
          <TabsContent value="single" className="space-y-6">
            {!selectedTicker && (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Wähle eine Aktie aus deinem Portfolio für den Einzeltitel-Backtest.
                </CardContent>
              </Card>
            )}

            {singleBacktest.isLoading && (
              <Card>
                <CardContent className="py-12 text-center">
                  <Activity className="w-8 h-8 animate-spin mx-auto text-primary mb-4" />
                  <p className="text-muted-foreground">Backtest wird berechnet...</p>
                </CardContent>
              </Card>
            )}

            {singleBacktest.data && (
              <>
                {/* Metrics Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <Card>
                    <CardContent className="pt-4 pb-4">
                      <span className="text-xs text-muted-foreground">Signal-Rendite</span>
                      <p className={`text-xl font-bold ${singleBacktest.data.metrics.totalReturn >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {getWithCurrency(singleBacktest.data.metrics.totalReturn)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-4">
                      <span className="text-xs text-muted-foreground">Buy & Hold</span>
                      <p className={`text-xl font-bold ${singleBacktest.data.metrics.buyHoldReturn >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {getWithCurrency(singleBacktest.data.metrics.buyHoldReturn)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-4">
                      <span className="text-xs text-muted-foreground">Win Rate</span>
                      <p className="text-xl font-bold">{getWithCurrency(singleBacktest.data.metrics.winRate)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-4">
                      <span className="text-xs text-muted-foreground">Profit Factor</span>
                      <p className="text-xl font-bold">{singleBacktest.data.metrics.profitFactor === Infinity ? "∞" : singleBacktest.data.metrics.profitFactor.toFixed(2)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-4">
                      <span className="text-xs text-muted-foreground">Max Drawdown</span>
                      <p className="text-xl font-bold text-red-500">{getWithCurrency(singleBacktest.data.metrics.maxDrawdown)}</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Benchmark Comparison */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Benchmark-Vergleich</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">S&P 500</p>
                        <p className={`text-lg font-bold ${(singleBacktest.data.metrics as any).sp500Return >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {getWithCurrency((singleBacktest.data.metrics as any).sp500Return)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">SMI (Schweiz)</p>
                        <p className={`text-lg font-bold ${(singleBacktest.data.metrics as any).spiReturn >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {getWithCurrency((singleBacktest.data.metrics as any).spiReturn)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">vs. S&P 500</p>
                        <p className={`text-lg font-bold ${(singleBacktest.data.metrics as any).vsSpx >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {(singleBacktest.data.metrics as any).vsSpx >= 0 ? "+" : ""}{getWithCurrency((singleBacktest.data.metrics as any).vsSpx)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">vs. SMI</p>
                        <p className={`text-lg font-bold ${(singleBacktest.data.metrics as any).vsSpi >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {(singleBacktest.data.metrics as any).vsSpi >= 0 ? "+" : ""}{getWithCurrency((singleBacktest.data.metrics as any).vsSpi)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Stats */}
                <div className="flex gap-4 flex-wrap">
                  <Badge variant="outline" className="text-sm py-1 px-3">
                    {singleBacktest.data.metrics.totalTrades} Trades ({singleBacktest.data.metrics.winningTrades}W / {singleBacktest.data.metrics.losingTrades}L)
                  </Badge>
                  <Badge variant="outline" className="text-sm py-1 px-3">
                    Ø Gewinn: {getWithCurrency(singleBacktest.data.metrics.avgWin)}
                  </Badge>
                  <Badge variant="outline" className="text-sm py-1 px-3">
                    Ø Verlust: {getWithCurrency(singleBacktest.data.metrics.avgLoss)}
                  </Badge>
                  <Badge variant={singleBacktest.data.metrics.outperformance >= 0 ? "default" : "destructive"} className="text-sm py-1 px-3">
                    Outperformance: {getWithCurrency(singleBacktest.data.metrics.outperformance)}
                  </Badge>
                </div>

                {/* Signals Table */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Generierte Signale ({singleBacktest.data.signals.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-card">
                          <tr className="border-b border-border">
                            <th className="text-left py-2 px-2">Datum</th>
                            <th className="text-left py-2 px-2">Signal</th>
                            <th className="text-right py-2 px-2">Kurs</th>
                            <th className="text-left py-2 px-2">Begründung</th>
                          </tr>
                        </thead>
                        <tbody>
                          {singleBacktest.data.signals.map((s: any, i: number) => (
                            <tr key={i} className="border-b border-border/50">
                              <td className="py-2 px-2">{new Date(s.date).toLocaleDateString("de-CH")}</td>
                              <td className="py-2 px-2">
                                <Badge variant={s.type === "buy" ? "default" : "destructive"} className="text-xs">
                                  {s.type === "buy" ? "Kaufen" : "Verkaufen"}
                                </Badge>
                              </td>
                              <td className="py-2 px-2 text-right font-mono">{s.price.toFixed(2)}</td>
                              <td className="py-2 px-2 text-muted-foreground text-xs">{s.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* Trades Table */}
                {singleBacktest.data.trades.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Ausgeführte Trades ({singleBacktest.data.trades.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-left py-2 px-2">Einstieg</th>
                              <th className="text-left py-2 px-2">Ausstieg</th>
                              <th className="text-right py-2 px-2">Kaufkurs</th>
                              <th className="text-right py-2 px-2">Verkaufskurs</th>
                              <th className="text-right py-2 px-2">Rendite</th>
                              <th className="text-right py-2 px-2">Haltedauer</th>
                            </tr>
                          </thead>
                          <tbody>
                            {singleBacktest.data.trades.map((t: any, i: number) => (
                              <tr key={i} className="border-b border-border/50">
                                <td className="py-2 px-2">{new Date(t.entryDate).toLocaleDateString("de-CH")}</td>
                                <td className="py-2 px-2">{new Date(t.exitDate).toLocaleDateString("de-CH")}</td>
                                <td className="py-2 px-2 text-right font-mono">{t.entryPrice.toFixed(2)}</td>
                                <td className="py-2 px-2 text-right font-mono">{t.exitPrice.toFixed(2)}</td>
                                <td className={`py-2 px-2 text-right font-medium ${t.returnPct >= 0 ? "text-green-500" : "text-red-500"}`}>
                                  {t.returnPct.toFixed(2)}%
                                </td>
                                <td className="py-2 px-2 text-right">{t.holdingDays} Tage</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      )}

      {!selectedPortfolioId && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Wähle ein Portfolio um den Backtest zu starten.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
