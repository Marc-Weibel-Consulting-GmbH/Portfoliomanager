import { useMemo } from "react";
import { Radar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

interface NormalizedScores {
  volatility: number;
  maxDrawdown: number;
  var95: number;
  sharpeRatio: number;
  sortinoRatio: number;
  beta: number;
  informationRatio: number;
  trackingError: number;
}

interface RiskRadarChartProps {
  portfolioScores: NormalizedScores;
  benchmarkScores: NormalizedScores | null;
  benchmarkName: string;
}

const LABELS = [
  "VaR 95%",
  "Max Drawdown",
  "Volatilität",
  "Beta",
  "Tracking Error",
  "Information Ratio",
  "Sharpe Ratio",
  "Sortino Ratio",
];

const KEYS: (keyof NormalizedScores)[] = [
  "var95",
  "maxDrawdown",
  "volatility",
  "beta",
  "trackingError",
  "informationRatio",
  "sharpeRatio",
  "sortinoRatio",
];

export default function RiskRadarChart({ portfolioScores, benchmarkScores, benchmarkName }: RiskRadarChartProps) {
  const data = useMemo(() => {
    const portfolioData = KEYS.map((k) => portfolioScores[k]);
    const datasets: any[] = [
      {
        label: "Portfolio",
        data: portfolioData,
        backgroundColor: "rgba(16, 185, 129, 0.2)",
        borderColor: "rgba(16, 185, 129, 0.8)",
        borderWidth: 2,
        pointBackgroundColor: "rgba(16, 185, 129, 1)",
        pointBorderColor: "#fff",
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ];

    if (benchmarkScores) {
      const benchmarkData = KEYS.map((k) => benchmarkScores[k]);
      datasets.push({
        label: benchmarkName,
        data: benchmarkData,
        backgroundColor: "rgba(148, 163, 184, 0.1)",
        borderColor: "rgba(148, 163, 184, 0.6)",
        borderWidth: 2,
        borderDash: [5, 5],
        pointBackgroundColor: "rgba(148, 163, 184, 0.8)",
        pointBorderColor: "#fff",
        pointRadius: 3,
        pointHoverRadius: 5,
      });
    }

    return { labels: LABELS, datasets };
  }, [portfolioScores, benchmarkScores, benchmarkName]);

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: "top" as const,
          labels: {
            color: "rgba(148, 163, 184, 0.9)",
            font: { size: 11 },
            usePointStyle: true,
            pointStyle: "circle",
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx: any) => `${ctx.dataset.label}: ${ctx.raw}/100`,
          },
        },
      },
      scales: {
        r: {
          min: 0,
          max: 100,
          ticks: {
            stepSize: 20,
            color: "rgba(148, 163, 184, 0.5)",
            backdropColor: "transparent",
            font: { size: 9 },
          },
          grid: {
            color: "rgba(148, 163, 184, 0.15)",
          },
          angleLines: {
            color: "rgba(148, 163, 184, 0.15)",
          },
          pointLabels: {
            color: "rgba(148, 163, 184, 0.9)",
            font: { size: 11 },
          },
        },
      },
    }),
    []
  );

  return (
    <div className="w-full max-w-md mx-auto">
      <Radar data={data} options={options} />
      <p className="text-xs text-muted-foreground text-center mt-2">
        Alle Achsen normiert auf 0–100. Aussen = besser.
      </p>
    </div>
  );
}
