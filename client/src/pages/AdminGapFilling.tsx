import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  AlertCircle, CheckCircle, Clock, Database, Plus, RefreshCw,
  Search, Settings, SkipForward, ChevronDown, ChevronUp, Save,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Breadcrumb } from "@/components/Breadcrumb";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GapInfo {
  type: "sector" | "dividend";
  label: string;
  count: number;
  needed: number;
}

interface StockAdded {
  ticker: string;
  name: string;
  sector: string;
  gapType: string;
}

interface GapFillLogRow {
  id: number;
  runAt: Date | string;
  triggeredBy: string;
  gapsFound: GapInfo[];
  stocksAdded: StockAdded[];
  stocksSkipped: number;
  durationMs: number | null;
  error: string | null;
}

const ALL_SECTORS = [
  "Technology", "Healthcare", "Financial Services",
  "Consumer Cyclical", "Consumer Defensive", "Industrials",
  "Energy", "Utilities", "Real Estate",
  "Basic Materials", "Communication Services",
];

const ALL_EXCHANGES = [
  { value: "US", label: "USA (NYSE/NASDAQ)" },
  { value: "SW", label: "Schweiz (SIX)" },
  { value: "DE", label: "Deutschland (XETRA)" },
  { value: "PA", label: "Frankreich (Euronext Paris)" },
  { value: "L", label: "UK (London)" },
  { value: "TO", label: "Kanada (TSX)" },
  { value: "AX", label: "Australien (ASX)" },
  { value: "HK", label: "Hongkong (HKEX)" },
  { value: "T", label: "Japan (Tokyo)" },
];

// ─── Config Form ──────────────────────────────────────────────────────────────

interface ConfigState {
  minStocksPerSector: number;
  minDividendStocks: number;
  minDividendYield: number;
  maxCandidatesPerGap: number;
  maxStocksPerRun: number;
  minMarketCapBillions: number;
  targetSectors: string[];
  allowedExchanges: string[];
  enableRegionCheck: number;
  minStocksPerRegion: number;
  enableLowBetaCheck: number;
  maxBetaForLowBeta: string;
  minLowBetaStocks: number;
  enableEsgCheck: number;
  minEsgStocks: number;
}

const DEFAULT_CONFIG: ConfigState = {
  minStocksPerSector: 3,
  minDividendStocks: 5,
  minDividendYield: 2,
  maxCandidatesPerGap: 3,
  maxStocksPerRun: 10,
  minMarketCapBillions: 0,
  targetSectors: [...ALL_SECTORS],
  allowedExchanges: [],
  enableRegionCheck: 0,
  minStocksPerRegion: 2,
  enableLowBetaCheck: 0,
  maxBetaForLowBeta: "0.8",
  minLowBetaStocks: 3,
  enableEsgCheck: 0,
  minEsgStocks: 2,
};

function NumInput({
  label, value, onChange, min, max, unit, hint,
}: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; unit?: string; hint?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-sm font-medium">{label}</Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!isNaN(v) && v >= min && v <= max) onChange(v);
          }}
          className="w-24"
        />
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminGapFilling() {
  const [lastResult, setLastResult] = useState<{
    success: boolean;
    gapsFound: GapInfo[];
    stocksAdded: StockAdded[];
    stocksSkipped: number;
    durationMs: number;
    error?: string;
  } | null>(null);

  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState<ConfigState>(DEFAULT_CONFIG);
  const [configDirty, setConfigDirty] = useState(false);

  const { data: savedConfig, isLoading: configLoading } = trpc.admin.getGapFillConfig.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  // Sync loaded config into local state
  useEffect(() => {
    if (savedConfig) {
      setConfig({
        minStocksPerSector: savedConfig.minStocksPerSector,
        minDividendStocks: savedConfig.minDividendStocks,
        minDividendYield: savedConfig.minDividendYield,
        maxCandidatesPerGap: savedConfig.maxCandidatesPerGap,
        maxStocksPerRun: savedConfig.maxStocksPerRun,
        minMarketCapBillions: savedConfig.minMarketCapBillions,
        targetSectors: (savedConfig.targetSectors as string[]) ?? [...ALL_SECTORS],
        allowedExchanges: (savedConfig.allowedExchanges as string[]) ?? [],
        enableRegionCheck: savedConfig.enableRegionCheck,
        minStocksPerRegion: savedConfig.minStocksPerRegion,
        enableLowBetaCheck: savedConfig.enableLowBetaCheck,
        maxBetaForLowBeta: savedConfig.maxBetaForLowBeta,
        minLowBetaStocks: savedConfig.minLowBetaStocks,
        enableEsgCheck: savedConfig.enableEsgCheck,
        minEsgStocks: savedConfig.minEsgStocks,
      });
      setConfigDirty(false);
    }
  }, [savedConfig]);

  const updateConfigMutation = trpc.admin.updateGapFillConfig.useMutation({
    onSuccess: () => {
      toast.success("Konfiguration gespeichert");
      setConfigDirty(false);
    },
    onError: (err) => toast.error("Fehler beim Speichern", { description: err.message }),
  });

  const { data: logs, refetch: refetchLogs, isLoading: logsLoading } = trpc.admin.getGapFillLogs.useQuery(
    { limit: 10 },
    { refetchOnWindowFocus: false }
  );

  const triggerMutation = trpc.admin.triggerGapFilling.useMutation({
    onSuccess: (data) => {
      setLastResult(data as any);
      refetchLogs();
      if (data.success) {
        if (data.stocksAdded.length > 0) {
          toast.success(`${data.stocksAdded.length} neue Titel hinzugefügt`, {
            description: data.stocksAdded.map((s: StockAdded) => `${s.ticker} (${s.gapType})`).join(", "),
          });
        } else {
          toast.info("Kein Gap-Filling nötig", {
            description: "Das Universum ist bereits gut diversifiziert.",
          });
        }
      } else {
        toast.error("Gap-Filling fehlgeschlagen", { description: (data as any).error });
      }
    },
    onError: (err) => toast.error("Fehler beim Gap-Filling", { description: err.message }),
  });

  const isRunning = triggerMutation.isPending;

  const setField = <K extends keyof ConfigState>(key: K, value: ConfigState[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setConfigDirty(true);
  };

  const toggleSector = (sector: string) => {
    const current = config.targetSectors;
    const next = current.includes(sector)
      ? current.filter((s) => s !== sector)
      : [...current, sector];
    if (next.length === 0) return; // must have at least one
    setField("targetSectors", next);
  };

  const toggleExchange = (ex: string) => {
    const current = config.allowedExchanges;
    const next = current.includes(ex) ? current.filter((e) => e !== ex) : [...current, ex];
    setField("allowedExchanges", next);
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <Breadcrumb
          items={[
            { label: "Admin", href: "/admin" },
            { label: "Universum Gap-Filling", icon: <Database className="h-4 w-4" /> },
          ]}
        />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Search className="w-6 h-6 text-primary" />
              Universum Gap-Filling
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Analysiert das Watchlist-Universum auf Lücken und ergänzt fehlende Titel automatisch via EODHD API.
            </p>
          </div>
          <Button onClick={() => triggerMutation.mutate()} disabled={isRunning} className="gap-2">
            {isRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {isRunning ? "Analysiert..." : "Jetzt ausführen"}
          </Button>
        </div>

        {/* Config Summary Box */}
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
          <CardContent className="pt-4 pb-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="font-medium text-blue-700 dark:text-blue-300">Ziel-Sektoren</div>
                <div className="text-muted-foreground">{config.targetSectors.length} Sektoren</div>
              </div>
              <div>
                <div className="font-medium text-blue-700 dark:text-blue-300">Min. pro Sektor</div>
                <div className="text-muted-foreground">{config.minStocksPerSector} Titel</div>
              </div>
              <div>
                <div className="font-medium text-blue-700 dark:text-blue-300">Min. Dividendentitel</div>
                <div className="text-muted-foreground">
                  {config.minDividendStocks} Titel (≥{config.minDividendYield}%)
                </div>
              </div>
              <div>
                <div className="font-medium text-blue-700 dark:text-blue-300">Max. Titel/Lauf</div>
                <div className="text-muted-foreground">
                  {config.maxStocksPerRun === 0 ? "Unbegrenzt" : config.maxStocksPerRun}
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowConfig((v) => !v)}
                className="gap-1.5 text-xs"
              >
                <Settings className="h-3.5 w-3.5" />
                Kriterien konfigurieren
                {showConfig ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </Button>
              {configDirty && (
                <span className="text-xs text-amber-500">· Ungespeicherte Änderungen</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Configuration Panel */}
        {showConfig && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="h-4 w-4 text-primary" />
                Kriterien-Konfiguration
              </CardTitle>
              <CardDescription>
                Definiert, wann eine Lücke erkannt wird und wie viele Titel pro Lauf hinzugefügt werden.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">

              {/* ── Sektor-Kriterien ── */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Sektor-Diversifikation
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <NumInput
                    label="Min. Titel pro Sektor"
                    value={config.minStocksPerSector}
                    onChange={(v) => setField("minStocksPerSector", v)}
                    min={1} max={20}
                    hint="Lücke wenn weniger Titel vorhanden"
                  />
                  <NumInput
                    label="Max. Kandidaten pro Lücke"
                    value={config.maxCandidatesPerGap}
                    onChange={(v) => setField("maxCandidatesPerGap", v)}
                    min={1} max={10}
                    hint="API-Calls pro Lücke limitieren"
                  />
                  <NumInput
                    label="Max. Titel pro Lauf"
                    value={config.maxStocksPerRun}
                    onChange={(v) => setField("maxStocksPerRun", v)}
                    min={0} max={50}
                    hint="0 = unbegrenzt"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium mb-2 block">Ziel-Sektoren</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Nur ausgewählte Sektoren werden auf Lücken geprüft.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {ALL_SECTORS.map((sector) => (
                      <button
                        key={sector}
                        type="button"
                        onClick={() => toggleSector(sector)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                          config.targetSectors.includes(sector)
                            ? "bg-primary/20 border-primary/50 text-primary"
                            : "bg-transparent border-border text-muted-foreground hover:border-muted-foreground"
                        }`}
                      >
                        {sector}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <Separator />

              {/* ── Dividenden-Kriterien ── */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Dividenden-Diversifikation
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <NumInput
                    label="Min. Dividendentitel"
                    value={config.minDividendStocks}
                    onChange={(v) => setField("minDividendStocks", v)}
                    min={0} max={50}
                    hint="Lücke wenn weniger Dividendentitel"
                  />
                  <NumInput
                    label="Min. Dividendenrendite"
                    value={config.minDividendYield}
                    onChange={(v) => setField("minDividendYield", v)}
                    min={0} max={20}
                    unit="%"
                    hint="Schwellenwert für Dividendentitel"
                  />
                </div>
              </div>

              <Separator />

              {/* ── Qualitäts-Kriterien ── */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Qualitäts-Filter
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <NumInput
                    label="Min. Marktkapitalisierung"
                    value={config.minMarketCapBillions}
                    onChange={(v) => setField("minMarketCapBillions", v)}
                    min={0} max={1000}
                    unit="Mrd. USD"
                    hint="0 = kein Filter (alle Grössen)"
                  />
                </div>
              </div>

              <Separator />

              {/* ── Regionen-Filter ── */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Regionen-Diversifikation
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Prüft ob genug Titel aus verschiedenen Regionen vorhanden sind.
                    </p>
                  </div>
                  <Switch
                    checked={config.enableRegionCheck === 1}
                    onCheckedChange={(v) => setField("enableRegionCheck", v ? 1 : 0)}
                  />
                </div>

                {config.enableRegionCheck === 1 && (
                  <div className="space-y-4 pl-2 border-l-2 border-primary/20">
                    <NumInput
                      label="Min. Titel pro Region"
                      value={config.minStocksPerRegion}
                      onChange={(v) => setField("minStocksPerRegion", v)}
                      min={1} max={10}
                      hint="Regionen: USA, Europa, Asien"
                    />
                  </div>
                )}

                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    Erlaubte Börsenplätze{" "}
                    <span className="text-muted-foreground font-normal">(leer = alle)</span>
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {ALL_EXCHANGES.map((ex) => (
                      <button
                        key={ex.value}
                        type="button"
                        onClick={() => toggleExchange(ex.value)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                          config.allowedExchanges.includes(ex.value)
                            ? "bg-primary/20 border-primary/50 text-primary"
                            : "bg-transparent border-border text-muted-foreground hover:border-muted-foreground"
                        }`}
                      >
                        {ex.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <Separator />

              {/* ── Low-Beta Kriterium ── */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Defensiv / Low-Beta
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Stellt sicher, dass genug defensive Titel mit niedrigem Beta vorhanden sind.
                    </p>
                  </div>
                  <Switch
                    checked={config.enableLowBetaCheck === 1}
                    onCheckedChange={(v) => setField("enableLowBetaCheck", v ? 1 : 0)}
                  />
                </div>

                {config.enableLowBetaCheck === 1 && (
                  <div className="grid grid-cols-2 gap-4 pl-2 border-l-2 border-primary/20">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium">Max. Beta</Label>
                      <p className="text-xs text-muted-foreground">Schwellenwert für «Low-Beta»</p>
                      <Input
                        type="number"
                        step="0.1"
                        min={0.1}
                        max={1.5}
                        value={config.maxBetaForLowBeta}
                        onChange={(e) => {
                          setField("maxBetaForLowBeta", e.target.value);
                        }}
                        className="w-24"
                      />
                    </div>
                    <NumInput
                      label="Min. Low-Beta Titel"
                      value={config.minLowBetaStocks}
                      onChange={(v) => setField("minLowBetaStocks", v)}
                      min={1} max={20}
                      hint="Lücke wenn weniger vorhanden"
                    />
                  </div>
                )}
              </div>

              <Separator />

              {/* ── ESG Kriterium ── */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      ESG / Nachhaltigkeit
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Prüft ob genug ESG-orientierte Titel (Utilities, Clean Energy) vorhanden sind.
                    </p>
                  </div>
                  <Switch
                    checked={config.enableEsgCheck === 1}
                    onCheckedChange={(v) => setField("enableEsgCheck", v ? 1 : 0)}
                  />
                </div>

                {config.enableEsgCheck === 1 && (
                  <div className="pl-2 border-l-2 border-primary/20">
                    <NumInput
                      label="Min. ESG-Titel"
                      value={config.minEsgStocks}
                      onChange={(v) => setField("minEsgStocks", v)}
                      min={1} max={20}
                      hint="Lücke wenn weniger vorhanden"
                    />
                  </div>
                )}
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-2">
                <Button
                  onClick={() => updateConfigMutation.mutate(config)}
                  disabled={!configDirty || updateConfigMutation.isPending}
                  className="gap-2"
                >
                  <Save className="h-4 w-4" />
                  {updateConfigMutation.isPending ? "Speichert..." : "Konfiguration speichern"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Last Run Result */}
        {lastResult && (
          <Card className={lastResult.success ? "border-green-200" : "border-red-200"}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                {lastResult.success ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-500" />
                )}
                Letzter manueller Lauf
                {lastResult.durationMs > 0 && (
                  <span className="text-xs text-muted-foreground font-normal ml-auto">
                    {(lastResult.durationMs / 1000).toFixed(1)}s
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {lastResult.error && (
                <div className="text-sm text-red-600 bg-red-50 rounded p-2">{lastResult.error}</div>
              )}

              {lastResult.gapsFound.length > 0 ? (
                <div>
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Gefundene Lücken ({lastResult.gapsFound.length})
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {lastResult.gapsFound.map((g) => (
                      <Badge key={g.label} variant="outline" className="text-xs">
                        {g.label}: {g.count}/{g.count + g.needed} Titel
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-green-700 dark:text-green-400 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Keine Lücken — Universum ist gut diversifiziert
                </div>
              )}

              {lastResult.stocksAdded.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Hinzugefügte Titel ({lastResult.stocksAdded.length})
                  </div>
                  <div className="space-y-1">
                    {lastResult.stocksAdded.map((s) => (
                      <div key={s.ticker} className="flex items-center gap-2 text-sm">
                        <Plus className="w-3 h-3 text-green-500 flex-shrink-0" />
                        <span className="font-mono font-medium">{s.ticker}</span>
                        <span className="text-muted-foreground">{s.name}</span>
                        <Badge variant="secondary" className="text-xs ml-auto">{s.gapType}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {lastResult.stocksSkipped > 0 && (
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <SkipForward className="w-3 h-3" />
                  {lastResult.stocksSkipped} Titel übersprungen (bereits vorhanden oder API-Fehler)
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Separator />

        {/* Run History */}
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Lauf-Historie
          </h2>

          {logsLoading ? (
            <div className="text-sm text-muted-foreground">Lade...</div>
          ) : !logs || logs.length === 0 ? (
            <div className="text-sm text-muted-foreground italic">
              Noch keine Läufe aufgezeichnet. Starten Sie den ersten Lauf mit "Jetzt ausführen".
            </div>
          ) : (
            <div className="space-y-3">
              {(logs as GapFillLogRow[]).map((log) => {
                const gapsFound = (log.gapsFound as GapInfo[]) ?? [];
                const stocksAdded = (log.stocksAdded as StockAdded[]) ?? [];
                const runDate = new Date(log.runAt);
                return (
                  <Card key={log.id} className="text-sm">
                    <CardContent className="pt-3 pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {log.error ? (
                              <AlertCircle className="w-3 h-3 text-red-500 flex-shrink-0" />
                            ) : (
                              <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
                            )}
                            <span className="font-medium">
                              {runDate.toLocaleDateString("de-CH", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            <Badge variant={log.triggeredBy === "manual" ? "default" : "secondary"} className="text-xs">
                              {log.triggeredBy === "manual" ? "Manuell" : "Automatisch"}
                            </Badge>
                            {log.durationMs && (
                              <span className="text-muted-foreground text-xs">
                                {(log.durationMs / 1000).toFixed(1)}s
                              </span>
                            )}
                          </div>

                          {log.error ? (
                            <div className="text-red-600 text-xs">{log.error}</div>
                          ) : (
                            <div className="text-muted-foreground text-xs flex flex-wrap gap-3">
                              <span>{gapsFound.length} Lücken gefunden</span>
                              <span className="text-green-600 font-medium">
                                {stocksAdded.length} Titel hinzugefügt
                              </span>
                              {log.stocksSkipped > 0 && (
                                <span>{log.stocksSkipped} übersprungen</span>
                              )}
                            </div>
                          )}

                          {stocksAdded.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {stocksAdded.map((s) => (
                                <Badge key={s.ticker} variant="outline" className="text-xs font-mono">
                                  {s.ticker}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
