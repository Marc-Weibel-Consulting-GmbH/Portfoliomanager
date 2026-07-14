import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

/**
 * LPPLS Bubble-Risiko (Sornette-Modell).
 * Reuses trpc.prediction.bubbleAnalysis. Renders nothing unless there is
 * meaningful bubble risk (confidence >= 0.2). Self-contained, no DashboardLayout.
 */
export default function BubbleRiskCard({ ticker }: { ticker: string }) {
  const { data, isLoading } = trpc.prediction.bubbleAnalysis.useQuery(
    { ticker },
    { enabled: !!ticker }
  );

  if (isLoading || !data?.result) return null;

  const {
    bubbleConfidence,
    regime,
    daysUntilCritical,
    superExponentialGrowth,
    logPeriodicOscillation,
  } = data.result;

  // Only show if there's meaningful bubble risk
  if (bubbleConfidence < 0.2) return null;

  const getRiskColor = (conf: number) => {
    if (conf >= 0.7) return "text-red-500 border-red-500/30";
    if (conf >= 0.5) return "text-orange-500 border-orange-500/30";
    return "text-yellow-500 border-yellow-500/30";
  };

  const getRiskLabel = (conf: number) => {
    if (conf >= 0.7) return "Hohes Bubble-Risiko";
    if (conf >= 0.5) return "Erhöhtes Bubble-Risiko";
    return "Leichtes Bubble-Risiko";
  };

  return (
    <Card
      className={`bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border ${getRiskColor(
        bubbleConfidence
      )}`}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5" />
            <div>
              <div className="font-semibold text-sm">{getRiskLabel(bubbleConfidence)}</div>
              <div
                className="text-xs text-gray-400 mt-0.5"
                title="LPPLS: mathematisches Modell (Sornette), das typische Beschleunigungsmuster vor Kursblasen erkennt"
              >
                Blasen-Modell (LPPLS, Sornette) · Konfidenz:{" "}
                <span className="font-mono">{(bubbleConfidence * 100).toFixed(0)}%</span>
                {regime === "negative_bubble" && " · Negativblase"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs">
            {daysUntilCritical != null && daysUntilCritical > 0 && (
              <div className="text-center">
                <div className="font-bold text-lg font-mono">{daysUntilCritical}</div>
                <div className="text-gray-400">Tage bis tc</div>
              </div>
            )}
            <div className="flex flex-col gap-1">
              {superExponentialGrowth && (
                <Badge variant="outline" className="text-xs border-white/10">
                  Super-exp. Wachstum
                </Badge>
              )}
              {logPeriodicOscillation && (
                <Badge variant="outline" className="text-xs border-white/10">
                  Log-period. Oszillation
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
