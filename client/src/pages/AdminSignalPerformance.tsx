/**
 * AdminSignalPerformance — Signal-Performance-Dashboard (Admin only)
 *
 * Zeigt:
 * - Trefferquote je Engine (trendSignalEngine, meanReversionSignalEngine, breakoutSignalEngine, ensembleSignalEngine)
 * - Durchschnittliche Rendite nach Signal
 * - Kalibrierungskurve (Conviction vs. tatsächliche Hit-Rate)
 * - Trefferquote je Regime und Engine
 * - Letzte 50 Signale mit Evaluierungs-Status
 * - Manuelle Trigger für Snapshot und Lookback-Evaluation
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Breadcrumb } from "@/components/Breadcrumb";
import {
  BarChart3, TrendingUp, TrendingDown, Minus, RefreshCw,
  Target, Activity, Zap, ChevronDown, ChevronUp, Info
} from "lucide-react";

// ─── Helpers ────────────────────────────────────────────────────────────────

function pct(v: number | null | undefined, dec = 1) {
  if (v == null || isNaN(v)) return "–";
  return `${(v * 100).toFixed(dec)}%`;
}

function fmtReturn(v: number | null | undefined) {
  if (v == null || isNaN(v)) return "–";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${(v * 100).toFixed(2)}%`;
}

function fmtDate(v: unknown) {
  if (!v) return "–";
  try { return new Date(v as string).toLocaleString("de-CH", { dateStyle: "short", timeStyle: "short" }); }
  catch { return String(v); }
}

// Keys = DB-Werte (SignalEngineType / MarketRegime), nicht die Klassennamen.
const ENGINE_LABELS: Record<string, string> = {
  trend: "Trend",
  mean_reversion: "Mean Reversion",
  breakout: "Breakout",
  ensemble: "Ensemble",
};

const REGIME_LABELS: Record<string, string> = {
  bull_trend: "Bullenmarkt",
  bear_trend: "Bärenmarkt",
  sideways_low_vol: "Seitwärts (ruhig)",
  sideways_high_vol: "Seitwärts (volatil)",
  crisis: "Krise",
  recovery: "Erholung",
};

const ACTION_COLORS: Record<string, string> = {
  buy: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  add: "bg-teal-500/20 text-teal-400 border-teal-500/30",
  hold: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  reduce: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  sell: "bg-red-500/20 text-red-400 border-red-500/30",
};

function ActionBadge({ action }: { action: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${ACTION_COLORS[action] ?? "bg-zinc-700 text-zinc-300"}`}>
      {action.toUpperCase()}
    </span>
  );
}

function HitRateBadge({ rate }: { rate: number }) {
  const color = rate >= 0.6 ? "text-emerald-400" : rate >= 0.5 ? "text-amber-400" : "text-red-400";
  return <span className={`font-bold ${color}`}>{pct(rate)}</span>;
}

function CalibrationBar({ expected, actual, count }: { expected: number; actual: number; count: number }) {
  const barWidth = Math.round(actual * 100);
  const expectedPos = Math.round(expected * 100);
  return (
    <div className="relative h-6 bg-zinc-800 rounded overflow-hidden">
      <div
        className="absolute inset-y-0 left-0 bg-teal-500/40 rounded"
        style={{ width: `${barWidth}%` }}
      />
      {/* Perfect calibration line */}
      <div
        className="absolute inset-y-0 w-0.5 bg-zinc-400/60"
        style={{ left: `${expectedPos}%` }}
      />
      <div className="absolute inset-0 flex items-center px-2 text-xs text-zinc-200">
        {pct(actual)} {count > 0 && <span className="ml-1 text-zinc-500">({count})</span>}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AdminSignalPerformance() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [days, setDays] = useState(90);
  const [expandedEngine, setExpandedEngine] = useState<string | null>(null);
  const [isSnapshotting, setIsSnapshotting] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);

  if (user && user.role !== "admin") {
    navigate("/");
    return null;
  }

  const perfQ = trpc.admin.getSignalPerformance.useQuery(
    { days },
    { refetchInterval: 60_000 }
  );

  const snapshotMut = trpc.admin.triggerSignalSnapshot.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setIsSnapshotting(false);
    },
    onError: (e) => {
      toast.error(`Fehler: ${e.message}`);
      setIsSnapshotting(false);
    },
  });

  const evalMut = trpc.admin.triggerSignalEvaluation.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setIsEvaluating(false);
    },
    onError: (e) => {
      toast.error(`Fehler: ${e.message}`);
      setIsEvaluating(false);
    },
  });

  const data = perfQ.data;
  const isLoading = perfQ.isLoading;

  return (
    <div className="text-zinc-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <Activity className="h-6 w-6 text-teal-400" />
            Signal-Performance
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Lookback-Evaluation der Signal-Engines — Basis für Signalmix-Optimierung
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Zeitraum-Auswahl */}
          <div className="flex gap-1 bg-zinc-900 rounded-lg p-1 border border-zinc-800">
            {[30, 60, 90, 180].map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  days === d ? "bg-teal-500/20 text-teal-400" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {d}T
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setIsSnapshotting(true); snapshotMut.mutate(); }}
            disabled={isSnapshotting}
            className="border-zinc-700 text-zinc-300 hover:text-zinc-100"
          >
            <Zap className="h-4 w-4 mr-1" />
            {isSnapshotting ? "Läuft..." : "Snapshot"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setIsEvaluating(true); evalMut.mutate(); }}
            disabled={isEvaluating}
            className="border-zinc-700 text-zinc-300 hover:text-zinc-100"
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isEvaluating ? "animate-spin" : ""}`} />
            {isEvaluating ? "Läuft..." : "Evaluieren"}
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-64 text-zinc-500">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          Lade Signal-Performance...
        </div>
      )}

      {!isLoading && data && (
        <>
          {/* Übersicht-Karten */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card className="bg-zinc-900/60 border-zinc-800">
              <CardContent className="pt-4">
                <div className="text-xs text-zinc-500 mb-1">Evaluierte Signale</div>
                <div className="text-2xl font-bold text-zinc-100">{data.totalEvaluated}</div>
                <div className="text-xs text-zinc-500 mt-1">Letzte {days} Tage</div>
              </CardContent>
            </Card>
            <Card className="bg-zinc-900/60 border-zinc-800">
              <CardContent className="pt-4">
                <div className="text-xs text-zinc-500 mb-1">Gesamt-Trefferquote</div>
                <div className="text-2xl font-bold">
                  {data.overallHitRate != null
                    ? <HitRateBadge rate={data.overallHitRate} />
                    : <span className="text-zinc-500">–</span>
                  }
                </div>
                <div className="text-xs text-zinc-500 mt-1">Richtungsgenauigkeit</div>
              </CardContent>
            </Card>
            <Card className="bg-zinc-900/60 border-zinc-800">
              <CardContent className="pt-4">
                <div className="text-xs text-zinc-500 mb-1">Aktive Engines</div>
                <div className="text-2xl font-bold text-zinc-100">{data.engineStats.length}</div>
                <div className="text-xs text-zinc-500 mt-1">Mit Daten</div>
              </CardContent>
            </Card>
            <Card className="bg-zinc-900/60 border-zinc-800">
              <CardContent className="pt-4">
                <div className="text-xs text-zinc-500 mb-1">Kalibrierung</div>
                <div className="text-2xl font-bold text-zinc-100">
                  {data.calibration.filter(c => c.count > 0).length}/{data.calibration.length}
                </div>
                <div className="text-xs text-zinc-500 mt-1">Conviction-Buckets aktiv</div>
              </CardContent>
            </Card>
          </div>

          {data.totalEvaluated === 0 && (
            <Card className="bg-zinc-900/60 border-zinc-800 mb-6">
              <CardContent className="pt-6 pb-6 text-center">
                <Info className="h-8 w-8 text-zinc-600 mx-auto mb-3" />
                <p className="text-zinc-400 font-medium">Noch keine evaluierten Signale</p>
                <p className="text-zinc-500 text-sm mt-1">
                  Starte einen Signal-Snapshot, um Daten zu sammeln. Nach Ablauf der Haltedauer
                  werden die Signale automatisch evaluiert.
                </p>
                <Button
                  className="mt-4 bg-teal-600 hover:bg-teal-700 text-white"
                  onClick={() => { setIsSnapshotting(true); snapshotMut.mutate(); }}
                  disabled={isSnapshotting}
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Jetzt Snapshot starten
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Engine-Performance-Tabelle */}
          {data.engineStats.length > 0 && (
            <Card className="bg-zinc-900/60 border-zinc-800 mb-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-teal-400" />
                  Engine-Performance
                </CardTitle>
                <CardDescription className="text-zinc-500 text-xs">
                  Trefferquote, Ø-Rendite, Ø-Alpha (vs. SPI) und Ø-Überzeugung je Signal-Engine
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
      <Breadcrumb
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Signal-Performance", icon: <TrendingUp className="h-4 w-4" /> },
        ]}
      />
                  {data.engineStats
                    .sort((a, b) => b.hitRate - a.hitRate)
                    .map(stat => (
                    <div key={stat.engine} className="border border-zinc-800 rounded-lg overflow-hidden">
                      {/* Engine-Zeile */}
                      <button
                        className="w-full flex items-center gap-4 p-3 hover:bg-zinc-800/40 transition-colors text-left"
                        onClick={() => setExpandedEngine(expandedEngine === stat.engine ? null : stat.engine)}
                      >
                        <div className="w-36 shrink-0">
                          <span className="text-sm font-medium text-zinc-200">
                            {ENGINE_LABELS[stat.engine] ?? stat.engine}
                          </span>
                        </div>
                        <div className="flex-1 grid grid-cols-5 gap-4">
                          <div>
                            <div className="text-xs text-zinc-500 mb-0.5">Trefferquote</div>
                            <HitRateBadge rate={stat.hitRate} />
                          </div>
                          <div>
                            <div className="text-xs text-zinc-500 mb-0.5">Ø Rendite</div>
                            <span className={`text-sm font-medium ${stat.avgReturn >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {fmtReturn(stat.avgReturn)}
                            </span>
                          </div>
                          {/* F-14: Alpha vs. SPI (nur Signale mit Benchmark-Daten) */}
                          <div>
                            <div className="text-xs text-zinc-500 mb-0.5">Ø Alpha</div>
                            {stat.avgAlpha != null ? (
                              <span className={`text-sm font-medium ${stat.avgAlpha >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                {fmtReturn(stat.avgAlpha)}
                              </span>
                            ) : (
                              <span className="text-sm text-zinc-600">–</span>
                            )}
                          </div>
                          <div>
                            <div className="text-xs text-zinc-500 mb-0.5">Alpha-Quote</div>
                            {stat.alphaHitRate != null ? (
                              <span className="text-sm text-zinc-300">
                                <HitRateBadge rate={stat.alphaHitRate} />{" "}
                                <span className="text-zinc-600">({stat.alphaCount})</span>
                              </span>
                            ) : (
                              <span className="text-sm text-zinc-600">–</span>
                            )}
                          </div>
                          <div>
                            <div className="text-xs text-zinc-500 mb-0.5">Ø Überzeugung</div>
                            <span className="text-sm text-zinc-300">{pct(stat.avgConviction)}</span>
                          </div>
                        </div>
                        <div className="shrink-0 text-xs text-zinc-500">
                          {stat.evaluatedSignals} Signale
                        </div>
                        {expandedEngine === stat.engine
                          ? <ChevronUp className="h-4 w-4 text-zinc-500 shrink-0" />
                          : <ChevronDown className="h-4 w-4 text-zinc-500 shrink-0" />
                        }
                      </button>

                      {/* Aufgeklappte Details */}
                      {expandedEngine === stat.engine && (
                        <div className="border-t border-zinc-800 bg-zinc-900/40 p-4">
                          <div className="grid grid-cols-2 gap-6">
                            {/* By Regime */}
                            <div>
                              <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">
                                Trefferquote je Regime
                              </h4>
                              <div className="space-y-2">
                                {Object.entries(stat.byRegime).map(([regime, rs]) => (
                                  <div key={regime} className="flex items-center gap-3">
                                    <span className="text-xs text-zinc-400 w-28 shrink-0">
                                      {REGIME_LABELS[regime] ?? regime}
                                    </span>
                                    <div className="flex-1 h-4 bg-zinc-800 rounded overflow-hidden">
                                      <div
                                        className={`h-full rounded ${rs.hitRate >= 0.6 ? "bg-emerald-500/50" : rs.hitRate >= 0.5 ? "bg-amber-500/50" : "bg-red-500/50"}`}
                                        style={{ width: `${rs.hitRate * 100}%` }}
                                      />
                                    </div>
                                    <span className="text-xs text-zinc-300 w-12 text-right shrink-0">
                                      {pct(rs.hitRate)} <span className="text-zinc-600">({rs.count})</span>
                                    </span>
                                  </div>
                                ))}
                                {Object.keys(stat.byRegime).length === 0 && (
                                  <p className="text-xs text-zinc-600">Keine Daten</p>
                                )}
                              </div>
                            </div>
                            {/* By Action */}
                            <div>
                              <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">
                                Trefferquote je Aktion
                              </h4>
                              <div className="space-y-2">
                                {Object.entries(stat.byAction).map(([action, as_]) => (
                                  <div key={action} className="flex items-center gap-3">
                                    <ActionBadge action={action} />
                                    <div className="flex-1 h-4 bg-zinc-800 rounded overflow-hidden">
                                      <div
                                        className={`h-full rounded ${as_.hitRate >= 0.6 ? "bg-emerald-500/50" : as_.hitRate >= 0.5 ? "bg-amber-500/50" : "bg-red-500/50"}`}
                                        style={{ width: `${as_.hitRate * 100}%` }}
                                      />
                                    </div>
                                    <span className="text-xs text-zinc-300 w-12 text-right shrink-0">
                                      {pct(as_.hitRate)} <span className="text-zinc-600">({as_.count})</span>
                                    </span>
                                    {/* F-14: Ø Alpha je Aktion (falls Benchmark-Daten vorhanden) */}
                                    <span className="text-xs w-16 text-right shrink-0">
                                      {as_.avgAlpha != null ? (
                                        <span className={as_.avgAlpha >= 0 ? "text-emerald-400" : "text-red-400"}>
                                          α {fmtReturn(as_.avgAlpha)}
                                        </span>
                                      ) : (
                                        <span className="text-zinc-700">α –</span>
                                      )}
                                    </span>
                                  </div>
                                ))}
                                {Object.keys(stat.byAction).length === 0 && (
                                  <p className="text-xs text-zinc-600">Keine Daten</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Kalibrierungskurve */}
          <Card className="bg-zinc-900/60 border-zinc-800 mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                <Target className="h-4 w-4 text-teal-400" />
                Kalibrierungskurve
              </CardTitle>
              <CardDescription className="text-zinc-500 text-xs">
                Erwartete vs. tatsächliche Trefferquote je Überzeugungsstärke (gestrichelte Linie = perfekte Kalibrierung)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.calibration.map(c => (
                  <div key={c.bucket} className="flex items-center gap-3">
                    <span className="text-xs text-zinc-400 w-20 shrink-0">
                      Conviction {c.bucket}
                    </span>
                    <div className="flex-1">
                      <CalibrationBar
                        expected={(c.minConviction + c.maxConviction) / 2}
                        actual={c.hitRate}
                        count={c.count}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-zinc-600 mt-3">
                Gut kalibriert: Signale mit 60-80% Überzeugung sollten ~60-80% Trefferquote haben.
                Die senkrechte Linie zeigt die erwartete Trefferquote.
              </p>
            </CardContent>
          </Card>

          {/* Letzte Signale */}
          <Card className="bg-zinc-900/60 border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                <Activity className="h-4 w-4 text-teal-400" />
                Letzte Signale
              </CardTitle>
              <CardDescription className="text-zinc-500 text-xs">
                Die 50 neuesten gespeicherten Signale (inkl. noch nicht evaluierter)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.recentSignals.length === 0 ? (
                <p className="text-zinc-500 text-sm text-center py-6">
                  Noch keine Signale gespeichert. Starte einen Snapshot.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-500">
                        <th className="text-left py-2 pr-3 font-medium">Ticker</th>
                        <th className="text-left py-2 pr-3 font-medium">Aktion</th>
                        <th className="text-left py-2 pr-3 font-medium">Engine</th>
                        <th className="text-left py-2 pr-3 font-medium">Regime</th>
                        <th className="text-right py-2 pr-3 font-medium">Überzeugung</th>
                        <th className="text-right py-2 pr-3 font-medium">Rendite</th>
                        <th className="text-center py-2 pr-3 font-medium">Korrekt</th>
                        <th className="text-right py-2 font-medium">Datum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentSignals.map((sig: any) => (
                        <tr key={sig.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/20">
                          <td className="py-2 pr-3 font-mono text-zinc-200">{sig.ticker}</td>
                          <td className="py-2 pr-3"><ActionBadge action={sig.action} /></td>
                          <td className="py-2 pr-3 text-zinc-400">
                            {ENGINE_LABELS[sig.selectedEngine] ?? sig.selectedEngine}
                          </td>
                          <td className="py-2 pr-3 text-zinc-400">
                            {REGIME_LABELS[sig.regime] ?? sig.regime}
                          </td>
                          <td className="py-2 pr-3 text-right text-zinc-300">
                            {pct(parseFloat(sig.conviction))}
                          </td>
                          <td className="py-2 pr-3 text-right">
                            {sig.actualReturnPct != null ? (
                              <span className={parseFloat(sig.actualReturnPct) >= 0 ? "text-emerald-400" : "text-red-400"}>
                                {fmtReturn(parseFloat(sig.actualReturnPct))}
                              </span>
                            ) : (
                              <span className="text-zinc-600">ausstehend</span>
                            )}
                          </td>
                          <td className="py-2 pr-3 text-center">
                            {sig.directionCorrect === 1 ? (
                              <span className="text-emerald-400">✓</span>
                            ) : sig.directionCorrect === 0 ? (
                              <span className="text-red-400">✗</span>
                            ) : (
                              <span className="text-zinc-600">–</span>
                            )}
                          </td>
                          <td className="py-2 text-right text-zinc-500">{fmtDate(sig.computedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
