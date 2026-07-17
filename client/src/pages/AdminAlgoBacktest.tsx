import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Brain, Play, ChevronDown, ChevronRight, TrendingUp, TrendingDown,
  Minus, AlertTriangle, CheckCircle2, Clock, BarChart3, Zap, BookOpen
} from "lucide-react";

function statusBadge(status: string) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    creating: { label: "Erstellt...", variant: "secondary" },
    active: { label: "Aktiv", variant: "default" },
    evaluating: { label: "Evaluiert...", variant: "secondary" },
    completed: { label: "Abgeschlossen", variant: "outline" },
    error: { label: "Fehler", variant: "destructive" },
  };
  const cfg = map[status] ?? { label: status, variant: "secondary" };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

function perfBadge(perf: string | null | undefined) {
  if (perf == null) return <span className="text-muted-foreground text-sm">—</span>;
  const v = parseFloat(perf);
  if (isNaN(v)) return <span className="text-muted-foreground text-sm">—</span>;
  const color = v > 0 ? "text-emerald-600" : v < 0 ? "text-red-500" : "text-muted-foreground";
  const Icon = v > 0 ? TrendingUp : v < 0 ? TrendingDown : Minus;
  return (
    <span className={`flex items-center gap-1 font-semibold text-sm ${color}`}>
      <Icon className="h-3.5 w-3.5" />
      {v > 0 ? "+" : ""}{v.toFixed(2)}%
    </span>
  );
}

function overfittingBadge(risk: string | null | undefined) {
  if (!risk) return null;
  const map: Record<string, string> = { low: "bg-emerald-100 text-emerald-800", medium: "bg-amber-100 text-amber-800", high: "bg-red-100 text-red-800" };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[risk] ?? "bg-gray-100 text-gray-700"}`}>{risk}</span>;
}

function RunRow({ run, onSelect, selected }: { run: any; onSelect: (id: number) => void; selected: boolean }) {
  const llm = run.llmAnalysis ? (() => { try { return JSON.parse(run.llmAnalysis); } catch { return null; } })() : null;
  return (
    <>
      <TableRow
        className={`cursor-pointer hover:bg-muted/50 ${selected ? "bg-muted/30" : ""}`}
        onClick={() => onSelect(run.id)}
      >
        <TableCell className="font-medium">
          <div className="flex items-center gap-2">
            {selected ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            {run.runMonth}
          </div>
        </TableCell>
        <TableCell>{statusBadge(run.status)}</TableCell>
        <TableCell>{perfBadge(run.avgPerf30dPct)}</TableCell>
        <TableCell>{perfBadge(run.benchmarkPerf30dPct)}</TableCell>
        <TableCell>
          {run.avgPerf30dPct != null && run.benchmarkPerf30dPct != null
            ? perfBadge(String(parseFloat(run.avgPerf30dPct) - parseFloat(run.benchmarkPerf30dPct)))
            : <span className="text-muted-foreground text-sm">—</span>}
        </TableCell>
        <TableCell>
          <span className="text-xs text-muted-foreground">{run.marktRegime ?? "—"}</span>
        </TableCell>
        <TableCell>
          <span className="text-xs font-mono text-muted-foreground">{run.leadingFactor ?? "—"}</span>
        </TableCell>
        <TableCell>
          <span className="text-xs text-muted-foreground">{run.portfolioCount ?? 0}/6</span>
        </TableCell>
      </TableRow>
      {selected && (
        <TableRow>
          <TableCell colSpan={8} className="p-0">
            <RunDetail runId={run.id} llmAnalysis={llm} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function RunDetail({ runId, llmAnalysis }: { runId: number; llmAnalysis: any }) {
  const { data: portfolios, isLoading } = trpc.backtest.algoPortfolios.useQuery({ runId });
  const utils = trpc.useUtils();
  const evaluateMutation = trpc.backtest.algoEvaluateRun.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      utils.backtest.algoRuns.invalidate();
      utils.backtest.algoPortfolios.invalidate({ runId });
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-4 text-sm text-muted-foreground">Lade Portfolios...</div>;

  return (
    <div className="p-4 bg-muted/20 border-t space-y-4">
      {/* Portfolios */}
      <div>
        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <BarChart3 className="h-4 w-4" /> 6 Standard-Portfolios
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {portfolios?.map((p: any) => {
            const positions = (() => { try { return JSON.parse(p.positionsSnapshot); } catch { return []; } })();
            const sectorTilts = (() => { try { return JSON.parse(p.appliedSectorTilts ?? "{}"); } catch { return {}; } })();
            const activeTilts = Object.entries(sectorTilts).filter(([, v]) => v !== 0);
            return (
              <div key={p.id} className="bg-background rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium capitalize">{p.riskProfile} / {p.goal}</span>
                  {p.creationError
                    ? <Badge variant="destructive" className="text-xs">Fehler</Badge>
                    : p.actualPerf30dPct != null
                      ? perfBadge(p.actualPerf30dPct)
                      : <Badge variant="secondary" className="text-xs">Ausstehend</Badge>}
                </div>
                {p.actualPerf30dPct != null && (
                  <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                    <span>Alpha: {p.alpha30dPct != null ? (parseFloat(p.alpha30dPct) > 0 ? "+" : "") + parseFloat(p.alpha30dPct).toFixed(2) + "%" : "—"}</span>
                    <span>Sharpe: {p.actualSharpe30d != null ? parseFloat(p.actualSharpe30d).toFixed(2) : "—"}</span>
                    <span>Vola: {p.actualVolatility30d != null ? parseFloat(p.actualVolatility30d).toFixed(1) + "%" : "—"}</span>
                    <span>MaxDD: {p.actualMaxDrawdown30d != null ? parseFloat(p.actualMaxDrawdown30d).toFixed(1) + "%" : "—"}</span>
                  </div>
                )}
                {activeTilts.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {activeTilts.map(([sector, tilt]) => (
                      <span key={sector} className={`text-xs px-1.5 py-0.5 rounded ${(tilt as number) > 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                        {sector} {(tilt as number) > 0 ? "+" : ""}{tilt as number}
                      </span>
                    ))}
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  {positions.length} Positionen
                  {positions.slice(0, 3).map((pos: any) => (
                    <span key={pos.ticker} className="ml-1 font-mono">{pos.ticker}</span>
                  ))}
                  {positions.length > 3 && <span className="ml-1">+{positions.length - 3}</span>}
                </div>
                {p.creationError && (
                  <p className="text-xs text-red-500">{p.creationError}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* LLM-Analyse */}
      {llmAnalysis && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Brain className="h-4 w-4" /> LLM-Analyse
            <span className={`text-xs px-2 py-0.5 rounded-full ${llmAnalysis.overallConfidence === "hoch" ? "bg-emerald-100 text-emerald-800" : llmAnalysis.overallConfidence === "mittel" ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-700"}`}>
              Konfidenz: {llmAnalysis.overallConfidence}
            </span>
          </h4>
          <p className="text-sm text-muted-foreground bg-background rounded p-3 border">{llmAnalysis.summary}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-emerald-50 rounded p-3 border border-emerald-200">
              <p className="text-xs font-semibold text-emerald-800 mb-1 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Stärken</p>
              <p className="text-xs text-emerald-700">{llmAnalysis.strengths}</p>
            </div>
            <div className="bg-red-50 rounded p-3 border border-red-200">
              <p className="text-xs font-semibold text-red-800 mb-1 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Schwächen</p>
              <p className="text-xs text-red-700">{llmAnalysis.weaknesses}</p>
            </div>
            <div className="bg-blue-50 rounded p-3 border border-blue-200">
              <p className="text-xs font-semibold text-blue-800 mb-1">Sektor-Tilts</p>
              <p className="text-xs text-blue-700">{llmAnalysis.sectorTiltAssessment}</p>
            </div>
            <div className="bg-purple-50 rounded p-3 border border-purple-200">
              <p className="text-xs font-semibold text-purple-800 mb-1">MSCI-Faktor-Tilts</p>
              <p className="text-xs text-purple-700">{llmAnalysis.factorTiltAssessment}</p>
            </div>
          </div>
          {llmAnalysis.tuningRecommendation?.hasRecommendation && (
            <div className="bg-amber-50 rounded p-3 border border-amber-200">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-amber-800 flex items-center gap-1"><Zap className="h-3 w-3" /> Tuning-Empfehlung</p>
                {overfittingBadge(llmAnalysis.tuningRecommendation.overfittingRisk)}
              </div>
              <p className="text-xs text-amber-700 font-mono">{llmAnalysis.tuningRecommendation.parameterToChange}: {llmAnalysis.tuningRecommendation.currentValue} → {llmAnalysis.tuningRecommendation.proposedValue}</p>
              <p className="text-xs text-amber-600 mt-1">{llmAnalysis.tuningRecommendation.rationale}</p>
              <p className="text-xs text-amber-500 mt-0.5">Erwartete Wirkung: {llmAnalysis.tuningRecommendation.expectedImpact}</p>
            </div>
          )}
        </div>
      )}

      {/* Evaluate-Button */}
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="outline"
          onClick={() => evaluateMutation.mutate({ runId })}
          disabled={evaluateMutation.isPending}
        >
          <BarChart3 className="h-3.5 w-3.5 mr-1" />
          {evaluateMutation.isPending ? "Evaluiert..." : "Jetzt evaluieren"}
        </Button>
      </div>
    </div>
  );
}

export default function AdminAlgoBacktest() {
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const { data: runs, isLoading: runsLoading, refetch: refetchRuns } = trpc.backtest.algoRuns.useQuery({ limit: 12 });
  const { data: tuningLog, isLoading: tuningLoading } = trpc.backtest.algoTuningLog.useQuery({ limit: 20 });
  const utils = trpc.useUtils();

  const runNowMutation = trpc.backtest.algoRunNow.useMutation({
    onSuccess: (data) => {
      toast.success(`Run ${data.runId}: ${data.portfoliosCreated}/6 Portfolios erstellt`);
      utils.backtest.algoRuns.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleRun = (id: number) => setSelectedRunId((prev) => (prev === id ? null : id));

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Brain className="h-6 w-6 text-primary" />
              Algo Self-Learning Backtest
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Monatlich werden 6 Standard-Portfolios erstellt und nach 30 Tagen evaluiert.
              Der Algorithmus lernt kontinuierlich — mit Overfitting-Schutz.
            </p>
          </div>
          <Button
            onClick={() => runNowMutation.mutate()}
            disabled={runNowMutation.isPending}
            className="flex items-center gap-2"
          >
            <Play className="h-4 w-4" />
            {runNowMutation.isPending ? "Erstellt..." : "Run Now"}
          </Button>
        </div>

        {/* Info-Kacheln */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{runs?.length ?? 0}</div>
              <div className="text-xs text-muted-foreground">Runs total</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{runs?.filter((r: any) => r.status === "completed").length ?? 0}</div>
              <div className="text-xs text-muted-foreground">Abgeschlossen</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{runs?.filter((r: any) => r.status === "active").length ?? 0}</div>
              <div className="text-xs text-muted-foreground">Aktiv (ausstehend)</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{tuningLog?.length ?? 0}</div>
              <div className="text-xs text-muted-foreground">Tuning-Einträge</div>
            </CardContent>
          </Card>
        </div>

        {/* Lernschleifen-Koordination: Status aller drei Systeme */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
              Lernschleifen-Koordination
            </CardTitle>
            <CardDescription className="text-xs">Alle drei Systeme lernen sequenziell — Algo-Backtest läuft am 3. des Monats, nach ML Trainer (wöchentlich) und Signal-Evaluation (täglich).</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              {/* ML Trainer */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-medium">
                  <span className="w-2 h-2 rounded-full bg-blue-400 inline-block"></span>
                  ML Trainer
                  <span className="text-xs text-muted-foreground font-normal">(wöchentlich)</span>
                </div>
                <div className="text-xs text-muted-foreground pl-4">
                  Trainiert Gradient-Boosting-Modell auf 10 Jahre Kursdaten.
                  Output: <code className="bg-muted px-1 rounded">signalWeights</code> (technische Indikator-Gewichte)
                </div>
                <div className="text-xs pl-4 text-blue-400">↓ fliesst in Signal-Evaluation</div>
              </div>
              {/* Signal-Evaluation */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
                  Signal-Evaluation
                  <span className="text-xs text-muted-foreground font-normal">(täglich)</span>
                </div>
                <div className="text-xs text-muted-foreground pl-4">
                  Misst Signal-Trefferquote pro Regime. Output: <code className="bg-muted px-1 rounded">regimeSignalConfig</code> (Engine-Priors) → <code className="bg-muted px-1 rounded">stocks.signalScore</code>
                </div>
                <div className="text-xs pl-4 text-emerald-400">↓ fliesst in Algo-Backtest</div>
              </div>
              {/* Algo Backtest */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-medium">
                  <span className="w-2 h-2 rounded-full bg-purple-400 inline-block"></span>
                  Algo Self-Learning Backtest
                  <span className="text-xs text-muted-foreground font-normal">(3. des Monats)</span>
                </div>
                <div className="text-xs text-muted-foreground pl-4">
                  Testet 6 Portfolios mit Markt-Hub-Tilts. Output: Sektor-Tilt-Alpha → <code className="bg-muted px-1 rounded">signalWeights</code> (Feedback-Loop Stufe 2)
                </div>
                <div className="text-xs pl-4 text-purple-400">↑ schreibt zurück in ML Trainer</div>
              </div>
            </div>
            {/* Letzte Feedback-Loop-Anpassung */}
            {tuningLog && tuningLog.filter((t: any) => t.parameterChanged === "signalWeights.ytd+momentum").length > 0 && (
              <div className="mt-3 pt-3 border-t border-primary/10 text-xs">
                <span className="text-muted-foreground">Letzte Gewichtsanpassung via Feedback-Loop: </span>
                <span className="text-purple-400 font-mono">
                  {(() => {
                    const last = tuningLog.filter((t: any) => t.parameterChanged === "signalWeights.ytd+momentum")[0];
                    return `${last.oldValue} → ${last.newValue} (${new Date(last.createdAt).toLocaleDateString("de-CH")})`;
                  })()}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Tabs defaultValue="runs">
          <TabsList>
            <TabsTrigger value="runs" className="flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4" /> Runs
            </TabsTrigger>
            <TabsTrigger value="tuning" className="flex items-center gap-1.5">
              <BookOpen className="h-4 w-4" /> Tuning-Log
            </TabsTrigger>
          </TabsList>

          {/* Runs Tab */}
          <TabsContent value="runs">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Backtest-Runs (letzte 12 Monate)</CardTitle>
                <CardDescription>Klicken Sie auf einen Run für Details, Portfolios und LLM-Analyse</CardDescription>
              </CardHeader>
              <CardContent>
                {runsLoading ? (
                  <div className="text-sm text-muted-foreground py-8 text-center">Lade Runs...</div>
                ) : !runs?.length ? (
                  <div className="text-sm text-muted-foreground py-8 text-center">
                    Noch keine Runs vorhanden. Klicken Sie auf "Run Now" um den ersten Backtest zu starten.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Monat</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Ø Perf. 30d</TableHead>
                        <TableHead>Benchmark</TableHead>
                        <TableHead>Alpha</TableHead>
                        <TableHead>Regime</TableHead>
                        <TableHead>MSCI Faktor</TableHead>
                        <TableHead>Portfolios</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {runs.map((run: any) => (
                        <RunRow
                          key={run.id}
                          run={run}
                          onSelect={toggleRun}
                          selected={selectedRunId === run.id}
                        />
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tuning-Log Tab */}
          <TabsContent value="tuning">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Algorithmus-Tuning-Log</CardTitle>
                <CardDescription>
                  Alle LLM-generierten Tuning-Empfehlungen. Max. 1 Änderung/Monat.
                  Overfitting-Risiko "high" wird automatisch abgelehnt.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {tuningLoading ? (
                  <div className="text-sm text-muted-foreground py-8 text-center">Lade Tuning-Log...</div>
                ) : !tuningLog?.length ? (
                  <div className="text-sm text-muted-foreground py-8 text-center">
                    Noch keine Tuning-Einträge. Der erste Eintrag erscheint nach dem ersten abgeschlossenen Run.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Datum</TableHead>
                        <TableHead>Parameter</TableHead>
                        <TableHead>Änderung</TableHead>
                        <TableHead>Overfitting</TableHead>
                        <TableHead>Quelle</TableHead>
                        <TableHead>Begründung</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tuningLog.map((entry: any) => (
                        <TableRow key={entry.id}>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(entry.createdAt).toLocaleDateString("de-CH")}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{entry.parameterChanged}</TableCell>
                          <TableCell className="text-xs">
                            <span className="text-muted-foreground">{entry.oldValue}</span>
                            <span className="mx-1 text-muted-foreground">→</span>
                            <span className="font-semibold text-primary">{entry.newValue}</span>
                          </TableCell>
                          <TableCell>{overfittingBadge(entry.overfittingRisk)}</TableCell>
                          <TableCell>
                            <Badge variant={entry.source === "llm_auto" ? "secondary" : "outline"} className="text-xs">
                              {entry.source === "llm_auto" ? "LLM Auto" : "Admin"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-xs truncate" title={entry.rationale}>
                            {entry.rationale}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Overfitting-Schutz Info */}
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Overfitting-Schutz aktiv</p>
                <p className="text-xs text-amber-700 mt-1">
                  Max. 1 Parameteränderung pro Monat · Änderungen nur bei Performance-Delta &gt;1.5% über 2+ Monate ·
                  Overfitting-Risiko "high" wird automatisch abgelehnt · Alle Änderungen werden im Tuning-Log dokumentiert ·
                  Empfehlungen werden nur dokumentiert, nicht automatisch umgesetzt — der Admin entscheidet.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
