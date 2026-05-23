import { useState, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { RefreshCw, Info, Target, BarChart3, PieChart } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceDot } from "recharts";

const METHOD_LABELS: Record<string, string> = {
  max_sharpe: "Max. Sharpe Ratio",
  min_variance: "Min. Varianz",
  equal_weight: "Gleichgewichtung",
};

const COLORS = ["#6366f1","#22d3ee","#f59e0b","#10b981","#f43f5e","#a78bfa","#34d399","#fb923c","#60a5fa","#e879f9"];

function WeightBar({ ticker, weight, color }: { ticker: string; weight: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-16 truncate font-mono">{ticker}</span>
      <div className="flex-1 bg-muted rounded-full h-2">
        <div className="h-2 rounded-full transition-all" style={{ width: `${weight * 100}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-mono w-12 text-right">{(weight * 100).toFixed(1)}%</span>
    </div>
  );
}

export default function PortfolioOptimizer() {
  const { user } = useAuth();
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<number | null>(null);
  const [method, setMethod] = useState<"max_sharpe" | "min_variance" | "equal_weight">("max_sharpe");
  const [lookbackDays, setLookbackDays] = useState(252);
  const [riskFreeRate, setRiskFreeRate] = useState(2.0);
  const [queryEnabled, setQueryEnabled] = useState(false);
  const [queryParams, setQueryParams] = useState<any>(null);

  const { data: portfolios } = trpc.portfolios.list.useQuery(undefined, { enabled: !!user });
  const activePortfolioId = selectedPortfolioId ?? portfolios?.[0]?.id ?? null;

  const { data: portfolioData } = trpc.portfolios.getWithCurrency.useQuery(
    activePortfolioId!,
    { enabled: !!activePortfolioId }
  );

  const tickers = useMemo(() => {
    if (!portfolioData?.enrichedStocks) return [];
    return portfolioData.enrichedStocks
      .filter((s: any) => s.ticker && s.ticker !== "CASH")
      .map((s: any) => s.ticker);
  }, [portfolioData]);

  const { data: result, isFetching, error } = trpc.analytics.optimize.useQuery(
    queryParams ?? { tickers: tickers.length >= 2 ? tickers : ["AAPL","MSFT"] },
    { enabled: queryEnabled && !!queryParams }
  );

  const handleOptimize = () => {
    if (tickers.length < 2) return;
    setQueryEnabled(false);
    setTimeout(() => {
      setQueryParams({ tickers, lookbackDays, riskFreeRate: riskFreeRate / 100, method });
      setQueryEnabled(true);
    }, 50);
  };

  const frontierData = useMemo(() => {
    if (!result?.efficientFrontier) return [];
    return result.efficientFrontier.map((p: any) => ({
      x: parseFloat((p.volatility * 100).toFixed(2)),
      y: parseFloat((p.expectedReturn * 100).toFixed(2)),
      sharpe: parseFloat(p.sharpe.toFixed(2)),
    }));
  }, [result]);

  const optimalPoint = result ? {
    x: parseFloat((result.optimalPortfolio.volatility * 100).toFixed(2)),
    y: parseFloat((result.optimalPortfolio.expectedReturn * 100).toFixed(2)),
  } : null;

  const currentPoint = result?.currentPortfolio ? {
    x: parseFloat((result.currentPortfolio.volatility * 100).toFixed(2)),
    y: parseFloat((result.currentPortfolio.expectedReturn * 100).toFixed(2)),
  } : null;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Target className="h-6 w-6 text-primary" />
              Portfolio-Optimierung
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Efficient Frontier & Optimale Gewichtung (powered by Fincept / Modern Portfolio Theory)
            </p>
          </div>
          <Select value={activePortfolioId?.toString() ?? ""} onValueChange={(v) => { setSelectedPortfolioId(Number(v)); setQueryEnabled(false); }}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Portfolio wählen" /></SelectTrigger>
            <SelectContent>
              {portfolios?.map((p: any) => (
                <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Optimierungsparameter</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Optimierungsziel</Label>
                <Select value={method} onValueChange={(v: any) => setMethod(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="max_sharpe">Max. Sharpe Ratio</SelectItem>
                    <SelectItem value="min_variance">Min. Varianz (Risiko)</SelectItem>
                    <SelectItem value="equal_weight">Gleichgewichtung</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  Historischer Zeitraum
                  <Tooltip>
                    <TooltipTrigger asChild><Info className="h-3 w-3 cursor-help" /></TooltipTrigger>
                    <TooltipContent><p className="max-w-xs text-xs">Anzahl Handelstage für die Kovarianzmatrix-Berechnung</p></TooltipContent>
                  </Tooltip>
                </Label>
                <div className="flex items-center gap-3">
                  <Slider min={63} max={756} step={63} value={[lookbackDays]} onValueChange={([v]) => setLookbackDays(v)} className="flex-1" />
                  <span className="text-sm font-mono w-16 text-right">
                    {lookbackDays === 63 ? "3M" : lookbackDays === 126 ? "6M" : lookbackDays === 252 ? "1J" : lookbackDays === 504 ? "2J" : "3J"}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Risikofreier Zinssatz</Label>
                <div className="flex items-center gap-3">
                  <Slider min={0} max={8} step={0.1} value={[riskFreeRate]} onValueChange={([v]) => setRiskFreeRate(v)} className="flex-1" />
                  <span className="text-sm font-mono w-12 text-right">{riskFreeRate.toFixed(1)}%</span>
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {tickers.length} Positionen: {tickers.slice(0, 6).join(", ")}{tickers.length > 6 ? ` +${tickers.length - 6}` : ""}
              </p>
              <Button onClick={handleOptimize} disabled={tickers.length < 2 || isFetching} className="gap-2">
                {isFetching ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
                {isFetching ? "Optimiere..." : "Optimieren"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Card className="border-red-800 bg-red-950/20">
            <CardContent className="pt-4">
              <p className="text-red-400 text-sm">Fehler: {(error as any)?.message || "Optimierung fehlgeschlagen."}</p>
            </CardContent>
          </Card>
        )}

        {result && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Erwartete Rendite", value: `${(result.optimalPortfolio.expectedReturn * 100).toFixed(2)}%`, color: "text-emerald-400", tooltip: "Annualisierte erwartete Rendite des optimalen Portfolios" },
                { label: "Volatilität (p.a.)", value: `${(result.optimalPortfolio.volatility * 100).toFixed(2)}%`, color: "text-yellow-400", tooltip: "Annualisierte Standardabweichung (Risiko)" },
                { label: "Sharpe Ratio", value: result.optimalPortfolio.sharpe.toFixed(2), color: result.optimalPortfolio.sharpe >= 1 ? "text-emerald-400" : "text-yellow-400", tooltip: "Risikoadjustierte Rendite" },
                { label: "Methode", value: METHOD_LABELS[result.method] || result.method, color: "text-primary", tooltip: "Verwendetes Optimierungsziel" },
              ].map(({ label, value, color, tooltip }) => (
                <Card key={label} className="bg-card border-border">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start gap-1 mb-1">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <Tooltip>
                        <TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground cursor-help mt-0.5" /></TooltipTrigger>
                        <TooltipContent><p className="max-w-xs text-xs">{tooltip}</p></TooltipContent>
                      </Tooltip>
                    </div>
                    <p className={`text-xl font-bold ${color}`}>{value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Efficient Frontier
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div style={{ height: 280 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="x" name="Volatilität" unit="%" tick={{ fontSize: 10, fill: "#9ca3af" }} label={{ value: "Volatilität (%)", position: "insideBottom", offset: -10, fontSize: 10, fill: "#9ca3af" }} />
                        <YAxis dataKey="y" name="Rendite" unit="%" tick={{ fontSize: 10, fill: "#9ca3af" }} label={{ value: "Rendite (%)", angle: -90, position: "insideLeft", fontSize: 10, fill: "#9ca3af" }} />
                        <RechartsTooltip cursor={{ strokeDasharray: "3 3" }} content={({ active, payload }) => {
                          if (active && payload?.length) {
                            const d = payload[0].payload;
                            return (
                              <div className="bg-card border border-border rounded p-2 text-xs">
                                <p>Rendite: {d.y}%</p>
                                <p>Volatilität: {d.x}%</p>
                                {d.sharpe !== undefined && <p>Sharpe: {d.sharpe}</p>}
                              </div>
                            );
                          }
                          return null;
                        }} />
                        <Scatter name="Efficient Frontier" data={frontierData} fill="#6366f1" opacity={0.6} />
                        {optimalPoint && <ReferenceDot x={optimalPoint.x} y={optimalPoint.y} r={8} fill="#22d3ee" stroke="#fff" strokeWidth={2} label={{ value: "Optimal", position: "top", fontSize: 10, fill: "#22d3ee" }} />}
                        {currentPoint && <ReferenceDot x={currentPoint.x} y={currentPoint.y} r={6} fill="#f59e0b" stroke="#fff" strokeWidth={2} label={{ value: "Aktuell", position: "top", fontSize: 10, fill: "#f59e0b" }} />}
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex gap-4 justify-center mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" /> Optimales Portfolio</span>
                    {currentPoint && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Aktuelles Portfolio</span>}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <PieChart className="h-4 w-4" />
                    Optimale Gewichtung
                    <Badge variant="outline" className="ml-auto text-xs">{METHOD_LABELS[result.method]}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries((result.weights ?? {}) as Record<string, number>)
                      .sort(([, a], [, b]) => b - a)
                      .map(([ticker, weight], i) => (
                        <WeightBar key={ticker} ticker={ticker} weight={weight} color={COLORS[i % COLORS.length]} />
                      ))}
                  </div>
                  {result.currentPortfolio && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <p className="text-xs text-muted-foreground mb-2">Vergleich: Aktuell vs. Optimal</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="text-center p-2 bg-amber-950/30 rounded border border-amber-800/30">
                          <p className="text-muted-foreground">Aktuell</p>
                          <p className="font-medium text-amber-400">{(result.currentPortfolio.expectedReturn * 100).toFixed(1)}% / {(result.currentPortfolio.volatility * 100).toFixed(1)}%</p>
                          <p className="text-muted-foreground">Rendite / Risiko</p>
                        </div>
                        <div className="text-center p-2 bg-cyan-950/30 rounded border border-cyan-800/30">
                          <p className="text-muted-foreground">Optimal</p>
                          <p className="font-medium text-cyan-400">{(result.optimalPortfolio.expectedReturn * 100).toFixed(1)}% / {(result.optimalPortfolio.volatility * 100).toFixed(1)}%</p>
                          <p className="text-muted-foreground">Rendite / Risiko</p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              ⚠️ Die Portfolio-Optimierung basiert auf historischen Renditen und ist keine Garantie für zukünftige Ergebnisse. Keine Anlageberatung.
            </p>
          </>
        )}

        {!result && !isFetching && (
          <Card className="bg-card border-border">
            <CardContent className="py-16 text-center">
              <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Klicken Sie auf "Optimieren", um die Efficient Frontier zu berechnen</p>
              <p className="text-xs text-muted-foreground mt-2">
                {tickers.length < 2 ? "Mindestens 2 Positionen im Portfolio erforderlich" : `${tickers.length} Positionen werden analysiert`}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
