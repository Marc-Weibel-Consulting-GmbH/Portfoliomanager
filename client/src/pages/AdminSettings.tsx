import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Settings, Save, RotateCcw } from "lucide-react";

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

export default function AdminSettings() {
  const { data: settings, isLoading } = trpc.admin.getAppSettings.useQuery();
  const updateSetting = trpc.admin.updateAppSetting.useMutation();

  const [divRules, setDivRules] = useState<DiversificationRules>(DEFAULT_DIVERSIFICATION);
  const [fees, setFees] = useState<FeeStructure>(DEFAULT_FEES);

  useEffect(() => {
    if (settings) {
      const divSetting = settings.find((s: any) => s.key === 'diversification_rules');
      const feeSetting = settings.find((s: any) => s.key === 'fee_structure');
      if (divSetting?.value) {
        setDivRules({ ...DEFAULT_DIVERSIFICATION, ...(divSetting.value as any) });
      }
      if (feeSetting?.value) {
        setFees({ ...DEFAULT_FEES, ...(feeSetting.value as any) });
      }
    }
  }, [settings]);

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
      </div>
    </DashboardLayout>
  );
}
