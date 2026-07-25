import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {Brain, CheckCircle2, HelpCircle, RefreshCw, SlidersHorizontal, XCircle} from "lucide-react";
import { Breadcrumb } from "@/components/Breadcrumb";

const REGIME_LABELS: Record<string, string> = {
  crisis: "Krise",
  bear: "Bärenmarkt",
  recovery: "Erholung",
  bull: "Bullenmarkt",
  sideways_high_vol: "Seitwärts (hohe Vola)",
  sideways_low_vol: "Seitwärts (tiefe Vola)",
};

export default function AdminSignalConfig() {
  const utils = trpc.useUtils();
  const { data: config = [], isLoading } = trpc.admin.getRegimeSignalConfig.useQuery();
  const { data: mlStatus } = trpc.admin.analyticsServiceStatus.useQuery();

  // Editierbarer Qualitätsanteil je Regime in Prozent (Timing = 100 − Qualität).
  const [quality, setQuality] = useState<Record<string, number>>({});
  useEffect(() => {
    const seed: Record<string, number> = {};
    for (const r of config) {
      const total = r.qualityWeight + r.tradingWeight || 1;
      seed[r.regime] = Math.round((r.qualityWeight / total) * 100);
    }
    setQuality(seed);
  }, [config]);

  const setBlend = trpc.admin.setRegimeBlend.useMutation({
    onSuccess: () => {
      utils.admin.getRegimeSignalConfig.invalidate();
      toast.success("Gewichtung gespeichert");
    },
    onError: (e) => toast.error("Fehler: " + e.message),
  });

  const recompute = trpc.admin.recomputeRegimeWeights.useMutation({
    onSuccess: (r: any) => {
      utils.admin.getRegimeSignalConfig.invalidate();
      if (r?.reason) toast.message("Kein Lernen möglich", { description: r.reason });
      else toast.success(`${r.updatedRegimes} Regimes aus ${r.evaluatedRows} ausgewerteten Signalen gelernt`);
    },
    onError: (e) => toast.error("Fehler: " + e.message),
  });

  return (
    <DashboardLayout>
      <Breadcrumb
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Signal-Konfiguration", icon: <SlidersHorizontal className="h-4 w-4" /> },
        ]}
      />
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Signal-Gewichtung</h1>
          <p className="text-muted-foreground mt-2">
            Verhältnis von <strong>Qualität/Titelwahl</strong> zu <strong>Trading-Signal/Timing</strong> je
            Marktregime. Die gelernten Engine-Gewichte stammen aus dem gemessenen Alpha (Gedächtnis).
          </p>
        </div>

        {/* ML-Pipeline-Status */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Brain className="h-4 w-4 text-purple-500" /> ML-Pipeline (ANALYTICS_SERVICE_URL)
            </CardTitle>
            {mlStatus?.reachable === true ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : mlStatus?.configured ? (
              <XCircle className="h-4 w-4 text-red-500" />
            ) : (
              <HelpCircle className="h-4 w-4 text-yellow-500" />
            )}
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{mlStatus?.hint ?? "…"}</p>
            {mlStatus?.host && <p className="text-xs text-muted-foreground mt-1">Host: {mlStatus.host}</p>}
          </CardContent>
        </Card>

        {/* Gelerntes Gedächtnis neu berechnen */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Gedächtnis-Schleife</CardTitle>
            <CardDescription>
              Lernt die Engine-Gewichte je Regime aus dem gemessenen Out-of-Sample-Alpha (signal_history) neu.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => recompute.mutate()} disabled={recompute.isPending}>
              <RefreshCw className={`h-4 w-4 mr-2 ${recompute.isPending ? "animate-spin" : ""}`} />
              {recompute.isPending ? "Lerne…" : "Engine-Gewichte neu lernen"}
            </Button>
          </CardContent>
        </Card>

        {/* Blend je Regime */}
        <div className="grid gap-4 md:grid-cols-2">
          {isLoading && <p className="text-sm text-muted-foreground">Lädt…</p>}
          {config.map((r) => {
            const q = quality[r.regime] ?? 50;
            return (
              <Card key={r.regime}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{REGIME_LABELS[r.regime] ?? r.regime}</CardTitle>
                  <CardDescription>
                    {r.isDefault ? "Standardwerte" : "Angepasst"} · Evidenz: {r.sampleSize} Signale
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>Qualität: <strong>{q}%</strong></span>
                    <span>Timing: <strong>{100 - q}%</strong></span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={q}
                    onChange={(e) => setQuality((s) => ({ ...s, [r.regime]: parseInt(e.target.value, 10) }))}
                    className="w-full"
                    aria-label={`Qualitätsanteil ${REGIME_LABELS[r.regime] ?? r.regime}`}
                  />
                  {r.engineWeights && (
                    <p className="text-xs text-muted-foreground">
                      Gelernte Engines:{" "}
                      {Object.entries(r.engineWeights)
                        .map(([e, w]) => `${e} ${Math.round((w as number) * 100)}%`)
                        .join(" · ")}
                    </p>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={setBlend.isPending}
                    onClick={() => setBlend.mutate({ regime: r.regime, quality: q, trading: 100 - q })}
                  >
                    Speichern
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
