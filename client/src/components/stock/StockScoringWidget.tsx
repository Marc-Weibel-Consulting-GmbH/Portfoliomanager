/**
 * StockScoringWidget
 * Combined Momentum + Quality + LPPL scoring widget for the StockDetail page.
 */
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, TrendingUp, Shield, Activity, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  ticker: string;
}

function GradeBadge({ grade }: { grade: string }) {
  const colors: Record<string, string> = {
    A: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    B: "bg-[#00CFC1]/20 text-[#00CFC1] border-[#00CFC1]/30",
    C: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    D: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    F: "bg-red-500/20 text-red-400 border-red-500/30",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${colors[grade] ?? colors.C}`}>
      {grade}
    </span>
  );
}

function SignalBadge({ signal }: { signal: string }) {
  const map: Record<string, { color: string; label: string }> = {
    "STRONG BUY":  { color: "bg-emerald-500 text-white", label: "STRONG BUY" },
    "BUY":         { color: "bg-[#00CFC1] text-black",   label: "BUY" },
    "HOLD":        { color: "bg-yellow-500 text-black",   label: "HOLD" },
    "SELL":        { color: "bg-orange-500 text-white",   label: "SELL" },
    "STRONG SELL": { color: "bg-red-600 text-white",      label: "STRONG SELL" },
  };
  const { color, label } = map[signal] ?? map["HOLD"];
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${color}`}>
      {label}
    </span>
  );
}

function ScoreBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const color = pct >= 70 ? "#00CFC1" : pct >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div className="w-full bg-white/10 rounded-full h-2">
      <div
        className="h-2 rounded-full transition-all"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

export default function StockScoringWidget({ ticker }: Props) {
  const { data, isLoading, error, refetch, isFetching } = trpc.tradingview.stockScoring.useQuery(
    { symbol: ticker },
    { staleTime: 5 * 60 * 1000, retry: 1 }
  );

  const scoring = (data as any)?.json ?? data;

  return (
    <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#00CFC1]" />
            Strategie-Scoring
            <span className="text-gray-500 text-xs font-normal">Momentum + Qualität + LPPL</span>
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-gray-400 hover:text-[#00CFC1] h-7 w-7 p-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-8 w-full bg-white/5" />
            <Skeleton className="h-16 w-full bg-white/5" />
            <p className="text-gray-500 text-xs text-center">Scoring wird berechnet...</p>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>Scoring nicht verfügbar: {error.message}</span>
          </div>
        )}

        {scoring && !isLoading && (
          <div className="space-y-4">
            {/* Overall Signal */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-xs mb-1">Gesamtsignal</p>
                <SignalBadge signal={scoring.signal} />
              </div>
              <div className="text-right">
                <p className="text-gray-400 text-xs mb-1">Score</p>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-white font-mono">{scoring.combinedScore}</span>
                  <span className="text-gray-500 text-sm">/100</span>
                  <GradeBadge grade={scoring.overallGrade} />
                </div>
              </div>
            </div>

            {/* Score Bar */}
            <ScoreBar value={scoring.combinedScore} />

            {/* Three Factor Cards */}
            <div className="grid grid-cols-3 gap-2">
              {/* Momentum */}
              <div className="bg-white/5 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <TrendingUp className="w-3.5 h-3.5 text-[#00CFC1]" />
                  <span className="text-gray-400 text-xs">Momentum</span>
                </div>
                <div className="flex items-center justify-between">
                  <GradeBadge grade={scoring.momentum?.grade ?? 'C'} />
                </div>
                <p className="text-gray-500 text-[10px] mt-1 capitalize">{scoring.momentum?.trend?.replace('_', ' ')}</p>
              </div>

              {/* Quality */}
              <div className="bg-white/5 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Shield className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-gray-400 text-xs">Qualität</span>
                </div>
                <div className="flex items-center justify-between">
                  <GradeBadge grade={scoring.quality?.grade ?? 'C'} />
                </div>
                <p className="text-gray-500 text-[10px] mt-1">ROE / D/E / FCF</p>
              </div>

              {/* LPPL */}
              <div className="bg-white/5 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <AlertCircle className={`w-3.5 h-3.5 ${scoring.lppl?.regime === 'bubble' ? 'text-red-400' : 'text-gray-400'}`} />
                  <span className="text-gray-400 text-xs">LPPL</span>
                </div>
                <div>
                  <span className={`text-xs font-medium capitalize ${
                    scoring.lppl?.regime === 'bubble' ? 'text-red-400' :
                    scoring.lppl?.regime === 'crash' ? 'text-orange-400' : 'text-emerald-400'
                  }`}>
                    {scoring.lppl?.regime === 'bubble' ? '⚠ Blase' :
                     scoring.lppl?.regime === 'crash' ? '⚠ Crash' : '✓ Normal'}
                  </span>
                </div>
                {scoring.lppl?.penalty > 0 && (
                  <p className="text-red-400 text-[10px] mt-1">-{scoring.lppl.penalty}% Malus</p>
                )}
              </div>
            </div>

            {/* Weights info */}
            <p className="text-gray-600 text-[10px] text-right">
              Gewichtung: 40% Momentum · 40% Qualität · 20% LPPL-Malus · {scoring.analysisDate}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
