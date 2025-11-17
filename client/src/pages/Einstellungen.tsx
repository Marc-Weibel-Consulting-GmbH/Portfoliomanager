import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Settings as SettingsIcon, User, Bell, Download } from "lucide-react";

export default function Einstellungen() {
  const { user } = useAuth();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Einstellungen</h1>
          <p className="text-muted-foreground">
            Verwalten Sie Ihre Konto-Einstellungen und Präferenzen
          </p>
        </div>

        <div className="grid gap-6">
          {/* Profile Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profil
              </CardTitle>
              <CardDescription>
                Ihre persönlichen Informationen
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input 
                  id="name" 
                  defaultValue={user?.name || ''} 
                  disabled
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">E-Mail</Label>
                <Input 
                  id="email" 
                  type="email" 
                  defaultValue={user?.email || ''} 
                  disabled
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="username">Benutzername</Label>
                <Input 
                  id="username" 
                  defaultValue={user?.username || ''} 
                  disabled
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Profildaten werden über OAuth verwaltet und können hier nicht geändert werden.
              </p>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Benachrichtigungen
              </CardTitle>
              <CardDescription>
                Verwalten Sie Ihre Benachrichtigungseinstellungen
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Benachrichtigungseinstellungen werden in Kürze verfügbar sein.
              </p>
            </CardContent>
          </Card>

          {/* Data Export */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Daten exportieren
              </CardTitle>
              <CardDescription>
                Exportieren Sie Ihre Portfolio-Daten
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Laden Sie Ihre Portfolio-Daten als CSV oder PDF herunter.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" disabled>
                  Als CSV exportieren
                </Button>
                <Button variant="outline" disabled>
                  Als PDF exportieren
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
