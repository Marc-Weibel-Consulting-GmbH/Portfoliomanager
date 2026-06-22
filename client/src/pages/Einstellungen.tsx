import { useState } from "react";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Bell, Shield, KeyRound, HelpCircle, PlayCircle } from "lucide-react";
import GuidedTourModal from "@/components/GuidedTourModal";

const VALID_TABS = ["profil", "benachrichtigungen", "sicherheit", "api", "hilfe"] as const;
type SettingsTab = (typeof VALID_TABS)[number];

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
                <div className="grid gap-2"><Label htmlFor="username">Benutzername</Label><Input id="username" defaultValue={user?.username || ""} disabled /></div>
                <p className="text-sm text-muted-foreground">Profildaten werden über OAuth verwaltet und können hier nicht geändert werden.</p>
              </CardContent>
            </Card>
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
