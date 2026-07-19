import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {AlertCircle, CheckCircle, Clock, Database, Plus, RefreshCw, Search, SkipForward} from "lucide-react";
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
    onError: (err) => {
      toast.error("Fehler beim Gap-Filling", { description: err.message });
    },
  });

  const isRunning = triggerMutation.isPending;

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
              Analysiert das Watchlist-Universum auf Lücken (Sektoren, Dividenden) und ergänzt fehlende Titel
              automatisch via EODHD API.
            </p>
          </div>
          <Button
            onClick={() => triggerMutation.mutate()}
            disabled={isRunning}
            className="gap-2"
          >
            {isRunning ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            {isRunning ? "Analysiert..." : "Jetzt ausführen"}
          </Button>
        </div>

        {/* Info Box */}
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
          <CardContent className="pt-4 pb-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="font-medium text-blue-700 dark:text-blue-300">Ziel-Sektoren</div>
                <div className="text-muted-foreground">11 Sektoren</div>
              </div>
              <div>
                <div className="font-medium text-blue-700 dark:text-blue-300">Min. pro Sektor</div>
                <div className="text-muted-foreground">3 Titel</div>
              </div>
              <div>
                <div className="font-medium text-blue-700 dark:text-blue-300">Min. Dividendentitel</div>
                <div className="text-muted-foreground">5 Titel (≥2%)</div>
              </div>
              <div>
                <div className="font-medium text-blue-700 dark:text-blue-300">Zeitplan</div>
                <div className="text-muted-foreground">Wöchentlich (So. 03:00 UTC)</div>
              </div>
            </div>
          </CardContent>
        </Card>

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

              {/* Gaps found */}
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

              {/* Stocks added */}
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
                        <Badge variant="secondary" className="text-xs ml-auto">
                          {s.gapType}
                        </Badge>
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

        {/* Target Sectors */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Ziel-Sektoren</h2>
          <Card>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                {[
                  "Technology", "Healthcare", "Financial Services",
                  "Consumer Cyclical", "Consumer Defensive", "Industrials",
                  "Energy", "Utilities", "Real Estate",
                  "Basic Materials", "Communication Services",
                ].map((sector) => (
                  <div key={sector} className="flex items-center gap-2 text-muted-foreground">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                    {sector}
                  </div>
                ))}
              </div>
              <Separator className="my-3" />
              <div className="text-xs text-muted-foreground">
                Zusätzlich: Dividendentitel (Rendite ≥ 2%) werden als eigene Kategorie überwacht.
                Kandidaten werden aus einem kuratierten Large-Cap-Universum ausgewählt.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
