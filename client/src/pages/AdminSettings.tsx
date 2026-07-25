import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Settings, Save, RotateCcw, PieChart } from "lucide-react";
import { Breadcrumb } from "@/components/Breadcrumb";

interface DiversificationRules {
  maxPositionPercent: number;
  minPositionPercent: number;
  minPositionAmountCHF: number;
  minTitles: number;
  maxTitles: number;
  maxSectorPercent: number;
  maxCurrencyPercent: number;
}

interface FeeStructure {
  buyFeePercent: number;
  sellFeePercent: number;
  minFeeCHF: number;
  maxFeeCHF: number;
  stampDutyPercent: number;
  fxSpreadPercent: number;
}

const DEFAULT_DIVERSIFICATION: DiversificationRules = {
  maxPositionPercent: 10,
  minPositionPercent: 1,
  minPositionAmountCHF: 3000,
  minTitles: 15,
  maxTitles: 20,
  maxSectorPercent: 30,
  maxCurrencyPercent: 100,
};

const DEFAULT_FEES: FeeStructure = {
  buyFeePercent: 0.25,
  sellFeePercent: 0.25,
  minFeeCHF: 9.90,
  maxFeeCHF: 50,
  stampDutyPercent: 0.075,
  fxSpreadPercent: 0.5,
};

type RiskProfile = 'konservativ' | 'ausgewogen' | 'wachstum' | 'aggressiv';
type SleeveKey = 'equity' | 'bond' | 'commodity' | 'gold' | 'realestate' | 'crypto';
type MultiAssetAllocation = Record<RiskProfile, Record<SleeveKey, number>>;

const SLEEVE_LABELS: Record<SleeveKey, string> = {
  equity: 'Aktien',
  bond: 'Obligationen',
  commodity: 'Rohstoffe',
  gold: 'Gold',
  realestate: 'Immobilien',
  crypto: 'Krypto',
};

const PROFILE_LABELS: Record<RiskProfile, string> = {
  konservativ: 'Konservativ',
  ausgewogen: 'Ausgewogen',
  wachstum: 'Wachstum',
  aggressiv: 'Aggressiv',
};

const DEFAULT_MULTI_ASSET: MultiAssetAllocation = {
  konservativ: { equity: 30, bond: 50, commodity: 4, gold: 8, realestate: 8, crypto: 0 },
  ausgewogen:  { equity: 55, bond: 25, commodity: 4, gold: 7, realestate: 6, crypto: 3 },
  wachstum:    { equity: 70, bond: 12, commodity: 4, gold: 6, realestate: 4, crypto: 4 },
  aggressiv:   { equity: 80, bond: 5,  commodity: 3, gold: 4, realestate: 2, crypto: 6 },
};

export default function AdminSettings() {
  const { data: settings, isLoading } = trpc.admin.getAppSettings.useQuery();
  const updateSetting = trpc.admin.updateAppSetting.useMutation();

  const [divRules, setDivRules] = useState<DiversificationRules>(DEFAULT_DIVERSIFICATION);
  const [fees, setFees] = useState<FeeStructure>(DEFAULT_FEES);
  const [multiAsset, setMultiAsset] = useState<MultiAssetAllocation>(DEFAULT_MULTI_ASSET);

  useEffect(() => {
    if (settings) {
      const divSetting = settings.find((s: any) => s.key === 'diversification_rules');
      const feeSetting = settings.find((s: any) => s.key === 'fee_structure');
      const maSetting = settings.find((s: any) => s.key === 'multi_asset_allocation');
      if (divSetting?.value) {
        setDivRules({ ...DEFAULT_DIVERSIFICATION, ...(divSetting.value as any) });
      }
      if (feeSetting?.value) {
        setFees({ ...DEFAULT_FEES, ...(feeSetting.value as any) });
      }
      if (maSetting?.value) {
        const stored = maSetting.value as any;
        const merged: MultiAssetAllocation = { ...DEFAULT_MULTI_ASSET };
        for (const p of Object.keys(DEFAULT_MULTI_ASSET) as RiskProfile[]) {
          if (stored[p]) merged[p] = { ...DEFAULT_MULTI_ASSET[p], ...stored[p] };
        }
        setMultiAsset(merged);
      }
    }
  }, [settings]);

  const updateSleeveValue = (profile: RiskProfile, key: SleeveKey, val: number) => {
    setMultiAsset(prev => ({
      ...prev,
      [profile]: { ...prev[profile], [key]: val },
    }));
  };

  const getRowSum = (profile: RiskProfile) =>
    (Object.keys(SLEEVE_LABELS) as SleeveKey[]).reduce((s, k) => s + (multiAsset[profile][k] || 0), 0);

  const saveMultiAsset = async () => {
    // Validate: each profile must sum to 100
    for (const p of Object.keys(DEFAULT_MULTI_ASSET) as RiskProfile[]) {
      const sum = getRowSum(p);
      if (Math.abs(sum - 100) > 1) {
        toast.error(`${PROFILE_LABELS[p]}: Summe muss 100% ergeben (aktuell ${sum.toFixed(1)}%)`);
        return;
      }
    }
    try {
      await updateSetting.mutateAsync({
        key: 'multi_asset_allocation',
        value: multiAsset,
        description: 'Allokations-Matrix für Multi-Asset-Sleeve (je Anlegerprofil)',
      });
      toast.success('Allokations-Matrix gespeichert');
    } catch (e: any) {
      toast.error(`Fehler: ${e.message}`);
    }
  };

  const saveDiversification = async () => {
    try {
      await updateSetting.mutateAsync({
        key: 'diversification_rules',
        value: divRules,
        description: 'Diversifikationsregeln für KI-Optimierung',
      });
      toast.success('Diversifikationsregeln gespeichert');
    } catch (e: any) {
      toast.error(`Fehler: ${e.message}`);
    }
  };

  const saveFees = async () => {
    try {
      await updateSetting.mutateAsync({
        key: 'fee_structure',
        value: fees,
        description: 'Standard-Gebührenstruktur für Transaktionen',
      });
      toast.success('Gebührenstruktur gespeichert');
    } catch (e: any) {
      toast.error(`Fehler: ${e.message}`);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
      <Breadcrumb
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Einstellungen", icon: <Settings className="h-4 w-4" /> },
        ]}
      />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-2 border-[#00CFC1] border-t-transparent rounded-full" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Settings className="h-6 w-6 text-[#00CFC1]" />
          <h1 className="text-2xl font-bold text-white">App-Einstellungen</h1>
        </div>

        {/* Diversifikationsregeln */}
        <Card className="bg-[#0d1220] border-[#1e2840]">
          <CardHeader>
            <CardTitle className="text-white text-lg">Diversifikationsregeln (KI-Optimierung)</CardTitle>
            <p className="text-sm text-gray-400">
              Diese Regeln werden bei KI-Umschichtungsvorschlägen und der Portfolio-Optimierung angewendet.
              Sie sind für Benutzer nicht sichtbar.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-300">Max. Einzelposition (%)</Label>
                <Input
                  type="number"
                  value={divRules.maxPositionPercent}
                  onChange={(e) => setDivRules({ ...divRules, maxPositionPercent: parseFloat(e.target.value) || 0 })}
                  className="bg-[#1a2332] border-[#2a3a4e] text-white"
                />
                <p className="text-xs text-gray-500 mt-1">Keine Position darf mehr als diesen %-Anteil haben</p>
              </div>
              <div>
                <Label className="text-gray-300">Min. Einzelposition (%)</Label>
                <Input
                  type="number"
                  value={divRules.minPositionPercent}
                  onChange={(e) => setDivRules({ ...divRules, minPositionPercent: parseFloat(e.target.value) || 0 })}
                  className="bg-[#1a2332] border-[#2a3a4e] text-white"
                />
                <p className="text-xs text-gray-500 mt-1">Jede Position muss mindestens diesen %-Anteil haben</p>
              </div>
              <div>
                <Label className="text-gray-300">Min. Positionsgrösse (CHF)</Label>
                <Input
                  type="number"
                  value={divRules.minPositionAmountCHF}
                  onChange={(e) => setDivRules({ ...divRules, minPositionAmountCHF: parseFloat(e.target.value) || 0 })}
                  className="bg-[#1a2332] border-[#2a3a4e] text-white"
                />
                <p className="text-xs text-gray-500 mt-1">Mindestbetrag pro Position in CHF</p>
              </div>
              <div>
                <Label className="text-gray-300">Min. Anzahl Titel</Label>
                <Input
                  type="number"
                  value={divRules.minTitles}
                  onChange={(e) => setDivRules({ ...divRules, minTitles: parseInt(e.target.value) || 0 })}
                  className="bg-[#1a2332] border-[#2a3a4e] text-white"
                />
                <p className="text-xs text-gray-500 mt-1">Portfolio muss mindestens so viele Titel enthalten</p>
              </div>
              <div>
                <Label className="text-gray-300">Max. Anzahl Titel</Label>
                <Input
                  type="number"
                  value={divRules.maxTitles}
                  onChange={(e) => setDivRules({ ...divRules, maxTitles: parseInt(e.target.value) || 0 })}
                  className="bg-[#1a2332] border-[#2a3a4e] text-white"
                />
                <p className="text-xs text-gray-500 mt-1">Maximale Anzahl Titel im Portfolio</p>
              </div>
              <div>
                <Label className="text-gray-300">Max. Sektor-Anteil (%)</Label>
                <Input
                  type="number"
                  value={divRules.maxSectorPercent}
                  onChange={(e) => setDivRules({ ...divRules, maxSectorPercent: parseFloat(e.target.value) || 0 })}
                  className="bg-[#1a2332] border-[#2a3a4e] text-white"
                />
                <p className="text-xs text-gray-500 mt-1">Kein Sektor darf mehr als diesen %-Anteil haben</p>
              </div>
              <div>
                <Label className="text-gray-300">Max. Währungs-Anteil (%)</Label>
                <Input
                  type="number"
                  value={divRules.maxCurrencyPercent}
                  onChange={(e) => setDivRules({ ...divRules, maxCurrencyPercent: parseFloat(e.target.value) || 0 })}
                  className="bg-[#1a2332] border-[#2a3a4e] text-white"
                />
                <p className="text-xs text-gray-500 mt-1">Klumpenrisiko je Währung — 100 = Regel inaktiv</p>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={saveDiversification} className="bg-[#00CFC1] hover:bg-[#00b3a6] text-black">
                <Save className="h-4 w-4 mr-2" /> Speichern
              </Button>
              <Button variant="outline" onClick={() => setDivRules(DEFAULT_DIVERSIFICATION)} className="border-[#2a3a4e] text-gray-300">
                <RotateCcw className="h-4 w-4 mr-2" /> Zurücksetzen
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Gebührenstruktur */}
        <Card className="bg-[#0d1220] border-[#1e2840]">
          <CardHeader>
            <CardTitle className="text-white text-lg">Gebührenstruktur</CardTitle>
            <p className="text-sm text-gray-400">
              Standard-Gebühren für automatische Transaktionsberechnung bei Live-Portfolios.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-gray-300">Kaufgebühr (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={fees.buyFeePercent}
                  onChange={(e) => setFees({ ...fees, buyFeePercent: parseFloat(e.target.value) || 0 })}
                  className="bg-[#1a2332] border-[#2a3a4e] text-white"
                />
              </div>
              <div>
                <Label className="text-gray-300">Verkaufsgebühr (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={fees.sellFeePercent}
                  onChange={(e) => setFees({ ...fees, sellFeePercent: parseFloat(e.target.value) || 0 })}
                  className="bg-[#1a2332] border-[#2a3a4e] text-white"
                />
              </div>
              <div>
                <Label className="text-gray-300">Min. Gebühr (CHF)</Label>
                <Input
                  type="number"
                  step="0.10"
                  value={fees.minFeeCHF}
                  onChange={(e) => setFees({ ...fees, minFeeCHF: parseFloat(e.target.value) || 0 })}
                  className="bg-[#1a2332] border-[#2a3a4e] text-white"
                />
              </div>
              <div>
                <Label className="text-gray-300">Max. Gebühr (CHF)</Label>
                <Input
                  type="number"
                  step="1"
                  value={fees.maxFeeCHF}
                  onChange={(e) => setFees({ ...fees, maxFeeCHF: parseFloat(e.target.value) || 0 })}
                  className="bg-[#1a2332] border-[#2a3a4e] text-white"
                />
              </div>
              <div>
                <Label className="text-gray-300">Stempelsteuer (%)</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={fees.stampDutyPercent}
                  onChange={(e) => setFees({ ...fees, stampDutyPercent: parseFloat(e.target.value) || 0 })}
                  className="bg-[#1a2332] border-[#2a3a4e] text-white"
                />
              </div>
              <div>
                <Label className="text-gray-300">FX-Spread (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={fees.fxSpreadPercent}
                  onChange={(e) => setFees({ ...fees, fxSpreadPercent: parseFloat(e.target.value) || 0 })}
                  className="bg-[#1a2332] border-[#2a3a4e] text-white"
                />
                <p className="text-xs text-gray-500 mt-1">Aufschlag bei Fremdwährungstransaktionen</p>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={saveFees} className="bg-[#00CFC1] hover:bg-[#00b3a6] text-black">
                <Save className="h-4 w-4 mr-2" /> Speichern
              </Button>
              <Button variant="outline" onClick={() => setFees(DEFAULT_FEES)} className="border-[#2a3a4e] text-gray-300">
                <RotateCcw className="h-4 w-4 mr-2" /> Zurücksetzen
              </Button>
            </div>
          </CardContent>
        </Card>
        {/* ── Multi-Asset Allokations-Matrix ─────────────────────────────── */}
        <Card className="bg-[#0f1923] border-[#1e2d3d]">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <PieChart className="h-5 w-5 text-[#00CFC1]" />
              Multi-Asset Allokations-Matrix
            </CardTitle>
            <p className="text-sm text-gray-400">
              Ziel-Quoten (%) je Anlegerprofil. Summe pro Zeile muss 100 % ergeben.
              Wird vom KI-Portfolio-Builder verwendet.
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1e2d3d]">
                    <th className="text-left py-2 pr-4 text-gray-400 font-medium">Profil</th>
                    {(Object.keys(SLEEVE_LABELS) as SleeveKey[]).map(k => (
                      <th key={k} className="text-center py-2 px-2 text-gray-400 font-medium">{SLEEVE_LABELS[k]}</th>
                    ))}
                    <th className="text-center py-2 px-2 text-gray-400 font-medium">Summe</th>
                  </tr>
                </thead>
                <tbody>
                  {(Object.keys(DEFAULT_MULTI_ASSET) as RiskProfile[]).map(profile => {
                    const sum = getRowSum(profile);
                    const sumOk = Math.abs(sum - 100) <= 1;
                    return (
                      <tr key={profile} className="border-b border-[#1e2d3d] last:border-0">
                        <td className="py-3 pr-4 text-gray-300 font-medium whitespace-nowrap">{PROFILE_LABELS[profile]}</td>
                        {(Object.keys(SLEEVE_LABELS) as SleeveKey[]).map(key => (
                          <td key={key} className="py-2 px-2">
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              step={1}
                              value={multiAsset[profile][key]}
                              onChange={e => updateSleeveValue(profile, key, parseFloat(e.target.value) || 0)}
                              className="bg-[#1a2332] border-[#2a3a4e] text-white text-center w-16 h-8 px-1"
                            />
                          </td>
                        ))}
                        <td className={`py-2 px-2 text-center font-bold ${
                          sumOk ? 'text-[#00CFC1]' : 'text-red-400'
                        }`}>{sum.toFixed(0)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2 pt-4">
              <Button onClick={saveMultiAsset} className="bg-[#00CFC1] hover:bg-[#00b3a6] text-black">
                <Save className="h-4 w-4 mr-2" /> Speichern
              </Button>
              <Button variant="outline" onClick={() => setMultiAsset(DEFAULT_MULTI_ASSET)} className="border-[#2a3a4e] text-gray-300">
                <RotateCcw className="h-4 w-4 mr-2" /> Auf Standard zurücksetzen
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
