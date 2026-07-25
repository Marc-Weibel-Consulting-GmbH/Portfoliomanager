import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import {ChevronDown, ChevronRight, Eye, RotateCcw, Save, Settings, SlidersHorizontal} from "lucide-react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Slider } from "@/components/ui/slider";

// ─── Asset-Class Weights Section ─────────────────────────────────────────────

interface AssetClassWeights {
  bond:       { rsiWeight: number; rangeWeight: number; yieldWeight: number };
  gold:       { rsiWeight: number; rangeWeight: number; ytdWeight: number };
  commodity:  { rsiWeight: number; rangeWeight: number; ytdWeight: number };
  crypto:     { rsiWeight: number; rangeWeight: number; ytdWeight: number };
  realestate: { rsiWeight: number; rangeWeight: number; yieldWeight: number };
}

const DEFAULT_WEIGHTS: AssetClassWeights = {
  bond:       { rsiWeight: 0.3,  rangeWeight: 0.2,  yieldWeight: 0.5 },
  gold:       { rsiWeight: 0.4,  rangeWeight: 0.4,  ytdWeight: 0.2 },
  commodity:  { rsiWeight: 0.4,  rangeWeight: 0.4,  ytdWeight: 0.2 },
  crypto:     { rsiWeight: 0.35, rangeWeight: 0.35, ytdWeight: 0.3 },
  realestate: { rsiWeight: 0.3,  rangeWeight: 0.2,  yieldWeight: 0.5 },
};

const CLASS_LABELS: Record<keyof AssetClassWeights, string> = {
  bond:       "Obligationen",
  gold:       "Gold",
  commodity:  "Rohstoffe",
  crypto:     "Krypto",
  realestate: "Immobilien",
};

function AssetClassWeightsSection() {
  const { data, isLoading } = trpc.admin.getAssetClassWeights.useQuery();

  if (isLoading) return null;

  // Das Formular seedet seinen State aus den Props (kein Effect). Die Query
  // liefert keine stabile Zeilen-ID, deshalb wird ausschliesslich auf das
  // Vorhandensein der Gewichte gekeyt — ein Hintergrund-Refetch derselben
  // Werte ändert den Key nicht und verwirft keine offenen Eingaben.
  return (
    <AssetClassWeightsForm
      key={data?.weights ? "geladen" : "leer"}
      initialWeights={(data?.weights as AssetClassWeights | null) ?? DEFAULT_WEIGHTS}
    />
  );
}

function AssetClassWeightsForm({ initialWeights }: { initialWeights: AssetClassWeights }) {
  const updateMutation = trpc.admin.updateAssetClassWeights.useMutation();
  const [weights, setWeights] = useState<AssetClassWeights>(initialWeights);
  const [dirty, setDirty] = useState(false);

  function setW<K extends keyof AssetClassWeights>(
    cls: K,
    field: keyof AssetClassWeights[K],
    val: number
  ) {
    setWeights(prev => ({ ...prev, [cls]: { ...prev[cls], [field]: val } }));
    setDirty(true);
  }

  async function handleSave() {
    const res = await updateMutation.mutateAsync(weights);
    if (res.success) {
      toast.success("Gewichte gespeichert");
      setDirty(false);
    } else {
      toast.error(res.message ?? "Fehler beim Speichern");
    }
  }

  function renderSlider(
    label: string,
    value: number,
    onChange: (v: number) => void
  ) {
    return (
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{label}</span>
          <span className="font-mono">{(value * 100).toFixed(0)}%</span>
        </div>
        <Slider
          min={0} max={1} step={0.05}
          value={[value]}
          onValueChange={([v]) => onChange(v)}
          className="w-full"
        />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Assetklassen-Gewichte</CardTitle>
          <Button size="sm" onClick={handleSave} disabled={!dirty || updateMutation.isPending}>
            <Save className="h-4 w-4 mr-1" /> Speichern
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Gewichtung der Signal-Komponenten pro Assetklasse (RSI-Momentum · 52W-Range · Rendite/YTD). Summe sollte 1.0 ergeben.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(Object.keys(weights) as (keyof AssetClassWeights)[]).map(cls => {
            const w = weights[cls];
            const thirdKey = "yieldWeight" in w ? "yieldWeight" : "ytdWeight";
            const thirdLabel = "yieldWeight" in w ? "Rendite/Yield" : "YTD-Performance";
            return (
              <div key={cls} className="space-y-3 p-3 rounded-lg bg-muted/30">
                <p className="text-sm font-medium">{CLASS_LABELS[cls]}</p>
                {renderSlider("RSI-Momentum", w.rsiWeight, v => setW(cls, "rsiWeight" as any, v))}
                {renderSlider("52W-Range", w.rangeWeight, v => setW(cls, "rangeWeight" as any, v))}
                {renderSlider(thirdLabel, (w as any)[thirdKey], v => setW(cls, thirdKey as any, v))}
                <p className="text-xs text-right text-muted-foreground">
                  Σ = {(w.rsiWeight + w.rangeWeight + (w as any)[thirdKey]).toFixed(2)}
                </p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

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

type ScoreConfigData = RouterOutputs["admin"]["getScoreConfig"];

export default function AdminScoreConfig() {
  const { data, isLoading } = trpc.admin.getScoreConfig.useQuery();

  if (isLoading || !data?.config) {
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

  // Das Formular seedet seinen State aus den Props (kein Effect). Die Query
  // liefert keine stabile Zeilen-ID, deshalb wird ausschliesslich auf das
  // Vorhandensein der Konfiguration gekeyt — ein Hintergrund-Refetch derselben
  // Konfiguration ändert den Key nicht und verwirft keine offenen Eingaben.
  return <ScoreConfigForm key={data.config ? "geladen" : "leer"} data={data} />;
}

function ScoreConfigForm({ data }: { data: ScoreConfigData }) {
  const { data: auditData, refetch: refetchAudit } = trpc.admin.getScoreConfigAudit.useQuery();
  const updateMutation = trpc.admin.updateScoreConfig.useMutation();
  const previewMutation = trpc.admin.previewScoreConfig.useMutation();

  const [config, setConfig] = useState<ScoreThresholdsConfig>(
    () => JSON.parse(JSON.stringify(data.config)) as ScoreThresholdsConfig
  );
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    componentWeights: true,
    riskAdjustedReturn: false,
    valuation: false,
    risk: false,
    income: false,
    diversification: false,
  });
  const [previewResult, setPreviewResult] = useState<any>(null);

  const hasChanges = useMemo(() => {
    if (!data?.defaults) return false;
    return JSON.stringify(config) !== JSON.stringify(data.config);
  }, [config, data]);

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleWeightChange = (key: string, value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    setConfig({
      ...config,
      componentWeights: { ...config.componentWeights, [key]: num },
    });
  };

  const handleSubWeightChange = (key: string, value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    setConfig({
      ...config,
      subWeights: { ...config.subWeights, [key]: num },
    });
  };

  const handleThresholdChange = (thresholdKey: string, index: number, field: 0 | 1, value: string) => {
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
    const newThresholds = { ...config.thresholds };
    const arr = [...newThresholds[thresholdKey]];
    const lastRow = arr[arr.length - 1] || [0, 50];
    arr.push([lastRow[0] + 0.5, lastRow[1]]);
    newThresholds[thresholdKey] = arr;
    setConfig({ ...config, thresholds: newThresholds });
  };

  const removeThresholdRow = (thresholdKey: string, index: number) => {
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
    // Validate weights sum
    const wSum = Object.values(config.componentWeights).reduce((a, b) => a + b, 0);
    if (Math.abs(wSum - 1.0) > 0.01) {
      toast.error(`Komponentengewichte müssen 1.0 ergeben (aktuell: ${wSum.toFixed(3)})`);
      return;
    }
    try {
      await updateMutation.mutateAsync({ config });
      toast.success("Score-Konfiguration gespeichert");
      refetchAudit();
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

  const weightSum = Object.values(config.componentWeights).reduce((a, b) => a + b, 0);

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

        {/* Audit-Trail (Compliance): letzte Schwellen-Änderungen */}
        {auditData?.entries && auditData.entries.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Letzte Änderungen (Audit)</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-xs">
                {auditData.entries.slice(0, 8).map((e: any, i: number) => (
                  <li key={i} className="flex flex-wrap gap-x-2 text-muted-foreground">
                    <span className="font-mono">{new Date(e.at).toLocaleString("de-CH")}</span>
                    <span>·</span>
                    <span>{e.email || `User #${e.userId}`}</span>
                    {e.oldWeights && e.newWeights && (
                      <span className="text-foreground/70">
                        · Gewichte: {(["riskAdjustedReturn","valuation","risk","income","diversification"] as const)
                          .filter((k) => e.oldWeights[k] !== e.newWeights[k])
                          .map((k) => `${k} ${Math.round((e.oldWeights[k] ?? 0) * 100)}→${Math.round((e.newWeights[k] ?? 0) * 100)}%`)
                          .join(", ") || "unverändert"}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
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
      <AssetClassWeightsSection />
    </DashboardLayout>
  );
}
