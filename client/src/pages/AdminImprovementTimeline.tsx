/**
 * Verbesserungs-Timeline (KIMI-Audit ③).
 *
 * Zeigt auf einen Blick, wann welche Signal-Gewichts- bzw. ML-Modell-Version
 * aktiv wurde und wie sie out-of-sample abschnitt — damit «hat sich das System
 * verbessert?» ohne Log-Graben beantwortbar ist. Reine Leseansicht.
 */
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceDot,
} from "recharts";

const fmtDate = (d: string | Date | null) =>
  d ? new Date(d).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "–";
const fmtPct = (n: number | null) => (n == null ? "–" : `${n.toFixed(1)}%`);
const fmtNum = (n: number | null) => (n == null ? "–" : n.toFixed(2));

export default function AdminImprovementTimeline() {
  const { data, isLoading } = trpc.admin.getImprovementTimeline.useQuery();

  const weights = data?.weights ?? [];
  const models = data?.models ?? [];

  // Chart-Daten: OOS-Trefferquote je Optimizer-Lauf über Zeit.
  const weightSeries = weights
    .filter((w: any) => w.oosHitRate != null)
    .map((w: any, i: number) => ({ i, label: fmtDate(w.at), oos: w.oosHitRate, incumbent: w.incumbentOosHitRate, activated: w.activated }));

  const modelSeries = models
    .filter((m: any) => m.hitRate != null)
    .map((m: any, i: number) => ({ i, label: fmtDate(m.at), hitRate: m.hitRate, alpha: m.alpha }));

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <Breadcrumb items={[{ label: "Admin", href: "/admin" }, { label: "Verbesserungs-Timeline", icon: <TrendingUp className="h-4 w-4" /> }]} />

        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><TrendingUp className="h-6 w-6 text-primary" /> Verbesserungs-Timeline</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Out-of-Sample-Güte je aktivierter Signal-Gewichts- und ML-Modell-Version über die Zeit.
          </p>
        </div>

        {isLoading && <div className="text-sm text-muted-foreground">Lädt…</div>}

        {/* Signal-Gewichte */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Signal-Gewichte — OOS-Trefferquote je Optimizer-Lauf</CardTitle>
            <CardDescription>Grüne Punkte = aktiviert (Gate bestanden), rote = verworfen (Incumbent behalten).</CardDescription>
          </CardHeader>
          <CardContent>
            {weightSeries.length === 0 ? (
              <div className="text-sm text-muted-foreground">Noch keine Optimizer-Läufe mit OOS-Daten.</div>
            ) : (
              <div style={{ width: "100%", height: 260 }}>
                <ResponsiveContainer>
                  <LineChart data={weightSeries} margin={{ top: 10, right: 20, bottom: 0, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9ca3af" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} unit="%" domain={["auto", "auto"]} />
                    <Tooltip
                      contentStyle={{ background: "#0f1420", border: "1px solid #ffffff20", borderRadius: 8, fontSize: 12 }}
                      formatter={(v: any, name: string) => [fmtPct(v as number), name === "oos" ? "Kandidat OOS" : "Incumbent OOS"]}
                    />
                    <Line type="monotone" dataKey="incumbent" stroke="#64748b" strokeDasharray="4 4" dot={false} name="incumbent" connectNulls />
                    <Line type="monotone" dataKey="oos" stroke="#00CFC1" strokeWidth={2} dot={false} name="oos" />
                    {weightSeries.map((p: any) => (
                      <ReferenceDot key={p.i} x={p.label} y={p.oos} r={4} fill={p.activated ? "#4ade80" : "#f87171"} stroke="none" />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {weights.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-zinc-400 border-b border-white/10">
                    <tr>
                      <th className="text-left py-1.5 pr-3">Datum</th>
                      <th className="text-left py-1.5 pr-3">Lauf</th>
                      <th className="text-right py-1.5 pr-3">OOS</th>
                      <th className="text-right py-1.5 pr-3">Incumbent</th>
                      <th className="text-right py-1.5 pr-3">Overfit</th>
                      <th className="text-left py-1.5 pr-3">Auslöser</th>
                      <th className="text-left py-1.5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...weights].reverse().slice(0, 20).map((w: any) => (
                      <tr key={w.id} className="border-b border-white/5">
                        <td className="py-1.5 pr-3 font-mono">{fmtDate(w.at)}</td>
                        <td className="py-1.5 pr-3">{w.name}</td>
                        <td className="py-1.5 pr-3 text-right font-mono">{fmtPct(w.oosHitRate)}</td>
                        <td className="py-1.5 pr-3 text-right font-mono text-zinc-400">{fmtPct(w.incumbentOosHitRate)}</td>
                        <td className="py-1.5 pr-3 text-right font-mono text-zinc-400">{fmtNum(w.overfitRatio)}</td>
                        <td className="py-1.5 pr-3 text-zinc-400">{w.triggeredBy ?? "–"}</td>
                        <td className="py-1.5">
                          {w.isActive
                            ? <span className="text-emerald-400">● aktiv</span>
                            : w.activated
                            ? <span className="text-zinc-400">aktiviert (abgelöst)</span>
                            : <span className="text-red-400">verworfen</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ML-Modelle */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">ML-Modelle — OOS-Trefferquote & Alpha je Version</CardTitle>
            <CardDescription>Nur promotete Versionen fliessen in die Inferenz ein (Promotion-Gate).</CardDescription>
          </CardHeader>
          <CardContent>
            {modelSeries.length === 0 ? (
              <div className="text-sm text-muted-foreground">Noch keine ML-Modell-Metriken (Analytics-Service nicht konfiguriert oder kein Lauf).</div>
            ) : (
              <div style={{ width: "100%", height: 240 }}>
                <ResponsiveContainer>
                  <LineChart data={modelSeries} margin={{ top: 10, right: 20, bottom: 0, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9ca3af" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} unit="%" />
                    <Tooltip
                      contentStyle={{ background: "#0f1420", border: "1px solid #ffffff20", borderRadius: 8, fontSize: 12 }}
                      formatter={(v: any) => fmtPct(v as number)}
                    />
                    <Line type="monotone" dataKey="hitRate" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} name="HitRate" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {models.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-zinc-400 border-b border-white/10">
                    <tr>
                      <th className="text-left py-1.5 pr-3">Datum</th>
                      <th className="text-left py-1.5 pr-3">Art / Version</th>
                      <th className="text-right py-1.5 pr-3">HitRate</th>
                      <th className="text-right py-1.5 pr-3">Alpha</th>
                      <th className="text-right py-1.5 pr-3">Overfit</th>
                      <th className="text-left py-1.5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...models].reverse().slice(0, 20).map((m: any) => (
                      <tr key={m.id} className="border-b border-white/5">
                        <td className="py-1.5 pr-3 font-mono">{fmtDate(m.at)}</td>
                        <td className="py-1.5 pr-3">{m.kind} v{m.version}</td>
                        <td className="py-1.5 pr-3 text-right font-mono">{fmtPct(m.hitRate)}</td>
                        <td className="py-1.5 pr-3 text-right font-mono">{fmtNum(m.alpha)}</td>
                        <td className="py-1.5 pr-3 text-right font-mono text-zinc-400">{fmtNum(m.overfitRatio)}</td>
                        <td className="py-1.5">
                          {m.status === "active"
                            ? <span className="text-emerald-400">● aktiv</span>
                            : m.status === "archived"
                            ? <span className="text-zinc-400">archiviert</span>
                            : <span className="text-red-400">{m.status}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
