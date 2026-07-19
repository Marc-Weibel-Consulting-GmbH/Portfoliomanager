import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Bell, Shield, KeyRound, HelpCircle, PlayCircle, Landmark, Info, Target, ChevronDown, ChevronUp, Mail, MessageSquare } from "lucide-react";
import GuidedTourModal from "@/components/GuidedTourModal";
import AnlageprofilTab from "@/components/settings/AnlageprofilTab";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { getUserErrorMessage } from "@/lib/errorMessages";

const VALID_TABS = ["profil", "anlageprofil", "gebuehren", "benachrichtigungen", "sicherheit", "api", "hilfe"] as const;
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

function BenachrichtigungenTab() {
  const { data: settings, isLoading } = trpc.notificationSettings.getSettings.useQuery();
  const updateMutation = trpc.notificationSettings.updateSettings.useMutation({
    onSuccess: () => toast.success("Benachrichtigungseinstellungen gespeichert"),
    onError: (e) => toast.error("Fehler beim Speichern", { description: getUserErrorMessage(e) }),
  });

  const [whatsappAlerts, setWhatsappAlerts] = useState(false);
  const [mobile, setMobile] = useState("");

  useEffect(() => {
    if (settings) {
      setWhatsappAlerts(settings.whatsappAlerts ?? false);
      setMobile(settings.mobile ?? "");
    }
  }, [settings]);

  if (isLoading) return <div className="text-gray-400 text-sm py-4">Lade Einstellungen…</div>;

  const handleSave = () => {
    updateMutation.mutate({ whatsappAlerts, mobile: mobile || undefined });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4 text-[#00CFC1]" /> Benachrichtigungen
          </CardTitle>
          <CardDescription>Verwalten Sie, wie und wann Sie Benachrichtigungen erhalten</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* WhatsApp Alerts */}
          <div className="flex items-start justify-between gap-4 py-3 border-b border-white/10">
            <div>
              <p className="text-sm font-medium text-white">WhatsApp-Benachrichtigungen</p>
              <p className="text-xs text-gray-500 mt-0.5">Erhalten Sie Kursalarme und Portfolio-Updates via WhatsApp</p>
            </div>
            <button
              onClick={() => setWhatsappAlerts(v => !v)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                whatsappAlerts ? "bg-[#00CFC1]" : "bg-white/20"
              }`}
              role="switch"
              aria-checked={whatsappAlerts}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${
                  whatsappAlerts ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Mobile number (shown when WhatsApp is enabled) */}
          {whatsappAlerts && (
            <div className="space-y-2">
              <Label className="text-gray-400 text-xs">Mobilnummer (mit Ländervorwahl, z.B. +41791234567)</Label>
              <Input
                value={mobile}
                onChange={e => setMobile(e.target.value)}
                placeholder="+41 79 123 45 67"
                className="bg-white/5 border-white/20 max-w-xs"
              />
            </div>
          )}

          {/* Info box */}
          <div className="bg-white/5 rounded-lg p-4 text-xs text-gray-400 space-y-1">
            <p className="font-medium text-gray-300">Hinweis</p>
            <p>Kursalarme können Sie direkt in der Aktiendetailansicht einrichten. WhatsApp-Benachrichtigungen werden über den offiziellen portfolio.mw-Bot versendet.</p>
          </div>

          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="bg-[#00CFC1] hover:bg-[#00CFC1]/80 text-black font-semibold"
          >
            {updateMutation.isPending ? "Speichern…" : "Einstellungen speichern"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── FAQ Section ─────────────────────────────────────────────────────────────
const FAQ_ITEMS = [
  {
    q: "Wie importiere ich mein Portfolio aus einem Bank-PDF?",
    a: "Navigieren Sie zu 'Portfolio erstellen' → 'PDF importieren'. Laden Sie den Depotauszug Ihrer Bank hoch. Swissquote-Dokumente werden regelbasiert gelesen; Depotauszüge anderer Banken (z.B. LUKB, UBS, ZKB, PostFinance, Raiffeisen, Saxo, DEGIRO) werden automatisch erkannt und via KI-Extraktion verarbeitet. Bitte prüfen Sie die erkannten Positionen vor dem Import."
  },
  {
    q: "Was ist der Unterschied zwischen Live- und Demo-Portfolio?",
    a: "Ein Live-Portfolio verfolgt echte Transaktionen mit IRR/MWR-Berechnung. Ein Demo-Portfolio dient zur Analyse und Simulation ohne Transaktionshistorie."
  },
  {
    q: "Wie funktioniert der KI-Portfolio-Builder?",
    a: "Der KI-Builder analysiert Ihr Risikoprofil, Anlagehorizont und Ziele. Basierend auf aktuellen Marktdaten und Scoring-Algorithmen erstellt er einen diversifizierten Portfoliovorschlag."
  },
  {
    q: "Wie werden Kursalarme versendet?",
    a: "Kursalarme werden per E-Mail oder WhatsApp versendet. Richten Sie Alarme in der Aktiendetailansicht ein. WhatsApp-Benachrichtigungen erfordern eine verifizierte Mobilnummer."
  },
  {
    q: "Welche Datenquellen werden verwendet?",
    a: "portfolio.mw nutzt Echtzeitkurse von Finnhub und EODHD, Fundamentaldaten von EODHD sowie Makrodaten von FRED und World Bank. Alle Daten werden täglich aktualisiert."
  },
  {
    q: "Wie berechnet sich die Performance (IRR/MWR)?",
    a: "Die IRR (Internal Rate of Return) berechnet die zeitgewichtete Rendite unter Berücksichtigung aller Ein- und Auszahlungen. Die MWR (Money-Weighted Return) gewichtet nach investiertem Kapital."
  },
];

function FaqSection() {
  const [openIdx, setOpenIdx] = React.useState<number | null>(null);
  return (
    <div className="space-y-2">
      {FAQ_ITEMS.map((item, i) => (
        <div key={i} className="border border-white/10 rounded-lg overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-4 py-3 text-left text-sm text-white hover:bg-white/5 transition-colors"
            onClick={() => setOpenIdx(openIdx === i ? null : i)}
          >
            <span className="font-medium">{item.q}</span>
            {openIdx === i ? <ChevronUp className="h-4 w-4 shrink-0 text-[#00CFC1]" /> : <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />}
          </button>
          {openIdx === i && (
            <div className="px-4 pb-3 text-sm text-gray-400 border-t border-white/5 pt-2">{item.a}</div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Contact Form ─────────────────────────────────────────────────────────────
function ContactForm() {
  const [subject, setSubject] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const notifyOwner = trpc.system.notifyOwner.useMutation();

  const handleSend = async () => {
    if (!subject.trim() || !message.trim()) {
      toast.error("Bitte Betreff und Nachricht ausfüllen");
      return;
    }
    setSending(true);
    try {
      await notifyOwner.mutateAsync({
        title: `[Feedback] ${subject}`,
        content: message,
      });
      toast.success("Nachricht gesendet! Wir melden uns bald bei Ihnen.");
      setSubject("");
      setMessage("");
    } catch {
      toast.error("Nachricht konnte nicht gesendet werden. Bitte versuchen Sie es später erneut.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-1.5">
        <Label htmlFor="contact-subject" className="text-sm text-gray-300">Betreff</Label>
        <Input
          id="contact-subject"
          value={subject}
          onChange={e => setSubject(e.target.value)}
          placeholder="z.B. Fehler melden, Funktion anfragen..."
          className="bg-white/5 border-white/20"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="contact-message" className="text-sm text-gray-300">Nachricht</Label>
        <textarea
          id="contact-message"
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Beschreiben Sie Ihr Anliegen..."
          rows={4}
          className="w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-[#00CFC1] resize-none"
        />
      </div>
      <Button
        onClick={handleSend}
        disabled={sending}
        className="bg-[#00CFC1] hover:bg-[#00CFC1]/80 text-black font-semibold"
      >
        <Mail className="h-4 w-4 mr-2" />
        {sending ? "Wird gesendet…" : "Nachricht senden"}
      </Button>
      <p className="text-xs text-gray-500">Alternativ erreichen Sie uns unter <a href="mailto:support@portfolio.mw" className="text-[#00CFC1] hover:underline">support@portfolio.mw</a></p>
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
              { value: "anlageprofil", label: "Anlageprofil", icon: Target },
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
                {/* N-21: Avatar-Anzeige mit Initialen */}
                <div className="flex items-center gap-4 pb-2 border-b">
                  <div className="w-14 h-14 rounded-full bg-[#00CFC1]/20 border border-[#00CFC1]/30 flex items-center justify-center text-[#00CFC1] text-xl font-bold select-none">
                    {user?.name ? user.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase() : "?"}
                  </div>
                  <div>
                    <div className="font-semibold text-base">{user?.name || "—"}</div>
                    <div className="text-sm text-muted-foreground">{user?.email || "—"}</div>
                  </div>
                </div>
                <div className="grid gap-2"><Label htmlFor="name">Name</Label><Input id="name" defaultValue={user?.name || ""} disabled /></div>
                <div className="grid gap-2"><Label htmlFor="email">E-Mail</Label><Input id="email" type="email" defaultValue={user?.email || ""} disabled /></div>
                <div className="flex items-start gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
                  <span className="text-blue-400 text-xs mt-0.5">ⓘ</span>
                  <p className="text-xs text-muted-foreground">Profildaten werden über Ihren Manus-Account verwaltet. Änderungen nehmen Sie bitte direkt im <a href="https://manus.im" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Manus-Portal</a> vor.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="anlageprofil" className="mt-6">
            <AnlageprofilTab />
          </TabsContent>

          <TabsContent value="gebuehren" className="mt-6">
            <GebührenTab />
          </TabsContent>

          <TabsContent value="benachrichtigungen" className="mt-6">
            <BenachrichtigungenTab />
          </TabsContent>

          <TabsContent value="sicherheit" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> Sicherheit</CardTitle>
                <CardDescription>2FA, aktive Sessions und Login-Schutz</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* N-22: Sicherheits-Hinweis mit Link */}
                <div className="flex items-start gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <Shield className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-emerald-400">Ihr Account ist geschützt</p>
                    <p className="text-xs text-muted-foreground">
                      Sicherheitseinstellungen wie Passwort, Zwei-Faktor-Authentifizierung und aktive Sessions werden über Ihren Manus-Account verwaltet.
                    </p>
                    <a
                      href="https://manus.im"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline mt-1"
                    >
                      Sicherheitseinstellungen im Manus-Portal →
                    </a>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between py-2 border-b">
                    <div>
                      <div className="text-sm font-medium">Letzte Anmeldung</div>
                      <div className="text-xs text-muted-foreground">{user ? new Date((user as any).lastSignedIn || Date.now()).toLocaleString("de-CH") : "—"}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <div className="text-sm font-medium">Anmeldestatus</div>
                      <div className="text-xs text-muted-foreground">Aktiv in dieser Sitzung</div>
                    </div>
                    <span className="flex items-center gap-1 text-xs text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Aktiv
                    </span>
                  </div>
                </div>
              </CardContent>
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
              <CardContent className="space-y-6">
                {/* App-Tour */}
                <div>
                  <p className="text-sm text-white font-medium mb-1">App-Tour</p>
                  <p className="text-sm text-muted-foreground mb-3">Starten Sie die geführte Tour erneut, um die wichtigsten Funktionen kennenzulernen.</p>
                  <Button onClick={() => setTourOpen(true)} className="bg-[#00CFC1] hover:bg-[#00CFC1]/80 text-black">
                    <PlayCircle className="h-4 w-4 mr-2" /> App-Tour starten
                  </Button>
                </div>

                {/* FAQ */}
                <div>
                  <p className="text-sm text-white font-semibold mb-3">Häufig gestellte Fragen (FAQ)</p>
                  <FaqSection />
                </div>

                {/* Kontakt */}
                <div>
                  <p className="text-sm text-white font-semibold mb-3">Kontakt & Feedback</p>
                  <ContactForm />
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
