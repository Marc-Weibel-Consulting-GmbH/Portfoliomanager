/**
 * AnlageprofilTab — Einstellungen-Tab «Anlageprofil».
 * Zeigt eine Zusammenfassung des gespeicherten Profils mit Bearbeiten-Button.
 * Beim ersten Aufruf ohne Profil → direkt in den Bearbeitungsmodus.
 */
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Shield, TrendingUp, Scale, Flame, Clock, Target,
  DollarSign, Pencil, Check, X, AlertCircle, Sparkles
} from "lucide-react";
import AnlageprofilWizard from "./AnlageprofilWizard";

const RISK_LABEL: Record<string, string> = {
  konservativ: "Konservativ", ausgewogen: "Ausgewogen", wachstum: "Wachstum", aggressiv: "Aggressiv",
};

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="text-white font-medium tabular-nums">{value}/100</span>
      </div>
      <div className="h-2 rounded bg-white/10">
        <div className="h-2 rounded bg-[#00CFC1]" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

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

// DB sector names with German display labels
const SECTOR_OPTIONS = [
  { value: "Energy", label: "Fossile Energie" },
  { value: "Industrials", label: "Rüstung / Industrie" },
  { value: "Consumer", label: "Alkohol / Tabak" },
  { value: "Consumer Cyclical", label: "Glücksspiel" },
  { value: "Finance", label: "Finanzsektor" },
  { value: "Telecommunications", label: "Telekommunikation" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function AnlageprofilTab() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.investmentProfile.get.useQuery();
  const { data: assessment } = trpc.investmentProfile.getAssessment.useQuery();

  const [editing, setEditing] = useState(false);
  const [wizard, setWizard] = useState(false);
  const [form, setForm] = useState({
    riskProfile: "ausgewogen",
    investmentHorizonYears: 10,
    maxDrawdownTolerancePct: 20,
    investmentGoal: "balanced",
    targetReturnPct: "" as string,
    liquidityNeedPct: 0,
    excludedSectors: [] as string[],
    esgOnly: false,
  });

  useEffect(() => {
    if (data) {
      setForm({
        riskProfile: data.riskProfile,
        investmentHorizonYears: data.investmentHorizonYears,
        maxDrawdownTolerancePct: data.maxDrawdownTolerancePct,
        investmentGoal: data.investmentGoal,
        targetReturnPct: data.targetReturnPct != null ? String(data.targetReturnPct) : "",
        liquidityNeedPct: data.liquidityNeedPct,
        excludedSectors: data.excludedSectors ?? [],
        esgOnly: data.esgOnly,
      });
    } else if (!isLoading) {
      // No profile yet → open edit mode immediately
      setEditing(true);
    }
  }, [data, isLoading]);

  const save = trpc.investmentProfile.set.useMutation({
    onSuccess: () => {
      toast.success("Anlageprofil gespeichert");
      utils.investmentProfile.get.invalidate();
      setEditing(false);
    },
    onError: (e) => toast.error(`Fehler: ${e.message}`),
  });

  const toggleSector = (s: string) => {
    setForm((f) => ({
      ...f,
      excludedSectors: f.excludedSectors.includes(s)
        ? f.excludedSectors.filter((x) => x !== s)
        : [...f.excludedSectors, s],
    }));
  };

  const handleSave = () => {
    const tr = form.targetReturnPct.trim();
    save.mutate({
      riskProfile: form.riskProfile as any,
      investmentHorizonYears: Number(form.investmentHorizonYears) || 10,
      maxDrawdownTolerancePct: Number(form.maxDrawdownTolerancePct) || 20,
      investmentGoal: form.investmentGoal as any,
      targetReturnPct: tr !== "" ? Number(tr) : null,
      liquidityNeedPct: Number(form.liquidityNeedPct) || 0,
      excludedSectors: form.excludedSectors,
      esgOnly: form.esgOnly,
    });
  };

  const handleCancel = () => {
    if (data) {
      setForm({
        riskProfile: data.riskProfile,
        investmentHorizonYears: data.investmentHorizonYears,
        maxDrawdownTolerancePct: data.maxDrawdownTolerancePct,
        investmentGoal: data.investmentGoal,
        targetReturnPct: data.targetReturnPct != null ? String(data.targetReturnPct) : "",
        liquidityNeedPct: data.liquidityNeedPct,
        excludedSectors: data.excludedSectors ?? [],
        esgOnly: data.esgOnly,
      });
    }
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

  const alloc = (assessment?.isAssessed ? (assessment.strategicAllocation as any) : null) as
    | { equity: number; bond: number; cash: number; targetVolPct: number } | null;

  // Assistent-Karte (Ergebnis oder Einstieg) — steht über der Zusammenfassung.
  const assistantCard = assessment?.isAssessed ? (
    <Card className="bg-[#1a1f2e] border-white/10">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base text-white flex items-center gap-2">
              <Target className="h-4 w-4 text-[#00CFC1]" /> Profil-Bewertung
            </CardTitle>
            <CardDescription>
              Bindendes Profil:{" "}
              <span className="text-white font-semibold">{RISK_LABEL[assessment.bindingProfile] ?? assessment.bindingProfile}</span>{" "}
              (= Minimum aus Fähigkeit und Bereitschaft)
            </CardDescription>
          </div>
          <Button variant="outline" className="border-white/10 text-gray-200 gap-2 shrink-0" onClick={() => setWizard(true)}>
            <Sparkles className="h-4 w-4" /> Neu bewerten
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <ScoreBar label="Risikofähigkeit (was Sie tragen können)" value={assessment.capacityScore} />
          <ScoreBar label="Risikobereitschaft (was Sie tragen wollen)" value={assessment.toleranceScore} />
          {assessment.capacityScore < assessment.toleranceScore && (
            <p className="text-xs text-amber-400">Ihre Risikofähigkeit begrenzt das Profil — die Bereitschaft wäre höher.</p>
          )}
        </div>
        {alloc && (
          <div>
            <p className="text-xs text-gray-400 mb-2">Strategische Musterallokation (Richtwert)</p>
            <div className="flex h-3 rounded overflow-hidden">
              <div style={{ width: `${alloc.equity}%`, background: "#00CFC1" }} />
              <div style={{ width: `${alloc.bond}%`, background: "#3f7c9c" }} />
              <div style={{ width: `${alloc.cash}%`, background: "#6b7684" }} />
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-400">
              <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: "#00CFC1" }} />Aktien {alloc.equity}%</span>
              <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: "#3f7c9c" }} />Anleihen {alloc.bond}%</span>
              <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: "#6b7684" }} />Cash {alloc.cash}%</span>
              <span className="text-gray-500">Zielvolatilität ≈ {alloc.targetVolPct}% p.a.</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  ) : (
    <Card className="bg-gradient-to-r from-[#00CFC1]/10 to-[#1a1f2e] border-[#00CFC1]/20">
      <CardContent className="p-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-white font-medium flex items-center gap-2"><Sparkles className="h-4 w-4 text-[#00CFC1]" /> Anlageprofil-Assistent</p>
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

  // ── Summary view ──────────────────────────────────────────────────────────

  if (!editing && data) {
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
            Manuell bearbeiten
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

  // ── Edit form ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {!data && assistantCard}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">
            {data ? "Anlageprofil bearbeiten" : "Anlageprofil manuell erstellen"}
          </h3>
          <p className="text-sm text-gray-400 mt-0.5">
            {data ? "Änderungen werden sofort für die KI-Portfolio-Erstellung übernommen." : "Legen Sie Ihr Risikoprofil und Ihre Anlageziele fest."}
          </p>
        </div>
        {data && (
          <Button variant="outline" className="border-white/10 text-gray-300 gap-2" onClick={handleCancel}>
            <X className="h-4 w-4" /> Abbrechen
          </Button>
        )}
      </div>

      {!data && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-[#00CFC1]/10 border border-[#00CFC1]/20">
          <AlertCircle className="h-5 w-5 text-[#00CFC1] shrink-0 mt-0.5" />
          <p className="text-sm text-gray-300">
            Kein Anlageprofil vorhanden. Füllen Sie das Formular aus, um die KI-Portfolio-Erstellung zu aktivieren.
            Sie können das Profil auch direkt beim Erstellen eines neuen KI-Portfolios festlegen.
          </p>
        </div>
      )}

      <Card className="bg-[#1a1f2e] border-white/10">
        <CardHeader>
          <CardTitle className="text-base text-white">Risikoprofil</CardTitle>
          <CardDescription>Wie viel Schwankung sind Sie bereit einzugehen?</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-400">Risikoprofil</Label>
            <Select value={form.riskProfile} onValueChange={(v) => setForm({ ...form, riskProfile: v })}>
              <SelectTrigger className="bg-[#0f1420] border-white/10 text-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                {RISK_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    <span className="flex items-center gap-2">{o.icon} {o.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-400">Anlagehorizont (Jahre)</Label>
            <Input
              type="number" min={1} max={50}
              value={form.investmentHorizonYears}
              onChange={(e) => setForm({ ...form, investmentHorizonYears: Number(e.target.value) })}
              className="bg-[#0f1420] border-white/10 text-white"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-400">Max. tolerierter Verlust (%)</Label>
            <Input
              type="number" min={5} max={80}
              value={form.maxDrawdownTolerancePct}
              onChange={(e) => setForm({ ...form, maxDrawdownTolerancePct: Number(e.target.value) })}
              className="bg-[#0f1420] border-white/10 text-white"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[#1a1f2e] border-white/10">
        <CardHeader>
          <CardTitle className="text-base text-white">Anlageziele</CardTitle>
          <CardDescription>Was möchten Sie mit Ihren Anlagen erreichen?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-400">Ziel</Label>
              <Select value={form.investmentGoal} onValueChange={(v) => setForm({ ...form, investmentGoal: v })}>
                <SelectTrigger className="bg-[#0f1420] border-white/10 text-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GOAL_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      <span className="flex items-center gap-2">{o.icon} {o.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-400">Zielrendite p.a. (%, optional)</Label>
              <Input
                type="number" min={0} max={100} step="0.5"
                value={form.targetReturnPct}
                onChange={(e) => setForm({ ...form, targetReturnPct: e.target.value })}
                placeholder="z.B. 6"
                className="bg-[#0f1420] border-white/10 text-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-400">Cash-Quote (%)</Label>
              <Input
                type="number" min={0} max={100}
                value={form.liquidityNeedPct}
                onChange={(e) => setForm({ ...form, liquidityNeedPct: Number(e.target.value) })}
                className="bg-[#0f1420] border-white/10 text-white"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-gray-400">Ausgeschlossene Sektoren</Label>
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
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={form.esgOnly}
              onChange={(e) => setForm({ ...form, esgOnly: e.target.checked })}
              className="h-4 w-4 accent-[#00CFC1]"
            />
            Nur nachhaltige Anlagen (ESG)
          </label>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        {data && (
          <Button variant="outline" className="border-white/10 text-gray-300" onClick={handleCancel}>
            Abbrechen
          </Button>
        )}
        <Button onClick={handleSave} disabled={save.isPending} className="bg-[#00CFC1] text-black hover:bg-[#00CFC1]/80 gap-2">
          <Check className="h-4 w-4" />
          {save.isPending ? "Speichern…" : "Anlageprofil speichern"}
        </Button>
      </div>
    </div>
  );
}
