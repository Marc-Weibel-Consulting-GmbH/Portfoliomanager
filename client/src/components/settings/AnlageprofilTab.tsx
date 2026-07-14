/**
 * AnlageprofilTab — Einstellungen-Tab «Anlageprofil».
 * Zeigt eine Zusammenfassung des gespeicherten Profils mit Bearbeiten-Button.
 * Das Bearbeitungsformular enthält ALLE Felder des Assistenten, aufgeteilt in
 * 5 Sektionen mit Tab-Navigation (kein endloses Scrollen).
 */
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Shield, TrendingUp, Scale, Flame, Clock,
  DollarSign, Pencil, Check, X, AlertCircle, Sparkles,
  Target, Wallet, Brain, Leaf, ChevronLeft, ChevronRight
} from "lucide-react";
import AnlageprofilWizard from "./AnlageprofilWizard";
import AnlageprofilResult from "./AnlageprofilResult";

// ─── Static data ──────────────────────────────────────────────────────────────

const RISK_OPTIONS = [
  { value: "konservativ", label: "Konservativ", icon: <Shield className="h-4 w-4" />, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/30" },
  { value: "ausgewogen", label: "Ausgewogen", icon: <Scale className="h-4 w-4" />, color: "text-[#00CFC1]", bg: "bg-[#00CFC1]/10 border-[#00CFC1]/30" },
  { value: "wachstum", label: "Wachstum", icon: <TrendingUp className="h-4 w-4" />, color: "text-green-400", bg: "bg-green-500/10 border-green-500/30" },
  { value: "aggressiv", label: "Aggressiv", icon: <Flame className="h-4 w-4" />, color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/30" },
];

const GOAL_OPTIONS = [
  { value: "dividends", label: "Ertrag / Dividenden", icon: <DollarSign className="h-4 w-4" />, color: "text-yellow-400" },
  { value: "growth", label: "Wachstum", icon: <TrendingUp className="h-4 w-4" />, color: "text-green-400" },
  { value: "balanced", label: "Ausgewogen", icon: <Scale className="h-4 w-4" />, color: "text-[#00CFC1]" },
];

const SECTOR_OPTIONS = [
  { value: "Energy", label: "Energie (u. a. Öl & Gas)" },
  { value: "Industrials", label: "Industrie (u. a. Rüstung)" },
  { value: "Consumer", label: "Basiskonsum (u. a. Alkohol & Tabak)" },
  { value: "Consumer Cyclical", label: "Zyklischer Konsum (u. a. Glücksspiel, Handel, Reisen)" },
  { value: "Finance", label: "Finanzsektor" },
  { value: "Telecommunications", label: "Telekommunikation" },
];

const EDIT_TABS = [
  { id: "ziel", label: "Ziel & Horizont", icon: <Target className="h-4 w-4" /> },
  { id: "finanzen", label: "Finanzen", icon: <Wallet className="h-4 w-4" /> },
  { id: "risiko", label: "Risikobereitschaft", icon: <Shield className="h-4 w-4" /> },
  { id: "kenntnisse", label: "Kenntnisse", icon: <Brain className="h-4 w-4" /> },
  { id: "praeferenzen", label: "Präferenzen", icon: <Leaf className="h-4 w-4" /> },
];

type FormState = {
  // Ziel & Horizont
  purpose: "aufbau" | "entnahme" | "vorsorge";
  goal: "dividends" | "growth" | "balanced";
  horizonYears: number;
  // Finanzielle Situation
  wealthBand: "u50" | "b50_250" | "b250_1m" | "o1m";
  savingsRateBand: "keine" | "niedrig" | "mittel" | "hoch";
  liquidityReserveBand: "u3m" | "b3_6m" | "b6_12m" | "o12m";
  incomeStability: "niedrig" | "mittel" | "hoch";
  // Risikobereitschaft
  drawdownReaction: "nachkaufen" | "halten" | "teilverkauf" | "verkauf";
  lossComfortPct: number;
  experienceWithLosses: "ja_ok" | "ja_unruhig" | "nein";
  // Kenntnisse
  knowledgeLevel: "einsteiger" | "fortgeschritten" | "erfahren";
  // Präferenzen
  excludedSectors: string[];
  esgOnly: boolean;
  targetReturnPct: string;
  liquidityNeedPct: number;
  referenceCurrency: 'CHF' | 'EUR' | 'USD';
  maxFxExposurePct: number;
};

const FORM_DEFAULTS: FormState = {
  purpose: "aufbau",
  goal: "balanced",
  horizonYears: 10,
  wealthBand: "b50_250",
  savingsRateBand: "mittel",
  liquidityReserveBand: "b3_6m",
  incomeStability: "mittel",
  drawdownReaction: "halten",
  lossComfortPct: 20,
  experienceWithLosses: "ja_unruhig",
  knowledgeLevel: "fortgeschritten",
  excludedSectors: [],
  esgOnly: false,
  targetReturnPct: "",
  liquidityNeedPct: 0,
  referenceCurrency: 'CHF' as const,
  maxFxExposurePct: 50,
};

// ─── Chips helper ─────────────────────────────────────────────────────────────

function Chips<T extends string>({ value, options, onChange, cols = 2 }: {
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (v: T) => void;
  cols?: number;
}) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`text-left rounded-lg border px-3 py-2.5 transition-colors ${
              active
                ? "border-[#00CFC1] bg-[#00CFC1]/10 text-white"
                : "border-white/10 bg-white/[0.02] text-gray-300 hover:border-white/30"
            }`}
          >
            <div className="text-sm font-medium">{o.label}</div>
            {o.hint && <div className="text-xs text-gray-500 mt-0.5">{o.hint}</div>}
          </button>
        );
      })}
    </div>
  );
}

function FieldGroup({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs text-gray-400">{label}</Label>
      {children}
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

// ─── Edit form with tab navigation ───────────────────────────────────────────

function EditForm({
  form,
  setForm,
  onSave,
  onCancel,
  isSaving,
  hasExistingData,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
  hasExistingData: boolean;
}) {
  const [activeTab, setActiveTab] = useState("ziel");
  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const toggleSector = (s: string) => {
    setForm((f) => ({
      ...f,
      excludedSectors: f.excludedSectors.includes(s)
        ? f.excludedSectors.filter((x) => x !== s)
        : [...f.excludedSectors, s],
    }));
  };

  const currentTabIdx = EDIT_TABS.findIndex((t) => t.id === activeTab);
  const isFirst = currentTabIdx === 0;
  const isLast = currentTabIdx === EDIT_TABS.length - 1;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">
            {hasExistingData ? "Anlageprofil bearbeiten" : "Anlageprofil manuell erstellen"}
          </h3>
          <p className="text-sm text-gray-400 mt-0.5">
            Änderungen werden sofort für die KI-Portfolio-Erstellung übernommen.
          </p>
        </div>
        <Button variant="outline" className="border-white/10 text-gray-300 gap-2" onClick={onCancel}>
          <X className="h-4 w-4" /> Abbrechen
        </Button>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-white/10 overflow-x-auto pb-0">
        {EDIT_TABS.map((tab, idx) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-[#00CFC1] text-[#00CFC1]"
                : "border-transparent text-gray-400 hover:text-white hover:border-white/30"
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="sm:hidden">{idx + 1}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <Card className="bg-[#1a1f2e] border-white/10">
        <CardContent className="p-6 space-y-5">

          {/* ── Tab 1: Ziel & Horizont ── */}
          {activeTab === "ziel" && (
            <>
              <FieldGroup label="Wofür legen Sie an?">
                <Chips value={form.purpose} cols={3} onChange={(v) => set({ purpose: v })} options={[
                  { value: "aufbau", label: "Vermögensaufbau" },
                  { value: "entnahme", label: "Regelmässige Entnahme" },
                  { value: "vorsorge", label: "Vorsorge" },
                ]} />
              </FieldGroup>
              <FieldGroup label="Was möchten Sie erreichen?">
                <Chips value={form.goal} cols={3} onChange={(v) => set({ goal: v })} options={[
                  { value: "dividends", label: "Ertrag / Dividenden" },
                  { value: "growth", label: "Wachstum" },
                  { value: "balanced", label: "Ausgewogen" },
                ]} />
              </FieldGroup>
              <FieldGroup label="Anlagehorizont (Jahre)" hint="Wie lange können Sie das Geld investiert lassen?">
                <Input
                  type="number" min={1} max={50}
                  value={form.horizonYears}
                  onChange={(e) => set({ horizonYears: Number(e.target.value) })}
                  className="bg-[#0f1420] border-white/10 text-white max-w-xs"
                />
              </FieldGroup>
            </>
          )}

          {/* ── Tab 2: Finanzielle Situation ── */}
          {activeTab === "finanzen" && (
            <>
              <FieldGroup label="Anlagevermögen (frei verfügbar)">
                <Chips value={form.wealthBand} cols={2} onChange={(v) => set({ wealthBand: v })} options={[
                  { value: "u50", label: "bis 50'000" },
                  { value: "b50_250", label: "50'000 – 250'000" },
                  { value: "b250_1m", label: "250'000 – 1 Mio." },
                  { value: "o1m", label: "über 1 Mio." },
                ]} />
              </FieldGroup>
              <FieldGroup label="Monatliche Sparquote">
                <Chips value={form.savingsRateBand} cols={4} onChange={(v) => set({ savingsRateBand: v })} options={[
                  { value: "keine", label: "Keine" },
                  { value: "niedrig", label: "Niedrig" },
                  { value: "mittel", label: "Mittel" },
                  { value: "hoch", label: "Hoch" },
                ]} />
              </FieldGroup>
              <FieldGroup label="Liquiditätsreserve" hint="Notgroschen ausserhalb der Anlage, in Monatsausgaben.">
                <Chips value={form.liquidityReserveBand} cols={4} onChange={(v) => set({ liquidityReserveBand: v })} options={[
                  { value: "u3m", label: "< 3 Mte." },
                  { value: "b3_6m", label: "3–6 Mte." },
                  { value: "b6_12m", label: "6–12 Mte." },
                  { value: "o12m", label: "> 12 Mte." },
                ]} />
              </FieldGroup>
              <FieldGroup label="Stabilität Ihres Einkommens">
                <Chips value={form.incomeStability} cols={3} onChange={(v) => set({ incomeStability: v })} options={[
                  { value: "niedrig", label: "Eher unsicher" },
                  { value: "mittel", label: "Mittel" },
                  { value: "hoch", label: "Sehr stabil" },
                ]} />
              </FieldGroup>
            </>
          )}

          {/* ── Tab 3: Risikobereitschaft ── */}
          {activeTab === "risiko" && (
            <>
              <FieldGroup label="Ihr Depot fällt in drei Monaten um 20 %. Was tun Sie?">
                <Chips value={form.drawdownReaction} cols={2} onChange={(v) => set({ drawdownReaction: v })} options={[
                  { value: "nachkaufen", label: "Nachkaufen", hint: "Gelegenheit nutzen" },
                  { value: "halten", label: "Halten", hint: "Aussitzen" },
                  { value: "teilverkauf", label: "Teil verkaufen", hint: "Ruhe finden" },
                  { value: "verkauf", label: "Alles verkaufen", hint: "Verluste stoppen" },
                ]} />
              </FieldGroup>
              <FieldGroup label="Maximal tolerierter Jahresverlust (%)" hint="Ab welchem Verlust würden Sie ernsthaft nervös?">
                <Input
                  type="number" min={5} max={80}
                  value={form.lossComfortPct}
                  onChange={(e) => set({ lossComfortPct: Number(e.target.value) })}
                  className="bg-[#0f1420] border-white/10 text-white max-w-xs"
                />
              </FieldGroup>
              <FieldGroup label="Haben Sie schon einmal einen grösseren Kursrückgang erlebt?">
                <Chips value={form.experienceWithLosses} cols={3} onChange={(v) => set({ experienceWithLosses: v })} options={[
                  { value: "ja_ok", label: "Ja, blieb ruhig" },
                  { value: "ja_unruhig", label: "Ja, war unruhig" },
                  { value: "nein", label: "Nein" },
                ]} />
              </FieldGroup>
            </>
          )}

          {/* ── Tab 4: Kenntnisse ── */}
          {activeTab === "kenntnisse" && (
            <FieldGroup label="Wie vertraut sind Sie mit Aktien, ETFs und Anleihen?" hint="Bestimmt, welche Instrumente Ihnen vorgeschlagen werden.">
              <Chips value={form.knowledgeLevel} cols={3} onChange={(v) => set({ knowledgeLevel: v })} options={[
                { value: "einsteiger", label: "Einsteiger", hint: "Wenig Erfahrung" },
                { value: "fortgeschritten", label: "Fortgeschritten", hint: "Grundlagen sicher" },
                { value: "erfahren", label: "Erfahren", hint: "Handle selbst aktiv" },
              ]} />
            </FieldGroup>
          )}

          {/* ── Tab 5: Präferenzen ── */}
          {activeTab === "praeferenzen" && (
            <>
              <FieldGroup label="Ausgeschlossene Sektoren">
                <div className="flex flex-wrap gap-2">
                  {SECTOR_OPTIONS.map((s) => {
                    const active = form.excludedSectors.includes(s.value);
                    return (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => toggleSector(s.value)}
                        className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                          active
                            ? "bg-red-500/20 text-red-400 border-red-500/40"
                            : "bg-white/5 text-gray-300 border-white/10 hover:border-white/30"
                        }`}
                      >
                        {active ? "✕ " : "+ "}{s.label}
                      </button>
                    );
                  })}
                </div>
              </FieldGroup>
              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.esgOnly}
                  onChange={(e) => set({ esgOnly: e.target.checked })}
                  className="h-4 w-4 accent-[#00CFC1]"
                />
                Nur nachhaltige Anlagen (ESG)
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FieldGroup label="Zielrendite p.a. (%, optional)">
                  <Input
                    type="number" min={0} max={100} step="0.5"
                    value={form.targetReturnPct}
                    onChange={(e) => set({ targetReturnPct: e.target.value })}
                    placeholder="z.B. 6"
                    className="bg-[#0f1420] border-white/10 text-white"
                  />
                </FieldGroup>
                <FieldGroup label="Liquiditätsbedarf / Cash-Quote (%)">
                  <Input
                    type="number" min={0} max={100}
                    value={form.liquidityNeedPct}
                    onChange={(e) => set({ liquidityNeedPct: Number(e.target.value) })}
                    className="bg-[#0f1420] border-white/10 text-white"
                  />
                </FieldGroup>
              </div>

              {/* Referenzwährung & Währungsrisiko */}
              <div className="border-t border-white/10 pt-4 mt-2">
                <p className="text-xs text-[#00CFC1] uppercase tracking-wider mb-3 font-semibold">Referenzwährung &amp; Währungsrisiko</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FieldGroup label="Referenzwährung" hint="Ihre Heimwährung – Basis für Performance-Berechnung und Währungsrisiko-Analyse.">
                    <div className="flex gap-2">
                      {(['CHF', 'EUR', 'USD'] as const).map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => set({ referenceCurrency: c })}
                          className={`flex-1 py-2 rounded text-sm font-mono font-semibold border transition-colors ${
                            form.referenceCurrency === c
                              ? 'bg-[#00CFC1]/20 border-[#00CFC1] text-[#00CFC1]'
                              : 'bg-white/5 border-white/10 text-gray-300 hover:border-white/30'
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </FieldGroup>
                  <FieldGroup
                    label={`Max. Fremdwährungsanteil: ${form.maxFxExposurePct}%`}
                    hint="Maximaler Anteil des Portfolios in Fremdwährungen (USD, EUR, GBP etc.). Empfehlung für CHF-Anleger: 30–50%.">
                    <input
                      type="range" min={0} max={100} step={5}
                      value={form.maxFxExposurePct}
                      onChange={(e) => set({ maxFxExposurePct: Number(e.target.value) })}
                      className="w-full accent-[#00CFC1]"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>0% (nur {form.referenceCurrency})</span>
                      <span>50% (ausgewogen)</span>
                      <span>100% (unbegrenzt)</span>
                    </div>
                  </FieldGroup>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Tab navigation footer */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          disabled={isFirst}
          onClick={() => setActiveTab(EDIT_TABS[currentTabIdx - 1].id)}
          className="border-white/10 text-gray-300 gap-1"
        >
          <ChevronLeft className="h-4 w-4" /> Zurück
        </Button>
        <span className="text-xs text-gray-500">
          {currentTabIdx + 1} / {EDIT_TABS.length} · {EDIT_TABS[currentTabIdx].label}
        </span>
        {!isLast ? (
          <Button
            onClick={() => setActiveTab(EDIT_TABS[currentTabIdx + 1].id)}
            className="bg-[#00CFC1] text-black hover:bg-[#00CFC1]/80 gap-1"
          >
            Weiter <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={onSave}
            disabled={isSaving}
            className="bg-[#00CFC1] text-black hover:bg-[#00CFC1]/80 gap-2"
          >
            <Check className="h-4 w-4" />
            {isSaving ? "Wird gespeichert…" : "Profil speichern"}
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AnlageprofilTab() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.investmentProfile.get.useQuery();
  const { data: assessment } = trpc.investmentProfile.getAssessment.useQuery();

  const [editing, setEditing] = useState(false);
  const [wizard, setWizard] = useState(false);
  const [form, setForm] = useState<FormState>(FORM_DEFAULTS);

  // Populate form from existing data
  useEffect(() => {
    if (assessment?.isAssessed && assessment.answers) {
      const a = assessment.answers as any;
      setForm({
        purpose: a.purpose ?? "aufbau",
        goal: a.goal ?? "balanced",
        horizonYears: a.horizonYears ?? 10,
        wealthBand: a.wealthBand ?? "b50_250",
        savingsRateBand: a.savingsRateBand ?? "mittel",
        liquidityReserveBand: a.liquidityReserveBand ?? "b3_6m",
        incomeStability: a.incomeStability ?? "mittel",
        drawdownReaction: a.drawdownReaction ?? "halten",
        lossComfortPct: a.lossComfortPct ?? 20,
        experienceWithLosses: a.experienceWithLosses ?? "ja_unruhig",
        knowledgeLevel: a.knowledgeLevel ?? "fortgeschritten",
        excludedSectors: a.excludedSectors ?? [],
        esgOnly: a.esgOnly ?? false,
        targetReturnPct: a.targetReturnPct != null ? String(a.targetReturnPct) : "",
        liquidityNeedPct: a.liquidityNeedPct ?? 0,
        referenceCurrency: ((a as any).referenceCurrency ?? 'CHF') as 'CHF' | 'EUR' | 'USD',
        maxFxExposurePct: (a as any).maxFxExposurePct ?? 50,
      });
    } else if (data?.isSet) {
      // Fallback: populate from active profile (partial data)
      setForm((f) => ({
        ...f,
        goal: (data.investmentGoal as any) ?? "balanced",
        horizonYears: data.investmentHorizonYears ?? 10,
        lossComfortPct: data.maxDrawdownTolerancePct ?? 20,
        excludedSectors: data.excludedSectors ?? [],
        esgOnly: data.esgOnly ?? false,
        targetReturnPct: data.targetReturnPct != null ? String(data.targetReturnPct) : "",
        liquidityNeedPct: data.liquidityNeedPct ?? 0,
        referenceCurrency: (data.referenceCurrency ?? 'CHF') as 'CHF' | 'EUR' | 'USD',
        maxFxExposurePct: data.maxFxExposurePct ?? 50,
      }));
    } else if (!isLoading && !data?.isSet) {
      setEditing(true);
    }
  }, [assessment, data, isLoading]);

  // Save via saveAssessment so all fields are processed and scoring is applied
  const save = trpc.investmentProfile.saveAssessment.useMutation({
    onSuccess: (r) => {
      toast.success(`Profil gespeichert: ${r.result.bindingProfile}`);
      utils.investmentProfile.get.invalidate();
      utils.investmentProfile.getAssessment.invalidate();
      setEditing(false);
    },
    onError: (e) => toast.error(`Fehler: ${e.message}`),
  });

  const handleSave = () => {
    const tr = form.targetReturnPct.trim();
    save.mutate({
      purpose: form.purpose,
      goal: form.goal,
      horizonYears: form.horizonYears,
      wealthBand: form.wealthBand,
      savingsRateBand: form.savingsRateBand,
      liquidityReserveBand: form.liquidityReserveBand,
      incomeStability: form.incomeStability,
      drawdownReaction: form.drawdownReaction,
      lossComfortPct: form.lossComfortPct,
      experienceWithLosses: form.experienceWithLosses,
      knowledgeLevel: form.knowledgeLevel,
      excludedSectors: form.excludedSectors,
      esgOnly: form.esgOnly,
      targetReturnPct: tr !== "" ? Number(tr) : null,
      liquidityNeedPct: form.liquidityNeedPct,
      referenceCurrency: form.referenceCurrency,
      maxFxExposurePct: form.maxFxExposurePct,
    });
  };

  const handleCancel = () => {
    setEditing(false);
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground py-8 text-center">Anlageprofil wird geladen…</div>;
  }

  // ── Assistent (Anlegerprofil 2.0) ─────────────────────────────────────────
  if (wizard) {
    return (
      <AnlageprofilWizard
        initialAnswers={(assessment?.isAssessed ? (assessment.answers as any) : undefined) ?? undefined}
        onCancel={() => setWizard(false)}
        onDone={() => {
          utils.investmentProfile.get.invalidate();
          utils.investmentProfile.getAssessment.invalidate();
          setWizard(false);
        }}
      />
    );
  }

  // ── Edit form ─────────────────────────────────────────────────────────────
  if (editing) {
    return (
      <EditForm
        form={form}
        setForm={setForm}
        onSave={handleSave}
        onCancel={handleCancel}
        isSaving={save.isPending}
        hasExistingData={!!data?.isSet}
      />
    );
  }

  // ── Summary view ──────────────────────────────────────────────────────────

  const assistantCard = assessment?.isAssessed ? (
    <AnlageprofilResult
      assessment={assessment as any}
      horizonYears={data?.investmentHorizonYears}
      onReassess={() => setWizard(true)}
    />
  ) : (
    <Card className="bg-gradient-to-r from-[#00CFC1]/10 to-[#1a1f2e] border-[#00CFC1]/20">
      <CardContent className="p-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-white font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#00CFC1]" /> Anlageprofil-Assistent
          </p>
          <p className="text-sm text-gray-400 mt-0.5">
            In wenigen Minuten Ihr Profil nach Beratungsstandard ermitteln — steuert Optimierung und KI-Portfolios.
          </p>
        </div>
        <Button className="bg-[#00CFC1] text-[#0a0f1a] hover:bg-[#00CFC1]/90 font-semibold shrink-0 gap-2" onClick={() => setWizard(true)}>
          <Sparkles className="h-4 w-4" /> Assistenten starten
        </Button>
      </CardContent>
    </Card>
  );

  if (!data?.isSet) {
    return (
      <div className="space-y-6">
        {assistantCard}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-[#00CFC1]/10 border border-[#00CFC1]/20">
          <AlertCircle className="h-5 w-5 text-[#00CFC1] shrink-0 mt-0.5" />
          <p className="text-sm text-gray-300">
            Kein Anlageprofil vorhanden. Starten Sie den Assistenten oder bearbeiten Sie das Profil manuell.
          </p>
        </div>
        <Button
          className="bg-[#00CFC1] text-black hover:bg-[#00CFC1]/80 gap-2"
          onClick={() => setEditing(true)}
        >
          <Pencil className="h-4 w-4" /> Manuell bearbeiten
        </Button>
      </div>
    );
  }

  const riskOpt = RISK_OPTIONS.find((r) => r.value === data.riskProfile);
  const goalOpt = GOAL_OPTIONS.find((g) => g.value === data.investmentGoal);

  return (
    <div className="space-y-6">
      {assistantCard}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Ihr Anlageprofil</h3>
          <p className="text-sm text-gray-400 mt-0.5">Dieses Profil steuert die KI-Portfolio-Erstellung und Empfehlungen.</p>
        </div>
        <Button
          variant="outline"
          className="border-white/10 text-gray-300 hover:text-white hover:border-white/30 gap-2"
          onClick={() => setEditing(true)}
        >
          <Pencil className="h-4 w-4" />
          Bearbeiten
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Risikoprofil */}
        <Card className="bg-[#1a1f2e] border-white/10">
          <CardContent className="p-5">
            <p className="text-xs text-gray-500 mb-3 uppercase tracking-wide">Risikoprofil</p>
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium ${riskOpt?.bg} ${riskOpt?.color}`}>
              {riskOpt?.icon}
              {riskOpt?.label}
            </div>
            <div className="mt-3 space-y-1 text-sm text-gray-400">
              <div className="flex justify-between">
                <span>Max. Verlust toleriert</span>
                <span className="text-white font-mono">{data.maxDrawdownTolerancePct}%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Anlageziel */}
        <Card className="bg-[#1a1f2e] border-white/10">
          <CardContent className="p-5">
            <p className="text-xs text-gray-500 mb-3 uppercase tracking-wide">Anlageziel</p>
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-sm font-medium ${goalOpt?.color}`}>
              {goalOpt?.icon}
              {goalOpt?.label}
            </div>
            {data.targetReturnPct != null && (
              <div className="mt-3 text-sm text-gray-400 flex justify-between">
                <span>Zielrendite p.a.</span>
                <span className="text-white font-mono">{data.targetReturnPct}%</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Anlagehorizont */}
        <Card className="bg-[#1a1f2e] border-white/10">
          <CardContent className="p-5">
            <p className="text-xs text-gray-500 mb-3 uppercase tracking-wide">Anlagehorizont</p>
            <div className="flex items-center gap-2 text-white">
              <Clock className="h-5 w-5 text-[#00CFC1]" />
              <span className="text-2xl font-bold">{data.investmentHorizonYears}</span>
              <span className="text-gray-400">Jahre</span>
            </div>
            {data.liquidityNeedPct > 0 && (
              <div className="mt-3 text-sm text-gray-400 flex justify-between">
                <span>Cash-Quote</span>
                <span className="text-white font-mono">{data.liquidityNeedPct}%</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Referenzwährung & Währungsrisiko */}
        <Card className="bg-[#1a1f2e] border-white/10">
          <CardContent className="p-5">
            <p className="text-xs text-gray-500 mb-3 uppercase tracking-wide">Referenzwährung &amp; Währungsrisiko</p>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl font-bold font-mono text-[#00CFC1]">{data.referenceCurrency ?? 'CHF'}</span>
              <span className="text-sm text-gray-400">Referenzwährung</span>
            </div>
            <div className="text-sm text-gray-400 flex justify-between">
              <span>Max. Fremdwährungsanteil</span>
              <span className={`font-mono font-semibold ${
                (data.maxFxExposurePct ?? 50) <= 30 ? 'text-green-400' :
                (data.maxFxExposurePct ?? 50) <= 60 ? 'text-yellow-400' : 'text-orange-400'
              }`}>{data.maxFxExposurePct ?? 50}%</span>
            </div>
          </CardContent>
        </Card>

        {/* Ausgeschlossene Sektoren */}
        <Card className="bg-[#1a1f2e] border-white/10">
          <CardContent className="p-5">
            <p className="text-xs text-gray-500 mb-3 uppercase tracking-wide">Ausgeschlossene Sektoren</p>
            {data.excludedSectors && data.excludedSectors.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {data.excludedSectors.map((s: string) => {
                  const label = SECTOR_OPTIONS.find((o) => o.value === s)?.label ?? s;
                  return (
                    <Badge key={s} variant="outline" className="border-red-500/40 text-red-400 bg-red-500/10 text-xs">
                      {label}
                    </Badge>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Keine Einschränkungen</p>
            )}
            {data.esgOnly && (
              <Badge className="mt-2 bg-green-500/15 text-green-400 border-green-500/30 border text-xs">
                <Check className="h-3 w-3 mr-1" /> Nur ESG
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {/* KI-Portfolio CTA */}
      <Card className="bg-gradient-to-r from-[#00CFC1]/10 to-[#1a1f2e] border-[#00CFC1]/20">
        <CardContent className="p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-white font-medium">Profil ist aktiv</p>
            <p className="text-sm text-gray-400 mt-0.5">Die KI-Portfolio-Erstellung verwendet dieses Profil automatisch.</p>
          </div>
          <Button
            className="bg-[#00CFC1] text-[#0a0f1a] hover:bg-[#00CFC1]/90 font-semibold shrink-0"
            onClick={() => window.location.href = "/portfolio-builder"}
          >
            Neues KI-Portfolio erstellen
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
