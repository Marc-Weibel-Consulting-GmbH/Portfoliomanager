import DashboardLayout from "@/components/DashboardLayout";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, CheckCircle2, Clock3, ExternalLink, Eye, FileSearch, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";

const statusLabel: Record<string, string> = {
  pending: "Offen",
  reviewed: "Geprüft",
  rejected: "Verworfen",
};

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    reviewed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    rejected: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  };
  return <Badge variant="outline" className={styles[status] ?? "border-border text-muted-foreground"}>{statusLabel[status] ?? status}</Badge>;
}

function formatDate(value: Date | string | null) {
  if (!value) return "Zeitstempel fehlt";
  return new Date(value).toLocaleString("de-CH", { dateStyle: "medium", timeStyle: "short" });
}

const roleLabel: Record<string, string> = {
  kapitalinvestor: "Kapitalinvestor",
  infrastrukturzulieferer: "Infrastrukturzulieferer",
  energie_infrastruktur: "Energie-Infrastruktur",
  finanzierung: "Finanzierung",
  nicht_zugeordnet: "Nicht zugeordnet",
};

const monitoringLabel: Record<string, string> = {
  beobachten: "Beobachten",
  daten_pruefen: "Daten prüfen",
  nicht_relevant: "Nicht relevant",
};

function MonitoringBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    beobachten: "border-cyan-500/30 bg-cyan-500/10 text-cyan-200",
    daten_pruefen: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    nicht_relevant: "border-border bg-muted/40 text-muted-foreground",
  };
  return <Badge variant="outline" className={styles[status] ?? "border-border text-muted-foreground"}>{monitoringLabel[status] ?? status}</Badge>;
}

function formatFreshness(status: string) {
  if (status === "aktuell") return "aktuell";
  if (status === "veraltet") return "veraltet";
  return "fehlt";
}

export default function AdminResearchDesk() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.researchDesk.overview.useQuery({ limit: 100 });
  const { data: capitalCycle, isLoading: isCapitalCycleLoading, error: capitalCycleError } = trpc.researchDesk.capitalCycleWatchlistOverview.useQuery();
  const runNow = trpc.researchDesk.runShadowNow.useMutation({
    onSuccess: async (result) => {
      await Promise.all([utils.researchDesk.overview.invalidate(), utils.researchDesk.capitalCycleWatchlistOverview.invalidate()]);
      toast.success(result.status === "already_completed" ? "Heutiger Shadow-Run liegt bereits vor." : `${result.evidenceObserved} Evidenzen beobachtet.`, {
        description: `${result.tickersFetched}/${result.tickersRequested} Quellen abgerufen · keine Score- oder Handelswirkung`,
      });
    },
    onError: (error) => toast.error("Shadow-Run fehlgeschlagen", { description: error.message }),
  });
  const setCheckerStatus = trpc.researchDesk.setCheckerStatus.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.researchDesk.overview.invalidate(), utils.researchDesk.capitalCycleWatchlistOverview.invalidate()]);
    },
    onError: (error) => toast.error("Triage konnte nicht gespeichert werden", { description: error.message }),
  });

  const runs = data?.runs ?? [];
  const evidence = data?.evidence ?? [];
  const latestRun = runs[0];
  const pending = evidence.filter((entry) => entry.checkerStatus === "pending").length;
  const incomplete = evidence.filter((entry) => entry.completenessStatus !== "complete").length;
  const assessments = capitalCycle?.assessments ?? [];
  const relevantAssessments = assessments.filter((item) => item.role !== "nicht_zugeordnet");
  const capitalCycleMetrics = capitalCycle?.monitoring.metrics ?? [];
  const latestMetricAt = capitalCycleMetrics.reduce<Date | null>((latest, metric) => {
    const candidate = new Date(metric.fetchedAt);
    return !latest || candidate > latest ? candidate : latest;
  }, null);

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <Breadcrumb items={[{ label: "Admin", href: "/admin" }, { label: "Research Desk" }]} />
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-cyan-300 text-sm font-medium"><Eye className="h-4 w-4" /> Beobachtender Pilot</div>
            <h1 className="mt-1 text-2xl font-bold text-foreground">Research Desk Lite</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">US-SEC-Primärevidenz für MSFT, GOOGL, META, AMZN und ORCL. Der Pilot schreibt nur nachvollziehbare Evidenz; Scores, Empfehlungen und Handel bleiben unverändert.</p>
          </div>
          <Button onClick={() => runNow.mutate()} disabled={runNow.isPending} className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">
            {runNow.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSearch className="mr-2 h-4 w-4" />}
            Shadow-Run ausführen
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card><CardHeader className="pb-2"><CardDescription>Modus</CardDescription><CardTitle className="text-lg flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-cyan-300" /> Shadow only</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">Keine Entscheidungswirkung</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardDescription>Letzter Lauf</CardDescription><CardTitle className="text-lg">{latestRun ? formatDate(latestRun.startedAt) : "Noch keiner"}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">{latestRun ? `${latestRun.tickersFetched}/${latestRun.tickersRequested} Quellen` : "Manuellen Lauf starten"}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardDescription>Offene Checker</CardDescription><CardTitle className="text-lg text-amber-300">{pending}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">Evidenzen warten auf Prüfung</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardDescription>Unvollständig</CardDescription><CardTitle className="text-lg text-rose-300">{incomplete}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">Automatisch verworfen, nicht ergänzt</CardContent></Card>
        </div>

        <Card className="border-cyan-500/20">
          <CardHeader className="space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2"><Eye className="h-5 w-5 text-cyan-300" /> Watchlist × AI Capital Cycle</CardTitle>
                <CardDescription className="mt-1 max-w-4xl">Beobachtende Research-Unterstützung für kuratierte Titel. Globale Monitoringmetriken und ticker-spezifische SEC-Shadow-Evidenz werden sichtbar nebeneinandergestellt; daraus folgt keine automatische Anlageentscheidung.</CardDescription>
              </div>
              <Badge variant="outline" className="w-fit border-cyan-500/30 bg-cyan-500/10 text-cyan-200">Impact: none · Shadow only</Badge>
            </div>
            <div className="flex items-start gap-2 rounded-md border border-cyan-500/20 bg-cyan-500/5 p-3 text-xs text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" /><p><strong className="text-foreground">Keine automatische Score-, Signal-, Alert- oder Handelswirkung.</strong> «Manuell prüfen» ist ein Research-Hinweis, keine Kauf-, Verkaufs- oder Umschichtungsanweisung. Die einzelnen Quellen bleiben getrennt ausgewiesen.</p></div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isCapitalCycleLoading ? <div className="py-10 text-center text-muted-foreground"><Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin" />Capital-Cycle-Abgleich wird geladen …</div> : capitalCycleError ? <div className="flex items-start gap-2 rounded-md border border-rose-500/25 bg-rose-500/5 p-4 text-sm text-muted-foreground"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />Der Abgleich konnte nicht geladen werden: {capitalCycleError.message}. Es wurde keine Handlung abgeleitet.</div> : <>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-md bg-muted/35 p-3"><div className="text-xs uppercase tracking-wide text-muted-foreground">Monitoring-Cache</div><div className="mt-1 font-semibold text-foreground">{capitalCycle?.monitoring.cacheStatus === "vorhanden" ? "Cache aktualisiert" : "Datenlücke"}</div><div className="mt-1 text-xs text-muted-foreground">Cache-Abruf: {latestMetricAt ? formatDate(latestMetricAt) : "nicht vorhanden"}</div></div>
                <div className="rounded-md bg-muted/35 p-3"><div className="text-xs uppercase tracking-wide text-muted-foreground">Zuordenbare Titel</div><div className="mt-1 font-semibold text-foreground">{capitalCycle?.summary.relevant ?? 0} von {capitalCycle?.summary.total ?? 0}</div><div className="mt-1 text-xs text-muted-foreground">Vordefinierte Rollenkarte, keine Sektor-Inferenz</div></div>
                <div className="rounded-md bg-muted/35 p-3"><div className="text-xs uppercase tracking-wide text-muted-foreground">Manuelle Prüfung</div><div className="mt-1 font-semibold text-foreground">{capitalCycle?.summary.manualReview ?? 0} Hinweise · {capitalCycle?.summary.dataCheck ?? 0} Datenprüfungen</div><div className="mt-1 text-xs text-muted-foreground">Keine davon löst eine Systemaktion aus</div></div>
              </div>

              <div className="rounded-md border border-border/70 p-3 text-xs text-muted-foreground"><strong className="text-foreground">Provenienz:</strong> {capitalCycle?.monitoring.disclosure} Die Frischegrenze misst nur den Cache-Abruf; der Quellenzeitraum bleibt Teil der ausgeschriebenen Quelle.<details className="mt-2"><summary className="cursor-pointer text-cyan-300">{capitalCycleMetrics.length} globale Monitoringquelle{capitalCycleMetrics.length === 1 ? "" : "n"} anzeigen</summary><ul className="mt-2 space-y-1"><li>Cache-Frischegrenze: 36 Stunden für erforderliche Monitoringmetriken.</li>{capitalCycleMetrics.map((metric) => <li key={metric.metricKey}><span className="font-mono text-foreground">{metric.metricKey}</span>: {metric.displayValue} · {metric.source} · Cache abgerufen {formatDate(metric.fetchedAt)}</li>)}</ul></details></div>

              {relevantAssessments.length === 0 ? <div className="py-8 text-center text-sm text-muted-foreground">Keine vorab zum KI-Kapitalzyklus zugeordneten Watchlist-Titel verfügbar. Nicht zugeordnete Titel bleiben bewusst ausserhalb dieser Beobachtungsansicht.</div> : <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] text-sm">
                  <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-3 py-3">Titel / Rolle</th><th className="px-3 py-3">Monitoring</th><th className="px-3 py-3">Evidenz & Datenlage</th><th className="px-3 py-3">Manueller Hinweis</th><th className="px-3 py-3">Quellen</th></tr></thead>
                  <tbody>{relevantAssessments.map((item) => <tr key={item.watchlistStockId} className="border-b border-border/60 align-top">
                    <td className="px-3 py-4"><div className="font-semibold text-foreground">{item.ticker} · {item.companyName}</div><div className="mt-1 text-xs text-muted-foreground">{roleLabel[item.role] ?? item.role} · {item.listType ?? "kuratiert"}</div></td>
                    <td className="px-3 py-4"><MonitoringBadge status={item.monitoringStatus} /><div className="mt-2 max-w-xs text-xs text-muted-foreground">{item.explanation}</div></td>
                    <td className="px-3 py-4"><div className="text-xs text-foreground">Cache (global): <span className={item.sourceFreshness.status === "aktuell" ? "text-emerald-300" : "text-amber-300"}>{formatFreshness(item.sourceFreshness.status)}</span></div><div className="mt-1 text-xs text-muted-foreground">Letzte Metrik: {formatDate(item.sourceFreshness.latestMetricFetchedAt)} · SEC: {item.secEvidence.status.replaceAll("_", " ")} ({item.secEvidence.count})</div><div className="mt-1 text-xs text-muted-foreground">Watchlist-Daten: {item.dataQuality.status}</div></td>
                    <td className="px-3 py-4">{item.manualAction === "manuell_pruefen" ? <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-300">Manuell prüfen</Badge> : <Badge variant="outline" className="border-border text-muted-foreground">Keine Handlung</Badge>}<div className="mt-1 text-xs text-muted-foreground">Impact: none</div></td>
                    <td className="px-3 py-4"><details><summary className="cursor-pointer text-xs text-cyan-300">{item.sourceRefs.length} Quelle{item.sourceRefs.length === 1 ? "" : "n"}</summary><ul className="mt-2 max-w-xs space-y-1 break-words text-xs text-muted-foreground">{item.sourceRefs.length === 0 ? <li>Keine Quelle im aktuellen Datensatz</li> : item.sourceRefs.map((source) => <li key={source}>{source.startsWith("http") ? <a href={source} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cyan-300 hover:text-cyan-200"><ExternalLink className="h-3 w-3" />SEC-Original</a> : source}</li>)}</ul></details></td>
                  </tr>)}</tbody>
                </table>
              </div>}
            </>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Maker → Checker Evidenz</CardTitle>
            <CardDescription>Jede Zeile bindet Filing, Zeitstempel, Rohdatenhash und Quellenversion. Eine menschliche Prüfung ändert ausschliesslich den Checker-Status.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <div className="py-12 text-center text-muted-foreground"><Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin" />Evidenz wird geladen …</div> : evidence.length === 0 ? <div className="py-12 text-center text-muted-foreground">Noch keine Evidenz. Der tägliche Shadow-Run oder der Button oben erfasst nur aktuelle SEC-Filings.</div> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] text-sm">
                  <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr><th className="px-3 py-3">Ereignis</th><th className="px-3 py-3">Quelle / Zeit</th><th className="px-3 py-3">Qualität</th><th className="px-3 py-3">Checker</th><th className="px-3 py-3 text-right">Aktion</th></tr>
                  </thead>
                  <tbody>
                    {evidence.map((entry) => (
                      <tr key={entry.id} className="border-b border-border/60 align-top">
                        <td className="px-3 py-4"><div className="font-semibold text-foreground">{entry.ticker} · {entry.formType}</div><div className="mt-1 text-xs text-muted-foreground">{entry.eventType} · CIK {entry.cik}</div></td>
                        <td className="px-3 py-4"><a className="inline-flex items-center gap-1 text-cyan-300 hover:text-cyan-200" href={entry.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /> SEC-Original</a><div className="mt-1 text-xs text-muted-foreground">{formatDate(entry.sourcePublishedAt)}</div><div className="mt-1 font-mono text-[10px] text-muted-foreground">{entry.rawHash.slice(0, 12)}… · {entry.sourceVersion}</div></td>
                        <td className="px-3 py-4">{entry.completenessStatus === "complete" ? <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">vollständig</Badge> : <><Badge variant="outline" className="border-rose-500/30 bg-rose-500/10 text-rose-300">unvollständig</Badge><div className="mt-1 max-w-56 text-xs text-muted-foreground">{Array.isArray(entry.validationReasons) ? entry.validationReasons.join(", ") : "Prüfung fehlgeschlagen"}</div></>}</td>
                        <td className="px-3 py-4"><StatusBadge status={entry.checkerStatus} /><div className="mt-1 text-xs text-muted-foreground">Impact: {entry.decisionImpact}</div></td>
                        <td className="px-3 py-4 text-right"><div className="inline-flex gap-2">{entry.checkerStatus === "pending" && <><Button variant="outline" size="sm" disabled={setCheckerStatus.isPending} onClick={() => setCheckerStatus.mutate({ evidenceId: entry.id, status: "reviewed" })}><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Prüfen</Button><Button variant="ghost" size="sm" disabled={setCheckerStatus.isPending} onClick={() => setCheckerStatus.mutate({ evidenceId: entry.id, status: "rejected" })}><XCircle className="mr-1 h-3.5 w-3.5" /> Verwerfen</Button></>}</div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex items-start gap-3 rounded-md border border-cyan-500/20 bg-cyan-500/5 p-4 text-sm text-muted-foreground"><Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" /><p><strong className="text-foreground">OOS-Gate bleibt geschlossen.</strong> Erst nach einem sechs­wöchigen Shadow-Run mit vollständigen Punkt-in-Zeit-Daten kann eine Hypothese als Research-Issue in den bestehenden Backtestprozess übergeben werden. Diese Ansicht aktiviert selbst keine Strategie.</p></div>
      </div>
    </DashboardLayout>
  );
}
