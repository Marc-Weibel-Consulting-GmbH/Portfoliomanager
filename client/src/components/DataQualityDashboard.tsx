import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, CheckCircle2, TrendingDown } from "lucide-react";

export function DataQualityDashboard() {
  const { data: metrics, isLoading, error } = trpc.admin.getDataQualityMetrics.useQuery();

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <p className="text-slate-400 mt-2">Lade Datenqualität...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert className="bg-red-900/20 border-red-700">
        <AlertTriangle className="h-4 w-4 text-red-500" />
        <AlertDescription className="text-red-200">
          Fehler beim Laden der Metriken: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  if (!metrics) return null;

  const getCompletenessColor = (percentage: number) => {
    if (percentage >= 90) return "text-green-400";
    if (percentage >= 70) return "text-yellow-400";
    return "text-red-400";
  };

  const getCompletenessIcon = (percentage: number) => {
    if (percentage >= 90) return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    if (percentage >= 70) return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    return <TrendingDown className="w-5 h-5 text-red-500" />;
  };

  const metricsList = [
    { name: "Sharpe Ratio", value: metrics.sharpeRatioCompleteness, missing: metrics.missingMetrics.sharpeRatio },
    { name: "Dividendenrendite", value: metrics.dividendYieldCompleteness, missing: metrics.missingMetrics.dividendYield },
    { name: "KGV (PE Ratio)", value: metrics.peRatioCompleteness, missing: metrics.missingMetrics.peRatio },
    { name: "PEG Ratio", value: metrics.pegRatioCompleteness, missing: metrics.missingMetrics.pegRatio },
    { name: "Beta", value: metrics.betaCompleteness, missing: metrics.missingMetrics.beta },
    { name: "Volatilität", value: metrics.volatilityCompleteness, missing: metrics.missingMetrics.volatility },
  ];

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-700 p-4 rounded-lg">
          <div className="text-slate-400 text-sm">Gesamt Aktien</div>
          <div className="text-3xl font-bold text-white">{metrics.totalStocks}</div>
        </div>
        <div className="bg-orange-900/30 p-4 rounded-lg">
          <div className="text-slate-400 text-sm">Veraltete Daten (&gt;7 Tage)</div>
          <div className="text-3xl font-bold text-orange-400">{metrics.staleDataCount}</div>
        </div>
      </div>

      {/* Stale Data Warning */}
      {metrics.staleDataCount > 0 && (
        <Alert className="bg-orange-900/20 border-orange-700">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          <AlertDescription className="text-orange-200">
            <strong>{metrics.staleDataCount} Aktien</strong> haben Daten älter als 7 Tage:{" "}
            {metrics.staleDataStocks.slice(0, 5).join(", ")}
            {metrics.staleDataStocks.length > 5 && ` +${metrics.staleDataStocks.length - 5} weitere`}
          </AlertDescription>
        </Alert>
      )}

      {/* Metrics Completeness */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Metriken-Vollständigkeit</CardTitle>
          <CardDescription className="text-slate-400">
            Prozentsatz der Aktien mit verfügbaren Metriken
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {metricsList.map((metric) => (
              <div key={metric.name} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getCompletenessIcon(metric.value)}
                  <span className="text-white">{metric.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-2xl font-bold ${getCompletenessColor(metric.value)}`}>
                    {metric.value}%
                  </span>
                  <span className="text-slate-400 text-sm">
                    ({metrics.totalStocks - metric.missing.length}/{metrics.totalStocks})
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Missing Metrics Details */}
      <details className="bg-slate-700 rounded p-3">
        <summary className="cursor-pointer text-white font-semibold">
          Fehlende Metriken anzeigen
        </summary>
        <div className="mt-3 space-y-2">
          {metricsList.map((metric) => (
            metric.missing.length > 0 && (
              <div key={metric.name} className="bg-slate-800 p-2 rounded">
                <div className="text-slate-300 font-semibold text-sm mb-1">
                  {metric.name} fehlt bei {metric.missing.length} Aktien:
                </div>
                <div className="text-xs text-slate-400 font-mono">
                  {metric.missing.join(", ")}
                </div>
              </div>
            )
          ))}
        </div>
      </details>
    </div>
  );
}
