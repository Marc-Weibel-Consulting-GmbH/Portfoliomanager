import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={onBackClick}
            className="text-slate-400 hover:text-white transition-colors"
          >
            ← Zurück
          </button>
          <h1 className="text-4xl font-bold text-white">Einstellungen</h1>
        </div>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-slate-800 border-slate-700">
            <TabsTrigger value="profile" className="data-[state=active]:bg-teal-600">
              Profil
            </TabsTrigger>
            <TabsTrigger value="notifications" className="data-[state=active]:bg-teal-600 data-[state=active]:text-white">
              Benachrichtigungen
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6 mt-6">
            {/* Profile Information */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Profil-Informationen</CardTitle>
                <CardDescription className="text-slate-400">
                  Aktualisieren Sie Ihren Benutzernamen und Email-Adresse
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-slate-300">
                    Benutzername
                  </Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white"
                    placeholder="Ihr Benutzername"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-300">
                    Email-Adresse
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white"
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
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Passwort ändern</CardTitle>
                <CardDescription className="text-slate-400">
                  Ändern Sie Ihr Passwort für mehr Sicherheit
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword" className="text-slate-300">
                    Aktuelles Passwort
                  </Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white"
                    placeholder="••••••••"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="text-slate-300">
                    Neues Passwort
                  </Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white"
                    placeholder="••••••••"
                  />
                  <p className="text-xs text-slate-500">Mindestens 8 Zeichen</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-slate-300">
                    Passwort bestätigen
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white"
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

          <TabsContent value="notifications" className="space-y-6 mt-6">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Benachrichtigungs-Einstellungen</CardTitle>
                <CardDescription className="text-slate-400">
                  Verwalten Sie, wie Sie über Änderungen informiert werden möchten
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* WhatsApp Alerts */}
                <div className="flex items-center justify-between space-x-4 p-4 bg-slate-700/30 rounded-lg">
                  <div className="flex-1">
                    <Label htmlFor="whatsapp" className="text-white font-medium">
                      WhatsApp-Benachrichtigungen
                    </Label>
                    <p className="text-sm text-slate-400 mt-1">
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
                <div className="flex items-center justify-between space-x-4 p-4 bg-slate-700/30 rounded-lg">
                  <div className="flex-1">
                    <Label htmlFor="email-notif" className="text-white font-medium">
                      Email-Benachrichtigungen
                    </Label>
                    <p className="text-sm text-slate-400 mt-1">
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
                <div className="flex items-center justify-between space-x-4 p-4 bg-slate-700/30 rounded-lg">
                  <div className="flex-1">
                    <Label htmlFor="newsletter" className="text-white font-medium">
                      Newsletter
                    </Label>
                    <p className="text-sm text-slate-400 mt-1">
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
