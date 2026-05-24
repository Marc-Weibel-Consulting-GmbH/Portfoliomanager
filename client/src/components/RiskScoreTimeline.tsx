import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, TrendingUp, TrendingDown, Minus } from "lucide-react";
import Chart from "chart.js/auto";

interface RiskScoreDataPoint {
  date: string;
  score: number;
  volatility: number;
  sharpe: number;
  maxDrawdown: number;
}

interface RiskScoreTimelineProps {
  data: RiskScoreDataPoint[];
  isLoading?: boolean;
}

function getScoreLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: "Ausgezeichnet", color: "#10b981" };
  if (score >= 65) return { label: "Gut", color: "#22c55e" };
  if (score >= 50) return { label: "Mittel", color: "#eab308" };
  if (score >= 35) return { label: "Unterdurchschnittlich", color: "#f97316" };
  return { label: "Kritisch", color: "#ef4444" };
}

function getTrend(data: RiskScoreDataPoint[]): { direction: "up" | "down" | "flat"; change: number } {
  if (data.length < 8) return { direction: "flat", change: 0 };
  const recent = data.slice(-4);
  const earlier = data.slice(-8, -4);
  const recentAvg = recent.reduce((s, d) => s + d.score, 0) / recent.length;
  const earlierAvg = earlier.reduce((s, d) => s + d.score, 0) / earlier.length;
  const change = recentAvg - earlierAvg;
  if (change > 3) return { direction: "up", change };
  if (change < -3) return { direction: "down", change };
  return { direction: "flat", change };
}

export default function RiskScoreTimeline({ data, isLoading }: RiskScoreTimelineProps) {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<RiskScoreDataPoint | null>(null);

  useEffect(() => {
    if (!chartRef.current || !data || data.length === 0) return;

    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const ctx = chartRef.current.getContext("2d");
    if (!ctx) return;

    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, "rgba(16, 185, 129, 0.3)");
    gradient.addColorStop(1, "rgba(16, 185, 129, 0.02)");

    // Color segments based on score zones
    const pointColors = data.map((d) => {
      if (d.score >= 80) return "#10b981";
      if (d.score >= 65) return "#22c55e";
      if (d.score >= 50) return "#eab308";
      if (d.score >= 35) return "#f97316";
      return "#ef4444";
    });

    const labels = data.map((d) => {
      const date = new Date(d.date);
      return date.toLocaleDateString("de-CH", { month: "short", year: "2-digit" });
    });

    chartInstance.current = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Risikoscore",
            data: data.map((d) => d.score),
            borderColor: "#10b981",
            backgroundColor: gradient,
            borderWidth: 2,
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: pointColors,
            pointHoverBorderColor: "#fff",
            pointHoverBorderWidth: 2,
          },
          {
            // Reference line at 50 (neutral)
            label: "Neutral",
            data: data.map(() => 50),
            borderColor: "rgba(255, 255, 255, 0.15)",
            borderWidth: 1,
            borderDash: [4, 4],
            pointRadius: 0,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "index",
          intersect: false,
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "rgba(15, 23, 42, 0.95)",
            titleColor: "#e2e8f0",
            bodyColor: "#e2e8f0",
            borderColor: "rgba(16, 185, 129, 0.3)",
            borderWidth: 1,
            padding: 12,
            displayColors: false,
            callbacks: {
              title: (items) => {
                const idx = items[0]?.dataIndex;
                if (idx !== undefined && data[idx]) {
                  return new Date(data[idx].date).toLocaleDateString("de-CH", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  });
                }
                return "";
              },
              label: (item) => {
                const idx = item.dataIndex;
                if (item.datasetIndex === 1) return "";
                const point = data[idx];
                if (!point) return "";
                const { label } = getScoreLabel(point.score);
                return [
                  `Score: ${point.score}/100 (${label})`,
                  `Volatilität: ${point.volatility.toFixed(1)}%`,
                  `Sharpe: ${point.sharpe.toFixed(2)}`,
                  `Max DD: ${point.maxDrawdown.toFixed(1)}%`,
                ];
              },
            },
          },
        },
        scales: {
          x: {
            grid: { color: "rgba(255, 255, 255, 0.05)" },
            ticks: {
              color: "rgba(255, 255, 255, 0.5)",
              maxTicksLimit: 8,
              font: { size: 10 },
            },
          },
          y: {
            min: 0,
            max: 100,
            grid: { color: "rgba(255, 255, 255, 0.05)" },
            ticks: {
              color: "rgba(255, 255, 255, 0.5)",
              stepSize: 25,
              font: { size: 10 },
              callback: (value) => `${value}`,
            },
          },
        },
      },
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [data]);

  if (isLoading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-300">
            Risikoscore-Entwicklung
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center">
            <div className="animate-pulse text-slate-500">Berechne historische Scores...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-300">
            Risikoscore-Entwicklung
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-slate-500">
            Nicht genügend historische Daten verfügbar.
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentScore = data[data.length - 1]?.score ?? 0;
  const { label: currentLabel, color: currentColor } = getScoreLabel(currentScore);
  const trend = getTrend(data);
  const minScore = Math.min(...data.map((d) => d.score));
  const maxScore = Math.max(...data.map((d) => d.score));

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium text-slate-300">
              Risikoscore-Entwicklung
            </CardTitle>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-3.5 w-3.5 text-slate-500" />
              </TooltipTrigger>
              <TooltipContent className="max-w-[280px] bg-slate-800 border-slate-700 text-slate-200">
                <p className="text-xs">
                  Wöchentlicher Risikoscore über die letzten 12 Monate, berechnet mit einem
                  rollierenden 3-Monats-Fenster. Höher = besser (weniger Risiko bei gleicher Rendite).
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="flex items-center gap-3">
            {/* Trend indicator */}
            <div className="flex items-center gap-1">
              {trend.direction === "up" && (
                <TrendingUp className="h-4 w-4 text-emerald-400" />
              )}
              {trend.direction === "down" && (
                <TrendingDown className="h-4 w-4 text-red-400" />
              )}
              {trend.direction === "flat" && (
                <Minus className="h-4 w-4 text-slate-400" />
              )}
              <span
                className="text-xs font-medium"
                style={{
                  color:
                    trend.direction === "up"
                      ? "#10b981"
                      : trend.direction === "down"
                      ? "#ef4444"
                      : "#94a3b8",
                }}
              >
                {trend.change > 0 ? "+" : ""}
                {trend.change.toFixed(1)} (4W)
              </span>
            </div>
            {/* Current score badge */}
            <div
              className="px-2 py-0.5 rounded text-xs font-bold"
              style={{ backgroundColor: `${currentColor}20`, color: currentColor }}
            >
              {currentScore}/100
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Mini stats row */}
        <div className="flex items-center gap-4 mb-3 text-xs text-slate-400">
          <span>
            Min: <span className="text-slate-300 font-medium">{minScore}</span>
          </span>
          <span>
            Max: <span className="text-slate-300 font-medium">{maxScore}</span>
          </span>
          <span>
            Spanne: <span className="text-slate-300 font-medium">{maxScore - minScore} Punkte</span>
          </span>
        </div>
        {/* Chart */}
        <div className="h-[200px]">
          <canvas ref={chartRef} />
        </div>
        {/* Score zones legend */}
        <div className="flex items-center gap-3 mt-3 text-[10px] text-slate-500">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>80+ Ausgezeichnet</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span>65+ Gut</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-yellow-500" />
            <span>50+ Mittel</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-orange-500" />
            <span>35+ Unter.</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span>&lt;35 Kritisch</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
