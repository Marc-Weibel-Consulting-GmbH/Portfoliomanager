import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Bell, Shield, KeyRound, HelpCircle, PlayCircle, Landmark, Info } from "lucide-react";
import GuidedTourModal from "@/components/GuidedTourModal";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { getUserErrorMessage } from "@/lib/errorMessages";

const VALID_TABS = ["profil", "gebuehren", "benachrichtigungen", "sicherheit", "api", "hilfe"] as const;
type SettingsTab = (typeof VALID_TABS)[number];

// Preset broker configurations
const BROKER_PRESETS: Record<string, {
  brokerName: string;
  feePerTrade: string;
  feePercent: string;
  minFeePerTrade: string;
  maxFeePerTrade: string;
  stampDutyPercent: string;
  currencyConversionFee: string;
}> = {
  swissquote: {
    brokerName: "Swissquote",
    feePerTrade: "9.00",
    feePercent: "0.1",
    minFeePerTrade: "9.00",
    maxFeePerTrade: "200.00",
    stampDutyPercent: "0.075",
    currencyConversionFee: "0.95",
  },
  postfinance: {
    brokerName: "PostFinance",
    feePerTrade: "15.00",
    feePercent: "0.15",
    minFeePerTrade: "15.00",
    maxFeePerTrade: "250.00",
    stampDutyPercent: "0.075",
    currencyConversionFee: "1.50",
  },
  ib: {
    brokerName: "Interactive Brokers",
    feePerTrade: "1.00",
    feePercent: "0.05",
    minFeePerTrade: "1.00",
    maxFeePerTrade: "0",
    stampDutyPercent: "0.075",
    currencyConversionFee: "0.20",
  },
  neon: {
    brokerName: "Neon",
    feePerTrade: "0",
    feePercent: "0.5",
    minFeePerTrade: "0",
    maxFeePerTrade: "0",
    stampDutyPercent: "0.075",
    currencyConversionFee: "0.25",
  },
};

function GebührenTab() {
  const { data: settings, isLoading } = trpc.userSettings.get.useQuery();
  const updateMutation = trpc.userSettings.updateBrokerFees.useMutation({
    onSuccess: () => toast.success("Gebührenstruktur gespeichert"),
    onError: (e) => toast.error("Fehler beim Speichern", { description: getUserErrorMessage(e) }),
  });

  const [form, setForm] = useState({
    brokerName: "",
    feePerTrade: "",
    feePercent: "",
    minFeePerTrade: "",
    maxFeePerTrade: "",
    stampDutyPercent: "0.075",
    currencyConversionFee: "",
  });

  useEffect(() => {
    if (settings) {
      setForm({
        brokerName: settings.brokerName || "",
        feePerTrade: settings.feePerTrade?.toString() || "",
        feePercent: settings.feePercent?.toString() || "",
        minFeePerTrade: settings.minFeePerTrade?.toString() || "",
        maxFeePerTrade: settings.maxFeePerTrade?.toString() || "",
        stampDutyPercent: settings.stampDutyPercent?.toString() || "0.075",
        currencyConversionFee: settings.currencyConversionFee?.toString() || "",
      });
    }
  }, [settings]);

  const applyPreset = (key: string) => {
    const preset = BROKER_PRESETS[key];
    if (preset) setForm(preset);
  };

  const handleSave = () => {
    updateMutation.mutate(form);
  };

  if (isLoading) return <div className="text-gray-400 text-sm py-4">Lade Einstellungen…</div>;

  return (
    <div className="space-y-6">
      {/* Preset Buttons */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Landmark className="h-4 w-4 text-[#00CFC1]" /> Broker-Vorlagen
          </CardTitle>
          <CardDescription>Wählen Sie Ihren Broker für vorkonfigurierte Gebühren</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Object.entries(BROKER_PRESETS).map(([key, preset]) => (
              <Button
                key={key}
                variant="outline"
                size="sm"
                onClick={() => applyPreset(key)}
                className={`border-white/20 text-gray-300 hover:border-[#00CFC1] hover:text-[#00CFC1] ${form.brokerName === preset.brokerName ? 'border-[#00CFC1] text-[#00CFC1]' : ''}`}
              >
                {preset.brokerName}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Fee Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            Gebührenstruktur
          </CardTitle>
          <CardDescription>
            Diese Werte werden für die Gebührenberechnung bei Copilot-Aktionen und Optimierungsvorschlägen verwendet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-2">
            <Label>Broker-Name</Label>
            <Input
              value={form.brokerName}
              onChange={e => setForm(f => ({ ...f, brokerName: e.target.value }))}
              placeholder="z.B. Swissquote"
              className="bg-white/5 border-white/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label className="flex items-center gap-1">
                Fixgebühr pro Trade (CHF)
                <span title="Fester Betrag pro Transaktion" className="cursor-help"><Info className="w-3 h-3 text-gray-500" /></span>
              </Label>
              <Input
                type="number"
                value={form.feePerTrade}
                onChange={e => setForm(f => ({ ...f, feePerTrade: e.target.value }))}
                placeholder="9.00"
                className="bg-white/5 border-white/20"
              />
            </div>
            <div className="grid gap-2">
              <Label className="flex items-center gap-1">
                Variable Gebühr (%)
                <span title="Prozentsatz des Transaktionsvolumens" className="cursor-help"><Info className="w-3 h-3 text-gray-500" /></span>
              </Label>
              <Input
                type="number"
                step="0.01"
                value={form.feePercent}
                onChange={e => setForm(f => ({ ...f, feePercent: e.target.value }))}
                placeholder="0.10"
                className="bg-white/5 border-white/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Mindestgebühr (CHF)</Label>
              <Input
                type="number"
                value={form.minFeePerTrade}
                onChange={e => setForm(f => ({ ...f, minFeePerTrade: e.target.value }))}
                placeholder="9.00"
                className="bg-white/5 border-white/20"
              />
            </div>
            <div className="grid gap-2">
              <Label>Maximalgebühr (CHF, 0 = kein Limit)</Label>
              <Input
                type="number"
                value={form.maxFeePerTrade}
                onChange={e => setForm(f => ({ ...f, maxFeePerTrade: e.target.value }))}
                placeholder="200.00"
                className="bg-white/5 border-white/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label className="flex items-center gap-1">
                Stempelsteuer (%)
                <span title="CH: 0.075% Inland, 0.15% Ausland" className="cursor-help"><Info className="w-3 h-3 text-gray-500" /></span>
              </Label>
              <Input
                type="number"
                step="0.001"
                value={form.stampDutyPercent}
                onChange={e => setForm(f => ({ ...f, stampDutyPercent: e.target.value }))}
                placeholder="0.075"
                className="bg-white/5 border-white/20"
              />
            </div>
            <div className="grid gap-2">
              <Label className="flex items-center gap-1">
                FX-Konvertierungsgebühr (%)
                <span title="Gebühr für Währungsumrechnung (z.B. USD → CHF)" className="cursor-help"><Info className="w-3 h-3 text-gray-500" /></span>
              </Label>
              <Input
                type="number"
                step="0.01"
                value={form.currencyConversionFee}
                onChange={e => setForm(f => ({ ...f, currencyConversionFee: e.target.value }))}
                placeholder="0.95"
                className="bg-white/5 border-white/20"
              />
            </div>
          </div>

          {/* Fee preview */}
          {form.feePerTrade && (
            <div className="bg-white/5 rounded-lg p-4 text-sm">
              <p className="text-gray-400 font-medium mb-2">Gebührenvorschau (Beispiel CHF 10'000 Trade)</p>
              <div className="space-y-1 text-gray-300">
                {(() => {
                  const tradeVal = 10000;
                  const fixFee = parseFloat(form.feePerTrade) || 0;
                  const varFee = (parseFloat(form.feePercent) || 0) / 100 * tradeVal;
                  const totalFee = Math.max(parseFloat(form.minFeePerTrade) || 0, fixFee + varFee);
                  const cappedFee = form.maxFeePerTrade && parseFloat(form.maxFeePerTrade) > 0
                    ? Math.min(totalFee, parseFloat(form.maxFeePerTrade))
                    : totalFee;
                  const stamp = (parseFloat(form.stampDutyPercent) || 0) / 100 * tradeVal;
                  const total = cappedFee + stamp;
                  return (
                    <>
                      <div className="flex justify-between"><span>Handelsgebühr:</span><span>CHF {cappedFee.toFixed(2)}</span></div>
                      <div className="flex justify-between"><span>Stempelsteuer:</span><span>CHF {stamp.toFixed(2)}</span></div>
                      <div className="flex justify-between font-semibold text-white border-t border-white/10 pt-1 mt-1"><span>Total:</span><span>CHF {total.toFixed(2)} ({(total/tradeVal*100).toFixed(3)}%)</span></div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="bg-[#00CFC1] hover:bg-[#00CFC1]/80 text-black font-semibold"
          >
            {updateMutation.isPending ? "Speichern…" : "Gebühren speichern"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Einstellungen() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const rawTab = (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("tab") : null) || "profil";
  const [activeTab, setActiveTab] = useState<string>(VALID_TABS.includes(rawTab as SettingsTab) ? rawTab : "profil");
  const [tourOpen, setTourOpen] = useState(false);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    navigate(`/einstellungen${tab === "profil" ? "" : `?tab=${tab}`}`, { replace: true });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Einstellungen</h1>
          <p className="text-muted-foreground">Verwalten Sie Ihre Konto-Einstellungen und Präferenzen</p>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="flex flex-wrap gap-0 bg-transparent border-b border-white/10 p-0 h-auto rounded-none">
            {[
              { value: "profil", label: "Profil", icon: User },
              { value: "gebuehren", label: "Gebühren", icon: Landmark },
              { value: "benachrichtigungen", label: "Benachrichtigungen", icon: Bell },
              { value: "sicherheit", label: "Sicherheit", icon: Shield },
              { value: "api", label: "API", icon: KeyRound },
              { value: "hilfe", label: "Hilfe", icon: HelpCircle },
            ].map((t) => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#00CFC1] data-[state=active]:text-[#00CFC1] data-[state=active]:bg-transparent text-gray-400 text-sm px-4 pb-3 pt-2 gap-1.5"
              >
                <t.icon className="w-3.5 h-3.5" /> {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="profil" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" /> Profil</CardTitle>
                <CardDescription>Ihre persönlichen Informationen</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2"><Label htmlFor="name">Name</Label><Input id="name" defaultValue={user?.name || ""} disabled /></div>
                <div className="grid gap-2"><Label htmlFor="email">E-Mail</Label><Input id="email" type="email" defaultValue={user?.email || ""} disabled /></div>
                <div className="grid gap-2"><Label htmlFor="username">Benutzername</Label><Input id="username" defaultValue={(user as any)?.username || ""} disabled /></div>
                <p className="text-sm text-muted-foreground">Profildaten werden über OAuth verwaltet und können hier nicht geändert werden.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="gebuehren" className="mt-6">
            <GebührenTab />
          </TabsContent>

          <TabsContent value="benachrichtigungen" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" /> Benachrichtigungen</CardTitle>
                <CardDescription>Verwalten Sie Ihre Benachrichtigungseinstellungen</CardDescription>
              </CardHeader>
              <CardContent><p className="text-sm text-muted-foreground">Benachrichtigungseinstellungen werden in Kürze verfügbar sein.</p></CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sicherheit" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> Sicherheit</CardTitle>
                <CardDescription>2FA, aktive Sessions und Login-Historie</CardDescription>
              </CardHeader>
              <CardContent><p className="text-sm text-muted-foreground">Sicherheitseinstellungen werden über OAuth verwaltet.</p></CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="api" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" /> API</CardTitle>
                <CardDescription>API-Keys & Webhook-URLs (je nach Plan)</CardDescription>
              </CardHeader>
              <CardContent><p className="text-sm text-muted-foreground">API-Zugriff ist Premium-Kunden vorbehalten.</p></CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="hilfe" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><HelpCircle className="h-5 w-5" /> Hilfe</CardTitle>
                <CardDescription>App-Tour, FAQ und Kontakt</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-white font-medium mb-1">App-Tour</p>
                  <p className="text-sm text-muted-foreground mb-3">Starten Sie die geführte Tour erneut, um die wichtigsten Funktionen kennenzulernen.</p>
                  <Button onClick={() => setTourOpen(true)} className="bg-[#00CFC1] hover:bg-[#00CFC1]/80 text-black">
                    <PlayCircle className="h-4 w-4 mr-2" /> App-Tour starten
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <GuidedTourModal open={tourOpen} onOpenChange={setTourOpen} />
    </DashboardLayout>
  );
}
