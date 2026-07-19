import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {AlertCircle, BarChart2, MessageSquare, Minus, Plus, RefreshCw, TrendingDown, TrendingUp} from "lucide-react";
import { Breadcrumb } from "@/components/Breadcrumb";

const ACTION_CONFIG = {
  reduce: { label: "Reduziert", color: "bg-orange-500/20 text-orange-300 border-orange-500/30", icon: TrendingDown, iconColor: "text-orange-400" },
  increase: { label: "Erhöht", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30", icon: TrendingUp, iconColor: "text-emerald-400" },
  replace: { label: "Ersetzt", color: "bg-blue-500/20 text-blue-300 border-blue-500/30", icon: RefreshCw, iconColor: "text-blue-400" },
  remove: { label: "Entfernt", color: "bg-red-500/20 text-red-300 border-red-500/30", icon: Minus, iconColor: "text-red-400" },
  add: { label: "Hinzugefügt", color: "bg-purple-500/20 text-purple-300 border-purple-500/30", icon: Plus, iconColor: "text-purple-400" },
} as const;

type DominantAction = keyof typeof ACTION_CONFIG;

export default function AdminFeedbackDashboard() {
  const { data, isLoading, error } = trpc.admin.getFeedbackStats.useQuery();

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
      <Breadcrumb
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Feedback", icon: <MessageSquare className="h-4 w-4" /> },
        ]}
      />
        {/* Header */}
        <div className="flex items-center gap-3">
          <BarChart2 className="h-6 w-6 text-[#00CFC1]" />
          <div>
            <h1 className="text-xl font-semibold text-foreground">Feedback-Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Aggregierte Admin-Korrekturen — Grundlage für die Synthesizer-Optimierung
            </p>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#00CFC1] mr-3" />
            Lade Feedback-Daten…
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-4">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="text-sm">{error.message}</span>
          </div>
        )}

        {data && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-slate-800/50 border-slate-700/50">
                <CardContent className="pt-4 pb-4">
                  <div className="text-2xl font-bold text-foreground">{data.totalFeedbackEntries}</div>
                  <div className="text-xs text-muted-foreground mt-1">Genehmigte Vorschläge mit Feedback</div>
                </CardContent>
              </Card>
              <Card className="bg-slate-800/50 border-slate-700/50">
                <CardContent className="pt-4 pb-4">
                  <div className="text-2xl font-bold text-foreground">{data.patterns.length}</div>
                  <div className="text-xs text-muted-foreground mt-1">Betroffene Ticker</div>
                </CardContent>
              </Card>
              <Card className="bg-slate-800/50 border-slate-700/50">
                <CardContent className="pt-4 pb-4">
                  <div className="text-2xl font-bold text-orange-400">
                    {data.patterns.filter(p => p.dominantAction === 'reduce').length}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Regelmässig reduziert</div>
                </CardContent>
              </Card>
              <Card className="bg-slate-800/50 border-slate-700/50">
                <CardContent className="pt-4 pb-4">
                  <div className="text-2xl font-bold text-blue-400">
                    {data.patterns.filter(p => p.dominantAction === 'replace' || p.dominantAction === 'remove').length}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Regelmässig ersetzt/entfernt</div>
                </CardContent>
              </Card>
            </div>

            {/* Synthesizer readiness notice */}
            {data.totalFeedbackEntries < 2 ? (
              <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-amber-300">Noch zu wenig Feedback-Daten</div>
                  <div className="text-xs text-amber-400/80 mt-1">
                    Der Synthesizer-Agent beginnt historische Muster zu berücksichtigen, sobald mindestens 2 genehmigte Vorschläge mit Feedback vorliegen.
                    Aktuell: {data.totalFeedbackEntries} von 2 benötigten Einträgen.
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
                <BarChart2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-emerald-300">Synthesizer lernt aus {data.totalFeedbackEntries} Feedback-Einträgen</div>
                  <div className="text-xs text-emerald-400/80 mt-1">
                    Der Synthesizer-Agent berücksichtigt diese Muster beim nächsten Portfolio-Vorschlag automatisch.
                    {data.patterns.filter(p => p.total >= 2).length > 0 && (
                      <> {data.patterns.filter(p => p.total >= 2).length} Ticker mit wiederholten Mustern werden proaktiv empfohlen.</>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Ticker patterns table */}
            {data.patterns.length > 0 ? (
              <Card className="bg-slate-800/50 border-slate-700/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">Ticker-Muster nach Häufigkeit</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-700/50">
                          <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Ticker</th>
                          <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Dominante Aktion</th>
                          <th className="text-center px-3 py-2.5 text-xs text-muted-foreground font-medium">Gesamt</th>
                          <th className="text-center px-3 py-2.5 text-xs text-muted-foreground font-medium">↓ Red.</th>
                          <th className="text-center px-3 py-2.5 text-xs text-muted-foreground font-medium">↑ Erh.</th>
                          <th className="text-center px-3 py-2.5 text-xs text-muted-foreground font-medium">↔ Ers.</th>
                          <th className="text-center px-3 py-2.5 text-xs text-muted-foreground font-medium">− Entf.</th>
                          <th className="text-center px-3 py-2.5 text-xs text-muted-foreground font-medium">+ Hinz.</th>
                          <th className="text-right px-4 py-2.5 text-xs text-muted-foreground font-medium">Zuletzt</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.patterns.map((p, idx) => {
                          const cfg = ACTION_CONFIG[p.dominantAction as DominantAction] ?? ACTION_CONFIG.reduce;
                          const Icon = cfg.icon;
                          const isStrong = p.total >= 3;
                          return (
                            <tr
                              key={p.ticker}
                              className={`border-b border-slate-700/30 transition-colors ${
                                isStrong ? 'bg-slate-700/20' : 'hover:bg-slate-700/10'
                              }`}
                            >
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-semibold text-foreground">{p.ticker}</span>
                                  {isStrong && (
                                    <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-medium">Muster</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-2.5">
                                <Badge variant="outline" className={`text-xs gap-1 ${cfg.color}`}>
                                  <Icon className={`h-3 w-3 ${cfg.iconColor}`} />
                                  {cfg.label}
                                </Badge>
                              </td>
                              <td className="px-3 py-2.5 text-center font-semibold text-foreground">{p.total}</td>
                              <td className="px-3 py-2.5 text-center text-orange-400">{p.reduce || '—'}</td>
                              <td className="px-3 py-2.5 text-center text-emerald-400">{p.increase || '—'}</td>
                              <td className="px-3 py-2.5 text-center text-blue-400">{p.replace || '—'}</td>
                              <td className="px-3 py-2.5 text-center text-red-400">{p.remove || '—'}</td>
                              <td className="px-3 py-2.5 text-center text-purple-400">{p.add || '—'}</td>
                              <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">
                                {new Date(p.lastSeen).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="text-center py-16 text-muted-foreground">
                <BarChart2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Noch keine Feedback-Daten vorhanden.</p>
                <p className="text-xs mt-1">Genehmigen Sie KI-Vorschläge mit Anpassungen, um Muster zu sammeln.</p>
              </div>
            )}

            {/* Recent feedback entries */}
            {data.recentFeedback.length > 0 && (
              <Card className="bg-slate-800/50 border-slate-700/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">Letzte Feedback-Einträge</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.recentFeedback.map((fb) => {
                    const s = fb.summary as any;
                    const changes = [
                      ...(s?.reduced ?? []).map((t: string) => ({ ticker: t, action: 'reduce' as DominantAction })),
                      ...(s?.increased ?? []).map((t: string) => ({ ticker: t, action: 'increase' as DominantAction })),
                      ...(s?.replaced ?? []).map((t: string) => ({ ticker: t, action: 'replace' as DominantAction })),
                      ...(s?.removed ?? []).map((t: string) => ({ ticker: t, action: 'remove' as DominantAction })),
                      ...(s?.added ?? []).map((t: string) => ({ ticker: t, action: 'add' as DominantAction })),
                    ];
                    return (
                      <div key={fb.id} className="flex items-start gap-3 p-3 rounded-lg bg-slate-700/20 border border-slate-700/30">
                        <div className="text-xs text-muted-foreground shrink-0 mt-0.5 w-16">
                          {new Date(fb.createdAt).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' })}
                        </div>
                        <div className="text-xs text-muted-foreground shrink-0 mt-0.5 w-20 capitalize">{fb.riskProfile ?? '—'}</div>
                        <div className="flex flex-wrap gap-1.5 flex-1">
                          {changes.length === 0 ? (
                            <span className="text-xs text-muted-foreground italic">Keine Änderungen</span>
                          ) : changes.map((c, i) => {
                            const cfg = ACTION_CONFIG[c.action];
                            const Icon = cfg.icon;
                            return (
                              <Badge key={i} variant="outline" className={`text-[10px] gap-1 ${cfg.color}`}>
                                <Icon className={`h-2.5 w-2.5 ${cfg.iconColor}`} />
                                {c.ticker}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
