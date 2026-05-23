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
import { TrendingUp, TrendingDown, DollarSign, Calculator, RefreshCw, Info, BarChart3 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

function MetricCard({ title, value, subtitle, color, tooltip }: {
  title: string; value: string; subtitle?: string; color?: string; tooltip?: string;
}) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-1 mb-1">
              <p className="text-xs text-muted-foreground">{title}</p>
              {tooltip && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent><p className="max-w-xs text-xs">{tooltip}</p></TooltipContent>
                </Tooltip>
              )}
            </div>
            <p className={`text-2xl font-bold ${color || "text-foreground"}`}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DCFValuation() {
  const { user } = useAuth();
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<number | null>(null);
  const [selectedTicker, setSelectedTicker] = useState<string>("");
  const [riskFreeRate, setRiskFreeRate] = useState(2.0);
  const [terminalGrowthRate, setTerminalGrowthRate] = useState(2.5);
  const [projectionYears, setProjectionYears] = useState(5);
  const [isRunning, setIsRunning] = useState(false);
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
      .map((s: any) => ({ ticker: s.ticker, name: s.companyName || s.ticker }));
  }, [portfolioData]);

  const activeTicker = selectedTicker || tickers[0]?.ticker || "";

  const { data: dcf, isFetching: dcfLoading, error: dcfError } = trpc.analytics.dcfValuation.useQuery(
    queryParams ?? { ticker: activeTicker },
    { enabled: queryEnabled && !!queryParams }
  );

  const handleRunDCF = () => {
    if (!activeTicker) return;
    setIsRunning(true);
    setQueryEnabled(false);
    setTimeout(() => {
      setQueryParams({
        ticker: activeTicker,
        riskFreeRate: riskFreeRate / 100,
        terminalGrowthRate: terminalGrowthRate / 100,
        projectionYears,
      });
      setQueryEnabled(true);
      setIsRunning(false);
    }, 50);
  };

  const upsideColor = dcf
    ? dcf.upsideDownside >= 20
      ? "text-emerald-400"
      : dcf.upsideDownside >= 0
      ? "text-yellow-400"
      : "text-red-400"
    : "text-foreground";

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Calculator className="h-6 w-6 text-primary" />
              DCF-Bewertung
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Intrinsic Value Berechnung via Discounted Cash Flow (powered by Fincept)
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select
              value={activePortfolioId?.toString() ?? ""}
              onValueChange={(v) => { setSelectedPortfolioId(Number(v)); setSelectedTicker(""); }}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Portfolio wählen" />
              </SelectTrigger>
              <SelectContent>
                {portfolios?.map((p: any) => (
                  <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={activeTicker} onValueChange={setSelectedTicker}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Aktie wählen" />
              </SelectTrigger>
              <SelectContent>
                {tickers.map((t: any) => (
                  <SelectItem key={t.ticker} value={t.ticker}>{t.ticker} – {t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Parameters */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Bewertungsparameter</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  Risikofreier Zinssatz
                  <Tooltip>
                    <TooltipTrigger asChild><Info className="h-3 w-3 cursor-help" /></TooltipTrigger>
                    <TooltipContent><p className="max-w-xs text-xs">Rendite einer risikofreien Anlage (z.B. 10-jährige Staatsanleihe)</p></TooltipContent>
                  </Tooltip>
                </Label>
                <div className="flex items-center gap-3">
                  <Slider
                    min={0} max={8} step={0.1}
                    value={[riskFreeRate]}
                    onValueChange={([v]) => setRiskFreeRate(v)}
                    className="flex-1"
                  />
                  <span className="text-sm font-mono w-12 text-right">{riskFreeRate.toFixed(1)}%</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  Terminales Wachstum
                  <Tooltip>
                    <TooltipTrigger asChild><Info className="h-3 w-3 cursor-help" /></TooltipTrigger>
                    <TooltipContent><p className="max-w-xs text-xs">Langfristige Wachstumsrate nach dem Projektionszeitraum (typisch: 2-3%)</p></TooltipContent>
                  </Tooltip>
                </Label>
                <div className="flex items-center gap-3">
                  <Slider
                    min={0} max={5} step={0.1}
                    value={[terminalGrowthRate]}
                    onValueChange={([v]) => setTerminalGrowthRate(v)}
                    className="flex-1"
                  />
                  <span className="text-sm font-mono w-12 text-right">{terminalGrowthRate.toFixed(1)}%</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Projektionsjahre</Label>
                <div className="flex items-center gap-3">
                  <Slider
                    min={3} max={10} step={1}
                    value={[projectionYears]}
                    onValueChange={([v]) => setProjectionYears(v)}
                    className="flex-1"
                  />
                  <span className="text-sm font-mono w-12 text-right">{projectionYears} J.</span>
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={handleRunDCF} disabled={!activeTicker || isRunning} className="gap-2">
                {isRunning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
                {isRunning ? "Berechne..." : "DCF berechnen"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {dcfError && (
          <Card className="border-red-800 bg-red-950/20">
            <CardContent className="pt-4">
              <p className="text-red-400 text-sm">
                Fehler: {(dcfError as any)?.message || "DCF-Berechnung fehlgeschlagen. Möglicherweise sind keine Cashflow-Daten verfügbar."}
              </p>
            </CardContent>
          </Card>
        )}

        {dcf && (
          <>
            {/* Company Header */}
            <div className="flex items-center gap-3">
              <div>
                <h2 className="text-xl font-bold">{dcf.companyName}</h2>
                <p className="text-muted-foreground text-sm">{dcf.ticker} · {dcf.currency}</p>
              </div>
              <Badge
                variant="outline"
                className={`ml-auto text-sm px-3 py-1 ${
                  dcf.upsideDownside >= 20
                    ? "border-emerald-500 text-emerald-400"
                    : dcf.upsideDownside >= 0
                    ? "border-yellow-500 text-yellow-400"
                    : "border-red-500 text-red-400"
                }`}
              >
                {dcf.upsideDownside >= 0 ? "Unterbewertet" : "Überbewertet"}
              </Badge>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <MetricCard
                title="Aktueller Kurs"
                value={`${dcf.currency} ${dcf.currentPrice.toLocaleString("de-CH", { minimumFractionDigits: 2 })}`}
                subtitle="Marktpreis"
                tooltip="Aktueller Marktpreis der Aktie"
              />
              <MetricCard
                title="Intrinsic Value"
                value={`${dcf.currency} ${dcf.intrinsicValue.toLocaleString("de-CH", { minimumFractionDigits: 2 })}`}
                subtitle="DCF-Bewertung"
                color={dcf.intrinsicValue > dcf.currentPrice ? "text-emerald-400" : "text-red-400"}
                tooltip="Berechneter innerer Wert basierend auf diskontierten zukünftigen Cashflows"
              />
              <MetricCard
                title="Upside / Downside"
                value={`${dcf.upsideDownside >= 0 ? "+" : ""}${dcf.upsideDownside.toFixed(1)}%`}
                subtitle={dcf.upsideDownside >= 0 ? "Potenzial" : "Risiko"}
                color={upsideColor}
                tooltip="Differenz zwischen Intrinsic Value und aktuellem Kurs in Prozent"
              />
              <MetricCard
                title="WACC"
                value={`${dcf.wacc.toFixed(2)}%`}
                subtitle="Diskontierungssatz"
                tooltip="Weighted Average Cost of Capital – der Diskontierungssatz für zukünftige Cashflows"
              />
            </div>

            {/* Details */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Assumptions */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Bewertungsannahmen</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { label: "Free Cash Flow (aktuell)", value: `${dcf.currency} ${(dcf.freeCashFlow / 1e9).toFixed(2)} Mrd.` },
                      { label: "Umsatzwachstum (Schätzung)", value: `${dcf.revenueGrowthEstimate.toFixed(1)}%` },
                      { label: "Beta", value: dcf.beta.toFixed(2) },
                      { label: "Terminales Wachstum", value: `${dcf.terminalGrowthRate.toFixed(1)}%` },
                      { label: "Projektionszeitraum", value: `${dcf.projectionYears} Jahre` },
                      { label: "Aktien ausstehend", value: `${(dcf.sharesOutstanding / 1e9).toFixed(2)} Mrd.` },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex justify-between items-center py-1 border-b border-border/50 last:border-0">
                        <span className="text-sm text-muted-foreground">{label}</span>
                        <span className="text-sm font-medium">{value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Projected FCF */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Projizierte Free Cash Flows
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {dcf.projectedFCF.map((fcf: number, i: number) => {
                      const maxFCF = Math.max(...dcf.projectedFCF);
                      const pct = maxFCF > 0 ? (fcf / maxFCF) * 100 : 0;
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground w-12">Jahr {i + 1}</span>
                          <div className="flex-1 bg-muted rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono w-24 text-right">
                            {dcf.currency} {(fcf / 1e9).toFixed(2)} Mrd.
                          </span>
                        </div>
                      );
                    })}
                    <div className="mt-3 pt-3 border-t border-border flex justify-between text-sm">
                      <span className="text-muted-foreground">PV der FCFs</span>
                      <span className="font-medium">{dcf.currency} {(dcf.pvFCF / 1e9).toFixed(2)} Mrd.</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">PV des Terminal Value</span>
                      <span className="font-medium">{dcf.currency} {(dcf.pvTerminalValue / 1e9).toFixed(2)} Mrd.</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Disclaimer */}
            <p className="text-xs text-muted-foreground text-center">
              ⚠️ Diese DCF-Bewertung basiert auf vereinfachten Annahmen und öffentlich verfügbaren Daten (Yahoo Finance). Sie stellt keine Anlageberatung dar.
            </p>
          </>
        )}

        {!dcf && !dcfLoading && (
          <Card className="bg-card border-border">
            <CardContent className="py-16 text-center">
              <Calculator className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Wählen Sie eine Aktie und klicken Sie auf "DCF berechnen"</p>
              <p className="text-xs text-muted-foreground mt-2">Die Berechnung dauert ca. 5-10 Sekunden</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
