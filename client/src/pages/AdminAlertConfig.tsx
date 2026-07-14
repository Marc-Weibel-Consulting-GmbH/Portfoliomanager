import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Bell, Save, RotateCcw, Info } from "lucide-react";

const DEFAULT_CONFIG = {
  // P/E
  peLow: 15, peMedium: 20, peHigh: 40, peVeryHigh: 60,
  peLowPoints: 12, peMediumPoints: 6, peHighPoints: -8, peVeryHighPoints: -15,
  // Dividend
  divHigh: 0.04, divMedium: 0.025, divHighPoints: 12, divMediumPoints: 6,
  // 52W
  week52NearLow: 0.20, week52BelowMid: 0.35, week52NearHigh: 0.95,
  week52NearLowPoints: 15, week52BelowMidPoints: 8, week52NearHighPoints: -10,
  // PEG
  pegVeryLow: 0.80, pegModerate: 1.20, pegHigh: 3.00,
  pegVeryLowPoints: 12, pegModeratePoints: 5, pegHighPoints: -8,
  // Trigger
  buyTriggerScore: 75, sellTriggerScore: 25,
  buyPreviousScoreThreshold: 70, sellPreviousScoreThreshold: 35,
  scoreChangeTrigger: 10,
};

type Config = typeof DEFAULT_CONFIG;

function ScorePreview({ config }: { config: Config }) {
  // Simulate a few example stocks
  const examples = [
    { name: "ADEN.SW", pe: 11.1, div: 0.058, pos52w: 0.30, peg: 0.66 },
    { name: "BKW.SW",  pe: 19.7, div: 0.029, pos52w: 0.07, peg: null },
    { name: "LISN.SW", pe: null, div: null,   pos52w: 0.11, peg: 0.69 },
    { name: "PATH",    pe: 19.4, div: null,   pos52w: 0.25, peg: 0.42 },
  ];

  function calcScore(ex: typeof examples[0]) {
    let score = 50;
    const { pe, div, pos52w, peg } = ex;
    if (pe !== null) {
      if (pe < config.peLow) score += config.peLowPoints;
      else if (pe < config.peMedium) score += config.peMediumPoints;
      else if (pe > config.peVeryHigh) score += config.peVeryHighPoints;
      else if (pe > config.peHigh) score += config.peHighPoints;
    }
    if (div !== null) {
      if (div > config.divHigh) score += config.divHighPoints;
      else if (div > config.divMedium) score += config.divMediumPoints;
    }
    if (pos52w !== null) {
      if (pos52w < config.week52NearLow) score += config.week52NearLowPoints;
      else if (pos52w < config.week52BelowMid) score += config.week52BelowMidPoints;
      else if (pos52w > config.week52NearHigh) score += config.week52NearHighPoints;
    }
    if (peg !== null) {
      if (peg < config.pegVeryLow) score += config.pegVeryLowPoints;
      else if (peg < config.pegModerate) score += config.pegModeratePoints;
      else if (peg > config.pegHigh) score += config.pegHighPoints;
    }
    return Math.max(0, Math.min(100, score));
  }

  return (
    <div className="mt-4 p-3 bg-[#0a0f1a] rounded-lg border border-[#1e2840]">
      <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">
        <Info className="h-3 w-3" /> Live-Vorschau: Scores für Beispiel-Aktien aus der letzten E-Mail
      </p>
      <div className="grid grid-cols-4 gap-2">
        {examples.map(ex => {
          const score = calcScore(ex);
          const isAlert = score >= config.buyTriggerScore;
          return (
            <div key={ex.name} className={`text-center p-2 rounded ${isAlert ? 'bg-green-900/30 border border-green-700/40' : 'bg-[#1a2332]'}`}>
              <div className="text-xs text-gray-400">{ex.name}</div>
              <div className={`text-lg font-bold ${score >= config.buyTriggerScore ? 'text-green-400' : score <= config.sellTriggerScore ? 'text-red-400' : 'text-white'}`}>
                {score}
              </div>
              {isAlert && <div className="text-xs text-green-500">→ Alert</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminAlertConfig() {
  const { data, isLoading } = trpc.alertConfig.get.useQuery();
  const updateMutation = trpc.alertConfig.update.useMutation();
  const utils = trpc.useUtils();

  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (data) {
      setConfig({
        peLow: data.peLow, peMedium: data.peMedium, peHigh: data.peHigh, peVeryHigh: data.peVeryHigh,
        peLowPoints: data.peLowPoints, peMediumPoints: data.peMediumPoints,
        peHighPoints: data.peHighPoints, peVeryHighPoints: data.peVeryHighPoints,
        divHigh: data.divHigh, divMedium: data.divMedium,
        divHighPoints: data.divHighPoints, divMediumPoints: data.divMediumPoints,
        week52NearLow: data.week52NearLow, week52BelowMid: data.week52BelowMid, week52NearHigh: data.week52NearHigh,
        week52NearLowPoints: data.week52NearLowPoints, week52BelowMidPoints: data.week52BelowMidPoints,
        week52NearHighPoints: data.week52NearHighPoints,
        pegVeryLow: data.pegVeryLow, pegModerate: data.pegModerate, pegHigh: data.pegHigh,
        pegVeryLowPoints: data.pegVeryLowPoints, pegModeratePoints: data.pegModeratePoints,
        pegHighPoints: data.pegHighPoints,
        buyTriggerScore: data.buyTriggerScore, sellTriggerScore: data.sellTriggerScore,
        buyPreviousScoreThreshold: data.buyPreviousScoreThreshold,
        sellPreviousScoreThreshold: data.sellPreviousScoreThreshold,
        scoreChangeTrigger: data.scoreChangeTrigger,
      });
      setIsDirty(false);
    }
  }, [data]);

  function set(field: keyof Config, value: number) {
    setConfig(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
  }

  async function save() {
    try {
      await updateMutation.mutateAsync(config);
      await utils.alertConfig.get.invalidate();
      setIsDirty(false);
      toast.success("Alert-Konfiguration gespeichert");
    } catch (e: any) {
      toast.error(`Fehler: ${e.message}`);
    }
  }

  function reset() {
    setConfig(DEFAULT_CONFIG);
    setIsDirty(true);
  }

  const inputCls = "bg-[#1a2332] border-[#2a3a4e] text-white h-8 text-sm";
  const labelCls = "text-gray-300 text-xs";
  const hintCls = "text-xs text-gray-500 mt-0.5";

  function NumField({ label, field, step = 1, hint, min, max }: {
    label: string; field: keyof Config; step?: number; hint?: string; min?: number; max?: number;
  }) {
    return (
      <div>
        <Label className={labelCls}>{label}</Label>
        <Input
          type="number"
          step={step}
          min={min}
          max={max}
          value={config[field]}
          onChange={e => set(field, parseFloat(e.target.value) || 0)}
          className={inputCls}
        />
        {hint && <p className={hintCls}>{hint}</p>}
      </div>
    );
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-2 border-[#00CFC1] border-t-transparent rounded-full" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="h-6 w-6 text-[#00CFC1]" />
            <div>
              <h1 className="text-2xl font-bold text-white">Watchlist-Alert Kriterien</h1>
              <p className="text-sm text-gray-400">
                Konfiguriert den Scoring-Algorithmus für Watchlist-Alerts (E-Mail &amp; WhatsApp).
                {data?.updatedAt && (
                  <span className="ml-2 text-gray-500">
                    Zuletzt geändert: {new Date(data.updatedAt).toLocaleString("de-CH")}
                    {data.updatedBy && ` von ${data.updatedBy}`}
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={reset} className="border-[#2a3a4e] text-gray-300 text-sm">
              <RotateCcw className="h-4 w-4 mr-1" /> Standard
            </Button>
            <Button
              onClick={save}
              disabled={!isDirty || updateMutation.isPending}
              className="bg-[#00CFC1] hover:bg-[#00b3a6] text-black text-sm"
            >
              <Save className="h-4 w-4 mr-1" />
              {updateMutation.isPending ? "Speichern..." : "Speichern"}
            </Button>
          </div>
        </div>

        {/* Score-Formel Erklärung */}
        <Card className="bg-[#0d1220] border-[#1e2840]">
          <CardContent className="pt-4 pb-3">
            <p className="text-sm text-gray-300">
              <span className="text-[#00CFC1] font-semibold">Score-Formel:</span>{" "}
              Startpunkt 50 Punkte + Punkte aus P/E + Dividende + 52W-Position + PEG = Endwert (0–100).
              Ein <span className="text-green-400">Kauf-Alert</span> wird ausgelöst, wenn Score ≥ Kauf-Schwelle
              UND (vorheriger Score &lt; Vorherige-Schwelle ODER Anstieg ≥ Mindeständerung).
            </p>
          </CardContent>
        </Card>

        {/* P/E Scoring */}
        <Card className="bg-[#0d1220] border-[#1e2840]">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base">Kurs-Gewinn-Verhältnis (P/E)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-4">
                <p className={hintCls}>Schwellenwerte: P/E &lt; Niedrig → Punkte 1; Niedrig ≤ P/E &lt; Mittel → Punkte 2; P/E &gt; Hoch → Punkte 3; P/E &gt; Sehr hoch → Punkte 4</p>
              </div>
              <NumField label="P/E Niedrig (Grenze)" field="peLow" step={0.5} hint="z.B. 15" />
              <NumField label="P/E Mittel (Grenze)" field="peMedium" step={0.5} hint="z.B. 20" />
              <NumField label="P/E Hoch (Grenze)" field="peHigh" step={1} hint="z.B. 40" />
              <NumField label="P/E Sehr hoch (Grenze)" field="peVeryHigh" step={1} hint="z.B. 60" />
              <NumField label="Punkte: P/E niedrig" field="peLowPoints" hint="z.B. +12" min={-50} max={50} />
              <NumField label="Punkte: P/E mittel" field="peMediumPoints" hint="z.B. +6" min={-50} max={50} />
              <NumField label="Punkte: P/E hoch" field="peHighPoints" hint="z.B. -8" min={-50} max={50} />
              <NumField label="Punkte: P/E sehr hoch" field="peVeryHighPoints" hint="z.B. -15" min={-50} max={50} />
            </div>
          </CardContent>
        </Card>

        {/* Dividende */}
        <Card className="bg-[#0d1220] border-[#1e2840]">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base">Dividendenrendite</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-4">
                <p className={hintCls}>Eingabe als Dezimalzahl: 0.04 = 4%, 0.025 = 2.5%</p>
              </div>
              <NumField label="Hohe Dividende (Grenze)" field="divHigh" step={0.005} hint="z.B. 0.04 = 4%" />
              <NumField label="Mittlere Dividende (Grenze)" field="divMedium" step={0.005} hint="z.B. 0.025 = 2.5%" />
              <NumField label="Punkte: Hohe Dividende" field="divHighPoints" hint="z.B. +12" min={-50} max={50} />
              <NumField label="Punkte: Mittlere Dividende" field="divMediumPoints" hint="z.B. +6" min={-50} max={50} />
            </div>
          </CardContent>
        </Card>

        {/* 52-Wochen-Position */}
        <Card className="bg-[#0d1220] border-[#1e2840]">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base">52-Wochen-Position</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-3">
                <p className={hintCls}>Position = (Kurs - 52W-Tief) / (52W-Hoch - 52W-Tief). 0.0 = am Tief, 1.0 = am Hoch. Eingabe als Dezimalzahl.</p>
              </div>
              <NumField label="Nahe 52W-Tief (Grenze)" field="week52NearLow" step={0.05} hint="z.B. 0.20 = 20%" />
              <NumField label="Unter 52W-Mitte (Grenze)" field="week52BelowMid" step={0.05} hint="z.B. 0.35 = 35%" />
              <NumField label="Nahe 52W-Hoch (Grenze)" field="week52NearHigh" step={0.05} hint="z.B. 0.95 = 95%" />
              <NumField label="Punkte: Nahe Tief" field="week52NearLowPoints" hint="z.B. +15" min={-50} max={50} />
              <NumField label="Punkte: Unter Mitte" field="week52BelowMidPoints" hint="z.B. +8" min={-50} max={50} />
              <NumField label="Punkte: Nahe Hoch" field="week52NearHighPoints" hint="z.B. -10" min={-50} max={50} />
            </div>
          </CardContent>
        </Card>

        {/* PEG */}
        <Card className="bg-[#0d1220] border-[#1e2840]">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base">PEG-Ratio (Price/Earnings to Growth)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <NumField label="PEG sehr niedrig (Grenze)" field="pegVeryLow" step={0.1} hint="z.B. 0.80" />
              <NumField label="PEG moderat (Grenze)" field="pegModerate" step={0.1} hint="z.B. 1.20" />
              <NumField label="PEG hoch (Grenze)" field="pegHigh" step={0.1} hint="z.B. 3.00" />
              <NumField label="Punkte: PEG sehr niedrig" field="pegVeryLowPoints" hint="z.B. +12" min={-50} max={50} />
              <NumField label="Punkte: PEG moderat" field="pegModeratePoints" hint="z.B. +5" min={-50} max={50} />
              <NumField label="Punkte: PEG hoch" field="pegHighPoints" hint="z.B. -8" min={-50} max={50} />
            </div>
          </CardContent>
        </Card>

        {/* Alert-Trigger */}
        <Card className="bg-[#0d1220] border-[#1e2840]">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base">Alert-Auslöser</CardTitle>
            <p className="text-sm text-gray-400">
              Wann wird eine E-Mail/WhatsApp-Benachrichtigung ausgelöst?
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <NumField
                label="Kauf-Alert Schwelle (Score)"
                field="buyTriggerScore"
                hint="Score muss ≥ diesem Wert sein (z.B. 75)"
                min={50} max={100}
              />
              <NumField
                label="Vorheriger Score (Kauf)"
                field="buyPreviousScoreThreshold"
                hint="Alert nur wenn vorheriger Score < diesem Wert (z.B. 70)"
                min={0} max={100}
              />
              <NumField
                label="Mindest-Score-Anstieg"
                field="scoreChangeTrigger"
                hint="ODER wenn Score um ≥ diesen Wert gestiegen (z.B. 10)"
                min={1} max={50}
              />
              <NumField
                label="Verkauf-Alert Schwelle (Score)"
                field="sellTriggerScore"
                hint="Score muss ≤ diesem Wert sein (z.B. 25)"
                min={0} max={50}
              />
              <NumField
                label="Vorheriger Score (Verkauf)"
                field="sellPreviousScoreThreshold"
                hint="Alert nur wenn vorheriger Score > diesem Wert (z.B. 35)"
                min={0} max={100}
              />
            </div>

            <ScorePreview config={config} />
          </CardContent>
        </Card>

        {/* Save button at bottom */}
        <div className="flex justify-end gap-2 pb-6">
          <Button variant="outline" onClick={reset} className="border-[#2a3a4e] text-gray-300">
            <RotateCcw className="h-4 w-4 mr-2" /> Standard wiederherstellen
          </Button>
          <Button
            onClick={save}
            disabled={!isDirty || updateMutation.isPending}
            className="bg-[#00CFC1] hover:bg-[#00b3a6] text-black"
          >
            <Save className="h-4 w-4 mr-2" />
            {updateMutation.isPending ? "Wird gespeichert..." : "Konfiguration speichern"}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
