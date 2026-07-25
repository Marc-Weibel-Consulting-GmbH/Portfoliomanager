import { BrainCircuit } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Breadcrumb } from "@/components/Breadcrumb";

// ─── helpers ────────────────────────────────────────────────────────────────

function fmtPct(v: unknown) {
  const n = Number(v);
  return isNaN(n) ? "–" : `${(n * 100).toFixed(1)}%`;
}
function fmtNum(v: unknown, dec = 2) {
  const n = Number(v);
  return isNaN(n) ? "–" : n.toFixed(dec);
}
function fmtDate(v: unknown) {
  if (!v) return "–";
  try { return new Date(v as string).toLocaleString("de-CH"); } catch { return String(v); }
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    candidate: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    archived: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
    failed: "bg-red-500/20 text-red-400 border-red-500/30",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${map[status] ?? "bg-zinc-700 text-zinc-300"}`}>
      {status}
    </span>
  );
}

function GateBadge({ passed }: { passed: boolean }) {
  return passed
    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">✓ Gate bestanden</span>
    : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">✗ Gate nicht bestanden</span>;
}

// ─── component ──────────────────────────────────────────────────────────────

export default function AdminMlTrainer() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [isTraining, setIsTraining] = useState(false);
  const [lastTrigger, setLastTrigger] = useState<string | null>(null);

  // Redirect non-admins
  if (user && user.role !== "admin") {
    navigate("/");
    return null;
  }

  const statusQ = trpc.admin.mlGetStatus.useQuery(undefined, { refetchInterval: isTraining ? 5000 : 30000 });
  const historyQ = trpc.admin.mlGetHistory.useQuery({ limit: 20 });
  const triggerMut = trpc.system.triggerMlTraining.useMutation({
    onSuccess: (data) => {
      setLastTrigger(data.timestamp);
      setIsTraining(true);
      toast.success("Training gestartet", { description: "Läuft im Hintergrund. Status wird alle 5 Sekunden aktualisiert." });
      // Stop polling after 10 minutes
      setTimeout(() => {
        setIsTraining(false);
        statusQ.refetch();
        historyQ.refetch();
      }, 10 * 60 * 1000);
    },
    onError: (e) => toast.error("Training fehlgeschlagen", { description: e.message }),
  });

  const status = statusQ.data as any;
  const history = historyQ.data?.runs ?? [];
  const active = status?.activeModel;
  const activeMetrics = active?.metrics as Record<string, number> | null;

  return (
    <div className="text-white">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <Breadcrumb
        items={[
          { label: "Admin", href: "/admin" },
          { label: "ML Trainer", icon: <BrainCircuit className="h-4 w-4" /> },
        ]}
      />

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">ML Trainer</h1>
            <p className="text-sm text-zinc-400 mt-1">
              Gradient-Boosting Classifier · Walk-Forward Validation · ONNX Export
            </p>
          </div>
          <Button
            onClick={() => triggerMut.mutate()}
            disabled={isTraining || triggerMut.isPending}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-5"
          >
            {isTraining || triggerMut.isPending ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                Training läuft…
              </span>
            ) : (
              "▶ Training starten"
            )}
          </Button>
        </div>

        {/* Service Status */}
        <div className="flex items-center gap-3 text-sm">
          <span className="text-zinc-400">Analytics Service:</span>
          {(status as any)?.analyticsServiceConfigured ? (
            (status as any)?.serviceOnline
              ? <span className="flex items-center gap-1.5 text-emerald-400"><span className="w-2 h-2 rounded-full bg-emerald-400" />Online</span>
              : <span className="flex items-center gap-1.5 text-red-400"><span className="w-2 h-2 rounded-full bg-red-400" />Offline</span>
          ) : (
            <span className="text-yellow-400">ANALYTICS_SERVICE_URL nicht konfiguriert</span>
          )}
          {lastTrigger && (
            <span className="text-zinc-500 ml-4">Letzter Start: {fmtDate(lastTrigger)}</span>
          )}
        </div>

        {/* Active Model Card */}
        <Card className="bg-zinc-900/60 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-white flex items-center gap-2">
              Aktives Modell
              {active && <StatusBadge status="active" />}
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Das aktuell für Inferenz verwendete Modell (Promotion Gate bestanden)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!active ? (
              <p className="text-zinc-500 text-sm">Kein aktives Modell vorhanden. Starte ein Training.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard label="Version" value={`v${active.version}`} />
                <MetricCard label="Typ" value={String(active.kind)} />
                <MetricCard label="Universum" value={`${active.universeSize ?? "–"} Aktien`} />
                <MetricCard label="Trainiert am" value={fmtDate(active.createdAt)} />
                <MetricCard
                  label="HitRate (OOS)"
                  value={fmtPct(activeMetrics?.hitRate)}
                  highlight={Number(activeMetrics?.hitRate) >= 0.52}
                  target="≥ 52%"
                />
                <MetricCard
                  label="Alpha (OOS)"
                  value={fmtPct(activeMetrics?.alpha)}
                  highlight={Number(activeMetrics?.alpha) >= 0.01}
                  target="≥ 1%"
                />
                <MetricCard
                  label="Overfit-Ratio"
                  value={fmtNum(activeMetrics?.overfitRatio)}
                  highlight={Number(activeMetrics?.overfitRatio) <= 2.0}
                  target="≤ 2.0"
                />
                <MetricCard
                  label="Trainingsperiode"
                  value={active.trainStart && active.trainEnd ? `${active.trainStart} – ${active.trainEnd}` : "–"}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Promotion Gate Explanation */}
        <Card className="bg-zinc-900/40 border-zinc-800/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-300">Promotion Gate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="bg-zinc-800/50 rounded p-3">
                <div className="text-zinc-400 text-xs mb-1">HitRate (OOS)</div>
                <div className="text-white font-semibold">≥ 52%</div>
                <div className="text-zinc-500 text-xs mt-1">Anteil korrekt vorhergesagter Richtungen</div>
              </div>
              <div className="bg-zinc-800/50 rounded p-3">
                <div className="text-zinc-400 text-xs mb-1">Overfit-Ratio</div>
                <div className="text-white font-semibold">≤ 2.0</div>
                <div className="text-zinc-500 text-xs mt-1">IS-HitRate / OOS-HitRate (Overfitting-Indikator)</div>
              </div>
              <div className="bg-zinc-800/50 rounded p-3">
                <div className="text-zinc-400 text-xs mb-1">Alpha (OOS)</div>
                <div className="text-white font-semibold">≥ 0%</div>
                <div className="text-zinc-500 text-xs mt-1">Annualisierter Mehrertrag gegenüber Buy&Hold</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Training History */}
        <Card className="bg-zinc-900/60 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-white">Trainingshistorie</CardTitle>
            <CardDescription className="text-zinc-400">Alle Trainingsläufe, neueste zuerst</CardDescription>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-zinc-500 text-sm">Noch keine Trainingsläufe vorhanden.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-400 text-xs">
                      <th className="text-left py-2 pr-4">Version</th>
                      <th className="text-left py-2 pr-4">Status</th>
                      <th className="text-left py-2 pr-4">HitRate</th>
                      <th className="text-left py-2 pr-4">Alpha</th>
                      <th className="text-left py-2 pr-4">Overfit</th>
                      <th className="text-left py-2 pr-4">Universum</th>
                      <th className="text-left py-2 pr-4">Gate</th>
                      <th className="text-left py-2">Erstellt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((run) => {
                      const m = run.metrics as Record<string, number> | null;
                      const hitRate = Number(m?.hitRate ?? 0);
                      const alpha = Number(m?.alpha ?? 0);
                      const overfit = Number(m?.overfitRatio ?? 0);
                      const passed = hitRate >= 0.52 && overfit <= 1.6 && alpha >= 0;
                      return (
                        <tr key={run.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/20">
                          <td className="py-2 pr-4 font-mono text-zinc-300">v{run.version}</td>
                          <td className="py-2 pr-4"><StatusBadge status={run.status} /></td>
                          <td className={`py-2 pr-4 font-mono ${hitRate >= 0.52 ? "text-emerald-400" : "text-red-400"}`}>
                            {fmtPct(m?.hitRate)}
                          </td>
                          <td className={`py-2 pr-4 font-mono ${alpha >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {fmtPct(m?.alpha)}
                          </td>
                          <td className={`py-2 pr-4 font-mono ${overfit <= 1.6 ? "text-emerald-400" : "text-red-400"}`}>
                            {fmtNum(m?.overfitRatio)}
                          </td>
                          <td className="py-2 pr-4 text-zinc-400">{run.universeSize ?? "–"}</td>
                          <td className="py-2 pr-4"><GateBadge passed={passed} /></td>
                          <td className="py-2 text-zinc-500 text-xs">{fmtDate(run.createdAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Architecture Info */}
        <Card className="bg-zinc-900/40 border-zinc-800/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-300">Modell-Architektur</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <InfoItem label="Algorithmus" value="Gradient Boosting (sklearn)" />
              <InfoItem label="Validierung" value="Walk-Forward, 5 Folds" />
              <InfoItem label="Export" value="ONNX (für Produktion)" />
              <InfoItem label="Cron" value="Montag 02:37 UTC (wöchentlich)" />
              <InfoItem label="Features" value="ret_1d, ret_5d, ret_20d, mom_60d, vol_20d, rsi_14, px_vs_sma50" />
              <InfoItem label="Label" value="20-Tage Forward-Return Richtung (1=steigt, 0=fällt)" />
              <InfoItem label="Universum" value="Watchlist-Aktien (max. 80)" />
              <InfoItem label="Min. Datenpunkte" value="150 Handelstage pro Aktie" />
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}

function MetricCard({
  label, value, highlight, target,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  target?: string;
}) {
  return (
    <div className="bg-zinc-800/50 rounded-lg p-3">
      <div className="text-zinc-400 text-xs mb-1">{label}</div>
      <div className={`text-lg font-bold ${highlight === true ? "text-emerald-400" : highlight === false ? "text-red-400" : "text-white"}`}>
        {value}
      </div>
      {target && <div className="text-zinc-500 text-xs mt-0.5">Ziel: {target}</div>}
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-zinc-800/40 rounded p-2">
      <div className="text-zinc-500 text-xs">{label}</div>
      <div className="text-zinc-300 text-xs mt-0.5">{value}</div>
    </div>
  );
}
