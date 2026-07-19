import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import {ChevronDown, ChevronRight, Eye, RotateCcw, Save, Settings, SlidersHorizontal} from "lucide-react";
import { Breadcrumb } from "@/components/Breadcrumb";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ScoreThresholdsConfig {
  componentWeights: {
    riskAdjustedReturn: number;
    valuation: number;
    risk: number;
    income: number;
    diversification: number;
  };
  subWeights: {
    sharpe: number;
    sortino: number;
    maxDrawdown: number;
    peg: number;
    pe: number;
    pegDistribution: number;
    volatility: number;
    beta: number;
    hhi: number;
    sectorHHI: number;
    foreignCurrency: number;
    positionCount: number;
  };
  thresholds: Record<string, [number, number][]>;
}

// ─── Threshold Labels ────────────────────────────────────────────────────────

const COMPONENT_LABELS: Record<string, string> = {
  riskAdjustedReturn: "Risikoadjustierte Rendite",
  valuation: "Bewertung",
  risk: "Risiko",
  income: "Ertrag",
  diversification: "Diversifikation",
};

const SUB_WEIGHT_LABELS: Record<string, string> = {
  sharpe: "Sharpe Ratio",
  sortino: "Sortino Ratio",
  maxDrawdown: "Max Drawdown",
  peg: "PEG Ratio",
  pe: "PE Ratio",
  pegDistribution: "PEG-Verteilung",
  volatility: "Volatilität",
  beta: "Beta",
  hhi: "Konzentration (HHI)",
  sectorHHI: "Sektor-HHI",
  foreignCurrency: "Fremdwährungsanteil",
  positionCount: "Positionsanzahl",
};

const THRESHOLD_LABELS: Record<string, { label: string; unit: string; component: string }> = {
  sharpe: { label: "Sharpe Ratio", unit: "", component: "riskAdjustedReturn" },
  sortino: { label: "Sortino Ratio", unit: "", component: "riskAdjustedReturn" },
  maxDrawdown: { label: "Max Drawdown", unit: "%", component: "riskAdjustedReturn" },
  peg: { label: "PEG Ratio", unit: "x", component: "valuation" },
  pe: { label: "PE Ratio", unit: "x", component: "valuation" },
  volatility: { label: "Volatilität", unit: "%", component: "risk" },
  beta: { label: "Beta", unit: "", component: "risk" },
  hhi: { label: "Konzentration (HHI)", unit: "", component: "risk" },
  dividendYield: { label: "Dividendenrendite", unit: "%", component: "income" },
  sectorHHI: { label: "Sektor-HHI", unit: "", component: "diversification" },
  foreignCurrency: { label: "Fremdwährungsanteil", unit: "%", component: "diversification" },
  positionCount: { label: "Positionsanzahl", unit: "Stk", component: "diversification" },
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function AdminScoreConfig() {
  const { data, isLoading } = trpc.admin.getScoreConfig.useQuery();
  const updateMutation = trpc.admin.updateScoreConfig.useMutation();
  const previewMutation = trpc.admin.previewScoreConfig.useMutation();

  const [config, setConfig] = useState<ScoreThresholdsConfig | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    componentWeights: true,
    riskAdjustedReturn: false,
    valuation: false,
    risk: false,
    income: false,
    diversification: false,
  });
  const [previewResult, setPreviewResult] = useState<any>(null);

  useEffect(() => {
    if (data?.config) {
      setConfig(JSON.parse(JSON.stringify(data.config)));
    }
  }, [data]);

  const hasChanges = useMemo(() => {
    if (!config || !data?.defaults) return false;
    return JSON.stringify(config) !== JSON.stringify(data.config);
  }, [config, data]);

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleWeightChange = (key: string, value: string) => {
    if (!config) return;
    const num = parseFloat(value);
    if (isNaN(num)) return;
    setConfig({
      ...config,
      componentWeights: { ...config.componentWeights, [key]: num },
    });
  };

  const handleSubWeightChange = (key: string, value: string) => {
    if (!config) return;
    const num = parseFloat(value);
    if (isNaN(num)) return;
    setConfig({
      ...config,
      subWeights: { ...config.subWeights, [key]: num },
    });
  };

  const handleThresholdChange = (thresholdKey: string, index: number, field: 0 | 1, value: string) => {
    if (!config) return;
    const num = parseFloat(value);
    if (isNaN(num)) return;
    const newThresholds = { ...config.thresholds };
    const arr = [...newThresholds[thresholdKey]];
    arr[index] = [...arr[index]] as [number, number];
    arr[index][field] = num;
    newThresholds[thresholdKey] = arr;
    setConfig({ ...config, thresholds: newThresholds });
  };

  const addThresholdRow = (thresholdKey: string) => {
    if (!config) return;
    const newThresholds = { ...config.thresholds };
    const arr = [...newThresholds[thresholdKey]];
    const lastRow = arr[arr.length - 1] || [0, 50];
    arr.push([lastRow[0] + 0.5, lastRow[1]]);
    newThresholds[thresholdKey] = arr;
    setConfig({ ...config, thresholds: newThresholds });
  };

  const removeThresholdRow = (thresholdKey: string, index: number) => {
    if (!config) return;
    const newThresholds = { ...config.thresholds };
    const arr = [...newThresholds[thresholdKey]];
    if (arr.length <= 2) {
      toast.error("Mindestens 2 Schwellenwerte benötigt");
      return;
    }
    arr.splice(index, 1);
    newThresholds[thresholdKey] = arr;
    setConfig({ ...config, thresholds: newThresholds });
  };

  const handleSave = async () => {
    if (!config) return;
    // Validate weights sum
    const wSum = Object.values(config.componentWeights).reduce((a, b) => a + b, 0);
    if (Math.abs(wSum - 1.0) > 0.01) {
      toast.error(`Komponentengewichte müssen 1.0 ergeben (aktuell: ${wSum.toFixed(3)})`);
      return;
    }
    try {
      await updateMutation.mutateAsync({ config });
      toast.success("Score-Konfiguration gespeichert");
    } catch (e: any) {
      toast.error(e.message || "Fehler beim Speichern");
    }
  };

  const handleReset = () => {
    if (data?.defaults) {
      setConfig(JSON.parse(JSON.stringify(data.defaults)));
      toast.info("Auf Standardwerte zurückgesetzt (noch nicht gespeichert)");
    }
  };

  const handlePreview = async () => {
    if (!config) return;
    // Sample input for a typical balanced portfolio
    const sampleInput = {
      sharpe: 0.65,
      sortino: 0.85,
      maxDrawdown: -0.12,
      avgPEG: 1.8,
      avgPE: 18.5,
      pegDistribution: { below15: 4, above3: 2, total: 12 },
      volatility: 0.14,
      avgBeta: 0.85,
      hhi: 0.08,
      avgDividendYield: 0.028,
      sectorHHI: 0.15,
      foreignCurrencyPct: 0.45,
      positionCount: 12,
    };
    try {
      const result = await previewMutation.mutateAsync({ config, sampleInput });
      setPreviewResult(result);
    } catch (e: any) {
      toast.error(e.message || "Preview fehlgeschlagen");
    }
  };

  const weightSum = config
    ? Object.values(config.componentWeights).reduce((a, b) => a + b, 0)
    : 0;

  if (isLoading || !config) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-64" />
            <div className="h-64 bg-muted rounded" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
      <Breadcrumb
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Score-Konfiguration", icon: <SlidersHorizontal className="h-4 w-4" /> },
        ]}
      />
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Score-Konfiguration</h1>
              <p className="text-sm text-muted-foreground">
                Portfolio Quality Score Schwellenwerte und Gewichtungen
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-1" /> Defaults
            </Button>
            <Button variant="outline" size="sm" onClick={handlePreview}>
              <Eye className="h-4 w-4 mr-1" /> Preview
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!hasChanges || updateMutation.isPending}>
              <Save className="h-4 w-4 mr-1" /> Speichern
            </Button>
          </div>
        </div>

        {/* Preview Result */}
        {previewResult && (
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Preview — Beispiel-Portfolio</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6 flex-wrap">
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary">{previewResult.totalScore}</div>
                  <div className="text-xs text-muted-foreground">Gesamt</div>
                </div>
                {previewResult.components?.map((c: any) => (
                  <div key={c.name} className="text-center">
                    <div className={`text-lg font-semibold ${c.available ? '' : 'text-muted-foreground'}`}>
                      {c.available ? c.score : '—'}
                    </div>
                    <div className="text-xs text-muted-foreground">{c.name}</div>
                  </div>
                ))}
                <div className="text-center">
                  <div className="text-lg font-semibold">{previewResult.dataCoveragePct}%</div>
                  <div className="text-xs text-muted-foreground">Abdeckung</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Component Weights */}
        <Card>
          <CardHeader
            className="cursor-pointer select-none"
            onClick={() => toggleSection("componentWeights")}
          >
            <div className="flex items-center gap-2">
              {expandedSections.componentWeights ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <CardTitle className="text-base">Komponentengewichte</CardTitle>
              <span className={`text-xs ml-auto ${Math.abs(weightSum - 1.0) > 0.01 ? 'text-red-500 font-bold' : 'text-muted-foreground'}`}>
                Summe: {weightSum.toFixed(2)}
              </span>
            </div>
          </CardHeader>
          {expandedSections.componentWeights && (
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {Object.entries(config.componentWeights).map(([key, value]) => (
                  <div key={key}>
                    <Label className="text-xs">{COMPONENT_LABELS[key] || key}</Label>
                    <Input
                      type="number"
                      step="0.05"
                      min="0"
                      max="1"
                      value={value}
                      onChange={(e) => handleWeightChange(key, e.target.value)}
                      className="mt-1"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>

        {/* Threshold Sections grouped by component */}
        {Object.entries(COMPONENT_LABELS).map(([componentKey, componentLabel]) => {
          const relevantThresholds = Object.entries(THRESHOLD_LABELS).filter(
            ([, meta]) => meta.component === componentKey
          );
          const relevantSubWeights = Object.entries(SUB_WEIGHT_LABELS).filter(([key]) =>
            relevantThresholds.some(([tKey]) => {
              // Map threshold keys to sub-weight keys
              if (tKey === "dividendYield") return false; // income has no sub-weights
              return key === tKey || (tKey === "dividendYield" && key === "dividendYield");
            })
          );

          return (
            <Card key={componentKey}>
              <CardHeader
                className="cursor-pointer select-none"
                onClick={() => toggleSection(componentKey)}
              >
                <div className="flex items-center gap-2">
                  {expandedSections[componentKey] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <CardTitle className="text-base">{componentLabel}</CardTitle>
                  <span className="text-xs text-muted-foreground ml-auto">
                    Gewicht: {((config.componentWeights as any)[componentKey] * 100).toFixed(0)}%
                  </span>
                </div>
              </CardHeader>
              {expandedSections[componentKey] && (
                <CardContent className="space-y-6">
                  {/* Sub-weights for this component */}
                  {relevantSubWeights.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2 text-muted-foreground">Sub-Gewichte</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {relevantThresholds.map(([tKey, meta]) => {
                          const swKey = tKey === "dividendYield" ? undefined : tKey;
                          if (!swKey || !(swKey in config.subWeights)) return null;
                          return (
                            <div key={swKey}>
                              <Label className="text-xs">{meta.label}</Label>
                              <Input
                                type="number"
                                step="0.05"
                                min="0"
                                max="1"
                                value={(config.subWeights as any)[swKey]}
                                onChange={(e) => handleSubWeightChange(swKey, e.target.value)}
                                className="mt-1"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Threshold tables */}
                  {relevantThresholds.map(([tKey, meta]) => (
                    <div key={tKey}>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium">{meta.label} Schwellenwerte</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => addThresholdRow(tKey)}
                          className="text-xs"
                        >
                          + Zeile
                        </Button>
                      </div>
                      <div className="border rounded-md overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="px-3 py-1.5 text-left font-medium">Wert {meta.unit && `(${meta.unit})`}</th>
                              <th className="px-3 py-1.5 text-left font-medium">Score (0–100)</th>
                              <th className="px-3 py-1.5 w-10"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {config.thresholds[tKey]?.map((row, idx) => (
                              <tr key={idx} className="border-t">
                                <td className="px-3 py-1">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={row[0]}
                                    onChange={(e) => handleThresholdChange(tKey, idx, 0, e.target.value)}
                                    className="h-7 text-xs"
                                  />
                                </td>
                                <td className="px-3 py-1">
                                  <Input
                                    type="number"
                                    step="1"
                                    min="0"
                                    max="100"
                                    value={row[1]}
                                    onChange={(e) => handleThresholdChange(tKey, idx, 1, e.target.value)}
                                    className="h-7 text-xs"
                                  />
                                </td>
                                <td className="px-3 py-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                    onClick={() => removeThresholdRow(tKey, idx)}
                                  >
                                    ×
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </DashboardLayout>
  );
}
