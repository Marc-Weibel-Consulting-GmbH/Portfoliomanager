import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Activity, TrendingUp, TrendingDown, BarChart3, LineChart } from "lucide-react";
import { useState, useEffect, useRef } from "react";

export default function TechnicalAnalysis() {
  const { user } = useAuth();
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<number | null>(null);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  const { data: portfolios = [] } = trpc.portfolios.list.useQuery();
  const { data: portfolioData } = trpc.portfolios.getWithCurrency.useQuery(
    selectedPortfolioId!,
    { enabled: !!selectedPortfolioId }
  );
  const { data: techData, isLoading, error } = trpc.analytics.technicalAnalysis.useQuery(
    { ticker: selectedTicker!, lookbackDays: 180 },
    { enabled: !!selectedTicker }
  );

  if (!user) return null;

  const stocks = (portfolioData as any)?.enrichedStocks || [];

  const getSignalBadge = (signal: string) => {
    switch (signal) {
      case "buy":
      case "bullish":
      case "oversold":
        return <Badge className="bg-green-500 hover:bg-green-600">KAUFEN</Badge>;
      case "sell":
      case "bearish":
      case "overbought":
        return <Badge className="bg-red-500 hover:bg-red-600">VERKAUFEN</Badge>;
      default:
        return <Badge variant="secondary">NEUTRAL</Badge>;
    }
  };

  const getSignalColor = (signal: string) => {
    switch (signal) {
      case "buy":
      case "bullish":
      case "oversold":
        return "text-green-500";
      case "sell":
      case "bearish":
      case "overbought":
        return "text-red-500";
      default:
        return "text-yellow-500";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Technische Analyse</h1>
          <p className="text-muted-foreground mt-1">
            RSI, MACD und Bollinger Bands für Ihre Portfolio-Positionen
          </p>
        </div>

        {/* Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Position auswählen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Portfolio</label>
                <Select
                  value={selectedPortfolioId?.toString()}
                  onValueChange={(v) => {
                    setSelectedPortfolioId(parseInt(v));
                    setSelectedTicker(null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Portfolio wählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {portfolios.map((p: any) => (
                      <SelectItem key={p.id} value={p.id.toString()}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Aktie</label>
                <Select
                  value={selectedTicker || ""}
                  onValueChange={(v) => setSelectedTicker(v)}
                  disabled={!selectedPortfolioId || stocks.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Aktie wählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {stocks.map((s: any) => (
                      <SelectItem key={s.ticker} value={s.ticker}>
                        {s.ticker} – {s.companyName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loading / Error states */}
        {isLoading && selectedTicker && (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="animate-pulse text-muted-foreground">
                <Activity className="h-8 w-8 mx-auto mb-3 animate-spin" />
                Berechne technische Indikatoren für {selectedTicker}...
              </div>
            </CardContent>
          </Card>
        )}

        {error && (
          <Card className="border-red-500/50">
            <CardContent className="py-6 text-center text-red-400">
              Fehler: {(error as any).message}
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {techData && !isLoading && (
          <>
            {/* Overall Signal */}
            <Card className="border-primary/50">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{techData.companyName}</span>
                    <span className="text-muted-foreground text-base">({techData.ticker})</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold">{techData.currentPrice.toFixed(2)} CHF</span>
                    {getSignalBadge(techData.overallSignal)}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{techData.overallDescription}</p>
              </CardContent>
            </Card>

            {/* Three Indicators */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* RSI */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      RSI (14)
                    </span>
                    {getSignalBadge(techData.rsi.signal)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-center">
                      <span className={`text-4xl font-bold ${getSignalColor(techData.rsi.signal)}`}>
                        {techData.rsi.value.toFixed(1)}
                      </span>
                    </div>

                    {/* RSI Gauge */}
                    <div className="relative h-4 bg-muted rounded-full overflow-hidden">
                      <div className="absolute inset-0 flex">
                        <div className="w-[30%] bg-green-500/30" />
                        <div className="w-[40%] bg-yellow-500/20" />
                        <div className="w-[30%] bg-red-500/30" />
                      </div>
                      <div
                        className="absolute top-0 h-full w-1 bg-foreground rounded"
                        style={{ left: `${Math.min(100, Math.max(0, techData.rsi.value))}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>0 (Überverkauft)</span>
                      <span>50</span>
                      <span>100 (Überkauft)</span>
                    </div>

                    <p className="text-sm text-muted-foreground">{techData.rsi.description}</p>

                    {/* RSI Mini Chart */}
                    <RSIChart data={techData.rsiHistory} />
                  </div>
                </CardContent>
              </Card>

              {/* MACD */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <LineChart className="h-5 w-5" />
                      MACD (12/26/9)
                    </span>
                    {getSignalBadge(techData.macd.signal)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-xs text-muted-foreground">MACD</p>
                        <p className="font-bold text-sm">{techData.macd.macdLine.toFixed(3)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Signal</p>
                        <p className="font-bold text-sm">{techData.macd.signalLine.toFixed(3)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Histogram</p>
                        <p className={`font-bold text-sm ${techData.macd.histogram >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {techData.macd.histogram.toFixed(3)}
                        </p>
                      </div>
                    </div>

                    <p className="text-sm text-muted-foreground">{techData.macd.description}</p>

                    {/* MACD Mini Chart */}
                    <MACDChart data={techData.macd.history} />
                  </div>
                </CardContent>
              </Card>

              {/* Bollinger Bands */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Bollinger (20/2σ)
                    </span>
                    {getSignalBadge(techData.bollingerBands.signal)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-xs text-muted-foreground">Oberes Band</p>
                        <p className="font-bold text-sm text-red-400">{techData.bollingerBands.upper.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Mitte (SMA)</p>
                        <p className="font-bold text-sm">{techData.bollingerBands.middle.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Unteres Band</p>
                        <p className="font-bold text-sm text-green-400">{techData.bollingerBands.lower.toFixed(2)}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div>
                        <p className="text-xs text-muted-foreground">Bandbreite</p>
                        <p className="font-semibold text-sm">{techData.bollingerBands.bandwidth.toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">%B</p>
                        <p className={`font-semibold text-sm ${
                          techData.bollingerBands.percentB > 80 ? 'text-red-500' :
                          techData.bollingerBands.percentB < 20 ? 'text-green-500' : ''
                        }`}>
                          {techData.bollingerBands.percentB.toFixed(1)}%
                        </p>
                      </div>
                    </div>

                    <p className="text-sm text-muted-foreground">{techData.bollingerBands.description}</p>

                    {/* Bollinger Mini Chart */}
                    <BollingerChart data={techData.bollingerBands.history} />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Price Chart with Bollinger Bands */}
            <Card>
              <CardHeader>
                <CardTitle>Kursverlauf (60 Tage)</CardTitle>
              </CardHeader>
              <CardContent>
                <PriceChart
                  priceData={techData.priceHistory}
                  bollingerData={techData.bollingerBands.history}
                />
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

// ─── Mini Chart Components ───

function RSIChart({ data }: { data: Array<{ date: string; value: number }> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || data.length === 0) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    const w = canvasRef.current.width;
    const h = canvasRef.current.height;
    ctx.clearRect(0, 0, w, h);

    // Background zones
    ctx.fillStyle = "rgba(34, 197, 94, 0.08)";
    ctx.fillRect(0, h * 0.7, w, h * 0.3);
    ctx.fillStyle = "rgba(239, 68, 68, 0.08)";
    ctx.fillRect(0, 0, w, h * 0.3);

    // Threshold lines
    ctx.strokeStyle = "rgba(239, 68, 68, 0.3)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, h * 0.3);
    ctx.lineTo(w, h * 0.3);
    ctx.stroke();

    ctx.strokeStyle = "rgba(34, 197, 94, 0.3)";
    ctx.beginPath();
    ctx.moveTo(0, h * 0.7);
    ctx.lineTo(w, h * 0.7);
    ctx.stroke();
    ctx.setLineDash([]);

    // RSI line
    ctx.strokeStyle = "#8b5cf6";
    ctx.lineWidth = 2;
    ctx.beginPath();
    data.forEach((d, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - (d.value / 100) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }, [data]);

  return <canvas ref={canvasRef} width={300} height={100} className="w-full h-24" />;
}

function MACDChart({ data }: { data: Array<{ date: string; macd: number; signal: number; histogram: number }> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || data.length === 0) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    const w = canvasRef.current.width;
    const h = canvasRef.current.height;
    ctx.clearRect(0, 0, w, h);

    const allValues = data.flatMap(d => [d.macd, d.signal, d.histogram]);
    const maxVal = Math.max(...allValues.map(Math.abs)) || 1;

    const yScale = (val: number) => h / 2 - (val / maxVal) * (h / 2 - 5);

    // Zero line
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    // Histogram bars
    const barWidth = w / data.length;
    data.forEach((d, i) => {
      const x = i * barWidth;
      const barH = (d.histogram / maxVal) * (h / 2 - 5);
      ctx.fillStyle = d.histogram >= 0 ? "rgba(34, 197, 94, 0.5)" : "rgba(239, 68, 68, 0.5)";
      ctx.fillRect(x, h / 2 - (d.histogram >= 0 ? barH : 0), barWidth - 1, Math.abs(barH));
    });

    // MACD line
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    data.forEach((d, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = yScale(d.macd);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Signal line
    ctx.strokeStyle = "#f97316";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    data.forEach((d, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = yScale(d.signal);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }, [data]);

  return <canvas ref={canvasRef} width={300} height={100} className="w-full h-24" />;
}

function BollingerChart({ data }: { data: Array<{ date: string; upper: number; middle: number; lower: number; close: number }> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || data.length === 0) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    const w = canvasRef.current.width;
    const h = canvasRef.current.height;
    ctx.clearRect(0, 0, w, h);

    const allValues = data.flatMap(d => [d.upper, d.lower, d.close]);
    const minVal = Math.min(...allValues);
    const maxVal = Math.max(...allValues);
    const range = maxVal - minVal || 1;

    const yScale = (val: number) => h - ((val - minVal) / range) * (h - 10) - 5;

    // Band fill
    ctx.fillStyle = "rgba(59, 130, 246, 0.08)";
    ctx.beginPath();
    data.forEach((d, i) => {
      const x = (i / (data.length - 1)) * w;
      if (i === 0) ctx.moveTo(x, yScale(d.upper));
      else ctx.lineTo(x, yScale(d.upper));
    });
    for (let i = data.length - 1; i >= 0; i--) {
      const x = (i / (data.length - 1)) * w;
      ctx.lineTo(x, yScale(data[i].lower));
    }
    ctx.closePath();
    ctx.fill();

    // Upper band
    ctx.strokeStyle = "rgba(239, 68, 68, 0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    data.forEach((d, i) => {
      const x = (i / (data.length - 1)) * w;
      if (i === 0) ctx.moveTo(x, yScale(d.upper));
      else ctx.lineTo(x, yScale(d.upper));
    });
    ctx.stroke();

    // Lower band
    ctx.strokeStyle = "rgba(34, 197, 94, 0.5)";
    ctx.beginPath();
    data.forEach((d, i) => {
      const x = (i / (data.length - 1)) * w;
      if (i === 0) ctx.moveTo(x, yScale(d.lower));
      else ctx.lineTo(x, yScale(d.lower));
    });
    ctx.stroke();

    // Middle (SMA)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    data.forEach((d, i) => {
      const x = (i / (data.length - 1)) * w;
      if (i === 0) ctx.moveTo(x, yScale(d.middle));
      else ctx.lineTo(x, yScale(d.middle));
    });
    ctx.stroke();
    ctx.setLineDash([]);

    // Price line
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 2;
    ctx.beginPath();
    data.forEach((d, i) => {
      const x = (i / (data.length - 1)) * w;
      if (i === 0) ctx.moveTo(x, yScale(d.close));
      else ctx.lineTo(x, yScale(d.close));
    });
    ctx.stroke();
  }, [data]);

  return <canvas ref={canvasRef} width={300} height={100} className="w-full h-24" />;
}

function PriceChart({
  priceData,
  bollingerData,
}: {
  priceData: Array<{ date: string; close: number }>;
  bollingerData: Array<{ date: string; upper: number; middle: number; lower: number; close: number }>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || priceData.length === 0) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    const w = canvasRef.current.width;
    const h = canvasRef.current.height;
    const padding = { top: 20, right: 20, bottom: 30, left: 60 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    ctx.clearRect(0, 0, w, h);

    const allValues = [
      ...priceData.map(d => d.close),
      ...bollingerData.map(d => d.upper),
      ...bollingerData.map(d => d.lower),
    ];
    const minVal = Math.min(...allValues) * 0.99;
    const maxVal = Math.max(...allValues) * 1.01;
    const range = maxVal - minVal || 1;

    const xScale = (i: number) => padding.left + (i / (priceData.length - 1)) * chartW;
    const yScale = (val: number) => padding.top + chartH - ((val - minVal) / range) * chartH;

    // Grid lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (i / 4) * chartH;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();

      // Y-axis labels
      const val = maxVal - (i / 4) * range;
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(val.toFixed(1), padding.left - 8, y + 4);
    }

    // X-axis labels
    const labelCount = 5;
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    for (let i = 0; i < labelCount; i++) {
      const idx = Math.floor((i / (labelCount - 1)) * (priceData.length - 1));
      const x = xScale(idx);
      const label = priceData[idx]?.date?.slice(5) || "";
      ctx.fillText(label, x, h - 8);
    }

    // Bollinger band fill
    if (bollingerData.length > 0) {
      ctx.fillStyle = "rgba(59, 130, 246, 0.06)";
      ctx.beginPath();
      bollingerData.forEach((d, i) => {
        const x = xScale(i);
        if (i === 0) ctx.moveTo(x, yScale(d.upper));
        else ctx.lineTo(x, yScale(d.upper));
      });
      for (let i = bollingerData.length - 1; i >= 0; i--) {
        ctx.lineTo(xScale(i), yScale(bollingerData[i].lower));
      }
      ctx.closePath();
      ctx.fill();

      // Upper band
      ctx.strokeStyle = "rgba(239, 68, 68, 0.4)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      bollingerData.forEach((d, i) => {
        const x = xScale(i);
        if (i === 0) ctx.moveTo(x, yScale(d.upper));
        else ctx.lineTo(x, yScale(d.upper));
      });
      ctx.stroke();

      // Lower band
      ctx.strokeStyle = "rgba(34, 197, 94, 0.4)";
      ctx.beginPath();
      bollingerData.forEach((d, i) => {
        const x = xScale(i);
        if (i === 0) ctx.moveTo(x, yScale(d.lower));
        else ctx.lineTo(x, yScale(d.lower));
      });
      ctx.stroke();

      // Middle (SMA)
      ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      bollingerData.forEach((d, i) => {
        const x = xScale(i);
        if (i === 0) ctx.moveTo(x, yScale(d.middle));
        else ctx.lineTo(x, yScale(d.middle));
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Price line
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 2;
    ctx.beginPath();
    priceData.forEach((d, i) => {
      const x = xScale(i);
      const y = yScale(d.close);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Legend
    ctx.font = "11px sans-serif";
    const legendY = padding.top + 10;
    const items = [
      { color: "#10b981", label: "Kurs" },
      { color: "rgba(239, 68, 68, 0.6)", label: "Oberes Band" },
      { color: "rgba(34, 197, 94, 0.6)", label: "Unteres Band" },
    ];
    let legendX = padding.left + 10;
    items.forEach(item => {
      ctx.fillStyle = item.color;
      ctx.fillRect(legendX, legendY - 4, 12, 3);
      ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
      ctx.textAlign = "left";
      ctx.fillText(item.label, legendX + 16, legendY);
      legendX += ctx.measureText(item.label).width + 30;
    });
  }, [priceData, bollingerData]);

  return <canvas ref={canvasRef} width={900} height={300} className="w-full h-72" />;
}
