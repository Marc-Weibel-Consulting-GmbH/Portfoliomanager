import { Badge } from "@/components/ui/badge";
import { Activity, TrendingDown, BarChart3, AlertTriangle } from "lucide-react";

interface RiskScoreOverviewProps {
  riskScore: number;
  portfolioMetrics: {
    volatility: number;
    maxDrawdown: number;
    varHistorical95: number;
    informationRatio: number | null;
    trackingError: number | null;
    sharpeRatio: number;
    beta: number | null;
  };
  benchmarkMetrics: {
    volatility: number;
    maxDrawdown: number;
    varHistorical95: number;
    sharpeRatio: number;
  } | null;
  benchmarkName: string;
}

function getScoreRating(score: number): { label: string; color: string; variant: "default" | "secondary" | "destructive" | "outline" } {
  if (score >= 75) return { label: "gut", color: "text-green-400", variant: "default" };
  if (score >= 50) return { label: "mittel", color: "text-yellow-400", variant: "secondary" };
  if (score >= 25) return { label: "erhöht", color: "text-orange-400", variant: "outline" };
  return { label: "hoch", color: "text-red-400", variant: "destructive" };
}

function generateInterpretation(
  riskScore: number,
  portfolioMetrics: RiskScoreOverviewProps["portfolioMetrics"],
  benchmarkMetrics: RiskScoreOverviewProps["benchmarkMetrics"],
  benchmarkName: string
): string {
  const rating = getScoreRating(riskScore);
  const parts: string[] = [];

  if (riskScore >= 65) {
    parts.push(`Das Risikoprofil ist insgesamt solide (Score: ${riskScore}/100).`);
  } else if (riskScore >= 45) {
    parts.push(`Das Risikoprofil ist ausgewogen, aber nicht auf jeder Achse stärker als der Benchmark (Score: ${riskScore}/100).`);
  } else {
    parts.push(`Das Risikoprofil zeigt erhöhte Risiken (Score: ${riskScore}/100).`);
  }

  if (benchmarkMetrics) {
    const volDiff = portfolioMetrics.volatility - benchmarkMetrics.volatility;
    const ddDiff = Math.abs(portfolioMetrics.maxDrawdown) - Math.abs(benchmarkMetrics.maxDrawdown);

    if (volDiff > 3) {
      parts.push(`Die Volatilität liegt ${volDiff.toFixed(1)} pp über dem ${benchmarkName}, was auf ein höheres Schwankungsrisiko hindeutet.`);
    } else if (volDiff < -2) {
      parts.push(`Die Volatilität liegt ${Math.abs(volDiff).toFixed(1)} pp unter dem ${benchmarkName} — defensiver positioniert.`);
    }

    if (ddDiff > 3) {
      parts.push(`Der maximale Drawdown ist ${ddDiff.toFixed(1)} pp grösser als beim Benchmark.`);
    } else if (ddDiff < -2) {
      parts.push(`Der maximale Drawdown ist geringer als beim Benchmark — guter Kapitalschutz.`);
    }

    if (portfolioMetrics.sharpeRatio > benchmarkMetrics.sharpeRatio) {
      parts.push(`Die risikoadjustierte Rendite (Sharpe ${portfolioMetrics.sharpeRatio.toFixed(2)}) übertrifft den Benchmark (${benchmarkMetrics.sharpeRatio.toFixed(2)}).`);
    }
  }

  if (portfolioMetrics.informationRatio !== null && portfolioMetrics.informationRatio > 0.5) {
    parts.push("Besonders gut lesbar sind die Trade-offs zwischen aktivem Risiko und risikoadjustierter Rendite.");
  }

  return parts.join(" ");
}

export default function RiskScoreOverview({ riskScore, portfolioMetrics, benchmarkMetrics, benchmarkName }: RiskScoreOverviewProps) {
  const rating = getScoreRating(riskScore);
  const interpretation = generateInterpretation(riskScore, portfolioMetrics, benchmarkMetrics, benchmarkName);

  const kpiCards = [
    {
      label: "Volatilität",
      value: `${portfolioMetrics.volatility.toFixed(1)} %`,
      diff: benchmarkMetrics ? portfolioMetrics.volatility - benchmarkMetrics.volatility : null,
      icon: <Activity className="h-4 w-4" />,
      invertDiff: true,
    },
    {
      label: "Information Ratio",
      value: portfolioMetrics.informationRatio?.toFixed(2) ?? "–",
      diff: benchmarkMetrics ? (portfolioMetrics.informationRatio ?? 0) - 0 : null,
      icon: <BarChart3 className="h-4 w-4" />,
      invertDiff: false,
    },
    {
      label: "Max Drawdown",
      value: `${Math.abs(portfolioMetrics.maxDrawdown).toFixed(1)} %`,
      diff: benchmarkMetrics ? Math.abs(portfolioMetrics.maxDrawdown) - Math.abs(benchmarkMetrics.maxDrawdown) : null,
      icon: <TrendingDown className="h-4 w-4" />,
      invertDiff: true,
    },
    {
      label: "Tracking Error",
      value: portfolioMetrics.trackingError !== null ? `${portfolioMetrics.trackingError.toFixed(1)} %` : "–",
      diff: null,
      icon: <AlertTriangle className="h-4 w-4" />,
      invertDiff: true,
    },
  ];

  return (
    <div className="space-y-4">
      {/* KPI Überblick */}
      <div className="p-4 rounded-lg border border-border bg-card">
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">KPI-Überblick</h3>

        {/* Score */}
        <div className="p-3 rounded-md bg-muted/30 mb-4">
          <p className="text-xs text-muted-foreground">Gesamt-Risikoscore</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">{riskScore}</span>
            <span className="text-lg text-muted-foreground">/100</span>
          </div>
          <Badge variant={rating.variant} className="mt-1">
            {rating.label}
          </Badge>
        </div>

        {/* KPI Cards */}
        <div className="space-y-3">
          {kpiCards.map((kpi) => (
            <div key={kpi.label} className="p-3 rounded-md bg-muted/20">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                {kpi.icon}
                <span className="text-xs">{kpi.label}</span>
              </div>
              <span className="text-xl font-bold">{kpi.value}</span>
              {kpi.diff !== null && (
                <p className={`text-xs mt-0.5 ${
                  (kpi.invertDiff && kpi.diff > 0) || (!kpi.invertDiff && kpi.diff < 0)
                    ? "text-red-400"
                    : "text-green-400"
                }`}>
                  {kpi.diff >= 0 ? "+" : ""}{kpi.diff.toFixed(2)} {kpi.diff !== null ? "pp" : ""} vs. Benchmark
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Interpretation */}
      <div className="p-4 rounded-lg border border-border bg-card">
        <h3 className="text-sm font-semibold mb-2">Interpretation</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {interpretation}
        </p>
      </div>
    </div>
  );
}
