import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Grid3x3, PieChart, Key, BarChart3, Eye, BrainCircuit, Activity, Wallet, Brain, RefreshCw, CheckCircle2, XCircle, TrendingUp, FlaskConical, AlertTriangle, Clock, Database, Upload, Zap, ScrollText, Settings, Calculator, SlidersHorizontal, Camera, Bell, Search, MessageSquare, Gauge, Globe, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { adminGroups, type AdminKachel } from "@/lib/adminNavigation";

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const [sectorStatus, setSectorStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [metricsSnapshotStatus, setMetricsSnapshotStatus] = useState<string | null>(null);
  const [historicalPricesStatus, setHistoricalPricesStatus] = useState<string | null>(null);
  const [deepDiveCacheStatus, setDeepDiveCacheStatus] = useState<string | null>(null);
  const [sleeveBackfillStatus, setSleeveBackfillStatus] = useState<string | null>(null);
  const [seltenOffen, setSeltenOffen] = useState(false);
  const [rekoVon, setRekoVon] = useState("2016-01-01");
  const [rekoBis, setRekoBis] = useState(new Date().toISOString().slice(0, 10));

  // Punkt-in-Zeit-Rekonstruktion. Die Endpunkte gibt es seit #253 — eine
  // Bedienung dafuer fehlte, weshalb der Lauf nur ueber die API ausloesbar war
  // und sein Fortschritt nirgends sichtbar.
  const rekoStatus = trpc.admin.getRekonstruktionStatus.useQuery(undefined, {
    refetchInterval: (query) => (query.state.data?.aktiv ? 5_000 : false),
  });
  const starteReko = trpc.admin.starteRekonstruktion.useMutation({
    onSuccess: (d) => {
      if (d.gestartet) toast.success("Rekonstruktion gestartet", { description: "Der Fortschritt erscheint unten." });
      else toast.info(d.message);
      rekoStatus.refetch();
    },
    onError: (err) => toast.error("Fehler", { description: err.message }),
  });

  // Der eine Knopf. Der Lauf selbst dauert Minuten und läuft auf dem Server;
  // hier wird nur der Fortschritt geholt — und nur solange er läuft.
  const datenLauf = trpc.admin.getDatenLaufStatus.useQuery(undefined, {
    refetchInterval: (query) => (query.state.data?.aktiv ? 3_000 : false),
  });
  const datenAktualisieren = trpc.admin.datenAktualisieren.useMutation({
    onSuccess: (d) => {
      if (d.gestartet) toast.success("Aktualisierung gestartet", { description: "Der Fortschritt erscheint unten." });
      else toast.info(d.message);
      datenLauf.refetch();
    },
    onError: (err) => toast.error("Fehler", { description: err.message }),
  });
  const importHistoricalPrices = trpc.admin.importHistoricalPrices.useMutation({
    onSuccess: (data: any) => {
      const msg = data?.message ?? (data?.success ? 'Import gestartet — läuft im Hintergrund' : 'Fehler beim Import');
      setHistoricalPricesStatus(msg);
      if (data?.success) {
        toast.success('Kursdaten-Import gestartet', { description: msg });
      } else {
        toast.error('Fehler beim Kursdaten-Import', { description: msg });
      }
    },
    onError: (err: any) => {
      setHistoricalPricesStatus('Fehler: ' + err.message);
      toast.error('Fehler', { description: err.message });
    },
  });
  const clearDeepDiveCache = trpc.copilot.clearDeepDiveCache.useMutation({
    onSuccess: (data) => {
      const msg = `${data.cleared} Einträge geleert`;
      setDeepDiveCacheStatus(msg);
      toast.success('Deep-Dive-Cache geleert', { description: msg });
    },
    onError: (err) => {
      setDeepDiveCacheStatus('Fehler: ' + err.message);
      toast.error('Fehler', { description: err.message });
    },
  });
  const backfillSleeveEtfs = trpc.admin.backfillSleeveEtfs.useMutation({
    onSuccess: (data) => {
      const ok = data.results.filter((r: any) => r.success && r.pricesImported > 0);
      const fail = data.results.filter((r: any) => !r.success || r.pricesImported === 0);
      const okStr = ok.map((r: any) => `${r.ticker}(${r.pricesImported})`).join(', ');
      const failStr = fail.map((r: any) => r.ticker).join(', ');
      const parts = [`${data.totalPricesImported} Kurse importiert`];
      if (okStr) parts.push(`✅ ${okStr}`);
      if (failStr) parts.push(`❌ Keine Daten: ${failStr}`);
      const msg = parts.join(' | ');
      setSleeveBackfillStatus(msg);
      if (fail.length === 0) {
        toast.success('Sleeve-ETF-Backfill abgeschlossen', { description: msg });
      } else {
        toast.warning('Sleeve-ETF-Backfill teilweise erfolgreich', { description: msg });
      }
    },
    onError: (err: any) => {
      setSleeveBackfillStatus('Fehler: ' + err.message);
      toast.error('Sleeve-ETF-Backfill fehlgeschlagen', { description: err.message });
    },
  });
  const refreshSectors = trpc.admin.refreshSectors.useMutation({
    onSuccess: (data) => {
      setSectorStatus({ success: data.success, message: data.message });
      if (data.success) {
        toast.success('Sektoren aktualisiert', { description: data.message });
      } else {
        toast.error('Fehler', { description: data.message });
      }
    },
    onError: (err) => {
      setSectorStatus({ success: false, message: err.message });
      toast.error('Fehler', { description: err.message });
    },
  });
  const triggerMetricsSnapshot = trpc.admin.triggerPortfolioMetricsSnapshot.useMutation({
    onSuccess: (data: any) => {
      const msg = data?.message ?? (data?.saved !== undefined
        ? `${data.saved} Snapshots gespeichert (${data.skipped} übersprungen)`
        : 'Gestartet — läuft im Hintergrund');
      setMetricsSnapshotStatus(msg);
      toast.success('Portfolio-Metriken Backfill gestartet', { description: msg });
    },
    onError: (err: any) => {
      setMetricsSnapshotStatus('Fehler: ' + err.message);
      toast.error('Fehler beim Backfill', { description: err.message });
    },
  });
  const backfillStatus = trpc.admin.getBackfillStatus.useQuery(undefined, { refetchInterval: 10_000 });
  const clearPermanentlyFailed = trpc.admin.clearPermanentlyFailedBackfills.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      backfillStatus.refetch();
    },
    onError: (err) => toast.error('Fehler', { description: err.message }),
  });


  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Zentrale Verwaltung der Platform
          </p>
        </div>

        {/* Daten aktualisieren — ein Knopf für den Alltag, der Rest zugeklappt.
            Die drei Schritte dahinter laufen serverseitig NACHEINANDER: Der
            Score-Lauf braucht den frischen Cache, sonst rechnet er auf alten
            Kennzahlen. Deshalb ein Aufruf und nicht drei Knöpfe. */}
        <div className="p-4 bg-muted/30 rounded-lg border space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Daten aktualisieren</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Fundamentaldaten, Scores und Signale in einem Durchgang — dauert einige Minuten
              </p>
            </div>
            <Button
              onClick={() => datenAktualisieren.mutate()}
              disabled={datenAktualisieren.isPending || datenLauf.data?.aktiv}
              className="gap-2"
            >
              {datenLauf.data?.aktiv
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <RefreshCw className="h-4 w-4" />}
              {datenLauf.data?.aktiv ? "Läuft..." : "Daten aktualisieren"}
            </Button>
          </div>

          {/* Fortschritt — erscheint erst, wenn einmal gestartet wurde. */}
          {datenLauf.data?.schritte && datenLauf.data.schritte.length > 0 && (
            <div className="space-y-1.5 border-t pt-3">
              {datenLauf.data.schritte.map((schritt) => (
                <div key={schritt.name} className="flex items-start gap-2 text-xs">
                  {schritt.status === "fertig" && <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />}
                  {schritt.status === "fehler" && <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />}
                  {schritt.status === "laeuft" && <Loader2 className="h-3.5 w-3.5 text-blue-400 animate-spin shrink-0 mt-0.5" />}
                  {schritt.status === "offen" && <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />}
                  <div className="min-w-0">
                    <span className={schritt.status === "offen" ? "text-muted-foreground" : ""}>{schritt.name}</span>
                    {schritt.text && <span className="text-muted-foreground"> — {schritt.text}</span>}
                  </div>
                </div>
              ))}
              {!datenLauf.data.aktiv && datenLauf.data.beendetAm && (
                <p className="text-[11px] text-muted-foreground pt-1">
                  Beendet {new Date(datenLauf.data.beendetAm).toLocaleTimeString("de-CH")}
                </p>
              )}
            </div>
          )}

          {/* Selten nötig — Einzelaktionen, die nicht in den Alltagslauf gehören:
              entweder teuer (Jahres-Backfills) oder nur nach einer bestimmten
              Änderung sinnvoll (Sektoren, Sleeve-ETFs). */}
          <div className="border-t pt-3">
            <button
              type="button"
              onClick={() => setSeltenOffen((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {seltenOffen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              Selten nötig
            </button>

            {seltenOffen && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSectorStatus(null);
                    refreshSectors.mutate();
                  }}
                  disabled={refreshSectors.isPending}
                  className="gap-2 border-amber-500/50 text-amber-400 hover:text-amber-300"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshSectors.isPending ? 'animate-spin' : ''}`} />
                  {refreshSectors.isPending ? 'Aktualisiert...' : 'Sektoren aktualisieren'}
                </Button>
                {sectorStatus && (
                  <span className={`text-xs ${sectorStatus.success ? 'text-green-500' : 'text-red-500'} max-w-xs truncate`}>
                    {sectorStatus.message}
                  </span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setHistoricalPricesStatus(null);
                    // D6: rollierendes 1-Jahres-Fenster statt hartkodiertem Startdatum
                    const today = new Date().toISOString().split('T')[0];
                    const oneYearAgo = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString().split('T')[0];
                    importHistoricalPrices.mutate({ fromDate: oneYearAgo, toDate: today, forceRefresh: true });
                  }}
                  disabled={importHistoricalPrices.isPending}
                  className="gap-2 border-emerald-500/50 text-emerald-400 hover:text-emerald-300"
                >
                  <TrendingUp className={`h-4 w-4 ${importHistoricalPrices.isPending ? 'animate-spin' : ''}`} />
                  {importHistoricalPrices.isPending ? 'Importiert...' : 'Kursdaten neu laden (1 Jahr)'}
                </Button>
                {historicalPricesStatus && (
                  <span className="text-xs text-emerald-400 max-w-xs">{historicalPricesStatus}</span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setMetricsSnapshotStatus(null);
                    triggerMetricsSnapshot.mutate({ backfill: true });
                  }}
                  disabled={triggerMetricsSnapshot.isPending}
                  className="gap-2 border-blue-500/50 text-blue-400 hover:text-blue-300"
                >
                  <RefreshCw className={`h-4 w-4 ${triggerMetricsSnapshot.isPending ? 'animate-spin' : ''}`} />
                  {triggerMetricsSnapshot.isPending ? 'Starte...' : 'Portfolio-Metriken Backfill (1 Jahr)'}
                </Button>
                {metricsSnapshotStatus && (
                  <span className="text-xs text-blue-400 max-w-xs">{metricsSnapshotStatus}</span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSleeveBackfillStatus(null);
                    backfillSleeveEtfs.mutate();
                  }}
                  disabled={backfillSleeveEtfs.isPending}
                  className="gap-2 border-yellow-500/50 text-yellow-400 hover:text-yellow-300"
                >
                  <Database className={`h-4 w-4 ${backfillSleeveEtfs.isPending ? 'animate-spin' : ''}`} />
                  {backfillSleeveEtfs.isPending ? 'Lädt...' : 'Sleeve-ETF-Kurse laden'}
                </Button>
                {sleeveBackfillStatus && (
                  <span className="text-xs text-yellow-400 max-w-xs">{sleeveBackfillStatus}</span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDeepDiveCacheStatus(null);
                    clearDeepDiveCache.mutate();
                  }}
                  disabled={clearDeepDiveCache.isPending}
                  className="gap-2 border-cyan-500/50 text-cyan-400 hover:text-cyan-300"
                >
                  <RefreshCw className={`h-4 w-4 ${clearDeepDiveCache.isPending ? 'animate-spin' : ''}`} />
                  {clearDeepDiveCache.isPending ? 'Lösche...' : 'Deep-Dive-Cache leeren'}
                </Button>
                {deepDiveCacheStatus && (
                  <span className="text-xs text-cyan-400 max-w-xs">{deepDiveCacheStatus}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Score-Historie rekonstruieren — die Datengrundlage fuer das
            Backtesting der Score-Gewichte. Laeuft lange und im Hintergrund;
            der Zustand liegt im Speicher, ein Deploy bricht ihn ab. */}
        <div className="p-4 bg-muted/30 rounded-lg border space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Score-Historie rekonstruieren</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Rechnet Qualität und Bewertung für jeden Monatsstichtag mit den Daten von damals —
                Grundlage für das Backtesting der Gewichte. Dauert je nach Zeitraum 10–20 Minuten.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date" value={rekoVon} onChange={(e) => setRekoVon(e.target.value)}
                className="h-9 rounded-md border bg-background px-2 text-xs"
                aria-label="Von"
              />
              <span className="text-xs text-muted-foreground">bis</span>
              <input
                type="date" value={rekoBis} onChange={(e) => setRekoBis(e.target.value)}
                className="h-9 rounded-md border bg-background px-2 text-xs"
                aria-label="Bis"
              />
              <Button
                onClick={() => starteReko.mutate({ von: rekoVon, bis: rekoBis })}
                // Bei einem haengenden Lauf NICHT sperren: Sonst ist der Knopf
                // fuer immer tot, weil das «aktiv»-Flag im Speicher steht und
                // niemand es zuruecksetzen kann.
                disabled={starteReko.isPending || (rekoStatus.data?.aktiv && !rekoStatus.data?.haengt)}
                variant="outline"
                className="gap-2"
              >
                {rekoStatus.data?.aktiv
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Database className="h-4 w-4" />}
                {rekoStatus.data?.haengt
                  ? "Neu starten"
                  : rekoStatus.data?.aktiv
                  ? "Läuft..."
                  : rekoStatus.data?.nochOffen
                    ? `Weiter (${rekoStatus.data.nochOffen} offen)`
                    : "Rekonstruieren"}
              </Button>
            </div>
          </div>

          {/* Umfang: was tatsaechlich in der Datenbank steht. Ueberlebt einen
              Neustart, im Gegensatz zu den Meldungen darunter. */}
          {rekoStatus.data?.umfang && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 border-t pt-3 text-sm">
              <div>
                <span className="text-muted-foreground text-xs">Zeilen</span>
                <div className="font-bold">{rekoStatus.data.umfang.zeilen.toLocaleString("de-CH")}</div>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Titel</span>
                <div className="font-bold">{rekoStatus.data.umfang.titel}</div>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Zeitraum</span>
                <div className="font-bold text-xs">
                  {rekoStatus.data.umfang.von && rekoStatus.data.umfang.bis
                    ? `${rekoStatus.data.umfang.von} – ${rekoStatus.data.umfang.bis}`
                    : "—"}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Ø Monate je Titel</span>
                <div className="font-bold">
                  {rekoStatus.data.umfang.titel > 0
                    ? Math.round(rekoStatus.data.umfang.zeilen / rekoStatus.data.umfang.titel)
                    : "—"}
                </div>
              </div>
            </div>
          )}

          {/* Der dritte Score. Zeilen aus der ersten Fassung tragen nur Qualität
              und Bewertung — für die Optimierung der Signal-Gewichte reicht das
              nicht. Ohne diese Zeile sähe eine unbrauchbare Reihe vollständig aus. */}
          {rekoStatus.data?.umfang && rekoStatus.data.umfang.titel > 0 && (
            <p className={`text-xs ${
              rekoStatus.data.umfang.titelMitRegime < rekoStatus.data.umfang.titel
                ? "text-amber-400" : "text-muted-foreground"}`}>
              Timing &amp; Regime: {rekoStatus.data.umfang.titelMitRegime} von{" "}
              {rekoStatus.data.umfang.titel} Titeln
              {rekoStatus.data.umfang.titelMitRegime < rekoStatus.data.umfang.titel
                ? " — die übrigen stammen aus der ersten Fassung und werden beim nächsten Lauf nachgeholt."
                : ` (${rekoStatus.data.umfang.zeilenMitTiming.toLocaleString("de-CH")} Zeilen mit Timing-Score).`}
            </p>
          )}

          {/* PEG-Aufzeichnung: waechst nur nach vorn, siehe #255. */}
          {rekoStatus.data?.vorwaerts && rekoStatus.data.vorwaerts.zeilen > 0 && (
            <p className="text-xs text-muted-foreground">
              PEG-Aufzeichnung: {rekoStatus.data.vorwaerts.tageMitPeg} Tage erfasst
              {rekoStatus.data.vorwaerts.von ? ` (seit ${rekoStatus.data.vorwaerts.von})` : ""} —
              der geschätzte Teil der Bewertung wird erst backtestbar, wenn diese Reihe ein bis zwei
              Jahre umfasst.
            </p>
          )}

          {rekoStatus.data?.meldungen && rekoStatus.data.meldungen.length > 0 && (
            <div className="bg-black/50 rounded p-3 max-h-40 overflow-y-auto font-mono text-xs text-green-400 border-t">
              {rekoStatus.data.meldungen.map((m, i) => (
                <div key={i} className={m.includes("ohne Reihe") ? "text-amber-400" : ""}>{m}</div>
              ))}
            </div>
          )}
          {/* Der Lauf arbeitet in Häppchen. Bleibt etwas offen, muss der Knopf
              erneut gedrückt werden — ein einzelner langer Lauf stirbt in
              dieser Umgebung, bevor er fertig wird. */}
          {!rekoStatus.data?.aktiv && (rekoStatus.data?.nochOffen ?? 0) > 0 && (
            <p className="text-xs text-amber-400">
              Noch {rekoStatus.data!.nochOffen} Titel offen — nochmals starten. Der Lauf arbeitet in
              Häppchen zu 25 Titeln, damit er zuverlässig fertig wird.
            </p>
          )}
          {rekoStatus.data?.zuletzt && rekoStatus.data?.aktiv && (
            <p className="text-[11px] text-muted-foreground">Zuletzt begonnen: {rekoStatus.data.zuletzt}</p>
          )}
          {rekoStatus.data?.haengt && (
            <p className="text-xs text-amber-400">
              Der Lauf meldet sich seit {Math.round((rekoStatus.data.laeuftSeitSekunden ?? 0) / 60)} Minuten
              nicht mehr. Ein Häppchen braucht unter zwei — der Knopf ist wieder freigegeben.
            </p>
          )}
          {!rekoStatus.data?.aktiv && rekoStatus.data?.beendetAm && (
            <p className="text-[11px] text-muted-foreground">
              Beendet {new Date(rekoStatus.data.beendetAm).toLocaleString("de-CH")}
            </p>
          )}
        </div>

        {/* Backfill-Status */}
        <div className="p-4 bg-muted/30 rounded-lg border space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium flex items-center gap-2"><Database className="h-4 w-4 text-emerald-400" />Backfill-Status</p>
              <p className="text-xs text-muted-foreground mt-0.5">Kurshistorie-Nachlade-Status (aktualisiert alle 10s)</p>
            </div>
            {backfillStatus.data?.pendingCount != null && backfillStatus.data.pendingCount > 0 && (
              <Badge variant="outline" className="text-amber-400 border-amber-500/50 gap-1">
                <Clock className="h-3 w-3" />{backfillStatus.data.pendingCount} ausstehend
              </Badge>
            )}
          </div>

          {/* Pending */}
          {backfillStatus.data?.pendingTickers && backfillStatus.data.pendingTickers.length > 0 && (
            <div>
              <p className="text-xs font-medium text-amber-400 mb-1">Wird gerade geladen:</p>
              <div className="flex flex-wrap gap-1">
                {backfillStatus.data.pendingTickers.map((t) => (
                  <Badge key={t} variant="outline" className="text-xs text-amber-300 border-amber-500/30">{t}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Recently Completed */}
          {backfillStatus.data?.recentlyCompleted && backfillStatus.data.recentlyCompleted.length > 0 && (
            <div>
              <p className="text-xs font-medium text-emerald-400 mb-1">Zuletzt nachgeladen (letzte Stunde):</p>
              <div className="flex flex-wrap gap-1">
                {backfillStatus.data.recentlyCompleted.map((item) => (
                  <Badge key={item.ticker} variant="outline" className="text-xs text-emerald-300 border-emerald-500/30 gap-1">
                    <CheckCircle2 className="h-2.5 w-2.5" />{item.ticker}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Permanently Failed */}
          {backfillStatus.data?.permanentlyFailed && backfillStatus.data.permanentlyFailed.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-red-400 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />Dauerhaft keine EODHD-Daten ({backfillStatus.data.permanentlyFailed.length} Ticker):
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 text-xs text-red-400 hover:text-red-300 px-1"
                  onClick={() => clearPermanentlyFailed.mutate({})}
                  disabled={clearPermanentlyFailed.isPending}
                >
                  Alle löschen
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {backfillStatus.data.permanentlyFailed.map((item) => (
                  <Badge
                    key={item.ticker}
                    variant="outline"
                    className="text-xs text-red-300 border-red-500/30 gap-1 cursor-pointer hover:border-red-400"
                    onClick={() => clearPermanentlyFailed.mutate({ ticker: item.ticker })}
                    title={`${item.reason} — ${new Date(item.failedAt).toLocaleString('de-CH')} — Klicken zum Entfernen`}
                  >
                    <XCircle className="h-2.5 w-2.5" />{item.ticker}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {backfillStatus.data?.pendingCount === 0 && backfillStatus.data?.recentlyCompleted?.length === 0 && backfillStatus.data?.permanentlyFailed?.length === 0 && (
            <p className="text-xs text-muted-foreground">Keine ausstehenden oder kürzlich abgeschlossenen Backfills.</p>
          )}
        </div>

        {/* Kategorisierte Admin-Funktionen — alle Bereiche per Karte erreichbar */}
        <div className="space-y-8">
          {adminGroups.map((group) => {
            const kachel = (section: AdminKachel) => (
              <Card
                key={section.path}
                className="hover:shadow-lg hover:border-primary/30 transition-all cursor-pointer group"
                onClick={() => setLocation(section.path)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-muted group-hover:bg-accent transition-colors shrink-0">
                      <section.icon className={`h-5 w-5 ${section.color}`} />
                    </div>
                    <CardTitle className="text-base leading-tight">{section.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-xs leading-relaxed">
                    {section.description}
                  </CardDescription>
                </CardContent>
              </Card>
            );
            return (
              <div key={group.title}>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  {group.title}
                  <span className="ml-2 text-xs font-normal text-muted-foreground/60">({group.sections.length})</span>
                </h2>
                {group.untergruppen ? (
                  <div className="space-y-5">
                    {group.untergruppen.map((ug) => (
                      <div key={ug.label}>
                        <div className="flex items-baseline gap-2 mb-2">
                          <h3 className="text-xs font-semibold text-foreground/80">{ug.label}</h3>
                          <span className="text-xs text-muted-foreground">— {ug.hinweis}</span>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                          {ug.pfade
                            .map((pfad) => group.sections.find((sec) => sec.path === pfad))
                            .filter((sec): sec is AdminKachel => sec !== undefined)
                            .map(kachel)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {group.sections.map(kachel)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
