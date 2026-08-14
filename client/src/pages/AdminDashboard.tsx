import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Grid3x3, PieChart, Key, BarChart3, Eye, BrainCircuit, Activity, Wallet, Brain, RefreshCw, CheckCircle2, XCircle, TrendingUp, FlaskConical, AlertTriangle, Clock, Database, Upload, Zap, ScrollText, Settings, Calculator, SlidersHorizontal, Camera, Bell, Search, MessageSquare, Gauge, Globe, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useState, useEffect, Fragment } from "react";
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
  const rekoStatus = trpc.admin.getRekonstruktionStatus.useQuery(
    { von: rekoVon, bis: rekoBis },
    { refetchInterval: (query) => (query.state.data?.aktiv ? 5_000 : false) },
  );
  const starteReko = trpc.admin.starteRekonstruktion.useMutation({
    onSuccess: (d) => {
      if (d.gestartet) toast.success("Rekonstruktion gestartet", { description: "Der Fortschritt erscheint unten." });
      else toast.info(d.message);
      rekoStatus.refetch();
    },
    onError: (err) => toast.error("Fehler", { description: err.message }),
  });

  /**
   * Häppchen selbsttätig nachlegen.
   *
   * Der Lauf arbeitet in Portionen zu 25 Titeln, weil ein langer Lauf in dieser
   * Umgebung stirbt. Bei 243 Titeln sind das zehn Klicks — und beim dritten
   * Durchgang wegen einer Formelkorrektur ist das schlicht Schikane. Die
   * Portionierung bleibt, das Nachlegen übernimmt der Browser.
   *
   * Bewusst als abschaltbarer Schalter und nicht als festes Verhalten: Wer
   * einen einzelnen Durchgang beobachten will, soll das können.
   */
  const [autoWeiter, setAutoWeiter] = useState(true);
  useEffect(() => {
    const s = rekoStatus.data;
    if (!autoWeiter || !s) return;
    if (s.aktiv || s.haengt) return;
    if ((s.nochOffen ?? 0) <= 0) return;
    if (starteReko.isPending) return;
    const t = setTimeout(() => {
      starteReko.mutate({ von: rekoVon, bis: rekoBis, fortsetzen: true, maxTitel: 25 });
    }, 1500);
    return () => clearTimeout(t);
  }, [autoWeiter, rekoStatus.data, starteReko, rekoVon, rekoBis]);

  // Schritt 3b: Gewichte auf der rekonstruierten Reihe messen. Rechnet einige
  // Sekunden, schreibt nichts — das Ergebnis ist ein Bericht, keine Übernahme.
  const [horizont, setHorizont] = useState(1);
  const gewichteBacktest = trpc.admin.gewichteBacktest.useMutation({
    onError: (err) => toast.error("Backtest fehlgeschlagen", { description: err.message }),
  });

  // Die vorgelagerte Frage: Ordnet ein Score die Titel innerhalb desselben
  // Monats überhaupt richtig? Ohne diese Auskunft sagt die Gewichtssuche nur,
  // welcher von 171 Kandidaten gewonnen hat — nicht, ob es etwas zu gewinnen gab.
  const scoreDiagnose = trpc.admin.scoreDiagnose.useMutation({
    onError: (err) => toast.error("Diagnose fehlgeschlagen", { description: err.message }),
  });
  const [jahreOffen, setJahreOffen] = useState(false);

  // Die Messung, die zur Anwendung passt: die besten N halten. Alle Kandidaten
  // in einem Lauf — sonst braucht jede Frage eine eigene Runde.
  const [positionen, setPositionen] = useState(25);
  const rangTest = trpc.admin.rangTest.useMutation({
    onError: (err) => toast.error("Rangtest fehlgeschlagen", { description: err.message }),
  });

  // Watchlist-Screener: Universum sichten, Scores häppchenweise rechnen, die
  // besten Kandidaten zur Übernahme vorschlagen. Gleiche Häppchen-Mechanik wie
  // die Rekonstruktion — kleine Läufe sterben nicht, das Nachlegen übernimmt
  // der Browser.
  const [screenerAuto, setScreenerAuto] = useState(true);
  // Aufgeklappter Kandidat (Ticker) — zeigt die Faktorwerte hinter den Scores.
  const [screenerDetail, setScreenerDetail] = useState<string | null>(null);
  // Wie viele Kandidaten die Tabelle zeigt — «Mehr anzeigen» erweitert schrittweise.
  const [screenerTopN, setScreenerTopN] = useState(30);
  const screenerStatusQ = trpc.admin.screenerStatus.useQuery({ topN: screenerTopN }, {
    refetchInterval: (query) => {
      const d = query.state.data;
      if (!d) return false;
      const laufOffen = d.lauf?.status === "sammelt" || d.lauf?.status === "rechnet";
      return d.aktiv || laufOffen ? 5_000 : false;
    },
  });
  const screenerStart = trpc.admin.screenerStart.useMutation({
    onSuccess: (d) => {
      if (d.gestartet) toast.success("Screener gestartet", { description: "Das Universum wird eingesammelt." });
      else toast.info(d.message);
      screenerStatusQ.refetch();
    },
    onError: (err) => toast.error("Fehler", { description: err.message }),
  });
  const screenerRechnen = trpc.admin.screenerRechnen.useMutation({
    onSuccess: (d) => { if (!d.gestartet) toast.info(d.message); screenerStatusQ.refetch(); },
    onError: (err) => toast.error("Fehler", { description: err.message }),
  });
  const screenerEntscheiden = trpc.admin.screenerEntscheiden.useMutation({
    onSuccess: (d) => {
      if (d.ok) toast.success(d.message); else toast.error(d.message);
      screenerStatusQ.refetch();
    },
    onError: (err) => toast.error("Fehler", { description: err.message }),
  });
  const screenerNeuBerechnen = trpc.admin.screenerNeuBerechnen.useMutation({
    onSuccess: (d) => { toast.success(d.message); screenerStatusQ.refetch(); },
    onError: (err) => toast.error("Fehler", { description: err.message }),
  });
  useEffect(() => {
    const s = screenerStatusQ.data;
    if (!screenerAuto || !s?.lauf) return;
    // Einen HÄNGENDEN Lauf neu anstossen statt ewig zu warten — der Server
    // gibt den Zustand nach der Totzeit ohnehin frei (screenerGiltAlsTot).
    if (s.aktiv && !s.haengt) return;
    if (s.lauf.status !== "rechnet" || s.lauf.wartend <= 0) return;
    if (screenerRechnen.isPending) return;
    const t = setTimeout(() => screenerRechnen.mutate({ laufId: s.lauf!.id, maxTitel: 25 }), 1500);
    return () => clearTimeout(t);
  }, [screenerAuto, screenerStatusQ.data, screenerRechnen]);

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

          {/* Selbsttätiges Nachlegen. Die Portionierung zu 25 Titeln bleibt —
              ein langer Lauf stirbt in dieser Umgebung —, aber zehn Klicks
              nacheinander sind kein Bedienkonzept. */}
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={autoWeiter}
              onChange={(e) => setAutoWeiter(e.target.checked)}
              className="accent-emerald-500"
            />
            Häppchen selbsttätig nachlegen, bis alle Titel erfasst sind
            {autoWeiter && (rekoStatus.data?.nochOffen ?? 0) > 0
              ? ` — noch ${rekoStatus.data!.nochOffen} offen, Seite offen lassen`
              : ""}
          </label>

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

          {/* Gescheiterte Abrufe. Ohne diese Zeile sieht ein Lauf, der reihenweise
              am Abruf scheitert, aus wie einer, der einfach langsam ist — genau so
              blieb der Fortschritt bei 107 von 212 stehen, ohne dass es auffiel. */}
          {(rekoStatus.data?.fehlversuche.anzahl ?? 0) > 0 && (
            <div className="text-xs text-amber-400 space-y-1">
              <p>
                {rekoStatus.data!.fehlversuche.anzahl} Titel mit gescheitertem Abruf — sie stehen
                am Ende der Warteschlange und werden erneut versucht, sobald die übrigen durch sind.
              </p>
              <p className="text-[11px] text-muted-foreground">
                {rekoStatus.data!.fehlversuche.liste
                  .map((f) => `${f.ticker} (${f.versuche}× — ${f.grund ?? "unbekannt"})`)
                  .join(", ")}
                {rekoStatus.data!.fehlversuche.anzahl > rekoStatus.data!.fehlversuche.liste.length ? " …" : ""}
              </p>
            </div>
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

        {/* Watchlist-Screener: das Gesamtuniversum nach den besten Scores
            durchsuchen und Kandidaten zur Aufnahme vorschlagen. Gedacht als
            Ablösung des Gap-Fillings — das bleibt bestehen, bis sich der
            Screener bewährt hat. Jeder Lauf ist zugleich ein Protokoll: ein
            Punkt-in-Zeit-Universum für spätere Vorwärtsmessungen. */}
        <div className="p-4 bg-muted/30 rounded-lg border space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Watchlist-Screener</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Sichtet die grössten Titel der Börsen US, SIX, XETRA, Paris, London, Amsterdam und
                Mailand (ab 1 Mrd. Marktkapitalisierung) und bewertet neue Titel mit denselben drei
                Scores wie die Titelseite. Die besten stehen unten zur Übernahme bereit — jede
                Aufnahme bleibt eine Einzelentscheidung.
              </p>
            </div>
            <Button
              onClick={() => screenerStart.mutate({ minMarktKapMrd: 1, maxJeBoerse: 700 })}
              disabled={screenerStart.isPending || (screenerStatusQ.data?.aktiv && !screenerStatusQ.data?.haengt)}
              variant="outline"
              className="gap-2"
            >
              {screenerStatusQ.data?.aktiv
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Search className="h-4 w-4" />}
              {screenerStatusQ.data?.aktiv ? "Läuft..." : "Universum sichten"}
            </Button>
          </div>

          {screenerStatusQ.data?.lauf && (
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 border-t pt-3 text-sm">
              <div>
                <span className="text-muted-foreground text-xs">Lauf</span>
                <div className="font-bold">#{screenerStatusQ.data.lauf.id}</div>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Gesichtet</span>
                <div className="font-bold">{screenerStatusQ.data.lauf.universum.toLocaleString("de-CH")}</div>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Bereits erfasst</span>
                <div className="font-bold">{screenerStatusQ.data.lauf.vorhanden.toLocaleString("de-CH")}</div>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Berechnet</span>
                <div className="font-bold">{screenerStatusQ.data.lauf.berechnet.toLocaleString("de-CH")}</div>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Noch offen</span>
                <div className={`font-bold ${screenerStatusQ.data.lauf.wartend > 0 ? "text-amber-400" : ""}`}>
                  {screenerStatusQ.data.lauf.wartend.toLocaleString("de-CH")}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Übernommen / abgelehnt</span>
                <div className="font-bold">
                  {screenerStatusQ.data.lauf.uebernommen} / {screenerStatusQ.data.lauf.abgelehnt}
                </div>
              </div>
            </div>
          )}

          {screenerStatusQ.data?.lauf?.status === "fehler" && (
            <p className="text-xs text-amber-400">
              Lauf gescheitert: {screenerStatusQ.data.lauf.fehler ?? "unbekannter Fehler"} —
              «Universum sichten» startet einen neuen Lauf.
            </p>
          )}
          {screenerStatusQ.data && (
            <p className="text-xs text-muted-foreground">
              Watchlist aktuell: {screenerStatusQ.data.watchlistGroesse.toLocaleString("de-CH")} Titel
              (Richtwert: höchstens ~500).
              {(screenerStatusQ.data.lauf?.fehlgeschlagen ?? 0) > 0
                ? ` ${screenerStatusQ.data.lauf!.fehlgeschlagen} Titel ohne berechenbaren Score (fehlende Fundamentaldaten).`
                : ""}
              {(screenerStatusQ.data.lauf?.zweitkotierungen ?? 0) > 0
                ? ` ${screenerStatusQ.data.lauf!.zweitkotierungen} Zweitkotierungen aussortiert (nur der Hauptbörsenplatz zählt).`
                : ""}
            </p>
          )}

          {/* Verteilung je Börse — ein «nur US»-Zwischenbild ist meist nur
              Rechenreihenfolge; hier sieht man, wie weit jede Börse ist. */}
          {(screenerStatusQ.data?.jeBoerse?.length ?? 0) > 0 && (
            <p className="text-xs text-muted-foreground">
              Berechnet je Börse:{" "}
              {screenerStatusQ.data!.jeBoerse.map((b) => `${b.boerse} ${b.berechnet}${b.wartend > 0 ? `/${b.berechnet + b.wartend}` : ""}`).join(" · ")}
            </p>
          )}

          {/* Nachrechnen: Lief ein Teil des Laufs, bevor Herleitungs-Speicherung
              oder ADR-Filter deployed waren, fehlen den Berechneten diese
              Prüfungen — hier alles zurück in die Warteschlange legen. */}
          {(screenerStatusQ.data?.lauf?.berechnet ?? 0) > 0 && (
            <div className="flex items-center gap-3 flex-wrap">
              {(screenerStatusQ.data?.ohneHerleitung ?? 0) > 0 && (
                <p className="text-xs text-amber-400">
                  {screenerStatusQ.data!.ohneHerleitung} berechnete Kandidaten ohne Faktor-Herleitung.
                </p>
              )}
              <Button
                size="sm" variant="outline" className="h-6 px-2 text-[11px]"
                disabled={screenerNeuBerechnen.isPending || !screenerStatusQ.data?.lauf}
                onClick={() => screenerNeuBerechnen.mutate({ laufId: screenerStatusQ.data!.lauf!.id })}
              >
                Alle neu rechnen (Herleitung & ADR-Filter)
              </Button>
            </div>
          )}

          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={screenerAuto}
              onChange={(e) => setScreenerAuto(e.target.checked)}
              className="accent-emerald-500"
            />
            Häppchen selbsttätig nachlegen, bis alle Kandidaten bewertet sind
            {screenerAuto && (screenerStatusQ.data?.lauf?.wartend ?? 0) > 0
              ? ` — noch ${screenerStatusQ.data!.lauf!.wartend} offen, Seite offen lassen`
              : ""}
          </label>

          {screenerStatusQ.data?.meldungen && screenerStatusQ.data.meldungen.length > 0 && (
            <div className="bg-black/50 rounded p-3 max-h-32 overflow-y-auto font-mono text-xs text-green-400 border-t">
              {screenerStatusQ.data.meldungen.map((m, i) => (
                <div key={i} className={m.includes("Fehler") ? "text-amber-400" : ""}>{m}</div>
              ))}
            </div>
          )}

          {(screenerStatusQ.data?.beste?.length ?? 0) > 0 && (
            <div className="border-t pt-3 space-y-2">
              <p className="text-xs font-medium">
                Beste Kandidaten (nach Signal-Score) — nicht in der Watchlist
                <span className="text-muted-foreground font-normal">
                  {" "}· zeige {screenerStatusQ.data!.beste.length}
                  {screenerStatusQ.data?.lauf ? ` von ${screenerStatusQ.data.lauf.berechnet + screenerStatusQ.data.lauf.uebernommen + screenerStatusQ.data.lauf.abgelehnt} berechneten` : ""}
                </span>
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground text-left">
                      <th className="py-1 pr-3">Ticker</th>
                      <th className="py-1 pr-3">Name</th>
                      <th className="py-1 pr-3">Börse</th>
                      <th className="py-1 pr-3">Sektor</th>
                      <th className="py-1 pr-3 text-right">Qualität</th>
                      <th className="py-1 pr-3 text-right">Bewertung</th>
                      <th className="py-1 pr-3 text-right">Signal</th>
                      <th className="py-1 pr-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {screenerStatusQ.data!.beste.map((k) => (
                      <Fragment key={k.ticker}>
                      <tr
                        className="border-t border-white/5 cursor-pointer hover:bg-white/[0.03]"
                        onClick={() => setScreenerDetail(screenerDetail === k.ticker ? null : k.ticker)}
                        title="Klicken für die Faktorwerte hinter den Scores"
                      >
                        <td className="py-1.5 pr-3 font-mono">{k.ticker}</td>
                        <td className="py-1.5 pr-3 max-w-[220px] truncate">{k.name ?? "—"}</td>
                        <td className="py-1.5 pr-3">{k.boerse ?? "—"}</td>
                        <td className="py-1.5 pr-3 max-w-[140px] truncate">{k.sektor ?? "—"}</td>
                        <td className="py-1.5 pr-3 text-right font-mono">
                          {k.qualitaet != null ? Math.round(k.qualitaet) : "—"}
                        </td>
                        <td className="py-1.5 pr-3 text-right font-mono">
                          {k.bewertung != null ? Math.round(k.bewertung) : "—"}
                        </td>
                        <td className="py-1.5 pr-3 text-right font-mono font-bold">
                          {k.signalScore != null ? Math.round(k.signalScore) : "—"}
                          {k.signalLabel ? ` (${k.signalLabel})` : ""}
                        </td>
                        <td className="py-1.5 pr-0 text-right whitespace-nowrap">
                          {k.status === "uebernommen" ? (
                            <Badge variant="outline" className="text-emerald-400 border-emerald-500/40">übernommen</Badge>
                          ) : k.status === "abgelehnt" ? (
                            <Badge variant="outline" className="text-muted-foreground">abgelehnt</Badge>
                          ) : (
                            <span className="inline-flex gap-1">
                              <Button
                                size="sm" variant="outline" className="h-6 px-2 text-[11px]"
                                disabled={screenerEntscheiden.isPending}
                                onClick={(e) => { e.stopPropagation(); screenerEntscheiden.mutate({ laufId: k.laufId, ticker: k.ticker, entscheidung: "uebernehmen" }); }}
                              >
                                Übernehmen
                              </Button>
                              <Button
                                size="sm" variant="ghost" className="h-6 px-2 text-[11px] text-muted-foreground"
                                disabled={screenerEntscheiden.isPending}
                                onClick={(e) => { e.stopPropagation(); screenerEntscheiden.mutate({ laufId: k.laufId, ticker: k.ticker, entscheidung: "ablehnen" }); }}
                              >
                                Ablehnen
                              </Button>
                            </span>
                          )}
                        </td>
                      </tr>
                      {/* Die Herleitung: Faktorwerte hinter Qualität und Bewertung —
                          dieselben Zahlen, die auch die Erklärdialoge der Titelseite
                          zeigen. Ohne sie liesse sich kein Score nachprüfen. */}
                      {screenerDetail === k.ticker && (
                        <tr key={`${k.ticker}-detail`} className="border-t border-white/5 bg-black/30">
                          <td colSpan={8} className="py-2 px-3">
                            {/* Die 60/40-Klammer der Qualität: Die Faktortabelle unten ist
                                nur das Niveau — erst mit der Richtung (F-Score) lässt sich
                                die Kopfzahl nachrechnen. */}
                            {(k as any).qualitaetNiveau != null && (k as any).qualitaetRichtung != null && k.qualitaet != null && (
                              <p className="text-[11px] text-muted-foreground font-mono mb-2">
                                Qualität: Niveau {Number((k as any).qualitaetNiveau).toFixed(1)} × 60 %
                                {" + "}Richtung {Number((k as any).qualitaetRichtung).toFixed(1)}
                                {(k as any).fScore != null ? ` (F-Score ${(k as any).fScore}/9)` : ""} × 40 %
                                {" = "}{Number(k.qualitaet).toFixed(1)}
                              </p>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {([
                                ["Qualität — Faktoren", (k as any).qualitaetFaktoren],
                                ["Bewertung — Faktoren", (k as any).bewertungFaktoren],
                              ] as [string, any[] | null][]).map(([titel, faktoren]) => (
                                <div key={titel}>
                                  <p className="text-[11px] font-medium text-muted-foreground mb-1">{titel}</p>
                                  {Array.isArray(faktoren) && faktoren.length > 0 ? (
                                    <table className="w-full text-[11px]">
                                      <tbody>
                                        {faktoren.map((f: any, i: number) => (
                                          <tr key={i} className="border-t border-white/5" title={f?.hinweis ?? ""}>
                                            <td className="py-0.5 pr-2">
                                              {f?.name ?? "—"}
                                              {Number.isFinite(f?.gewicht) ? <span className="text-muted-foreground"> · {Math.round(f.gewicht * 100)}%</span> : null}
                                              {/* Ausgeblendete Faktoren: der Grund gehört sichtbar
                                                  daneben — ein Strich allein liest sich wie ein Fehler. */}
                                              {f?.punkte == null && f?.hinweis && (
                                                <span className="block text-[10px] text-muted-foreground/70">{f.hinweis}</span>
                                              )}
                                            </td>
                                            <td className="py-0.5 pr-2 text-right font-mono">
                                              {f?.wert != null && Number.isFinite(Number(f.wert)) ? Number(f.wert).toFixed(2) : "—"}
                                            </td>
                                            <td className="py-0.5 text-right font-mono">
                                              {f?.punkte != null && Number.isFinite(Number(f.punkte)) ? `${Math.round(Number(f.punkte))}/100` : "—"}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  ) : (
                                    <p className="text-[11px] text-muted-foreground">
                                      Keine Faktorwerte abgelegt — Kandidat wurde vor dieser Erweiterung berechnet.
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Alle Berechneten sind erreichbar — die Tabelle wächst schrittweise,
                  statt bei 30 abzuschneiden. */}
              {screenerStatusQ.data!.beste.length >= screenerTopN && screenerTopN < 500 && (
                <Button
                  size="sm" variant="outline" className="h-7 px-3 text-xs w-full"
                  onClick={() => setScreenerTopN((n) => Math.min(500, n + 100))}
                >
                  Mehr anzeigen (+100)
                </Button>
              )}
              <p className="text-[11px] text-muted-foreground">
                Timing fehlt den Kandidaten noch (keine Kurshistorie vor der Übernahme) — das Signal
                rechnet aus Qualität und Bewertung. Nach der Übernahme lädt die Kurshistorie nach,
                der stündliche Lauf ergänzt Timing und Signal.
              </p>
            </div>
          )}
        </div>

        {/* Schritt 3b: Gewichte messen. Setzt die Reihe mit Timing und Regime
            voraus — ohne sie misst der Lauf ein Zweidrittelmodell. */}
        <div className="p-4 bg-muted/30 rounded-lg border space-y-3">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-[260px]">
              <p className="text-sm font-medium flex items-center gap-2">
                <Calculator className="h-4 w-4 text-emerald-400" />Signal-Gewichte messen
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Sucht auf der rekonstruierten Reihe den besten Satz aus Qualität, Bewertung und
                Timing — nach Kosten, mit Zeit-Holdout. Übernimmt nichts.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                className="bg-background border rounded px-2 py-1.5 text-sm"
                value={horizont}
                onChange={(e) => setHorizont(Number(e.target.value))}
                disabled={gewichteBacktest.isPending}
              >
                {[1, 3, 6, 12].map((m) => (
                  <option key={m} value={m}>{m} Monat{m > 1 ? "e" : ""} Haltedauer</option>
                ))}
              </select>
              <Button
                size="sm"
                className="gap-2"
                disabled={gewichteBacktest.isPending}
                onClick={() => gewichteBacktest.mutate({ horizontMonate: horizont })}
              >
                {gewichteBacktest.isPending
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <FlaskConical className="h-4 w-4" />}
                {gewichteBacktest.isPending ? "Rechnet..." : "Messen"}
              </Button>
            </div>
          </div>

          {gewichteBacktest.data && (() => {
            const e = gewichteBacktest.data;
            const pct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)} %`;
            // Die Felder kommen über die Serialisierung als optional heraus.
            const satz = (w: { qualitaet?: number; bewertung?: number; timing?: number }) =>
              `Q ${Math.round((w.qualitaet ?? 0) * 100)} · B ${Math.round((w.bewertung ?? 0) * 100)}`
              + ` · T ${Math.round((w.timing ?? 0) * 100)}`;
            return (
              <div className="space-y-3 border-t pt-3">
                <p className="text-xs text-muted-foreground">
                  {e.titel} Titel · {e.beobachtungen.toLocaleString("de-CH")} Beobachtungen ·
                  Zeitschnitt {e.trennDatum ?? "—"} · {e.kandidaten} Kandidaten · {e.dauerSekunden}s
                </p>

                {/* Das Urteil zuerst. Eine Rastersuche liefert IMMER einen
                    Gewinner — ohne diese Zeile läse sich Rauschen wie ein Fund. */}
                <div className={`rounded p-3 text-sm ${e.taugt
                  ? "bg-emerald-500/10 border border-emerald-500/40"
                  : "bg-amber-500/10 border border-amber-500/40"}`}>
                  <p className="font-medium">
                    {e.taugt
                      ? `Übernehmbar: ${satz(e.gewichte)}`
                      : "Kein übernehmbarer Gewichtssatz"}
                  </p>
                  {e.hinweis && <p className="text-xs mt-1 text-muted-foreground">{e.hinweis}</p>}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-muted-foreground">
                      <tr>
                        <th className="text-left font-normal py-1">Gewichte</th>
                        <th className="text-right font-normal">Ø Rendite Prüfzeitraum</th>
                        <th className="text-right font-normal">gegen «alles kaufen»</th>
                        <th className="text-right font-normal">Sharpe</th>
                        <th className="text-right font-normal">Signale</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t">
                        <td className="py-1.5">Gefunden — {satz(e.gewichte)}</td>
                        <td className="text-right">{pct(e.pruefung.signal.mittlereRendite)}</td>
                        <td className="text-right">
                          {pct(e.pruefung.signal.mittlereRendite - e.pruefung.basis.mittlereRendite)}
                        </td>
                        <td className="text-right">{e.pruefung.signal.sharpe.toFixed(2)}</td>
                        <td className="text-right">{e.pruefung.signal.n}</td>
                      </tr>
                      {e.heute && (
                        <tr className="border-t">
                          <td className="py-1.5">Heute im Betrieb — {satz(e.heute.gewichte)}</td>
                          <td className="text-right">{pct(e.heute.pruefung.signal.mittlereRendite)}</td>
                          <td className="text-right">
                            {pct(e.heute.pruefung.signal.mittlereRendite - e.pruefung.basis.mittlereRendite)}
                          </td>
                          <td className="text-right">{e.heute.pruefung.signal.sharpe.toFixed(2)}</td>
                          <td className="text-right">{e.heute.pruefung.signal.n}</td>
                        </tr>
                      )}
                      <tr className="border-t text-muted-foreground">
                        <td className="py-1.5">Alles kaufen (Vergleichsmass)</td>
                        <td className="text-right">{pct(e.pruefung.basis.mittlereRendite)}</td>
                        <td className="text-right">—</td>
                        <td className="text-right">{e.pruefung.basis.sharpe.toFixed(2)}</td>
                        <td className="text-right">{e.pruefung.basis.n}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <p className="text-[11px] text-muted-foreground">
                  Alle Renditen nach einem vollen Rundlauf (Courtage, Stempelabgabe, halbe Spanne).
                  Bei {e.horizontMonate} Monat{e.horizontMonate > 1 ? "en" : ""} Haltedauer sind das
                  rund {(1.125 * (12 / e.horizontMonate)).toFixed(1)} % im Jahr — längere Haltedauern
                  verteilen dieselben Kosten auf mehr Zeit.
                  {" "}Anpassungsverhältnis Training/Prüfung: {e.ueberanpassung.toFixed(2)}
                  {" "}(nahe 1 = übertragbar).
                </p>
              </div>
            );
          })()}
        </div>

        {/* Die vorgelagerte Frage. Die Gewichtssuche misst eine Schwellenregel
            gegen «alles kaufen» und mischt damit Auswahl und Zeitpunkt. Hier
            wird quer je Stichtag gerechnet: alle Titel desselben Monats
            nebeneinander, jede Rendite gegen den Monatsdurchschnitt. */}
        <div className="p-4 bg-muted/30 rounded-lg border space-y-3">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-[260px]">
              <p className="text-sm font-medium flex items-center gap-2">
                <Gauge className="h-4 w-4 text-emerald-400" />Scores diagnostizieren
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ordnet ein Score die Titel innerhalb desselben Monats richtig? Gemessen quer je
                Stichtag gegen den Monatsdurchschnitt — der Markteffekt fällt heraus.
              </p>
            </div>
            <Button
              size="sm"
              className="gap-2"
              disabled={scoreDiagnose.isPending}
              onClick={() => scoreDiagnose.mutate({ horizontMonate: horizont })}
            >
              {scoreDiagnose.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Gauge className="h-4 w-4" />}
              {scoreDiagnose.isPending ? "Rechnet..." : "Diagnostizieren"}
            </Button>
          </div>

          {scoreDiagnose.data && (
            <div className="space-y-4 border-t pt-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-xs text-muted-foreground">
                  {scoreDiagnose.data.titel} Titel ·{" "}
                  {scoreDiagnose.data.beobachtungen.toLocaleString("de-CH")} Beobachtungen ·{" "}
                  {scoreDiagnose.data.horizontMonate} Monat
                  {scoreDiagnose.data.horizontMonate > 1 ? "e" : ""} Horizont ·{" "}
                  {scoreDiagnose.data.dauerSekunden}s
                </p>
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs"
                  onClick={() => setJahreOffen((v) => !v)}>
                  {jahreOffen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  Nach Jahren
                </Button>
              </div>
              {jahreOffen && (
                <p className="text-[11px] text-amber-400/80">
                  Ein Mittelwert über zehn Jahre kann aus allen Jahren stammen oder aus zweien — für
                  eine heutige Entscheidung ist das der ganze Unterschied.
                  {scoreDiagnose.data.horizontMonate > 1
                    ? ` Bei ${scoreDiagnose.data.horizontMonate} Monaten Horizont überlappen die Fenster
                       ausserdem: Die Stichtage sind keine unabhängigen Beobachtungen.`
                    : ""}
                </p>
              )}

              {scoreDiagnose.data.scores.map((s) => {
                const name = { qualitaet: "Qualität", bewertung: "Bewertung", timing: "Timing" }[s.feld];
                // Ab |IC| 0.02 überhaupt der Rede wert — darunter ist es Rauschen.
                const traegt = s.ic !== null && Math.abs(s.ic) >= 0.02
                  && (s.icPositivAnteil >= 0.55 || s.icPositivAnteil <= 0.45);
                return (
                  <div key={s.feld} className="space-y-2">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-sm font-medium">{name}</span>
                      <Badge variant="outline" className={traegt
                        ? "text-emerald-400 border-emerald-500/50"
                        : "text-muted-foreground"}>
                        IC {s.ic !== null ? s.ic.toFixed(3) : "—"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {Math.round(s.icPositivAnteil * 100)} % der Stichtage gleichgerichtet ·
                        Dezilspanne {s.spanne !== null ? `${s.spanne.toFixed(1)} Pkt` : "—"} ·
                        {s.stichtage} Stichtage
                      </span>
                      {/* Die Abdeckung gehört neben den IC, nicht ins Kleingedruckte:
                          Ein Wert auf einem Fünftel des Universums ist eine Aussage
                          über dieses Fünftel. Genau daran ist mir der Bewertungs-
                          Fehler durchgerutscht. */}
                      <Badge variant="outline" className={s.abdeckung < 0.5
                        ? "text-amber-400 border-amber-500/50" : "text-muted-foreground"}>
                        {s.titelJeStichtag} Titel je Stichtag
                        {s.abdeckung < 1 ? ` (${Math.round(s.abdeckung * 100)} %)` : ""}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{s.klartext}</p>

                    {/* Dezile als Balken: die Form sagt mehr als jede Kennzahl.
                        Monoton steigend = Information, Zickzack = Zufall. */}
                    {s.dezile.length > 0 && (() => {
                      const max = Math.max(...s.dezile.map((d) => Math.abs(d.ueberschuss)), 0.01);
                      return (
                        <div className="flex items-end gap-1 h-16" title="Überschuss je Dezil">
                          {s.dezile.map((d) => (
                            <div key={d.dezil} className="flex-1 flex flex-col justify-end h-full">
                              <div
                                className={`w-full rounded-sm ${d.ueberschuss >= 0
                                  ? "bg-emerald-500/60" : "bg-red-500/60"}`}
                                style={{ height: `${(Math.abs(d.ueberschuss) / max) * 100}%` }}
                                title={`Dezil ${d.dezil}: ${d.ueberschuss.toFixed(2)} Pkt (n=${d.n})`}
                              />
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    {/* Nach Jahren. Die entscheidende Gegenprobe: Ein IC von
                        0.069 über zehn Jahre kann aus allen Jahren kommen oder
                        aus zweien — im Mittelwert sieht beides gleich aus, für
                        eine heutige Entscheidung ist es der ganze Unterschied.
                        Die Zwölfmonatsfenster überlappen ausserdem, 115
                        Stichtage sind also eher zehn unabhängige Beobachtungen. */}
                    {jahreOffen && s.jahre.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="text-[11px] w-full">
                          <thead className="text-muted-foreground">
                            <tr>
                              <th className="text-left font-normal py-0.5">Jahr</th>
                              {s.jahre.map((j) => (
                                <th key={j.jahr} className="text-right font-normal px-1">{j.jahr}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-t">
                              <td className="py-0.5 text-muted-foreground">IC</td>
                              {s.jahre.map((j) => (
                                <td key={j.jahr} className={`text-right px-1 tabular-nums ${
                                  j.ic === null ? "text-muted-foreground"
                                    : j.ic > 0.02 ? "text-emerald-400"
                                    : j.ic < -0.02 ? "text-red-400" : "text-muted-foreground"}`}>
                                  {j.ic === null ? "—" : j.ic.toFixed(2)}
                                </td>
                              ))}
                            </tr>
                            <tr className="border-t text-muted-foreground">
                              <td className="py-0.5">Ø Markt</td>
                              {s.jahre.map((j) => (
                                <td key={j.jahr} className="text-right px-1 tabular-nums">
                                  {j.basis.toFixed(0)}
                                </td>
                              ))}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}

              <p className="text-[11px] text-muted-foreground">
                Keine Handelskosten in dieser Rechnung — der Überschuss wird gegen den Querschnitt
                desselben Stichtags gemessen, beide Seiten tragen denselben Rundlauf, er kürzt sich
                weg. Ein IC um 0.03–0.05 gilt für einen einzelnen Faktor bereits als brauchbar; um 0
                heisst kein Zusammenhang.
              </p>
            </div>
          )}
        </div>

        {/* Der Rangtest: die besten N halten. Die Messung, die zur Anwendung
            passt — «alles über 60» und «alles kaufen» tut kein Depot. */}
        <div className="p-4 bg-muted/30 rounded-lg border space-y-3">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-[260px]">
              <p className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-400" />Die besten N halten
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Nach Rang auswählen, den Horizont halten, gegen das gleichgewichtete Universum —
                mit echter Wechselquote und deren Kosten. Alle Kandidaten in einem Lauf.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                className="bg-background border rounded px-2 py-1.5 text-sm"
                value={positionen}
                onChange={(e) => setPositionen(Number(e.target.value))}
                disabled={rangTest.isPending}
              >
                {[10, 15, 20, 25, 30, 40].map((n) => (
                  <option key={n} value={n}>{n} Positionen</option>
                ))}
              </select>
              <Button
                size="sm"
                className="gap-2"
                disabled={rangTest.isPending}
                onClick={() => rangTest.mutate({ horizontMonate: horizont, positionen })}
              >
                {rangTest.isPending
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <TrendingUp className="h-4 w-4" />}
                {rangTest.isPending ? "Rechnet..." : "Rangtest"}
              </Button>
            </div>
          </div>

          {rangTest.data && (
            <div className="space-y-3 border-t pt-3">
              <p className="text-xs text-muted-foreground">
                {rangTest.data.titel} Titel · {rangTest.data.positionen} Positionen ·{" "}
                {rangTest.data.horizontMonate} Monat
                {rangTest.data.horizontMonate > 1 ? "e" : ""} Haltedauer ·{" "}
                {/* Nicht die erste Zeile nehmen: Ist ihr Score kaum belegt,
                    steht dort 0, und der ganze Lauf sieht leer aus. */}
                {Math.max(0, ...rangTest.data.ergebnisse.map((r) => r.periodenJeSpur))}{" "}
                unabhängige Perioden je Spur ·{" "}
                {rangTest.data.dauerSekunden}s
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="text-left font-normal py-1">Auswahl nach</th>
                      <th className="text-right font-normal">Ø Auswahl</th>
                      <th className="text-right font-normal">Ø Universum</th>
                      <th className="text-right font-normal">Vorsprung netto</th>
                      <th className="text-right font-normal">Streuung Startmonat</th>
                      <th className="text-right font-normal">Umschlag</th>
                      <th className="text-right font-normal">vorn</th>
                      <th className="text-left font-normal pl-3">Grösste Branchen der Auswahl</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rangTest.data.ergebnisse.map((r) => {
                      // Grün nur, wenn der Vorsprung grösser ist als die Streuung
                      // über die Startmonate. Sonst hängt er am Startmonat.
                      const robust = Math.abs(r.ueberschussNachKosten) > r.spurStreuung;
                      const gut = robust && r.ueberschussNachKosten > 0;
                      return (
                        <tr key={r.bezeichnung} className="border-t">
                          <td className="py-1.5">
                            {r.bezeichnung}
                            {/* Beim Ausschluss ist die Zahl der gehaltenen Titel
                                die halbe Aussage: 190 breit gehaltene Positionen
                                sind etwas ganz anderes als 25 ausgewählte. */}
                            {r.anteilBehalten !== null && (
                              <span className="text-muted-foreground"> · {r.gehalten} Titel</span>
                            )}
                          </td>
                          <td className="text-right tabular-nums">{r.auswahl.toFixed(2)} %</td>
                          <td className="text-right tabular-nums text-muted-foreground">
                            {r.universum.toFixed(2)} %
                          </td>
                          <td className={`text-right tabular-nums font-medium ${
                            gut ? "text-emerald-400"
                              : robust && r.ueberschussNachKosten < 0 ? "text-red-400"
                              : "text-muted-foreground"}`}>
                            {r.ueberschussNachKosten >= 0 ? "+" : ""}
                            {r.ueberschussNachKosten.toFixed(2)}
                          </td>
                          <td className="text-right tabular-nums text-muted-foreground">
                            ±{r.spurStreuung.toFixed(2)}
                          </td>
                          <td className="text-right tabular-nums text-muted-foreground">
                            {Math.round(r.umschlag * 100)} %
                          </td>
                          <td className="text-right tabular-nums text-muted-foreground">
                            {Math.round(r.anteilVorn * 100)} %
                          </td>
                          {/* Die Spalte, die den eigentlichen Streit entscheidet:
                              Steht im «günstigen» Korb zur Hälfte Finanz und
                              Energie, misst der Vorsprung eine Branchenwette und
                              nicht die Titelauswahl. */}
                          <td className="pl-3 text-muted-foreground text-[11px]">
                            {r.sektoren.length
                              ? r.sektoren.slice(0, 3)
                                  .map((x) => `${x.sektor} ${Math.round(x.anteil * 100)} %`)
                                  .join(" · ")
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {rangTest.data.ergebnisse[0] && (
                <p className="text-xs text-muted-foreground">
                  {rangTest.data.ergebnisse[0].klartext}
                </p>
              )}

              <p className="text-[11px] text-muted-foreground">
                Der Vorsprung ist nur dann farbig, wenn er grösser ist als die Streuung über die
                Startmonate — sonst hängt er davon ab, in welchem Monat man begonnen hätte, nicht
                vom Verfahren. Kosten treffen nur den gewechselten Teil des Depots. Die
                <strong> Gegenprobe</strong> wählt die schlechtesten statt der besten: Zeigt ein
                Score etwas an, muss ihre Zeile spiegelbildlich schlechter sein. Ist sie es nicht,
                misst die Auswahl nichts.
              </p>
            </div>
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
