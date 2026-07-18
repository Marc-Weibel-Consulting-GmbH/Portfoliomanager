import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardLayout from "@/components/DashboardLayout";
import { Calculator, TrendingUp, PiggyBank } from "lucide-react";

// ── Zinseszins-Rechner ──────────────────────────────────────────────────────
function ZinseszinsRechner() {
  const [startkapital, setStartkapital] = useState("10000");
  const [monatlicheSparrate, setMonatlicheSparrate] = useState("500");
  const [renditePA, setRenditePA] = useState("7");
  const [laufzeit, setLaufzeit] = useState("20");
  const [result, setResult] = useState<null | { endwert: number; einzahlungen: number; gewinn: number; jahre: { jahr: number; wert: number }[] }>(null);

  const berechnen = () => {
    const P = parseFloat(startkapital) || 0;
    const m = parseFloat(monatlicheSparrate) || 0;
    const r = (parseFloat(renditePA) || 0) / 100 / 12;
    const n = (parseInt(laufzeit) || 0) * 12;

    let wert = P;
    const jahre: { jahr: number; wert: number }[] = [];
    for (let i = 1; i <= n; i++) {
      wert = wert * (1 + r) + m;
      if (i % 12 === 0) {
        jahre.push({ jahr: i / 12, wert: Math.round(wert) });
      }
    }
    const einzahlungen = P + m * n;
    setResult({ endwert: Math.round(wert), einzahlungen: Math.round(einzahlungen), gewinn: Math.round(wert - einzahlungen), jahre });
  };

  const fmt = (n: number) => n.toLocaleString("de-CH", { style: "currency", currency: "CHF", maximumFractionDigits: 0 });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-[#1a1f2e] border-white/10">
          <CardHeader>
            <CardTitle className="text-white text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-[#00CFC1]" /> Parameter</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-gray-400 text-xs">Startkapital (CHF)</Label>
              <Input value={startkapital} onChange={e => setStartkapital(e.target.value)} type="number" className="bg-[#0f1420] border-white/10 text-white mt-1" />
            </div>
            <div>
              <Label className="text-gray-400 text-xs">Monatliche Sparrate (CHF)</Label>
              <Input value={monatlicheSparrate} onChange={e => setMonatlicheSparrate(e.target.value)} type="number" className="bg-[#0f1420] border-white/10 text-white mt-1" />
            </div>
            <div>
              <Label className="text-gray-400 text-xs">Erwartete Rendite p.a. (%)</Label>
              <Input value={renditePA} onChange={e => setRenditePA(e.target.value)} type="number" step="0.1" className="bg-[#0f1420] border-white/10 text-white mt-1" />
            </div>
            <div>
              <Label className="text-gray-400 text-xs">Laufzeit (Jahre)</Label>
              <Input value={laufzeit} onChange={e => setLaufzeit(e.target.value)} type="number" className="bg-[#0f1420] border-white/10 text-white mt-1" />
            </div>
            <Button onClick={berechnen} className="w-full bg-[#00CFC1] hover:bg-[#00CFC1]/80 text-black font-semibold">
              Berechnen
            </Button>
          </CardContent>
        </Card>

        {result && (
          <Card className="bg-[#1a1f2e] border-[#00CFC1]/30">
            <CardHeader>
              <CardTitle className="text-white text-base">Ergebnis nach {laufzeit} Jahren</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                <div className="bg-[#0f1420] rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">Endwert</p>
                  <p className="text-2xl font-bold text-[#00CFC1]">{fmt(result.endwert)}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#0f1420] rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1">Einzahlungen</p>
                    <p className="text-lg font-semibold text-white">{fmt(result.einzahlungen)}</p>
                  </div>
                  <div className="bg-[#0f1420] rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1">Zinsgewinn</p>
                    <p className="text-lg font-semibold text-emerald-400">{fmt(result.gewinn)}</p>
                  </div>
                </div>
              </div>
              {/* Mini-Tabelle */}
              <div className="max-h-48 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead><tr className="text-gray-500 border-b border-white/10"><th className="text-left py-1">Jahr</th><th className="text-right py-1">Wert</th></tr></thead>
                  <tbody>
                    {result.jahre.filter((_, i) => i % 5 === 4 || i === result.jahre.length - 1).map(j => (
                      <tr key={j.jahr} className="border-b border-white/5">
                        <td className="py-1 text-gray-400">Jahr {j.jahr}</td>
                        <td className="py-1 text-right text-white font-mono">{fmt(j.wert)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ── Dividenden-Rechner ──────────────────────────────────────────────────────
function DividendenRechner() {
  const [investition, setInvestition] = useState("50000");
  const [dividendenrendite, setDividendenrendite] = useState("3.5");
  const [wachstumPA, setWachstumPA] = useState("5");
  const [jahre, setJahre] = useState("10");
  const [result, setResult] = useState<null | { jaehrlich: number; monatlich: number; nach10j: number; gesamtDividenden: number }>(null);

  const berechnen = () => {
    const inv = parseFloat(investition) || 0;
    const yield_ = (parseFloat(dividendenrendite) || 0) / 100;
    const growth = (parseFloat(wachstumPA) || 0) / 100;
    const n = parseInt(jahre) || 0;

    const jaehrlich = inv * yield_;
    const monatlich = jaehrlich / 12;
    const nach10j = inv * yield_ * Math.pow(1 + growth, n);
    let gesamtDividenden = 0;
    for (let i = 0; i < n; i++) {
      gesamtDividenden += inv * yield_ * Math.pow(1 + growth, i);
    }
    setResult({ jaehrlich: Math.round(jaehrlich), monatlich: Math.round(monatlich * 10) / 10, nach10j: Math.round(nach10j), gesamtDividenden: Math.round(gesamtDividenden) });
  };

  const fmt = (n: number) => n.toLocaleString("de-CH", { style: "currency", currency: "CHF", maximumFractionDigits: 0 });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-[#1a1f2e] border-white/10">
          <CardHeader>
            <CardTitle className="text-white text-base flex items-center gap-2"><PiggyBank className="h-4 w-4 text-[#00CFC1]" /> Parameter</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-gray-400 text-xs">Investitionsbetrag (CHF)</Label>
              <Input value={investition} onChange={e => setInvestition(e.target.value)} type="number" className="bg-[#0f1420] border-white/10 text-white mt-1" />
            </div>
            <div>
              <Label className="text-gray-400 text-xs">Aktuelle Dividendenrendite (%)</Label>
              <Input value={dividendenrendite} onChange={e => setDividendenrendite(e.target.value)} type="number" step="0.1" className="bg-[#0f1420] border-white/10 text-white mt-1" />
            </div>
            <div>
              <Label className="text-gray-400 text-xs">Dividendenwachstum p.a. (%)</Label>
              <Input value={wachstumPA} onChange={e => setWachstumPA(e.target.value)} type="number" step="0.1" className="bg-[#0f1420] border-white/10 text-white mt-1" />
            </div>
            <div>
              <Label className="text-gray-400 text-xs">Zeitraum (Jahre)</Label>
              <Input value={jahre} onChange={e => setJahre(e.target.value)} type="number" className="bg-[#0f1420] border-white/10 text-white mt-1" />
            </div>
            <Button onClick={berechnen} className="w-full bg-[#00CFC1] hover:bg-[#00CFC1]/80 text-black font-semibold">
              Berechnen
            </Button>
          </CardContent>
        </Card>

        {result && (
          <Card className="bg-[#1a1f2e] border-[#00CFC1]/30">
            <CardHeader>
              <CardTitle className="text-white text-base">Dividenden-Projektion</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#0f1420] rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">Jährlich (heute)</p>
                  <p className="text-xl font-bold text-[#00CFC1]">{fmt(result.jaehrlich)}</p>
                </div>
                <div className="bg-[#0f1420] rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">Monatlich (heute)</p>
                  <p className="text-xl font-bold text-white">{fmt(result.monatlich)}</p>
                </div>
                <div className="bg-[#0f1420] rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">Jährlich nach {jahre}J</p>
                  <p className="text-xl font-bold text-emerald-400">{fmt(result.nach10j)}</p>
                </div>
                <div className="bg-[#0f1420] rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">Gesamtdividenden {jahre}J</p>
                  <p className="text-xl font-bold text-white">{fmt(result.gesamtDividenden)}</p>
                </div>
              </div>
              <p className="text-xs text-gray-600">Berechnung ohne Reinvestition der Dividenden. Steuern nicht berücksichtigt.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ── Haupt-Komponente ────────────────────────────────────────────────────────
export default function Rechner() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <p className="text-xs font-medium text-[#00CFC1] uppercase tracking-widest mb-1">TOOLS</p>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Calculator className="h-6 w-6 text-[#00CFC1]" /> Finanzrechner
          </h1>
          <p className="text-sm text-gray-400 mt-1">Zinseszins, Dividenden und weitere Berechnungen für Ihre Anlageplanung</p>
        </div>

        <Tabs defaultValue="zinseszins" className="w-full">
          <TabsList className="flex gap-0 bg-transparent border-b border-white/10 p-0 h-auto rounded-none">
            {[
              { value: "zinseszins", label: "Zinseszins" },
              { value: "dividenden", label: "Dividenden" },
            ].map(tab => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#00CFC1] data-[state=active]:text-[#00CFC1] data-[state=active]:bg-transparent text-gray-400 text-sm px-4 pb-3 pt-2"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="zinseszins" className="mt-6">
            <ZinseszinsRechner />
          </TabsContent>
          <TabsContent value="dividenden" className="mt-6">
            <DividendenRechner />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
