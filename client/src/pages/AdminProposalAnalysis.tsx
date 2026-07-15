import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Brain, TrendingUp, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

function ConfidenceBadge({ value }: { value: string | null }) {
  if (!value) return <Badge variant="outline">—</Badge>;
  const map: Record<string, string> = { hoch: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", mittel: "bg-amber-500/20 text-amber-400 border-amber-500/30", niedrig: "bg-red-500/20 text-red-400 border-red-500/30" };
  return <Badge className={map[value] ?? ""}>{value}</Badge>;
}

function KennzahlenBadge({ value }: { value: string | null }) {
  if (!value || value === "n/a") return <Badge variant="outline">n/a</Badge>;
  if (value === "ja") return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30"><CheckCircle className="w-3 h-3 mr-1" />Erfüllt</Badge>;
  return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="w-3 h-3 mr-1" />Nicht erfüllt</Badge>;
}

function AcceptedBadge({ value }: { value: string | null }) {
  if (!value || value === "unbekannt") return <Badge variant="outline">Unbekannt</Badge>;
  if (value === "ja") return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Übernommen</Badge>;
  return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">Abgelehnt</Badge>;
}

export default function AdminProposalAnalysis() {
  const [confidence, setConfidence] = useState<string>("all");
  const [meetsFilter, setMeetsFilter] = useState<string>("all");
  const [offset, setOffset] = useState(0);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const LIMIT = 20;

  const { data, isLoading, refetch } = trpc.admin.listProposalLogs.useQuery({
    limit: LIMIT,
    offset,
    confidence: confidence !== "all" ? (confidence as any) : undefined,
    meetsFilter: meetsFilter !== "all" ? (meetsFilter as any) : undefined,
  });

  const updateAccepted = trpc.admin.updateProposalAccepted.useMutation({
    onSuccess: () => refetch(),
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="w-6 h-6 text-violet-400" />
            <div>
              <h1 className="text-xl font-semibold text-white">KI-Analyse Protokoll</h1>
              <p className="text-sm text-slate-400">Multi-Agent Portfolio-Vorschläge — intern, nicht für Endnutzer sichtbar</p>
            </div>
          </div>
          <div className="text-sm text-slate-400">{total} Einträge gesamt</div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <Select value={confidence} onValueChange={(v) => { setConfidence(v); setOffset(0); }}>
            <SelectTrigger className="w-44 bg-slate-800 border-slate-700 text-white">
              <SelectValue placeholder="Vertrauen" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="all">Alle Vertrauensstufen</SelectItem>
              <SelectItem value="hoch">Hoch</SelectItem>
              <SelectItem value="mittel">Mittel</SelectItem>
              <SelectItem value="niedrig">Niedrig</SelectItem>
            </SelectContent>
          </Select>
          <Select value={meetsFilter} onValueChange={(v) => { setMeetsFilter(v); setOffset(0); }}>
            <SelectTrigger className="w-48 bg-slate-800 border-slate-700 text-white">
              <SelectValue placeholder="Kennzahlen-Filter" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="all">Alle Kennzahlen</SelectItem>
              <SelectItem value="ja">Erfüllt</SelectItem>
              <SelectItem value="nein">Nicht erfüllt</SelectItem>
              <SelectItem value="n/a">N/A</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="text-slate-400 text-sm">Lade Daten...</div>
        ) : rows.length === 0 ? (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="py-12 text-center text-slate-400">
              <Brain className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>Noch keine KI-Analyse-Protokolle vorhanden.</p>
              <p className="text-xs mt-1">Protokolle werden automatisch gespeichert, wenn ein Portfolio-Vorschlag generiert wird.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {rows.map((row: any) => (
              <Collapsible key={row.id} open={expandedId === row.id} onOpenChange={(open) => setExpandedId(open ? row.id : null)}>
                <Card className="bg-slate-800/50 border-slate-700">
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-slate-700/30 transition-colors rounded-t-lg py-3 px-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          {expandedId === row.id ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-white text-sm font-medium">#{row.id}</span>
                              <span className="text-slate-400 text-xs">{new Date(row.createdAt).toLocaleString("de-CH")}</span>
                              <Badge variant="outline" className="text-xs">{row.riskProfile}</Badge>
                              <Badge variant="outline" className="text-xs">{row.investmentGoal}</Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                          <ConfidenceBadge value={row.overallConfidence} />
                          <KennzahlenBadge value={row.meetsKennzahlenFilter} />
                          <AcceptedBadge value={row.accepted} />
                          {row.positionCount && <span className="text-slate-400 text-xs">{row.positionCount} Titel</span>}
                          {row.sharpe && <span className="text-slate-400 text-xs">Sharpe {parseFloat(row.sharpe).toFixed(2)}</span>}
                          {row.fxWeightPct && <span className="text-slate-400 text-xs">FX {parseFloat(row.fxWeightPct).toFixed(1)}%</span>}
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0 pb-4 px-4 space-y-4">
                      {/* Metrics row */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          { label: "Methode", value: row.method },
                          { label: "Erwartete Rendite", value: row.expectedReturnPct ? `${parseFloat(row.expectedReturnPct).toFixed(1)}%` : "—" },
                          { label: "Volatilität", value: row.volatilityPct ? `${parseFloat(row.volatilityPct).toFixed(1)}%` : "—" },
                          { label: "Sharpe", value: row.sharpe ? parseFloat(row.sharpe).toFixed(2) : "—" },
                          { label: "FX-Anteil", value: row.fxWeightPct ? `${parseFloat(row.fxWeightPct).toFixed(1)}%` : "—" },
                          { label: "FX-Limit", value: row.maxFxExposurePct ? `${row.maxFxExposurePct}%` : "—" },
                          { label: "Agenten-Dauer", value: row.agentDurationMs ? `${(row.agentDurationMs / 1000).toFixed(1)}s` : "—" },
                          { label: "Challenger-Ablehnungen", value: row.challengerRejectedCount ?? "—" },
                        ].map(({ label, value }) => (
                          <div key={label} className="bg-slate-900/50 rounded p-2">
                            <div className="text-xs text-slate-500">{label}</div>
                            <div className="text-sm text-white font-medium">{value}</div>
                          </div>
                        ))}
                      </div>

                      {/* Synthesizer Verdict */}
                      {row.synthesizerVerdict && (
                        <div className="bg-violet-900/20 border border-violet-500/20 rounded p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Brain className="w-4 h-4 text-violet-400" />
                            <span className="text-xs font-medium text-violet-400">Synthesizer-Urteil</span>
                          </div>
                          <p className="text-sm text-slate-300">{row.synthesizerVerdict}</p>
                        </div>
                      )}

                      {/* Challenger Critique */}
                      {row.challengerCritique && (
                        <div className="bg-amber-900/20 border border-amber-500/20 rounded p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <AlertTriangle className="w-4 h-4 text-amber-400" />
                            <span className="text-xs font-medium text-amber-400">Challenger-Kritik</span>
                          </div>
                          <p className="text-sm text-slate-300">{row.challengerCritique}</p>
                        </div>
                      )}

                      {/* Kennzahlen Filter Reason */}
                      {row.kennzahlenFilterReason && (
                        <div className={`rounded p-3 border ${row.meetsKennzahlenFilter === 'ja' ? 'bg-emerald-900/20 border-emerald-500/20' : 'bg-red-900/20 border-red-500/20'}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <TrendingUp className={`w-4 h-4 ${row.meetsKennzahlenFilter === 'ja' ? 'text-emerald-400' : 'text-red-400'}`} />
                            <span className={`text-xs font-medium ${row.meetsKennzahlenFilter === 'ja' ? 'text-emerald-400' : 'text-red-400'}`}>Kennzahlen-Filter</span>
                          </div>
                          <p className="text-sm text-slate-300">{row.kennzahlenFilterReason}</p>
                        </div>
                      )}

                      {/* Positions preview */}
                      {row.positions && Array.isArray(row.positions) && row.positions.length > 0 && (
                        <div>
                          <div className="text-xs text-slate-500 mb-2">Positionen ({row.positions.length})</div>
                          <div className="flex flex-wrap gap-2">
                            {(row.positions as any[]).map((p: any) => (
                              <div key={p.ticker} className="bg-slate-900/60 rounded px-2 py-1 text-xs">
                                <span className="text-teal-400 font-mono">{p.ticker}</span>
                                <span className="text-slate-400 ml-1">{p.weightPct?.toFixed(1)}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Accept / Reject buttons */}
                      <div className="flex gap-2 pt-2 border-t border-slate-700">
                        <span className="text-xs text-slate-500 self-center mr-2">Feedback für Training:</span>
                        <Button
                          size="sm"
                          variant="outline"
                          className={`text-xs ${row.accepted === 'ja' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'border-slate-600 text-slate-400'}`}
                          onClick={() => updateAccepted.mutate({ id: row.id, accepted: 'ja' })}
                          disabled={updateAccepted.isPending}
                        >
                          <CheckCircle className="w-3 h-3 mr-1" /> Übernommen
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className={`text-xs ${row.accepted === 'nein' ? 'bg-red-500/20 border-red-500/40 text-red-400' : 'border-slate-600 text-slate-400'}`}
                          onClick={() => updateAccepted.mutate({ id: row.id, accepted: 'nein' })}
                          disabled={updateAccepted.isPending}
                        >
                          <XCircle className="w-3 h-3 mr-1" /> Abgelehnt
                        </Button>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            ))}
          </div>
        )}

        {/* Pagination */}
        {total > LIMIT && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">{offset + 1}–{Math.min(offset + LIMIT, total)} von {total}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - LIMIT))} className="border-slate-600 text-slate-300">Zurück</Button>
              <Button size="sm" variant="outline" disabled={offset + LIMIT >= total} onClick={() => setOffset(offset + LIMIT)} className="border-slate-600 text-slate-300">Weiter</Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
