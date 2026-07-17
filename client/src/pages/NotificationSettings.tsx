import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Bell, MessageSquare, Save, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { Breadcrumb } from "@/components/Breadcrumb";
import { toast } from "sonner";

export default function NotificationSettings() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [whatsappAlerts, setWhatsappAlerts] = useState(false);
  const [mobile, setMobile] = useState("");

  const { data: settings, isLoading } = trpc.notificationSettings.getSettings.useQuery();
  const updateSettingsMutation = trpc.notificationSettings.updateSettings.useMutation({
    onSuccess: () => {
      toast.success("Einstellungen erfolgreich gespeichert!");
    },
    onError: (error) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });

  // Load settings when available
  useEffect(() => {
    if (settings) {
      setWhatsappAlerts(settings.whatsappAlerts);
      setMobile(settings.mobile || "");
    }
  }, [settings]);

  const handleSave = () => {
    updateSettingsMutation.mutate({
      whatsappAlerts,
      mobile,
    });
  };

  // A2 (Audit N-A1): Erst nach abgeschlossenem Auth-Laden umleiten — vorher
  // schlug der Redirect im transienten Ladezustand zu (isAuthenticated
  // kurzzeitig false), sodass eingeloggte Nutzer auf «/» landeten. Und den
  // Seiteneffekt in einen Effect verlegt (nicht im Render-Body).
  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/");
  }, [authLoading, isAuthenticated, setLocation]);

  if (authLoading) {
    return <div className="container max-w-4xl py-8 text-sm text-muted-foreground">Lädt …</div>;
  }
  if (!isAuthenticated) return null;

  return (
    <div className="container max-w-4xl py-8">
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Benachrichtigungen" },
        ]}
      />

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Bell className="h-8 w-8 text-primary" />
            Benachrichtigungen
          </h1>
          <p className="text-muted-foreground mt-2">
            Verwalten Sie Ihre Benachrichtigungseinstellungen
          </p>
        </div>
        <Button variant="outline" onClick={() => window.history.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Zurück
        </Button>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Lade Einstellungen...</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* WhatsApp Alerts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                WhatsApp-Benachrichtigungen
              </CardTitle>
              <CardDescription>
                Erhalten Sie Echtzeit-Updates zu Ihren Portfolio-Transaktionen per WhatsApp
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="whatsapp-alerts">WhatsApp-Benachrichtigungen aktivieren</Label>
                  <p className="text-sm text-muted-foreground">
                    Sie erhalten Nachrichten bei Käufen, Verkäufen und Gewichtsänderungen
                  </p>
                </div>
                <Switch
                  id="whatsapp-alerts"
                  checked={whatsappAlerts}
                  onCheckedChange={setWhatsappAlerts}
                />
              </div>

              {whatsappAlerts && (
                <div className="space-y-2 pt-4 border-t">
                  <Label htmlFor="mobile">Telefonnummer (mit Ländercode)</Label>
                  <Input
                    id="mobile"
                    type="tel"
                    placeholder="+41791234567"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    Format: +[Ländercode][Nummer] (z.B. +41 für Schweiz, +49 für Deutschland)
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Email Notifications (Placeholder) */}
          <Card className="opacity-60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                E-Mail-Benachrichtigungen
              </CardTitle>
              <CardDescription>
                Erhalten Sie wöchentliche Portfolio-Zusammenfassungen per E-Mail
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="email-notifications">E-Mail-Benachrichtigungen aktivieren</Label>
                  <p className="text-sm text-muted-foreground">
                    Wöchentliche Performance-Berichte und Dividenden-Erinnerungen
                  </p>
                </div>
                <Switch id="email-notifications" disabled />
              </div>
              <p className="text-sm text-yellow-600 mt-4">
                ⚠️ Diese Funktion ist noch in Entwicklung
              </p>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={updateSettingsMutation.isPending}
              size="lg"
            >
              {updateSettingsMutation.isPending ? (
                <>Speichere...</>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Einstellungen speichern
                </>
              )}
            </Button>
          </div>

          {/* Info Card */}
          <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <CardHeader>
              <CardTitle className="text-blue-900 dark:text-blue-100">
                💡 Über Benachrichtigungen
              </CardTitle>
            </CardHeader>
            <CardContent className="text-blue-800 dark:text-blue-200 space-y-2">
              <p><strong>WhatsApp-Benachrichtigungen umfassen:</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Bestätigung beim Hinzufügen neuer Aktien</li>
                <li>Benachrichtigung beim Verkauf von Positionen</li>
                <li>Updates bei Gewichtsänderungen im Portfolio</li>
                <li>Wichtige Marktbewegungen (in Entwicklung)</li>
              </ul>
              <p className="mt-4 text-sm">
                Hinweis: Für WhatsApp-Benachrichtigungen muss Twilio konfiguriert sein.
                Administratoren können dies unter <a href="/admin/secrets" className="underline font-medium">/admin/secrets</a> einrichten.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
