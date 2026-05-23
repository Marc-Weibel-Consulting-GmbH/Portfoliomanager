import { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, TrendingDown, Minus, Brain, BarChart3, Target, AlertTriangle } from 'lucide-react';

export default function Prediction() {
  const [selectedPortfolio, setSelectedPortfolio] = useState<string>('');
  const [selectedTicker, setSelectedTicker] = useState<string>('');

  const { data: portfolios } = trpc.portfolios.list.useQuery();

  const portfolio = portfolios?.find((p: any) => p.id?.toString() === selectedPortfolio);
  const portfolioStocks = useMemo(() => {
    if (!portfolio) return [];
    const data = typeof portfolio.portfolioData === 'string'
      ? JSON.parse(portfolio.portfolioData)
      : portfolio.portfolioData;
    const stocks = Array.isArray(data) ? data : data?.stocks || [];
    return stocks.map((s: any) => s.ticker || s.symbol).filter(Boolean);
  }, [portfolio]);

  // Single stock prediction
  const { data: prediction, isLoading: predLoading } = trpc.prediction.predict.useQuery(
    { ticker: selectedTicker },
    { enabled: !!selectedTicker }
  );

  // Portfolio batch predictions
  const { data: batchPredictions, isLoading: batchLoading } = trpc.prediction.portfolioPredictions.useQuery(
    { tickers: portfolioStocks.slice(0, 20) },
    { enabled: portfolioStocks.length > 0 && !selectedTicker }
  );

  const trendIcon = (trend: string) => {
    if (trend === 'bullish') return <TrendingUp className="w-5 h-5 text-emerald-400" />;
    if (trend === 'bearish') return <TrendingDown className="w-5 h-5 text-red-400" />;
    return <Minus className="w-5 h-5 text-gray-400" />;
  };

  const signalColor = (signal: string) => {
    if (signal === 'strong_buy') return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    if (signal === 'buy') return 'bg-green-500/20 text-green-300 border-green-500/30';
    if (signal === 'sell') return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
    if (signal === 'strong_sell') return 'bg-red-500/20 text-red-300 border-red-500/30';
    return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
  };

  const signalLabel = (signal: string) => {
    const map: Record<string, string> = {
      strong_buy: 'Starkes Kaufsignal',
      buy: 'Kaufsignal',
      hold: 'Halten',
      sell: 'Verkaufssignal',
      strong_sell: 'Starkes Verkaufssignal',
    };
    return map[signal] || signal;
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Brain className="w-7 h-7 text-emerald-400" />
          KI-Prognose
        </h1>
        <p className="text-muted-foreground mt-1">
          Machine Learning Kursprognosen (Linear Regression + Holt-Winters Ensemble) und Random Forest Signale
        </p>
      </div>

      {/* Selection */}
      <div className="flex flex-wrap gap-4">
        <Select value={selectedPortfolio} onValueChange={(v) => { setSelectedPortfolio(v); setSelectedTicker(''); }}>
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="Portfolio auswählen" />
          </SelectTrigger>
          <SelectContent>
            {portfolios?.map((p: any) => (
              <SelectItem key={p.id} value={p.id?.toString()}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {portfolioStocks.length > 0 && (
          <Select value={selectedTicker} onValueChange={setSelectedTicker}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Aktie auswählen" />
            </SelectTrigger>
            <SelectContent>
              {portfolioStocks.map((t: string) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Single Stock Prediction */}
      {selectedTicker && (
        <div className="space-y-4">
          {predLoading && (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="animate-pulse flex flex-col items-center gap-2">
                  <Brain className="w-8 h-8 text-emerald-400 animate-spin" />
                  <p className="text-muted-foreground">ML-Modell trainiert auf {selectedTicker}...</p>
                  <p className="text-xs text-muted-foreground">Analysiere 2 Jahre historische Daten</p>
                </div>
              </CardContent>
            </Card>
          )}

          {prediction?.error && (
            <Card className="border-red-500/30">
              <CardContent className="p-4 flex items-center gap-2 text-red-400">
                <AlertTriangle className="w-5 h-5" />
                {prediction.error}
              </CardContent>
            </Card>
          )}

          {prediction?.prediction && (
            <Tabs defaultValue="prediction">
              <TabsList>
                <TabsTrigger value="prediction">Kursprognose</TabsTrigger>
                <TabsTrigger value="rf">Random Forest Signal</TabsTrigger>
                <TabsTrigger value="model">Modell-Details</TabsTrigger>
              </TabsList>

              <TabsContent value="prediction" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(['days30', 'days60', 'days90'] as const).map((period) => {
                    const pred = prediction.prediction!.predictions[period];
                    const label = period === 'days30' ? '30 Tage' : period === 'days60' ? '60 Tage' : '90 Tage';
                    const pctChange = ((pred.predictedPrice - prediction.prediction!.currentPrice) / prediction.prediction!.currentPrice) * 100;
                    
                    return (
                      <Card key={period}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium flex items-center justify-between">
                            <span>{label} Prognose</span>
                            {trendIcon(pred.trend)}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div>
                              <p className="text-2xl font-bold">
                                {(prediction as any).currency} {pred.predictedPrice.toFixed(2)}
                              </p>
                              <p className={`text-sm ${pctChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {pctChange >= 0 ? '+' : ''}{pctChange.toFixed(1)}% vs. aktuell ({(prediction as any).currency} {(prediction as any).prediction?.currentPrice?.toFixed(2)})
                              </p>
                            </div>
                            
                            <div className="text-xs space-y-1 text-muted-foreground">
                              <div className="flex justify-between">
                                <span>Obergrenze (95%)</span>
                                <span>{(prediction as any).currency} {pred.upperBound.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Untergrenze (95%)</span>
                                <span>{(prediction as any).currency} {pred.lowerBound.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Konfidenz</span>
                                <span>{(pred.confidence * 100).toFixed(0)}%</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Annualisierte Rendite</span>
                                <span className={pred.annualizedReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                                  {(pred.annualizedReturn * 100).toFixed(1)}%
                                </span>
                              </div>
                            </div>

                            {/* Confidence bar */}
                            <div className="w-full bg-gray-700 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${pred.confidence > 0.6 ? 'bg-emerald-400' : pred.confidence > 0.3 ? 'bg-yellow-400' : 'bg-red-400'}`}
                                style={{ width: `${pred.confidence * 100}%` }}
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>

              <TabsContent value="rf" className="space-y-4">
                {prediction.rfSignal && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <Target className="w-4 h-4" />
                          Random Forest Signal
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center gap-3">
                          <Badge className={`text-lg px-4 py-2 ${signalColor(prediction.rfSignal.signal)}`}>
                            {signalLabel(prediction.rfSignal.signal)}
                          </Badge>
                          <span className="text-2xl font-bold">{prediction.rfSignal.score}/100</span>
                        </div>
                        
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Konfidenz</p>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-700 rounded-full h-3">
                              <div
                                className="h-3 rounded-full bg-emerald-400"
                                style={{ width: `${prediction.rfSignal.confidence * 100}%` }}
                              />
                            </div>
                            <span className="text-sm">{(prediction.rfSignal.confidence * 100).toFixed(0)}%</span>
                          </div>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground mb-2">Begründung</p>
                          <div className="flex flex-wrap gap-1">
                            {prediction.rfSignal.reasons.map((r, i) => (
                              <Badge key={i} variant="outline" className="text-xs">{r}</Badge>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <BarChart3 className="w-4 h-4" />
                          Feature Importance (Top 5)
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {prediction.rfSignal.featureImportance.map((fi, i) => (
                            <div key={i} className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span>{fi.feature}</span>
                                <span className="text-muted-foreground">{(fi.importance * 100).toFixed(0)}%</span>
                              </div>
                              <div className="w-full bg-gray-700 rounded-full h-2">
                                <div
                                  className="h-2 rounded-full bg-cyan-400"
                                  style={{ width: `${fi.importance * 100}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="model">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Modell-Metriken</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Methode</p>
                        <p className="text-sm font-medium">{(prediction as any).prediction?.modelMetrics?.method}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">R² (Bestimmtheitsmass)</p>
                        <p className="text-sm font-medium">{(prediction as any).prediction?.modelMetrics?.rSquared?.toFixed(3)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">MSE (Mean Squared Error)</p>
                        <p className="text-sm font-medium">{(prediction as any).prediction?.modelMetrics?.mse?.toFixed(5)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Ticker (Yahoo)</p>
                        <p className="text-sm font-medium">{(prediction as any).yahooTicker}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Währung</p>
                        <p className="text-sm font-medium">{(prediction as any).currency}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Trainingsdaten</p>
                        <p className="text-sm font-medium">~500 Tage (2 Jahre)</p>
                      </div>
                    </div>
                    
                    <div className="mt-4 p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
                      <p className="font-medium mb-1">Hinweis:</p>
                      <p>Diese Prognosen basieren auf statistischen Modellen und historischen Mustern. 
                      Sie stellen keine Anlageberatung dar. Die tatsächliche Kursentwicklung kann erheblich 
                      von den Prognosen abweichen. Random Forest nutzt 15 technische und fundamentale 
                      Indikatoren, trainiert auf den letzten 2 Jahren.</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </div>
      )}

      {/* Portfolio Batch View */}
      {!selectedTicker && portfolioStocks.length > 0 && (
        <div>
          {batchLoading && (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="animate-pulse flex flex-col items-center gap-2">
                  <Brain className="w-8 h-8 text-emerald-400 animate-spin" />
                  <p className="text-muted-foreground">Analysiere {portfolioStocks.length} Aktien...</p>
                </div>
              </CardContent>
            </Card>
          )}

          {batchPredictions && batchPredictions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Portfolio-Prognosen (30 & 90 Tage)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-2">Ticker</th>
                        <th className="text-right py-2 px-2">Aktuell</th>
                        <th className="text-right py-2 px-2">30T Prognose</th>
                        <th className="text-right py-2 px-2">90T Prognose</th>
                        <th className="text-center py-2 px-2">Trend</th>
                        <th className="text-center py-2 px-2">Konfidenz</th>
                        <th className="text-center py-2 px-2">RF Signal</th>
                        <th className="text-center py-2 px-2">RF Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchPredictions
                        .sort((a, b) => b.rfScore - a.rfScore)
                        .map((item) => {
                          const change30 = ((item.predicted30d - item.currentPrice) / item.currentPrice) * 100;
                          const change90 = ((item.predicted90d - item.currentPrice) / item.currentPrice) * 100;
                          return (
                            <tr
                              key={item.ticker}
                              className="border-b border-border/50 hover:bg-muted/20 cursor-pointer"
                              onClick={() => setSelectedTicker(item.ticker)}
                            >
                              <td className="py-2 px-2 font-medium">{item.ticker}</td>
                              <td className="text-right py-2 px-2">{item.currentPrice.toFixed(2)}</td>
                              <td className={`text-right py-2 px-2 ${change30 >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {item.predicted30d.toFixed(2)} ({change30 >= 0 ? '+' : ''}{change30.toFixed(1)}%)
                              </td>
                              <td className={`text-right py-2 px-2 ${change90 >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {item.predicted90d.toFixed(2)} ({change90 >= 0 ? '+' : ''}{change90.toFixed(1)}%)
                              </td>
                              <td className="text-center py-2 px-2">{trendIcon(item.trend)}</td>
                              <td className="text-center py-2 px-2">{(item.confidence * 100).toFixed(0)}%</td>
                              <td className="text-center py-2 px-2">
                                <Badge className={`text-xs ${signalColor(item.rfSignal)}`}>
                                  {signalLabel(item.rfSignal)}
                                </Badge>
                              </td>
                              <td className="text-center py-2 px-2 font-bold">{item.rfScore}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {!selectedPortfolio && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Brain className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Wähle ein Portfolio aus, um ML-basierte Kursprognosen und Random Forest Signale zu erhalten.</p>
            <p className="text-xs mt-2">Modelle: Linear Regression + Holt-Winters Ensemble + Random Forest (50 Bäume, 15 Features)</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
