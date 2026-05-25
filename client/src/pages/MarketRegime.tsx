import DashboardLayout from "@/components/DashboardLayout";
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

interface RegimeData {
  overallRegime: string;
  overallScore: number;
  equityAllocation: number;
  regimeMultiplier: number;
  engines: {
    trend: EngineResult;
    breadth: EngineResult;
    volatility: EngineResult;
    liquidity: EngineResult;
    credit: EngineResult;
    sentiment: EngineResult;
    bubble: EngineResult;
  };
  lastUpdated: string;
}

function RegimeIcon({ level }: { level: RegimeLevel }) {
  if (level === "bullish") return <TrendingUp className="h-5 w-5 text-emerald-400" />;
  if (level === "bearish") return <TrendingDown className="h-5 w-5 text-red-400" />;
  return <Minus className="h-5 w-5 text-amber-400" />;
}

function RegimeBadge({ level, label }: { level: RegimeLevel; label: string }) {
  const colors = {
    bullish: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    neutral: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    bearish: "bg-red-500/15 text-red-400 border-red-500/30",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${colors[level]}`}>
      <RegimeIcon level={level} />
      {label}
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  const color = score > 0.2 ? "bg-emerald-500" : score < -0.2 ? "bg-red-500" : "bg-amber-500";
  return (
    <div className="w-full h-2 bg-muted rounded-full overflow-hidden relative">
      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-muted-foreground/30 z-10" />
      <div
        className={`absolute top-0 bottom-0 ${color} rounded-full`}
        style={{
          left: score >= 0 ? '50%' : `${((score + 1) / 2) * 100}%`,
          width: `${Math.abs(score) * 50}%`,
        }}
      />
    </div>
  );
}

function EngineCard({ title, icon: Icon, result }: { title: string; icon: any; result: EngineResult }) {
  return (
    <Card className="bg-card/50 border-border/50">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{title}</span>
          </div>
          <RegimeBadge level={result.level} label={result.label} />
        </div>
        <ScoreBar score={result.score} />
        <p className="text-xs text-muted-foreground mt-2">{result.description}</p>
      </CardContent>
    </Card>
  );
}

export default function MarketRegime() {
  const { data, isLoading, refetch, isFetching } = trpc.marketRegime.getRegime.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  const regime = data as RegimeData | undefined;

  const overallColor = regime?.overallRegime === "Risk-On"
    ? "text-emerald-400"
    : regime?.overallRegime === "Risk-Off"
      ? "text-red-400"
      : regime?.overallRegime === "Defensive"
        ? "text-amber-400"
        : "text-muted-foreground";

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Markt Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Institutioneller Regime-Indikator — Soll ich investiert sein?
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            Aktualisieren
          </Button>
        </div>

        {isLoading ? (
          <div className="grid gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-muted/30 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : regime ? (
          <>
            {/* Main Regime Card */}
            <Card className="border-2 border-primary/20 bg-gradient-to-br from-card to-card/80">
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Aktuelles Regime</p>
                    <p className={`text-3xl font-bold ${overallColor}`}>{regime.overallRegime}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Empf. Aktienquote</p>
                    <p className="text-3xl font-bold">{regime.equityAllocation}%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Signal-Multiplikator</p>
                    <p className="text-3xl font-bold">{regime.regimeMultiplier.toFixed(1)}x</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-border/50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Gesamt-Score</span>
                    <span className="text-sm font-medium">{(regime.overallScore * 100).toFixed(0)}%</span>
                  </div>
                  <ScoreBar score={regime.overallScore} />
                </div>
              </CardContent>
            </Card>

            {/* Engine Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <EngineCard title="Trend (30%)" icon={TrendingUp} result={regime.engines.trend} />
              <EngineCard title="Breadth (15%)" icon={Activity} result={regime.engines.breadth} />
              <EngineCard title="Volatilität (20%)" icon={Shield} result={regime.engines.volatility} />
              <EngineCard title="Liquidität (15%)" icon={Droplets} result={regime.engines.liquidity} />
              <EngineCard title="Credit/Stress (10%)" icon={Globe} result={regime.engines.credit} />
              <EngineCard title="Sentiment (5%)" icon={Brain} result={regime.engines.sentiment} />
              <EngineCard title="Bubble/LPPLS (5%)" icon={AlertTriangle} result={regime.engines.bubble} />
            </div>

            {/* Explanation */}
            <Card className="bg-card/30 border-border/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Wie funktioniert das?</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-2">
                <p>
                  Das Regime-Dashboard aggregiert 7 unabhängige Engines zu einem Gesamtbild.
                  Jede Engine liefert einen Score von -1 (bearish) bis +1 (bullish).
                </p>
                <p>
                  <strong className="text-foreground">Risk-On</strong> (Score &gt; 0.25): Volle Investition, Einzeltitel-Signale werden verstärkt (1.2x).{" "}
                  <strong className="text-foreground">Neutral</strong> (-0.1 bis 0.25): Normale Gewichtung.{" "}
                  <strong className="text-foreground">Defensive</strong> (-0.4 bis -0.1): Reduzierte Aktienquote, Signale gedämpft (0.7x).{" "}
                  <strong className="text-foreground">Risk-Off</strong> (&lt; -0.4): Minimale Aktienquote, nur stärkste Signale (0.3x).
                </p>
                <p className="text-[10px]">
                  Letzte Aktualisierung: {new Date(regime.lastUpdated).toLocaleString('de-DE')}
                </p>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">Keine Regime-Daten verfügbar. Bitte aktualisieren.</p>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
