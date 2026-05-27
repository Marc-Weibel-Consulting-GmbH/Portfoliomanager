import { trpc } from "@/lib/trpc";
import { TrendingUp, TrendingDown, Minus, Activity, Globe, Shield, Droplets, Brain, AlertTriangle, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type RegimeLevel = "bullish" | "neutral" | "bearish";

interface EngineResult {
  label: string;
  score: number;
  level: RegimeLevel;
  description: string;
}

function RegimeIcon({ level }: { level: RegimeLevel }) {
  if (level === "bullish") return <TrendingUp className="h-5 w-5 text-emerald-400" />;
  if (level === "bearish") return <TrendingDown className="h-5 w-5 text-red-400" />;
  return <Minus className="h-5 w-5 text-amber-400" />;
}

function RegimeBadge({ level, label }: { level: RegimeLevel; label: string }) {
  const colors = {
    bullish: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    neutral: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    bearish: "bg-red-500/20 text-red-400 border-red-500/30",
  };
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${colors[level]}`}>
      {label}
    </span>
  );
}

function ScoreBar({ score, level }: { score: number; level: RegimeLevel }) {
  const colors = {
    bullish: "bg-emerald-400",
    neutral: "bg-amber-400",
    bearish: "bg-red-400",
  };
  return (
    <div className="w-full h-2 bg-[#1a1f2e] rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${colors[level]}`}
        style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
      />
    </div>
  );
}

const engineIcons: Record<string, any> = {
  trend: TrendingUp,
  breadth: Globe,
  volatility: Activity,
  liquidity: Droplets,
  credit: Shield,
  sentiment: Brain,
  bubble: AlertTriangle,
};

export default function MarketRegimeContent() {
  const { data: regimeData, isLoading, refetch } = trpc.marketRegime.getRegime.useQuery(undefined, {
    staleTime: 60000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-[#00CFC1] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!regimeData) {
    return (
      <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/20">
        <CardContent className="p-6 text-center">
          <p className="text-gray-400">Keine Regime-Daten verfügbar</p>
          <Button onClick={() => refetch()} className="mt-4 bg-[#00CFC1] hover:bg-[#00CFC1]/80 text-black">
            <RefreshCw className="w-4 h-4 mr-2" />
            Erneut laden
          </Button>
        </CardContent>
      </Card>
    );
  }

  const engines = regimeData.engines ? Object.entries(regimeData.engines) : [];

  return (
    <div className="space-y-6">
      {/* Overall Regime */}
      <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/20">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white">Markt-Regime</h3>
              <p className="text-sm text-gray-400">Aggregierter Score: {regimeData.overallScore}/100</p>
            </div>
            <div className="flex items-center gap-3">
              <RegimeBadge level={regimeData.overallRegime as RegimeLevel || "neutral"} label={regimeData.overallRegime || "Neutral"} />
              <Button onClick={() => refetch()} variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Equity Allocation</span>
              <span className="text-white font-mono ml-2">{regimeData.equityAllocation}%</span>
            </div>
            <div>
              <span className="text-gray-400">Regime-Multiplikator</span>
              <span className="text-white font-mono ml-2">{regimeData.regimeMultiplier}x</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Engine Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {engines.map(([key, engine]: [string, any]) => {
          const Icon = engineIcons[key] || Activity;
          return (
            <Card key={key} className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-[#00CFC1]" />
                    <span className="text-sm font-medium text-white">{engine.label}</span>
                  </div>
                  <RegimeIcon level={engine.level} />
                </div>
                <ScoreBar score={engine.score} level={engine.level} />
                <p className="text-xs text-gray-400 mt-2">{engine.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
