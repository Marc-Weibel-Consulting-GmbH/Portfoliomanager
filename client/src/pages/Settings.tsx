import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";

export default function Settings({ onBackClick }: { onBackClick: () => void }) {
  const { user } = useAuth();
  const [username, setUsername] = useState(user?.username || user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Notification preferences from user object
  const [whatsappAlerts, setWhatsappAlerts] = useState(user?.whatsappAlerts === 1);
  const [emailNotifications, setEmailNotifications] = useState(true); // TODO: Add to schema
  const [newsletterSubscribed, setNewsletterSubscribed] = useState(false); // TODO: Add to schema

  // Investment preferences
  const [investmentGoal, setInvestmentGoal] = useState<"dividends" | "growth" | "balanced" | null>(
    user?.investmentGoal || null
  );
  const [riskTolerance, setRiskTolerance] = useState<"low" | "medium" | "high" | null>(
    user?.riskTolerance || null
  );
  const [investmentHorizon, setInvestmentHorizon] = useState<"short" | "medium" | "long" | null>(
    user?.investmentHorizon || null
  );

  const updateProfileMutation = trpc.user.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Profil aktualisiert", {
        description: "Ihre Änderungen wurden gespeichert",
      });
    },
    onError: (error) => {
      toast.error("Fehler", {
        description: error.message,
      });
    },
  });

  const updatePasswordMutation = trpc.user.updatePassword.useMutation({
    onSuccess: () => {
      toast.success("Passwort geändert", {
        description: "Ihr Passwort wurde erfolgreich aktualisiert",
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error) => {
      toast.error("Fehler", {
        description: error.message,
      });
    },
  });

  const updateNotificationsMutation = trpc.user.updateNotifications.useMutation({
    onSuccess: () => {
      toast.success("Benachrichtigungen aktualisiert", {
        description: "Ihre Einstellungen wurden gespeichert",
      });
    },
    onError: (error) => {
      toast.error("Fehler", {
        description: error.message,
      });
    },
  });

  const updatePreferencesMutation = trpc.auth.updatePreferences.useMutation({
    onSuccess: () => {
      toast.success("Anlagepräferenzen aktualisiert", {
        description: "Ihre Einstellungen wurden gespeichert",
      });
      // Refresh page to update user data
      window.location.reload();
    },
    onError: (error) => {
      toast.error("Fehler", {
        description: error.message,
      });
    },
  });

  const handleUpdateProfile = () => {
    if (!username.trim()) {
      toast.error("Fehler", { description: "Benutzername darf nicht leer sein" });
      return;
    }
    if (!email.trim()) {
      toast.error("Fehler", { description: "Email darf nicht leer sein" });
      return;
    }

    updateProfileMutation.mutate({
      username: username.trim(),
      email: email.trim(),
    });
  };

  const handleUpdatePassword = () => {
    if (!currentPassword) {
      toast.error("Fehler", { description: "Aktuelles Passwort erforderlich" });
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Fehler", { description: "Neues Passwort muss mindestens 8 Zeichen lang sein" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Fehler", { description: "Passwörter stimmen nicht überein" });
      return;
    }

    updatePasswordMutation.mutate({
      currentPassword,
      newPassword,
    });
  };

  const handleUpdateNotifications = () => {
    updateNotificationsMutation.mutate({
      whatsappAlerts,
      emailNotifications,
      newsletterSubscribed,
    });
  };

  const handleUpdatePreferences = () => {
    const updates: {
      investmentGoal?: "dividends" | "growth" | "balanced";
      riskTolerance?: "low" | "medium" | "high";
      investmentHorizon?: "short" | "medium" | "long";
    } = {};

    if (investmentGoal) updates.investmentGoal = investmentGoal;
    if (riskTolerance) updates.riskTolerance = riskTolerance;
    if (investmentHorizon) updates.investmentHorizon = investmentHorizon;

    if (Object.keys(updates).length === 0) {
      toast.error("Fehler", { description: "Keine Änderungen vorgenommen" });
      return;
    }

    updatePreferencesMutation.mutate(updates);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={onBackClick}
            className="text-muted-foreground hover:text-white transition-colors"
          >
            ← Zurück
          </button>
          <h1 className="text-4xl font-bold text-white">Einstellungen</h1>
        </div>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-3 gradient-card border-border/50">
            <TabsTrigger value="profile" className="text-white data-[state=active]:bg-teal-600 data-[state=active]:text-white">
              Profil
            </TabsTrigger>
            <TabsTrigger value="preferences" className="text-white data-[state=active]:bg-teal-600 data-[state=active]:text-white">
              Anlagepräferenzen
            </TabsTrigger>
            <TabsTrigger value="notifications" className="text-white data-[state=active]:bg-teal-600 data-[state=active]:text-white">
              Benachrichtigungen
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6 mt-6">
            {/* Profile Information */}
            <Card className="gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="text-white">Profil-Informationen</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Aktualisieren Sie Ihren Benutzernamen und Email-Adresse
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-foreground">
                    Benutzername
                  </Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="bg-muted border-border text-white"
                    placeholder="Ihr Benutzername"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-foreground">
                    Email-Adresse
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-muted border-border text-white"
                    placeholder="ihre.email@example.com"
                  />
                </div>

                <Button
                  onClick={handleUpdateProfile}
                  disabled={updateProfileMutation.isPending}
                  className="bg-teal-600 hover:bg-teal-700 text-white"
                >
                  {updateProfileMutation.isPending ? "Speichern..." : "Profil speichern"}
                </Button>
              </CardContent>
            </Card>

            {/* Password Change */}
            <Card className="gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="text-white">Passwort ändern</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Ändern Sie Ihr Passwort für mehr Sicherheit
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword" className="text-foreground">
                    Aktuelles Passwort
                  </Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="bg-muted border-border text-white"
                    placeholder="••••••••"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="text-foreground">
                    Neues Passwort
                  </Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="bg-muted border-border text-white"
                    placeholder="••••••••"
                  />
                  <p className="text-xs text-slate-500">Mindestens 8 Zeichen</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-foreground">
                    Passwort bestätigen
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="bg-muted border-border text-white"
                    placeholder="••••••••"
                  />
                </div>

                <Button
                  onClick={handleUpdatePassword}
                  disabled={updatePasswordMutation.isPending}
                  className="bg-teal-600 hover:bg-teal-700 text-white"
                >
                  {updatePasswordMutation.isPending ? "Ändern..." : "Passwort ändern"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preferences" className="space-y-6 mt-6">
            <Card className="gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="text-white">Anlagepräferenzen</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Passen Sie Ihre Investmentstrategie an Ihre Ziele an
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Investment Goal */}
                <div className="space-y-3">
                  <Label className="text-white font-medium">Anlageziel</Label>
                  <RadioGroup
                    value={investmentGoal || ""}
                    onValueChange={(value) => setInvestmentGoal(value as "dividends" | "growth" | "balanced")}
                  >
                    <div className="flex items-start space-x-3 p-4 bg-muted/30 rounded-lg">
                      <RadioGroupItem value="dividends" id="div-pref" />
                      <div className="flex-1">
                        <Label htmlFor="div-pref" className="text-white cursor-pointer">Dividenden</Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          Fokus auf regelmäßige Ausschüttungen und passives Einkommen
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 p-4 bg-muted/30 rounded-lg">
                      <RadioGroupItem value="growth" id="growth-pref" />
                      <div className="flex-1">
                        <Label htmlFor="growth-pref" className="text-white cursor-pointer">Wachstum</Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          Maximierung der Kapitalgewinne durch Wertsteigerung
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 p-4 bg-muted/30 rounded-lg">
                      <RadioGroupItem value="balanced" id="bal-pref" />
                      <div className="flex-1">
                        <Label htmlFor="bal-pref" className="text-white cursor-pointer">Ausgewogen</Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          Kombination aus Dividenden und Wachstum
                        </p>
                      </div>
                    </div>
                  </RadioGroup>
                </div>

                {/* Risk Tolerance */}
                <div className="space-y-3">
                  <Label className="text-white font-medium">Risikobereitschaft</Label>
                  <RadioGroup
                    value={riskTolerance || ""}
                    onValueChange={(value) => setRiskTolerance(value as "low" | "medium" | "high")}
                  >
                    <div className="flex items-start space-x-3 p-4 bg-muted/30 rounded-lg">
                      <RadioGroupItem value="low" id="low-pref" />
                      <div className="flex-1">
                        <Label htmlFor="low-pref" className="text-white cursor-pointer">Niedrig (Konservativ)</Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          Geringe Schwankungen, stabile Renditen
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 p-4 bg-muted/30 rounded-lg">
                      <RadioGroupItem value="medium" id="med-pref" />
                      <div className="flex-1">
                        <Label htmlFor="med-pref" className="text-white cursor-pointer">Mittel (Moderat)</Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          Ausgewogenes Verhältnis zwischen Risiko und Rendite
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 p-4 bg-muted/30 rounded-lg">
                      <RadioGroupItem value="high" id="high-pref" />
                      <div className="flex-1">
                        <Label htmlFor="high-pref" className="text-white cursor-pointer">Hoch (Aggressiv)</Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          Höhere Schwankungen für potenziell höhere Renditen
                        </p>
                      </div>
                    </div>
                  </RadioGroup>
                </div>

                {/* Investment Horizon */}
                <div className="space-y-3">
                  <Label className="text-white font-medium">Anlagehorizont</Label>
                  <RadioGroup
                    value={investmentHorizon || ""}
                    onValueChange={(value) => setInvestmentHorizon(value as "short" | "medium" | "long")}
                  >
                    <div className="flex items-start space-x-3 p-4 bg-muted/30 rounded-lg">
                      <RadioGroupItem value="short" id="short-pref" />
                      <div className="flex-1">
                        <Label htmlFor="short-pref" className="text-white cursor-pointer">Kurzfristig (&lt; 3 Jahre)</Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          Für kurzfristige Sparziele
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 p-4 bg-muted/30 rounded-lg">
                      <RadioGroupItem value="medium" id="med-hor-pref" />
                      <div className="flex-1">
                        <Label htmlFor="med-hor-pref" className="text-white cursor-pointer">Mittelfristig (3-10 Jahre)</Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          Für mittelfristige Vermögensbildung
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 p-4 bg-muted/30 rounded-lg">
                      <RadioGroupItem value="long" id="long-pref" />
                      <div className="flex-1">
                        <Label htmlFor="long-pref" className="text-white cursor-pointer">Langfristig (&gt; 10 Jahre)</Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          Für Altersvorsorge und langfristigen Vermögensaufbau
                        </p>
                      </div>
                    </div>
                  </RadioGroup>
                </div>

                <Button
                  onClick={handleUpdatePreferences}
                  disabled={updatePreferencesMutation.isPending}
                  className="bg-teal-600 hover:bg-teal-700 text-white w-full"
                >
                  {updatePreferencesMutation.isPending ? "Speichern..." : "Präferenzen speichern"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6 mt-6">
            <Card className="gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="text-white">Benachrichtigungs-Einstellungen</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Verwalten Sie, wie Sie über Änderungen informiert werden möchten
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* WhatsApp Alerts */}
                <div className="flex items-center justify-between space-x-4 p-4 bg-muted/30 rounded-lg">
                  <div className="flex-1">
                    <Label htmlFor="whatsapp" className="text-white font-medium">
                      WhatsApp-Benachrichtigungen
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Erhalten Sie wichtige Aktien-Alerts per WhatsApp
                    </p>
                  </div>
                  <Switch
                    id="whatsapp"
                    checked={whatsappAlerts}
                    onCheckedChange={setWhatsappAlerts}
                  />
                </div>

                {/* Email Notifications */}
                <div className="flex items-center justify-between space-x-4 p-4 bg-muted/30 rounded-lg">
                  <div className="flex-1">
                    <Label htmlFor="email-notif" className="text-white font-medium">
                      Email-Benachrichtigungen
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Erhalten Sie Portfolio-Updates und Alerts per Email
                    </p>
                  </div>
                  <Switch
                    id="email-notif"
                    checked={emailNotifications}
                    onCheckedChange={setEmailNotifications}
                  />
                </div>

                {/* Newsletter */}
                <div className="flex items-center justify-between space-x-4 p-4 bg-muted/30 rounded-lg">
                  <div className="flex-1">
                    <Label htmlFor="newsletter" className="text-white font-medium">
                      Newsletter
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Erhalten Sie wöchentliche Marktanalysen und Investment-Tipps
                    </p>
                  </div>
                  <Switch
                    id="newsletter"
                    checked={newsletterSubscribed}
                    onCheckedChange={setNewsletterSubscribed}
                  />
                </div>

                <Button
                  onClick={handleUpdateNotifications}
                  disabled={updateNotificationsMutation.isPending}
                  className="bg-teal-600 hover:bg-teal-700 text-white"
                >
                  {updateNotificationsMutation.isPending ? "Speichern..." : "Einstellungen speichern"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
