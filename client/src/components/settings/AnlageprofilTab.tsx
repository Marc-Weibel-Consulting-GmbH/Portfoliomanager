/**
 * AnlageprofilTab — Einstellungen-Tab «Anlageprofil» (Konzept F1).
 * Risikoprofil + Anlageziele; speist später Optimizer/Empfehlungen und schaltet die
 * automatische Portfolio-Erstellung frei.
 */
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const RISK_OPTIONS = [
  { value: "konservativ", label: "Konservativ" },
  { value: "ausgewogen", label: "Ausgewogen" },
  { value: "wachstum", label: "Wachstum" },
  { value: "aggressiv", label: "Aggressiv" },
];
const GOAL_OPTIONS = [
  { value: "dividends", label: "Ertrag / Dividenden" },
  { value: "growth", label: "Wachstum" },
  { value: "balanced", label: "Ausgewogen" },
];
// Häufige Sektoren zum Ausschliessen (frei erweiterbar über Komma-Eingabe).
const COMMON_SECTORS = ["Tabak", "Rüstung", "Glücksspiel", "Fossile Energie", "Alkohol"];

export default function AnlageprofilTab() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.investmentProfile.get.useQuery();

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
    }
  }, [data]);

  const save = trpc.investmentProfile.set.useMutation({
    onSuccess: () => {
      toast.success("Anlageprofil gespeichert");
      utils.investmentProfile.get.invalidate();
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

  if (isLoading) {
    return <div className="text-sm text-muted-foreground py-8 text-center">Anlageprofil wird geladen…</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Risikoprofil</CardTitle>
          <CardDescription>
            Wie viel Schwankung sind Sie bereit einzugehen? Dieses Profil steuert die
            Optimierung und die Empfehlungen für Ihre Portfolios.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Risikoprofil</Label>
            <Select value={form.riskProfile} onValueChange={(v) => setForm({ ...form, riskProfile: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {RISK_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Anlagehorizont (Jahre)</Label>
            <Input
              type="number" min={1} max={50}
              value={form.investmentHorizonYears}
              onChange={(e) => setForm({ ...form, investmentHorizonYears: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Max. tolerierter Verlust (%)</Label>
            <Input
              type="number" min={5} max={80}
              value={form.maxDrawdownTolerancePct}
              onChange={(e) => setForm({ ...form, maxDrawdownTolerancePct: Number(e.target.value) })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Anlageziele</CardTitle>
          <CardDescription>Was möchten Sie mit Ihren Anlagen erreichen?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Ziel</Label>
              <Select value={form.investmentGoal} onValueChange={(v) => setForm({ ...form, investmentGoal: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GOAL_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Zielrendite p.a. (%, optional)</Label>
              <Input
                type="number" min={0} max={100} step="0.5"
                value={form.targetReturnPct}
                onChange={(e) => setForm({ ...form, targetReturnPct: e.target.value })}
                placeholder="z.B. 6"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Liquiditätsbedarf / Cash-Quote (%)</Label>
              <Input
                type="number" min={0} max={100}
                value={form.liquidityNeedPct}
                onChange={(e) => setForm({ ...form, liquidityNeedPct: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Ausgeschlossene Sektoren</Label>
            <div className="flex flex-wrap gap-2">
              {COMMON_SECTORS.map((s) => {
                const active = form.excludedSectors.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSector(s)}
                    className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                      active
                        ? "bg-red-500/20 text-red-400 border-red-500/40"
                        : "bg-white/5 text-gray-300 border-white/10 hover:border-white/30"
                    }`}
                  >
                    {active ? "✕ " : "+ "}{s}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
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

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={save.isPending} className="bg-[#00CFC1] text-black hover:bg-[#00CFC1]/80">
          {save.isPending ? "Speichern…" : "Anlageprofil speichern"}
        </Button>
      </div>
    </div>
  );
}
