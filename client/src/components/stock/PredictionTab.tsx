/**
 * PredictionTab
 * Inline ML / Monte-Carlo style forecast for the stock-detail "KI-Prognose" tab.
 * Reuses the existing `trpc.prediction.predict` endpoint (same call as Prediction.tsx),
 * which returns 30/60/90-day predicted prices with 95% upper/lower bounds.
 *
 * The endpoint returns discrete horizon points, not a daily path. To draw a ~30-day
 * Monte-Carlo style fan chart (P5 / Median / P95 bands) we interpolate a daily band
 * from the current price to the day-30 prediction, widening the interval with sqrt(t)
 * (standard diffusion scaling). This is clearly a client-side reconstruction of the
 * band from the model's endpoint outputs, not a separate backend simulation.
 */
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";
import MlSignalWidget from "./MlSignalWidget";
import SignalDashboard from "./SignalDashboard";
import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface Props {
  ticker: string;
  stock: any;
}

function trendIcon(trend: string) {
  if (trend === "bullish") return <TrendingUp className="w-4 h-4 text-[#00CFC1]" />;
  if (trend === "bearish") return <TrendingDown className="w-4 h-4 text-red-500" />;
  return <Minus className="w-4 h-4 text-gray-400" />;
}

const FORECAST_DAYS = 30;

export default function PredictionTab({ ticker, stock }: Props) {
  const { data, isLoading, error } = trpc.prediction.predict.useQuery(
    { ticker },
    { enabled: !!ticker, staleTime: 5 * 60_000 }
  );

  const currency = (data as any)?.currency || stock?.currency || "CHF";

  // Build the daily P5 / Median / P95 band from the day-30 prediction point.
  const bandData = useMemo(() => {
    const pred = data?.prediction;
    if (!pred) return [];
    const d30 = pred.predictions.days30;
    const start = pred.currentPrice;
    const medianEnd = d30.predictedPrice;
    const p95End = d30.upperBound;
    const p5End = d30.lowerBound;

    const points: Array<{
      day: number;
      median: number;
      p5: number;
      p95: number;
      // stacked band representation for AreaChart
      lower: number;
      range: number;
    }> = [];

    for (let t = 0; t <= FORECAST_DAYS; t++) {
      const frac = t / FORECAST_DAYS; // linear path for the median
      const widthScale = Math.sqrt(t / FORECAST_DAYS); // sqrt(t) interval widening
      const median = start + (medianEnd - start) * frac;
      const upHalf = (p95End - medianEnd) * widthScale;
      const downHalf = (medianEnd - p5End) * widthScale;
      const p95 = median + upHalf;
      const p5 = Math.max(0, median - downHalf);
      points.push({
        day: t,
        median: Math.round(median * 100) / 100,
        p5: Math.round(p5 * 100) / 100,
        p95: Math.round(p95 * 100) / 100,
        lower: Math.round(p5 * 100) / 100,
        range: Math.round((p95 - p5) * 100) / 100,
      });
    }
    return points;
  }, [data]);

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Brain className="h-5 w-5 text-[#00CFC1]" />
            KI-Kursprognose — {FORECAST_DAYS} Tage
          </CardTitle>
          <p className="text-xs text-gray-500">
            Machine-Learning-Prognose (Linear Regression + Holt-Winters Ensemble) für {stock?.companyName || ticker}.
            Dargestellt als Monte-Carlo-Band (P5 / Median / P95).
          </p>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="py-12 text-center">
              <Brain className="h-8 w-8 text-[#00CFC1] mx-auto mb-3 animate-pulse" />
              <p className="text-gray-400 text-sm">ML-Modell trainiert auf {ticker}...</p>
              <p className="text-xs text-gray-500 mt-1">Analysiere 2 Jahre historische Daten</p>
            </div>
          )}

          {!isLoading && (error || data?.error) && (
            <div className="py-6 flex items-center gap-2 text-red-500 text-sm">
              <AlertTriangle className="w-5 h-5" />
              {(error as any)?.message || data?.error || "Prognose fehlgeschlagen."}
            </div>
          )}

          {!isLoading && data?.prediction && bandData.length > 0 && (
            <ResponsiveContainer width="100%" height={360}>
              <AreaChart data={bandData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="mcBandGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00CFC1" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#00CFC1" stopOpacity={0.08} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" vertical={false} />
                <XAxis
                  dataKey="day"
                  stroke="#718096"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `T+${v}`}
                />
                <YAxis
                  stroke="#718096"
                  tick={{ fontSize: 11 }}
                  domain={["dataMin - 2", "dataMax + 2"]}
                  tickFormatter={(v) => `${currency} ${Number(v).toFixed(0)}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1a1f2e",
                    border: "1px solid rgba(0, 207, 193, 0.3)",
                    borderRadius: "8px",
                    color: "#fff",
                  }}
                  labelFormatter={(label) => `Tag +${label}`}
                  formatter={(value: any, name: string) => {
                    const labels: Record<string, string> = {
                      median: "Median",
                      p95: "P95 (Obergrenze)",
                      p5: "P5 (Untergrenze)",
                    };
                    if (name === "lower" || name === "range") return [null, null] as any;
                    return [`${currency} ${Number(value).toFixed(2)}`, labels[name] || name];
                  }}
                />
                {/* Stacked invisible lower + visible range = P5..P95 band */}
                <Area
                  type="monotone"
                  dataKey="lower"
                  stackId="band"
                  stroke="none"
                  fill="transparent"
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="range"
                  stackId="band"
                  stroke="none"
                  fill="url(#mcBandGradient)"
                  isAnimationActive={false}
                />
                {/* Explicit band edges + median */}
                <Line type="monotone" dataKey="p95" stroke="#00CFC1" strokeWidth={1} strokeDasharray="4 4" dot={false} />
                <Line type="monotone" dataKey="p5" stroke="#00CFC1" strokeWidth={1} strokeDasharray="4 4" dot={false} />
                <Line type="monotone" dataKey="median" stroke="#00CFC1" strokeWidth={2.5} dot={false} />
                <ReferenceLine
                  y={data.prediction.currentPrice}
                  stroke="#4a5568"
                  strokeDasharray="3 3"
                  label={{ value: "Heute", fill: "#718096", fontSize: 10, position: "insideTopLeft" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Horizon summary cards (30 / 60 / 90 days) */}
      {!isLoading && data?.prediction && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(["days30", "days60", "days90"] as const).map((period) => {
            const pred = data.prediction!.predictions[period];
            const label = period === "days30" ? "30 Tage" : period === "days60" ? "60 Tage" : "90 Tage";
            const pct =
              ((pred.predictedPrice - data.prediction!.currentPrice) / data.prediction!.currentPrice) * 100;
            return (
              <Card key={period} className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-white flex items-center justify-between">
                    <span>{label}</span>
                    {trendIcon(pred.trend)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-2xl font-bold text-white font-mono">
                      {currency} {pred.predictedPrice.toFixed(2)}
                    </p>
                    <p className={`text-sm ${pct >= 0 ? "text-[#00CFC1]" : "text-red-500"}`}>
                      {pct >= 0 ? "+" : ""}
                      {pct.toFixed(1)}% vs. aktuell
                    </p>
                  </div>
                  <div className="text-xs space-y-1 text-gray-400">
                    <div className="flex justify-between">
                      <span>P95 (Obergrenze)</span>
                      <span className="font-mono">{currency} {pred.upperBound.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>P5 (Untergrenze)</span>
                      <span className="font-mono">{currency} {pred.lowerBound.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Konfidenz</span>
                      <span className="font-mono">{(pred.confidence * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-[#0f1420] rounded-full h-2 border border-white/5">
                    <div
                      className={`h-2 rounded-full ${
                        pred.confidence > 0.6
                          ? "bg-[#00CFC1]"
                          : pred.confidence > 0.3
                          ? "bg-yellow-500"
                          : "bg-red-500"
                      }`}
                      style={{ width: `${pred.confidence * 100}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Signal Dashboard — vollständiger Transparenz-Trail */}
      <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
            <span className="text-[#00CFC1]">⚡</span>
            Signal-Framework
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SignalDashboard ticker={ticker} />
        </CardContent>
      </Card>

      {/* ML Signal Widget */}
      <MlSignalWidget ticker={ticker} />

      {!isLoading && data?.prediction && (
        <p className="text-xs text-gray-500 text-center">
          ⚠️ Statistische Prognose auf Basis historischer Muster. Keine Anlageberatung — die tatsächliche
          Kursentwicklung kann erheblich abweichen.
        </p>
      )}
    </div>
  );
}
